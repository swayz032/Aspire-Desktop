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
    sm: { label: 5.5, stripH: 11, lineH: 1, thickH: 1.5, gap: 1.5, pad: 3, thinGap: 1 },
    md: { label: 7, stripH: 14, lineH: 1.5, thickH: 2, gap: 2, pad: 4, thinGap: 1.5 },
    lg: { label: 8.5, stripH: 16, lineH: 2, thickH: 2.5, gap: 2.5, pad: 5, thinGap: 2 },
    xl: { label: 10, stripH: 20, lineH: 2.5, thickH: 3, gap: 3, pad: 7, thinGap: 2.5 },
  }[size];

  const isSmall = size === 'sm';
  const isMedium = size === 'md';

  return (
    <View style={[styles.card, dimensions]}>
      {/* Letterhead area */}
      <View style={[styles.letterhead, { padding: s.pad, paddingBottom: 0, gap: s.thinGap }]}>
        {/* Company name - bold dark line */}
        <View style={{ height: s.thickH, width: '60%', backgroundColor: '#374151', opacity: 0.35, borderRadius: 0.5 }} />
        {/* Address lines */}
        <View style={{ height: s.lineH, width: '45%', backgroundColor: '#9CA3AF', opacity: 0.2, borderRadius: 0.5 }} />
        {!isSmall && (
          <View style={{ height: s.lineH, width: '50%', backgroundColor: '#9CA3AF', opacity: 0.15, borderRadius: 0.5 }} />
        )}
        {/* Thin separator */}
        <View style={{ height: 0.5, width: '100%', backgroundColor: '#D1D5DB', opacity: 0.3, marginTop: s.thinGap }} />
      </View>

      {/* Blue type strip */}
      <View style={[styles.strip, { height: s.stripH }]}>  
        <View style={styles.stripGradient} />
        <Text style={[styles.stripLabel, { fontSize: s.label }]}>
          {config.label}
        </Text>
      </View>

      {/* Document body */}
      <View style={[styles.body, { paddingHorizontal: s.pad, gap: s.thinGap, paddingTop: s.thinGap }]}>
        {/* Paragraph 1 */}
        <View style={{ gap: s.thinGap }}>
          <View style={{ height: s.lineH, width: '92%', backgroundColor: '#6B7280', opacity: 0.18, borderRadius: 0.5 }} />
          <View style={{ height: s.lineH, width: '85%', backgroundColor: '#6B7280', opacity: 0.15, borderRadius: 0.5 }} />
          <View style={{ height: s.lineH, width: '78%', backgroundColor: '#6B7280', opacity: 0.13, borderRadius: 0.5 }} />
          {!isSmall && (
            <View style={{ height: s.lineH, width: '88%', backgroundColor: '#6B7280', opacity: 0.14, borderRadius: 0.5 }} />
          )}
        </View>

        {/* Paragraph gap */}
        <View style={{ height: s.thinGap }} />

        {/* Paragraph 2 / amounts area */}
        {!isSmall && (
          <View style={{ gap: s.thinGap }}>
            <View style={{ height: s.lineH, width: '90%', backgroundColor: '#6B7280', opacity: 0.16, borderRadius: 0.5 }} />
            <View style={{ height: s.lineH, width: '70%', backgroundColor: '#6B7280', opacity: 0.13, borderRadius: 0.5 }} />
            {!isMedium && (
              <>
                <View style={{ height: s.lineH, width: '82%', backgroundColor: '#6B7280', opacity: 0.14, borderRadius: 0.5 }} />
                {/* Amount line - right aligned, bolder */}
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                  <View style={{ height: s.thickH, width: '35%', backgroundColor: '#374151', opacity: 0.22, borderRadius: 0.5 }} />
                </View>
              </>
            )}
          </View>
        )}

        {/* Signature area */}
        {(size === 'lg' || size === 'xl') && (
          <View style={{ marginTop: 'auto', gap: s.thinGap, paddingBottom: s.pad }}>
            <View style={{ height: 0.5, width: '40%', backgroundColor: '#9CA3AF', opacity: 0.25, borderRadius: 0.5 }} />
            <View style={{ height: s.lineH, width: '30%', backgroundColor: '#9CA3AF', opacity: 0.15, borderRadius: 0.5 }} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xs + 1,
    overflow: 'hidden',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    } : {}),
  } as any,
  letterhead: {
    justifyContent: 'flex-end',
  },
  strip: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
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
  body: {
    flex: 1,
  },
});
