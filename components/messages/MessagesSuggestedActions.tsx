/**
 * MessagesSuggestedActions — right-pane state (B): conversations exist but
 * none is selected (plan §3.9.4 state B, Lane E4).
 *
 * Replaces the "Choose a thread from the left" dead space with a working
 * Ava-recommended follow-up list. Each suggestion is a card showing:
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  ╭───╮  Maya Lane              SCHEDULING                    │
 *   │  │ML │  "Confirming Tuesday 2pm — bring swatches?"           │
 *   │  ╰───╯                                          [→ Send]      │
 *   │  ✦ Maya hasn't replied to your Tuesday quote — send a check?  │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Layered composition (back to front):
 *   1. Top accent bar (1px Aspire-blue gradient line)
 *   2. Header: "Choose a thread from the left" + secondary line
 *   3. Section label: "SUGGESTED ACTIONS"
 *   4. Suggestion cards (3–5)
 *   5. Empty fallback: "Nothing pending. You're up to date."
 *
 * Motion (web only):
 *   - Card fade-up on mount, staggered 60ms per card
 *   - Hover: lift -2px + cyan halo (matches MessagesThreadList row hover)
 *   - Send button: scale 0.97 on press, soft cyan halo on hover
 *
 * Data:
 *   Lane E6 wired `useMessageSuggestions` from `lib/messages/`. Demo
 *   surfaces (`MessagesSuggestedActions.demo.tsx` + `app/demo/messages.tsx`)
 *   pass `suggestionsOverride` to bypass the network so the populated state
 *   renders without a backend.
 *
 * A11y:
 *   - Section labels are `accessibilityRole="header"`
 *   - Send button: clear `accessibilityLabel` per suggestion
 *   - All tap targets ≥44pt
 *   - Decorative icons hidden from a11y tree
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, BorderRadius } from '@/constants/tokens';
import type { RoutingRole } from './fixtures';
import { useMessageSuggestions } from '@/lib/messages/useMessageSuggestions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Mirror of the Lane E6 hook return shape — when `useMessageSuggestions`
 * lands at `lib/messages/useMessageSuggestions.ts` it will export this
 * exact type and return suggestions in this exact order.
 */
export interface MessageSuggestion {
  suggestion_id: string;
  contact_name: string;
  contact_phone: string;
  /** Pre-drafted message body — owner can edit before send. */
  draft_body: string;
  /** Why Ava surfaces this (shown as a chip / hint). */
  reason: string;
  /** When the contact is in routing_contacts, surface the role. */
  routing_role?: RoutingRole;
}

export interface MessagesSuggestedActionsProps {
  /** Open the NewMessageSheet (Lane E5 owns the sheet). For now: pre-fills
   *  via the same handler — the sheet pulls suggestion context from store
   *  state once E5 lands. */
  onComposeNew: () => void;
  /** Open the contacts side panel (Lane E5 owns the panel). */
  onOpenContacts: () => void;

  /** Test/demo override — bypass the network hook and render the supplied
   *  list verbatim. Used by `MessagesSuggestedActions.demo.tsx` and
   *  `app/demo/messages.tsx` for offline review. */
  suggestionsOverride?: MessageSuggestion[];
  /** Test/demo override — force loading state regardless of hook. */
  isLoadingOverride?: boolean;
}

// ---------------------------------------------------------------------------
// One-time CSS injection (web only)
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectSuggestionsCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const STYLE_ID = 'messages-suggested-actions-css';
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes msg-sug-fade-up {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .msg-sug-card {
      animation: msg-sug-fade-up 360ms cubic-bezier(0.16, 1, 0.3, 1) both;
      transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1),
                  background-color 200ms ease-out,
                  border-color 200ms ease-out,
                  box-shadow 200ms ease-out;
    }
    .msg-sug-card:hover {
      transform: translateY(-2px);
      background-color: rgba(28,28,30,0.95);
      border-color: rgba(59,130,246,0.28);
      box-shadow: 0 0 0 1px rgba(59,130,246,0.18), 0 8px 22px rgba(0,0,0,0.4), 0 0 24px rgba(59,130,246,0.08);
    }
    .msg-sug-card:focus-visible {
      outline: 2px solid rgba(59,130,246,0.7);
      outline-offset: 2px;
    }

    /* Stagger — first 5 cards (we never render more than 5). */
    .msg-sug-card:nth-child(1) { animation-delay: 0ms; }
    .msg-sug-card:nth-child(2) { animation-delay: 60ms; }
    .msg-sug-card:nth-child(3) { animation-delay: 120ms; }
    .msg-sug-card:nth-child(4) { animation-delay: 180ms; }
    .msg-sug-card:nth-child(5) { animation-delay: 240ms; }

    .msg-sug-send {
      transition: transform 140ms ease-out, background-color 140ms ease-out, box-shadow 140ms ease-out;
    }
    .msg-sug-send:hover {
      box-shadow: 0 0 0 1px rgba(59,130,246,0.55), 0 6px 14px rgba(59,130,246,0.32);
    }
    .msg-sug-send:active { transform: scale(0.97); }
    .msg-sug-send:focus-visible {
      outline: 2px solid rgba(59,130,246,0.7);
      outline-offset: 2px;
    }

    @keyframes msg-sug-empty-breathe {
      0%, 100% { opacity: 0.55; }
      50%      { opacity: 0.85; }
    }
    .msg-sug-empty-glow {
      animation: msg-sug-empty-breathe 4400ms ease-in-out infinite;
    }

    @media (prefers-reduced-motion: reduce) {
      .msg-sug-card,
      .msg-sug-send,
      .msg-sug-empty-glow { animation: none; transition: none; }
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
// Avatar — small variant (36px) for suggestion rows
// ---------------------------------------------------------------------------

function SuggestionAvatar({ name, phone }: { name: string; phone: string }) {
  const seed = name || phone;
  return (
    <View
      style={[avatarStyles.wrap, { backgroundColor: avatarBg(seed) }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[avatarStyles.text, { color: avatarFg(seed) }]}>
        {initials(name, phone)}
      </Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  wrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

// ---------------------------------------------------------------------------
// Routing role pill (compact)
// ---------------------------------------------------------------------------

function RolePill({ role }: { role: RoutingRole }) {
  return (
    <View style={pillStyles.pill}>
      <Text style={pillStyles.text}>{role.toUpperCase()}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(59,130,246,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.30)',
  },
  text: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.0,
    color: Colors.accent.cyan,
  },
});

// ---------------------------------------------------------------------------
// SuggestionCard
// ---------------------------------------------------------------------------

interface SuggestionCardProps {
  suggestion: MessageSuggestion;
  onSend: () => void;
}

function SuggestionCard({ suggestion, onSend }: SuggestionCardProps) {
  return (
    <View
      style={cardStyles.card}
      {...(Platform.OS === 'web'
        ? ({ className: 'msg-sug-card' } as any)
        : {})}
    >
      <View style={cardStyles.headerRow}>
        <SuggestionAvatar
          name={suggestion.contact_name}
          phone={suggestion.contact_phone}
        />
        <View style={cardStyles.identity}>
          <View style={cardStyles.namePlusRole}>
            <Text style={cardStyles.name} numberOfLines={1}>
              {suggestion.contact_name || formatPhone(suggestion.contact_phone)}
            </Text>
            {suggestion.routing_role && <RolePill role={suggestion.routing_role} />}
          </View>
          <Text style={cardStyles.phone} numberOfLines={1}>
            {formatPhone(suggestion.contact_phone)}
          </Text>
        </View>

        <Pressable
          onPress={onSend}
          accessibilityRole="button"
          accessibilityLabel={`Send draft to ${
            suggestion.contact_name || formatPhone(suggestion.contact_phone)
          }`}
          accessibilityHint={suggestion.reason}
          style={({ pressed }) => [
            cardStyles.sendBtn,
            pressed && cardStyles.sendBtnPressed,
          ]}
          {...(Platform.OS === 'web'
            ? ({ className: 'msg-sug-send' } as any)
            : {})}
        >
          <Ionicons name="send" size={14} color="#ffffff" />
          <Text style={cardStyles.sendBtnText}>Send</Text>
        </Pressable>
      </View>

      <Text style={cardStyles.draft} numberOfLines={2}>
        {`"${suggestion.draft_body}"`}
      </Text>

      <View style={cardStyles.reasonRow}>
        <View
          style={cardStyles.sparkleIcon}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Ionicons name="sparkles" size={11} color={Colors.accent.cyan} />
        </View>
        <Text style={cardStyles.reason} numberOfLines={2}>
          {suggestion.reason}
        </Text>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: BorderRadius.lg,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  namePlusRole: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.05,
  },
  phone: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
    fontVariant: ['tabular-nums'],
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    minWidth: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent.cyan,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 2px rgba(0,0,0,0.3), 0 4px 12px rgba(59,130,246,0.28)',
        } as object)
      : {
          shadowColor: Colors.accent.cyan,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
        }),
  } as any,
  sendBtnPressed: {
    backgroundColor: Colors.accent.cyanDark,
    opacity: 0.95,
  },
  sendBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.1,
  },
  draft: {
    fontSize: 13,
    fontWeight: '400',
    fontStyle: 'italic',
    color: Colors.text.secondary,
    lineHeight: 19,
    paddingLeft: 50, // align under name (avatar 38 + gap 12)
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingLeft: 50,
    paddingTop: 2,
  },
  sparkleIcon: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  reason: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.tertiary,
    lineHeight: 16,
  },
});

// ---------------------------------------------------------------------------
// Empty state — "Nothing pending. You're up to date."
// ---------------------------------------------------------------------------

function NothingPendingPanel() {
  return (
    <View style={emptyStyles.panel}>
      <View
        style={emptyStyles.iconHalo}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        {...(Platform.OS === 'web'
          ? ({ className: 'msg-sug-empty-glow' } as any)
          : {})}
      >
        <LinearGradient
          colors={[
            'rgba(52,199,89,0.20)',
            'rgba(52,199,89,0.06)',
            'transparent',
          ]}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill as ViewStyle}
        />
        <Ionicons name="checkmark-done" size={28} color="#34c759" />
      </View>
      <Text style={emptyStyles.title} accessibilityRole="header">
        Nothing pending
      </Text>
      <Text style={emptyStyles.body}>
        You&apos;re up to date. Ava will surface follow-ups here when leads go
        quiet or quotes are about to expire.
      </Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  panel: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: BorderRadius.lg,
  },
  iconHalo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(52,199,89,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.20)',
    overflow: 'hidden',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  body: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 360,
  },
});

// ---------------------------------------------------------------------------
// Inner
// ---------------------------------------------------------------------------

function MessagesSuggestedActionsInner({
  onComposeNew,
  onOpenContacts,
  suggestionsOverride,
  isLoadingOverride,
}: MessagesSuggestedActionsProps) {
  injectSuggestionsCss();

  // Lane E6: real hook against `/api/messages/suggestions`. Demo overrides
  // (used by `app/demo/messages.tsx` + `MessagesSuggestedActions.demo.tsx`)
  // bypass the network so reviewers see the populated state offline.
  const hookResult = useMessageSuggestions(5);
  const suggestions = suggestionsOverride ?? hookResult.suggestions;
  const isLoading = isLoadingOverride ?? hookResult.isLoading;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Top accent bar */}
      <View
        style={styles.accentBar}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <LinearGradient
          colors={[
            'transparent',
            'rgba(59,130,246,0.55)',
            'rgba(59,130,246,0.85)',
            'rgba(59,130,246,0.55)',
            'transparent',
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill as ViewStyle}
        />
      </View>

      <View style={styles.column}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            Choose a thread from the left
          </Text>
          <Text style={styles.subtitle}>
            Or jump on one of Ava&apos;s suggested follow-ups.
          </Text>
        </View>

        {/* Section label */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel} accessibilityRole="header">
            SUGGESTED ACTIONS
          </Text>
          <Pressable
            onPress={onOpenContacts}
            accessibilityRole="button"
            accessibilityLabel="Open contacts"
            accessibilityHint="View routing contacts and recent senders"
            style={({ pressed }) => [
              styles.contactsLink,
              pressed && styles.contactsLinkPressed,
            ]}
          >
            <Ionicons
              name="people-outline"
              size={13}
              color={Colors.text.tertiary}
            />
            <Text style={styles.contactsLinkText}>Contacts</Text>
          </Pressable>
        </View>

        {/* Body — loading / suggestions / empty */}
        {isLoading ? (
          <View style={styles.loadingPanel} accessibilityRole="progressbar">
            <ActivityIndicator size="small" color={Colors.accent.cyan} />
            <Text style={styles.loadingText}>
              Loading suggested follow-ups…
            </Text>
          </View>
        ) : suggestions.length === 0 ? (
          <NothingPendingPanel />
        ) : (
          <View style={styles.list}>
            {suggestions.slice(0, 5).map((s) => (
              <SuggestionCard
                key={s.suggestion_id}
                suggestion={s}
                onSend={onComposeNew}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
    position: 'relative',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: '15%',
    right: '15%',
    height: 1,
    overflow: 'hidden',
  },
  column: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: 18,
  },
  header: {
    gap: 6,
    marginTop: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 20,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: Colors.text.muted,
    textTransform: 'uppercase',
  },
  contactsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 28,
    borderRadius: BorderRadius.sm,
  },
  contactsLinkPressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    opacity: 0.85,
  },
  contactsLinkText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.tertiary,
  },
  loadingPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.tertiary,
  },
  list: {
    gap: 10,
  },
});

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export function MessagesSuggestedActions(props: MessagesSuggestedActionsProps) {
  return <MessagesSuggestedActionsInner {...props} />;
}

export default MessagesSuggestedActions;
