import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { injectCardKeyframes } from './cardAnimations';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

injectCardKeyframes();

export interface SegmentRingSegment {
  label: string;
  value: number;
  color: string;
}

export interface SegmentRingCardProps {
  title: string;
  centerValue: string;
  centerLabel: string;
  segments: SegmentRingSegment[];
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

function SegmentRingCardInner({ title, centerValue, centerLabel, segments, accentColor, mode, loading }: SegmentRingCardProps) {
  if (Platform.OS !== 'web') {
    return (
      <View style={nativeStyles.card}>
        <Text style={nativeStyles.title}>{title}</Text>
        <Text style={nativeStyles.value}>{centerValue}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <div style={cardShell(accentColor)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
          <ShimmerLine width="50%" height={10} />
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <ShimmerLine width={100} height={100} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              <ShimmerLine width="80%" height={10} />
              <ShimmerLine width="60%" height={10} />
              <ShimmerLine width="70%" height={10} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div style={cardShell(accentColor)}>
      <div style={{ padding: 16 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 400,
          color: 'rgba(255,255,255,0.70)',
          letterSpacing: '0.5px',
          textTransform: 'uppercase' as const,
          marginBottom: 14,
        }}>{title}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative' as const, width: 110, height: 110, flexShrink: 0, minWidth: 110, minHeight: 110 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>

                <defs>
                  <filter id="ring-glow">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <Pie
                  data={segments}
                  cx="50%"
                  cy="50%"
                  innerRadius={36}
                  outerRadius={50}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                  strokeWidth={0}
                  paddingAngle={4}
                  cornerRadius={6}
                  filter="url(#ring-glow)"
                >
                  {segments.map((seg, i) => (
                    <Cell key={i} fill={seg.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute' as const,
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none' as const,
            }}>
              <div style={{
                fontSize: 28,
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: '1',
                letterSpacing: '-0.3px',
              }}>{centerValue}</div>
              <div style={{
                fontSize: 10,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.70)',
                marginTop: 3,
              }}>{centerLabel}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>
            {segments.map((seg, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    background: seg.color,
                    flexShrink: 0,
                    boxShadow: `0 0 6px ${seg.color}40`,
                  }} />
                  <span style={{
                    fontSize: 11,
                    fontWeight: 400,
                    color: 'rgba(255,255,255,0.55)',
                    whiteSpace: 'nowrap' as const,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>{seg.label}</span>
                </div>
                <span style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.75)',
                  whiteSpace: 'nowrap' as const,
                  flexShrink: 0,
                }}>{total > 0 ? `${Math.round((seg.value / total) * 100)}%` : '0%'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function cardShell(_accentColor?: string): React.CSSProperties {
  return {
    position: 'relative' as const,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.07)',
    background: '#1C1C1E',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.02)',
    width: '100%',
    height: '100%',
  };
}

const nativeStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: '#1C1C1E',
    padding: 16,
  },
  title: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.70)',
    marginBottom: 8,
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
});

export function SegmentRingCard(props: any) {
  return (
    <PageErrorBoundary pageName="segment-ring-card">
      <SegmentRingCardInner {...props} />
    </PageErrorBoundary>
  );
}
