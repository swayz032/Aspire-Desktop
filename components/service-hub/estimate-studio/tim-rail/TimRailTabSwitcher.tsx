import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export type TimRailTabId = 'controls' | 'context' | 'assistant';

const tabs: { id: TimRailTabId; label: string }[] = [
  { id: 'controls',  label: 'Controls' },
  { id: 'context',   label: 'Context' },
  { id: 'assistant', label: 'Assistant' },
];

interface TimRailTabSwitcherProps {
  /** When provided, the switcher operates in controlled mode (parent owns
   *  state). When omitted it falls back to internal state for backwards
   *  compatibility with the Phase 2 visual-only stub. */
  active?: TimRailTabId;
  onChange?: (id: TimRailTabId) => void;
}

export function TimRailTabSwitcher({ active, onChange }: TimRailTabSwitcherProps) {
  // Backwards-compat internal state when used without parent control.
  const [internalActive, setInternalActive] = React.useState<TimRailTabId>('assistant');
  const isControlled = active !== undefined;
  const current = isControlled ? active! : internalActive;

  const handlePress = (id: TimRailTabId) => {
    if (!isControlled) setInternalActive(id);
    onChange?.(id);
  };

  return (
    <View style={styles.container} testID="tim-rail-tab-switcher">
      {tabs.map((tab) => {
        const isActive = current === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            activeOpacity={0.85}
            onPress={() => handlePress(tab.id)}
            style={styles.tab}
            testID={`tim-rail-tab-${tab.id}`}
          >
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {isActive && <View style={styles.underline} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 16,
  },
  tab: {
    paddingVertical: 8,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: -0.1,
  },
  tabLabelActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  underline: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#fbbf24',
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
});
