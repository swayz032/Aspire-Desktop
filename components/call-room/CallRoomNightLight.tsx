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
  const { SpotLight, Sparkles } = require('@react-three/drei');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { EffectComposer, Bloom } = require('@react-three/postprocessing');

  return (
    <Canvas
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0, 4], fov: 50 }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      {/* Fog gives the volumetric SpotLight beam something to scatter
          through. Color matches the deep night ambience for clean blend. */}
      <fog attach="fog" args={['#0a0e16', 3, 7]} />

      <SceneContents SpotLight={SpotLight} Sparkles={Sparkles} />

      <EffectComposer>
        <Bloom
          intensity={0.8}
          luminanceThreshold={0.4}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
}

interface SceneContentsProps {
  // drei components — typed loosely because we're require-loading at runtime.
  SpotLight: React.ComponentType<Record<string, unknown>>;
  Sparkles: React.ComponentType<Record<string, unknown>>;
}

function SceneContents({ SpotLight, Sparkles }: SceneContentsProps): React.ReactElement {
  // Light source positioned in the upper-RIGHT of the scene (off-screen-ish),
  // aimed DOWN-and-LEFT at the card's top-right area. Reads as a real
  // overhead lamp shining onto the right side of the card from above.
  const targetRef = useRef(null);

  // Warm tungsten lamp color — like a real desk/ceiling lamp. NOT the cool
  // screen blue the user rejected.
  const lampColor = '#ffd9a0';

  return (
    <>
      {/* NO emissive sphere — the bulb itself stays invisible. Only the
          volumetric cone of light shows in the viewport. The light source
          sits off-screen past the top-right corner; what the user sees is
          the descending pool of warm light landing on the card's top-right
          corner. Removing the visible source eliminates bloom-bleed of the
          bulb into the visible frame. */}

      {/* Target = card's top-right corner. Camera at (0,0,4) fov=50 puts
          z=0 viewport at roughly ±3.5 × ±1.87. Card top-right ≈ (2.0,
          0.5, 0). The cone aims here so the visible pool lands on the
          card's top-right. */}
      <object3D ref={targetRef} position={[2.0, 0.5, 0]} />

      {/* Source past the visible top-right corner so the bulb itself is
          off-screen. Returns to the previous-working light geometry,
          just with the target retargeted. */}
      <SpotLight
        position={[4.0, 2.5, 0.5]}
        target={targetRef.current ?? undefined}
        color={lampColor}
        intensity={4.5}
        distance={5.5}
        angle={0.7}
        penumbra={0.7}
        attenuation={5}
        anglePower={4}
        radiusTop={0.1}
        radiusBottom={2.4}
        volumetric
      />

      {/* Dust particles drifting in the lamp's beam — adds the "real
          atmosphere" feel where motes catch the warm light. Positioned in
          a volume around the cone path between source (top-right) and
          card (lower-center-right). Slow drift via speed param. */}
      <Sparkles
        count={90}
        scale={[3.5, 3.0, 1.2]}
        position={[2.6, 1.1, 0.3]}
        size={3}
        speed={0.25}
        color={lampColor}
        opacity={0.6}
        noise={0.6}
      />

      {/* Faint warm ambient so bloom doesn't sit on pure black. */}
      <ambientLight intensity={0.05} color={lampColor} />
    </>
  );
}
