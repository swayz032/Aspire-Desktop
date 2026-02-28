/**
 * Template Browser -- Live PandaDoc workspace templates.
 *
 * Fetches real templates from PandaDoc API via GET /api/contracts/templates.
 * Any template added to the PandaDoc workspace appears here automatically.
 * Clara uses the same PandaDoc API -- single source of truth.
 * Zero mock data -- only real templates from your workspace.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FinanceHubShell } from '@/components/finance/FinanceHubShell';
import { Colors } from '@/constants/tokens';
import { CARD_BG, CARD_BORDER } from '@/constants/cardPatterns';
import { TemplateCard, type TemplateData, LANE_META, type TemplateLane } from '@/components/finance/documents';
import { getPandaDocTemplates, type PandaDocTemplate } from '@/lib/api';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { FinnDeskOverlay } from '@/components/finance/FinnDeskOverlay';

const webOnly = (s: Record<string, unknown>) => Platform.OS === 'web' ? s : {};

/** Classify a PandaDoc template name into an Aspire lane */
function classifyLane(name: string): TemplateLane {
  const lower = name.toLowerCase();
  if (lower.includes('nda') || lower.includes('confidential')) return 'general';
  if (lower.includes('lease') || lower.includes('landlord') || lower.includes('tenant') || lower.includes('rental')) return 'landlord';
  if (lower.includes('engagement') || lower.includes('bookkeep') || lower.includes('accounting') || lower.includes('audit')) return 'accounting';
  // Default: trades (contracts, services, HVAC, construction, etc.)
  return 'trades';
}

/** Infer risk tier from template content */
function inferRiskTier(t: PandaDocTemplate): 'green' | 'yellow' | 'red' {
  const hasSignature = t.fields.some(f => f.type === 'signature');
  const hasPricing = t.has_pricing;
  if (hasSignature && hasPricing) return 'red';
  if (hasSignature) return 'yellow';
  return 'green';
}

/** Convert API response to TemplateData[] */
function toTemplateData(templates: PandaDocTemplate[]): TemplateData[] {
  return templates.map((t) => ({
    key: `pandadoc_${t.id}`,
    lane: classifyLane(t.name),
    description: t.name,
    risk_tier: inferRiskTier(t),
    jurisdiction_required: false,
    pandadoc_template_uuid: t.id,
    tokens_count: t.tokens.length,
    fields_count: t.fields.length,
    roles: t.roles.map(r => r.name),
    has_pricing: t.has_pricing,
    date_modified: t.date_modified,
    preview_image_url: t.preview_image_url,
  }));
}

type LaneTab = 'all' | TemplateLane;

const NUM_COLUMNS = 3;

export default function TemplatesPage() {
  const [activeLane, setActiveLane] = useState<LaneTab>('all');
  const [liveTemplates, setLiveTemplates] = useState<TemplateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { authenticatedFetch } = useAuthFetch();

  // Fetch live PandaDoc templates on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchTemplates() {
      try {
        setLoading(true);
        setError(null);
        const result = await getPandaDocTemplates(authenticatedFetch);
        if (cancelled) return;
        setLiveTemplates(toTemplateData(result.templates));
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load templates');
          console.warn('[templates] Failed to fetch PandaDoc templates:', err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTemplates();
    return () => { cancelled = true; };
  }, [authenticatedFetch]);

  const filteredTemplates = useMemo(() => {
    if (activeLane === 'all') return liveTemplates;
    return liveTemplates.filter(t => t.lane === activeLane);
  }, [activeLane, liveTemplates]);

  const laneTabs = useMemo(() => {
    const tabs: { key: LaneTab; label: string; count: number }[] = [
      { key: 'all', label: 'All', count: liveTemplates.length },
      { key: 'trades', label: 'Trades', count: liveTemplates.filter(t => t.lane === 'trades').length },
      { key: 'accounting', label: 'Accounting', count: liveTemplates.filter(t => t.lane === 'accounting').length },
      { key: 'landlord', label: 'Landlord', count: liveTemplates.filter(t => t.lane === 'landlord').length },
      { key: 'general', label: 'General', count: liveTemplates.filter(t => t.lane === 'general').length },
    ];
    return tabs;
  }, [liveTemplates]);

  // Finn overlay state for "Create with Finn"
  const [showFinnOverlay, setShowFinnOverlay] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateData | null>(null);

  const handleUseTemplate = useCallback((key: string) => {
    const template = liveTemplates.find(t => t.key === key);
    if (!template) return;
    // Open Finn video overlay with template context — auto-connect, Finn is aware
    setSelectedTemplate(template);
    setShowFinnOverlay(true);
  }, [liveTemplates]);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPandaDocTemplates(authenticatedFetch);
      setLiveTemplates(toTemplateData(result.templates));
    } catch (err: any) {
      setError(err.message || 'Failed to refresh');
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch]);

  const renderCard = useCallback(({ item, index }: { item: TemplateData; index: number }) => (
    <View style={styles.cardCell}>
      <TemplateCard template={item} index={index} onUseTemplate={handleUseTemplate} />
    </View>
  ), [handleUseTemplate]);

  const keyExtractor = useCallback((item: TemplateData) => item.key, []);

  return (
    <FinanceHubShell>
      <View style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.pageTitle}>Templates</Text>
            <Text style={styles.pageSubtitle}>
              {liveTemplates.length > 0
                ? `${liveTemplates.length} template${liveTemplates.length !== 1 ? 's' : ''} in your PandaDoc workspace`
                : 'Add templates in PandaDoc to get started'
              }
            </Text>
          </View>
          <Pressable
            onPress={handleRefresh}
            disabled={loading}
            style={[styles.refreshBtn, webOnly({ cursor: 'pointer', transition: 'opacity 0.2s ease' })]}
            accessibilityRole="button"
            accessibilityLabel="Refresh templates"
          >
            {loading ? (
              <ActivityIndicator size="small" color={Colors.accent.cyan} />
            ) : (
              <Ionicons name="refresh-outline" size={18} color={Colors.accent.cyan} />
            )}
          </Pressable>
        </View>

        {/* Error banner */}
        {error && !loading && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={14} color="#f59e0b" />
            <Text style={styles.errorText}>Could not reach PandaDoc -- check your API key and try again</Text>
          </View>
        )}

        {/* Main card */}
        <View style={styles.card}>
          {/* Lane tabs */}
          <View style={styles.tabsRow}>
            {laneTabs.map(tab => {
              const active = activeLane === tab.key;
              const meta = tab.key !== 'all' ? LANE_META[tab.key as TemplateLane] : null;
              return (
                <Pressable
                  key={tab.key}
                  style={[styles.laneTab, active && styles.laneTabActive, webOnly({ cursor: 'pointer', transition: 'all 0.2s ease' })]}
                  onPress={() => setActiveLane(tab.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  {meta && (
                    <Ionicons
                      name={meta.icon as any}
                      size={14}
                      color={active ? meta.color : Colors.text.muted}
                    />
                  )}
                  <Text style={[styles.laneTabText, active && styles.laneTabTextActive]}>
                    {tab.label}
                  </Text>
                  <View style={[styles.laneCount, active && styles.laneCountActive]}>
                    <Text style={[styles.laneCountText, active && styles.laneCountTextActive]}>
                      {tab.count}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Grid */}
          <View style={styles.contentArea}>
            {loading && liveTemplates.length === 0 ? (
              <View style={styles.centerState}>
                <ActivityIndicator size="large" color={Colors.accent.cyan} />
                <Text style={styles.stateText}>Loading PandaDoc templates...</Text>
              </View>
            ) : filteredTemplates.length === 0 ? (
              <View style={styles.centerState}>
                <Ionicons name="copy-outline" size={48} color={Colors.text.disabled} />
                <Text style={styles.stateText}>
                  {liveTemplates.length === 0
                    ? 'No templates yet -- add templates in your PandaDoc workspace'
                    : 'No templates in this category'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredTemplates}
                renderItem={renderCard}
                keyExtractor={keyExtractor}
                numColumns={NUM_COLUMNS}
                columnWrapperStyle={styles.gridRow}
                contentContainerStyle={styles.gridContent}
                showsVerticalScrollIndicator={false}
                initialNumToRender={9}
                maxToRenderPerBatch={6}
              />
            )}
          </View>
        </View>
      </View>

      {/* Finn Video Overlay — auto-opens Video tab with template context for Clara */}
      {showFinnOverlay && selectedTemplate && (
        <FinnDeskOverlay
          visible={showFinnOverlay}
          onClose={() => { setShowFinnOverlay(false); setSelectedTemplate(null); }}
          initialTab="video"
          templateContext={{ key: selectedTemplate.key, description: selectedTemplate.description }}
        />
      )}
    </FinanceHubShell>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    color: Colors.text.muted,
    marginTop: 4,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(59,130,246,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.15)',
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#f59e0b',
  },

  // Main card
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    overflow: 'hidden',
  },

  // Tabs
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 4,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  laneTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginRight: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  laneTabActive: {
    borderBottomColor: Colors.accent.cyan,
  },
  laneTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.muted,
  },
  laneTabTextActive: {
    color: Colors.accent.cyan,
  },
  laneCount: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  laneCountActive: {
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  laneCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.muted,
  },
  laneCountTextActive: {
    color: Colors.accent.cyan,
  },

  // Grid
  contentArea: {
    minHeight: 300,
  },
  gridContent: {
    padding: 16,
  },
  gridRow: {
    gap: 14,
    marginBottom: 14,
  },
  cardCell: {
    flex: 1,
    maxWidth: '33.33%',
  },

  // States
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  stateText: {
    color: Colors.text.tertiary,
    fontSize: 15,
    marginTop: 12,
  },
});
