import React from 'react';
import { Platform } from 'react-native';

function getTimeOfDay(): { greeting: string; gradientColors: string[] } {
  const hour = new Date().getHours();
  if (hour < 12) {
    return {
      greeting: 'Good morning',
      gradientColors: ['rgba(6,182,212,0.25)', 'rgba(59,130,246,0.18)', 'rgba(16,185,129,0.10)'],
    };
  }
  if (hour < 17) {
    return {
      greeting: 'Good afternoon',
      gradientColors: ['rgba(139,92,246,0.22)', 'rgba(99,102,241,0.15)', 'rgba(59,130,246,0.08)'],
    };
  }
  return {
    greeting: 'Good evening',
    gradientColors: ['rgba(245,158,11,0.20)', 'rgba(239,68,68,0.12)', 'rgba(139,92,246,0.08)'],
  };
}

interface Props {
  ownerName?: string;
}

export function GreetingCard({ ownerName = 'Mr. Scott' }: Props) {
  if (Platform.OS !== 'web') return null;

  const { greeting, gradientColors } = getTimeOfDay();
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div style={{
      position: 'relative',
      borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.07)',
      background: `radial-gradient(ellipse at 30% 20%, ${gradientColors[0]} 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, ${gradientColors[1]} 0%, transparent 50%), linear-gradient(135deg, #0A0A0F 0%, #111116 100%)`,
      padding: 22,
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: -20,
        right: -20,
        width: 100,
        height: 100,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${gradientColors[0]} 0%, transparent 70%)`,
        filter: 'blur(20px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        color: '#fff',
        fontSize: 24,
        fontWeight: 700,
        lineHeight: '30px',
        position: 'relative',
        zIndex: 1,
      }}>
        {greeting},
      </div>
      <div style={{
        color: '#fff',
        fontSize: 24,
        fontWeight: 700,
        lineHeight: '30px',
        position: 'relative',
        zIndex: 1,
      }}>
        {ownerName}
      </div>
      <div style={{
        color: 'rgba(255,255,255,0.40)',
        fontSize: 11,
        fontWeight: 400,
        marginTop: 8,
        letterSpacing: 0.3,
        position: 'relative',
        zIndex: 1,
      }}>
        {dateStr}
      </div>
    </div>
  );
}
