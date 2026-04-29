/**
 * MemoryDetailsCard — labeled metadata rows for the memory detail page.
 *
 * Layout (per plan §8.2 + mockup):
 *   ┌──────────────────────────────────────────────┐
 *   │ Details                                       │
 *   │                                               │
 *   │ Participants    Tony Scott, Jane Doe (Acme)   │   ← 30/70 split
 *   │ Location        Zoom Call                     │
 *   │ Created by      Tony Scott                    │
 *   │ Tags            [Acme] [Project A] [Planning] │   ← chip pills
 *   └──────────────────────────────────────────────┘
 *
 * Rows are ~30/70 split — label sits left at fontWeight 500 / 13px tertiary,
 * value sits right at fontWeight 500 / 15px primary. The optical alignment
 * is designed for left-aligned scanning, NOT a centered key/value table.
 *
 * Tags row breaks pattern: instead of a comma-joined string, tags render as
 * pill chips because they're discrete navigable entities (V2 will route to
 * tag filter on click).
 */

import React from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Colors, BorderRadius } from '@/constants/tokens';

export interface MemoryDetailsCardProps {
  details: {
    participants: string[];
    location?: string;
    createdBy: string;
    tags: string[];
  };
  eyebrow?: string;
}

export function MemoryDetailsCard({
  details,
  eyebrow = 'Details',
}: MemoryDetailsCardProps) {
  const { participants, location, createdBy, tags } = details;

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>

      <View style={styles.rowList}>
        <DetailRow label="Participants" value={participants.join(', ') || '—'} />
        {location && <DetailRow label="Location" value={location} />}
        <DetailRow label="Created by" value={createdBy} />

        {/* Tags row — chip pills instead of plain text */}
        <View style={styles.row}>
          <Text style={styles.label}>Tags</Text>
          <View style={styles.tagsWrap}>
            {tags.length === 0 ? (
              <Text style={styles.value}>—</Text>
            ) : (
              tags.map((tag) => (
                <View key={tag} style={styles.tagPill}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Sub-component: DetailRow ────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={2}>
        {value}
      </Text>
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
  rowList: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.tertiary,
    width: 110,
    flexShrink: 0,
    paddingTop: 1,
    letterSpacing: 0.1,
  },
  value: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text.primary,
    flex: 1,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  tagsWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
});

export default MemoryDetailsCard;
