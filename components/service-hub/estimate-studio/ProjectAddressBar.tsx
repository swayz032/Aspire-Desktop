/**
 * Project address bar with Google Places autocomplete dropdown.
 *
 * Critical UX rule: typing must NOT fire `usePropertyData`. The property
 * fetch only runs against a **picked** (canonical) address — not partial
 * keystrokes. Two-state model:
 *
 *   - `draft`        local input value (uncontrolled by store) — user typing
 *   - `submitted`    `useProjectAddress` store — only set when user picks
 *                    a suggestion or presses Enter on a complete address
 *
 * Address Validation (Stage 1 gate in propertyAggregator) verifies the
 * picked address is real before any downstream API spends a token.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
} from 'react-native';
import { createPortal } from 'react-dom';
import { Ionicons } from '@expo/vector-icons';
import { useProjectAddress, setProjectAddress } from '@/hooks/useProjectAddress';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { supabase } from '@/lib/supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

type PlaceSuggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
};

interface ProjectAddressBarProps {
  initialAddress?: string;
  onAddressChange?: (address: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────
//
// Wave 0 cleanup (2026-05-17): the inline Upload, "+ New Project" buttons
// and the "Recent ▾" chip were removed. Tim Rail's Controls tab
// (`TimRailControlsTab.tsx`) is the single source of truth for those actions
// — duplicating them in the header bar created clutter and overlap on
// laptops. The address input is the only affordance this component owns.

export function ProjectAddressBar({
  initialAddress,
  onAddressChange,
}: ProjectAddressBarProps) {
  const { address: storedAddress } = useProjectAddress();

  // Local draft = what's in the box. Initialized to the submitted address
  // (or initialAddress override) so a hard refresh restores the field.
  const [draft, setDraft] = useState<string>(
    storedAddress.length > 0 ? storedAddress : initialAddress ?? '',
  );
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [dropdownRect, setDropdownRect] = useState<{ left: number; top: number; width: number } | null>(null);

  const inputRef = useRef<TextInput>(null);
  const wrapperRef = useRef<View>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sync draft when the store changes from elsewhere (URL deep-link).
  useEffect(() => {
    if (storedAddress && storedAddress !== draft && document?.activeElement !== inputRef.current) {
      setDraft(storedAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedAddress]);

  // Debounce the user's typing for autocomplete fetches.
  const debouncedDraft = useDebouncedValue(draft, 200);

  // Fetch autocomplete suggestions from /api/places/autocomplete
  useEffect(() => {
    const term = debouncedDraft.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setIsFetchingSuggestions(false);
      return;
    }

    // Cancel any in-flight request when input changes
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setIsFetchingSuggestions(true);
    // Metro proxies /api/* to the Express server (see metro.config.js).
    // Use relative URL → no CORS preflight, no port mismatch.
    // Places API requires JWT (server gates it to prevent quota exhaustion).
    void (async () => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      } catch {
        // No session — server will 401, dropdown stays empty. Acceptable.
      }
      return fetch('/api/places/autocomplete', {
        method: 'POST',
        headers,
        body: JSON.stringify({ input: term }),
        signal: ctrl.signal,
        credentials: 'include',
      });
    })()
      .then((r) => r.json())
      .then((data: { suggestions?: unknown[] }) => {
        if (ctrl.signal.aborted) return;
        const parsed = parseSuggestions(data.suggestions ?? []);
        setSuggestions(parsed);
        setHighlightedIndex(parsed.length > 0 ? 0 : -1);
        setIsFetchingSuggestions(false);
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return;
        setSuggestions([]);
        setIsFetchingSuggestions(false);
      });

    return () => ctrl.abort();
  }, [debouncedDraft]);

  // Measure the input's viewport rect so the dropdown can render via fixed
  // positioning — escapes any parent stacking context (tabs, hero, etc.).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!showDropdown) return;
    const el = (wrapperRef.current as unknown as HTMLElement | null);
    if (!el || typeof (el as any).getBoundingClientRect !== 'function') return;
    const measure = () => {
      const r = (el as any).getBoundingClientRect();
      setDropdownRect({ left: r.left, top: r.bottom + 4, width: r.width });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [showDropdown, suggestions.length]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleChange = (next: string) => {
    setDraft(next);
    onAddressChange?.(next);
    setShowDropdown(next.trim().length >= 2);
  };

  const handleFocus = () => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    if (draft.trim().length >= 2 && suggestions.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleBlur = () => {
    // Delay so a click on a suggestion can register before we hide.
    blurTimerRef.current = setTimeout(() => setShowDropdown(false), 150);
  };

  const pickSuggestion = (s: PlaceSuggestion) => {
    setDraft(s.fullText);
    setShowDropdown(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
    // Submit the canonical address to the store — this triggers usePropertyData.
    setProjectAddress(s.fullText);
    onAddressChange?.(s.fullText);
    inputRef.current?.blur();
  };

  const handleSubmitEditing = () => {
    if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
      pickSuggestion(suggestions[highlightedIndex]);
      return;
    }
    // No suggestion picked — submit raw draft. The Address Validation gate
    // will catch malformed inputs server-side.
    if (draft.trim().length >= 5) {
      setProjectAddress(draft.trim());
      setShowDropdown(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) =>
        i <= 0 ? suggestions.length - 1 : i - 1,
      );
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setHighlightedIndex(-1);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const dropdownVisible =
    showDropdown && draft.trim().length >= 2 && (isFetchingSuggestions || suggestions.length > 0);

  return (
    <View style={styles.container} testID="estimate-studio-project-address-bar">
      <View style={styles.searchWrap} ref={wrapperRef as any}>
        <View style={styles.searchInner}>
          <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.45)" />
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onSubmitEditing={handleSubmitEditing}
            placeholder="Enter property address..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.input}
            testID="estimate-studio-address-input"
            // Keyboard nav (web only)
            {...(Platform.OS === 'web'
              ? { onKeyDown: handleKeyDown as unknown as undefined }
              : {})}
            autoCapitalize="words"
            autoCorrect={false}
          />
          {isFetchingSuggestions && (
            <ActivityIndicator size="small" color="rgba(255,255,255,0.45)" />
          )}
        </View>

        {dropdownVisible && (() => {
          const dropdownNode = (
            <View
              style={[
                styles.dropdown,
                Platform.OS === 'web' && dropdownRect
                  ? {
                      position: 'fixed' as any,
                      left: dropdownRect.left,
                      top: dropdownRect.top,
                      width: dropdownRect.width,
                    }
                  : null,
              ]}
              testID="estimate-studio-address-suggestions">
              {suggestions.length === 0 && isFetchingSuggestions && (
                <View style={styles.dropdownEmpty}>
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.45)" />
                  <Text style={styles.dropdownEmptyText}>Searching…</Text>
                </View>
              )}
              {suggestions.map((s, i) => (
                <Pressable
                  key={s.placeId}
                  // onPressIn fires on mousedown — beats the input's onBlur race on web.
                  onPressIn={() => pickSuggestion(s)}
                  onPress={() => pickSuggestion(s)}
                  onHoverIn={() => setHighlightedIndex(i)}
                  style={[
                    styles.suggestionRow,
                    highlightedIndex === i && styles.suggestionRowActive,
                  ]}
                  testID={`address-suggestion-${i}`}
                >
                  <Ionicons
                    name="location"
                    size={14}
                    color={highlightedIndex === i ? '#fbbf24' : 'rgba(255,255,255,0.45)'}
                  />
                  <View style={styles.suggestionTextWrap}>
                    <Text style={styles.suggestionMain} numberOfLines={1}>
                      {s.mainText}
                    </Text>
                    <Text style={styles.suggestionSecondary} numberOfLines={1}>
                      {s.secondaryText}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          );
          // Portal to <body> on web so the dropdown escapes every parent
          // stacking context (TabBar, canvas overflow:hidden, etc). Without
          // this, the EstimateStudio TabBar pill renders ABOVE the dropdown
          // and intercepts clicks on the suggestion rows that visually overlap
          // it. On native, fall through to inline render.
          if (Platform.OS === 'web' && typeof document !== 'undefined') {
            return createPortal(dropdownNode, document.body);
          }
          return dropdownNode;
        })()}
      </View>

    </View>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse Google Places API (New) v1 autocomplete response into a normalized
 * shape. Tolerates missing nested fields so a partial response doesn't crash.
 */
function parseSuggestions(raw: unknown[]): PlaceSuggestion[] {
  const out: PlaceSuggestion[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const pred = (r as Record<string, unknown>).placePrediction;
    if (!pred || typeof pred !== 'object') continue;
    const p = pred as Record<string, unknown>;
    const placeId = typeof p.placeId === 'string' ? p.placeId : '';
    if (!placeId) continue;

    const textObj = p.text as Record<string, unknown> | undefined;
    const fullText = typeof textObj?.text === 'string' ? textObj.text : '';

    const sf = p.structuredFormat as Record<string, unknown> | undefined;
    const mainTextObj = sf?.mainText as Record<string, unknown> | undefined;
    const secondaryTextObj = sf?.secondaryText as Record<string, unknown> | undefined;
    const mainText =
      typeof mainTextObj?.text === 'string' ? mainTextObj.text : fullText;
    const secondaryText =
      typeof secondaryTextObj?.text === 'string' ? secondaryTextObj.text : '';

    out.push({ placeId, mainText, secondaryText, fullText });
  }
  return out;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    marginBottom: 16,
    zIndex: 9999,
    position: 'relative',
  },
  searchWrap: {
    width: '100%',
    position: 'relative',
    zIndex: 9999,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    padding: 0,
    margin: 0,
    outlineStyle: 'none' as any,
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 4px)' as any,
    left: 0,
    right: 0,
    // Fully opaque background — no rgba transparency, sits over tabs cleanly.
    backgroundColor: '#0F0F11',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingVertical: 4,
    boxShadow: '0 12px 32px rgba(0,0,0,0.65), 0 2px 6px rgba(0,0,0,0.4)' as any,
    zIndex: 10000,
    elevation: 10,
    // minHeight prevents the dropdown from shaking when suggestions stream in.
    minHeight: 56,
    maxHeight: 360,
    overflow: 'hidden' as any,
  },
  dropdownEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownEmptyText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  suggestionRowActive: {
    backgroundColor: 'rgba(251,191,36,0.08)',
  },
  suggestionTextWrap: {
    flex: 1,
    gap: 1,
  },
  suggestionMain: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  suggestionSecondary: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
  },
});
