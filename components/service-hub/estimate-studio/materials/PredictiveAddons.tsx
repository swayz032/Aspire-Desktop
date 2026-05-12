/**
 * PredictiveAddons — surfaces complementary items after a bundle has at least
 * one product. Pass B: derived from product category. Pass D: real predictions.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Image, Platform, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Product } from '@/hooks/useMaterialsSearch';

interface Props {
  addons: Product[];
  onAdd: (p: Product) => void;
}

const WEB_TRANSITION: ViewStyle =
  Platform.OS === 'web'
    ? (({ transition: 'all 200ms ease' } as unknown) as ViewStyle)
    : {};

function formatPrice(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PredictiveAddons({ addons, onAdd }: Props) {
  if (addons.length === 0) return null;

  return (
    <View style={styles.wrap} testID="materials-predictive-addons">
      <View style={styles.header}>
        <Ionicons name="sparkles-outline" size={11} color="#fbbf24" />
        <Text style={styles.label}>Tim Suggests</Text>
        <Text style={styles.meta}>· Often bought together</Text>
      </View>

      <View style={styles.row}>
        {addons.map((p) => (
          <View key={p.id} style={styles.miniCard} testID={`materials-addon-${p.id}`}>
            <Image
              source={{ uri: p.imageUrl }}
              style={styles.thumb}
              resizeMode="cover"
              accessibilityLabel={p.title}
            />
            <View style={styles.miniInfo}>
              <Text style={styles.miniTitle} numberOfLines={2}>
                {p.title}
              </Text>
              <View style={styles.miniPriceRow}>
                <Text style={styles.miniPrice}>{formatPrice(p.price)}</Text>
                <Pressable
                  onPress={() => onAdd(p)}
                  style={({ hovered, pressed }: any) => [
                    styles.miniAddBtn,
                    hovered && styles.miniAddBtnHovered,
                    pressed && styles.miniAddBtnPressed,
                    WEB_TRANSITION,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${p.title} to bundle`}
                >
                  <Ionicons name="add" size={11} color="#fbbf24" />
                  <Text style={styles.miniAddBtnText}>ADD</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.18)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(251,191,36,0.92)',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  meta: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.40)',
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  miniCard: {
    flexBasis: '32%',
    flexGrow: 1,
    minWidth: 220,
    flexDirection: 'row',
    gap: 10,
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  thumb: {
    width: 54,
    height: 54,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  miniInfo: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  miniTitle: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: -0.1,
    lineHeight: 14,
  },
  miniPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 2,
  },
  miniPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fbbf24',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  miniAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.30)',
  },
  miniAddBtnHovered: {
    backgroundColor: 'rgba(251,191,36,0.18)',
  },
  miniAddBtnPressed: {
    backgroundColor: 'rgba(251,191,36,0.26)',
  },
  miniAddBtnText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: 0.6,
  },
});
