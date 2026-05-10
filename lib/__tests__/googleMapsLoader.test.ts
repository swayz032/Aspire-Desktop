/**
 * @jest-environment jsdom
 *
 * googleMapsLoader tests — Service Hub Phase 3, Pass 3.2.
 *
 * jsdom environment is provided by jest-expo preset for hooks/lib tests.
 */
import {
  loadGoogleMaps,
  __resetGoogleMapsLoaderForTests,
  GoogleMapsLoaderError,
} from '../googleMapsLoader';

describe('googleMapsLoader', () => {
  beforeEach(() => {
    __resetGoogleMapsLoaderForTests();
    jest.useRealTimers();
  });

  afterEach(() => {
    __resetGoogleMapsLoaderForTests();
  });

  it('rejects when API key is missing', async () => {
    await expect(loadGoogleMaps({ apiKey: '' })).rejects.toMatchObject({
      name: 'GoogleMapsLoaderError',
      code: 'MISSING_API_KEY',
    });
  });

  it('resolves immediately if window.google.maps already exists', async () => {
    (window as any).google = { maps: { __already: true } };
    const g = await loadGoogleMaps({ apiKey: 'test-key' });
    expect((g as any).maps.__already).toBe(true);
  });

  it('injects script tag and resolves on callback', async () => {
    const promise = loadGoogleMaps({
      apiKey: 'test-key',
      libraries: ['streetView'],
    });

    // Wait a tick for the script tag to be appended.
    await new Promise((r) => setTimeout(r, 0));
    const script = document.getElementById('aspire-google-maps-js') as HTMLScriptElement | null;
    expect(script).toBeTruthy();
    expect(script?.src).toContain('key=test-key');
    expect(script?.src).toContain('libraries=streetView');
    expect(script?.src).toContain('loading=async');
    expect(script?.src).toContain('callback=__aspireGoogleMapsLoaded');

    // Simulate Maps JS firing the callback.
    (window as any).google = { maps: { __loaded: true } };
    (window as any).__aspireGoogleMapsLoaded?.();

    const g = await promise;
    expect((g as any).maps.__loaded).toBe(true);
  });

  it('deduplicates concurrent loads — script tag injected once', async () => {
    const p1 = loadGoogleMaps({ apiKey: 'test-key' });
    const p2 = loadGoogleMaps({ apiKey: 'test-key' });
    expect(p1).toBe(p2);

    await new Promise((r) => setTimeout(r, 0));
    const scripts = document.querySelectorAll('#aspire-google-maps-js');
    expect(scripts.length).toBe(1);

    (window as any).google = { maps: {} };
    (window as any).__aspireGoogleMapsLoaded?.();
    await Promise.all([p1, p2]);
  });

  it('rejects on script onerror', async () => {
    const promise = loadGoogleMaps({ apiKey: 'test-key' });
    await new Promise((r) => setTimeout(r, 0));
    const script = document.getElementById('aspire-google-maps-js') as HTMLScriptElement;
    (script.onerror as (e: Event) => void)?.(new Event('error'));
    await expect(promise).rejects.toMatchObject({
      name: 'GoogleMapsLoaderError',
      code: 'SCRIPT_ERROR',
    });
  });

  it('rejects on timeout', async () => {
    jest.useFakeTimers();
    const promise = loadGoogleMaps({ apiKey: 'test-key' });
    // Suppress the rejection during fake-timer advance.
    const caught = promise.catch((e) => e);
    jest.advanceTimersByTime(30_001);
    const err = await caught;
    expect(err).toBeInstanceOf(GoogleMapsLoaderError);
    expect((err as GoogleMapsLoaderError).code).toBe('TIMEOUT');
    jest.useRealTimers();
  });

  it('after error, next call retries cleanly', async () => {
    const p1 = loadGoogleMaps({ apiKey: 'test-key' });
    await new Promise((r) => setTimeout(r, 0));
    const script1 = document.getElementById('aspire-google-maps-js') as HTMLScriptElement;
    (script1.onerror as (e: Event) => void)?.(new Event('error'));
    await expect(p1).rejects.toBeDefined();

    // New attempt should inject a fresh script.
    const p2 = loadGoogleMaps({ apiKey: 'test-key' });
    await new Promise((r) => setTimeout(r, 0));
    const script2 = document.getElementById('aspire-google-maps-js') as HTMLScriptElement;
    expect(script2).toBeTruthy();

    (window as any).google = { maps: {} };
    (window as any).__aspireGoogleMapsLoaded?.();
    await expect(p2).resolves.toBeTruthy();
  });
});
