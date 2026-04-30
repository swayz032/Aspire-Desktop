/**
 * PDFViewer — collapsible inline PDF preview.
 *
 * Web   → uses an `<iframe>` over the PDF URL (browsers ship a PDF viewer
 *         out of the box). `react-pdf` is intentionally NOT a runtime
 *         dependency to avoid the heavy worker bundle — iframe gives us
 *         a polished, scrollable preview with zero install cost.
 * Native → preview link card that opens externally (expo-print preview path
 *         is a Pass 17 wiring task; this surface stays meaningful in V1).
 *
 * Default state = collapsed: header + first-page thumbnail + "Expand" CTA.
 * Expanded     = full iframe / preview at 720px tall, with "Collapse" CTA.
 *
 * Frame uses the standard memory card chrome — never flat. Eyebrow + filename
 * sit top-left; the preview area below them. The optional file metadata pill
 * row (size · uploaded by · version) reads as "magazine credits."
 */

import React, { useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';

export interface PDFViewerProps {
  src: string;
  /** Filename or human title shown above the preview. */
  filename?: string;
  /** Display label like "PDF · 1.2 MB". */
  meta?: string;
  /** Default open state (default false = collapsed). */
  defaultExpanded?: boolean;
  /** Eyebrow override (default: "Document"). */
  eyebrow?: string;
}

export function PDFViewer({
  src,
  filename,
  meta,
  defaultExpanded = false,
  eyebrow = 'Document',
}: PDFViewerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          {filename && (
            <Text style={styles.filename} numberOfLines={1}>
              {filename}
            </Text>
          )}
          {meta && <Text style={styles.meta}>{meta}</Text>}
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              if (Platform.OS === 'web') {
                if (typeof window !== 'undefined') window.open(src, '_blank');
              } else {
                void Linking.openURL(src);
              }
            }}
            accessibilityRole="link"
            accessibilityLabel={`Open ${filename ?? 'document'} in new tab`}
            style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [
              styles.iconButton,
              hovered && styles.iconButtonHover,
              pressed && styles.iconButtonPressed,
            ]}
            hitSlop={6}
          >
            <Ionicons name="open-outline" size={16} color={Colors.text.secondary as string} />
          </Pressable>
          <Pressable
            onPress={() => setExpanded((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Collapse preview' : 'Expand preview'}
            accessibilityState={{ expanded }}
            style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [
              styles.expandButton,
              hovered && styles.expandButtonHover,
              pressed && styles.expandButtonPressed,
            ]}
          >
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={Colors.text.secondary as string}
            />
            <Text style={styles.expandText}>{expanded ? 'Collapse' : 'Expand'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Preview area */}
      {expanded ? (
        Platform.OS === 'web' ? (
          <View style={styles.previewFrame}>
            {React.createElement('iframe' as unknown as 'div', {
              src,
              title: filename ?? 'PDF preview',
              style: {
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: 12,
                background: '#1a1a1d',
              },
            })}
          </View>
        ) : (
          <View style={styles.previewFallback}>
            <Ionicons name="reader-outline" size={36} color={Colors.text.tertiary as string} />
            <Text style={styles.previewFallbackTitle}>Inline preview unavailable on mobile</Text>
            <Pressable
              onPress={() => void Linking.openURL(src)}
              accessibilityRole="link"
              accessibilityLabel="Open PDF"
              style={({ pressed }) => [styles.openCta, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="open-outline" size={16} color="#FFFFFF" />
              <Text style={styles.openCtaText}>Open in browser</Text>
            </Pressable>
          </View>
        )
      ) : (
        <Pressable
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          accessibilityLabel="Expand preview"
          style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [
            styles.collapsedPreview,
            hovered && styles.collapsedPreviewHover,
            pressed && styles.collapsedPreviewPressed,
          ]}
        >
          <View style={styles.collapsedIconWrap}>
            <Ionicons name="document-text-outline" size={28} color={'#FB7185'} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.collapsedTitle}>Tap to preview first page</Text>
            <Text style={styles.collapsedSub}>Inline PDF viewer · click expand to read full document</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.text.tertiary as string} />
        </Pressable>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.memory.cardBg as string,
    borderRadius: BorderRadius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 16,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.03)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.30,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.tertiary as string,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  filename: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text.primary as string,
    letterSpacing: -0.2,
    marginTop: 6,
  },
  meta: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.muted as string,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : {}),
  },
  iconButtonHover: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  iconButtonPressed: {
    transform: [{ scale: 0.94 }],
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : {}),
  },
  expandButtonHover: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  expandButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  expandText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary as string,
    letterSpacing: 0.2,
  },
  previewFrame: {
    width: '100%',
    height: 720,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#1a1a1d',
  },
  previewFallback: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  previewFallbackTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary as string,
  },
  openCta: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent.cyan as string,
  },
  openCtaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  collapsedPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'background-color 160ms ease-out, border-color 160ms ease-out',
        } as unknown as ViewStyle)
      : {}),
  },
  collapsedPreviewHover: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(59,130,246,0.30)',
  },
  collapsedPreviewPressed: {
    transform: [{ scale: 0.99 }],
  },
  collapsedIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251,113,133,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(251,113,133,0.24)',
  },
  collapsedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary as string,
  },
  collapsedSub: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary as string,
  },
});

export default PDFViewer;
