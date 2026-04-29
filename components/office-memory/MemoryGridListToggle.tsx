/**
 * MemoryGridListToggle — segmented control + ghost Export button.
 *
 * Right-aligned trio sitting opposite the filter chips on the results page.
 * Two segments (grid icon / list icon) — active segment glows blue.
 * The Export button is a ghost outline that fills on hover; the action is
 * stubbed for V1 per plan §13 — clicking just calls `onExport`, the page
 * logs the click and does nothing else.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import type { MemoryViewMode } from './types';

export interface MemoryGridListToggleProps {
  viewMode: MemoryViewMode;
  onChange: (mode: MemoryViewMode) => void;
  onExport: () => void;
}

interface SegmentButtonProps {
  icon: 'grid' | 'list';
  label: string;
  active: boolean;
  onPress: () => void;
}

function SegmentButton({ icon, label, active, onPress }: SegmentButtonProps) {
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={[
        styles.segment,
        active && styles.segmentActive,
        !active && hover && styles.segmentHover,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      testID={`view-toggle-${icon}`}
    >
      <Ionicons
        name={icon === 'grid' ? 'grid' : 'list'}
        size={15}
        color={active ? (Colors.accent.cyan as string) : (Colors.text.tertiary as string)}
      />
    </Pressable>
  );
}

export function MemoryGridListToggle({ viewMode, onChange, onExport }: MemoryGridListToggleProps) {
  const [exportHover, setExportHover] = useState(false);

  return (
    <View style={styles.row}>
      <View style={styles.segmentGroup}>
        <SegmentButton
          icon="grid"
          label="Grid view"
          active={viewMode === 'grid'}
          onPress={() => onChange('grid')}
        />
        <SegmentButton
          icon="list"
          label="List view"
          active={viewMode === 'list'}
          onPress={() => onChange('list')}
        />
      </View>

      <Pressable
        onPress={onExport}
        onHoverIn={() => setExportHover(true)}
        onHoverOut={() => setExportHover(false)}
        style={[styles.exportButton, exportHover && styles.exportButtonHover]}
        accessibilityRole="button"
        accessibilityLabel="Export memories"
        testID="memory-export-button"
      >
        <Ionicons
          name="download-outline"
          size={14}
          color={exportHover ? (Colors.accent.cyan as string) : (Colors.text.secondary as string)}
        />
        <Text style={[styles.exportLabel, exportHover && styles.exportLabelHover]}>Export</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  // segmented control
  segmentGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: Colors.border.default as string,
    borderRadius: BorderRadius.lg,
    padding: 3,
    gap: 2,
  },
  segment: {
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          transition: 'background-color 140ms ease-out',
          cursor: 'pointer',
        } as object)
      : {}),
  } as any,
  segmentHover: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  segmentActive: {
    backgroundColor: Colors.accent.cyanLight as string,
  },

  // export button
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border.default as string,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web'
      ? ({
          transition:
            'border-color 140ms ease-out, background-color 140ms ease-out',
          cursor: 'pointer',
        } as object)
      : {}),
  } as any,
  exportButtonHover: {
    borderColor: Colors.accent.cyan as string,
    backgroundColor: Colors.accent.cyanLight as string,
  },
  exportLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text.secondary as string,
    letterSpacing: 0.2,
  },
  exportLabelHover: {
    color: Colors.accent.cyan as string,
  },
});
