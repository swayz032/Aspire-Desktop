import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

import { injectCardKeyframes } from './cardAnimations';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

injectCardKeyframes();

export interface QueueItem {
  label: string;
  amount: string;
  status: 'active' | 'warning' | 'overdue' | 'pending';
  age?: string;
  progress?: number;
}

export interface QueueInstrumentCardProps {
  title: string;
  items: QueueItem[];
  accentColor: string;
  mode?: string;
  loading?: boolean;
}

const statusColors: Record<QueueItem['status'], string> = {
  active: '#34c759',
  warning: '#F59E0B',
  overdue: '#ff3b30',
  pending: 'rgba(255,255,255,0.60)',
};

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

function QueueInstrumentCardInner({ title, items, accentColor, mode, loading }: QueueInstrumentCardProps) {
  if (Platform.OS !== 'web') {
    return (
      <View style={nativeStyles.card}>
        <Text style={nativeStyles.title}>{title}</Text>
        <Text style={nativeStyles.count}>{items.length} items</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <div style={cardShell(accentColor)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
          <ShimmerLine width="40%" height={10} />
          {[1, 2, 3].map(i => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <ShimmerLine width="50%" height={12} />
              <ShimmerLine width="20%" height={12} />
            </div>
          ))}
        </div>
      </div>
    );
  }

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

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map((item, i) => {
            const dotColor = statusColors[item.status];
            return (
              <div key={i}>
                {i > 0 && (
                  <div style={{
                    height: 0,
                    borderTop: '0.5px solid rgba(255,255,255,0.06)',
                  }} />
                )}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  position: 'relative' as const,
                  overflow: 'hidden',
                }}>
                  {item.progress !== undefined && item.progress > 0 && (
                    <div style={{
                      position: 'absolute' as const,
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${Math.min(item.progress, 100)}%`,
                      background: `linear-gradient(90deg, ${accentColor}08 0%, ${accentColor}03 100%)`,
                      pointerEvents: 'none' as const,
                    }} />
                  )}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minWidth: 0,
                    flex: 1,
                    position: 'relative' as const,
                    zIndex: 1,
                  }}>
                    <div style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      background: dotColor,
                      flexShrink: 0,
                      boxShadow: `0 0 6px ${dotColor}60`,
                    }} />
                    <span style={{
                      fontSize: 13,
                      fontWeight: 400,
                      color: 'rgba(255,255,255,0.7)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap' as const,
                    }}>{item.label}</span>
                    {item.age && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 500,
                        color: 'rgba(255,255,255,0.65)',
                        background: 'rgba(255,255,255,0.04)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        whiteSpace: 'nowrap' as const,
                        flexShrink: 0,
                      }}>{item.age}</span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#ffffff',
                    whiteSpace: 'nowrap' as const,
                    flexShrink: 0,
                    position: 'relative' as const,
                    zIndex: 1,
                    marginLeft: 12,
                  }}>{item.amount}</span>
                </div>
              </div>
            );
          })}
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
  count: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
});

export function QueueInstrumentCard(props: any) {
  return (
    <PageErrorBoundary pageName="queue-instrument-card">
      <QueueInstrumentCardInner {...props} />
    </PageErrorBoundary>
  );
}
