/**
 * useBlueprintUpload — signed-upload flow tests (2026-05-19).
 *
 * Verifies the 3-step state machine:
 *   idle → init → uploading → completing → ingesting (handoff to polling).
 *
 * Mocks `requestSignedUpload`, `completeUpload` from blueprintsApi and stubs
 * the global XMLHttpRequest so `_putFileXhr` resolves synchronously.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';

jest.mock('@/lib/authenticatedFetch', () => ({
  useAuthFetch: () => ({ authenticatedFetch: jest.fn() }),
}));

jest.mock('@/providers', () => ({
  useTenant: () => ({ officeId: 'office_test' }),
}));

jest.mock('@/lib/blueprintUploadStore', () => ({
  setBlueprintUpload: jest.fn(),
  resetBlueprintUpload: jest.fn(),
}));

jest.mock('@/lib/api/blueprintsApi', () => {
  const actual = jest.requireActual('@/lib/api/blueprintsApi');
  return {
    ...actual,
    requestSignedUpload: jest.fn(),
    completeUpload: jest.fn(),
  };
});

import { useBlueprintUpload } from '../useBlueprintUpload';
import { requestSignedUpload, completeUpload, BlueprintsApiError } from '@/lib/api/blueprintsApi';

const requestSignedUploadMock = requestSignedUpload as jest.MockedFunction<
  typeof requestSignedUpload
>;
const completeUploadMock = completeUpload as jest.MockedFunction<typeof completeUpload>;

// ---------------------------------------------------------------------------
// XMLHttpRequest stub — succeeds synchronously by default.
// ---------------------------------------------------------------------------

class FakeXHR {
  static instances: FakeXHR[] = [];
  upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null };
  status = 200;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  shouldFail = false;
  failStatus = 0;
  open(_method: string, _url: string): void {}
  setRequestHeader(_k: string, _v: string): void {}
  abort(): void {
    this.onabort?.();
  }
  send(_body: unknown): void {
    // Fire a progress tick + load on next tick.
    setTimeout(() => {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 } as ProgressEvent);
      this.upload.onprogress?.({
        lengthComputable: true,
        loaded: 100,
        total: 100,
      } as ProgressEvent);
      if (this.shouldFail) {
        if (this.failStatus > 0) {
          this.status = this.failStatus;
          this.onload?.();
        } else {
          this.onerror?.();
        }
      } else {
        this.onload?.();
      }
    }, 0);
  }
  constructor() {
    FakeXHR.instances.push(this);
  }
}

const _origXHR = (global as { XMLHttpRequest?: typeof XMLHttpRequest }).XMLHttpRequest;

beforeEach(() => {
  FakeXHR.instances = [];
  (global as unknown as { XMLHttpRequest: typeof FakeXHR }).XMLHttpRequest = FakeXHR;
  requestSignedUploadMock.mockReset();
  completeUploadMock.mockReset();
});

afterAll(() => {
  if (_origXHR) {
    (global as unknown as { XMLHttpRequest: typeof XMLHttpRequest }).XMLHttpRequest = _origXHR;
  }
});

function _mkFile(name = 'plan.pdf', size = 1024 * 10, type = 'application/pdf'): File {
  // Real File constructor; we override `size` on the instance because Blob
  // size is read-only but jsdom allows reassignment in some environments.
  const blob = new Blob([new Uint8Array(size)], { type });
  const f = new File([blob], name, { type });
  Object.defineProperty(f, 'size', { value: size, configurable: true });
  return f;
}

describe('useBlueprintUpload — signed-upload flow', () => {
  it('starts in idle phase', () => {
    const { result } = renderHook(() => useBlueprintUpload());
    expect(result.current.phase).toBe('idle');
  });

  it('rejects oversize files in error phase without calling APIs', async () => {
    const { result } = renderHook(() => useBlueprintUpload());
    const big = _mkFile('huge.pdf', 60 * 1024 * 1024);
    await act(async () => {
      await result.current.upload(big);
    });
    expect(result.current.phase).toBe('error');
    expect(result.current.error?.code).toBe('FILE_TOO_LARGE');
    expect(requestSignedUploadMock).not.toHaveBeenCalled();
  });

  it('completes happy-path: init → uploading → completing → ingesting', async () => {
    requestSignedUploadMock.mockResolvedValue({
      upload_id: 'upl_1',
      storage_path: 'blueprint-raw-pdfs/suite/upl_1/raw.pdf',
      signed_url: 'https://example.test/signed-put',
      correlation_id: 'corr_1',
      receipt_id: 'rcpt_1',
    });
    completeUploadMock.mockResolvedValue({
      success: true,
      project_id: 'proj_1',
      status: 'queued',
      correlation_id: 'corr_1',
      filename: 'plan.pdf',
      size_bytes: 10240,
    });

    const { result } = renderHook(() => useBlueprintUpload());
    await act(async () => {
      await result.current.upload(_mkFile());
    });

    await waitFor(() => expect(result.current.phase).toBe('ingesting'));
    expect(requestSignedUploadMock).toHaveBeenCalledTimes(1);
    expect(completeUploadMock).toHaveBeenCalledTimes(1);
    expect(completeUploadMock.mock.calls[0][1].upload_id).toBe('upl_1');
    expect(result.current.stageProgress.ingest).toBe('running');
  });

  it('lands in error phase when requestSignedUpload throws', async () => {
    requestSignedUploadMock.mockRejectedValue(
      new BlueprintsApiError(503, 'ORCHESTRATOR_UNAVAILABLE', 'Backend offline'),
    );

    const { result } = renderHook(() => useBlueprintUpload());
    await act(async () => {
      await result.current.upload(_mkFile());
    });

    await waitFor(() => expect(result.current.phase).toBe('error'));
    expect(result.current.error?.code).toBe('ORCHESTRATOR_UNAVAILABLE');
    expect(completeUploadMock).not.toHaveBeenCalled();
  });

  it('lands in error phase when Storage PUT returns non-2xx', async () => {
    requestSignedUploadMock.mockResolvedValue({
      upload_id: 'upl_1',
      storage_path: 'p',
      signed_url: 'https://example.test/signed-put',
      correlation_id: 'corr_1',
      receipt_id: 'rcpt_1',
    });
    // Patch the next XHR instance to fail.
    const _origSend = FakeXHR.prototype.send;
    FakeXHR.prototype.send = function (this: FakeXHR, body: unknown) {
      this.shouldFail = true;
      this.failStatus = 403;
      _origSend.call(this, body);
    };

    const { result } = renderHook(() => useBlueprintUpload());
    await act(async () => {
      await result.current.upload(_mkFile());
    });

    await waitFor(() => expect(result.current.phase).toBe('error'));
    expect(result.current.error?.code).toBe('STORAGE_PUT_FAILED');
    expect(completeUploadMock).not.toHaveBeenCalled();

    // Restore
    FakeXHR.prototype.send = _origSend;
  });

  it('lands in error phase when completeUpload throws', async () => {
    requestSignedUploadMock.mockResolvedValue({
      upload_id: 'upl_1',
      storage_path: 'p',
      signed_url: 'https://example.test/signed-put',
      correlation_id: 'corr_1',
      receipt_id: 'rcpt_1',
    });
    completeUploadMock.mockRejectedValue(
      new BlueprintsApiError(409, 'DEDUP_REJECTED', 'Duplicate'),
    );

    const { result } = renderHook(() => useBlueprintUpload());
    await act(async () => {
      await result.current.upload(_mkFile());
    });

    await waitFor(() => expect(result.current.phase).toBe('error'));
    expect(result.current.error?.code).toBe('DEDUP_REJECTED');
    expect(result.current.stageProgress.ingest).toBe('error');
  });
});
