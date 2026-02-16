import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Text, Platform, ImageBackground } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/tokens';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Wallet, FileText, EnvelopeSimple, Phone } from 'phosphor-react-native';
import { formatRelativeTime, formatSuiteContext } from '@/lib/formatters';
import { useRealtimeReceipts } from '@/hooks/useRealtimeReceipts';
import { getReceipts as fetchReceipts } from '@/lib/api';
import { Receipt, ReceiptType, ReceiptStatus } from '@/types/receipts';
import { useDesktop } from '@/lib/useDesktop';
import { DesktopPageWrapper } from '@/components/desktop/DesktopPageWrapper';
import { PageHeader } from '@/components/PageHeader';

/** Map a Supabase receipt row (snake_case) to the UI Receipt type. */
function mapSupabaseReceipt(row: any): Receipt {
  return {
    id: row.id ?? row.receipt_id ?? '',
    type: mapReceiptType(row.action_type ?? row.type ?? 'Communication'),
    status: mapReceiptStatus(row.outcome ?? row.status ?? 'Pending'),
    title: row.title ?? row.action_type ?? 'Receipt',
    timestamp: row.created_at ?? row.timestamp ?? new Date().toISOString(),
    actor: row.actor ?? 'System',
    suiteId: row.suite_id ?? '',
    officeId: row.office_id ?? '',
    intent: row.intent ?? row.redacted_inputs ?? '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

function mapReceiptType(raw: string): ReceiptType {
  const normalized = raw.toLowerCase();
  if (normalized.includes('payment') || normalized.includes('invoice')) return 'Payment';
  if (normalized.includes('contract') || normalized.includes('sign')) return 'Contract';
  if (normalized.includes('call') || normalized.includes('phone')) return 'Call';
  return 'Communication';
}

function mapReceiptStatus(raw: string): ReceiptStatus {
  const normalized = raw.toLowerCase();
  if (normalized === 'success' || normalized === 'completed') return 'Success';
  if (normalized === 'denied' || normalized === 'blocked') return 'Blocked';
  if (normalized === 'failed' || normalized === 'error') return 'Failed';
  return 'Pending';
}

const isWeb = Platform.OS === 'web';

const receiptsHero = require('@/assets/images/receipts-hero.jpg');

type FilterType = 'All' | ReceiptType;
type StatusFilter = ReceiptStatus | null;

const TAB_CONFIG: { key: FilterType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'All', label: 'All', icon: 'grid' },
  { key: 'Payment', label: 'Payments', icon: 'wallet' },
  { key: 'Contract', label: 'Contracts', icon: 'document-text' },
  { key: 'Communication', label: 'Communications', icon: 'mail' },
  { key: 'Call', label: 'Calls', icon: 'call' },
];

const STATUS_FILTERS: { label: ReceiptStatus; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { label: 'Success', icon: 'checkmark-circle', color: '#4ADE80' },
  { label: 'Blocked', icon: 'ban', color: '#F87171' },
  { label: 'Failed', icon: 'close-circle', color: '#F87171' },
  { label: 'Pending', icon: 'time', color: '#FBBF24' },
];

const STATUS_COLORS: Record<ReceiptStatus, { bg: string; text: string }> = {
  Success: { bg: 'rgba(34, 197, 94, 0.2)', text: '#4ADE80' },
  Pending: { bg: 'rgba(251, 191, 36, 0.2)', text: '#FBBF24' },
  Blocked: { bg: 'rgba(239, 68, 68, 0.2)', text: '#F87171' },
  Failed: { bg: 'rgba(239, 68, 68, 0.2)', text: '#F87171' },
};

const TYPE_COLORS: Record<ReceiptType, { icon: string; bg: string; text: string; border: string }> = {
  Payment: { icon: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: '#F59E0B' },
  Contract: { icon: '#A78BFA', bg: 'rgba(167, 139, 250, 0.15)', text: '#A78BFA', border: '#A78BFA' },
  Communication: { icon: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', border: '#3B82F6' },
  Call: { icon: '#34C759', bg: 'rgba(52, 199, 89, 0.15)', text: '#34C759', border: '#34C759' },
};

const getTypeIcon = (type: ReceiptType, color: string, size = 20) => {
  const iconProps = { size, color, weight: 'fill' as const };
  switch (type) {
    case 'Payment': return <Wallet {...iconProps} />;
    case 'Contract': return <FileText {...iconProps} />;
    case 'Communication': return <EnvelopeSimple {...iconProps} />;
    case 'Call': return <Phone {...iconProps} />;
  }
};

function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonRow}>
        <View style={styles.skeletonCircle} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonSubtitle} />
        </View>
      </View>
    </View>
  );
}

function ReceiptCard({ receipt, selected, onPress }: { receipt: Receipt; selected: boolean; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const statusColor = STATUS_COLORS[receipt.status];
  const typeColor = TYPE_COLORS[receipt.type];

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderLeftColor: typeColor.border, borderLeftWidth: 3 },
        selected && styles.cardSelected,
        hovered && !selected && styles.cardHover,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      {...(isWeb ? {
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
      } as any : {})}
    >
      <View style={styles.cardRow}>
        <View style={[styles.iconCircle, { backgroundColor: typeColor.bg }]}>
          {getTypeIcon(receipt.type, typeColor.icon)}
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{receipt.title}</Text>
          </View>
          <Text style={styles.cardSubtitle}>{formatSuiteContext()} · {receipt.actor} · {receipt.type}</Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.timeText}>{formatRelativeTime(receipt.timestamp)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor.text }]}>{receipt.status}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.previewText} numberOfLines={2}>{receipt.intent}</Text>
      <View style={styles.tagsRow}>
        <View style={[styles.typeTag, { backgroundColor: typeColor.bg }]}>
          <Text style={[styles.typeTagText, { color: typeColor.text }]}>{receipt.type}</Text>
        </View>
        {receipt.tags.slice(0, 2).map((tag) => (
          <View key={tag} style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

function DetailActionButton({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <TouchableOpacity
      style={[styles.detailActionBtn, hovered && styles.detailActionBtnHover]}
      activeOpacity={0.7}
      {...(isWeb ? {
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
      } as any : {})}
    >
      <Ionicons name={icon} size={18} color={hovered ? Colors.accent.cyan : Colors.text.secondary} />
      <Text style={[styles.detailActionText, hovered && { color: Colors.accent.cyan }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ReceiptDetailView({ receipt, onBack }: { receipt: Receipt; onBack: () => void }) {
  const statusColor = STATUS_COLORS[receipt.status];
  const typeColor = TYPE_COLORS[receipt.type];

  const statusIcon: Record<ReceiptStatus, keyof typeof Ionicons.glyphMap> = {
    Success: 'checkmark-circle',
    Pending: 'time',
    Failed: 'close-circle',
    Blocked: 'ban',
  };

  return (
    <View style={styles.detailFullPage}>
      <View style={styles.detailToolbar}>
        <TouchableOpacity style={styles.detailBackBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={Colors.accent.cyan} />
          <Text style={styles.detailBackText}>Back to Receipts</Text>
        </TouchableOpacity>
        <View style={[styles.detailToolbarBadge, { backgroundColor: typeColor.bg, borderColor: typeColor.border }]}>
          {getTypeIcon(receipt.type, typeColor.icon, 14)}
          <Text style={[styles.detailToolbarBadgeText, { color: typeColor.text }]}>{receipt.type}</Text>
        </View>
      </View>

      <LinearGradient
        colors={[`${typeColor.border}18`, `${typeColor.border}08`, Colors.background.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.detailHero}
      >
        <View style={styles.detailHeroInner}>
          <View style={[styles.detailIconCircle, { backgroundColor: typeColor.bg, borderWidth: 2, borderColor: `${typeColor.border}40` }]}>
            {getTypeIcon(receipt.type, typeColor.icon, 28)}
          </View>
          <View style={styles.detailHeroContent}>
            <Text style={styles.detailTitle}>{receipt.title}</Text>
            <Text style={styles.detailSubtitle}>{formatSuiteContext()} · {receipt.actor} · {formatRelativeTime(receipt.timestamp)}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusColor.bg, borderColor: `${statusColor.text}30` }]}>
            <Ionicons name={statusIcon[receipt.status]} size={16} color={statusColor.text} />
            <Text style={[styles.statusPillText, { color: statusColor.text }]}>{receipt.status}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.detailContentBody}>
        <View style={styles.detailIntentSection}>
          <View style={styles.detailSectionHeader}>
            <Ionicons name="document-text-outline" size={16} color={Colors.text.muted} />
            <Text style={styles.detailSectionTitle}>Intent</Text>
          </View>
          <Text style={styles.detailBody}>{receipt.intent}</Text>
        </View>

        <View style={styles.detailMetaSection}>
          <View style={styles.detailSectionHeader}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.text.muted} />
            <Text style={styles.detailSectionTitle}>Details</Text>
          </View>
          <View style={styles.metaGrid}>
            <View style={styles.metaCell}>
              <View style={styles.metaCellIconWrap}>
                <Ionicons name="pricetag-outline" size={16} color={typeColor.icon} />
              </View>
              <Text style={styles.metaCellLabel}>Type</Text>
              <View style={[styles.typeTag, { backgroundColor: typeColor.bg }]}>
                <Text style={[styles.typeTagText, { color: typeColor.text }]}>{receipt.type}</Text>
              </View>
            </View>
            <View style={styles.metaCell}>
              <View style={styles.metaCellIconWrap}>
                <Ionicons name="person-outline" size={16} color={Colors.accent.cyan} />
              </View>
              <Text style={styles.metaCellLabel}>Actor</Text>
              <Text style={styles.metaCellValue}>{receipt.actor}</Text>
            </View>
            <View style={styles.metaCell}>
              <View style={styles.metaCellIconWrap}>
                <Ionicons name="time-outline" size={16} color={Colors.accent.amber} />
              </View>
              <Text style={styles.metaCellLabel}>Time</Text>
              <Text style={styles.metaCellValue}>{formatRelativeTime(receipt.timestamp)}</Text>
            </View>
            <View style={styles.metaCell}>
              <View style={styles.metaCellIconWrap}>
                <Ionicons name="briefcase-outline" size={16} color={Colors.semantic.info} />
              </View>
              <Text style={styles.metaCellLabel}>Suite</Text>
              <Text style={styles.metaCellValue}>{formatSuiteContext()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.detailTagsSection}>
          <View style={styles.detailSectionHeader}>
            <Ionicons name="pricetags-outline" size={16} color={Colors.text.muted} />
            <Text style={styles.detailSectionTitle}>Tags</Text>
          </View>
          <View style={styles.detailTagsRow}>
            {receipt.tags.map((tag) => (
              <View key={tag} style={styles.detailTag}>
                <Text style={styles.detailTagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.detailActionBar}>
        <DetailActionButton icon="share-outline" label="Share" />
        <DetailActionButton icon="download-outline" label="Export" />
        <DetailActionButton icon="flag-outline" label="Flag" />
        <DetailActionButton icon="print-outline" label="Print" />
      </View>
    </View>
  );
}

export default function ReceiptsScreen() {
  const insets = useSafeAreaInsets();
  const isDesktop = useDesktop();
  const headerHeight = isDesktop ? 0 : insets.top + 60;
  const scrollRef = useRef<ScrollView>(null);

  const { receipts: supabaseReceipts, loading: supabaseLoading, error: supabaseError } = useRealtimeReceipts(100);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (supabaseLoading) return;

    if (supabaseReceipts.length > 0) {
      setReceipts(supabaseReceipts.map(mapSupabaseReceipt));
      setLoading(false);
    } else {
      // Fetch from Supabase API — empty result means no receipts yet
      fetchReceipts(100)
        .then((rows: any[]) => setReceipts(rows.map(mapSupabaseReceipt)))
        .catch(() => setReceipts([]))
        .finally(() => setLoading(false));
    }
  }, [supabaseReceipts, supabaseLoading]);

  const filteredReceipts = receipts.filter((r) => {
    const typeMatch = activeFilter === 'All' || r.type === activeFilter;
    const statusMatch = !statusFilter || r.status === statusFilter;
    return typeMatch && statusMatch;
  });

  const tabCounts: Record<FilterType, number> = {
    All: receipts.length,
    Payment: receipts.filter(r => r.type === 'Payment').length,
    Contract: receipts.filter(r => r.type === 'Contract').length,
    Communication: receipts.filter(r => r.type === 'Communication').length,
    Call: receipts.filter(r => r.type === 'Call').length,
  };

  const handleReceiptPress = (id: string) => {
    setSelectedId(id);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleTabChange = (filter: FilterType) => {
    setActiveFilter(filter);
    setSelectedId(null);
  };

  const handleStatusFilter = (status: ReceiptStatus) => {
    setStatusFilter(statusFilter === status ? null : status);
    setSelectedId(null);
  };

  const selectedReceipt = selectedId ? receipts.find(r => r.id === selectedId) : null;

  const content = (
    <View style={styles.container}>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.pageScrollContent} showsVerticalScrollIndicator={false}>
        <ImageBackground source={receiptsHero} style={styles.headerBanner} imageStyle={styles.headerBannerImage}>
          <LinearGradient
            colors={['rgba(10, 10, 10, 0.35)', 'rgba(10, 10, 10, 0.65)']}
            style={styles.headerOverlay}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <LinearGradient colors={[Colors.accent.cyan, Colors.accent.cyanDark]} style={styles.headerIconWrap}>
                  <Ionicons name="receipt" size={24} color="#fff" />
                </LinearGradient>
                <View style={{ marginLeft: Spacing.md }}>
                  <Text style={styles.headerTitle}>Receipts</Text>
                  <Text style={styles.headerSubtitle}>
                    {loading ? 'Loading...' : `${receipts.length} receipts across all categories`}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>

        <View style={styles.tabBar}>
          {TAB_CONFIG.map((tab) => {
            const isActive = activeFilter === tab.key;
            const count = tabCounts[tab.key];
            return (
              <TouchableOpacity key={tab.key} onPress={() => handleTabChange(tab.key)} activeOpacity={0.7}>
                {isActive ? (
                  <LinearGradient colors={[Colors.accent.cyan, Colors.accent.cyanDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tabActive}>
                    <Ionicons name={tab.icon} size={18} color="#fff" />
                    <Text style={styles.tabTextActive}>{tab.label}</Text>
                    {!loading && (
                      <View style={styles.tabBadgeActive}>
                        <Text style={styles.tabBadgeTextActive}>{count}</Text>
                      </View>
                    )}
                    <View style={styles.tabGlowBorder} />
                  </LinearGradient>
                ) : (
                  <View style={styles.tabInactive}>
                    <Ionicons name={tab.icon} size={18} color={Colors.text.tertiary} />
                    <Text style={styles.tabTextInactive}>{tab.label}</Text>
                    {!loading && (
                      <View style={styles.tabBadgeInactive}>
                        <Text style={styles.tabBadgeTextInactive}>{count}</Text>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {STATUS_FILTERS.map((f) => {
              const isActive = statusFilter === f.label;
              return (
                <TouchableOpacity
                  key={f.label}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => handleStatusFilter(f.label)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statusDot, { backgroundColor: f.color }]} />
                  <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {selectedReceipt ? (
          <ReceiptDetailView receipt={selectedReceipt} onBack={() => setSelectedId(null)} />
        ) : (
          <View style={styles.listContent}>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
            ) : filteredReceipts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={48} color={Colors.text.muted} />
                <Text style={styles.emptyTitle}>No receipts found</Text>
                <Text style={styles.emptySubtitle}>Try adjusting your filters</Text>
              </View>
            ) : (
              filteredReceipts.map((receipt) => (
                <ReceiptCard
                  key={receipt.id}
                  receipt={receipt}
                  selected={selectedId === receipt.id}
                  onPress={() => handleReceiptPress(receipt.id)}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );

  if (isDesktop) {
    return (
      <DesktopPageWrapper scrollable={false} fullWidth>
        {content}
      </DesktopPageWrapper>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  pageScrollContent: {
    flexGrow: 1,
  },
  headerBanner: {
    height: 130,
    overflow: 'hidden',
  },
  headerBannerImage: {
    resizeMode: 'cover',
  },
  headerOverlay: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.glow(Colors.accent.cyan),
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  headerSubtitle: {
    ...Typography.small,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    gap: Spacing.xs,
  },
  tabActive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    position: 'relative',
    gap: Spacing.xs,
  },
  tabInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.xs,
  },
  tabTextActive: {
    ...Typography.caption,
    color: '#fff',
    fontWeight: '600',
  },
  tabTextInactive: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    fontWeight: '500',
  },
  tabBadgeActive: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 1,
    marginLeft: 2,
  },
  tabBadgeTextActive: {
    ...Typography.micro,
    color: Colors.accent.cyanDark,
    fontWeight: '700',
  },
  tabBadgeInactive: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 1,
    marginLeft: 2,
  },
  tabBadgeTextInactive: {
    ...Typography.micro,
    color: Colors.text.muted,
  },
  tabGlowBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.accent.cyan,
    ...Shadows.glow(Colors.accent.cyan),
  },
  filterBar: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  filterScroll: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    flexDirection: 'row',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  filterPillActive: {
    backgroundColor: Colors.accent.cyan,
    borderColor: Colors.accent.cyan,
  },
  filterPillText: {
    ...Typography.small,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#fff',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs,
  },
  detailFullPage: {
    flex: 1,
    width: '100%',
  },
  detailToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    backgroundColor: Colors.background.secondary,
  },
  detailBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingRight: Spacing.md,
  },
  detailBackText: {
    ...Typography.caption,
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  detailToolbarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  detailToolbarBadgeText: {
    ...Typography.small,
    fontWeight: '600',
  },
  detailHero: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  detailHeroInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailHeroContent: {
    flex: 1,
    marginLeft: Spacing.lg,
    marginRight: Spacing.lg,
  },
  detailIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  detailSubtitle: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginTop: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusPillText: {
    ...Typography.caption,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  detailContentBody: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  detailIntentSection: {
    marginBottom: Spacing.xxl,
  },
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  detailSectionTitle: {
    ...Typography.small,
    color: Colors.text.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  detailBody: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 26,
    paddingLeft: Spacing.xs,
  },
  detailMetaSection: {
    marginBottom: Spacing.xxl,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  metaCell: {
    width: '48%',
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  metaCellIconWrap: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  metaCellLabel: {
    ...Typography.small,
    color: Colors.text.muted,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metaCellValue: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  detailTagsSection: {
    marginBottom: Spacing.lg,
  },
  detailTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  detailTag: {
    backgroundColor: Colors.surface.card,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
  },
  detailTagText: {
    ...Typography.small,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  detailActionBar: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    backgroundColor: Colors.background.secondary,
  },
  detailActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
  },
  detailActionBtnHover: {
    backgroundColor: Colors.surface.cardHover,
    borderColor: Colors.accent.cyan,
  },
  detailActionText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardSelected: {
    borderColor: Colors.accent.cyan,
    backgroundColor: Colors.background.elevated,
  },
  cardHover: {
    backgroundColor: Colors.surface.cardHover,
    ...(isWeb ? { transform: [{ translateY: -1 }] } : {}),
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '700',
    flex: 1,
  },
  cardSubtitle: {
    ...Typography.small,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    marginLeft: Spacing.sm,
  },
  timeText: {
    ...Typography.small,
    color: Colors.text.tertiary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    marginTop: 4,
  },
  statusBadgeText: {
    ...Typography.micro,
    fontWeight: '600',
  },
  previewText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  typeTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  typeTagText: {
    ...Typography.micro,
    fontWeight: '600',
  },
  tag: {
    backgroundColor: Colors.background.tertiary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  tagText: {
    ...Typography.micro,
    color: Colors.text.secondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.body,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  emptySubtitle: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  skeletonCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.tertiary,
  },
  skeletonTitle: {
    width: '60%',
    height: 14,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonSubtitle: {
    width: '40%',
    height: 10,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 4,
  },
});
