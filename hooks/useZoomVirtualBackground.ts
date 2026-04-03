/**
 * useZoomVirtualBackground — virtual background and blur via Zoom SDK.
 * Uses stream.updateVirtualBackgroundImage(imageUrl | undefined).
 * undefined = blur mode, string = image URL, null = none.
 */
import { useState, useCallback } from 'react';
import { reportProviderError } from '@/lib/providerErrorReporter';

export type VBMode = 'none' | 'blur' | 'image';

interface UseZoomVirtualBackgroundResult {
  mode: VBMode;
  imageUrl: string | null;
  setBlur: () => Promise<void>;
  setImage: (url: string) => Promise<void>;
  clearBackground: () => Promise<void>;
  isSupported: boolean;
}

export function useZoomVirtualBackground(stream: any | null): UseZoomVirtualBackgroundResult {
  const [mode, setMode] = useState<VBMode>('none');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const isSupported = !!stream && typeof stream.updateVirtualBackgroundImage === 'function';

  const setBlur = useCallback(async () => {
    if (!stream || !isSupported) return;
    try {
      await stream.updateVirtualBackgroundImage(undefined); // undefined = blur
      setMode('blur');
      setImageUrl(null);
    } catch (e) {
      reportProviderError({ provider: 'zoom', action: 'set_blur', error: e, component: 'useZoomVirtualBackground' });
    }
  }, [stream, isSupported]);

  const setImage = useCallback(async (url: string) => {
    if (!stream || !isSupported) return;
    try {
      await stream.updateVirtualBackgroundImage(url);
      setMode('image');
      setImageUrl(url);
    } catch (e) {
      reportProviderError({ provider: 'zoom', action: 'set_vb_image', error: e, component: 'useZoomVirtualBackground' });
    }
  }, [stream, isSupported]);

  const clearBackground = useCallback(async () => {
    if (!stream) return;
    try {
      // Pass empty string or false to clear — SDK behavior varies
      if (typeof stream.updateVirtualBackgroundImage === 'function') {
        await stream.updateVirtualBackgroundImage('');
      }
      setMode('none');
      setImageUrl(null);
    } catch (e) {
      reportProviderError({ provider: 'zoom', action: 'clear_vb', error: e, component: 'useZoomVirtualBackground' });
    }
  }, [stream]);

  return { mode, imageUrl, setBlur, setImage, clearBackground, isSupported };
}
