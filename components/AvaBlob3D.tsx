import React, { useRef, useMemo, Suspense } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Sphere, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Colors } from '@/constants/tokens';

export type BlobState = 'idle' | 'listening' | 'processing' | 'responding';

interface AvaBlobProps {
  state?: BlobState;
  size?: number;
}

const stateConfig = {
  idle: {
    distort: 0.3,
    speed: 1.5,
    color1: '#1e5799',
    color2: '#2989d8',
    color3: '#7db9e8',
    emissiveIntensity: 0.1,
  },
  listening: {
    distort: 0.45,
    speed: 2.5,
    color1: '#2575fc',
    color2: '#6a11cb',
    color3: '#3B82F6',
    emissiveIntensity: 0.2,
  },
  processing: {
    distort: 0.6,
    speed: 4,
    color1: '#0052d4',
    color2: '#4364f7',
    color3: '#6fb1fc',
    emissiveIntensity: 0.4,
  },
  responding: {
    distort: 0.5,
    speed: 3,
    color1: '#00c6ff',
    color2: '#0072ff',
    color3: '#5d26c1',
    emissiveIntensity: 0.3,
  },
};

function AnimatedBlob({ state = 'idle' }: { state: BlobState }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<any>(null);
  const config = stateConfig[state];
  
  const colorLerp = useRef(0);
  const targetColor = useRef(new THREE.Color(config.color1));
  const currentColor = useRef(new THREE.Color(config.color1));
  
  useFrame((frameState, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.1;
      meshRef.current.rotation.y += delta * 0.15;
      
      const time = frameState.clock.elapsedTime;
      const scale = 1 + Math.sin(time * 2) * 0.05;
      meshRef.current.scale.setScalar(scale);
    }
    
    if (materialRef.current) {
      colorLerp.current += delta * 0.5;
      if (colorLerp.current > 1) {
        colorLerp.current = 0;
        const colors = [config.color1, config.color2, config.color3];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        targetColor.current.set(randomColor);
      }
      currentColor.current.lerp(targetColor.current, delta * 2);
      materialRef.current.color = currentColor.current;
    }
  });

  return (
    <Sphere ref={meshRef} args={[1, 64, 64]} scale={1.5}>
      <MeshDistortMaterial
        ref={materialRef}
        color={config.color1}
        attach="material"
        distort={config.distort}
        speed={config.speed}
        roughness={0.1}
        metalness={0.9}
        envMapIntensity={1.5}
        emissive={config.color2}
        emissiveIntensity={config.emissiveIntensity}
      />
    </Sphere>
  );
}

function Scene({ state }: { state: BlobState }) {
  return (
    <>
      <ambientLight intensity={0.2} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <directionalLight position={[-5, -5, -5]} intensity={0.5} color="#4facfe" />
      <pointLight position={[0, 0, 3]} intensity={0.8} color="#3B82F6" />
      <Environment preset="night" />
      <AnimatedBlob state={state} />
    </>
  );
}

function FallbackBlob({ state, size }: { state: BlobState; size: number }) {
  const config = stateConfig[state];
  return (
    <View style={[styles.fallbackContainer, { width: size, height: size }]}>
      <View style={[styles.fallbackOrb, { 
        backgroundColor: config.color1,
        width: size * 0.6,
        height: size * 0.6,
        borderRadius: size * 0.3,
      }]}>
        <View style={[styles.fallbackGlow, {
          backgroundColor: config.color2,
          width: size * 0.4,
          height: size * 0.4,
          borderRadius: size * 0.2,
        }]} />
      </View>
    </View>
  );
}

export function AvaBlob3D({ state = 'idle', size = 300 }: AvaBlobProps) {
  if (Platform.OS !== 'web') {
    return <FallbackBlob state={state} size={size} />;
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Suspense fallback={<FallbackBlob state={state} size={size} />}>
        <Canvas
          camera={{ position: [0, 0, 4], fov: 45 }}
          style={{ width: size, height: size }}
          gl={{ antialias: true, alpha: true }}
        >
          <Scene state={state} />
        </Canvas>
      </Suspense>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  fallbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackOrb: {
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.8,
  },
  fallbackGlow: {
    opacity: 0.6,
  },
});

export default AvaBlob3D;
