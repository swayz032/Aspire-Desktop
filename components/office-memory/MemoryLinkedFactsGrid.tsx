/**
 * MemoryLinkedFactsGrid — 2×2 grid of related-fact mini-tiles.
 *
 * Layout (per plan §8.2 + mockup):
 *   ┌──────────────────────────────────────────┐
 *   │ Linked Facts                              │
 *   │                                           │
 *   │ ┌─ Proposal v2 ──┐  ┌─ Project Update ──┐ │
 *   │ │ 🧩  …          │  │ 📄  …              │ │
 *   │ └────────────────┘  └────────────────────┘ │
 *   │ ┌─ Site Walk ────┐  ┌─ + Add Link ──────┐ │
 *   │ │ 👥  …          │  │ (dashed border)    │ │
 *   │ └────────────────┘  └────────────────────┘ │
 *   └──────────────────────────────────────────┘
 *
 * Tile layout (60 grid cells):
 *   - 2 cols, 2 rows on web
 *   - 1 col on native (cards stack)
 *   - "Add Link" tile uses dashed border to read as actionable empty slot
 *     (per §12.1 "Empty states with personality")
 *
 * Icon mapping per LinkedFactKind:
 *   proposal       → extension-puzzle-outline
 *   project_update → document-text-outline
 *   site_walk      → people-outline
 *   meeting        → calendar-outline
 *   invoice        → receipt-outline
 *   contract       → reader-outline
 *   document       → document-outline
 *   add_link       → add-outline
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import type { LinkedFact, LinkedFactKind } from './types';

export interface MemoryLinkedFactsGridProps {
  facts: LinkedFact[];
  onFactPress?: (fact: LinkedFact) => void;
  onAddLink?: () => void;
  eyebrow?: string;
}

const ICON_MAP: Record<LinkedFactKind, keyof typeof Ionicons.glyphMap> = {
  proposal: 'extension-puzzle-outline',
  project_update: 'document-text-outline',
  site_walk: 'people-outline',
  meeting: 'calendar-outline',
  invoice: 'receipt-outline',
  contract: 'reader-outline',
  document: 'document-outline',
  add_link: 'add-outline',
};

export function MemoryLinkedFactsGrid({
  facts,
  onFactPress,
  onAddLink,
  eyebrow = 'Linked Facts',
}: MemoryLinkedFactsGridProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>

      <View style={styles.grid}>
        {facts.map((fact) => {
          const isAddLink = fact.kind === 'add_link';
          return (
            <Pressable
              key={fact.id}
              onPress={() => {
                if (isAddLink) onAddLink?.();
                else onFactPress?.(fact);
              }}
              accessibilityRole="button"
              accessibilityLabel={isAddLink ? 'Add linked fact' : `Linked: ${fact.label}`}
              style={({ hovered, pressed }: any) => [
                styles.tile,
                isAddLink && styles.tileAddLink,
                hovered && (isAddLink ? styles.tileAddLinkHover : styles.tileHover),
                pressed && styles.tilePressed,
              ]}
            >
              <View style={[styles.iconWrap, isAddLink && styles.iconWrapAdd]}>
                <Ionicons
                  name={ICON_MAP[fact.kind] || 'document-outline'}
                  size={18}
                  color={isAddLink ? Colors.text.muted : Colors.accent.cyan}
                />
              </View>
              <View style={styles.tileText}>
                <Text
                  style={[
                    styles.tileLabel,
                    isAddLink && styles.tileLabelAdd,
                  ]}
                  numberOfLines={1}
                >
                  {fact.label}
                </Text>
                {fact.date && !isAddLink && (
                  <Text style={styles.tileSub}>{fact.date}</Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    // 2-col grid on web (50% minus half the gap); 100% width on native
    ...(Platform.OS === 'web'
      ? ({ width: 'calc(50% - 6px)' } as unknown as ViewStyle)
      : { width: '100%' as unknown as number }),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'background-color 160ms ease-out, border-color 160ms ease-out',
        } as unknown as ViewStyle)
      : {}),
  },
  tileHover: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(59,130,246,0.30)',
  },
  tilePressed: {
    transform: [{ scale: 0.98 }],
  },
  tileAddLink: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.10)',
    borderStyle: 'dashed',
  },
  tileAddLinkHover: {
    backgroundColor: 'rgba(59,130,246,0.05)',
    borderColor: Colors.memory.haloRing,
    borderStyle: 'dashed',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapAdd: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  tileText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  tileLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  tileLabelAdd: {
    color: Colors.text.tertiary,
    fontWeight: '500',
  },
  tileSub: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
  },
});

export default MemoryLinkedFactsGrid;
