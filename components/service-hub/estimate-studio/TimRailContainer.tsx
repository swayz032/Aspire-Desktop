import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  TimRailTabSwitcher,
  type TimRailTabId,
} from './tim-rail/TimRailTabSwitcher';
import { useProjectAddress } from '@/hooks/useProjectAddress';
import { usePropertyData } from '@/hooks/usePropertyData';

// Pass 3.2 wires the tab switcher to actually swap content. Pass 3.3 will
// replace the Activity placeholder with a real activity stream and replace
// the chat stub with the property-aware Tim assistant.
//
// Several Phase 2 sibling components (TimRailHeader / TimRailChatStub /
// TimRailFileDrop / TimRailVoiceButton) and the Pass 3.2 Context tab
// component are being authored on parallel branches by `uiux-implementer`.
// We resolve them lazily with require() so this file compiles + renders
// graceful placeholders if any sibling lands a few minutes later.
//
// Aspire Law #1 + #7: this rail is a render layer; no autonomous decisions
// or state mutations beyond UI state.

function tryRequire<T = any>(path: string): T | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(path) as T;
  } catch {
    return null;
  }
}

const TimRailHeader: React.ComponentType<any> | null =
  tryRequire('./tim-rail/TimRailHeader')?.TimRailHeader ?? null;
const TimRailChatStub: React.ComponentType<any> | null =
  tryRequire('./tim-rail/TimRailChatStub')?.TimRailChatStub ?? null;
const TimRailFileDrop: React.ComponentType<any> | null =
  tryRequire('./tim-rail/TimRailFileDrop')?.TimRailFileDrop ?? null;
const TimRailVoiceButton: React.ComponentType<any> | null =
  tryRequire('./tim-rail/TimRailVoiceButton')?.TimRailVoiceButton ?? null;

export function TimRailContainer() {
  const [activeTab, setActiveTab] = useState<TimRailTabId>('assistant');
  const { address } = useProjectAddress();
  const propertyData = usePropertyData(address);

  return (
    <View style={styles.zone} testID="estimate-studio-tim-zone">
      {TimRailHeader ? <TimRailHeader /> : <HeaderPlaceholder />}
      <TimRailTabSwitcher active={activeTab} onChange={setActiveTab} />
      <View style={styles.body}>
        {activeTab === 'assistant' &&
          (TimRailChatStub ? <TimRailChatStub /> : <AssistantPlaceholder />)}
        {activeTab === 'context' && (
          <TimRailContextTabHost propertyData={propertyData} />
        )}
        {activeTab === 'activity' && <ActivityPlaceholder />}
      </View>
      {TimRailFileDrop ? <TimRailFileDrop /> : null}
      {TimRailVoiceButton ? <TimRailVoiceButton /> : null}
    </View>
  );
}

function TimRailContextTabHost({
  propertyData,
}: {
  propertyData: ReturnType<typeof usePropertyData>;
}) {
  const TimRailContextTab: React.ComponentType<any> | null =
    tryRequire('./tim-rail/TimRailContextTab')?.TimRailContextTab ?? null;

  if (TimRailContextTab) {
    return (
      <TimRailContextTab
        data={propertyData.data}
        status={propertyData.status}
      />
    );
  }
  return <ContextPlaceholder />;
}

function HeaderPlaceholder() {
  return (
    <View style={styles.header} testID="tim-rail-header-placeholder">
      <Text style={styles.headerTitle}>Tim</Text>
      <Text style={styles.headerSubtitle}>Private Beta</Text>
    </View>
  );
}

function AssistantPlaceholder() {
  return (
    <View style={styles.placeholder} testID="tim-rail-assistant-placeholder">
      <Text style={styles.placeholderTitle}>Assistant</Text>
      <Text style={styles.placeholderBody}>Tim is connecting…</Text>
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

function ContextPlaceholder() {
  return (
    <View style={styles.placeholder} testID="tim-rail-context-placeholder">
      <Text style={styles.placeholderTitle}>Context</Text>
      <Text style={styles.placeholderBody}>
        Property context loads from the address bar.
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
  },
  body: {
    flex: 1,
    minHeight: 360,
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
