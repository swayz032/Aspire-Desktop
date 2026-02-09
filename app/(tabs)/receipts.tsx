import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Text, Platform, ImageBackground } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/tokens';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Wallet, FileText, EnvelopeSimple, Phone } from 'phosphor-react-native';
import { formatRelativeTime, formatSuiteContext } from '@/lib/formatters';
import { seedDatabase } from '@/lib/mockSeed';
import { getReceipts } from '@/lib/mockDb';
import { Receipt, ReceiptType, ReceiptStatus } from '@/types/receipts';
import { useDesktop } from '@/lib/useDesktop';
import { DesktopPageWrapper } from '@/components/desktop/DesktopPageWrapper';
import { PageHeader } from '@/components/PageHeader';

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

function ReceiptDetailView({ receipt }: { receipt: Receipt }) {
  const statusColor = STATUS_COLORS[receipt.status];
  const typeColor = TYPE_COLORS[receipt.type];

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg }}>
        <View style={[styles.detailIconCircle, { backgroundColor: typeColor.bg }]}>
          {getTypeIcon(receipt.type, typeColor.icon, 28)}
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={styles.detailTitle}>{receipt.title}</Text>
          <Text style={styles.detailSubtitle}>{formatSuiteContext()} · {receipt.actor}</Text>
        </View>
        <View style={[styles.statusBadgeLg, { backgroundColor: statusColor.bg }]}>
          <Text style={[styles.statusBadgeLgText, { color: statusColor.text }]}>{receipt.status}</Text>
        </View>
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>Intent</Text>
        <Text style={styles.detailBody}>{receipt.intent}</Text>
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>Details</Text>
        <View style={styles.detailMetaRow}>
          <Text style={styles.detailMetaLabel}>Type</Text>
          <View style={[styles.typeTag, { backgroundColor: typeColor.bg }]}>
            <Text style={[styles.typeTagText, { color: typeColor.text }]}>{receipt.type}</Text>
          </View>
        </View>
        <View style={styles.detailMetaRow}>
          <Text style={styles.detailMetaLabel}>Actor</Text>
          <Text style={styles.detailMetaValue}>{receipt.actor}</Text>
        </View>
        <View style={styles.detailMetaRow}>
          <Text style={styles.detailMetaLabel}>Time</Text>
          <Text style={styles.detailMetaValue}>{formatRelativeTime(receipt.timestamp)}</Text>
        </View>
        <View style={styles.detailMetaRow}>
          <Text style={styles.detailMetaLabel}>Suite</Text>
          <Text style={styles.detailMetaValue}>{formatSuiteContext()}</Text>
        </View>
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>Tags</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
          {receipt.tags.map((tag) => (
            <View key={tag} style={styles.detailTag}>
              <Text style={styles.detailTagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.detailActions}>
        <TouchableOpacity style={styles.detailActionBtn} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={18} color={Colors.text.secondary} />
          <Text style={styles.detailActionText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.detailActionBtn} activeOpacity={0.7}>
          <Ionicons name="download-outline" size={18} color={Colors.text.secondary} />
          <Text style={styles.detailActionText}>Export</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.detailActionBtn} activeOpacity={0.7}>
          <Ionicons name="flag-outline" size={18} color={Colors.text.secondary} />
          <Text style={styles.detailActionText}>Flag</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ReceiptsScreen() {
  const insets = useSafeAreaInsets();
  const isDesktop = useDesktop();
  const headerHeight = isDesktop ? 0 : insets.top + 60;
  const scrollRef = useRef<ScrollView>(null);

  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    seedDatabase();
    const timer = setTimeout(() => {
      setReceipts(getReceipts());
      setLoading(false);
    }, 700);
    return () => clearTimeout(timer);
  }, []);

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
          <View>
            <TouchableOpacity style={styles.backButton} onPress={() => setSelectedId(null)} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={20} color={Colors.accent.cyan} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
            <View style={styles.detailScrollContent}>
              <View style={styles.detailCard}>
                <ReceiptDetailView receipt={selectedReceipt} />
              </View>
            </View>
          </View>
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  backButtonText: {
    ...Typography.caption,
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  detailScrollContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
  },
  detailCard: {
    width: '100%',
    maxWidth: 800,
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    padding: Spacing.xl,
  },
  detailIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  detailSubtitle: {
    ...Typography.small,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  statusBadgeLg: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  statusBadgeLgText: {
    ...Typography.caption,
    fontWeight: '700',
  },
  detailSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  detailSectionTitle: {
    ...Typography.caption,
    color: Colors.text.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  detailBody: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  detailMetaLabel: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  detailMetaValue: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  detailTag: {
    backgroundColor: Colors.background.tertiary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  detailTagText: {
    ...Typography.small,
    color: Colors.text.secondary,
  },
  detailActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  detailActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  detailActionText: {
    ...Typography.small,
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
