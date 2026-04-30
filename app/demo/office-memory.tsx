/**
 * Office Memory — dev-only demo hub.
 *
 * Cycles through every `*.demo.tsx` for the Office Memory engine via a tab
 * row at the top. Unlinked from the sidebar — accessed manually at
 * `/demo/office-memory`. Used for visual regression and component smoke tests.
 *
 * Tabs that depend on a parallel-agent component (Lane E detail page sub-
 * tiles) render a placeholder until that agent ships their files.
 *
 * The hub is wrapped in DesktopShell so the sidebar + header are present.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

// Lane B/C demos (already shipped)
import MemoryEngineHeroDemo from '@/components/office-memory/MemoryEngineHero.demo';
import LedAmbientSearchBarDemo from '@/components/office-memory/LedAmbientSearchBar.demo';
import MemoryCardDemo from '@/components/office-memory/MemoryCard.demo';
import MemoryCardGlowHaloDemo from '@/components/office-memory/MemoryCardGlowHalo.demo';

// Lane D demos (this PR)
import { MemoryResultsGridDemo } from '@/components/office-memory/MemoryResultsGrid.demo';
import { MemoryFilterBarDemo } from '@/components/office-memory/MemoryFilterBar.demo';
import { MemoryGridListToggleDemo } from '@/components/office-memory/MemoryGridListToggle.demo';

// Lane E (Pass 15) — per-type detail components + fixtures
import {
  MemoryDetailHeader as MemoryDetailHeader15,
  MemoryDetailRightRail,
  MemoryDetailNote,
  MemoryDetailDocument,
  MemoryDetailStrategy,
  MemoryDetailResearch,
  MemoryDetailTask,
  MemoryDetailSummary as MemoryDetailSummaryComp,
  MemoryDetailTranscript,
  MemoryDetailSession,
} from '@/components/office-memory/details';
import {
  MOCK_DETAIL_NOTE,
  MOCK_DETAIL_DOCUMENT,
  MOCK_DETAIL_STRATEGY,
  MOCK_DETAIL_RESEARCH,
  MOCK_DETAIL_TASK,
  MOCK_DETAIL_SUMMARY,
  MOCK_DETAIL_TRANSCRIPT,
  MOCK_DETAIL_SESSION,
} from '@/components/office-memory/fixtures';
import type { MemoryDetail } from '@/components/office-memory/types';

// ---------------------------------------------------------------------------
// Tab registry
// ---------------------------------------------------------------------------

type DemoTab = {
  id: string;
  label: string;
  /** Render the demo body. Wrap parallel-agent placeholders in a function. */
  render: () => React.ReactElement;
  /** True if this demo belongs to another agent and may not exist yet. */
  pending?: boolean;
};

const TABS: DemoTab[] = [
  { id: 'hero', label: 'Hero', render: () => <MemoryEngineHeroDemo /> },
  { id: 'led', label: 'LED Search', render: () => <LedAmbientSearchBarDemo /> },
  { id: 'card', label: 'Card', render: () => <MemoryCardDemo /> },
  { id: 'halo', label: 'Card Halo', render: () => <MemoryCardGlowHaloDemo /> },
  { id: 'grid', label: 'Results Grid', render: () => <MemoryResultsGridDemo /> },
  { id: 'filters', label: 'Filter Bar', render: () => <MemoryFilterBarDemo /> },
  { id: 'toggle', label: 'Toggle', render: () => <MemoryGridListToggleDemo /> },
  // ----- Pass 15 Lane E — per-type detail components rendered with full
  // chrome (header + center column + right rail) so the demo hub doubles as
  // a visual regression surface.
  { id: 'detail-note',       label: 'Detail · Note',       render: () => <DetailHarness fixture={MOCK_DETAIL_NOTE}      Body={MemoryDetailNote} /> },
  { id: 'detail-document',   label: 'Detail · Document',   render: () => <DetailHarness fixture={MOCK_DETAIL_DOCUMENT}  Body={MemoryDetailDocument} /> },
  { id: 'detail-strategy',   label: 'Detail · Strategy',   render: () => <DetailHarness fixture={MOCK_DETAIL_STRATEGY}  Body={MemoryDetailStrategy} /> },
  { id: 'detail-research',   label: 'Detail · Research',   render: () => <DetailHarness fixture={MOCK_DETAIL_RESEARCH}  Body={MemoryDetailResearch} /> },
  { id: 'detail-task',       label: 'Detail · Task',       render: () => <DetailHarness fixture={MOCK_DETAIL_TASK}      Body={MemoryDetailTask} /> },
  { id: 'detail-summary',    label: 'Detail · Summary',    render: () => <DetailHarness fixture={MOCK_DETAIL_SUMMARY}   Body={MemoryDetailSummaryComp} /> },
  { id: 'detail-transcript', label: 'Detail · Transcript', render: () => <DetailHarness fixture={MOCK_DETAIL_TRANSCRIPT} Body={MemoryDetailTranscript} /> },
  { id: 'detail-session',    label: 'Detail · Session',    render: () => <DetailHarness fixture={MOCK_DETAIL_SESSION}   Body={MemoryDetailSession} /> },
];

// ---------------------------------------------------------------------------
// Detail harness — renders Header + Body + RightRail like the live page.
// ---------------------------------------------------------------------------

function DetailHarness({
  fixture,
  Body,
}: {
  fixture: MemoryDetail;
  Body: React.ComponentType<{ memory: MemoryDetail }>;
}) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.memory.pageBackground as string }}
      contentContainerStyle={{
        paddingHorizontal: 32,
        paddingVertical: 24,
        paddingBottom: 64,
        maxWidth: 1280,
        alignSelf: 'center',
        width: '100%',
      }}
      showsVerticalScrollIndicator={false}
    >
      <MemoryDetailHeader15 memory={fixture} onBack={() => {}} />
      <View
        style={
          (Platform.OS === 'web'
            ? ({
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 360px',
                gap: 24,
                alignItems: 'start',
              } as object)
            : { gap: 24 }) as object
        }
      >
        <View style={{ gap: 16, minWidth: 0 } as object}>
          <Body memory={fixture} />
        </View>
        <View style={{ gap: 16, minWidth: 0 } as object}>
          <MemoryDetailRightRail memory={fixture} />
        </View>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Pending demo placeholder (for Lane E components)
// ---------------------------------------------------------------------------

function Pending({ name, lane }: { name: string; lane: string }) {
  return (
    <View style={pendingStyles.wrap}>
      <View style={pendingStyles.iconBubble}>
        <Ionicons name="construct-outline" size={28} color={Colors.text.tertiary as string} />
      </View>
      <Text style={pendingStyles.title}>{name}</Text>
      <Text style={pendingStyles.body}>
        This demo will appear when Lane {lane} ships{' '}
        <Text style={pendingStyles.code}>{name}.demo.tsx</Text>.
      </Text>
      <Text style={pendingStyles.subtle}>
        Until then, the hub registry tracks the slot so we know what's missing.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Demo hub
// ---------------------------------------------------------------------------

function OfficeMemoryDemoHub() {
  const [activeId, setActiveId] = useState<string>(TABS[0].id);
  const active = TABS.find((t) => t.id === activeId) ?? TABS[0];

  return (
    <View style={styles.page}>
      <View style={styles.tabBar}>
        <View style={styles.tabBarHeader}>
          <Ionicons name="library-outline" size={16} color={Colors.accent.cyan as string} />
          <Text style={styles.tabBarTitle}>Office Memory · Demo Hub</Text>
          <Text style={styles.tabBarSub}>dev-only</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {TABS.map((tab) => {
            const isActive = tab.id === activeId;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveId(tab.id)}
                style={({ hovered }: { hovered?: boolean }) => [
                  styles.tab,
                  hovered && !isActive && styles.tabHover,
                  isActive && styles.tabActive,
                  tab.pending && styles.tabPending,
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    isActive && styles.tabLabelActive,
                    tab.pending && styles.tabLabelPending,
                  ]}
                >
                  {tab.label}
                </Text>
                {tab.pending ? (
                  <View style={styles.pendingDot} />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.body}>
        <PageErrorBoundary pageName={`office-memory-demo-${active.id}`}>
          {active.render()}
        </PageErrorBoundary>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

export default function OfficeMemoryDemoPage() {
  return (
    <PageErrorBoundary pageName="office-memory-demo-hub">
      <DesktopShell fullBleed>
        <OfficeMemoryDemoHub />
      </DesktopShell>
    </PageErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.memory.pageBackground as string,
    ...(Platform.OS === 'web' ? ({ height: '100%', minHeight: 0 } as object) : {}),
  } as any,

  tabBar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle as string,
    backgroundColor: 'rgba(10,10,12,0.8)',
  },
  tabBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tabBarTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text.primary as string,
    letterSpacing: 0.4,
  },
  tabBarSub: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.text.muted as string,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    marginLeft: 4,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 4,
    paddingBottom: 0,
  },

  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    ...(Platform.OS === 'web'
      ? ({
          transition: 'border-color 140ms ease-out, color 140ms ease-out',
          cursor: 'pointer',
        } as object)
      : {}),
  } as any,
  tabHover: {
    borderBottomColor: Colors.border.strong as string,
  },
  tabActive: {
    borderBottomColor: Colors.accent.cyan as string,
  },
  tabPending: {
    opacity: 0.65,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text.tertiary as string,
  },
  tabLabelActive: {
    color: Colors.accent.cyan as string,
    fontWeight: '600' as const,
  },
  tabLabelPending: {
    fontStyle: 'italic',
    color: Colors.text.muted as string,
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.text.muted as string,
  },

  body: {
    flex: 1,
    minHeight: 0,
  },
});

const pendingStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    gap: 14,
  },
  iconBubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: Colors.border.default as string,
  },
  title: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text.primary as string,
  },
  body: {
    fontSize: 13,
    color: Colors.text.tertiary as string,
    textAlign: 'center',
    maxWidth: 460,
  },
  code: {
    fontFamily: 'monospace',
    color: Colors.text.secondary as string,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subtle: {
    fontSize: 11,
    color: Colors.text.muted as string,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
