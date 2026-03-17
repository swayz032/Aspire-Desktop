/**
 * Tests for lib/providerErrorReporter.ts
 */
import { reportProviderError, _resetProviderRateLimiter } from '@/lib/providerErrorReporter';
import { reportError, _resetRateLimiter } from '@/lib/errorReporter';

// Mock the underlying reportError
jest.mock('@/lib/errorReporter', () => ({
  reportError: jest.fn().mockResolvedValue(undefined),
  _resetRateLimiter: jest.fn(),
}));

const mockReportError = reportError as jest.MockedFunction<typeof reportError>;

describe('reportProviderError', () => {
  beforeEach(() => {
    mockReportError.mockClear();
    _resetProviderRateLimiter();
  });

  it('calls reportError with provider-specific fields', () => {
    reportProviderError({
      provider: 'deepgram',
      action: 'stt_start',
      error: new Error('Connection timeout'),
      component: 'useDeepgramSTT',
    });

    expect(mockReportError).toHaveBeenCalledTimes(1);
    const opts = mockReportError.mock.calls[0][0];
    expect(opts.title).toBe('Provider error: deepgram stt_start');
    expect(opts.severity).toBe('sev3');
    expect(opts.source).toBe('desktop_provider');
    expect(opts.component).toBe('useDeepgramSTT');
    expect(opts.errorCode).toBe('PROVIDER_DEEPGRAM_ERROR');
    expect(opts.message).toBe('Connection timeout');
    expect(opts.fingerprint).toContain('desktop:provider:deepgram:stt_start:');
  });

  it('handles non-Error objects', () => {
    reportProviderError({
      provider: 'elevenlabs',
      action: 'tts',
      error: 'string error',
    });

    const opts = mockReportError.mock.calls[0][0];
    expect(opts.message).toBe('string error');
    expect(opts.stackTrace).toBeUndefined();
  });

  it('defaults component to provider name', () => {
    reportProviderError({
      provider: 'anam',
      action: 'connect',
      error: new Error('fail'),
    });

    expect(mockReportError.mock.calls[0][0].component).toBe('anam');
  });

  it('rate-limits per provider to 3 per window', () => {
    for (let i = 0; i < 5; i++) {
      reportProviderError({
        provider: 'deepgram',
        action: 'stt',
        error: new Error(`err ${i}`),
      });
    }

    expect(mockReportError).toHaveBeenCalledTimes(3);
  });

  it('rate-limits total across providers to 10 per window', () => {
    // 3 per provider * 4 providers = 12 attempted, but total limit is 10
    const providers = ['deepgram', 'elevenlabs', 'anam', 'livekit'];
    for (const p of providers) {
      for (let i = 0; i < 3; i++) {
        reportProviderError({
          provider: p,
          action: 'test',
          error: new Error(`err ${i}`),
        });
      }
    }

    expect(mockReportError).toHaveBeenCalledTimes(10);
  });

  it('truncates message to 500 chars', () => {
    reportProviderError({
      provider: 'elevenlabs',
      action: 'tts',
      error: new Error('x'.repeat(1000)),
    });

    const opts = mockReportError.mock.calls[0][0];
    expect(opts.message!.length).toBe(500);
  });
});
