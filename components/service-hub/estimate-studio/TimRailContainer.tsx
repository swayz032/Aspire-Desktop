import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  TimRailTabSwitcher,
  type TimRailTabId,
} from './tim-rail/TimRailTabSwitcher';
import { TimRailHeader } from './tim-rail/TimRailHeader';
import { TimRailChatStub } from './tim-rail/TimRailChatStub';
import { TimRailFileDrop } from './tim-rail/TimRailFileDrop';
import { TimRailVoiceButton } from './tim-rail/TimRailVoiceButton';
import { TimRailContextTab } from './tim-rail/TimRailContextTab';
import { useProjectAddress } from '@/hooks/useProjectAddress';
import { usePropertyData } from '@/hooks/usePropertyData';

// Pass 3.2 wires the tab switcher to actually swap content. Pass 3.3 will
// replace the Activity placeholder with a real activity stream and replace
// the chat stub with the property-aware Tim assistant.
//
// Aspire Law #1 + #7: this rail is a render layer; no autonomous decisions
// or state mutations beyond UI state.

export function TimRailContainer() {
  const [activeTab, setActiveTab] = useState<TimRailTabId>('assistant');
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
        {activeTab === 'activity' && <ActivityPlaceholder />}
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

function ActivityPlaceholder() {
  return (
    <View style={styles.placeholder} testID="tim-rail-activity-placeholder">
      <Text style={styles.placeholderTitle}>Activity</Text>
      <Text style={styles.placeholderBody}>
        Activity log lands in Pass 3.3.
      </Text>
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
  header: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 2,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
  },
  placeholder: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 24,
    gap: 6,
  },
  placeholderTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.1,
  },
  placeholderBody: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 18,
  },
});
