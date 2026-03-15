import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { injectCardKeyframes } from './cardAnimations';

injectCardKeyframes();

export interface InsightOverlayCardProps {
  quote: string;
  sparkData?: Array<{ value: number }>;
  accentColor: string;
  mode?: string;
  loading?: boolean;
}

function ShimmerLine({ width, height = 12 }: { width: string | number; height?: number }) {
  if (Platform.OS !== 'web') return <View style={{ width: typeof width === 'number' ? width : 100, height, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 4 }} />;
  return (
    <div style={{
      width: typeof width === 'string' ? width : `${width}px`,
      height,
      borderRadius: 4,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }} />
  );
}

export function InsightOverlayCard({ quote, sparkData, accentColor, loading }: InsightOverlayCardProps) {
  if (Platform.OS !== 'web') {
    return (
      <View style={nativeStyles.card}>
        <Text style={nativeStyles.quote}>{quote}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <div style={cardShell(accentColor)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
          <ShimmerLine width="90%" height={12} />
          <ShimmerLine width="75%" height={12} />
          <ShimmerLine width="40%" height={12} />
        </div>
      </div>
    );
  }

  const sparkGradientId = `insight-spark-${accentColor.replace('#', '')}`;

  return (
    <div style={cardShell(accentColor)}>
      {sparkData && sparkData.length > 0 && (
        <div style={{
          position: 'absolute' as const,
          top: 12,
          right: 12,
          width: 80,
          height: 36,
          opacity: 0.7,
        }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <defs>
                <linearGradient id={sparkGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={accentColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={accentColor}
                strokeWidth={1.5}
                fill={`url(#${sparkGradientId})`}
                dot={(props: Record<string, unknown>) => {
                  const { cx, cy, index } = props as { cx: number; cy: number; index: number };
                  if (!sparkData || index !== sparkData.length - 1) return <circle key={index} r={0} />;
                  return (
                    <g key="spark-end-dot">
                      <circle cx={cx} cy={cy} r={4} fill={accentColor} opacity={0.25}>
                        <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
                      </circle>
                      <circle cx={cx} cy={cy} r={2} fill={accentColor} />
                    </g>
                  );
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{
        padding: '16px 16px 14px',
        position: 'relative' as const,
        zIndex: 1,
      }}>
        <div style={{
          fontSize: 15,
          fontWeight: 400,
          color: '#ffffff',
          lineHeight: '1.6',
          maxWidth: sparkData ? 'calc(100% - 96px)' : '100%',
          marginBottom: 14,
        }}>
          "{quote}"
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative' as const,
            overflow: 'visible',
          }}>
            <div style={{
              position: 'absolute' as const,
              inset: -2,
              borderRadius: 16,
              border: `1.5px solid ${accentColor}`,
              opacity: 0.5,
              animation: 'ledPulse 2s ease-in-out infinite',
            }} />
            <span style={{
              fontSize: 12,
              fontWeight: 700,
              color: accentColor,
              lineHeight: '1',
            }}>F</span>
          </div>
          <span style={{
            fontSize: 11,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.35)',
          }}>Finn's insight</span>
        </div>
      </div>
    </div>
  );
}

function cardShell(accentColor: string): React.CSSProperties {
  return {
    position: 'relative' as const,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.07)',
    borderLeft: `1px solid ${accentColor}40`,
    background: '#0A0A0F',
    overflow: 'hidden',
    boxShadow: `0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.02), -1px 0 8px ${accentColor}08`,
  };
}

const nativeStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: '#0A0A0F',
    padding: 16,
  },
  quote: {
    fontSize: 15,
    fontWeight: '400',
    color: '#ffffff',
    lineHeight: 24,
  },
});
