/**
 * GenericCard — Fallback card for unrecognized artifact types.
 * Renders a minimal card with the record's name/title and type label.
 * Law #3 (Fail Closed): Never render nothing — always show something.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/tokens';
import type { CardProps } from './CardRegistry';

export function GenericCard({ record, artifactType }: CardProps) {
  const name = record.name || record.product_name || record.title || 'Unknown';
  const address = record.normalized_address || record.address || '';
  const summary = record.summary || record.description || '';

  return (
    <View style={styles.card} accessibilityRole="summary" accessibilityLabel={`${name} research card`}>
      <View style={styles.header}>
        <Ionicons name="document-text-outline" size={32} color={Colors.text.muted} />
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>{artifactType || 'Research'}</Text>
        </View>
      </View>

      <Text style={styles.name} numberOfLines={2} accessibilityRole="header">{String(name)}</Text>

      {address ? (
        <Text style={styles.detail} numberOfLines={2}>{String(address)}</Text>
      ) : null}

      {summary ? (
        <Text style={styles.summary} numberOfLines={4}>{String(summary).slice(0, 300)}</Text>
      ) : null}

      <View style={styles.footer}>
        <Ionicons name="information-circle-outline" size={14} color={Colors.text.muted} />
        <Text style={styles.footerText}>No specialized card for this result type</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    padding: Spacing.xl,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  typeBadge: {
    backgroundColor: Colors.accent.cyanLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  typeText: {
    color: Colors.accent.cyan,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    ...Typography.title,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  detail: {
    color: Colors.text.secondary,
    fontSize: 14,
    marginBottom: Spacing.sm,
  },
  summary: {
    color: Colors.text.tertiary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  footerText: {
    color: Colors.text.muted,
    fontSize: 12,
  },
});
