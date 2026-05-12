/**
 * SupplierMatchesRail — contextual inline rail that surfaces specialty
 * suppliers when Home Depot doesn't carry an item. Pass B: mock data.
 * Pass E will wire to ATTOM POI + Google Places.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SpecialtySupplier } from '@/hooks/useMaterialsSearch';

interface Props {
  suppliers: SpecialtySupplier[];
  onDraftRfq?: (supplier: SpecialtySupplier) => void;
}

const WEB_TRANSITION: ViewStyle =
  Platform.OS === 'web'
    ? (({ transition: 'all 200ms ease' } as unknown) as ViewStyle)
    : {};

export function SupplierMatchesRail({ suppliers, onDraftRfq }: Props) {
  if (suppliers.length === 0) return null;

  return (
    <View style={styles.wrap} testID="materials-supplier-matches-rail">
      <View style={styles.headerRow}>
        <Ionicons name="business-outline" size={11} color="#60a5fa" />
        <Text style={styles.headerLabel}>Specialty Suppliers</Text>
        <Text style={styles.headerMeta}>· {suppliers.length} nearby</Text>
      </View>

      <View style={styles.grid}>
        {suppliers.map((s) => (
          <View style={styles.card} key={s.id} testID={`supplier-card-${s.id}`}>
            <View style={styles.cardHead}>
              <Text style={styles.name} numberOfLines={1}>
                {s.name}
              </Text>
              <View style={styles.distChip}>
                <Text style={styles.distText}>{s.distanceMiles.toFixed(1)} mi</Text>
              </View>
            </View>

            <Text style={styles.category}>{s.category.toUpperCase()}</Text>

            <View style={styles.contactRows}>
              <View style={styles.contactRow}>
                <Ionicons name="call-outline" size={11} color="rgba(255,255,255,0.55)" />
                <Text style={styles.contactText}>{s.phone}</Text>
              </View>
              {s.email && (
                <View style={styles.contactRow}>
                  <Ionicons name="mail-outline" size={11} color="rgba(255,255,255,0.55)" />
                  <Text style={styles.contactText} numberOfLines={1}>{s.email}</Text>
                </View>
              )}
              {s.website && (
                <View style={styles.contactRow}>
                  <Ionicons name="globe-outline" size={11} color="rgba(255,255,255,0.55)" />
                  <Text style={styles.contactText} numberOfLines={1}>{s.website}</Text>
                </View>
              )}
              {s.hours && (
                <View style={styles.contactRow}>
                  <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.55)" />
                  <Text style={styles.contactText} numberOfLines={1}>{s.hours}</Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={() => onDraftRfq?.(s)}
              style={({ hovered, pressed }: any) => [
                styles.rfqBtn,
                hovered && styles.rfqBtnHovered,
                pressed && styles.rfqBtnPressed,
                WEB_TRANSITION,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Draft RFQ for ${s.name}`}
            >
              <Ionicons name="document-text-outline" size={12} color="#60a5fa" />
              <Text style={styles.rfqBtnText}>DRAFT RFQ</Text>
            </Pressable>
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
    backgroundColor: 'rgba(96,165,250,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.20)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(96,165,250,0.85)',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  headerMeta: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.40)',
    letterSpacing: 0.2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    flexBasis: '32%',
    flexGrow: 1,
    minWidth: 220,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 12,
    gap: 7,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.96)',
    letterSpacing: -0.1,
  },
  distChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.28)',
  },
  distText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  category: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.0,
  },
  contactRows: {
    gap: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactText: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: -0.05,
  },
  rfqBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: 'rgba(96,165,250,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.30)',
    marginTop: 2,
  },
  rfqBtnHovered: {
    backgroundColor: 'rgba(96,165,250,0.18)',
  },
  rfqBtnPressed: {
    backgroundColor: 'rgba(96,165,250,0.26)',
  },
  rfqBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#60a5fa',
    letterSpacing: 0.7,
  },
});
