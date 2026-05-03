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
      <fog attach="fog" args={['#0a0e16', 1, 5]} />

      <SceneContents SpotLight={SpotLight} />

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
  // drei SpotLight — typed loosely because we're require-loading at runtime.
  SpotLight: React.ComponentType<Record<string, unknown>>;
}

function SceneContents({ SpotLight }: SceneContentsProps): React.ReactElement {
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

      {/* Target = card's top-right corner. With camera at (0,0,4) fov=50
          the visible viewport at z=0 spans roughly ±3.5 × ±1.87. The
          card occupies the central region; its top-right corner sits
          around world (2.0, 0.5, 0). The cone aims here so the visible
          light pool lands on the card's top-right exactly. */}
      <object3D ref={targetRef} position={[2.0, 0.5, 0]} />

      {/* Source positioned far past the top-right corner of the visible
          viewport at z=0, in line with the target so the cone descends
          diagonally INTO the card's top-right. Source itself is off-
          screen and invisible; only the cone enters the visible area. */}
      <SpotLight
        position={[4.8, 2.8, 0.5]}
        target={targetRef.current ?? undefined}
        color={lampColor}
        intensity={6}
        distance={10}
        angle={Math.PI / 5}
        penumbra={0.6}
        attenuation={1.4}
        anglePower={1.5}
        radiusTop={0.05}
        radiusBottom={1.8}
        volumetric
      />

      {/* Faint warm ambient so bloom doesn't sit on pure black. */}
      <ambientLight intensity={0.05} color={lampColor} />
    </>
  );
}
