import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  photo: string;
  tags?: string[];
}

export const STORY_MODES: StoryModeConfig[] = [
  {
    id: 'cash-truth',
    name: 'Cash Truth',
    tagline: 'Real-time liquidity at a glance',
    accent: '#38BDF8',
    photo: '/images/story-modes/cash-truth.jpeg',
    tags: ['Liquidity', 'Runway'],
  },
  {
    id: 'what-changed',
    name: 'What Changed',
    tagline: 'Deltas since your last look',
    accent: '#A78BFA',
    photo: '/images/story-modes/what-changed.jpeg',
    tags: ['Deltas', 'Trends'],
  },
  {
    id: 'invoice-pressure',
    name: 'Invoice Pressure',
    tagline: 'What is owed and overdue',
    accent: '#EA580C',
    photo: '/images/story-modes/invoice-pressure.jpeg',
    tags: ['AR', 'Collections'],
  },
  {
    id: 'tax-review',
    name: 'Tax Review',
    tagline: 'Stay ahead of obligations',
    accent: '#10B981',
    photo: '/images/story-modes/tax-review.jpeg',
    tags: ['Compliance', 'Reserves'],
  },
  {
    id: 'cleanup-sprint',
    name: 'Cleanup Sprint',
    tagline: 'Unresolved items need attention',
    accent: '#F87171',
    photo: '/images/story-modes/cleanup-sprint.jpeg',
    tags: ['Reconcile', 'Action'],
  },
  {
    id: 'books-vs-bank',
    name: 'Books vs Bank',
    tagline: 'Reconciliation at a glance',
    accent: '#F59E0B',
    photo: '/images/story-modes/books-vs-bank.jpeg',
    tags: ['Matching', 'Ledger'],
  },
  {
    id: 'money-memory',
    name: 'Money Memory',
    tagline: 'Your financial timeline',
    accent: '#E879F9',
    photo: '/images/story-modes/money-memory.jpeg',
    tags: ['History', 'Patterns'],
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
  const [isHovered, setIsHovered] = useState(false);
  const autoRotateRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (activeMode) {
      const idx = STORY_MODES.findIndex(m => m.id === activeMode);
      if (idx >= 0 && idx !== centerIndex) setCenterIndex(idx);
    }
  }, [activeMode]);

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

  useEffect(() => {
    if (isHovered) {
      if (autoRotateRef.current) clearInterval(autoRotateRef.current);
      return;
    }
    autoRotateRef.current = setInterval(() => {
      setCenterIndex(prev => {
        const next = (prev + 1) % STORY_MODES.length;
        if (onSelectMode) onSelectMode(STORY_MODES[next]);
        return next;
      });
    }, 4000);
    return () => {
      if (autoRotateRef.current) clearInterval(autoRotateRef.current);
    };
  }, [isHovered, onSelectMode]);

  if (Platform.OS !== 'web') {
    return (
      <View style={nativeStyles.container}>
        <Text style={nativeStyles.title}>Story Modes</Text>
      </View>
    );
  }

  const getCardStyle = (offset: number): React.CSSProperties => {
    const absOffset = Math.abs(offset);
    if (absOffset > 1) return {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      transform: `translateX(${offset > 0 ? 80 : -80}%) scale(0.9)`,
      opacity: 0,
      pointerEvents: 'none' as const,
      zIndex: 0,
      transition: 'transform 400ms ease, opacity 400ms ease',
    };

    const translateXPercent = offset * 40;
    const scale = absOffset === 0 ? 1 : 0.95;
    const zIndex = absOffset === 0 ? 20 : 10;
    const opacity = absOffset === 0 ? 1 : 0.60;

    return {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      transform: `translateX(${translateXPercent}%) scale(${scale})`,
      zIndex,
      opacity,
      transition: 'transform 400ms ease, opacity 400ms ease',
      pointerEvents: 'auto' as const,
      cursor: absOffset === 0 ? 'default' : 'pointer',
    };
  };

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        height: '100%',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{
        width: '100%',
        position: 'relative' as const,
        height: 340,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <button
          onClick={goLeft}
          style={{
            position: 'absolute' as const,
            left: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 30,
            width: 32,
            height: 32,
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(0,0,0,0.65)',
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
          const isCenter = offset === 0;

          return (
            <div
              key={mode.id}
              style={style}
              onClick={() => {
                if (!isCenter) {
                  setCenterIndex(i);
                  if (onSelectMode) onSelectMode(mode);
                }
              }}
            >
              <div style={{
                width: '70%',
                maxWidth: 320,
                height: 310,
                borderRadius: 14,
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.07)',
                boxShadow: isCenter
                  ? '0 12px 40px rgba(0,0,0,0.55)'
                  : '0 4px 18px rgba(0,0,0,0.35)',
              }}>
                <div style={{
                  height: '60%',
                  position: 'relative' as const,
                  backgroundColor: '#0A0A0F',
                  overflow: 'hidden',
                }}>
                  <img
                    src={mode.photo}
                    alt={mode.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      objectPosition: 'center',
                      display: 'block',
                    }}
                  />
                  <div style={{
                    position: 'absolute' as const,
                    inset: 0,
                    backgroundColor: mode.accent,
                    opacity: 0.25,
                    pointerEvents: 'none' as const,
                  }} />
                </div>
                <div style={{
                  height: '40%',
                  backgroundColor: '#111116',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}>
                  <div style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#ffffff',
                  }}>{mode.name}</div>
                  <div style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.5)',
                  }}>{mode.tagline}</div>
                  {mode.tags && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {mode.tags.map(tag => (
                        <span key={tag} style={{
                          fontSize: 10,
                          backgroundColor: 'rgba(255,255,255,0.06)',
                          color: 'rgba(255,255,255,0.35)',
                          borderRadius: 10,
                          padding: '2px 8px',
                        }}>{tag}</span>
                      ))}
                    </div>
                  )}
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: mode.accent,
                    backgroundColor: mode.accent + '26',
                    borderRadius: 20,
                    padding: '4px 10px',
                    alignSelf: 'flex-start',
                    marginTop: 'auto',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.5px',
                  }}>EXPLORE</div>
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
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 30,
            width: 32,
            height: 32,
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(0,0,0,0.65)',
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
        paddingBottom: 4,
      }}>
        {STORY_MODES.map((mode, i) => (
          <button
            key={mode.id}
            onClick={() => {
              setCenterIndex(i);
              if (onSelectMode) onSelectMode(STORY_MODES[i]);
            }}
            style={{
              width: i === centerIndex ? 18 : 6,
              height: 6,
              borderRadius: 3,
              border: 'none',
              outline: 'none',
              cursor: 'pointer',
              background: i === centerIndex ? mode.accent : 'rgba(255,255,255,0.15)',
              transition: 'all 0.3s ease',
              padding: 0,
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
