/**
 * FrontDeskSetupHero — Pass 10 Lane B (plan §10.2)
 *
 * Full-width hero header for the Front Desk Setup page. Replaces the legacy
 * `inbox-hero.jpg` photo with a living `AvaOrbVideo` ambient backdrop —
 * Aspire's premium aesthetic: deep-black canvas + Aspire-blue ambient glow +
 * pulsing presence orb. Subagent operates per §12.1 Framer-style mandate.
 *
 * Layered composition (back to front):
 *   1. Deep-black base                            (#0a0a0c)
 *   2. AvaOrbVideo backdrop (520x520, opacity .30, offset right of center)
 *   3. expo-blur BlurView intensity 50            (atmospheric softening)
 *   4. Aspire-blue tint overlay                   (rgba(59,130,246,0.06))
 *   5. Vertical legibility gradient               (top→bottom darken)
 *   6. Foreground content                         (orb-96 + badge + title + actions)
 *
 * Interaction:
 *   - Test Incoming Call button (ghost) → onTest()
 *   - Save Changes button (filled cyan) → onSave(); disabled until isDirty
 *   - Both buttons web hover lift (-1px) + focus ring (Aspire blue 2px)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ViewStyle,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { AvaOrbVideo } from '@/components/AvaOrbVideo';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FrontDeskSetupHeroProps {
  /** Fired when the Save Changes button is pressed */
  onSave: () => void;
  /** Fired when the Test Incoming Call button is pressed */
  onTest: () => void;
  /** When true, show an inline spinner inside the Save button */
  isSaving?: boolean;
  /** When true, show an inline spinner inside the Test button */
  isTesting?: boolean;
  /** When false, the Save Changes button is disabled and dimmed */
  isDirty?: boolean;
  /** Optional — controls the small foreground orb's animated state */
  sarahActive?: boolean;
}

// ---------------------------------------------------------------------------
// One-time CSS injection for hover + focus polish (web only)
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectHeroCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.id = 'front-desk-setup-hero-css';
  style.textContent = `
    .fds-hero-btn { transition: transform 160ms ease-out, background-color 160ms ease-out, box-shadow 160ms ease-out; }
    .fds-hero-btn:hover { transform: translateY(-1px); }
    .fds-hero-btn:active { transform: translateY(0); }
    .fds-hero-btn-primary:hover { box-shadow: 0 0 0 1px rgba(59,130,246,0.55), 0 6px 18px rgba(59,130,246,0.32); }
    .fds-hero-btn-ghost:hover { background-color: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.18); }
    .fds-hero-btn:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 2px; }
    @keyframes fds-hero-fade-up {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fds-hero-content { animation: fds-hero-fade-up 380ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Inner component
// ---------------------------------------------------------------------------

function FrontDeskSetupHeroInner({
  onSave,
  onTest,
  isSaving = false,
  isTesting = false,
  isDirty = false,
  sarahActive = true,
}: FrontDeskSetupHeroProps) {
  injectHeroCss();

  const orbState = sarahActive ? 'idle' : 'idle';

  return (
    <View style={styles.heroOuter}>
      {/* ---------- LAYER 2: Ambient AvaOrb backdrop (very low opacity) -- */}
      <View style={styles.backdropOrbWrap} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.backdropOrbInner}>
          <AvaOrbVideo state={orbState} size={520} />
        </View>
      </View>

      {/* ---------- LAYER 3: Atmospheric blur softening ----------------- */}
      {Platform.OS === 'web' ? (
        <View style={styles.blurOverlay} pointerEvents="none">
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill as ViewStyle} />
        </View>
      ) : null}

      {/* ---------- LAYER 4: Aspire-blue tint --------------------------- */}
      <View style={styles.blueTint} pointerEvents="none" />

      {/* ---------- LAYER 5: Vertical legibility gradient --------------- */}
      <LinearGradient
        colors={['rgba(10,10,12,0.55)', 'rgba(10,10,12,0.85)', 'rgba(10,10,12,0.97)']}
        locations={[0, 0.55, 1]}
        style={styles.gradientOverlay}
        pointerEvents="none"
      />

      {/* ---------- LAYER 6: Foreground content ------------------------- */}
      <View
        style={styles.heroInner}
        {...(Platform.OS === 'web' ? ({ className: 'fds-hero-content' } as any) : {})}
      >
        <View style={styles.headerRow}>
          <View style={styles.identityCol}>
            <View style={styles.identityRow}>
              {/* Small live-presence orb */}
              <View style={styles.smallOrbWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <View style={styles.smallOrbHalo} />
                <AvaOrbVideo state={orbState} size={64} />
              </View>

              {/* FRONT DESK pill */}
              <View style={styles.pill} accessibilityRole="text" accessibilityLabel="Section: Front Desk">
                <View style={styles.pillDot} />
                <Text style={styles.pillText}>FRONT DESK</Text>
              </View>
            </View>

            <Text style={styles.title} accessibilityRole="header">
              Front Desk Setup
            </Text>
            <Text style={styles.subtitle}>
              Configure what Sarah handles and who gets the call note.
            </Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <HeroButton
              variant="ghost"
              icon="call-outline"
              label="Test Incoming Call"
              onPress={onTest}
              loading={isTesting}
              disabled={isTesting}
              accessibilityLabel="Test incoming call"
              accessibilityHint="Trigger a simulated incoming call to preview Sarah's behavior"
            />
            <HeroButton
              variant="primary"
              icon="checkmark-circle"
              trailingIcon="chevron-forward"
              label="Save Changes"
              onPress={onSave}
              loading={isSaving}
              disabled={isSaving || !isDirty}
              accessibilityLabel="Save changes"
              accessibilityHint={isDirty ? 'Persist your Front Desk configuration' : 'No unsaved changes'}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Hero button — inner component
// ---------------------------------------------------------------------------

interface HeroButtonProps {
  variant: 'primary' | 'ghost';
  icon: keyof typeof Ionicons.glyphMap;
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
}

function HeroButton({
  variant,
  icon,
  trailingIcon,
  label,
  onPress,
  loading,
  disabled,
  accessibilityLabel,
  accessibilityHint,
}: HeroButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.buttonPrimary : styles.buttonGhost,
        pressed && (isPrimary ? styles.buttonPrimaryPressed : styles.buttonGhostPressed),
        disabled && styles.buttonDisabled,
      ]}
      {...(Platform.OS === 'web'
        ? ({
            className: `fds-hero-btn ${isPrimary ? 'fds-hero-btn-primary' : 'fds-hero-btn-ghost'}`,
          } as any)
        : {})}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isPrimary ? '#ffffff' : Colors.text.secondary}
        />
      ) : (
        <Ionicons
          name={icon}
          size={16}
          color={isPrimary ? '#ffffff' : Colors.text.secondary}
        />
      )}
      <Text style={isPrimary ? styles.buttonPrimaryText : styles.buttonGhostText}>
        {label}
      </Text>
      {trailingIcon && !loading ? (
        <Ionicons
          name={trailingIcon}
          size={14}
          color={isPrimary ? 'rgba(255,255,255,0.85)' : Colors.text.tertiary}
        />
      ) : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const HERO_HEIGHT = 220;

const styles = StyleSheet.create({
  // ----- Outer hero card -------------------------------------------------
  heroOuter: {
    position: 'relative',
    width: '100%',
    minHeight: HERO_HEIGHT,
    backgroundColor: '#0a0a0c',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
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

  // ----- Layer 2: Ambient orb backdrop ----------------------------------
  backdropOrbWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 600,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.30,
  },
  backdropOrbInner: {
    transform: [{ translateX: 80 }, { translateY: 0 }],
    opacity: 1,
  },

  // ----- Layer 3: Blur overlay ------------------------------------------
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // ----- Layer 4: Blue tint ---------------------------------------------
  blueTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(59,130,246,0.06)',
  },

  // ----- Layer 5: Vertical gradient -------------------------------------
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // ----- Layer 6: Foreground content ------------------------------------
  heroInner: {
    position: 'relative',
    paddingHorizontal: 28,
    paddingVertical: 24,
    minHeight: HERO_HEIGHT,
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
    gap: 14,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  smallOrbWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.32)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 0 4px rgba(59,130,246,0.10), 0 0 18px rgba(59,130,246,0.24)' } as object)
      : { shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8 }),
  } as any,
  smallOrbHalo: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.45)',
  },

  // ----- FRONT DESK pill ------------------------------------------------
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
      : { shadowColor: Colors.accent.cyan, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }),
  } as any,
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: Colors.accent.cyan,
    textTransform: 'uppercase',
  },

  // ----- Title + subtitle -----------------------------------------------
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 22,
    maxWidth: 560,
  },

  // ----- Action buttons -------------------------------------------------
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
      ? ({ boxShadow: '0 1px 2px rgba(0,0,0,0.3), 0 6px 16px rgba(59,130,246,0.28)' } as object)
      : { shadowColor: Colors.accent.cyan, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }),
  } as any,
  buttonPrimaryPressed: {
    backgroundColor: Colors.accent.cyanDark,
    opacity: 0.95,
  },
  buttonDisabled: {
    opacity: 0.45,
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

export function FrontDeskSetupHero(props: FrontDeskSetupHeroProps) {
  return (
    <PageErrorBoundary pageName="front-desk-setup-hero">
      <FrontDeskSetupHeroInner {...props} />
    </PageErrorBoundary>
  );
}

export default FrontDeskSetupHero;
