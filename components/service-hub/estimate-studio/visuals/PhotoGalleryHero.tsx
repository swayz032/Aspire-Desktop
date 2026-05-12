/**
 * PhotoGalleryHero — swipeable image carousel for interior / exterior / roof.
 *
 * Layout:
 *   ┌────────────────────────────────────────────────────────────┐
 *   │ Title · 12 photos · close to return       [✕]              │
 *   ├────────────────────────────────────────────────────────────┤
 *   │   ◀                                                  ▶     │
 *   │              [main image — 12:5 aspect]                    │
 *   │                                          3 / 18            │
 *   ├────────────────────────────────────────────────────────────┤
 *   │ caption (if present)                                       │
 *   ├────────────────────────────────────────────────────────────┤
 *   │ [thumb][thumb][thumb][thumb][thumb] …                       │
 *   └────────────────────────────────────────────────────────────┘
 *
 * Empty state: friendly upload prompt, never a blank black box.
 * Aspire Law #7: pure render. State is local (current index).
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SheenBlock } from './InsightCardBase';

interface Photo {
  id: string;
  url: string;
  caption?: string;
}

interface Props {
  photos?: Photo[];
  title: string;
  loading?: boolean;
  onClose?: () => void;
}

export function PhotoGalleryHero({
  photos = [],
  title,
  loading = false,
  onClose,
}: Props) {
  const [index, setIndex] = useState(0);

  const safePhotos = useMemo(() => photos ?? [], [photos]);
  const total = safePhotos.length;

  // Reset index if the photo list changes underneath us.
  useEffect(() => {
    setIndex((curr) => (curr >= total ? 0 : curr));
  }, [total]);

  const goPrev = useCallback(() => {
    setIndex((curr) => (curr - 1 + total) % total);
  }, [total]);

  const goNext = useCallback(() => {
    setIndex((curr) => (curr + 1) % total);
  }, [total]);

  // Web keyboard nav — arrow keys + escape close.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      if (total === 0) return;
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'Escape' && onClose) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [goPrev, goNext, onClose, total]);

  if (loading) {
    return (
      <View style={styles.shell} testID="photo-gallery-hero-loading">
        <SheenBlock width="100%" height={400} radius={12} />
      </View>
    );
  }

  if (total === 0) {
    return (
      <View style={[styles.shell, styles.empty]} testID="photo-gallery-hero-empty">
        <View style={styles.emptyHeader}>
          <Text style={styles.title}>{title} · 0 photos</Text>
          {onClose && (
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Return to Street View"
              style={({ hovered }: any) => [styles.closeButton, hovered && styles.closeButtonHover]}
            >
              <Ionicons name="close" size={14} color="rgba(255,255,255,0.85)" />
            </Pressable>
          )}
        </View>
        <View style={styles.emptyBody}>
          <View style={styles.emptyIcon}>
            <Ionicons name="cloud-upload-outline" size={28} color="rgba(255,255,255,0.55)" />
          </View>
          <Text style={styles.emptyTitle}>No {title.toLowerCase()} photos available</Text>
          <Text style={styles.emptySubtitle}>
            Drop in your own to populate this lane — Tim will fold them into the estimate.
          </Text>
        </View>
      </View>
    );
  }

  const current = safePhotos[index];
  // Defensive: index can briefly point past the array end between a photo
  // list shrinking and the useEffect reset firing on the next render. Bail
  // to the empty state so the gallery doesn't crash on undefined.url.
  if (!current) {
    return (
      <View style={[styles.shell, styles.empty]} testID="photo-gallery-hero-empty">
        <View style={styles.emptyHeader}>
          <Text style={styles.title}>{title} · 0 photos</Text>
          {onClose && (
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Return to Street View"
              style={({ hovered }: any) => [styles.closeButton, hovered && styles.closeButtonHover]}
            >
              <Ionicons name="close" size={14} color="rgba(255,255,255,0.85)" />
            </Pressable>
          )}
        </View>
        <View style={styles.emptyBody}>
          <View style={styles.emptyIcon}>
            <Ionicons name="cloud-upload-outline" size={28} color="rgba(255,255,255,0.55)" />
          </View>
          <Text style={styles.emptyTitle}>No {title.toLowerCase()} photos available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.shell} testID="photo-gallery-hero">
      {/* Header bar + floating close removed — to return to the
          Street View hero the user taps the Street View card in the
          photo lane below the canvas. No X button needed. */}

      <View style={styles.mainImageWrap}>

        <Image
          source={{ uri: current.url }}
          style={styles.mainImage}
          // `contain` shows the full photo without cropping (Zillow shots
          // are landscape AND portrait — `cover` was stretching portrait
          // shots into a blurry mess on the 12:5 hero). The dark wrap
          // letterboxes the empty space so the photo always reads as
          // intentional framing, not broken layout.
          resizeMode="contain"
          accessibilityLabel={current.caption ?? `${title} photo ${index + 1} of ${total}`}
        />

        {total > 1 && (
          <>
            <Pressable
              onPress={goPrev}
              accessibilityRole="button"
              accessibilityLabel="Previous photo"
              style={({ hovered }: any) => [
                styles.arrow,
                styles.arrowLeft,
                hovered && styles.arrowHover,
              ]}
            >
              <Ionicons name="chevron-back" size={18} color="#ffffff" />
            </Pressable>
            <Pressable
              onPress={goNext}
              accessibilityRole="button"
              accessibilityLabel="Next photo"
              style={({ hovered }: any) => [
                styles.arrow,
                styles.arrowRight,
                hovered && styles.arrowHover,
              ]}
            >
              <Ionicons name="chevron-forward" size={18} color="#ffffff" />
            </Pressable>
          </>
        )}

        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {index + 1} / {total}
          </Text>
        </View>
      </View>

      {/* Caption text removed — was eating vertical space below the
          image. Photo speaks for itself; caption lives in the
          accessibility label on the image. */}

      {/* Internal gallery thumb strip removed — within-set navigation
          uses the left/right arrows + counter (1/14); cross-mode
          navigation lives in the photo lane cards below the canvas. */}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    // flex:1 so the gallery fills the heroSlot's vertical space —
    // photo no longer locked to a 12/5 aspect that didn't quite
    // match the actual interior/exterior images.
    flex: 1,
    width: '100%',
    minHeight: 360,
    borderRadius: 12,
    overflow: 'hidden',
    // Pure black for an immersive 'theater' feel — letterbox bars
    // around the photo blend into the canvas instead of showing as
    // gray panels.
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  empty: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  emptyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.1,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonHover: {
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  // Floating close button on top of the image — used after the header
  // bar was removed so close-to-return-to-Street-View stays available.
  floatingClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    zIndex: 2,
    ...(Platform.OS === 'web'
      ? (({
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        } as unknown) as ViewStyle)
      : {}),
  },
  floatingCloseHover: {
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  mainImageWrap: {
    // flex:1 + no fixed aspectRatio — the image wrap fills whatever
    // vertical space is left after the gallery's header. resizeMode
    // 'contain' on the image then renders it FULL inside this box
    // without crop. Black bg matches the shell so any letterboxing
    // is invisible.
    flex: 1,
    width: '100%',
    minHeight: 320,
    backgroundColor: '#000000',
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  arrow: {
    position: 'absolute',
    top: '50%',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? (({
          marginTop: -20,
          transition: 'background-color 150ms ease-out, transform 150ms ease-out',
        } as unknown) as ViewStyle)
      : { transform: [{ translateY: -20 }] }),
  },
  arrowLeft: { left: 14 },
  arrowRight: { right: 14 },
  arrowHover: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderColor: 'rgba(251,191,36,0.45)',
  },
  counter: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  counterText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 18,
    backgroundColor: 'rgba(0,0,0,0.30)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  thumbStrip: {
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  thumb: {
    width: 60,
    height: 40,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#0A0A0F',
    ...(Platform.OS === 'web'
      ? (({ transition: 'border-color 150ms ease-out' } as unknown) as ViewStyle)
      : {}),
  },
  thumbHover: {
    borderColor: 'rgba(255,255,255,0.20)',
  },
  thumbActive: {
    borderColor: '#fbbf24',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  emptyBody: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    minHeight: 280,
    gap: 8,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.90)',
    letterSpacing: -0.1,
  },
  emptySubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 420,
  },
});
