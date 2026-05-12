/**
 * MaterialsModeToggle — Pass E (UI half).
 *
 * Premium 2-state toggle pill matching the EstimateStudioTabBar active-pill
 * aesthetic:
 *   - Active segment: linear-gradient(135deg, #ffffff 0%, #e8e8e8 100%) with
 *     dark text + soft drop shadow.
 *   - Inactive: rgba(255,255,255,0.55) text on transparent.
 *   - Container: rgba(0,0,0,0.25) bg, hairline border rgba(255,255,255,0.06),
 *     borderRadius 10, padding 3.
 *   - 200ms cross-fade on switch (premium-seamless rule).
 *
 * Reads/writes `mode` via MaterialsSearchContext. Renders web-native <button>
 * elements (matches EstimateStudioTabBar — gives us pixel-identical hover/focus
 * states and CSS transitions). Native fallback uses Pressable.
 *
 * a11y:
 *   - role=radiogroup on container, role=radio on each segment.
 *   - accessibilityState.checked reflects current mode.
 *   - Keyboard: Tab focuses, Left/Right arrows toggle (native button focus).
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useMaterialsSearchContext, type MaterialsMode } from './MaterialsSearchContext';

const SEGMENTS: { value: MaterialsMode; label: string; testID: string }[] = [
  { value: 'tool', label: 'Tool', testID: 'materials-mode-toggle-tool' },
  { value: 'supplier', label: 'Supplier', testID: 'materials-mode-toggle-supplier' },
];

export function MaterialsModeToggle() {
  const { mode, setMode } = useMaterialsSearchContext();

  if (Platform.OS === 'web') {
    return (
      <div
        role="radiogroup"
        aria-label="Materials search mode"
        data-testid="materials-mode-toggle"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: 'rgba(0,0,0,0.25)',
          borderRadius: 10,
          padding: 3,
          border: '1px solid rgba(255,255,255,0.06)',
          gap: 1,
          flexShrink: 0,
        }}
      >
        {SEGMENTS.map((seg) => {
          const active = mode === seg.value;
          return (
            <button
              key={seg.value}
              role="radio"
              aria-checked={active}
              data-testid={seg.testID}
              onClick={() => setMode(seg.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 7,
                border: 'none',
                outline: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                color: active ? '#0A0A0F' : 'rgba(255,255,255,0.55)',
                background: active
                  ? 'linear-gradient(135deg, #ffffff 0%, #e8e8e8 100%)'
                  : 'transparent',
                transition: 'all 200ms ease',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.1px',
                boxShadow: active ? '0 1px 3px rgba(0,0,0,0.25)' : 'none',
                minHeight: 28,
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)';
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = active
                  ? '0 1px 3px rgba(0,0,0,0.25), 0 0 0 2px rgba(251,191,36,0.45)'
                  : '0 0 0 2px rgba(251,191,36,0.45)';
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = active
                  ? '0 1px 3px rgba(0,0,0,0.25)'
                  : 'none';
              }}
            >
              {seg.label}
            </button>
          );
        })}
      </div>
    );
  }

  // Native fallback
  return (
    <View
      style={styles.nativeWrap}
      accessibilityRole="radiogroup"
      accessibilityLabel="Materials search mode"
      testID="materials-mode-toggle"
    >
      {SEGMENTS.map((seg) => {
        const active = mode === seg.value;
        return (
          <Pressable
            key={seg.value}
            onPress={() => setMode(seg.value)}
            accessibilityRole="radio"
            accessibilityLabel={`${seg.label} mode`}
            accessibilityState={{ checked: active }}
            testID={seg.testID}
            style={[styles.nativeSeg, active && styles.nativeSegActive]}
          >
            <Text style={[styles.nativeText, active && styles.nativeTextActive]}>
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nativeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 1,
    alignSelf: 'flex-start',
  },
  nativeSeg: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 7,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativeSegActive: {
    backgroundColor: '#ffffff',
  },
  nativeText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.1,
  },
  nativeTextActive: {
    color: '#0A0A0F',
    fontWeight: '600',
  },
});
