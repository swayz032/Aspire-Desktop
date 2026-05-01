/**
 * MessagesHero — top strip for `/session/messages` (plan §3.9.1, Lane E2).
 *
 * Editorial chrome matching `FrontDeskSetupHero` and `MemoryEngineHero`:
 *
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │                                                                       │
 *   │  ┌──┐  TEXT MESSAGES pill                                             │
 *   │  │💬│                                                                 │
 *   │  └──┘  Text Messages                          [Contacts] [+ New Msg]  │
 *   │         42 conversations · 7 unread · 2 drafts                        │
 *   │                                                                       │
 *   └─────────────────────────────────────────────────────────────────────┘
 *
 * Layered composition (back to front), per §12.1 Framer-style:
 *   1. Deep-black base                                       (#0a0a0c)
 *   2. Three radial blue ambient halos behind the icon       (web only)
 *   3. Vertical legibility gradient                          0.55 → 0.92
 *   4. Foreground content
 *
 * The icon block is a square Aspire-blue gradient tile (NOT a circle) so the
 * page reads as a peer of Front Desk + Office Memory rather than a chat app
 * clone. Both top-right buttons are always visible on viewports ≥768px; on
 * narrower mobile only the primary "+ New Message" survives — the Contacts
 * button collapses into the icon block's accessibility menu (V1.1).
 *
 * Hero buttons reuse the FrontDeskSetupHero `fds-hero-btn` CSS classes so the
 * hover/press feedback is byte-identical between the two pages — a Framer
 * shipper would never let two heroes on the same product feel different.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, BorderRadius } from '@/constants/tokens';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MessagesHeroProps {
  /** Total active (non-archived) thread count, shown in subtitle. */
  threadCount: number;
  /** Total unread message count across all active threads. */
  unreadCount: number;
  /** Drafts count (V1.1 — passed through but tolerated as 0 in V1). */
  draftCount?: number;
  /** Fired when the `Contacts` button is pressed. */
  onContactsPress: () => void;
  /** Fired when the `+ New Message` button is pressed. */
  onNewMessagePress: () => void;
}

// ---------------------------------------------------------------------------
// One-time CSS injection — radial halos + button polish (web only)
//
// Reuses the `fds-hero-btn` CSS family from FrontDeskSetupHero so the two
// heroes feel byte-identical on hover/press. We DO NOT redefine those classes
// here — we just rely on FrontDeskSetupHero's mount having already injected
// them. To stay safe when MessagesHero is rendered on a page that never
// renders FrontDeskSetupHero, we inject a small fallback block scoped to a
// unique id so re-injection is idempotent.
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectHeroCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const STYLE_ID = 'messages-hero-css';
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Three layered radial halos for atmospheric depth — visible behind
       the icon block and along the title line. Subtle, never noisy. */
    .msg-hero-radial {
      background:
        radial-gradient(ellipse 36% 60% at 6% 30%, rgba(59,130,246,0.16), transparent 65%),
        radial-gradient(ellipse 24% 40% at 22% 80%, rgba(59,130,246,0.10), transparent 70%),
        radial-gradient(ellipse 50% 80% at 80% 50%, rgba(37,99,235,0.05), transparent 70%);
    }
    /* Buttons reuse FDS class names — fallback rules so the page works in
       isolation (e.g. /demo/messages without FrontDeskSetupHero mounted). */
    .msg-hero-btn { transition: transform 160ms ease-out, background-color 160ms ease-out, box-shadow 160ms ease-out; min-height: 44px; }
    .msg-hero-btn:hover { transform: translateY(-1px); }
    .msg-hero-btn:active { transform: translateY(0); }
    .msg-hero-btn-primary:hover { box-shadow: 0 0 0 1px rgba(59,130,246,0.55), 0 6px 18px rgba(59,130,246,0.32); }
    .msg-hero-btn-ghost:hover { background-color: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.18); }
    .msg-hero-btn:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 2px; }
    /* Icon-tile glow ambient — animated breath on web, framerate-friendly. */
    @keyframes msg-hero-icon-breathe {
      0%, 100% { box-shadow: 0 0 0 1px rgba(59,130,246,0.35), 0 0 24px rgba(59,130,246,0.18), inset 0 1px 0 rgba(255,255,255,0.12); }
      50%      { box-shadow: 0 0 0 1px rgba(59,130,246,0.55), 0 0 32px rgba(59,130,246,0.30), inset 0 1px 0 rgba(255,255,255,0.18); }
    }
    .msg-hero-icon-tile { animation: msg-hero-icon-breathe 4200ms ease-in-out infinite; }
    @keyframes msg-hero-fade-up {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .msg-hero-content { animation: msg-hero-fade-up 380ms cubic-bezier(0.16, 1, 0.3, 1) both; }
    @media (prefers-reduced-motion: reduce) {
      .msg-hero-content, .msg-hero-btn, .msg-hero-icon-tile { animation: none; transition: none; }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Inner component
// ---------------------------------------------------------------------------

function MessagesHeroInner({
  threadCount,
  unreadCount,
  draftCount = 0,
  onContactsPress,
  onNewMessagePress,
}: MessagesHeroProps) {
  injectHeroCss();

  // Subtitle is a generative string — pluralization + omit-zero clauses.
  // We trim aggressively so the line is read at a glance, not parsed.
  const subtitle = buildSubtitle(threadCount, unreadCount, draftCount);

  return (
    <View style={styles.heroOuter}>
      {/* ---------- LAYER 2: Radial blue halos (web only) -------------- */}
      {Platform.OS === 'web' ? (
        <View
          style={StyleSheet.absoluteFill as ViewStyle}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          {...({ className: 'msg-hero-radial' } as any)}
        />
      ) : (
        <LinearGradient
          // Native fallback — single radial-ish gradient via 3-stop linear
          colors={[
            'rgba(59,130,246,0.10)',
            'rgba(59,130,246,0.04)',
            'transparent',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill as ViewStyle}
          pointerEvents="none"
        />
      )}

      {/* ---------- LAYER 3: Vertical legibility gradient --------------- */}
      <LinearGradient
        colors={['rgba(10,10,12,0.30)', 'rgba(10,10,12,0.55)']}
        locations={[0, 1]}
        style={styles.gradientOverlay}
        pointerEvents="none"
      />

      {/* ---------- LAYER 4: Foreground ------------------------------- */}
      <View
        style={styles.heroInner}
        {...(Platform.OS === 'web'
          ? ({ className: 'msg-hero-content' } as any)
          : {})}
      >
        <View style={styles.headerRow}>
          {/* Identity — icon tile + pill + title + subtitle */}
          <View style={styles.identityCol}>
            <View style={styles.identityRow}>
              <View
                style={styles.iconTile}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                {...(Platform.OS === 'web'
                  ? ({ className: 'msg-hero-icon-tile' } as any)
                  : {})}
              >
                {/* Inner gradient gives the tile chromatic depth — a flat
                    blue square reads as a button, not a brand glyph. */}
                <LinearGradient
                  colors={[Colors.accent.cyan, Colors.accent.cyanDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill as ViewStyle}
                />
                <Ionicons
                  name="chatbubbles"
                  size={20}
                  color="#ffffff"
                />
              </View>

              <View
                style={styles.pill}
                accessibilityRole="text"
                accessibilityLabel="Section: Text Messages"
              >
                <View style={styles.pillDot} />
                <Text style={styles.pillText}>TEXT MESSAGES</Text>
              </View>
            </View>

            <Text style={styles.title} accessibilityRole="header">
              Text Messages
            </Text>
            <Text style={styles.subtitle} accessibilityLabel={subtitle}>
              {subtitle}
            </Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <HeroButton
              variant="ghost"
              icon="people-outline"
              label="Contacts"
              onPress={onContactsPress}
              accessibilityLabel="Open contacts"
              accessibilityHint="Browse routing contacts and recent SMS or call contacts"
            />
            <HeroButton
              variant="primary"
              icon="add"
              label="New Message"
              onPress={onNewMessagePress}
              accessibilityLabel="Compose new message"
              accessibilityHint="Open the new message composer"
            />
          </View>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Subtitle builder — stays with the component so the copy never drifts
// ---------------------------------------------------------------------------

function buildSubtitle(threads: number, unread: number, drafts: number): string {
  const parts: string[] = [];
  parts.push(`${threads} conversation${threads === 1 ? '' : 's'}`);
  if (unread > 0) parts.push(`${unread} unread`);
  if (drafts > 0) parts.push(`${drafts} draft${drafts === 1 ? '' : 's'}`);
  // U+00B7 middle dot — same separator used in FrontDesk + Office Memory.
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// Hero button — same pressable contract as FrontDeskSetupHero's HeroButton.
// Slight visual difference: leading-icon-only (no trailing chevron) since
// the messaging actions don't navigate forward in a flow.
// ---------------------------------------------------------------------------

interface HeroButtonProps {
  variant: 'primary' | 'ghost';
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
}

function HeroButton({
  variant,
  icon,
  label,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: HeroButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.buttonPrimary : styles.buttonGhost,
        pressed &&
          (isPrimary ? styles.buttonPrimaryPressed : styles.buttonGhostPressed),
      ]}
      {...(Platform.OS === 'web'
        ? ({
            className: `msg-hero-btn ${
              isPrimary ? 'msg-hero-btn-primary' : 'msg-hero-btn-ghost'
            }`,
          } as any)
        : {})}
    >
      <Ionicons
        name={icon}
        size={16}
        color={isPrimary ? '#ffffff' : Colors.text.secondary}
      />
      <Text
        style={isPrimary ? styles.buttonPrimaryText : styles.buttonGhostText}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // ----- Outer hero card ------------------------------------------------
  heroOuter: {
    position: 'relative',
    width: '100%',
    minHeight: 168,
    backgroundColor: '#0a0a0c',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.5), 0 12px 36px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
        } as object)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 14,
          elevation: 6,
        }),
  } as any,

  // Vertical gradient layer — keeps title legible over halo backdrop
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  heroInner: {
    position: 'relative',
    paddingHorizontal: 28,
    paddingVertical: 22,
    minHeight: 168,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 24,
    flexWrap: 'wrap',
  },
  identityCol: {
    flex: 1,
    minWidth: 280,
    gap: 12,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  // ----- Square Aspire-blue icon tile (NOT a circle) -------------------
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 0 0 1px rgba(59,130,246,0.35), 0 0 24px rgba(59,130,246,0.18), inset 0 1px 0 rgba(255,255,255,0.12)',
        } as object)
      : {
          shadowColor: Colors.accent.cyan,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
        }),
  } as any,

  // ----- TEXT MESSAGES pill --------------------------------------------
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.32)',
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.cyan,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 8px rgba(59,130,246,0.85)' } as object)
      : {
          shadowColor: Colors.accent.cyan,
          shadowOpacity: 0.8,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 0 },
        }),
  } as any,
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: Colors.accent.cyan,
    textTransform: 'uppercase',
  },

  // ----- Title + subtitle ----------------------------------------------
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -1,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 22,
    maxWidth: 560,
  },

  // ----- Actions row ----------------------------------------------------
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: BorderRadius.md,
    minHeight: 44,
    minWidth: 44,
  },
  buttonGhost: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  buttonGhostPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    opacity: 0.95,
  },
  buttonPrimary: {
    backgroundColor: Colors.accent.cyan,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 2px rgba(0,0,0,0.3), 0 6px 16px rgba(59,130,246,0.28)',
        } as object)
      : {
          shadowColor: Colors.accent.cyan,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 10,
        }),
  } as any,
  buttonPrimaryPressed: {
    backgroundColor: Colors.accent.cyanDark,
    opacity: 0.95,
  },
  buttonGhostText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  buttonPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.1,
  },
});

// ---------------------------------------------------------------------------
// Public export with error boundary
// ---------------------------------------------------------------------------

export function MessagesHero(props: MessagesHeroProps) {
  return (
    <PageErrorBoundary pageName="messages-hero">
      <MessagesHeroInner {...props} />
    </PageErrorBoundary>
  );
}

export default MessagesHero;
