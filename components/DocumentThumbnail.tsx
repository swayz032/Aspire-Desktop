import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BorderRadius } from '@/constants/tokens';

interface DocumentThumbnailProps {
  type: 'invoice' | 'contract' | 'report' | 'email' | 'document' | 'recording';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: number;
  context?: 'todayplan' | 'authorityqueue' | 'conference' | 'financehub';
}

const TYPE_CONFIG: Record<string, { label: string }> = {
  invoice: { label: 'INVOICE' },
  contract: { label: 'NDA' },
  report: { label: 'REPORT' },
  email: { label: 'EMAIL' },
  document: { label: 'DOC' },
  recording: { label: 'REC' },
};

export function DocumentThumbnail({ 
  type, 
  size = 'md',
  variant = 0,
  context = 'authorityqueue'
}: DocumentThumbnailProps) {
  const dimensions = {
    sm: { width: 40, height: 52 },
    md: { width: 56, height: 72 },
    lg: { width: 72, height: 92 },
    xl: { width: 100, height: 130 },
  }[size];

  const config = TYPE_CONFIG[type] || TYPE_CONFIG.document;

  const s = {
    sm: { label: 5.5, stripH: 12, lineH: 1.5, gap: 2.5, pad: 4 },
    md: { label: 7, stripH: 16, lineH: 2, gap: 3, pad: 5 },
    lg: { label: 8.5, stripH: 18, lineH: 2.5, gap: 3.5, pad: 7 },
    xl: { label: 10, stripH: 22, lineH: 3, gap: 4, pad: 9 },
  }[size];

  const topLines = [
    { w: '55%', o: 0.22 },
    { w: '80%', o: 0.13 },
    { w: '65%', o: 0.13 },
    { w: '90%', o: 0.10 },
  ];

  const bottomLines = [
    { w: '88%', o: 0.13 },
    { w: '72%', o: 0.13 },
    { w: '60%', o: 0.10 },
    { w: '82%', o: 0.10 },
    { w: '40%', o: 0.08 },
  ];

  const visibleTop = size === 'sm' ? 2 : size === 'md' ? 3 : 4;
  const visibleBottom = size === 'sm' ? 2 : size === 'md' ? 3 : size === 'lg' ? 4 : 5;

  return (
    <View style={[styles.card, dimensions]}>
      <View style={[styles.topSection, { paddingHorizontal: s.pad, paddingTop: s.pad, gap: s.gap }]}>
        {topLines.slice(0, visibleTop).map((line, i) => (
          <View
            key={`t${i}`}
            style={[
              styles.docLine,
              {
                height: s.lineH,
                width: line.w as any,
                opacity: line.o,
                backgroundColor: i === 0 ? '#4B5563' : '#9CA3AF',
              },
            ]}
          />
        ))}
      </View>

      <View style={[styles.strip, { height: s.stripH }]}>
        <View style={styles.stripGradient} />
        <Text style={[styles.stripLabel, { fontSize: s.label }]}>
          {config.label}
        </Text>
      </View>

      <View style={[styles.bottomSection, { paddingHorizontal: s.pad, paddingBottom: s.pad, gap: s.gap }]}>
        {bottomLines.slice(0, visibleBottom).map((line, i) => (
          <View
            key={`b${i}`}
            style={[
              styles.docLine,
              {
                height: s.lineH,
                width: line.w as any,
                opacity: line.o,
                backgroundColor: '#9CA3AF',
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xs + 1,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    } : {}),
  } as any,
  topSection: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bottomSection: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  docLine: {
    borderRadius: 0.5,
  },
  strip: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginVertical: 1,
  },
  stripGradient: {
    ...StyleSheet.absoluteFillObject,
    ...(Platform.OS === 'web' ? {
      background: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 45%, #60A5FA 100%)',
    } : {
      backgroundColor: '#3B82F6',
    }),
  } as any,
  stripLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 1.8,
    textAlign: 'center',
    zIndex: 1,
    ...(Platform.OS === 'web' ? {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      textShadow: '0 1px 2px rgba(0,0,0,0.15)',
    } : {}),
  } as any,
});
