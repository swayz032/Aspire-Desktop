/**
 * ContactAutocomplete — Lane E5 (plan §3.9.6).
 *
 * Virtualized autocomplete dropdown searching across 4 sources, used by:
 *   - NewMessageSheet (To: field)
 *   - ContactsSidePanel (panel-list mode, future)
 *
 * Source priority (rendered in this order, highest first):
 *   1. Routing contacts — `front_desk_routing_contacts` (Aspire-blue pill)
 *   2. Recent SMS contacts — `sms_thread` memory_objects (cyan pill)
 *   3. Recent call contacts — last 90 days `call` memories (violet pill)
 *   4. Manual E.164 entry — appears as a final row when input matches
 *      `^\+?1?[2-9]\d{9}$` and no other results match it (gray pill)
 *
 * Interactions:
 *   - Debounced 200ms search (mock returns canned 4-source set for Lane E5)
 *   - Web keyboard nav: Up/Down highlight, Enter select, Escape close
 *   - Hover/press feedback on every row
 *   - Loading shimmer (3 placeholder rows)
 *   - Empty state with friendly copy
 *
 * Visual chrome (Framer §12.1):
 *   - Anchor TextInput with search icon left + clear "x" right when text
 *   - Dropdown card #1A1A1C bg, subtle border, layered ambient shadow
 *   - Each row: 36px deterministic-color avatar + name + phone + source pill
 *   - Routing role badge inline (Owner/Sales/Support/Billing/Scheduling)
 *
 * Accessibility:
 *   - `accessibilityRole="combobox"` semantics on the input wrapper
 *   - Each row is `accessibilityRole="button"` with rich label
 *   - aria-expanded handled via web role + open state
 *   - Tap targets minimum 48pt per row (above 44pt baseline)
 *
 * Wiring:
 *   - Lane E6 wired the real `useContactSearch` hook
 *     (`lib/messages/useContactSearch`) which hits
 *     `GET /api/messages/contacts/search`. The internal `useContactSearchHook`
 *     wrapper short-circuits when `resultsOverride` is supplied so demos /
 *     visual reviews work offline.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  ScrollView,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing } from '@/constants/tokens';
import type { RoutingRole } from './fixtures';
import { useContactSearch as useContactSearchReal } from '@/lib/messages/useContactSearch';

// ---------------------------------------------------------------------------
// Types — mirrors `GET /v1/messages/contacts/search` response shape
// ---------------------------------------------------------------------------

export type ContactSource = 'routing' | 'recent_sms' | 'recent_call' | 'manual';

export interface ContactSearchResult {
  /** Stable key — `contact_${source}_${e164}` for non-manual; `manual_${raw}` for manual. */
  id: string;
  source: ContactSource;
  /** Display name. May be empty for `manual` entries. */
  name: string;
  /** E.164 phone (always normalized). */
  phone: string;
  /** Set only when `source === 'routing'`. */
  routing_role?: RoutingRole;
  /** Optional ISO timestamp of last interaction (for sort cues). */
  last_interaction_at?: string;
}

export interface ContactAutocompleteProps {
  /** Currently-selected contact (renders as a chip; null = unselected). */
  value: ContactSearchResult | null;
  /** Called when the owner picks a row OR types a manual E.164 + selects it. */
  onSelect: (contact: ContactSearchResult) => void;
  /** Called when the owner clears a previously-selected chip. */
  onClear?: () => void;
  /** Anchor input placeholder. Defaults to a friendly hint. */
  placeholder?: string;
  /** Auto-focus on mount (used inside NewMessageSheet). */
  autoFocus?: boolean;

  /** Test/demo override — bypass the local mock hook. */
  resultsOverride?: ContactSearchResult[];
  /** Test/demo override — force loading state regardless of debounce. */
  isLoadingOverride?: boolean;
  /**
   * Test/demo override — start with the dropdown forced-open and the
   * highlighted index set to a specific row. Used by demo fixtures.
   */
  initialHighlightedIndex?: number;
  /** Test/demo — keep dropdown open on mount (skip focus to open). */
  forceOpen?: boolean;
}

// ---------------------------------------------------------------------------
// One-time CSS — entrance, hover, shimmer, focus rings
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectAutocompleteCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.id = 'msg-contact-autocomplete-css';
  style.textContent = `
    @keyframes msg-ac-pop {
      from { opacity: 0; transform: translateY(-6px) scale(0.99); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes msg-ac-shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .msg-ac-dropdown {
      animation: msg-ac-pop 180ms cubic-bezier(0.16, 1, 0.3, 1) both;
      transform-origin: top left;
    }
    .msg-ac-skeleton {
      background: linear-gradient(90deg, #161618 0%, #1f1f24 50%, #161618 100%);
      background-size: 200% 100%;
      animation: msg-ac-shimmer 1.4s ease-in-out infinite;
    }
    .msg-ac-row {
      transition: background-color 140ms ease-out, border-color 140ms ease-out, transform 140ms ease-out;
      cursor: pointer;
    }
    .msg-ac-row:hover {
      background-color: rgba(59,130,246,0.06);
    }
    .msg-ac-row.is-highlighted {
      background-color: rgba(59,130,246,0.10);
      border-left-color: ${Colors.accent.cyan};
    }
    .msg-ac-row:focus-visible {
      outline: 2px solid rgba(59,130,246,0.65);
      outline-offset: -2px;
    }
    .msg-ac-input {
      transition: border-color 140ms ease-out, box-shadow 140ms ease-out;
    }
    .msg-ac-input:hover { border-color: rgba(255,255,255,0.18); }
    .msg-ac-input:focus-within {
      border-color: rgba(59,130,246,0.55);
      box-shadow: 0 0 0 3px rgba(59,130,246,0.18);
    }
    @media (prefers-reduced-motion: reduce) {
      .msg-ac-dropdown, .msg-ac-skeleton, .msg-ac-row { animation: none; transition: none; }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPhone(e164: string): string {
  const digits = (e164 || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return e164 || '';
}

function normalizeToE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && /^[2-9]/.test(digits)) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1') && /^1[2-9]/.test(digits)) {
    return `+${digits}`;
  }
  return null;
}

function isManualE164Match(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  return /^\+?1?[2-9]\d{9}$/.test(trimmed.replace(/\D/g, '').replace(/^1?/, ''))
    ? normalizeToE164(trimmed) !== null
    : normalizeToE164(trimmed) !== null;
}

function avatarHue(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  return Math.abs(hash) % 360;
}

function avatarBg(seed: string): string {
  return `hsl(${avatarHue(seed)}, 28%, 22%)`;
}
function avatarFg(seed: string): string {
  return `hsl(${avatarHue(seed)}, 60%, 75%)`;
}

function initials(name: string, phone: string): string {
  const trimmed = (name || '').trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-2) || '··';
}

// ---------------------------------------------------------------------------
// Source pill — small uppercase badge per source
// ---------------------------------------------------------------------------

const SOURCE_LABEL: Record<ContactSource, string> = {
  routing: 'Routing',
  recent_sms: 'Recent SMS',
  recent_call: 'Recent Call',
  manual: 'Manual',
};

const SOURCE_COLOR: Record<
  ContactSource,
  { bg: string; border: string; text: string }
> = {
  routing: {
    bg: 'rgba(59,130,246,0.12)',
    border: 'rgba(59,130,246,0.30)',
    text: '#60A5FA',
  },
  recent_sms: {
    bg: 'rgba(8,145,178,0.14)',
    border: 'rgba(8,145,178,0.32)',
    text: '#22D3EE',
  },
  recent_call: {
    bg: 'rgba(168,85,247,0.14)',
    border: 'rgba(168,85,247,0.32)',
    text: '#C084FC',
  },
  manual: {
    bg: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.14)',
    text: Colors.text.tertiary,
  },
};

const ROLE_LABEL: Record<RoutingRole, string> = {
  owner: 'Owner',
  sales: 'Sales',
  support: 'Support',
  billing: 'Billing',
  scheduling: 'Scheduling',
};

// ---------------------------------------------------------------------------
// Mock dataset / local filterer was removed in Lane E6 — the network hook
// (`/api/messages/contacts/search`) handles ranking + matching server-side.
// `ContactAutocomplete.demo.tsx` still ships its own fixture set via the
// `resultsOverride` prop for offline review.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Lane E6 — real `useContactSearch` wired below. The shim preserves the
// same return shape (`{ results, isLoading }`) and supports the demo /
// fixture overrides so `ContactAutocomplete.demo.tsx` keeps working without
// a backend.
// ---------------------------------------------------------------------------

function useContactSearchHook(
  query: string,
  forceLoading: boolean,
  resultsOverride?: ContactSearchResult[],
): {
  results: ContactSearchResult[];
  isLoading: boolean;
} {
  // The real hook owns its own debounce. When `resultsOverride` is supplied
  // we want INSTANT results (no debounce or network); we still call the
  // hook (React rules of hooks) but ignore its return.
  const real = useContactSearchReal(query, 20);
  if (resultsOverride) {
    return { results: resultsOverride, isLoading: !!forceLoading };
  }
  return {
    results: real.results,
    isLoading: forceLoading || real.isLoading,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContactAutocomplete({
  value,
  onSelect,
  onClear,
  placeholder = 'Type a name, phone, or paste a number',
  autoFocus,
  resultsOverride,
  isLoadingOverride,
  initialHighlightedIndex,
  forceOpen,
}: ContactAutocompleteProps) {
  injectAutocompleteCss();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(!!forceOpen);
  const [highlighted, setHighlighted] = useState<number>(
    initialHighlightedIndex ?? 0,
  );
  const inputRef = useRef<TextInput>(null);

  const { results, isLoading } = useContactSearchHook(
    query,
    !!isLoadingOverride,
    resultsOverride,
  );

  // Manual E.164 fallback row — appears when input parses to E.164 and the
  // typed phone doesn't already exist in `results`. Using normalized phone
  // ensures we don't double-show the same number.
  const manualRow = useMemo<ContactSearchResult | null>(() => {
    const e164 = normalizeToE164(query);
    if (!e164) return null;
    const existsInResults = results.some(
      (r) => r.phone === e164 || r.phone.endsWith(e164.slice(-10)),
    );
    if (existsInResults) return null;
    return {
      id: `manual_${e164}`,
      source: 'manual',
      name: '',
      phone: e164,
    };
  }, [query, results]);

  const visibleRows = useMemo<ContactSearchResult[]>(() => {
    return manualRow ? [...results, manualRow] : results;
  }, [results, manualRow]);

  // Reset highlight when results shape changes meaningfully
  useEffect(() => {
    if (highlighted >= visibleRows.length) {
      setHighlighted(visibleRows.length > 0 ? 0 : -1);
    }
  }, [visibleRows.length, highlighted]);

  const handleSelect = useCallback(
    (c: ContactSearchResult) => {
      onSelect(c);
      setOpen(false);
      setQuery('');
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (e: any) => {
      if (Platform.OS !== 'web') return;
      const key = e?.nativeEvent?.key ?? e?.key;
      if (!key) return;
      if (key === 'ArrowDown') {
        e.preventDefault?.();
        setOpen(true);
        setHighlighted((h) => Math.min(h + 1, visibleRows.length - 1));
      } else if (key === 'ArrowUp') {
        e.preventDefault?.();
        setHighlighted((h) => Math.max(h - 1, 0));
      } else if (key === 'Enter') {
        if (open && visibleRows[highlighted]) {
          e.preventDefault?.();
          handleSelect(visibleRows[highlighted]);
        }
      } else if (key === 'Escape') {
        e.preventDefault?.();
        setOpen(false);
      }
    },
    [open, highlighted, visibleRows, handleSelect],
  );

  // ---------------------------------------------------------------------
  // Selected-chip mode — render the chip and skip the input until cleared
  // ---------------------------------------------------------------------

  if (value) {
    return (
      <View style={styles.chipWrap}>
        <View style={styles.chip}>
          <View
            style={[
              styles.chipAvatar,
              { backgroundColor: avatarBg(value.name || value.phone) },
            ]}
          >
            <Text
              style={[
                styles.chipAvatarText,
                { color: avatarFg(value.name || value.phone) },
              ]}
            >
              {initials(value.name, value.phone)}
            </Text>
          </View>
          <View style={styles.chipBody}>
            <Text style={styles.chipName} numberOfLines={1}>
              {value.name?.trim() || formatPhone(value.phone)}
            </Text>
            <Text style={styles.chipPhone} numberOfLines={1}>
              {formatPhone(value.phone)}
              {value.routing_role
                ? ` · ${ROLE_LABEL[value.routing_role]}`
                : ''}
            </Text>
          </View>
          {onClear ? (
            <Pressable
              onPress={onClear}
              accessibilityRole="button"
              accessibilityLabel="Remove contact"
              accessibilityHint="Clears the selected contact and reopens the search"
              hitSlop={12}
              style={({ pressed }) => [
                styles.chipClose,
                pressed && styles.chipClosePressed,
              ]}
            >
              <Ionicons name="close" size={14} color={Colors.text.tertiary} />
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------
  // Search-input mode
  // ---------------------------------------------------------------------

  return (
    <View style={styles.root}>
      {/* Anchor input */}
      <View
        style={styles.inputWrap}
        accessibilityRole={
          Platform.OS === 'web' ? ('combobox' as any) : undefined
        }
        accessibilityLabel="Search contacts"
        {...(Platform.OS === 'web'
          ? ({ className: 'msg-ac-input' } as any)
          : {})}
      >
        <Ionicons
          name="search"
          size={16}
          color={Colors.text.muted}
          style={styles.inputIcon}
        />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={Colors.text.muted}
          autoFocus={autoFocus}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay close so a row press registers before the dropdown unmounts.
            setTimeout(() => setOpen(false), 120);
          }}
          accessibilityLabel="Contact search"
          accessibilityHint="Type a name, phone number, or paste an E.164 number"
          style={styles.input}
          {...(Platform.OS === 'web'
            ? ({ onKeyDown: handleKeyDown } as any)
            : {})}
        />
        {query.length > 0 ? (
          <Pressable
            onPress={() => {
              setQuery('');
              setOpen(true);
              inputRef.current?.focus();
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={12}
            style={({ pressed }) => [
              styles.clearBtn,
              pressed && styles.clearBtnPressed,
            ]}
          >
            <Ionicons name="close-circle" size={16} color={Colors.text.muted} />
          </Pressable>
        ) : null}
      </View>

      {/* Dropdown */}
      {open ? (
        <View
          style={styles.dropdown}
          {...(Platform.OS === 'web'
            ? ({ className: 'msg-ac-dropdown' } as any)
            : {})}
        >
          {isLoading ? (
            <SkeletonRows />
          ) : visibleRows.length === 0 ? (
            <EmptyState query={query} />
          ) : (
            <ScrollView
              style={styles.dropdownScroll}
              keyboardShouldPersistTaps="handled"
              accessibilityLabel="Search results"
            >
              {visibleRows.map((c, i) => (
                <Row
                  key={c.id}
                  contact={c}
                  highlighted={i === highlighted}
                  onSelect={() => handleSelect(c)}
                  onHover={() => setHighlighted(i)}
                  isLast={i === visibleRows.length - 1}
                />
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface RowProps {
  contact: ContactSearchResult;
  highlighted: boolean;
  isLast: boolean;
  onSelect: () => void;
  onHover: () => void;
}

function Row({ contact, highlighted, isLast, onSelect, onHover }: RowProps) {
  const sourcePalette = SOURCE_COLOR[contact.source];
  const seed = contact.name || contact.phone;
  const isManual = contact.source === 'manual';
  const primary = isManual
    ? `Send to ${formatPhone(contact.phone)}`
    : contact.name?.trim() || formatPhone(contact.phone);
  const secondary = isManual
    ? 'New contact — never messaged before'
    : formatPhone(contact.phone);

  return (
    <Pressable
      onPress={onSelect}
      onHoverIn={onHover}
      accessibilityRole="button"
      accessibilityLabel={
        isManual
          ? `Send a new message to ${formatPhone(contact.phone)}`
          : `Pick ${primary}, ${secondary}${
              contact.routing_role
                ? `, ${ROLE_LABEL[contact.routing_role]} role`
                : ''
            }`
      }
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.rowDivider,
        highlighted && styles.rowHighlighted,
        pressed && styles.rowPressed,
      ]}
      {...(Platform.OS === 'web'
        ? ({
            className: `msg-ac-row${highlighted ? ' is-highlighted' : ''}`,
          } as any)
        : {})}
    >
      <View
        style={[
          styles.avatar,
          {
            backgroundColor: isManual
              ? 'rgba(255,255,255,0.04)'
              : avatarBg(seed),
          },
        ]}
      >
        {isManual ? (
          <Ionicons name="add" size={16} color={Colors.text.tertiary} />
        ) : (
          <Text
            style={[
              styles.avatarText,
              { color: avatarFg(seed) },
            ]}
          >
            {initials(contact.name, contact.phone)}
          </Text>
        )}
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowHead}>
          <Text style={styles.rowName} numberOfLines={1}>
            {primary}
          </Text>
          {contact.routing_role ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {ROLE_LABEL[contact.routing_role]}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.rowSecondary} numberOfLines={1}>
          {secondary}
        </Text>
      </View>

      <View
        style={[
          styles.sourcePill,
          { backgroundColor: sourcePalette.bg, borderColor: sourcePalette.border },
        ]}
      >
        <Text style={[styles.sourcePillText, { color: sourcePalette.text }]}>
          {SOURCE_LABEL[contact.source]}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loading
// ---------------------------------------------------------------------------

function SkeletonRows() {
  return (
    <View
      style={styles.skeletonWrap}
      accessibilityRole="progressbar"
      accessibilityLabel="Searching contacts"
    >
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <View
            style={styles.skeletonAvatar}
            {...(Platform.OS === 'web'
              ? ({ className: 'msg-ac-skeleton' } as any)
              : {})}
          />
          <View style={styles.skeletonBody}>
            <View
              style={[styles.skeletonLine, { width: '52%' }]}
              {...(Platform.OS === 'web'
                ? ({ className: 'msg-ac-skeleton' } as any)
                : {})}
            />
            <View
              style={[styles.skeletonLine, { width: '38%', height: 8 }]}
              {...(Platform.OS === 'web'
                ? ({ className: 'msg-ac-skeleton' } as any)
                : {})}
            />
          </View>
          <View
            style={styles.skeletonPill}
            {...(Platform.OS === 'web'
              ? ({ className: 'msg-ac-skeleton' } as any)
              : {})}
          />
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Empty state — friendly copy with personality
// ---------------------------------------------------------------------------

function EmptyState({ query }: { query: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons
          name={query.trim() ? 'search-outline' : 'people-outline'}
          size={20}
          color={Colors.accent.cyan}
        />
      </View>
      <Text style={styles.emptyTitle}>
        {query.trim() ? 'No matches' : 'Start typing to search'}
      </Text>
      <Text style={styles.emptyBody}>
        {query.trim()
          ? 'Type a phone number to message a new contact.'
          : 'Search routing contacts, recent SMS conversations, and call history.'}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const ROW_HEIGHT = 60;

const styles = StyleSheet.create({
  root: {
    width: '100%',
    position: 'relative',
  },

  // Anchor input
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#141416',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    minHeight: 48,
  } as ViewStyle,
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.text.primary,
    paddingVertical: 12,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  } as any,
  clearBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    borderRadius: BorderRadius.sm,
  },
  clearBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  // Dropdown
  dropdown: {
    marginTop: 6,
    backgroundColor: '#1A1A1C',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: 320,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(59,130,246,0.10), 0 0 24px rgba(59,130,246,0.10)',
        } as object)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.5,
          shadowRadius: 18,
          elevation: 10,
        }),
  } as ViewStyle,
  dropdownScroll: {
    maxHeight: 320,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: ROW_HEIGHT,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowHighlighted: {
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderLeftColor: Colors.accent.cyan,
  },
  rowPressed: {
    backgroundColor: 'rgba(59,130,246,0.16)',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  rowSecondary: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
    fontVariant: ['tabular-nums'],
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.24)',
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#60A5FA',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  // Source pill
  sourcePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  sourcePillText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },

  // Skeleton
  skeletonWrap: {
    paddingVertical: 4,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  skeletonAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#161618',
  } as any,
  skeletonBody: {
    flex: 1,
    gap: 6,
  },
  skeletonLine: {
    height: 10,
    borderRadius: 4,
    backgroundColor: '#161618',
  } as any,
  skeletonPill: {
    width: 60,
    height: 18,
    borderRadius: BorderRadius.full,
    backgroundColor: '#161618',
  } as any,

  // Empty state
  empty: {
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 320,
  },

  // Selected-chip mode
  chipWrap: {
    width: '100%',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.30)',
  } as ViewStyle,
  chipAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  chipAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  chipBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  chipName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  chipPhone: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
    fontVariant: ['tabular-nums'],
  },
  chipClose: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  chipClosePressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});

// ---------------------------------------------------------------------------
// Helpers exported for sibling components / tests
// ---------------------------------------------------------------------------

export {
  formatPhone as formatPhoneForAutocomplete,
  normalizeToE164,
  isManualE164Match,
};
