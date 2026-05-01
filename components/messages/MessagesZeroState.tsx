/**
 * MessagesZeroState — premium getting-started panel for the right pane
 * (plan §3.9.4 state A, Lane E4).
 *
 * Visible when `selectedThread === null && threadCount === 0`. This is what
 * a brand-new tenant sees the first time they open `/session/messages` —
 * it must NOT be a stock spinner, NOT a generic empty state, NOT "no items
 * yet" boilerplate. Per Framer §12.1 it's a deliberately welcoming premium
 * surface that explains what messaging in Aspire is *for* and gives the
 * owner two clear paths forward plus three Ava-suggested first moves.
 *
 * Layered composition (back to front):
 *   1. Deep-black canvas (#0a0a0c) inherited from page
 *   2. Top accent bar — 1px Aspire-blue gradient line at card top
 *   3. Hero illustration — abstract chat-bubble glyph + cyan ambient halo
 *      (NO stock SVG; constructed from primitives, matches Office Memory
 *      hero language)
 *   4. Title (28/700, white, letter-spacing -0.5)
 *   5. Subtitle (15/400, secondary)
 *   6. Two primary CTAs (Aspire-blue gradient + ghost)
 *   7. Three suggestion cards — one-click compose with Ava-glow on the
 *      "Ava-drafted intro" card
 *
 * Motion (web only, prefers-reduced-motion friendly):
 *   - Hero halo breathes on a 4.4s cycle
 *   - Bubbles float on a slight stagger (3 bubbles, ~300ms apart)
 *   - Card fade-up on mount, 380ms cubic-bezier
 *   - Suggestion cards lift -2px on hover with cyan halo (matches thread row)
 *
 * A11y:
 *   - Title is `accessibilityRole="header"`
 *   - All CTAs have `accessibilityRole="button"` + clear labels
 *   - Suggestion cards have unique `accessibilityHint` describing the
 *     pre-fill behavior
 *   - Decorative bubbles + halo are hidden from the a11y tree
 *   - All tap targets ≥44pt
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, BorderRadius } from '@/constants/tokens';

// ---------------------------------------------------------------------------
// Public props
// ---------------------------------------------------------------------------

export interface MessagesZeroStateProps {
  /** Open the NewMessageSheet (Lane E5 owns the sheet itself). */
  onComposeNew: () => void;
  /** Open the contacts side panel (Lane E5 owns the panel). */
  onOpenContacts: () => void;
}

// ---------------------------------------------------------------------------
// One-time CSS injection (web only) — halos, bubbles, hover lifts
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectZeroStateCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const STYLE_ID = 'messages-zero-state-css';
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Hero halo — slow breath behind the abstract bubble cluster. */
    @keyframes msg-zero-halo-breathe {
      0%, 100% { opacity: 0.55; transform: scale(1); }
      50%      { opacity: 0.85; transform: scale(1.06); }
    }
    .msg-zero-halo { animation: msg-zero-halo-breathe 4400ms ease-in-out infinite; }

    /* Three bubbles drift on a stagger — chat metaphor without a stock SVG. */
    @keyframes msg-zero-bubble-1 {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-6px); }
    }
    @keyframes msg-zero-bubble-2 {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-4px); }
    }
    @keyframes msg-zero-bubble-3 {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-8px); }
    }
    .msg-zero-bubble-1 { animation: msg-zero-bubble-1 3600ms ease-in-out infinite; }
    .msg-zero-bubble-2 { animation: msg-zero-bubble-2 4200ms ease-in-out 250ms infinite; }
    .msg-zero-bubble-3 { animation: msg-zero-bubble-3 3800ms ease-in-out 500ms infinite; }

    /* Mount fade-up — once, not on every prop change. */
    @keyframes msg-zero-fade-up {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .msg-zero-content { animation: msg-zero-fade-up 420ms cubic-bezier(0.16, 1, 0.3, 1) both; }

    /* CTA polish */
    .msg-zero-cta {
      transition: transform 160ms ease-out, background-color 160ms ease-out, box-shadow 160ms ease-out;
    }
    .msg-zero-cta:hover { transform: translateY(-1px); }
    .msg-zero-cta:active { transform: translateY(0); }
    .msg-zero-cta-primary:hover {
      box-shadow: 0 0 0 1px rgba(59,130,246,0.55), 0 8px 22px rgba(59,130,246,0.32);
    }
    .msg-zero-cta-ghost:hover {
      background-color: rgba(255,255,255,0.06);
      border-color: rgba(255,255,255,0.18);
    }
    .msg-zero-cta:focus-visible {
      outline: 2px solid rgba(59,130,246,0.7);
      outline-offset: 2px;
    }

    /* Suggestion cards — same hover language as MessagesThreadList rows. */
    .msg-zero-suggestion {
      transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1),
                  background-color 200ms ease-out,
                  box-shadow 200ms ease-out,
                  border-color 200ms ease-out;
    }
    .msg-zero-suggestion:hover {
      transform: translateY(-2px);
      background-color: rgba(28,28,30,0.95);
      border-color: rgba(59,130,246,0.30);
      box-shadow: 0 0 0 1px rgba(59,130,246,0.18), 0 8px 22px rgba(0,0,0,0.4), 0 0 28px rgba(59,130,246,0.08);
    }
    .msg-zero-suggestion-ava:hover {
      box-shadow: 0 0 0 1px rgba(59,130,246,0.42), 0 8px 22px rgba(0,0,0,0.4), 0 0 32px rgba(59,130,246,0.18);
    }
    .msg-zero-suggestion:focus-visible {
      outline: 2px solid rgba(59,130,246,0.7);
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      .msg-zero-halo,
      .msg-zero-bubble-1,
      .msg-zero-bubble-2,
      .msg-zero-bubble-3,
      .msg-zero-content,
      .msg-zero-cta,
      .msg-zero-suggestion { animation: none; transition: none; }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// HeroBubbles — abstract cluster of three rounded chat bubbles built from
// primitives. NOT a stock chat-bubble SVG. Matches the shape language of
// Office Memory's MemoryEngineHero glyph cluster.
// ---------------------------------------------------------------------------

function HeroBubbles() {
  return (
    <View
      style={heroStyles.bubbleStage}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Soft Aspire-blue ambient halo — sits behind the bubbles. */}
      <View
        style={heroStyles.haloOuter}
        pointerEvents="none"
        {...(Platform.OS === 'web'
          ? ({ className: 'msg-zero-halo' } as any)
          : {})}
      >
        <LinearGradient
          colors={[
            'rgba(59,130,246,0.28)',
            'rgba(59,130,246,0.10)',
            'transparent',
          ]}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill as ViewStyle}
        />
      </View>

      {/* Bubble 1 — large, dark glass, top-left (incoming) */}
      <View
        style={[heroStyles.bubble, heroStyles.bubble1]}
        {...(Platform.OS === 'web'
          ? ({ className: 'msg-zero-bubble-1' } as any)
          : {})}
      >
        <LinearGradient
          colors={['#1F1F22', '#141416']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill as ViewStyle}
        />
        <View style={heroStyles.bubble1Tail} />
      </View>

      {/* Bubble 2 — medium, Aspire-blue gradient, bottom-right (outgoing) */}
      <View
        style={[heroStyles.bubble, heroStyles.bubble2]}
        {...(Platform.OS === 'web'
          ? ({ className: 'msg-zero-bubble-2' } as any)
          : {})}
      >
        <LinearGradient
          colors={[Colors.accent.cyan, Colors.accent.cyanDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill as ViewStyle}
        />
        <View style={heroStyles.bubble2Tail} />
      </View>

      {/* Bubble 3 — small, glass, mid-right (reply forming) */}
      <View
        style={[heroStyles.bubble, heroStyles.bubble3]}
        {...(Platform.OS === 'web'
          ? ({ className: 'msg-zero-bubble-3' } as any)
          : {})}
      >
        <LinearGradient
          colors={['#1A1A1C', '#101012']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill as ViewStyle}
        />
        {/* Three typing dots inside — communicates "draft / forming" */}
        <View style={heroStyles.typingRow}>
          <View style={heroStyles.typingDot} />
          <View style={[heroStyles.typingDot, { opacity: 0.7 }]} />
          <View style={[heroStyles.typingDot, { opacity: 0.45 }]} />
        </View>
      </View>
    </View>
  );
}

const heroStyles = StyleSheet.create({
  bubbleStage: {
    width: 220,
    height: 160,
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 8,
  },
  haloOuter: {
    position: 'absolute',
    top: -30,
    left: -40,
    right: -40,
    bottom: -30,
    borderRadius: 200,
    overflow: 'hidden',
  },
  bubble: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 6px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        } as object)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 10,
        }),
  } as any,
  // Larger left bubble — incoming
  bubble1: {
    width: 116,
    height: 64,
    borderRadius: 22,
    borderBottomLeftRadius: 6,
    top: 16,
    left: 6,
  },
  bubble1Tail: {
    position: 'absolute',
    bottom: -2,
    left: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#141416',
    transform: [{ rotate: '8deg' }],
  },
  // Smaller mid-right bubble — typing/draft
  bubble3: {
    width: 64,
    height: 40,
    borderRadius: 18,
    top: 6,
    right: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Big bottom-right Aspire-blue bubble — outgoing
  bubble2: {
    width: 138,
    height: 60,
    borderRadius: 22,
    borderBottomRightRadius: 6,
    bottom: 12,
    right: 4,
    borderColor: 'rgba(59,130,246,0.45)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 8px 22px rgba(59,130,246,0.32), inset 0 1px 0 rgba(255,255,255,0.18)',
        } as object)
      : {
          shadowColor: Colors.accent.cyan,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 14,
        }),
  } as any,
  bubble2Tail: {
    position: 'absolute',
    bottom: -2,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.accent.cyanDark,
    transform: [{ rotate: '-8deg' }],
  },
  typingRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  typingDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.accent.cyan,
  },
});

// ---------------------------------------------------------------------------
// Suggestion card
// ---------------------------------------------------------------------------

interface SuggestionCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  /** Marks this card as the Ava-drafted variant — gets cyan accent + halo. */
  ava?: boolean;
  onPress: () => void;
}

function SuggestionCard({ icon, title, hint, ava, onPress }: SuggestionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={hint}
      style={({ pressed }) => [
        suggestionStyles.card,
        ava && suggestionStyles.cardAva,
        pressed && suggestionStyles.cardPressed,
      ]}
      {...(Platform.OS === 'web'
        ? ({
            className: `msg-zero-suggestion${ava ? ' msg-zero-suggestion-ava' : ''}`,
          } as any)
        : {})}
    >
      <View
        style={[
          suggestionStyles.iconBox,
          ava && suggestionStyles.iconBoxAva,
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Ionicons
          name={icon}
          size={18}
          color={ava ? '#ffffff' : Colors.text.secondary}
        />
      </View>
      <View style={suggestionStyles.body}>
        <Text style={suggestionStyles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={suggestionStyles.hint} numberOfLines={1}>
          {hint}
        </Text>
      </View>
      <View
        style={suggestionStyles.chevron}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
      </View>
    </Pressable>
  );
}

const suggestionStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: BorderRadius.lg,
    minHeight: 64,
  },
  cardAva: {
    backgroundColor: 'rgba(20,28,46,0.72)',
    borderColor: 'rgba(59,130,246,0.28)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 0 0 1px rgba(59,130,246,0.20), 0 6px 18px rgba(0,0,0,0.32), 0 0 22px rgba(59,130,246,0.12)',
        } as object)
      : {
          shadowColor: Colors.accent.cyan,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
        }),
  } as any,
  cardPressed: {
    opacity: 0.88,
    backgroundColor: '#1A1A1C',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxAva: {
    backgroundColor: Colors.accent.cyan,
    borderColor: 'rgba(255,255,255,0.18)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 0 0 1px rgba(59,130,246,0.55), 0 0 14px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.18)',
        } as object)
      : {
          shadowColor: Colors.accent.cyan,
          shadowOpacity: 0.6,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
        }),
  } as any,
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.05,
    lineHeight: 19,
  },
  hint: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 16,
  },
  chevron: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ---------------------------------------------------------------------------
// Inner component
// ---------------------------------------------------------------------------

function MessagesZeroStateInner({
  onComposeNew,
  onOpenContacts,
}: MessagesZeroStateProps) {
  injectZeroStateCss();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      // Intentional: the panel is centered, not top-aligned. Empty space
      // around the column is part of the composition.
    >
      {/* Top accent bar — 1px Aspire-blue gradient line. Subtle marker that
          this isn't a placeholder; it's a designed surface. */}
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

      <View
        style={styles.column}
        {...(Platform.OS === 'web'
          ? ({ className: 'msg-zero-content' } as any)
          : {})}
      >
        <HeroBubbles />

        <View style={styles.headerCol}>
          <Text style={styles.title} accessibilityRole="header">
            Your messaging starts here
          </Text>
          <Text style={styles.subtitle}>
            Send reminders, follow up on quotes, reply to leads — Aspire keeps
            every conversation tied to the right contact and customer.
          </Text>
        </View>

        <View style={styles.ctaRow}>
          <Pressable
            onPress={onComposeNew}
            accessibilityRole="button"
            accessibilityLabel="Start your first message"
            accessibilityHint="Opens the new message composer"
            style={({ pressed }) => [
              styles.cta,
              styles.ctaPrimary,
              pressed && styles.ctaPrimaryPressed,
            ]}
            {...(Platform.OS === 'web'
              ? ({ className: 'msg-zero-cta msg-zero-cta-primary' } as any)
              : {})}
          >
            <Ionicons name="add" size={16} color="#ffffff" />
            <Text style={styles.ctaPrimaryText}>Start your first message</Text>
          </Pressable>

          <Pressable
            onPress={onOpenContacts}
            accessibilityRole="button"
            accessibilityLabel="View routing contacts"
            accessibilityHint="Opens the contacts side panel"
            style={({ pressed }) => [
              styles.cta,
              styles.ctaGhost,
              pressed && styles.ctaGhostPressed,
            ]}
            {...(Platform.OS === 'web'
              ? ({ className: 'msg-zero-cta msg-zero-cta-ghost' } as any)
              : {})}
          >
            <Ionicons
              name="people-outline"
              size={16}
              color={Colors.text.secondary}
            />
            <Text style={styles.ctaGhostText}>View routing contacts</Text>
          </Pressable>
        </View>

        {/* ---------- Suggestion cards ---------- */}
        <View style={styles.divider} accessibilityElementsHidden />
        <Text style={styles.sectionLabel} accessibilityRole="header">
          A FEW IDEAS TO START
        </Text>

        <View style={styles.suggestions}>
          <SuggestionCard
            icon="notifications-outline"
            title="Send a reminder to a routing contact"
            hint="Owner, sales, support, billing, scheduling"
            onPress={onComposeNew}
          />
          <SuggestionCard
            icon="call-outline"
            title="Reply to a recent caller"
            hint="Pulls from your last 90 days of calls"
            onPress={onComposeNew}
          />
          <SuggestionCard
            icon="sparkles-outline"
            title="Send an Ava-drafted intro to a new lead"
            hint="Ava writes the first draft — you review and send"
            ava
            onPress={onComposeNew}
          />
        </View>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
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
    maxWidth: 480,
    alignItems: 'stretch',
    gap: 18,
  },
  headerCol: {
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.5,
    lineHeight: 34,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 420,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 6,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    minHeight: 44,
  },
  ctaPrimary: {
    backgroundColor: Colors.accent.cyan,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 2px rgba(0,0,0,0.3), 0 6px 16px rgba(59,130,246,0.30)',
        } as object)
      : {
          shadowColor: Colors.accent.cyan,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 10,
        }),
  } as any,
  ctaPrimaryPressed: {
    backgroundColor: Colors.accent.cyanDark,
    opacity: 0.95,
  },
  ctaPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.1,
  },
  ctaGhost: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  ctaGhostPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    opacity: 0.95,
  },
  ctaGhostText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: 18,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: Colors.text.muted,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  suggestions: {
    gap: 8,
    marginTop: 6,
  },
});

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export function MessagesZeroState(props: MessagesZeroStateProps) {
  return <MessagesZeroStateInner {...props} />;
}

export default MessagesZeroState;
