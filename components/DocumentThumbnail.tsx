import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BorderRadius } from '@/constants/tokens';

interface DocumentThumbnailProps {
  type: 'invoice' | 'contract' | 'report' | 'email' | 'document' | 'recording';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: number;
  context?: 'todayplan' | 'authorityqueue' | 'conference' | 'financehub';
}

const TYPE_CONFIG: Record<string, { label: string; accent: string; icon: string }> = {
  invoice: { label: 'INVOICE', accent: '#3B82F6', icon: '$' },
  contract: { label: 'NDA', accent: '#3B82F6', icon: '\u00A7' },
  report: { label: 'REPORT', accent: '#3B82F6', icon: '\u25A0' },
  email: { label: 'EMAIL', accent: '#3B82F6', icon: '@' },
  document: { label: 'DOC', accent: '#3B82F6', icon: '\u2261' },
  recording: { label: 'REC', accent: '#3B82F6', icon: '\u25CF' },
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

  const fontSizes = {
    sm: { label: 6, icon: 10, lines: 3, lineH: 2 },
    md: { label: 7.5, icon: 14, lines: 4, lineH: 2.5 },
    lg: { label: 9, icon: 18, lines: 5, lineH: 3 },
    xl: { label: 11, icon: 24, lines: 6, lineH: 3.5 },
  }[size];

  const headerHeight = size === 'sm' ? 14 : size === 'md' ? 18 : size === 'lg' ? 22 : 28;

  return (
    <View style={[styles.card, dimensions]}>
      <View style={[styles.header, { height: headerHeight }]}>
        <View style={styles.headerGradient} />
        <View style={styles.headerGradientOverlay} />
        <Text style={[styles.headerLabel, { fontSize: fontSizes.label }]}>
          {config.label}
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.watermarkContainer}>
          <Text style={[styles.watermark, { fontSize: dimensions.width * 0.55 }]}>
            A
          </Text>
        </View>

        <View style={styles.linesContainer}>
          {Array.from({ length: fontSizes.lines }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.textLine,
                {
                  height: fontSizes.lineH,
                  width: i === 0 ? '85%' : i === fontSizes.lines - 1 ? '45%' : `${70 + ((i * 13) % 20)}%`,
                  opacity: i === 0 ? 0.35 : 0.18,
                },
              ]}
            />
          ))}
        </View>

        {size !== 'sm' && (
          <View style={styles.iconBadge}>
            <Text style={[styles.iconText, { fontSize: fontSizes.icon }]}>
              {config.icon}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.footerLine} />
        <View style={[styles.footerDot, { backgroundColor: config.accent }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xs + 1,
    overflow: 'hidden',
    backgroundColor: '#FAFBFC',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(59,130,246,0.08)',
    } : {}),
  } as any,
  header: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B82F6',
  },
  headerGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? {
      background: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 50%, #60A5FA 100%)',
    } : {}),
  } as any,
  headerLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    ...(Platform.OS === 'web' ? {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      textShadow: '0 1px 2px rgba(0,0,0,0.2)',
    } : {}),
  } as any,
  body: {
    flex: 1,
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 4,
    position: 'relative',
    justifyContent: 'flex-start',
  },
  watermarkContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  watermark: {
    color: 'rgba(59, 130, 246, 0.04)',
    fontWeight: '900',
    ...(Platform.OS === 'web' ? {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      userSelect: 'none',
    } : {}),
  } as any,
  linesContainer: {
    gap: 4,
    zIndex: 1,
  },
  textLine: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderRadius: 1,
  },
  iconBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    opacity: 0.08,
  },
  iconText: {
    color: '#3B82F6',
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingBottom: 4,
    gap: 4,
  },
  footerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  footerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.5,
  },
});
