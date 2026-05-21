/**
 * MaterialsSearchBar — full-width search input with closest-store chip and a
 * Pass-H-reserved voice-search slot.
 *
 * Premium design language matches the locked Visuals tab:
 *   - Dark surface, hairline border
 *   - Gold accent on submit affordance
 *   - tabular-nums on drive-time
 *   - 200ms hover/focus transition on web
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  Animated,
  Easing,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
  type PressableStateCallbackType,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ClosestStore } from '@/hooks/useMaterialsSearch';
import {
  useMaterialsSearchContextOptional,
  type MaterialsMode,
} from './MaterialsSearchContext';

// React Native Web extends PressableStateCallbackType with `hovered`.
type WebPressableState = PressableStateCallbackType & { hovered?: boolean };

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  closestStore: ClosestStore | null;
  onClosestStorePress?: () => void;
  isLoading?: boolean;
  placeholder?: string;
}

// CSS properties not present in React Native's ViewStyle/TextStyle types but
// accepted by React Native Web at runtime. Typing them explicitly avoids
// `as any` casts while keeping the values type-checked.
interface WebViewStyle extends ViewStyle {
  transition?: string;
  boxShadow?: string;
}
interface WebTextStyle {
  outlineWidth?: number;
  outlineStyle?: 'none' | 'solid';
}
const WEB_TRANSITION: WebViewStyle =
  Platform.OS === 'web' ? { transition: 'all 200ms ease' } : {};

/**
 * InlineModeToggle — Tool ↔ Supplier 2-segment pill rendered INSIDE the
 * search bar at the LEFT END, before the search icon. Sized to match
 * the search bar's vertical rhythm (height fits the bar — no overhang).
 *
 * Pulls mode from MaterialsSearchContext via the null-tolerant reader so
 * MaterialsSearchBar stays renderable in any tree (a defensive choice,
 * even though in practice the bar only renders inside the provider).
 */
const MODE_SEGMENTS: { value: MaterialsMode; label: string; testID: string }[] = [
  { value: 'tool', label: 'Tool', testID: 'materials-mode-toggle-tool' },
  { value: 'supplier', label: 'Supplier', testID: 'materials-mode-toggle-supplier' },
];

function InlineModeToggle() {
  const ctx = useMaterialsSearchContextOptional();
  if (!ctx) return null;
  const { mode, setMode } = ctx;

  if (Platform.OS === 'web') {
    return (
      <div
        role="radiogroup"
        aria-label="Materials search mode"
        data-testid="materials-mode-toggle"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: 'rgba(0,0,0,0.32)',
          borderRadius: 7,
          padding: 2,
          border: '1px solid rgba(255,255,255,0.08)',
          gap: 1,
          flexShrink: 0,
        }}
      >
        {MODE_SEGMENTS.map((seg) => {
          const active = mode === seg.value;
          return (
            <button
              key={seg.value}
              role="radio"
              aria-checked={active}
              data-testid={seg.testID}
              onClick={() => setMode(seg.value)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 10px',
                borderRadius: 5,
                border: 'none',
                outline: 'none',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: active ? 600 : 500,
                color: active ? '#0A0A0F' : 'rgba(255,255,255,0.55)',
                background: active
                  ? 'linear-gradient(135deg, #ffffff 0%, #e8e8e8 100%)'
                  : 'transparent',
                transition: 'all 180ms ease',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.05px',
                boxShadow: active ? '0 1px 2px rgba(0,0,0,0.25)' : 'none',
                minHeight: 22,
                lineHeight: 1,
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.88)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)';
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }
              }}
            >
              {seg.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <View style={inlineToggleStyles.nativeWrap}>
      {MODE_SEGMENTS.map((seg) => {
        const active = mode === seg.value;
        return (
          <Pressable
            key={seg.value}
            onPress={() => setMode(seg.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${seg.label} mode`}
            style={[
              inlineToggleStyles.nativeSeg,
              active && inlineToggleStyles.nativeSegActive,
            ]}
          >
            <Text
              style={[
                inlineToggleStyles.nativeSegText,
                active && inlineToggleStyles.nativeSegTextActive,
              ]}
            >
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const inlineToggleStyles = StyleSheet.create({
  nativeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderRadius: 7,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 1,
  },
  nativeSeg: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
    minHeight: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nativeSegActive: {
    backgroundColor: '#ffffff',
  },
  nativeSegText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
  },
  nativeSegTextActive: {
    color: '#0A0A0F',
    fontWeight: '600',
  },
});

export function MaterialsSearchBar({
  value,
  onChange,
  onSubmit,
  onClear,
  closestStore,
  onClosestStorePress,
  isLoading = false,
  placeholder = 'Search materials — paint, drywall, romex, shingles…',
}: Props) {
  const [focused, setFocused] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;

  const triggerShake = useCallback(() => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 50, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shake, { toValue: -1, duration: 50, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shake, { toValue: 1, duration: 50, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true, easing: Easing.linear }),
    ]).start();
  }, [shake]);

  const triggerFlash = useCallback(() => {
    flash.setValue(1);
    Animated.timing(flash, {
      toValue: 0,
      duration: 280,
      useNativeDriver: false,
      easing: Easing.out(Easing.quad),
    }).start();
  }, [flash]);

  const handleSubmit = useCallback(() => {
    if (value.trim().length === 0) {
      triggerShake();
      return;
    }
    triggerFlash();
    onSubmit();
  }, [value, onSubmit, triggerShake, triggerFlash]);

  const translateX = shake.interpolate({
    inputRange: [-1, 1],
    outputRange: [-6, 6],
  });

  // Animated gold flash on submit — interpolated border color
  const flashBorderColor: Animated.AnimatedInterpolation<string> = flash.interpolate({
    inputRange: [0, 1],
    outputRange: [
      focused ? 'rgba(251,191,36,0.50)' : 'rgba(255,255,255,0.10)',
      'rgba(251,191,36,1)',
    ],
  });

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.fieldRow,
          focused && styles.fieldRowFocused,
          WEB_TRANSITION,
          { transform: [{ translateX }], borderColor: flashBorderColor },
        ]}
        testID="materials-search-bar"
      >
        <InlineModeToggle />
        <Ionicons name="search" size={16} color="rgba(255,255,255,0.55)" />
        <TextInput
          value={value}
          onChangeText={onChange}
          onSubmitEditing={handleSubmit}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={styles.input as StyleProp<TextStyle>}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search materials"
          testID="materials-search-input"
        />

        {value.length > 0 && (
          <Pressable
            onPress={onClear}
            style={({ pressed }: WebPressableState) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            testID="materials-search-clear"
          >
            <Ionicons name="close-circle" size={15} color="rgba(255,255,255,0.45)" />
          </Pressable>
        )}

        {/* Voice slot — Pass H reservation. Render disabled with tooltip. */}
        <Pressable
          style={({ hovered }: WebPressableState) => [
            styles.iconBtn,
            styles.iconBtnDisabled,
            hovered && styles.iconBtnHovered,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Voice search (coming in Pass H)"
          accessibilityHint="Voice search will be available in a future update"
          disabled
          {...(Platform.OS === 'web'
            ? ({ title: 'Voice search coming in Pass H' } as { title: string })
            : {})}
          testID="materials-voice-button"
        >
          <Ionicons name="mic-outline" size={15} color="rgba(255,255,255,0.30)" />
        </Pressable>

        <Pressable
          onPress={handleSubmit}
          disabled={value.trim().length === 0 || isLoading}
          style={({ hovered, pressed }: WebPressableState) => [
            styles.submitBtn,
            (value.trim().length === 0 || isLoading) && styles.submitBtnDisabled,
            hovered && styles.submitBtnHovered,
            pressed && styles.submitBtnPressed,
            WEB_TRANSITION,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Submit search"
          testID="materials-search-submit"
        >
          <Text style={styles.submitText}>{isLoading ? 'SEARCHING…' : 'SEARCH'}</Text>
        </Pressable>
      </Animated.View>

      {closestStore && (
        <Pressable
          onPress={onClosestStorePress}
          style={({ hovered, pressed }: WebPressableState) => [
            styles.storeChip,
            hovered && styles.storeChipHovered,
            pressed && styles.storeChipPressed,
            WEB_TRANSITION,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Closest store: ${closestStore.name}, ${closestStore.driveMinutes} minutes`}
          testID="materials-closest-store-chip"
        >
          <Ionicons name="location" size={11} color="#fbbf24" />
          <Text style={styles.storeChipLabel}>Closest</Text>
          <Text style={styles.storeChipName} numberOfLines={1}>
            {closestStore.name}
          </Text>
          <View style={styles.storeChipDivider} />
          <Text style={styles.storeChipDrive}>{closestStore.driveMinutes} min</Text>
          {closestStore.inTraffic && (
            <View style={styles.trafficPill}>
              <Text style={styles.trafficPillText}>TRAFFIC</Text>
            </View>
          )}
          <Ionicons name="map-outline" size={11} color="rgba(255,255,255,0.55)" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 10,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 2px rgba(0,0,0,0.25)',
        } as WebViewStyle)
      : {}),
  },
  fieldRowFocused: {
    borderColor: 'rgba(251,191,36,0.55)',
    backgroundColor: 'rgba(251,191,36,0.045)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 0 0 3px rgba(251,191,36,0.14), 0 1px 0 rgba(255,255,255,0.04) inset',
        } as WebViewStyle)
      : {}),
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
    paddingVertical: 0,
    ...(Platform.OS === 'web'
      ? ({ outlineWidth: 0, outlineStyle: 'none' } as WebTextStyle)
      : {}),
  },
  iconBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  iconBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  iconBtnHovered: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  iconBtnDisabled: {
    opacity: 0.6,
  },
  submitBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.42)',
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnHovered: {
    backgroundColor: 'rgba(251,191,36,0.24)',
  },
  submitBtnPressed: {
    backgroundColor: 'rgba(251,191,36,0.30)',
  },
  submitText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: 0.4,
  },

  // Store chip
  storeChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  storeChipHovered: {
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderColor: 'rgba(251,191,36,0.30)',
  },
  storeChipPressed: {
    backgroundColor: 'rgba(251,191,36,0.10)',
  },
  storeChipLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  storeChipName: {
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
    maxWidth: 200,
  },
  storeChipDivider: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  storeChipDrive: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#fbbf24',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },
  trafficPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.28)',
  },
  trafficPillText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: 0.6,
  },
});
