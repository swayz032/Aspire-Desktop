import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { useRouter } from 'expo-router';
import { useDesktop } from '@/lib/useDesktop';
import { DesktopPageWrapper } from '@/components/desktop/DesktopPageWrapper';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/providers/TenantProvider';
import { DraftArtifact, RecommendedTool } from '@/types/advisory';

// Advisory data comes from Adam (research agent) + n8n workflows → Supabase receipts
type BusinessProfile = { industry: string; stage: string; connectedTools: string[]; companyName: string; employeeCount: number };
type DailyQuote = { id: string; quote: string; author: string; source: string };
type GrowthLever = { id: string; title: string; whyItMatters: string; whyYouSeeThis: string; roiExpectation: { type: string; value: string; timeframe: string }; riskTier: string; evidenceType: string; packId: string };
type MarketAngle = { id: string; title: string; description: string; opportunity: string; timeframe: string; confidence: string; riskTier?: string; bullets?: string[]; whenItFits?: string[]; risksTradeoffs?: string[] };
type AdvisoryPack = { id: string; title: string; description: string; category: string; price: string; features: string[]; name?: string; includes?: string[]; templates?: string[]; agentConfigs?: string[]; requiredTools?: string[] };
type RecommendedAgent = { id: string; name: string; role: string; description: string; status: string; avatarColor?: string; riskTier?: string; capabilities?: string[] };

export default function AdvisorScreen() {
  const router = useRouter();
  const isDesktop = useDesktop();
  const { tenant } = useTenant();
  const [quoteHidden, setQuoteHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>({
    industry: tenant?.businessName ?? 'Business', stage: 'growth', connectedTools: [], companyName: tenant?.businessName ?? '', employeeCount: 0,
  });
  const [dailyQuote, setDailyQuote] = useState<DailyQuote>({ id: '', quote: 'Connect your tools to unlock AI-powered business intelligence.', author: 'Aspire', source: 'Aspire Intelligence' });
  const [growthLevers, setGrowthLevers] = useState<GrowthLever[]>([]);
  const [marketAngles, setMarketAngles] = useState<MarketAngle[]>([]);
  const [advisoryPacks, setAdvisoryPacks] = useState<AdvisoryPack[]>([]);
  const [recommendedTools, setRecommendedTools] = useState<RecommendedTool[]>([]);
  const [recommendedAgents, setRecommendedAgents] = useState<RecommendedAgent[]>([]);
  const [draftArtifacts, setDraftArtifacts] = useState<DraftArtifact[]>([]);
  const [connectedTools, setConnectedTools] = useState<string[]>([]);
  const [installedPacks, setInstalledPacks] = useState<string[]>([]);
  const [installedAgentConfigs, setInstalledAgentConfigs] = useState<string[]>([]);

  useEffect(() => {
    async function loadAdvisoryData() {
      try {
        // Research results from Adam agent → receipts table
        const { data: researchReceipts } = await supabase
          .from('receipts')
          .select('*')
          .or('action_type.like.research.%,action_type.like.advisory.%,action_type.like.adam.%')
          .order('created_at', { ascending: false })
          .limit(20);

        if (researchReceipts?.length) {
          // Parse growth levers from Adam's research receipts
          const levers = researchReceipts
            .filter((r: any) => r.action_type?.includes('growth') || r.action_type?.includes('lever'))
            .map((r: any, i: number) => ({
              id: r.id ?? `lever-${i}`,
              title: r.payload?.title ?? r.action_type ?? 'Growth Opportunity',
              whyItMatters: r.payload?.why_it_matters ?? '',
              whyYouSeeThis: r.payload?.why_you_see_this ?? 'Based on your connected tool data.',
              roiExpectation: r.payload?.roi ?? { type: 'potential', value: 'TBD', timeframe: 'next 30 days' },
              riskTier: r.risk_tier ?? 'yellow',
              evidenceType: r.payload?.evidence_type ?? 'ai-generated',
              packId: r.payload?.pack_id ?? '',
            }));
          if (levers.length) setGrowthLevers(levers);

          // Parse market angles
          const angles = researchReceipts
            .filter((r: any) => r.action_type?.includes('market') || r.action_type?.includes('angle'))
            .map((r: any, i: number) => ({
              id: r.id ?? `angle-${i}`,
              title: r.payload?.title ?? 'Market Insight',
              description: r.payload?.description ?? '',
              opportunity: r.payload?.opportunity ?? '',
              timeframe: r.payload?.timeframe ?? '',
              confidence: r.payload?.confidence ?? 'medium',
            }));
          if (angles.length) setMarketAngles(angles);
        }

        // Connected tools from finance_connections
        const { data: connections } = await supabase
          .from('finance_connections')
          .select('name, provider, status')
          .eq('status', 'active');
        if (connections?.length) {
          setConnectedTools(connections.map((c: any) => c.name ?? c.provider));
          setRecommendedTools(connections.map((c: any) => ({
            id: c.provider ?? c.name,
            name: c.name ?? c.provider,
            connected: true,
            description: `Connected ${c.provider} account`,
          } as unknown as RecommendedTool)));
        }

        // Suite profile for business info
        const { data: profile } = await supabase.from('suite_profiles').select('*').limit(1).single();
        if (profile) {
          setBusinessProfile({
            industry: profile.industry ?? 'Business Services',
            stage: profile.stage ?? 'growth',
            connectedTools: connections?.map((c: any) => c.name) ?? [],
            companyName: profile.business_name ?? '',
            employeeCount: profile.employee_count ?? 0,
          });
        }
      } catch {
        // Empty state — no advisory data yet
      } finally {
        setLoading(false);
      }
    }
    loadAdvisoryData();
  }, []);

  const hasEvidenceBacked = connectedTools.length >= 2;

  const getRiskColor = (tier: string) => {
    switch (tier) {
      case 'red': return '#ff453a';
      case 'yellow': return '#f59e0b';
      case 'green': return '#34c759';
      default: return '#3B82F6';
    }
  };

  const addDraftArtifact = useCallback((title: string, type: DraftArtifact['type'], sourceAction: string) => {
    const newArtifact: DraftArtifact = {
      id: `draft-${Date.now()}`,
      title,
      type,
      createdAt: new Date().toISOString(),
      sourceAction,
      status: 'draft',
    };
    setDraftArtifacts(prev => [newArtifact, ...prev]);
  }, []);

  const handleInstallPack = useCallback((packId: string, packName: string, includes: string[]) => {
    if (installedPacks.includes(packId)) return;
    setInstalledPacks(prev => [...prev, packId]);
    includes.slice(0, 3).forEach((item, i) => {
      setTimeout(() => {
        addDraftArtifact(`${item} (Draft)`, 'template', `Install Pack: ${packName}`);
      }, i * 100);
    });
  }, [installedPacks, addDraftArtifact]);

  const handleGeneratePlaybook = useCallback((angleTitle: string) => {
    addDraftArtifact(`${angleTitle} Playbook (Draft)`, 'playbook', 'Generate Playbook');
  }, [addDraftArtifact]);

  const handleConnectTool = useCallback((toolId: string, toolName: string) => {
    const isConnected = connectedTools.includes(toolId);
    setConnectedTools(prev => 
      isConnected 
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
    );
    if (!isConnected) {
      addDraftArtifact(`${toolName} Integration Config`, 'tool_config', `Connect Tool: ${toolName}`);
    }
  }, [connectedTools, addDraftArtifact]);

  const handleInstallAgentConfig = useCallback((agentId: string, agentName: string) => {
    if (installedAgentConfigs.includes(agentId)) return;
    setInstalledAgentConfigs(prev => [...prev, agentId]);
    addDraftArtifact(`${agentName} Agent Config`, 'agent_config', 'Install Agent Config');
  }, [installedAgentConfigs, addDraftArtifact]);

  const content = (
    <View style={styles.container}>
      {!isDesktop && (
        <View style={styles.customHeader}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerBrand}>
            <View style={styles.headerLogoWrapper}>
              <Ionicons name="bulb" size={16} color="#f59e0b" />
            </View>
            <View style={styles.headerDivider} />
            <Text style={styles.headerTitle}>Industry Advisor</Text>
          </View>
        </View>
      )}
      
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <LinearGradient
            colors={['#1e2430', '#242c3d', '#2a3548', '#242c3d', '#1e2430']}
            locations={[0, 0.2, 0.5, 0.8, 1]}
            style={styles.heroGradient}
          >
            <View style={styles.heroHeader}>
              <View style={styles.heroIconWrapper}>
                <Ionicons name="bulb" size={24} color="#f59e0b" />
              </View>
              <View>
                <Text style={styles.heroTitle}>Industry Advisor</Text>
                <Text style={styles.heroSubtitle}>Personalized growth intelligence</Text>
              </View>
            </View>

            <View style={styles.chipRow}>
              <View style={styles.chip}>
                <Ionicons name="business-outline" size={12} color="rgba(255,255,255,0.8)" />
                <Text style={styles.chipText}>{businessProfile.industry}</Text>
              </View>
              <View style={styles.chip}>
                <Ionicons name="trending-up-outline" size={12} color="rgba(255,255,255,0.8)" />
                <Text style={styles.chipText}>{businessProfile.stage}</Text>
              </View>
              <View style={[styles.chip, hasEvidenceBacked ? styles.chipSuccess : styles.chipWarning]}>
                <Ionicons 
                  name={hasEvidenceBacked ? 'checkmark-circle' : 'help-circle'} 
                  size={12} 
                  color={hasEvidenceBacked ? '#34c759' : '#f59e0b'} 
                />
                <Text style={[styles.chipText, { color: hasEvidenceBacked ? '#34c759' : '#f59e0b' }]}>
                  {hasEvidenceBacked ? 'Evidence-backed' : 'Estimated'}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {!quoteHidden && (
          <View style={styles.quoteRibbon}>
            <View style={styles.quoteContent}>
              <Ionicons name="chatbubble-outline" size={14} color="rgba(255,255,255,0.6)" />
              <Text style={styles.quoteText} numberOfLines={1}>"{dailyQuote.quote}"</Text>
            </View>
            <View style={styles.quoteActions}>
              <TouchableOpacity style={styles.quoteActionBtn}>
                <Ionicons name="bookmark-outline" size={16} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quoteActionBtn}
                onPress={() => setQuoteHidden(true)}
              >
                <Ionicons name="close" size={16} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Growth Levers</Text>
            <Text style={styles.sectionBadge}>3 identified</Text>
          </View>
          {growthLevers.map((lever) => (
            <Card key={lever.id} variant="elevated" style={styles.leverCard}>
              <View style={styles.leverHeader}>
                <View style={[styles.leverDot, { backgroundColor: getRiskColor(lever.riskTier) }]} />
                <View style={styles.leverBadges}>
                  <View style={[styles.riskBadge, { backgroundColor: `${getRiskColor(lever.riskTier)}20` }]}>
                    <Text style={[styles.riskBadgeText, { color: getRiskColor(lever.riskTier) }]}>
                      {lever.riskTier === 'red' ? 'High Priority' : lever.riskTier === 'yellow' ? 'Medium' : 'Low Risk'}
                    </Text>
                  </View>
                  <View style={[styles.evidenceBadge, (hasEvidenceBacked && lever.evidenceType === 'evidence-backed') && styles.evidenceBadgeSuccess]}>
                    <Ionicons 
                      name={(hasEvidenceBacked && lever.evidenceType === 'evidence-backed') ? 'checkmark-circle' : 'help-circle'} 
                      size={10} 
                      color={(hasEvidenceBacked && lever.evidenceType === 'evidence-backed') ? '#34c759' : '#f59e0b'} 
                    />
                    <Text style={styles.evidenceBadgeText}>
                      {(hasEvidenceBacked && lever.evidenceType === 'evidence-backed') ? 'Evidence-backed' : 'Estimated'}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={styles.leverTitle}>{lever.title}</Text>
              <Text style={styles.leverMatter}>{lever.whyItMatters}</Text>
              <View style={styles.leverEvidence}>
                <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.5)" />
                <Text style={styles.leverEvidenceText}>{lever.whyYouSeeThis}</Text>
              </View>
              <View style={styles.leverFooter}>
                <View style={styles.roiChip}>
                  <Ionicons 
                    name={lever.roiExpectation.type === 'cash_recovered' ? 'cash-outline' : 'trending-up-outline'} 
                    size={14} 
                    color="#34c759" 
                  />
                  <Text style={styles.roiText}>
                    {lever.roiExpectation.value} • {lever.roiExpectation.timeframe}
                  </Text>
                </View>
                <TouchableOpacity 
                  style={[styles.installBtn, installedPacks.includes(lever.packId || '') && styles.installedBtn]}
                  onPress={() => lever.packId && handleInstallPack(lever.packId, lever.title, ['Template 1', 'Template 2', 'Workflow config'])}
                  disabled={installedPacks.includes(lever.packId || '')}
                >
                  <Text style={styles.installBtnText}>
                    {installedPacks.includes(lever.packId || '') ? 'Installed' : 'Install Pack'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Market Angles You Might Be Missing</Text>
          </View>
          {marketAngles.map((angle) => (
            <Card key={angle.id} variant="elevated" style={styles.angleCard}>
              <View style={styles.angleHeader}>
                <View style={[styles.leverDot, { backgroundColor: getRiskColor(angle.riskTier ?? 'green') }]} />
                <View style={[styles.riskBadge, { backgroundColor: `${getRiskColor(angle.riskTier ?? 'green')}20` }]}>
                  <Text style={[styles.riskBadgeText, { color: getRiskColor(angle.riskTier ?? 'green') }]}>
                    {angle.riskTier === 'yellow' ? 'Consider' : 'Low Risk'}
                  </Text>
                </View>
              </View>
              <Text style={styles.angleTitle}>{angle.title}</Text>
              <Text style={styles.angleDescription}>{angle.description}</Text>
              
              <View style={styles.angleBullets}>
                {(angle.bullets ?? []).map((bullet: string, i: number) => (
                  <View key={i} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{bullet}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.angleConditions}>
                <Text style={styles.conditionsLabel}>When it fits:</Text>
                {(angle.whenItFits ?? []).slice(0, 2).map((condition: string, i: number) => (
                  <View key={i} style={styles.conditionRow}>
                    <Ionicons name="checkmark" size={12} color="#34c759" />
                    <Text style={styles.conditionText}>{condition}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.angleRisks}>
                <Text style={styles.risksLabel}>Tradeoffs:</Text>
                {(angle.risksTradeoffs ?? []).slice(0, 2).map((risk: string, i: number) => (
                  <View key={i} style={styles.riskRow}>
                    <Ionicons name="alert-circle-outline" size={12} color="#f59e0b" />
                    <Text style={styles.riskText}>{risk}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity 
                style={styles.playbookBtn}
                onPress={() => handleGeneratePlaybook(angle.title)}
              >
                <Ionicons name="document-text-outline" size={16} color="#fff" />
                <Text style={styles.playbookBtnText}>Generate Playbook</Text>
              </TouchableOpacity>
            </Card>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Advisory Packs</Text>
            <Text style={styles.sectionBadge}>Installable</Text>
          </View>
          {advisoryPacks.map((pack) => (
            <Card key={pack.id} variant="elevated" style={styles.packCard}>
              <View style={styles.packHeader}>
                <View style={styles.packIconWrapper}>
                  <Ionicons name="cube" size={20} color="#3B82F6" />
                </View>
                <View style={styles.packInfo}>
                  <Text style={styles.packName}>{pack.name}</Text>
                  <Text style={styles.packDescription}>{pack.description}</Text>
                </View>
              </View>
              <View style={styles.packIncludes}>
                {(pack.includes ?? []).slice(0, 3).map((item: string, i: number) => (
                  <View key={i} style={styles.includeRow}>
                    <Ionicons name="checkmark-circle" size={12} color="#34c759" />
                    <Text style={styles.includeText}>{item}</Text>
                  </View>
                ))}
                {(pack.includes ?? []).length > 3 && (
                  <Text style={styles.moreIncludes}>+{(pack.includes ?? []).length - 3} more</Text>
                )}
              </View>
              <View style={styles.packFooter}>
                <View style={styles.packMeta}>
                  <Text style={styles.packMetaText}>{pack.templates} templates • {pack.agentConfigs} configs</Text>
                  {pack.requiredTools && (
                    <View style={styles.requiredTools}>
                      <Text style={styles.requiredLabel}>Requires: </Text>
                      <Text style={styles.requiredToolsList}>{pack.requiredTools.join(', ')}</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity 
                  style={[styles.installBtn, installedPacks.includes(pack.id) && styles.installedBtn]}
                  onPress={() => handleInstallPack(pack.id, pack.name ?? pack.title, pack.includes ?? pack.features)}
                  disabled={installedPacks.includes(pack.id)}
                >
                  <Text style={styles.installBtnText}>
                    {installedPacks.includes(pack.id) ? 'Installed' : 'Install'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recommended Tools</Text>
            <Text style={styles.sectionSubtitle}>Connect to unlock evidence-backed insights</Text>
          </View>
          <Card variant="elevated" style={styles.toolsCard}>
            {recommendedTools.map((tool, index) => (
              <View 
                key={tool.id} 
                style={[
                  styles.toolRow,
                  index < recommendedTools.length - 1 && styles.toolRowBorder
                ]}
              >
                <View style={styles.toolInfo}>
                  <View style={styles.toolIconWrapper}>
                    <Ionicons name={tool.icon as any} size={18} color="#3B82F6" />
                  </View>
                  <View style={styles.toolText}>
                    <Text style={styles.toolName}>{tool.name}</Text>
                    <Text style={styles.toolUnlocks}>{tool.whatAspireUnlocks}</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={[styles.connectBtn, connectedTools.includes(tool.id) && styles.connectedBtn]}
                  onPress={() => handleConnectTool(tool.id, tool.name)}
                >
                  <Text style={[styles.connectBtnText, connectedTools.includes(tool.id) && styles.connectedBtnText]}>
                    {connectedTools.includes(tool.id) ? 'Connected' : 'Connect'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recommended Agents</Text>
          </View>
          {recommendedAgents.map((agent) => (
            <Card key={agent.id} variant="elevated" style={styles.agentCard}>
              <View style={styles.agentHeader}>
                <View style={[styles.agentAvatar, { backgroundColor: agent.avatarColor }]}>
                  <Text style={styles.agentInitial}>{agent.name[0]}</Text>
                </View>
                <View style={styles.agentInfo}>
                  <Text style={styles.agentName}>{agent.name}</Text>
                  <Text style={styles.agentRole}>{agent.role}</Text>
                </View>
                <View style={[styles.riskBadge, { backgroundColor: `${getRiskColor(agent.riskTier ?? 'green')}20` }]}>
                  <Text style={[styles.riskBadgeText, { color: getRiskColor(agent.riskTier ?? 'green') }]}>
                    {agent.riskTier === 'green' ? 'Low Risk' : 'Medium'}
                  </Text>
                </View>
              </View>
              <View style={styles.agentCapabilities}>
                {(agent.capabilities ?? []).map((cap: string, i: number) => (
                  <View key={i} style={styles.capabilityRow}>
                    <Ionicons name="checkmark" size={12} color="#3B82F6" />
                    <Text style={styles.capabilityText}>{cap}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity 
                style={[styles.configBtn, installedAgentConfigs.includes(agent.id) && styles.installedBtn]}
                onPress={() => handleInstallAgentConfig(agent.id, agent.name)}
                disabled={installedAgentConfigs.includes(agent.id)}
              >
                <Ionicons name="settings-outline" size={14} color="#fff" />
                <Text style={styles.configBtnText}>
                  {installedAgentConfigs.includes(agent.id) ? 'Config Installed' : 'Install Agent Config'}
                </Text>
              </TouchableOpacity>
            </Card>
          ))}
        </View>

        {draftArtifacts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Drafts Created</Text>
              <Text style={styles.sectionBadge}>{draftArtifacts.length} items</Text>
            </View>
            <Card variant="elevated" style={styles.draftsCard}>
              {draftArtifacts.map((draft, index) => (
                <View 
                  key={draft.id} 
                  style={[
                    styles.draftRow,
                    index < draftArtifacts.length - 1 && styles.draftRowBorder
                  ]}
                >
                  <View style={styles.draftInfo}>
                    <View style={styles.draftIconWrapper}>
                      <Ionicons 
                        name={
                          draft.type === 'playbook' ? 'book-outline' :
                          draft.type === 'agent_config' ? 'settings-outline' :
                          draft.type === 'tool_config' ? 'link-outline' :
                          'document-text-outline'
                        } 
                        size={16} 
                        color="#3B82F6" 
                      />
                    </View>
                    <View>
                      <Text style={styles.draftTitle}>{draft.title}</Text>
                      <Text style={styles.draftSource}>{draft.sourceAction}</Text>
                    </View>
                  </View>
                  <View style={styles.draftStatus}>
                    <View style={styles.draftStatusDot} />
                    <Text style={styles.draftStatusText}>Draft</Text>
                  </View>
                </View>
              ))}
            </Card>
          </View>
        )}

      </ScrollView>
    </View>
  );

  if (isDesktop) {
    return (
      <DesktopPageWrapper scrollable={false}>
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
  scrollContent: {
    paddingTop: 110,
    paddingBottom: 40,
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  scrollContentDesktop: {
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  customHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: 50,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerLogoWrapper: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border.subtle,
  },
  headerTitle: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  heroSection: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  heroGradient: {
    padding: Spacing.xl,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  heroIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: Typography.caption.fontSize,
    color: '#D4D4D8',
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  chipSuccess: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
  },
  chipWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  chipText: {
    fontSize: Typography.small.fontSize,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  quoteRibbon: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  quoteContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  quoteText: {
    fontSize: Typography.small.fontSize,
    color: '#D4D4D8',
    fontStyle: 'italic',
    flex: 1,
  },
  quoteActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  quoteActionBtn: {
    padding: 4,
  },
  section: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.headline.fontSize,
    fontWeight: '600',
    color: '#ffffff',
  },
  sectionSubtitle: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.tertiary,
  },
  sectionBadge: {
    fontSize: Typography.small.fontSize,
    color: '#3B82F6',
    fontWeight: '500',
  },
  leverCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  leverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  leverDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  leverBadges: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  riskBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  riskBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  evidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  evidenceBadgeSuccess: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  evidenceBadgeText: {
    fontSize: 11,
    color: '#D4D4D8',
    fontWeight: '500',
  },
  leverTitle: {
    fontSize: Typography.title.fontSize,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: Spacing.sm,
  },
  leverMatter: {
    fontSize: Typography.caption.fontSize,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  leverEvidence: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  leverEvidenceText: {
    fontSize: Typography.small.fontSize,
    color: '#D4D4D8',
    flex: 1,
    lineHeight: 18,
  },
  leverFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  roiText: {
    fontSize: Typography.small.fontSize,
    color: '#34c759',
    fontWeight: '600',
  },
  installBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  installedBtn: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
  },
  installBtnText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: '#fff',
  },
  angleCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  angleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  angleTitle: {
    fontSize: Typography.title.fontSize,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: Spacing.sm,
  },
  angleDescription: {
    fontSize: Typography.caption.fontSize,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  angleBullets: {
    marginBottom: Spacing.md,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: 6,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3B82F6',
    marginTop: 6,
  },
  bulletText: {
    fontSize: Typography.small.fontSize,
    color: 'rgba(255,255,255,0.8)',
    flex: 1,
  },
  angleConditions: {
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  conditionsLabel: {
    fontSize: Typography.micro.fontSize,
    color: '#34c759',
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  conditionText: {
    fontSize: Typography.small.fontSize,
    color: '#D4D4D8',
  },
  angleRisks: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  risksLabel: {
    fontSize: Typography.micro.fontSize,
    color: '#f59e0b',
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  riskText: {
    fontSize: Typography.small.fontSize,
    color: '#D4D4D8',
  },
  playbookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(79, 172, 254, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.3)',
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
  },
  playbookBtnText: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '600',
    color: '#fff',
  },
  packCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  packHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  packIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(79, 172, 254, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  packInfo: {
    flex: 1,
  },
  packName: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  packDescription: {
    fontSize: Typography.small.fontSize,
    color: '#D4D4D8',
    lineHeight: 18,
  },
  packIncludes: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  includeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  includeText: {
    fontSize: Typography.small.fontSize,
    color: 'rgba(255,255,255,0.8)',
  },
  moreIncludes: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.tertiary,
    marginTop: 4,
  },
  packFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  packMeta: {},
  packMetaText: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.tertiary,
  },
  requiredTools: {
    flexDirection: 'row',
    marginTop: 4,
  },
  requiredLabel: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.muted,
  },
  requiredToolsList: {
    fontSize: Typography.micro.fontSize,
    color: '#3B82F6',
  },
  toolsCard: {
    padding: 0,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  toolRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  toolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  toolIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(79, 172, 254, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolText: {
    flex: 1,
  },
  toolName: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  toolUnlocks: {
    fontSize: Typography.small.fontSize,
    color: '#D4D4D8',
    lineHeight: 16,
  },
  connectBtn: {
    backgroundColor: 'rgba(79, 172, 254, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.3)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  connectedBtn: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  connectBtnText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: '#3B82F6',
  },
  connectedBtnText: {
    color: '#34c759',
  },
  agentCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  agentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentInitial: {
    fontSize: Typography.title.fontSize,
    fontWeight: '700',
    color: '#fff',
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: '#ffffff',
  },
  agentRole: {
    fontSize: Typography.small.fontSize,
    color: '#D4D4D8',
  },
  agentCapabilities: {
    marginBottom: Spacing.md,
  },
  capabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  capabilityText: {
    fontSize: Typography.small.fontSize,
    color: 'rgba(255,255,255,0.8)',
  },
  configBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(79, 172, 254, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.3)',
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
  },
  configBtnText: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '600',
    color: '#fff',
  },
  draftsCard: {
    padding: 0,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  draftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  draftRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  draftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  draftIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(79, 172, 254, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftTitle: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '500',
    color: '#ffffff',
  },
  draftSource: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  draftStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  draftStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f59e0b',
  },
  draftStatusText: {
    fontSize: Typography.small.fontSize,
    color: '#f59e0b',
    fontWeight: '500',
  },
});
