import React, { useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import {
  TimRailTabSwitcher,
  type TimRailTabId,
} from './tim-rail/TimRailTabSwitcher';
import { TimRailHeader } from './tim-rail/TimRailHeader';
import { TimRailChatStub } from './tim-rail/TimRailChatStub';
import { TimRailFileDrop } from './tim-rail/TimRailFileDrop';
import { TimRailVoiceButton } from './tim-rail/TimRailVoiceButton';
import { TimRailContextTab } from './tim-rail/TimRailContextTab';
import { TimRailControlsTab } from './tim-rail/TimRailControlsTab';
import { useProjectAddress } from '@/hooks/useProjectAddress';
import { usePropertyData } from '@/hooks/usePropertyData';

// At/below this width the in-canvas chrome (Estimate Studio title, address
// bar, studio tabs) is hoisted into the Tim Rail's Controls tab. The rail
// MUST default to Controls there or the user lands on Assistant with no
// search bar / address bar visible anywhere = the 'nothing works' bug.
// Bumped 1280 → 1500 so 1366/1440 laptops get Controls-first UX.
const LAPTOP_OR_TABLET_BREAKPOINT = 1500;

// Tim Rail tabs: Assistant | Context | Controls.
// The Controls tab owns the studio chrome (address bar + studio tabs +
// quick actions) on laptops + tablets — see TimRailControlsTab.tsx and
// EstimateStudioShell.tsx for the chrome-hoist behavior.
//
// Aspire Law #1 + #7: this rail is a render layer; no autonomous decisions
// or state mutations beyond UI state.

export function TimRailContainer() {
  const { width } = useWindowDimensions();
  const railWidth = width < 1100 ? 272 : width < LAPTOP_OR_TABLET_BREAKPOINT ? 288 : 320;
  // 2026-05-18 lock: chrome is hoisted at ALL widths >= 768 (canvas = only
  // blueprints), so the rail defaults to Controls everywhere. The user can
  // still switch to Context / Assistant manually.
  const [activeTab, setActiveTab] = useState<TimRailTabId>('controls');
  const { address } = useProjectAddress();
  const propertyData = usePropertyData(address);

  return (
    <View style={[styles.zone, { width: railWidth }]} testID="estimate-studio-tim-zone">
      <TimRailHeader />
      <TimRailTabSwitcher active={activeTab} onChange={setActiveTab} />
      <View style={styles.body}>
        {activeTab === 'assistant' && <TimRailChatStub />}
        {activeTab === 'context' && (
          <TimRailContextTab
            data={propertyData.data}
            loading={propertyData.status === 'loading' || propertyData.status === 'idle'}
            error={propertyData.error ?? undefined}
            onRetry={propertyData.retry}
          />
        )}
        {activeTab === 'controls' && <TimRailControlsTab />}
      </View>
      {/* File drop + voice composer belong to the Assistant tab only.
          Showing them on Context / Activity (a) was off-spec and
          (b) squeezed the Context body so PROPERTY FACTS got clipped
          at the bottom. */}
      {activeTab === 'assistant' && (
        <>
          <TimRailFileDrop />
          <TimRailVoiceButton />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    width: 320,
    flexShrink: 0,
    alignSelf: 'stretch',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.06)',
    // Constrain to parent height so the body's ScrollView can scroll
    // INSIDE the rail instead of stretching the whole page.
    overflow: 'hidden',
    minHeight: 0,
  },
  body: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
});
