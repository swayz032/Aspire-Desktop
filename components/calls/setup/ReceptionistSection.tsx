/**
 * ReceptionistSection — Front Desk Setup §0 (plan: receptionist persona picker).
 *
 * Lets the operator choose the AI receptionist persona that answers their
 * inbound calls. Backed by:
 *   - GET  /api/v1/front-desk/personas — static registry (Sarah, Tiffany, ...)
 *   - PATCH /api/v1/front-desk/config { receptionist_persona } — versioned
 *     write that re-attaches the EL phone number to the new agent.
 *
 * Audio preview is a pre-rendered MP3 served as a static asset
 * (`/personas/<slug>.mp3`) — same voice the agent uses on live calls. Zero
 * per-preview ElevenLabs cost.
 *
 * Visual:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  ⓪ Choose your AI receptionist                                │
 *   │     Try each voice. Saved changes apply to the next call.    │
 *   │                                                               │
 *   │  ┌─────────────┐  ┌─────────────┐                              │
 *   │  │ [Sarah pic] │  │ [Tiffany   ]│                              │
 *   │  │ Sarah       │  │ Tiffany    │                              │
 *   │  │ AI Front…   │  │ AI Front…  │                              │
 *   │  │ ▶ Preview   │  │ ▶ Preview  │                              │
 *   │  └─────────────┘  └─────────────┘                              │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Per §12.1 Framer-style: every persona card has hover lift, focus ring,
 * ≥44pt tap targets; selected uses persona-accent ring + soft glow. The
 * preview button is a discrete control inside the card so the whole card
 * remains clickable for selection without firing audio every time.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import { SectionPanel } from './SectionPanel';
import type { ReceptionistPersonaWire, ReceptionistPersonaSlug } from '@/lib/api/frontDesk';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReceptionistSectionProps {
  /** Currently selected persona slug. Persists from front_desk_configs. */
  selectedSlug: ReceptionistPersonaSlug;
  /** Available personas — fetched from GET /v1/front-desk/personas. */
  personas: readonly ReceptionistPersonaWire[];
  /** Loading state for the personas fetch. */
  isLoading?: boolean;
  /** Error from the personas fetch. */
  error?: string | null;
  /** Selection callback — page promotes this into the dirty diff. */
  onChange: (slug: ReceptionistPersonaSlug) => void;
  /** Optional zero-based index for staggered entrance. */
  enterIndex?: number;
}

// ---------------------------------------------------------------------------
// One-time CSS — card hover lift + focus ring + reduced-motion respect
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.id = 'fds-receptionist-css';
  style.textContent = `
    .fds-rcpt-card {
      transition: border-color 180ms cubic-bezier(0.16,1,0.3,1),
                  background-color 180ms ease-out,
                  box-shadow 200ms ease-out,
                  transform 160ms ease-out;
    }
    .fds-rcpt-card:hover {
      transform: translateY(-2px);
      border-color: rgba(255,255,255,0.18);
    }
    .fds-rcpt-card:focus-visible {
      outline: 2px solid rgba(59,130,246,0.7);
      outline-offset: 3px;
    }
    .fds-rcpt-preview-btn {
      transition: background-color 140ms ease-out, color 140ms ease-out, transform 120ms ease-out;
    }
    .fds-rcpt-preview-btn:hover { background-color: rgba(255,255,255,0.10); }
    .fds-rcpt-preview-btn:active { transform: scale(0.97); }
    .fds-rcpt-preview-btn:focus-visible {
      outline: 2px solid rgba(59,130,246,0.7);
      outline-offset: 2px;
    }
    @keyframes fds-rcpt-pulse {
      0%, 100% { transform: scale(1); }
      50%      { transform: scale(1.06); }
    }
    .fds-rcpt-pulse { animation: fds-rcpt-pulse 1.4s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) {
      .fds-rcpt-card, .fds-rcpt-preview-btn, .fds-rcpt-pulse { transition: none; animation: none; }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Initials helper — fallback when headshot 404s or persona has no image.
// ---------------------------------------------------------------------------

function initialsOf(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReceptionistSection({
  selectedSlug,
  personas,
  isLoading,
  error,
  onChange,
  enterIndex = 0,
}: ReceptionistSectionProps) {
  injectCss();

  // One <audio> element per render — only one preview plays at a time. Pause
  // any other previews when a new one starts. Native fallback uses the same
  // logical state but no actual audio (RN <Audio> would require expo-av; the
  // preview button just shows a "Preview not supported" hint instead).
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingSlug, setPlayingSlug] = useState<ReceptionistPersonaSlug | null>(null);

  // Stop any playback on unmount (avoid orphan audio if the page swaps tabs).
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {
          /* swallow */
        }
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlayPreview = useCallback(
    (persona: ReceptionistPersonaWire) => {
      if (Platform.OS !== 'web' || typeof Audio === 'undefined') {
        // Native: TODO wire expo-av AudioPlayer if/when this section ships
        // beyond web. For now we just no-op silently — the button is hidden
        // on native via the `Platform.OS === 'web'` gate below.
        return;
      }
      // If currently playing this persona, stop and exit (toggle behavior).
      if (audioRef.current && playingSlug === persona.slug) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch {
          /* swallow */
        }
        audioRef.current = null;
        setPlayingSlug(null);
        return;
      }
      // Stop any other playing preview.
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {
          /* swallow */
        }
        audioRef.current = null;
      }
      try {
        const a = new Audio(persona.preview_url);
        a.preload = 'auto';
        a.onended = () => {
          setPlayingSlug((s) => (s === persona.slug ? null : s));
          audioRef.current = null;
        };
        a.onerror = () => {
          setPlayingSlug((s) => (s === persona.slug ? null : s));
          audioRef.current = null;
        };
        audioRef.current = a;
        setPlayingSlug(persona.slug);
        const playPromise = a.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            // Autoplay blocked or other browser error — clear state.
            setPlayingSlug((s) => (s === persona.slug ? null : s));
            audioRef.current = null;
          });
        }
      } catch {
        /* swallow — preview is best-effort */
      }
    },
    [playingSlug],
  );

  const sortedPersonas = useMemo(() => personas.slice(), [personas]);

  return (
    <SectionPanel
      step={0}
      title="Choose your AI receptionist"
      caption="Try each voice. You can switch anytime — saved changes apply to the next call."
      enterIndex={enterIndex}
    >
      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Colors.accent.cyan as string} />
          <Text style={styles.loadingText}>Loading personas…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={16} color={Colors.semantic.error as string} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <View style={styles.cardsRow}>
          {sortedPersonas.map((persona) => {
            const isSelected = persona.slug === selectedSlug;
            const isPlaying = playingSlug === persona.slug;
            return (
              <PersonaCard
                key={persona.slug}
                persona={persona}
                isSelected={isSelected}
                isPlaying={isPlaying}
                onSelect={() => onChange(persona.slug)}
                onPlay={() => handlePlayPreview(persona)}
              />
            );
          })}
        </View>
      )}

      <View style={styles.footnoteRow}>
        <Ionicons name="information-circle-outline" size={14} color={Colors.text.tertiary as string} />
        <Text style={styles.footnote}>
          Voices preview here are the same voices used on real calls. No surprises.
        </Text>
      </View>
    </SectionPanel>
  );
}

// ---------------------------------------------------------------------------
// PersonaCard — internal subcomponent
// ---------------------------------------------------------------------------

interface PersonaCardProps {
  persona: ReceptionistPersonaWire;
  isSelected: boolean;
  isPlaying: boolean;
  onSelect: () => void;
  onPlay: () => void;
}

function PersonaCard({
  persona,
  isSelected,
  isPlaying,
  onSelect,
  onPlay,
}: PersonaCardProps) {
  const [headshotFailed, setHeadshotFailed] = useState(false);

  // Pressing the preview button must NOT also fire the card's onSelect.
  // We swallow the synthetic event with stopPropagation on web; on native
  // Pressables already isolate hits to their own bounds so no extra work.
  const onPlayPress = useCallback(
    (e: any) => {
      if (e?.stopPropagation) e.stopPropagation();
      if (e?.preventDefault) e.preventDefault();
      onPlay();
    },
    [onPlay],
  );

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityLabel={`Pick ${persona.display_name} as your receptionist`}
      accessibilityState={{ selected: isSelected, checked: isSelected }}
      style={({ pressed }) => [
        styles.card,
        isSelected && {
          borderColor: persona.accent_color,
          backgroundColor: 'rgba(255,255,255,0.025)',
          ...(Platform.OS === 'web'
            ? ({
                boxShadow:
                  `0 0 0 1px ${persona.accent_color}, 0 0 32px ${persona.accent_color}33, inset 0 1px 0 rgba(255,255,255,0.04)`,
              } as object)
            : {
                shadowColor: persona.accent_color,
                shadowOpacity: 0.45,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 0 },
                elevation: 4,
              }),
        },
        pressed && { opacity: 0.92 },
      ]}
      {...(Platform.OS === 'web' ? ({ className: 'fds-rcpt-card' } as any) : {})}
    >
      {/* Headshot or initials chip */}
      <View style={styles.headshotWrap}>
        {!headshotFailed ? (
          <Image
            source={{ uri: persona.headshot_url }}
            onError={() => setHeadshotFailed(true)}
            style={styles.headshotImage}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View
            style={[
              styles.initialsChip,
              { backgroundColor: persona.accent_color + '22', borderColor: persona.accent_color + '66' },
            ]}
            accessibilityElementsHidden
          >
            <Text style={[styles.initialsText, { color: persona.accent_color }]}>
              {initialsOf(persona.display_name)}
            </Text>
          </View>
        )}
        {isSelected ? (
          <View
            style={[
              styles.selectedTick,
              { borderColor: persona.accent_color, backgroundColor: persona.accent_color },
            ]}
            accessibilityElementsHidden
          >
            <Ionicons name="checkmark" size={12} color="#0a0a0c" />
          </View>
        ) : null}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.displayName} numberOfLines={1}>
          {persona.display_name}
        </Text>
        <Text style={styles.roleLabel} numberOfLines={1}>
          {persona.role_label}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {persona.description}
        </Text>
      </View>

      {/* Preview button — only on web (native fallback would need expo-av) */}
      {Platform.OS === 'web' ? (
        <Pressable
          onPress={onPlayPress}
          accessibilityRole="button"
          accessibilityLabel={
            isPlaying ? `Stop ${persona.display_name}'s voice preview` : `Preview ${persona.display_name}'s voice`
          }
          style={({ pressed }) => [
            styles.previewBtn,
            isPlaying && { backgroundColor: persona.accent_color + '22', borderColor: persona.accent_color },
            pressed && { opacity: 0.85 },
          ]}
          {...(Platform.OS === 'web' ? ({ className: 'fds-rcpt-preview-btn' } as any) : {})}
        >
          <View
            style={styles.previewIconWrap}
            {...(isPlaying && Platform.OS === 'web' ? ({ className: 'fds-rcpt-pulse' } as any) : {})}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={14}
              color={isPlaying ? (persona.accent_color as string) : (Colors.text.primary as string)}
            />
          </View>
          <Text
            style={[
              styles.previewLabel,
              isPlaying && { color: persona.accent_color },
            ]}
          >
            {isPlaying ? 'Playing…' : 'Preview voice'}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.previewBtnDisabled}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.text.tertiary as string} />
          <Text style={styles.previewLabel}>Preview on web</Text>
        </View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const HEADSHOT_SIZE = 64;

const styles = StyleSheet.create({
  cardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },

  // ----- Card ----------------------------------------------------------
  card: {
    flexBasis: 280,
    flexGrow: 1,
    minWidth: 240,
    backgroundColor: 'rgba(255,255,255,0.015)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    gap: 14,
    minHeight: 220,
  } as any,

  // ----- Headshot ------------------------------------------------------
  headshotWrap: {
    width: HEADSHOT_SIZE,
    height: HEADSHOT_SIZE,
    position: 'relative',
  },
  headshotImage: {
    width: HEADSHOT_SIZE,
    height: HEADSHOT_SIZE,
    borderRadius: HEADSHOT_SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  initialsChip: {
    width: HEADSHOT_SIZE,
    height: HEADSHOT_SIZE,
    borderRadius: HEADSHOT_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  initialsText: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  selectedTick: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },

  // ----- Body ---------------------------------------------------------
  cardBody: {
    gap: 4,
  },
  displayName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  roleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.tertiary,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.secondary,
    lineHeight: 18,
    marginTop: 4,
  },

  // ----- Preview button -----------------------------------------------
  previewBtn: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    height: 36,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
  } as any,
  previewBtnDisabled: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    height: 32,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  previewIconWrap: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: 0.1,
  },

  // ----- Loading + error -----------------------------------------------
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.text.tertiary,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 13,
    color: Colors.semantic.error,
  },

  // ----- Footnote ------------------------------------------------------
  footnoteRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footnote: {
    fontSize: 12,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },
});

export default ReceptionistSection;
