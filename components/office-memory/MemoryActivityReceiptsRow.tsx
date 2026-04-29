/**
 * MemoryActivityReceiptsRow — horizontal scrollable row of file pills,
 * shown at the bottom of the memory detail page.
 *
 * Layout (per plan §8.2 + mockup):
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ Activity & Receipts                                           │
 *   │ ┌─ ▶ Call Recording ──┐ ┌─ 📄 Notes ──┐ ┌─ 📑 Layout ──┐ ...  │
 *   │ │ MP4 · 19 MB         │ │ DOCX · 34KB  │ │ PDF · 1.2MB   │     │
 *   │ └────────────────────┘ └──────────────┘ └─────────────┘     │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Each pill is a self-contained mini-card with:
 *   - Kind icon (audio→play-circle, doc→document-text, pdf→reader,
 *     zip→folder, image→image, video→videocam)
 *   - Filename (14/600 white)
 *   - Meta line (12/400 tertiary) — type + size, e.g. "MP4 · 19 MB"
 *
 * Width: pills size to content (min 200, max 280) so the row reads as a
 * varied gallery, NOT a uniform table. Scrolls horizontally on web/native.
 */

import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import type { ActivityFile, ActivityFileKind } from './types';

export interface MemoryActivityReceiptsRowProps {
  files: ActivityFile[];
  onFilePress?: (file: ActivityFile) => void;
  eyebrow?: string;
}

const ICON_MAP: Record<ActivityFileKind, keyof typeof Ionicons.glyphMap> = {
  audio: 'play-circle-outline',
  video: 'videocam-outline',
  pdf: 'reader-outline',
  doc: 'document-text-outline',
  zip: 'folder-outline',
  image: 'image-outline',
};

const ICON_TINT_MAP: Record<ActivityFileKind, string> = {
  audio: '#F472B6',     // pink — playable media
  video: '#F472B6',
  pdf: '#FB7185',       // rose — PDF
  doc: '#60A5FA',       // blue — document
  zip: '#FBBF24',       // amber — bundle
  image: '#34D399',     // green — image
};

export function MemoryActivityReceiptsRow({
  files,
  onFilePress,
  eyebrow = 'Activity & Receipts',
}: MemoryActivityReceiptsRowProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {files.length === 0 ? (
          <Text style={styles.empty}>No files attached.</Text>
        ) : (
          files.map((file) => {
            const tint = ICON_TINT_MAP[file.kind] || Colors.accent.cyan;
            return (
              <Pressable
                key={file.id}
                onPress={() => onFilePress?.(file)}
                accessibilityRole="button"
                accessibilityLabel={`${file.label} (${file.meta})`}
                style={({ hovered, pressed }: any) => [
                  styles.pill,
                  hovered && styles.pillHover,
                  pressed && styles.pillPressed,
                ]}
              >
                <View style={[styles.iconWrap, { backgroundColor: hexToRgba(tint, 0.12), borderColor: hexToRgba(tint, 0.24) }]}>
                  <Ionicons
                    name={ICON_MAP[file.kind] || 'document-outline'}
                    size={18}
                    color={tint}
                  />
                </View>
                <View style={styles.pillText}>
                  <Text style={styles.pillLabel} numberOfLines={1}>
                    {file.label}
                  </Text>
                  <Text style={styles.pillMeta} numberOfLines={1}>
                    {file.meta}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.memory.cardBg,
    borderRadius: BorderRadius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
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
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.tertiary,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
    paddingRight: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    minWidth: 200,
    maxWidth: 280,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'background-color 160ms ease-out, border-color 160ms ease-out, transform 160ms ease-out',
        } as unknown as ViewStyle)
      : {}),
  },
  pillHover: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(59,130,246,0.30)',
    transform: [{ translateY: -1 }],
  },
  pillPressed: {
    transform: [{ scale: 0.97 }],
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pillText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  pillLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  pillMeta: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
  },
  empty: {
    fontSize: 14,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
    paddingVertical: 12,
  },
});

export default MemoryActivityReceiptsRow;
