/**
 * CanvasCardSwitcher — Wave 6A shared shell.
 *
 * Hosts exactly ONE big "canvas card" at a time. When `activeCardKey`
 * changes, the previously-active card cross-fades out and the new one
 * fades in over 200ms (CLS=0 — the host card slot is always reserved
 * full-height so layout never shifts).
 *
 * Used by:
 *   - Wave 6A: PlansPhotosTab (Upload / Sheets / Disciplines / Revisions).
 *   - Wave 7+: Scope, Takeoff tabs follow the same shell pattern.
 *
 * Premium UX (per feedback_premium_seamless):
 *   - CLS = 0
 *   - 200ms cross-fade between cards
 *   - Identical card geometry per card slot (consumers control inner content)
 *
 * Law #7: render layer only — no autonomous decisions.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface Props<K extends string> {
  /** Which card is currently visible. */
  activeCardKey: K;
  /** Map of card key → ReactNode. Unknown keys render nothing (fail-closed). */
  cards: Record<K, React.ReactNode>;
  /** Cross-fade duration in ms (default 200, matches premium-seamless lock). */
  fadeMs?: number;
  testID?: string;
}

export function CanvasCardSwitcher<K extends string>({
  activeCardKey,
  cards,
  fadeMs = 200,
  testID,
}: Props<K>): React.ReactElement {
  const [displayedKey, setDisplayedKey] = useState<K>(activeCardKey);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (activeCardKey === displayedKey) return;

    // Fade out current → swap → fade in new.
    Animated.timing(opacity, {
      toValue: 0,
      duration: fadeMs / 2,
      useNativeDriver: true,
    }).start(() => {
      setDisplayedKey(activeCardKey);
      Animated.timing(opacity, {
        toValue: 1,
        duration: fadeMs / 2,
        useNativeDriver: true,
      }).start();
    });
  }, [activeCardKey, displayedKey, fadeMs, opacity]);

  const visibleCard = cards[displayedKey] ?? null;

  return (
    <View style={styles.host} testID={testID ?? 'canvas-card-switcher'}>
      <Animated.View style={[styles.cardSlot, { opacity }]}>{visibleCard}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    minHeight: 320,
  },
  cardSlot: {
    flex: 1,
  },
});
