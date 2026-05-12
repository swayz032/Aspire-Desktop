/**
 * MaterialsEmptyState — pre-search hero with 4 Tim-suggested starter queries.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  suggestions: string[];
  onPick: (query: string) => void;
}

const WEB_TRANSITION: ViewStyle =
  Platform.OS === 'web'
    ? (({ transition: 'all 200ms ease' } as unknown) as ViewStyle)
    : {};

export function MaterialsEmptyState({ suggestions, onPick }: Props) {
  return (
    <View style={styles.wrap} testID="materials-empty-state">
      <View style={styles.iconWrap}>
        <Ionicons name="search-circle-outline" size={36} color="rgba(251,191,36,0.55)" />
      </View>
      <Text style={styles.title}>Search the warehouse</Text>
      <Text style={styles.subtitle}>
        Start with a material, a brand, or a SKU. Tim ranks results by your closest
        store, in-stock status, and traffic-aware drive time.
      </Text>

      <View style={styles.suggestionLabel}>
        <Ionicons name="sparkles-outline" size={11} color="rgba(255,255,255,0.55)" />
        <Text style={styles.suggestionLabelText}>TRY ONE OF THESE</Text>
      </View>

      <View style={styles.suggestionGrid}>
        {suggestions.map((s) => (
          <Pressable
            key={s}
            onPress={() => onPick(s)}
            style={({ hovered, pressed }: any) => [
              styles.suggestionChip,
              hovered && styles.suggestionChipHovered,
              pressed && styles.suggestionChipPressed,
              WEB_TRANSITION,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Search for ${s}`}
            testID={`materials-suggestion-${s.replace(/\s+/g, '-')}`}
          >
            <Ionicons name="search" size={11} color="rgba(251,191,36,0.85)" />
            <Text style={styles.suggestionText}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.hintRow}>
        <Ionicons name="bulb-outline" size={11} color="rgba(255,255,255,0.40)" />
        <Text style={styles.hintText}>
          Niche material like &ldquo;4000 PSI concrete by yard&rdquo;? Specialty suppliers
          surface inline.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: 32,
    // Tighter top padding so the hero sits close under the search bar
    // (was 56 — produced a large dark gap with no content between the
    // search input and the hero icon).
    paddingTop: 24,
    paddingBottom: 32,
    gap: 10,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.24)',
    marginBottom: 8,
    ...(Platform.OS === 'web'
      ? (({
          boxShadow:
            '0 0 0 4px rgba(251,191,36,0.04), 0 8px 28px rgba(251,191,36,0.08)',
        } as unknown) as ViewStyle)
      : {}),
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.96)',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 480,
  },
  suggestionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
  },
  suggestionLabelText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.4,
  },
  suggestionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    maxWidth: 540,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  suggestionChipHovered: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderColor: 'rgba(251,191,36,0.32)',
  },
  suggestionChipPressed: {
    backgroundColor: 'rgba(251,191,36,0.14)',
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: -0.1,
    textTransform: 'capitalize',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 18,
  },
  hintText: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.1,
    fontStyle: 'italic',
    flexShrink: 1,
    textAlign: 'center',
  },
});
