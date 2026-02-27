import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Canvas,
} from '@/constants/tokens';
import {
  useImmersion,
  setCommandPaletteOpen,
  setStageOpen,
} from '@/lib/immersionStore';
import {
  searchVerbs,
  getAllTiles,
  type TileEntry,
  type TileVerb,
} from '@/lib/tileManifest';
import { emitCanvasEvent } from '@/lib/canvasTelemetry';
import { playSound } from '@/lib/soundManager';
import { Badge } from '@/components/ui/Badge';

// ---------------------------------------------------------------------------
// Web keyframes (injected once)
// ---------------------------------------------------------------------------

const KEYFRAME_ID = 'aspire-palette-keyframes';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  if (!document.getElementById(KEYFRAME_ID)) {
    const style = document.createElement('style');
    style.id = KEYFRAME_ID;
    style.textContent = `
      @keyframes paletteSlideDown {
        from { opacity: 0; transform: translateY(-12px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes paletteRowFade {
        from { opacity: 0; transform: translateX(-6px); }
        to { opacity: 1; transform: translateX(0); }
      }
      .palette-container {
        animation: paletteSlideDown 200ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }
      .palette-row {
        animation: paletteRowFade 150ms ease-out forwards;
        opacity: 0;
      }
      .palette-row-selected {
        background: rgba(59,130,246,0.08) !important;
        box-shadow: inset 0 0 0 1px rgba(59,130,246,0.15), 0 0 12px rgba(59,130,246,0.06);
      }
      .palette-row:hover {
        background: rgba(255,255,255,0.03);
      }
    `;
    document.head.appendChild(style);
  }
}

// ---------------------------------------------------------------------------
// Risk tier config
// ---------------------------------------------------------------------------

const RISK_VARIANT: Record<string, 'success' | 'warning' | 'error'> = {
  green: 'success',
  yellow: 'warning',
  red: 'error',
};

const RISK_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  green: 'shield-checkmark-outline',
  yellow: 'alert-circle-outline',
  red: 'warning-outline',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResult {
  tile: TileEntry;
  verb: TileVerb;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wc(cls: string): ViewStyle {
  if (Platform.OS !== 'web') return {};
  return { className: cls } as unknown as ViewStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette(): React.ReactElement | null {
  const { commandPaletteOpen, mode } = useImmersion();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<TextInput>(null);

  // Animation
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const isVisible = useRef(false);

  // Search results — synchronous, no debounce needed for 6 tiles
  const results: SearchResult[] = useMemo(() => {
    if (!query.trim()) {
      // Show all verbs when query is empty (browsable)
      const all: SearchResult[] = [];
      for (const tile of getAllTiles()) {
        for (const verb of tile.verbs) {
          all.push({ tile, verb });
        }
      }
      return all;
    }
    return searchVerbs(query);
  }, [query]);

  // Group results by desk
  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const r of results) {
      const key = r.tile.desk;
      const arr = map.get(key);
      if (arr) {
        arr.push(r);
      } else {
        map.set(key, [r]);
      }
    }
    return map;
  }, [results]);

  // Flat list for arrow key navigation
  const flatResults = results;

  const shouldShow = commandPaletteOpen && mode !== 'off';

  // ---------------------------------------------------------------------------
  // Enter / exit animation
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (shouldShow && !isVisible.current) {
      isVisible.current = true;
      playSound('palette_open');

      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: Canvas.motion.palette,
        useNativeDriver: true,
      }).start();

      // Auto-focus input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else if (!shouldShow && isVisible.current) {
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }).start(() => {
        isVisible.current = false;
        setQuery('');
        setSelectedIndex(0);
      });
    }
  }, [shouldShow, opacityAnim]);

  // ---------------------------------------------------------------------------
  // Keyboard navigation
  // ---------------------------------------------------------------------------

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setCommandPaletteOpen(false);
      setStageOpen(true, result.tile.id);
      emitCanvasEvent('stage_open', {
        tileId: result.tile.id,
        verbId: result.verb.id,
        source: 'command_palette',
      });
    },
    [],
  );

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<TextInput>) => {
      const key = (e as unknown as { nativeEvent: { key: string } }).nativeEvent?.key ?? '';

      if (key === 'ArrowDown' || e.nativeEvent?.key === 'ArrowDown') {
        e.preventDefault?.();
        setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
        return;
      }
      if (key === 'ArrowUp' || e.nativeEvent?.key === 'ArrowUp') {
        e.preventDefault?.();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (key === 'Enter' || e.nativeEvent?.key === 'Enter') {
        e.preventDefault?.();
        if (flatResults[selectedIndex]) {
          handleSelect(flatResults[selectedIndex]);
        }
        return;
      }
    },
    [flatResults, selectedIndex, handleSelect],
  );

  // Web keydown handler for arrow keys (TextInput onKeyPress doesn't fire for ArrowUp/Down on web)
  useEffect(() => {
    if (Platform.OS !== 'web' || !shouldShow) return;

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setSelectedIndex((current) => {
          if (flatResults[current]) {
            handleSelect(flatResults[current]);
          }
          return current;
        });
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [shouldShow, flatResults, handleSelect]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // ---------------------------------------------------------------------------
  // Early return
  // ---------------------------------------------------------------------------

  if (!shouldShow && !isVisible.current) return null;

  // ---------------------------------------------------------------------------
  // Web-only styles
  // ---------------------------------------------------------------------------

  const webContainerGlass: ViewStyle =
    Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(32px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(32px) saturate(1.4)',
          boxShadow: '0 16px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        } as unknown as ViewStyle)
      : {};

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  let flatIndex = 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={shouldShow ? 'auto' : 'none'}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setCommandPaletteOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close command palette"
        />
      </Animated.View>

      {/* Palette container */}
      <Animated.View
        style={[
          styles.container,
          webContainerGlass,
          wc('palette-container'),
          { opacity: opacityAnim },
        ]}
        accessibilityRole="none"
        accessibilityLabel="Command palette"
      >
        {/* Search input */}
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={Colors.text.muted} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search actions..."
            placeholderTextColor={Colors.text.muted}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search command palette"
            {...(Platform.OS === 'web'
              ? { outlineStyle: 'none' } as Record<string, unknown>
              : {})}
          />
          <View style={styles.shortcutHint}>
            <Text style={styles.shortcutText}>esc</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Results */}
        <View style={styles.resultsList} accessibilityRole="none">
          {results.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={24} color={Colors.border.default} />
              <Text style={styles.emptyText}>No matching actions</Text>
            </View>
          ) : (
            Array.from(grouped.entries()).map(([desk, items]) => {
              const group = (
                <View key={desk}>
                  {/* Desk heading */}
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupLabel}>{desk.toUpperCase()}</Text>
                  </View>

                  {/* Verb rows */}
                  {items.map((item) => {
                    const idx = flatIndex;
                    flatIndex += 1;
                    const isSelected = idx === selectedIndex;
                    const staggerDelay = Math.min(idx * Canvas.motion.stagger, 400);

                    return (
                      <Pressable
                        key={`${item.tile.id}-${item.verb.id}`}
                        style={[
                          styles.resultRow,
                          isSelected && styles.resultRowSelected,
                          isSelected && wc('palette-row-selected'),
                          wc('palette-row'),
                        ]}
                        onPress={() => handleSelect(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.verb.label} — ${item.verb.riskTier} tier`}
                        accessibilityState={{ selected: isSelected }}
                        {...(Platform.OS === 'web'
                          ? { style: [
                              styles.resultRow,
                              isSelected && styles.resultRowSelected,
                              isSelected && wc('palette-row-selected'),
                              wc('palette-row'),
                              { animationDelay: `${staggerDelay}ms` } as unknown as ViewStyle,
                            ]} as Record<string, unknown>
                          : {})}
                      >
                        {/* Left: icon + labels */}
                        <View style={styles.resultLeft}>
                          <Ionicons
                            name={item.tile.icon as keyof typeof Ionicons.glyphMap}
                            size={16}
                            color={Colors.accent.cyan}
                          />
                          <Text style={styles.resultVerb}>{item.verb.label}</Text>
                        </View>

                        {/* Right: risk badge */}
                        <View style={styles.resultRight}>
                          <Badge
                            label={item.verb.riskTier}
                            variant={RISK_VARIANT[item.verb.riskTier] ?? 'default'}
                            size="sm"
                            icon={
                              <Ionicons
                                name={RISK_ICON[item.verb.riskTier] ?? 'help-outline'}
                                size={10}
                                color={
                                  item.verb.riskTier === 'green'
                                    ? Colors.semantic.success
                                    : item.verb.riskTier === 'yellow'
                                    ? Colors.semantic.warning
                                    : Colors.semantic.error
                                }
                              />
                            }
                          />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              );
              return group;
            })
          )}
        </View>

        {/* Footer hint */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            <Text style={styles.footerKey}>{'↑↓'}</Text> navigate{'  '}
            <Text style={styles.footerKey}>{'↵'}</Text> select{'  '}
            <Text style={styles.footerKey}>esc</Text> close
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Canvas.stage.overlayBg,
  },

  container: {
    position: 'absolute',
    top: 80,
    left: '50%' as unknown as number,
    marginLeft: -320,
    width: 640,
    maxHeight: 480,
    backgroundColor: 'rgba(22,22,24,0.92)',
    borderRadius: Canvas.stage.borderRadius,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    overflow: 'hidden',
  },

  // -- Search ----------------------------------------------------------------

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },

  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.text.primary,
    padding: 0,
  },

  shortcutHint: {
    backgroundColor: Colors.background.elevated,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },

  shortcutText: {
    ...Typography.micro,
    color: Colors.text.muted,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
  },

  // -- Results ---------------------------------------------------------------

  resultsList: {
    flex: 1,
    paddingVertical: Spacing.xs,
    maxHeight: 360,
    overflow: 'scroll' as unknown as 'visible',
  },

  groupHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    paddingTop: Spacing.sm,
  },

  groupLabel: {
    ...Typography.micro,
    color: Colors.text.muted,
    letterSpacing: 1.2,
  },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },

  resultRowSelected: {
    backgroundColor: 'rgba(59,130,246,0.08)',
  },

  resultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },

  resultVerb: {
    ...Typography.caption,
    color: Colors.text.primary,
  },

  resultRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // -- Empty state -----------------------------------------------------------

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.sm,
  },

  emptyText: {
    ...Typography.caption,
    color: Colors.text.muted,
  },

  // -- Footer ----------------------------------------------------------------

  footer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },

  footerText: {
    ...Typography.micro,
    color: Colors.text.muted,
  },

  footerKey: {
    ...Typography.micro,
    color: Colors.text.tertiary,
    fontWeight: '700',
  },
});
