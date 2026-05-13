import React, { useEffect, useState } from 'react';
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
  const isLaptopOrTablet = width < LAPTOP_OR_TABLET_BREAKPOINT;
  // Default to Controls on laptop/tablet (chrome is hoisted there, the
  // user MUST land on it or there's no search/address bar visible) and
  // Assistant on desktop (chrome stays in-canvas, Assistant is the home).
  const [activeTab, setActiveTab] = useState<TimRailTabId>(
    isLaptopOrTablet ? 'controls' : 'assistant',
  );
  // If the viewport crosses the breakpoint mid-session (rare, but happens
  // on resize / window-snap), re-anchor to the appropriate default UNLESS
  // the user has already navigated elsewhere intentionally.
  useEffect(() => {
    setActiveTab((prev) => {
      if (isLaptopOrTablet && prev === 'assistant') return 'controls';
      if (!isLaptopOrTablet && prev === 'controls') return 'assistant';
      return prev;
    });
  }, [isLaptopOrTablet]);
  const { address } = useProjectAddress();
  const propertyData = usePropertyData(address);

  return (
    <View style={styles.zone} testID="estimate-studio-tim-zone">
      <TimRailHeader />
      <TimRailTabSwitcher active={activeTab} onChange={setActiveTab} />
      <View style={styles.body}>
        {activeTab === 'assistant' && <TimRailChatStub />}
        {activeTab === 'context' && (
          <TimRailContextTab data={propertyData.data} status={propertyData.status} />
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
