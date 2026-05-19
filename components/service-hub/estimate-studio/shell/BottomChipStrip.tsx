/**
 * BottomChipStrip — Wave 6A shared shell.
 *
 * Horizontal scroll strip of 4–6 "card chips". Each chip is a flat-premium
 * card geometry (icon + title + optional 1-line stat + optional status
 * badge). Clicking a chip swaps the active card in <CanvasCardSwitcher />.
 *
 * Visual reference: Service Studio bottom-row card chips ("Local Leads
 * Coverage", "Routing & Follow-up", etc.) — premium dark fills with
 * yellow-edge accent on the selected chip.
 *
 * Used by:
 *   - Wave 6A: PlansPhotosTab (Upload / Sheets / Disciplines / Revisions).
 *   - Wave 7+: Scope, Takeoff tabs reuse the same strip.
 */
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface BottomChip<K extends string> {
  key: K;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  /** One-line stat or count, e.g. "14 sheets" or "Ingesting…". */
  stat?: string;
  /** Tiny badge text, e.g. "(14)" or "REV 2". */
  badge?: string;
  disabled?: boolean;
}

interface Props<K extends string> {
  chips: BottomChip<K>[];
  activeKey: K;
  onChange: (key: K) => void;
  testID?: string;
}

export function BottomChipStrip<K extends string>({
  chips,
  activeKey,
  onChange,
  testID,
}: Props<K>): React.ReactElement {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.strip}
      contentContainerStyle={styles.stripContent}
      testID={testID ?? 'bottom-chip-strip'}
    >
      {chips.map((chip) => {
        const isActive = chip.key === activeKey;
        const isDisabled = !!chip.disabled;
        return (
          <Pressable
            key={chip.key}
            disabled={isDisabled}
            onPress={() => onChange(chip.key)}
            accessibilityRole="button"
            accessibilityLabel={`${chip.label}${chip.stat ? ` — ${chip.stat}` : ''}`}
            accessibilityState={{ selected: isActive, disabled: isDisabled }}
            testID={`bottom-chip-${chip.key}`}
            style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
              styles.chip,
              isActive && styles.chipActive,
              isDisabled && styles.chipDisabled,
              hovered && !isActive && !isDisabled && styles.chipHover,
              pressed && !isDisabled && styles.chipPressed,
            ]}
          >
            <View style={styles.chipIconWrap}>
              <Ionicons
                name={chip.icon}
                size={16}
                color={
                  isDisabled
                    ? 'rgba(255,255,255,0.30)'
                    : isActive
                      ? '#fbbf24'
                      : 'rgba(255,255,255,0.78)'
                }
              />
            </View>
            <View style={styles.chipBody}>
              <View style={styles.chipTitleRow}>
                <Text
                  style={[
                    styles.chipLabel,
                    isActive && styles.chipLabelActive,
                    isDisabled && styles.chipLabelDisabled,
                  ]}
                  numberOfLines={1}
                >
                  {chip.label}
                </Text>
                {chip.badge ? (
                  <Text style={[styles.chipBadge, isActive && styles.chipBadgeActive]}>
                    {chip.badge}
                  </Text>
                ) : null}
              </View>
              {chip.stat ? (
                <Text
                  style={[styles.chipStat, isActive && styles.chipStatActive]}
                  numberOfLines={1}
                >
                  {chip.stat}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexGrow: 0,
  },
  stripContent: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 150,
    maxWidth: 220,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...(Platform.OS === 'web'
      ? ({ transition: 'background-color 150ms ease, border-color 150ms ease' } as any)
      : {}),
  },
  chipActive: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderColor: 'rgba(251,191,36,0.55)',
  },
  chipHover: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipIconWrap: {
    width: 22,
    alignItems: 'center',
  },
  chipBody: {
    flex: 1,
    gap: 2,
  },
  chipTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: -0.1,
  },
  chipLabelActive: {
    color: '#fbbf24',
  },
  chipLabelDisabled: {
    color: 'rgba(255,255,255,0.48)',
  },
  chipBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    fontVariant: ['tabular-nums'],
  },
  chipBadgeActive: {
    color: 'rgba(251,191,36,0.85)',
  },
  chipStat: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.05,
  },
  chipStatActive: {
    color: 'rgba(251,191,36,0.72)',
  },
});
