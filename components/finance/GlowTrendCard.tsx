import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { injectCardKeyframes } from './cardAnimations';

injectCardKeyframes();

export interface GlowTrendCardProps {
  title: string;
  value: string;
  delta?: string;
  deltaDirection?: 'up' | 'down' | 'flat';
  data: Array<{ value: number }>;
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

export function GlowTrendCard({ title, value, delta, deltaDirection = 'up', data, accentColor, loading }: GlowTrendCardProps) {
  if (Platform.OS !== 'web') {
    return (
      <View style={nativeStyles.card}>
        <Text style={nativeStyles.title}>{title}</Text>
        <Text style={nativeStyles.value}>{value}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <div style={cardShell(accentColor)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
          <ShimmerLine width="40%" height={10} />
          <ShimmerLine width="60%" height={28} />
          <ShimmerLine width="30%" height={10} />
          <ShimmerLine width="100%" height={60} />
        </div>
      </div>
    );
  }

  const gradientId = `glow-trend-${accentColor.replace('#', '')}`;

  return (
    <div style={cardShell(accentColor)}>
      <div style={{
        position: 'absolute' as const,
        top: -20,
        right: -20,
        width: 120,
        height: 120,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${accentColor}14 0%, transparent 70%)`,
        pointerEvents: 'none' as const,
      }} />

      <div style={{ padding: 16, position: 'relative' as const, zIndex: 1 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 400,
          color: 'rgba(255,255,255,0.45)',
          letterSpacing: '0.5px',
          textTransform: 'uppercase' as const,
          marginBottom: 8,
        }}>{title}</div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
          <div style={{
            fontSize: 32,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-0.5px',
            lineHeight: '1',
          }}>{value}</div>
          {delta && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 13,
              fontWeight: 400,
              color: deltaDirection === 'up' ? '#34c759' : deltaDirection === 'down' ? '#ff3b30' : 'rgba(255,255,255,0.45)',
            }}>
              {deltaDirection === 'up' && <Ionicons name="arrow-up" size={11} color="#34c759" />}
              {deltaDirection === 'down' && <Ionicons name="arrow-down" size={11} color="#ff3b30" />}
              {delta}
            </div>
          )}
        </div>

        <div style={{ height: 80, marginTop: 12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={accentColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={accentColor}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={(props: Record<string, unknown>) => {
                  const { cx, cy, index } = props as { cx: number; cy: number; index: number };
                  if (index !== data.length - 1) return <circle key={index} r={0} />;
                  return (
                    <g key="pulse-dot">
                      <circle cx={cx} cy={cy} r={6} fill={accentColor} opacity={0.2}>
                        <animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
                      </circle>
                      <circle cx={cx} cy={cy} r={3.5} fill={accentColor} stroke="#0A0A0F" strokeWidth={2} />
                    </g>
                  );
                }}
                activeDot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
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
    background: '#0A0A0F',
    overflow: 'hidden',
    boxShadow: `0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.02)`,
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
  title: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 8,
  },
  value: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
  },
});
