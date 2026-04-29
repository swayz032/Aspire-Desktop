/**
 * Front Desk Setup — dev-only demo hub.
 *
 * Cycles through every `*.demo.tsx` for the redesigned Front Desk Setup
 * page (Pass 10 Lane B) via a tab row at the top. Unlinked from the
 * sidebar — accessed manually at `/demo/front-desk-setup`. Used for
 * visual regression and component smoke tests.
 *
 * The hub is wrapped in DesktopShell so the sidebar + header are
 * present, mirroring the production page chrome.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

// Section component demos (this Pass 10 Lane B)
import FrontDeskSetupHeroDemo from '@/components/calls/setup/FrontDeskSetupHero.demo';
import PublicNumberSectionDemo from '@/components/calls/setup/PublicNumberSection.demo';
import CatchCallsSectionDemo from '@/components/calls/setup/CatchCallsSection.demo';
import BusinessHoursSectionDemo from '@/components/calls/setup/BusinessHoursSection.demo';
import RoutingContactsSectionDemo from '@/components/calls/setup/RoutingContactsSection.demo';
import BusyModeSectionDemo from '@/components/calls/setup/BusyModeSection.demo';
import SarahStatusRailDemo from '@/components/calls/setup/SarahStatusRail.demo';

// ---------------------------------------------------------------------------
// Tab registry
// ---------------------------------------------------------------------------

type DemoTab = {
  id: string;
  label: string;
  render: () => React.ReactElement;
};

const TABS: DemoTab[] = [
  { id: 'hero', label: 'Hero', render: () => <FrontDeskSetupHeroDemo /> },
  { id: 'public-number', label: '1 · Public Number', render: () => <PublicNumberSectionDemo /> },
  { id: 'catch-calls', label: '2 · Catch Calls', render: () => <CatchCallsSectionDemo /> },
  { id: 'business-hours', label: '3 · Business Hours', render: () => <BusinessHoursSectionDemo /> },
  { id: 'routing-contacts', label: '4 · Routing Contacts', render: () => <RoutingContactsSectionDemo /> },
  { id: 'busy-mode', label: '5 · When Busy', render: () => <BusyModeSectionDemo /> },
  { id: 'rail', label: 'Status Rail', render: () => <SarahStatusRailDemo /> },
];

// ---------------------------------------------------------------------------
// Hub
// ---------------------------------------------------------------------------

function FrontDeskSetupDemoHub() {
  const [activeId, setActiveId] = useState<string>(TABS[0].id);
  const active = TABS.find((t) => t.id === activeId) ?? TABS[0];

  return (
    <View style={styles.page}>
      <View style={styles.tabBar}>
        <View style={styles.tabBarHeader}>
          <Ionicons name="call-outline" size={16} color={Colors.accent.cyan as string} />
          <Text style={styles.tabBarTitle}>Front Desk Setup · Demo Hub</Text>
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
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={tab.label}
              >
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.body}>
        <PageErrorBoundary pageName={`front-desk-setup-demo-${active.id}`}>
          {active.render()}
        </PageErrorBoundary>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

export default function FrontDeskSetupDemoPage() {
  return (
    <PageErrorBoundary pageName="front-desk-setup-demo-hub">
      <DesktopShell fullBleed>
        <FrontDeskSetupDemoHub />
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
    backgroundColor: '#0a0a0c',
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
    minHeight: 44,
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
  tabLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text.tertiary as string,
  },
  tabLabelActive: {
    color: Colors.accent.cyan as string,
    fontWeight: '600' as const,
  },

  body: {
    flex: 1,
    minHeight: 0,
  },
});
