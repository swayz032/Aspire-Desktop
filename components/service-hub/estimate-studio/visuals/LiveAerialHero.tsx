/**
 * LiveAerialHero — Google Aerial View API drone-flyover MP4 player.
 *
 * Replaces the deprecated Maps JS hybrid+tilt-45 path. Google deprecated
 * auto-45° satellite imagery in v3.62, so we now consume the Aerial View API
 * directly via the backend proxy:
 *
 *   GET /api/property/aerial-video?address={addr}
 *     → { status, videoUrl, videoH265Url, thumbnailUrl, message, cachedAt }
 *
 * Web-only: native <video> element (RN-Web has no <Video> component, so we
 * use React.createElement('video', ...) — same pattern the panorama hero uses
 * for its <div> mount).
 *
 * States:
 *   loading     → SheenBlock skeleton
 *   processing  → SheenBlock + "Generating drone flyover…" caption (single
 *                 retry after 3s — never infinite-loop)
 *   ready       → autoplay muted looping H264 video
 *   unavailable → soft fallback: "Aerial flyover not available, try Street View"
 *   error       → cloud-offline error overlay
 *
 * Aspire Law #7: pure render. Aspire Law #9: never logs `coords` or `address`.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SheenBlock } from './InsightCardBase';
import { useProjectAddress } from '@/hooks/useProjectAddress';
import { useAuthFetch } from '@/lib/authenticatedFetch';

interface Props {
  coords?: { lat: number; lng: number };
  /** Server-validated canonical address (e.g. "123 Main St, City, ST 12345-6789, USA").
   *  Optional fallback to the raw store address — but Google Aerial View's
   *  lookup table only hits when fed the canonical form. */
  canonicalAddress?: string;
  loading: boolean;
  onReturn?: () => void;
}

type AerialVideoStatus = 'ready' | 'processing' | 'unavailable' | 'error';

type AerialVideoResponse = {
  status: AerialVideoStatus;
  videoUrl?: string;
  videoH265Url?: string;
  thumbnailUrl?: string;
  message?: string;
  cachedAt?: string;
};

type LoadStatus = 'idle' | 'loading' | 'processing' | 'ready' | 'unavailable' | 'error';

const PROCESSING_RETRY_MS = 5000;
// Google Aerial View first-time renders for residential addresses can take
// 3-5 minutes (verified live 2026-05-10 against a Forest Park GA address —
// still PROCESSING at 10 min). 60 attempts × 5s = 5 minutes of patient
// polling, then we surrender to the soft skeleton (user can navigate away
// and come back — by then it's cached and instant).
const MAX_RETRIES = 60;

export function LiveAerialHero({ coords, canonicalAddress, loading, onReturn }: Props) {
  const { address: storeAddress } = useProjectAddress();
  // Prefer the server-validated canonical address (full +4 ZIP) — falls back
  // to the raw store address only if the parent hasn't validated yet.
  const address = canonicalAddress || storeAddress;
  const { authenticatedFetch } = useAuthFetch();

  const [status, setStatus] = useState<LoadStatus>('idle');
  const [videoUrl, setVideoUrl] = useState<string | undefined>(undefined);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>(undefined);

  // Stable refs so the effect dep list stays primitive-only.
  const fetchRef = useRef(authenticatedFetch);
  fetchRef.current = authenticatedFetch;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!coords || !address) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;

    setStatus('loading');

    const run = async () => {
      try {
        const url = `/api/property/aerial-video?address=${encodeURIComponent(address)}`;
        const resp = await fetchRef.current(url);
        if (cancelled) return;

        if (!resp.ok) {
          setStatus('error');
          return;
        }
        const body = (await resp.json()) as AerialVideoResponse;
        if (cancelled) return;

        switch (body.status) {
          case 'ready': {
            if (!body.videoUrl) {
              setStatus('error');
              return;
            }
            setVideoUrl(body.videoUrl);
            setThumbnailUrl(body.thumbnailUrl);
            setStatus('ready');
            return;
          }
          case 'processing': {
            setThumbnailUrl(body.thumbnailUrl);
            setStatus('processing');
            // Bounded progressive polling — never infinite, never gives up
            // before Google's typical 60-120s render window for new addresses.
            if (retryCount < MAX_RETRIES) {
              retryCount += 1;
              retryTimer = setTimeout(() => {
                if (!cancelled) void run();
              }, PROCESSING_RETRY_MS);
            } else {
              // Genuinely stuck after the budget — leave skeleton in place;
              // user can switch back to Street View.
              setStatus('processing');
            }
            return;
          }
          case 'unavailable':
            setStatus('unavailable');
            return;
          case 'error':
          default:
            setStatus('error');
            return;
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
    // Key on primitive lat/lng + address so we don't refire on object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.lat, coords?.lng, address]);

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.shell, styles.fallbackShell]}>
        <Text style={styles.fallbackSubtitle}>Aerial preview is web-only.</Text>
      </View>
    );
  }

  const showSkeleton = loading || status === 'idle' || status === 'loading';
  const showProcessing = status === 'processing';
  const showUnavailable = status === 'unavailable';
  const showError = status === 'error';
  const hasVideo = Boolean(videoUrl) && status === 'ready';
  // Prefer H265 (HEVC) for "Crisp 4K" detail if the backend provided it.
  const activeVideoUrl = (status === 'ready' && videoH265Url) ? videoH265Url : videoUrl;

  return (
    <View style={styles.shell} testID="live-aerial-hero">
      {/* Always-mount the video element once we have a URL — overlays sit on top */}
      {hasVideo &&
        React.createElement('video', {
          src: activeVideoUrl,
          poster: thumbnailUrl,
          autoPlay: true,
          loop: true,
          muted: true,
          playsInline: true,
          preload: 'metadata',
          style: {
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 12,
            backgroundColor: '#0F0F12',
          },
        })}

      {/* Loading skeleton */}
      {showSkeleton && (
        <View style={styles.overlayFill} pointerEvents="none" testID="live-aerial-hero-loading">
          <SheenBlock width="100%" height="100%" radius={12} />
        </View>
      )}

      {/* Processing — soft pulse + caption */}
      {showProcessing && (
        <View style={styles.overlayFill} pointerEvents="none" testID="live-aerial-hero-processing">
          <SheenBlock width="100%" height="100%" radius={12} />
          <View style={styles.processingCaption}>
            <Ionicons name="videocam-outline" size={14} color="#fbbf24" />
            <Text style={styles.processingText}>Generating drone flyover…</Text>
          </View>
        </View>
      )}

      {/* Unavailable — soft fallback, suggest Street View */}
      {showUnavailable && (
        <View
          style={[styles.overlayFill, styles.fallbackShell]}
          testID="live-aerial-hero-unavailable"
        >
          <View style={styles.fallbackIcon}>
            <Ionicons name="cloud-offline-outline" size={28} color="rgba(255,255,255,0.55)" />
          </View>
          <Text style={styles.fallbackTitle}>Aerial flyover not available</Text>
          <Text style={styles.fallbackSubtitle}>
            This property isn&apos;t covered yet — try Street View for a curb-side look.
          </Text>
        </View>
      )}

      {/* Error overlay */}
      {showError && (
        <View style={[styles.overlayFill, styles.fallbackShell]} testID="live-aerial-hero-error">
          <View style={[styles.fallbackIcon, styles.fallbackIconError]}>
            <Ionicons name="cloud-offline-outline" size={28} color="#ff6b6b" />
          </View>
          <Text style={styles.fallbackTitle}>Could not load aerial view</Text>
          <Text style={styles.fallbackSubtitle}>
            Try Street View instead — we&apos;ll keep retrying in the background.
          </Text>
        </View>
      )}

      {/* Return-to-Street-View pill — top-right (unchanged from prior version) */}
      <Pressable
        onPress={onReturn}
        accessibilityRole="button"
        accessibilityLabel="Return to Street View"
        style={({ hovered }: any) => [styles.returnPill, hovered && styles.returnPillHover]}
      >
        <Ionicons name="walk-outline" size={12} color="#fbbf24" />
        <Text style={styles.returnPillText}>Return to Street View</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    width: '100%',
    minHeight: 360,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F0F12',
    position: 'relative',
  },
  fallbackShell: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  overlayFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F0F12',
  },
  processingCaption: {
    position: 'absolute',
    bottom: 18,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
    left: '50%',
    ...(Platform.OS === 'web'
      ? (({ transform: 'translateX(-50%)' } as unknown) as ViewStyle)
      : {}),
  },
  processingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fbbf24',
    letterSpacing: -0.1,
  },
  fallbackIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackIconError: {
    borderColor: 'rgba(255,107,107,0.25)',
    backgroundColor: 'rgba(255,107,107,0.05)',
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.2,
  },
  fallbackSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 420,
  },
  returnPill: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
    ...(Platform.OS === 'web'
      ? (({
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          transition: 'border-color 150ms ease-out, transform 150ms ease-out',
        } as unknown) as ViewStyle)
      : {}),
  },
  returnPillHover: {
    borderColor: 'rgba(251,191,36,0.65)',
    ...(Platform.OS === 'web'
      ? (({ transform: 'translateY(-1px)' } as unknown) as ViewStyle)
      : {}),
  },
  returnPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: -0.1,
  },
});
