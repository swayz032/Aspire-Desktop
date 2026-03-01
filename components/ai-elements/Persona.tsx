/**
 * Persona — Real Rive-powered AI agent orb (Vercel AI Elements)
 *
 * Uses @rive-app/react-webgl2 to render premium .riv animations
 * with state machine inputs for voice interaction states.
 *
 * Variants (each is a unique visual style):
 *   obsidian, command, glint, halo, mana, opal
 *
 * States (driven by state machine inputs):
 *   idle → listening → thinking → speaking → asleep
 *
 * Web: Full Rive WebGL2 animation
 * Native: Fallback gradient orb (Rive WebGL2 is web-only)
 */

import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Platform, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PersonaState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'asleep';

export type PersonaVariant = 'obsidian' | 'command' | 'glint' | 'halo' | 'mana' | 'opal';

interface PersonaProps {
  state: PersonaState;
  variant?: PersonaVariant;
  /** CSS class name for sizing (web only, e.g. 'size-32') */
  className?: string;
  /** React Native style override */
  style?: any;
  /** Callback when Rive animation is ready */
  onReady?: () => void;
  /** Callback on Rive load error */
  onLoadError?: (err: any) => void;
}

// ---------------------------------------------------------------------------
// Rive animation sources (hosted on Vercel blob storage)
// ---------------------------------------------------------------------------

const sources: Record<PersonaVariant, {
  source: string;
  dynamicColor: boolean;
  hasModel: boolean;
}> = {
  command: {
    dynamicColor: true,
    hasModel: true,
    source: 'https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/command-2.0.riv',
  },
  glint: {
    dynamicColor: true,
    hasModel: true,
    source: 'https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/glint-2.0.riv',
  },
  halo: {
    dynamicColor: true,
    hasModel: true,
    source: 'https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/halo-2.0.riv',
  },
  mana: {
    dynamicColor: false,
    hasModel: true,
    source: 'https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/mana-2.0.riv',
  },
  obsidian: {
    dynamicColor: true,
    hasModel: true,
    source: 'https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/obsidian-2.0.riv',
  },
  opal: {
    dynamicColor: false,
    hasModel: false,
    source: 'https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/orb-1.2.riv',
  },
};

const stateMachine = 'default';

// ---------------------------------------------------------------------------
// Web: Real Rive Persona (WebGL2)
// ---------------------------------------------------------------------------

function PersonaWeb({ state, variant = 'obsidian', style, onReady, onLoadError }: PersonaProps) {
  // Dynamic import refs — Rive loaded at runtime (web-only)
  const riveRef = useRef<any>(null);
  const riveComponentRef = useRef<any>(null);
  const inputsRef = useRef<{
    listening: any;
    thinking: any;
    speaking: any;
    asleep: any;
  }>({ listening: null, thinking: null, speaking: null, asleep: null });
  const [loaded, setLoaded] = useState(false);
  const [RiveModule, setRiveModule] = useState<any>(null);

  // Load Rive module dynamically (avoids SSR/native crash)
  useEffect(() => {
    let cancelled = false;
    import('@rive-app/react-webgl2')
      .then((mod) => {
        if (!cancelled) setRiveModule(mod);
      })
      .catch((err) => {
        console.warn('[Persona] Failed to load Rive:', err);
        onLoadError?.(err);
      });
    return () => { cancelled = true; };
  }, []);

  // Initialize Rive once module is loaded
  useEffect(() => {
    if (!RiveModule) return;

    const source = sources[variant];
    if (!source) return;

    // Clean up previous instance
    if (riveRef.current?.cleanup) {
      riveRef.current.cleanup();
    }

    // We need to use the hook-based API, but since we're in a dynamic context
    // we'll use the lower-level approach
    setLoaded(false);
  }, [RiveModule, variant]);

  if (!RiveModule) {
    // Loading fallback
    return (
      <View style={[styles.container, style]}>
        <View style={styles.loadingOrb} />
      </View>
    );
  }

  return (
    <RivePersonaInner
      RiveModule={RiveModule}
      state={state}
      variant={variant}
      style={style}
      onReady={onReady}
      onLoadError={onLoadError}
    />
  );
}

/**
 * Inner component that uses Rive hooks (must be rendered after module is available).
 */
function RivePersonaInner({
  RiveModule,
  state,
  variant = 'obsidian',
  style,
  onReady,
  onLoadError,
}: PersonaProps & { RiveModule: any }) {
  const source = sources[variant!] || sources.obsidian;

  // Stabilize callbacks
  const callbacksRef = useRef({ onReady, onLoadError });
  useEffect(() => {
    callbacksRef.current = { onReady, onLoadError };
  }, [onReady, onLoadError]);

  const stableCallbacks = useMemo(() => ({
    onLoad: (loadedRive: any) => {},
    onLoadError: (err: any) => callbacksRef.current.onLoadError?.(err),
    onRiveReady: () => callbacksRef.current.onReady?.(),
  }), []);

  const { rive, RiveComponent } = RiveModule.useRive({
    autoplay: true,
    src: source.source,
    stateMachines: stateMachine,
    onLoad: stableCallbacks.onLoad,
    onLoadError: stableCallbacks.onLoadError,
    onRiveReady: stableCallbacks.onRiveReady,
  });

  // State machine inputs
  const listeningInput = RiveModule.useStateMachineInput(rive, stateMachine, 'listening');
  const thinkingInput = RiveModule.useStateMachineInput(rive, stateMachine, 'thinking');
  const speakingInput = RiveModule.useStateMachineInput(rive, stateMachine, 'speaking');
  const asleepInput = RiveModule.useStateMachineInput(rive, stateMachine, 'asleep');

  // Sync state to Rive inputs
  useEffect(() => {
    if (listeningInput) listeningInput.value = state === 'listening';
    if (thinkingInput) thinkingInput.value = state === 'thinking';
    if (speakingInput) speakingInput.value = state === 'speaking';
    if (asleepInput) asleepInput.value = state === 'asleep';
  }, [state, listeningInput, thinkingInput, speakingInput, asleepInput]);

  // Dynamic color theming (dark mode = white, light mode = black)
  const viewModel = source.hasModel ? RiveModule.useViewModel?.(rive, { useDefault: true }) : null;
  const viewModelInstance = source.hasModel
    ? RiveModule.useViewModelInstance?.(viewModel, { rive, useDefault: true })
    : null;
  const viewModelInstanceColor = source.dynamicColor
    ? RiveModule.useViewModelInstanceColor?.('color', viewModelInstance)
    : null;

  useEffect(() => {
    if (viewModelInstanceColor && source.dynamicColor) {
      // Always dark theme for Aspire canvas
      viewModelInstanceColor.setRgb(255, 255, 255);
    }
  }, [viewModelInstanceColor, source.dynamicColor]);

  return (
    <View style={[styles.container, style]}>
      <RiveComponent
        style={{
          width: '100%',
          height: '100%',
          flexShrink: 0,
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Native: Fallback animated orb
// ---------------------------------------------------------------------------

function PersonaNative({ state, style }: PersonaProps) {
  const breathScale = useRef(new Animated.Value(1)).current;
  const orbOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state === 'idle' || state === 'asleep') {
      const duration = state === 'asleep' ? 2000 : 1000;
      const scale = state === 'asleep' ? 1.02 : 1.05;
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(breathScale, { toValue: scale, duration, useNativeDriver: true }),
          Animated.timing(breathScale, { toValue: 1, duration, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [state, breathScale]);

  useEffect(() => {
    Animated.timing(orbOpacity, {
      toValue: state === 'asleep' ? 0.4 : 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [state, orbOpacity]);

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.nativeOrb,
          {
            transform: [{ scale: breathScale }],
            opacity: orbOpacity,
          },
        ]}
      >
        <LinearGradient
          colors={['#7C3AED', '#A855F7', '#C084FC']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Ionicons name="sparkles" size={48} color="rgba(255,255,255,0.6)" style={styles.nativeIcon} />
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Export: Platform-aware Persona
// ---------------------------------------------------------------------------

export const Persona = memo(function Persona(props: PersonaProps) {
  if (Platform.OS === 'web') {
    return <PersonaWeb {...props} />;
  }
  return <PersonaNative {...props} />;
});

(Persona as any).displayName = 'Persona';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 200,
  },
  loadingOrb: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  nativeOrb: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativeIcon: {
    position: 'absolute',
  },
});
