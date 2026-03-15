import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type StoryModeId =
  | 'cash-truth'
  | 'what-changed'
  | 'invoice-pressure'
  | 'tax-review'
  | 'cleanup-sprint'
  | 'books-vs-bank'
  | 'money-memory';

export interface StoryModeConfig {
  id: StoryModeId;
  name: string;
  tagline: string;
  accent: string;
  gradient: string;
}

export const STORY_MODES: StoryModeConfig[] = [
  {
    id: 'cash-truth',
    name: 'Cash Truth',
    tagline: 'Real-time liquidity at a glance',
    accent: '#00E5CC',
    gradient: 'conic-gradient(from 200deg at 70% 30%, #00E5CC20 0deg, transparent 90deg), radial-gradient(ellipse at 30% 20%, #004D40 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, #00BCD4 0%, transparent 50%), linear-gradient(135deg, #003333 0%, #001A1A 100%)',
  },
  {
    id: 'what-changed',
    name: 'What Changed',
    tagline: 'Deltas since your last look',
    accent: '#A78BFA',
    gradient: 'conic-gradient(from 160deg at 65% 35%, #A78BFA20 0deg, transparent 100deg), radial-gradient(ellipse at 25% 30%, #1E1B4B 0%, transparent 55%), radial-gradient(ellipse at 75% 70%, #7C3AED 0%, transparent 50%), linear-gradient(135deg, #0F0A2E 0%, #0A0520 100%)',
  },
  {
    id: 'invoice-pressure',
    name: 'Invoice Pressure',
    tagline: 'What is owed and overdue',
    accent: '#F59E0B',
    gradient: 'conic-gradient(from 220deg at 60% 40%, #F59E0B18 0deg, transparent 80deg), radial-gradient(ellipse at 30% 25%, #78350F 0%, transparent 55%), radial-gradient(ellipse at 70% 75%, #D97706 0%, transparent 50%), linear-gradient(135deg, #451A03 0%, #1C0A00 100%)',
  },
  {
    id: 'tax-review',
    name: 'Tax Review',
    tagline: 'Stay ahead of obligations',
    accent: '#10B981',
    gradient: 'conic-gradient(from 180deg at 55% 45%, #10B98118 0deg, transparent 90deg), radial-gradient(ellipse at 30% 30%, #064E3B 0%, transparent 55%), radial-gradient(ellipse at 70% 70%, #059669 0%, transparent 50%), linear-gradient(135deg, #022C22 0%, #011A14 100%)',
  },
  {
    id: 'cleanup-sprint',
    name: 'Cleanup Sprint',
    tagline: 'Unresolved items need attention',
    accent: '#F87171',
    gradient: 'conic-gradient(from 240deg at 70% 25%, #F8717118 0deg, transparent 85deg), radial-gradient(ellipse at 25% 25%, #3B1010 0%, transparent 55%), radial-gradient(ellipse at 70% 75%, #EF4444 0%, transparent 50%), linear-gradient(135deg, #1C0606 0%, #0F0303 100%)',
  },
  {
    id: 'books-vs-bank',
    name: 'Books vs Bank',
    tagline: 'Reconciliation at a glance',
    accent: '#818CF8',
    gradient: 'conic-gradient(from 150deg at 60% 30%, #818CF81A 0deg, transparent 95deg), radial-gradient(ellipse at 30% 20%, #1E1B4B 0%, transparent 55%), radial-gradient(ellipse at 75% 80%, #4F46E5 0%, transparent 50%), linear-gradient(135deg, #0C0A30 0%, #050320 100%)',
  },
  {
    id: 'money-memory',
    name: 'Money Memory',
    tagline: 'Your financial timeline',
    accent: '#E879F9',
    gradient: 'conic-gradient(from 190deg at 65% 40%, #E879F91A 0deg, transparent 90deg), radial-gradient(ellipse at 25% 30%, #4A044E 0%, transparent 55%), radial-gradient(ellipse at 75% 70%, #C026D3 0%, transparent 50%), linear-gradient(135deg, #2E0230 0%, #15011A 100%)',
  },
];

interface StoryModeCarouselProps {
  activeMode?: StoryModeId;
  onSelectMode?: (mode: StoryModeConfig) => void;
}

export function StoryModeCarousel({ activeMode, onSelectMode }: StoryModeCarouselProps) {
  const [centerIndex, setCenterIndex] = useState(
    activeMode ? STORY_MODES.findIndex(m => m.id === activeMode) : 0
  );

  const goLeft = useCallback(() => {
    setCenterIndex(prev => {
      const next = (prev - 1 + STORY_MODES.length) % STORY_MODES.length;
      if (onSelectMode) onSelectMode(STORY_MODES[next]);
      return next;
    });
  }, [onSelectMode]);

  const goRight = useCallback(() => {
    setCenterIndex(prev => {
      const next = (prev + 1) % STORY_MODES.length;
      if (onSelectMode) onSelectMode(STORY_MODES[next]);
      return next;
    });
  }, [onSelectMode]);

  if (Platform.OS !== 'web') {
    return (
      <View style={nativeStyles.container}>
        <Text style={nativeStyles.title}>Story Modes</Text>
      </View>
    );
  }

  const getCardStyle = (offset: number): React.CSSProperties => {
    const absOffset = Math.abs(offset);
    if (absOffset > 1) return { display: 'none' };

    const translateX = offset * 200;
    const scale = 1 - absOffset * 0.1;
    const zIndex = 10 - absOffset;
    const opacity = absOffset === 0 ? 1 : 0.55;
    const rotateY = offset * -10;

    return {
      position: 'absolute' as const,
      left: '50%',
      top: 0,
      transform: `translateX(calc(-50% + ${translateX}px)) scale(${scale}) perspective(800px) rotateY(${rotateY}deg)`,
      zIndex,
      opacity,
      transition: 'all 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
      pointerEvents: 'auto' as const,
    };
  };

  return (
    <div style={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
    }}>
      <div style={{
        width: '100%',
        position: 'relative' as const,
        height: 220,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <button
          onClick={goLeft}
          style={{
            position: 'absolute' as const,
            left: 8,
            zIndex: 20,
            width: 32,
            height: 32,
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 14,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
          }}
        >
          <Ionicons name="chevron-back" size={14} color="currentColor" />
        </button>

        {STORY_MODES.map((mode, i) => {
          let offset = i - centerIndex;
          if (offset > 3) offset -= STORY_MODES.length;
          if (offset < -3) offset += STORY_MODES.length;

          const style = getCardStyle(offset);
          if (style.display === 'none') return null;

          const isCenter = offset === 0;

          return (
            <div
              key={mode.id}
              style={style}
              onClick={() => {
                if (!isCenter) setCenterIndex(i);
                if (onSelectMode) onSelectMode(mode);
              }}
            >
              <div style={{
                width: 200,
                borderRadius: 14,
                overflow: 'hidden',
                border: isCenter
                  ? `1px solid ${mode.accent}33`
                  : '1px solid rgba(255,255,255,0.07)',
                boxShadow: isCenter
                  ? `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${mode.accent}15`
                  : '0 4px 16px rgba(0,0,0,0.3)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}>
                <div style={{
                  height: 130,
                  background: mode.gradient,
                  position: 'relative' as const,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute' as const,
                    inset: 0,
                    background: `radial-gradient(circle at 50% 50%, ${mode.accent}10 0%, transparent 70%)`,
                  }} />
                </div>
                <div style={{
                  padding: '12px 14px 14px',
                  background: '#0A0A0F',
                }}>
                  <div style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#ffffff',
                    marginBottom: 3,
                    letterSpacing: '-0.2px',
                  }}>{mode.name}</div>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 300,
                    color: 'rgba(255,255,255,0.4)',
                    marginBottom: 10,
                    lineHeight: '1.3',
                  }}>{mode.tagline}</div>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 12,
                    background: `${mode.accent}15`,
                    border: `1px solid ${mode.accent}25`,
                    fontSize: 10,
                    fontWeight: 500,
                    color: mode.accent,
                    letterSpacing: '0.3px',
                    textTransform: 'uppercase' as const,
                  }}>
                    Explore
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <button
          onClick={goRight}
          style={{
            position: 'absolute' as const,
            right: 8,
            zIndex: 20,
            width: 32,
            height: 32,
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 14,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
          }}
        >
          <Ionicons name="chevron-forward" size={14} color="currentColor" />
        </button>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        {STORY_MODES.map((mode, i) => (
          <button
            key={mode.id}
            onClick={() => {
              setCenterIndex(i);
              if (onSelectMode) onSelectMode(STORY_MODES[i]);
            }}
            style={{
              width: i === centerIndex ? 16 : 6,
              height: 6,
              borderRadius: 3,
              border: 'none',
              outline: 'none',
              cursor: 'pointer',
              background: i === centerIndex ? mode.accent : 'rgba(255,255,255,0.15)',
              transition: 'all 0.3s ease',
              padding: 0,
              boxShadow: i === centerIndex ? `0 0 8px ${mode.accent}50` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

const nativeStyles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
