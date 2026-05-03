// components/call-room/CallRoomNightLight.tsx
//
// Real WebGL "screen-glow" for the Call Room at night. Replaces the prior
// CSS-radial-gradient fake. Renders a small emissive sphere (the visible
// light source) plus a drei volumetric SpotLight that casts a visible cone
// of cool-blue-white light upward into the dark virtual office. Bloom on
// the emissive sphere makes it glow believably; scene fog gives the
// volumetric beam atmosphere to scatter through.
//
// Web-only. Native returns null (Three.js not available without expo-gl).
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
// Type-only import: pulls in @react-three/fiber's JSX augmentation
// (mesh, sphereGeometry, fog, etc.) without forcing the runtime to load
// Three.js. Runtime loading happens lazily via require() inside
// NightLightScene below, so native and inactive-night paths pay nothing.
import type {} from '@react-three/fiber';

export interface CallRoomNightLightProps {
  /** When true, the WebGL canvas is mounted and visible. When false, fades
   *  out then unmounts to free the GPU context. */
  active: boolean;
}

const FADE_MS = 600;

export function CallRoomNightLight({
  active,
}: CallRoomNightLightProps): React.ReactElement | null {
  const isWeb = Platform.OS === 'web';

  // mounted controls whether the Canvas exists at all (saves GPU when off).
  // visible controls opacity for crossfade. We delay unmount until fade-out
  // finishes.
  const [mounted, setMounted] = useState<boolean>(active);
  const [visible, setVisible] = useState<boolean>(active);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isWeb) return;
    if (active) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setMounted(true);
      // Next tick so opacity transition runs from 0 -> 1.
      const id = setTimeout(() => setVisible(true), 16);
      return () => clearTimeout(id);
    } else {
      setVisible(false);
      timerRef.current = setTimeout(() => {
        setMounted(false);
        timerRef.current = null;
      }, FADE_MS);
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [active, isWeb]);

  if (!isWeb) return null;
  if (!mounted) return null;

  return (
    <View
      pointerEvents="none"
      testID="call-room-night-light"
      style={[
        StyleSheet.absoluteFillObject,
        {
          opacity: visible ? 1 : 0,
          // @ts-expect-error - web-only CSS property
          transition: `opacity ${FADE_MS}ms ease-out`,
        },
      ]}
    >
      <NightLightScene />
    </View>
  );
}

// Internal scene — kept in a separate component so React only loads
// @react-three/* modules when the Canvas actually mounts.
function NightLightScene(): React.ReactElement {
  // Lazy require so jest-expo never tries to evaluate Three.js at test time
  // and so we only pay the bundle cost when night mode is active.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Canvas } = require('@react-three/fiber');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { SpotLight } = require('@react-three/drei');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { EffectComposer, Bloom } = require('@react-three/postprocessing');

  return (
    <Canvas
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0, 4], fov: 50 }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      {/* Fog gives the volumetric SpotLight beam something to scatter
          through — without it the cone is invisible. Color matches the
          deep night-room ambience so the falloff blends. */}
      <fog attach="fog" args={['#0a1020', 4, 8]} />

      <SceneContents SpotLight={SpotLight} />

      <EffectComposer>
        <Bloom
          intensity={1.6}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
}

interface SceneContentsProps {
  // drei SpotLight — typed loosely because we're require-loading at runtime.
  SpotLight: React.ComponentType<Record<string, unknown>>;
}

function SceneContents({ SpotLight }: SceneContentsProps): React.ReactElement {
  // Target the SpotLight wants to point AT. We position the light slightly
  // below center (where the card top edge sits in screen space) and aim it
  // upward by placing the target above. This produces an upward beam,
  // matching the "laptop screen casting light into the room" mental model.
  const targetRef = useRef(null);

  // Cool-blue-white — the LED-screen-at-night feel with a subtle Aspire
  // tint. Slightly warmer than pure blue so it reads as "screen" not
  // "police siren".
  const screenColor = '#b8d0f5';

  return (
    <>
      {/* The visible light source — a small emissive sphere camera sees as
          the "screen" emerging from the card area. Bloom turns this into a
          believable glowing point. Positioned in the upper half of NDC
          (y = +0.4) so it sits just above the card's top edge in screen
          space, with the beam rising upward into the dark room. */}
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.12, 32, 32]} />
        <meshBasicMaterial color={screenColor} toneMapped={false} />
      </mesh>

      {/* Target for the SpotLight cone — placed above the source so the
          cone aims UP into the room. */}
      <object3D ref={targetRef} position={[0, 2.5, 0]} />

      {/* Volumetric drei SpotLight — produces the visible cone of light
          through the fogged scene. Wide angle, soft penumbra, attenuated
          falloff matching a real screen casting upward. */}
      <SpotLight
        position={[0, 0.4, 0]}
        target={targetRef.current ?? undefined}
        color={screenColor}
        intensity={3}
        distance={6}
        angle={Math.PI / 2.5}
        penumbra={0.8}
        attenuation={2.5}
        anglePower={4}
        radiusTop={0.05}
        radiusBottom={1.4}
        volumetric
      />

      {/* Faint ambient so the bloom isn't sitting on pure black — keeps
          edges from clipping harshly when the canvas composites over the
          night photo. */}
      <ambientLight intensity={0.05} color={screenColor} />
    </>
  );
}
