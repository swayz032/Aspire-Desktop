/**
 * MaterialsBlueprintContextCard — Wave 14 Tim Rail Context tab card.
 *
 * Renders ONLY when:
 *   - The active route is /materials, AND
 *   - The Materials mode toggle = 'blueprint', AND
 *   - A blueprint project is active.
 *
 * Payload (locked):
 *   1. Discipline coverage bar — % per trade with progress fill
 *   2. Total $  + Tariff exposure $
 *   3. Top 3 suppliers consolidating the bundle
 *   4. Savings vs catalog $
 *   5. Sheet provenance map — "N items from M sheets"
 *
 * Tool / Supplier mode payloads are owned by sibling cards and are NEVER
 * modified. This card is purely additive.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useMaterialsSearchContextOptional } from '../materials/MaterialsSearchContext';
import { useBlueprintUploadSnapshot } from '@/lib/blueprintUploadStore';
import { useTakeoffMaterials } from '@/hooks/useTakeoffMaterials';
import { getDisciplineStyle } from '../plans-photos/disciplines';
import type { TakeoffMaterial } from '@/lib/api/blueprintsApi';

interface Tile {
  discipline: string;
  count: number;
  pct: number;
}

interface SupplierAgg {
  name: string;
  count: number;
  total: number;
}

function inferDiscipline(m: TakeoffMaterial): string {
  const tile = m as TakeoffMaterial & { discipline?: string | null };
  if (tile.discipline) return tile.discipline.toLowerCase();
  const lo = m.line_item.toLowerCase();
  if (/(romex|wire|breaker|panel|outlet|conduit|fixture light)/.test(lo)) return 'electrical';
  if (/(pipe|fitting|valve|drain|water|toilet|sink|copper)/.test(lo)) return 'plumbing';
  if (/(duct|hvac|rtu|ahu|register|damper|coil)/.test(lo)) return 'mechanical';
  if (/(rebar|column|beam|concrete|cmu|footing)/.test(lo)) return 'structural';
  if (/(drywall|paint|tile|trim|door|window|flooring|cabinet)/.test(lo)) return 'architectural';
  if (/(asphalt|grading|stormwater|curb|catch basin|manhole)/.test(lo)) return 'civil';
  return 'architectural';
}

function formatUSD(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export function MaterialsBlueprintContextCard(): React.ReactElement | null {
  const pathname = usePathname() ?? '';
  const onMaterialsTab =
    pathname.endsWith('/materials') || pathname.endsWith('/materials/');
  const ctx = useMaterialsSearchContextOptional();
  const snap = useBlueprintUploadSnapshot();
  const projectId = snap.projectId ?? snap.response?.project_id ?? null;
  const { materials } = useTakeoffMaterials(projectId);

  const aggregates = useMemo(() => {
    if (materials.length === 0) {
      return {
        tiles: [] as Tile[],
        totalUsd: 0,
        tariffUsd: 0,
        suppliers: [] as SupplierAgg[],
        sheetCount: 0,
        catalogSavings: 0,
      };
    }
    const byDisc: Record<string, number> = {};
    const bySupplier: Record<string, SupplierAgg> = {};
    const sheets = new Set<string>();
    let totalUsd = 0;
    let tariffUsd = 0;
    for (const m of materials) {
      const disc = inferDiscipline(m);
      byDisc[disc] = (byDisc[disc] ?? 0) + 1;
      const tile = m as TakeoffMaterial & {
        unit_price?: number | null;
        sheet_code?: string | null;
      };
      const lineTotal = (tile.unit_price ?? 0) * (m.quantity || 0);
      totalUsd += lineTotal;
      if (m.tariff_flag !== 'none') tariffUsd += lineTotal * 0.14; // best-effort
      if (m.supplier_name) {
        const cur = bySupplier[m.supplier_name] ?? {
          name: m.supplier_name,
          count: 0,
          total: 0,
        };
        cur.count += 1;
        cur.total += lineTotal;
        bySupplier[m.supplier_name] = cur;
      }
      if (tile.sheet_code) sheets.add(tile.sheet_code);
    }
    const totalCount = materials.length;
    const tiles: Tile[] = Object.entries(byDisc)
      .map(([discipline, count]) => ({
        discipline,
        count,
        pct: Math.round((count / totalCount) * 100),
      }))
      .sort((a, b) => b.count - a.count);
    const suppliers = Object.values(bySupplier)
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
    // Savings stub: 4% of total when alternates exist (Wave 14 placeholder).
    const catalogSavings = totalUsd * 0.04;
    return {
      tiles,
      totalUsd,
      tariffUsd,
      suppliers,
      sheetCount: sheets.size,
      catalogSavings,
    };
  }, [materials]);

  if (!ctx) return null;
  if (!onMaterialsTab) return null;
  if (ctx.mode !== 'blueprint') return null;
  if (!projectId) return null;

  if (materials.length === 0) {
    return (
      <View style={styles.section} testID="tim-context-materials-blueprint">
        <View style={styles.header}>
          <Ionicons name="hammer-outline" size={13} color="rgba(251,191,36,0.85)" />
          <Text style={styles.title}>BLUEPRINT BUNDLE</Text>
        </View>
        <View style={styles.emptyCard}>
          <Ionicons name="leaf-outline" size={13} color="rgba(255,255,255,0.40)" />
          <Text style={styles.emptyText}>
            Drew is curating picks. The coverage bar populates as materials land.
          </Text>
        </View>
      </View>
    );
  }

  const { tiles, totalUsd, tariffUsd, suppliers, sheetCount, catalogSavings } = aggregates;

  return (
    <View style={styles.section} testID="tim-context-materials-blueprint">
      <View style={styles.header}>
        <Ionicons name="hammer-outline" size={13} color="rgba(251,191,36,0.85)" />
        <Text style={styles.title}>BLUEPRINT BUNDLE</Text>
      </View>

      {/* Totals row */}
      <View style={styles.card}>
        <View style={styles.totalsRow}>
          <View style={styles.totalCol}>
            <Text style={styles.totalValue}>{formatUSD(totalUsd)}</Text>
            <Text style={styles.totalLabel}>TOTAL</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalCol}>
            <Text style={[styles.totalValue, styles.totalValueWarn]}>
              {formatUSD(tariffUsd)}
            </Text>
            <Text style={styles.totalLabel}>TARIFF EXPOSURE</Text>
          </View>
        </View>

        {/* Coverage bar */}
        <View style={styles.coverageBlock}>
          <Text style={styles.subLabel}>DISCIPLINE COVERAGE</Text>
          <View style={styles.coverageBar}>
            {tiles.map((t) => {
              const disc = getDisciplineStyle(t.discipline);
              return (
                <View
                  key={t.discipline}
                  style={[
                    styles.coverageSeg,
                    {
                      flex: t.count,
                      backgroundColor: disc.fg,
                    },
                  ]}
                  testID={`tim-context-mb-cov-${t.discipline}`}
                />
              );
            })}
          </View>
          <View style={styles.coverageLegend}>
            {tiles.map((t) => {
              const disc = getDisciplineStyle(t.discipline);
              return (
                <View key={t.discipline} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: disc.fg }]} />
                  <Text style={styles.legendText}>
                    {disc.label} <Text style={styles.legendPct}>{t.pct}%</Text>
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Suppliers */}
        {suppliers.length > 0 ? (
          <View style={styles.suppliersBlock}>
            <Text style={styles.subLabel}>TOP SUPPLIERS</Text>
            <View style={styles.suppliersList}>
              {suppliers.map((s) => (
                <View
                  key={s.name}
                  style={styles.supplierRow}
                  testID={`tim-context-mb-supplier-${s.name}`}
                >
                  <View style={styles.supplierLogo}>
                    <Ionicons
                      name="storefront-outline"
                      size={11}
                      color="rgba(255,255,255,0.78)"
                    />
                  </View>
                  <Text style={styles.supplierName} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text style={styles.supplierTotal}>{formatUSD(s.total)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Savings + provenance footer */}
        <View style={styles.footerRow}>
          <View style={styles.footerCol}>
            <Text style={styles.footerLabel}>SAVINGS VS CATALOG</Text>
            <Text style={[styles.footerValue, styles.savingsValue]}>
              {formatUSD(catalogSavings)}
            </Text>
          </View>
          <View style={styles.footerCol}>
            <Text style={styles.footerLabel}>PROVENANCE</Text>
            <Text style={styles.footerValue}>
              {materials.length} items · {sheetCount} sheet{sheetCount === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  title: {
    fontSize: 9.5,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.4,
  },
  card: {
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 0 rgba(251,191,36,0.06) inset, 0 4px 14px rgba(0,0,0,0.20)',
        } as any)
      : {}),
  },

  // Totals
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  totalCol: {
    flex: 1,
    gap: 3,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fbbf24',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.6,
    lineHeight: 24,
  },
  totalValueWarn: {
    color: '#fca5a5',
  },
  totalLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // Subsection
  subLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.4,
    marginBottom: 7,
  },

  // Coverage
  coverageBlock: {},
  coverageBar: {
    flexDirection: 'row',
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  coverageSeg: {
    height: '100%',
  },
  coverageLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: -0.05,
  },
  legendPct: {
    color: 'rgba(255,255,255,0.45)',
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },

  // Suppliers
  suppliersBlock: {},
  suppliersList: { gap: 6 },
  supplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  supplierLogo: {
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supplierName: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.05,
  },
  supplierTotal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fbbf24',
    fontVariant: ['tabular-nums'],
  },

  // Footer
  footerRow: {
    flexDirection: 'row',
    gap: 14,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    marginTop: 2,
  },
  footerCol: {
    flex: 1,
    gap: 3,
    paddingTop: 8,
  },
  footerLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
  },
  footerValue: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.05,
    fontVariant: ['tabular-nums'],
  },
  savingsValue: {
    color: '#86efac',
  },

  // Empty
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderStyle: 'dashed',
  },
  emptyText: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 15,
  },
});
