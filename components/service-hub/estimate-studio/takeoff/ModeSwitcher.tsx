/**
 * ModeSwitcher — Wave 8.
 *
 * Top-of-canvas mode pills for the Takeoff tab:
 *   - Commercial Blueprint (default, enabled)
 *   - Residential Blueprint (enabled, simpler symbol set)
 *   - Smart Room Reconstruction (Phase 8 — disabled badge)
 *   - Roofing Mode (Phase 8 — disabled badge)
 *
 * The premium flat-pill aesthetic matches BottomChipStrip but the mode
 * switcher lives at the TOP of the canvas to read as a mode selector,
 * not a card selector.
 */
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type TakeoffMode = 'commercial' | 'residential' | 'smart-room' | 'roofing';

interface Mode {
  key: TakeoffMode;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
  badge?: string;
}

const MODES: Mode[] = [
  { key: 'commercial', label: 'Commercial Blueprint', icon: 'business-outline' },
  { key: 'residential', label: 'Residential Blueprint', icon: 'home-outline' },
  {
    key: 'smart-room',
    label: 'Smart Room',
    icon: 'cube-outline',
    disabled: true,
    badge: 'Phase 8',
  },
  {
    key: 'roofing',
    label: 'Roofing',
    icon: 'umbrella-outline',
    disabled: true,
    badge: 'Phase 8',
  },
];

interface Props {
  active: TakeoffMode;
  onChange: (mode: TakeoffMode) => void;
  testID?: string;
}

export function ModeSwitcher({ active, onChange, testID }: Props): React.ReactElement {
  return (
    <View style={styles.host} testID={testID ?? 'takeoff-mode-switcher'}>
      {MODES.map((mode) => {
        const isActive = mode.key === active;
        return (
          <Pressable
            key={mode.key}
            disabled={mode.disabled}
            onPress={() => !mode.disabled && onChange(mode.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive, disabled: !!mode.disabled }}
            accessibilityLabel={`${mode.label}${mode.badge ? ` — ${mode.badge}` : ''}`}
            testID={`takeoff-mode-${mode.key}`}
            style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
              styles.pill,
              isActive && styles.pillActive,
              mode.disabled && styles.pillDisabled,
              hovered && !isActive && !mode.disabled && styles.pillHover,
              pressed && !mode.disabled && styles.pillPressed,
            ]}
          >
            <Ionicons
              name={mode.icon}
              size={14}
              color={
                mode.disabled
                  ? 'rgba(255,255,255,0.30)'
                  : isActive
                    ? '#fbbf24'
                    : 'rgba(255,255,255,0.75)'
              }
            />
            <Text
              style={[
                styles.label,
                isActive && styles.labelActive,
                mode.disabled && styles.labelDisabled,
              ]}
              numberOfLines={1}
            >
              {mode.label}
            </Text>
            {mode.badge ? (
              <View style={styles.badgeWrap} testID={`takeoff-mode-${mode.key}-badge`}>
                <Text style={styles.badgeText}>{mode.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 2,
    paddingVertical: 2,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    ...(Platform.OS === 'web'
      ? ({ transition: 'background-color 150ms ease, border-color 150ms ease' } as any)
      : {}),
  },
  pillActive: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderColor: 'rgba(251,191,36,0.55)',
  },
  pillHover: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  pillPressed: {
    opacity: 0.85,
  },
  pillDisabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: -0.1,
  },
  labelActive: {
    color: '#fbbf24',
  },
  labelDisabled: {
    color: 'rgba(255,255,255,0.48)',
  },
  badgeWrap: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  badgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
