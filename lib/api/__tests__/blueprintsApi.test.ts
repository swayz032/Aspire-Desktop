/**
 * blueprintsApi — signed-upload flow tests (2026-05-19).
 *
 * Covers the new direct-PUT path:
 *   - requestSignedUpload()  : metadata POST + size/MIME pre-validation
 *   - completeUpload()       : dispatch confirmation
 *
 * The legacy `uploadBlueprint()` path is exercised indirectly via the
 * `useBlueprintUpload` hook and not duplicated here.
 */
import {
  requestSignedUpload,
  completeUpload,
  BlueprintsApiError,
  MAX_UPLOAD_BYTES,
} from '../blueprintsApi';

type FetchFn = (url: string, options?: RequestInit) => Promise<Response>;

function _mkResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('requestSignedUpload', () => {
  it('throws FILE_TOO_LARGE synchronously without calling fetch', async () => {
    const fetchMock: jest.MockedFunction<FetchFn> = jest.fn();
    await expect(
      requestSignedUpload(fetchMock, {
        filename: 'big.pdf',
        mimeType: 'application/pdf',
        sizeBytes: MAX_UPLOAD_BYTES + 1,
        officeId: 'office_1',
      }),
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE', status: 413 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws UNSUPPORTED_MEDIA_TYPE for unknown MIME types', async () => {
    const fetchMock: jest.MockedFunction<FetchFn> = jest.fn();
    await expect(
      requestSignedUpload(fetchMock, {
        filename: 'weird.dwg',
        // Force an invalid MIME — the validator runs on the literal value.
        mimeType: 'application/dwg' as never,
        sizeBytes: 1024,
        officeId: 'office_1',
      }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE', status: 415 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs metadata with X-Office-Id and returns the signed-URL response', async () => {
    const successBody = {
      upload_id: 'upl_abc',
      storage_path: 'blueprint-raw-pdfs/suite/upl_abc/raw.pdf',
      signed_url: 'https://example.supabase.co/storage/v1/upload/sign/xyz',
      correlation_id: 'corr_1',
      receipt_id: 'rcpt_1',
    };
    const fetchMock: jest.MockedFunction<FetchFn> = jest
      .fn()
      .mockResolvedValue(_mkResponse(200, successBody));

    const result = await requestSignedUpload(fetchMock, {
      filename: 'plan.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 5 * 1024 * 1024,
      officeId: 'office_42',
      correlationId: 'corr_seed',
    });

    expect(result).toEqual(successBody);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/blueprints/upload-init');
    expect(opts?.method).toBe('POST');
    expect((opts?.headers as Record<string, string>)['X-Office-Id']).toBe('office_42');
    const sent = JSON.parse((opts?.body as string) ?? '{}');
    expect(sent).toEqual({
      filename: 'plan.pdf',
      mime_type: 'application/pdf',
      size_bytes: 5 * 1024 * 1024,
      correlation_id: 'corr_seed',
    });
  });

  it('raises BlueprintsApiError on non-2xx with parsed error fields', async () => {
    const fetchMock: jest.MockedFunction<FetchFn> = jest.fn().mockResolvedValue(
      _mkResponse(503, {
        error: 'ORCHESTRATOR_UNAVAILABLE',
        message: 'Backend offline',
        correlation_id: 'corr_z',
      }),
    );

    await expect(
      requestSignedUpload(fetchMock, {
        filename: 'plan.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        officeId: 'office_1',
      }),
    ).rejects.toMatchObject({
      status: 503,
      code: 'ORCHESTRATOR_UNAVAILABLE',
      message: 'Backend offline',
      correlationId: 'corr_z',
    });
  });
});

describe('completeUpload', () => {
  it('POSTs upload_id + filename and returns the dispatch response', async () => {
    const dispatch = {
      success: true,
      project_id: 'proj_777',
      status: 'queued',
      correlation_id: 'corr_x',
      filename: 'plan.pdf',
      size_bytes: 12345,
    };
    const fetchMock: jest.MockedFunction<FetchFn> = jest
      .fn()
      .mockResolvedValue(_mkResponse(202, dispatch));

    const result = await completeUpload(fetchMock, {
      upload_id: 'upl_abc',
      filename: 'plan.pdf',
      officeId: 'office_42',
      correlationId: 'corr_x',
    });

    expect(result).toEqual(dispatch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/blueprints/upload-complete');
    expect((opts?.headers as Record<string, string>)['X-Office-Id']).toBe('office_42');
    const sent = JSON.parse((opts?.body as string) ?? '{}');
    expect(sent).toEqual({
      upload_id: 'upl_abc',
      filename: 'plan.pdf',
      correlation_id: 'corr_x',
    });
  });

  it('raises BlueprintsApiError on dedup failure (4xx)', async () => {
    const fetchMock: jest.MockedFunction<FetchFn> = jest.fn().mockResolvedValue(
      _mkResponse(409, {
        error: 'DEDUP_REJECTED',
        message: 'Duplicate content hash',
      }),
    );

    await expect(
      completeUpload(fetchMock, {
        upload_id: 'upl_abc',
        filename: 'plan.pdf',
        officeId: 'office_1',
        correlationId: 'corr_y',
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'DEDUP_REJECTED',
    });
  });

  it('falls back to generic message when error body is non-JSON', async () => {
    const fetchMock: jest.MockedFunction<FetchFn> = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);

    await expect(
      completeUpload(fetchMock, {
        upload_id: 'upl_abc',
        filename: 'plan.pdf',
        officeId: 'office_1',
        correlationId: 'corr_y',
      }),
    ).rejects.toBeInstanceOf(BlueprintsApiError);
  });
});
