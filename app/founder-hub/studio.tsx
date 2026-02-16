import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { HubPageShell } from '@/components/founder-hub/HubPageShell';

const THEME = {
  bg: '#000000',
  surface: '#0a0a0a',
  surfaceHover: '#111111',
  border: 'rgba(255,255,255,0.06)',
  accent: '#3B82F6',
  accentMuted: 'rgba(59, 130, 246, 0.12)',
  text: {
    primary: '#ffffff',
    secondary: 'rgba(255,255,255,0.70)',
    muted: 'rgba(255,255,255,0.45)',
  },
};

const studioModes = [
  { id: 'offer', label: 'Offer', icon: 'pricetag-outline' as const, desc: 'Create compelling offers and packages' },
  { id: 'pricing', label: 'Pricing', icon: 'calculator-outline' as const, desc: 'Optimize your pricing strategy' },
  { id: 'outreach', label: 'Outreach', icon: 'mail-outline' as const, desc: 'Craft personalized outreach campaigns' },
  { id: 'market', label: 'Market', icon: 'trending-up-outline' as const, desc: 'Analyze market opportunities' },
  { id: 'ops', label: 'Operations', icon: 'construct-outline' as const, desc: 'Streamline your operations' },
];

const recentSessions = [
  { id: '1', title: 'Grade B pricing optimization', mode: 'Pricing', date: 'Yesterday', status: 'completed' },
  { id: '2', title: 'Cold email campaign for warehouses', mode: 'Outreach', date: '2 days ago', status: 'in_progress' },
  { id: '3', title: 'Q2 lumber procurement plan', mode: 'Operations', date: '3 days ago', status: 'completed' },
];

const quickStarts = [
  { id: '1', icon: 'flash-outline' as const, title: 'Quick win analysis', desc: 'Find low-effort, high-impact opportunities' },
  { id: '2', icon: 'shield-checkmark-outline' as const, title: 'Risk assessment', desc: 'Identify and mitigate business risks' },
  { id: '3', icon: 'rocket-outline' as const, title: 'Growth brainstorm', desc: 'Generate ideas for scaling your business' },
];

export default function StudioScreen() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);

  const rightRail = (
    <View style={styles.railContent}>
      <Text style={styles.railTitle}>Recent Sessions</Text>
      <View style={styles.sessionsList}>
        {recentSessions.map((session) => (
          <Pressable
            key={session.id}
            style={[
              styles.sessionItem,
              hoveredItem === `session-${session.id}` && styles.sessionItemHover,
            ]}
            onHoverIn={() => setHoveredItem(`session-${session.id}`)}
            onHoverOut={() => setHoveredItem(null)}
          >
            <View style={styles.sessionTop}>
              <View style={styles.sessionMode}>
                <Text style={styles.sessionModeText}>{session.mode}</Text>
              </View>
              <Text style={styles.sessionDate}>{session.date}</Text>
            </View>
            <Text style={styles.sessionTitle}>{session.title}</Text>
            <View style={styles.sessionStatus}>
              <View style={[
                styles.statusDot,
                session.status === 'completed' ? styles.statusDotComplete : styles.statusDotProgress,
              ]} />
              <Text style={styles.statusText}>
                {session.status === 'completed' ? 'Completed' : 'In Progress'}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.railDivider} />

      <Text style={styles.railTitle}>Quick Starts</Text>
      <View style={styles.quickStartsList}>
        {quickStarts.map((item) => (
          <Pressable
            key={item.id}
            style={[
              styles.quickStartItem,
              hoveredItem === `quick-${item.id}` && styles.quickStartItemHover,
            ]}
            onHoverIn={() => setHoveredItem(`quick-${item.id}`)}
            onHoverOut={() => setHoveredItem(null)}
          >
            <View style={styles.quickStartIcon}>
              <Ionicons name={item.icon} size={16} color={THEME.accent} />
            </View>
            <View style={styles.quickStartContent}>
              <Text style={styles.quickStartTitle}>{item.title}</Text>
              <Text style={styles.quickStartDesc}>{item.desc}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <HubPageShell rightRail={rightRail}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Studio</Text>
        <Text style={styles.pageSubtitle}>Brainstorm, plan, and create with Ava</Text>
      </View>

      <View style={styles.heroSection}>
        <LinearGradient
          colors={['#0c2d4d', '#0a1f35', '#061525']}
          style={styles.heroGradient}
        >
          <View style={styles.heroContent}>
            <View style={styles.heroIcon}>
              <Ionicons name="sparkles" size={32} color={THEME.accent} />
            </View>
            <Text style={styles.heroTitle}>What are we working on today?</Text>
            <Text style={styles.heroSubtitle}>
              Choose a mode below or tell Ava what's on your mind. She'll help you brainstorm, 
              plan, and create actionable strategies for your business.
            </Text>
            <View style={styles.heroInputRow}>
              <View style={styles.heroInput}>
                <Ionicons name="mic-outline" size={20} color={THEME.text.muted} />
                <Text style={styles.heroInputPlaceholder}>Tell Ava what you're thinking about...</Text>
              </View>
              <Pressable
                style={[styles.heroStartBtn, hoveredItem === 'start' && styles.heroStartBtnHover]}
                onHoverIn={() => setHoveredItem('start')}
                onHoverOut={() => setHoveredItem(null)}
              >
                <Text style={styles.heroStartBtnText}>Start Session</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Choose Your Mode</Text>
        <View style={styles.modesGrid}>
          {studioModes.map((mode) => (
            <Pressable
              key={mode.id}
              style={[
                styles.modeCard,
                selectedMode === mode.id && styles.modeCardSelected,
                hoveredItem === `mode-${mode.id}` && styles.modeCardHover,
              ]}
              onPress={() => setSelectedMode(mode.id)}
              onHoverIn={() => setHoveredItem(`mode-${mode.id}`)}
              onHoverOut={() => setHoveredItem(null)}
            >
              <View style={[
                styles.modeIcon,
                selectedMode === mode.id && styles.modeIconSelected,
              ]}>
                <Ionicons
                  name={mode.icon}
                  size={24}
                  color={selectedMode === mode.id ? '#000' : THEME.accent}
                />
              </View>
              <Text style={[
                styles.modeLabel,
                selectedMode === mode.id && styles.modeLabelSelected,
              ]}>
                {mode.label}
              </Text>
              <Text style={styles.modeDesc}>{mode.desc}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Studio Features</Text>
        <View style={styles.featuresGrid}>
          <View style={styles.featureCard}>
            <Ionicons name="chatbubbles-outline" size={24} color={THEME.accent} />
            <Text style={styles.featureTitle}>AI Brainstorming</Text>
            <Text style={styles.featureDesc}>
              Explore ideas with Ava in real-time conversation. She'll challenge your assumptions 
              and help you think deeper.
            </Text>
          </View>
          <View style={styles.featureCard}>
            <Ionicons name="map-outline" size={24} color={THEME.accent} />
            <Text style={styles.featureTitle}>Strategic Planning</Text>
            <Text style={styles.featureDesc}>
              Turn brainstorms into structured action plans with timelines, milestones, and 
              accountability checkpoints.
            </Text>
          </View>
          <View style={styles.featureCard}>
            <Ionicons name="document-text-outline" size={24} color={THEME.accent} />
            <Text style={styles.featureTitle}>Plan Export</Text>
            <Text style={styles.featureDesc}>
              Export your plans to Operate, share with your team, or save to your Library 
              for future reference.
            </Text>
          </View>
        </View>
      </View>
    </HubPageShell>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME.text.primary,
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 15,
    color: THEME.text.muted,
  },
  heroSection: {
    marginBottom: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  heroGradient: {
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  heroContent: {
    alignItems: 'center',
    gap: 16,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.text.primary,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 15,
    color: THEME.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 500,
  },
  heroInputRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 600,
    marginTop: 8,
  },
  heroInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroInputPlaceholder: {
    fontSize: 14,
    color: THEME.text.muted,
  },
  heroStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  heroStartBtnHover: {
    opacity: 0.9,
    transform: [{ scale: 1.02 }],
  },
  heroStartBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.text.primary,
    marginBottom: 16,
  },
  modesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  modeCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 12,
  },
  modeCardSelected: {
    borderColor: THEME.accent,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  modeCardHover: {
    backgroundColor: THEME.surfaceHover,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: THEME.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeIconSelected: {
    backgroundColor: THEME.accent,
  },
  modeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.text.primary,
  },
  modeLabelSelected: {
    color: THEME.accent,
  },
  modeDesc: {
    fontSize: 13,
    color: THEME.text.muted,
    lineHeight: 18,
  },
  featuresGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  featureCard: {
    flex: 1,
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 12,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.text.primary,
  },
  featureDesc: {
    fontSize: 13,
    color: THEME.text.muted,
    lineHeight: 18,
  },
  railContent: {
    gap: 24,
  },
  railTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sessionsList: {
    gap: 10,
  },
  sessionItem: {
    backgroundColor: THEME.surface,
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  sessionItemHover: {
    backgroundColor: THEME.surfaceHover,
  },
  sessionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionMode: {
    backgroundColor: THEME.accentMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sessionModeText: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.accent,
    textTransform: 'uppercase',
  },
  sessionDate: {
    fontSize: 11,
    color: THEME.text.muted,
  },
  sessionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.text.primary,
  },
  sessionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotComplete: {
    backgroundColor: '#34d399',
  },
  statusDotProgress: {
    backgroundColor: '#fbbf24',
  },
  statusText: {
    fontSize: 11,
    color: THEME.text.muted,
  },
  railDivider: {
    height: 1,
    backgroundColor: THEME.border,
  },
  quickStartsList: {
    gap: 10,
  },
  quickStartItem: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: THEME.surface,
    borderRadius: 10,
  },
  quickStartItemHover: {
    backgroundColor: THEME.surfaceHover,
  },
  quickStartIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: THEME.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStartContent: {
    flex: 1,
  },
  quickStartTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.text.primary,
    marginBottom: 2,
  },
  quickStartDesc: {
    fontSize: 11,
    color: THEME.text.muted,
    lineHeight: 14,
  },
});
