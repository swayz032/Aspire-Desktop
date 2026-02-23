import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius } from '@/constants/tokens';
import { DocumentPreviewModal } from './DocumentPreviewModal';

interface DocumentThumbnailProps {
  type: 'invoice' | 'contract' | 'report' | 'email' | 'document' | 'recording';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: number;
  context?: 'todayplan' | 'authorityqueue' | 'conference' | 'financehub';
  documentName?: string;
  previewEnabled?: boolean;
  pandadocDocumentId?: string;
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  invoice: { label: 'INVOICE', color: '#3B82F6' },
  contract: { label: 'NDA', color: '#3B82F6' },
  report: { label: 'REPORT', color: '#3B82F6' },
  email: { label: 'EMAIL', color: '#3B82F6' },
  document: { label: 'DOC', color: '#3B82F6' },
  recording: { label: 'REC', color: '#3B82F6' },
};

type LineSpec = { w: string; h: number; o: number; mb?: number; align?: 'right' | 'left'; bold?: boolean };
type LayoutSpec = { header: LineSpec[]; body: LineSpec[] };

function getLayout(type: string, scale: number): LayoutSpec {
  const h = 2 * scale;
  const hBold = 2.5 * scale;
  const thin = 1.5 * scale;
  const gap = 1.5 * scale;
  const pgap = 3 * scale;

  switch (type) {
    case 'invoice':
      return {
        header: [
          { w: '50%', h: hBold, o: 0.45, bold: true },
          { w: '40%', h: thin, o: 0.2, mb: gap },
          { w: '35%', h: thin, o: 0.18 },
          { w: '30%', h: thin, o: 0.15, align: 'right' },
        ],
        body: [
          { w: '100%', h: thin * 0.6, o: 0.12, mb: gap },
          { w: '70%', h: h, o: 0.25 },
          { w: '22%', h: h, o: 0.3, align: 'right' },
          { w: '60%', h: h, o: 0.2, mb: gap },
          { w: '22%', h: h, o: 0.25, align: 'right' },
          { w: '55%', h: h, o: 0.2 },
          { w: '22%', h: h, o: 0.25, align: 'right' },
          { w: '100%', h: thin * 0.5, o: 0.1, mb: gap },
          { w: '35%', h: hBold, o: 0.4, align: 'right', bold: true },
        ],
      };
    case 'contract':
      return {
        header: [
          { w: '72%', h: hBold, o: 0.45, bold: true },
          { w: '55%', h: thin, o: 0.2, mb: gap },
          { w: '60%', h: thin, o: 0.18 },
          { w: '50%', h: thin, o: 0.15 },
        ],
        body: [
          { w: '92%', h: h, o: 0.22 },
          { w: '88%', h: h, o: 0.2 },
          { w: '85%', h: h, o: 0.2 },
          { w: '78%', h: h, o: 0.18, mb: pgap },
          { w: '90%', h: h, o: 0.22 },
          { w: '82%', h: h, o: 0.2 },
          { w: '70%', h: h, o: 0.18, mb: pgap },
          { w: '30%', h: thin * 0.5, o: 0.3, mb: gap },
          { w: '25%', h: thin, o: 0.15 },
        ],
      };
    case 'report':
      return {
        header: [
          { w: '65%', h: hBold, o: 0.45, bold: true },
          { w: '45%', h: thin, o: 0.2 },
          { w: '35%', h: thin, o: 0.15, mb: gap },
        ],
        body: [
          { w: '100%', h: thin * 0.5, o: 0.1 },
          { w: '45%', h: h, o: 0.22 },
          { w: '28%', h: h, o: 0.3, align: 'right' },
          { w: '100%', h: thin * 0.5, o: 0.08 },
          { w: '40%', h: h, o: 0.22 },
          { w: '28%', h: h, o: 0.25, align: 'right' },
          { w: '100%', h: thin * 0.5, o: 0.08 },
          { w: '50%', h: h, o: 0.22 },
          { w: '28%', h: h, o: 0.28, align: 'right' },
          { w: '100%', h: thin * 0.5, o: 0.1, mb: gap },
          { w: '40%', h: hBold, o: 0.35, align: 'right', bold: true },
        ],
      };
    case 'email':
      return {
        header: [
          { w: '20%', h: thin, o: 0.3 },
          { w: '55%', h: thin, o: 0.18 },
          { w: '20%', h: thin, o: 0.3 },
          { w: '42%', h: thin, o: 0.18, mb: gap },
          { w: '20%', h: thin, o: 0.3 },
          { w: '65%', h: hBold, o: 0.35, bold: true },
        ],
        body: [
          { w: '92%', h: h, o: 0.22 },
          { w: '85%', h: h, o: 0.2 },
          { w: '88%', h: h, o: 0.2 },
          { w: '75%', h: h, o: 0.18, mb: pgap },
          { w: '90%', h: h, o: 0.22 },
          { w: '80%', h: h, o: 0.2 },
          { w: '60%', h: h, o: 0.18 },
        ],
      };
    case 'recording':
      return {
        header: [
          { w: '60%', h: hBold, o: 0.45, bold: true },
          { w: '50%', h: thin, o: 0.2 },
          { w: '35%', h: thin, o: 0.18 },
        ],
        body: [
          { w: '18%', h: h, o: 0.28 },
          { w: '60%', h: h, o: 0.2 },
          { w: '18%', h: h, o: 0.28 },
          { w: '55%', h: h, o: 0.2 },
          { w: '18%', h: h, o: 0.28 },
          { w: '65%', h: h, o: 0.2 },
          { w: '18%', h: h, o: 0.28 },
          { w: '50%', h: h, o: 0.2 },
          { w: '18%', h: h, o: 0.28 },
          { w: '45%', h: h, o: 0.2 },
        ],
      };
    default:
      return {
        header: [
          { w: '55%', h: hBold, o: 0.45, bold: true },
          { w: '40%', h: thin, o: 0.2 },
          { w: '48%', h: thin, o: 0.18 },
          { w: '35%', h: thin, o: 0.15 },
        ],
        body: [
          { w: '90%', h: h, o: 0.22 },
          { w: '85%', h: h, o: 0.2 },
          { w: '80%', h: h, o: 0.2 },
          { w: '72%', h: h, o: 0.18, mb: pgap },
          { w: '88%', h: h, o: 0.22 },
          { w: '82%', h: h, o: 0.2 },
          { w: '75%', h: h, o: 0.18, mb: pgap },
          { w: '85%', h: h, o: 0.2 },
          { w: '65%', h: h, o: 0.18 },
        ],
      };
  }
}

function DocLine({ spec, lineGap }: { spec: LineSpec; lineGap: number }) {
  return (
    <View style={{
      flexDirection: 'row',
      justifyContent: spec.align === 'right' ? 'flex-end' : 'flex-start',
      marginBottom: spec.mb ?? lineGap,
    }}>
      <View style={{
        width: spec.w as any,
        height: spec.h,
        backgroundColor: spec.bold ? '#1F2937' : '#6B7280',
        opacity: spec.o,
        borderRadius: spec.h * 0.3,
      }} />
    </View>
  );
}

export function DocumentThumbnail({
  type,
  size = 'md',
  variant = 0,
  context = 'authorityqueue',
  documentName,
  previewEnabled = true,
  pandadocDocumentId,
}: DocumentThumbnailProps) {
  const [hovered, setHovered] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const dimensions = {
    sm: { width: 40, height: 52 },
    md: { width: 56, height: 72 },
    lg: { width: 72, height: 92 },
    xl: { width: 100, height: 130 },
  }[size];

  const config = TYPE_CONFIG[type] || TYPE_CONFIG.document;

  const scale = { sm: 0.55, md: 0.7, lg: 0.85, xl: 1.1 }[size];
  const pad = { sm: 3, md: 4.5, lg: 6, xl: 8 }[size];
  const stripH = { sm: 10, md: 13, lg: 15, xl: 19 }[size];
  const labelSize = { sm: 5, md: 6.5, lg: 8, xl: 10 }[size];
  const lineGap = { sm: 1.2, md: 1.6, lg: 2, xl: 2.5 }[size];

  const layout = getLayout(type, scale);

  const headerCount = size === 'sm' ? 2 : size === 'md' ? 3 : layout.header.length;
  const bodyCount = size === 'sm' ? 3 : size === 'md' ? 5 : size === 'lg' ? 7 : layout.body.length;

  const curlSize = { sm: 6, md: 8, lg: 10, xl: 14 }[size];
  const eyeSize = { sm: 10, md: 14, lg: 18, xl: 24 }[size];
  const previewFontSize = { sm: 0, md: 0, lg: 7, xl: 9 }[size];
  const showLabel = size === 'lg' || size === 'xl';

  const cardContent = (
    <View style={[styles.card, dimensions]}>
      <View style={[styles.section, { padding: pad, paddingBottom: pad * 0.4 }]}>
        {layout.header.slice(0, headerCount).map((spec, i) => (
          <DocLine key={`h${i}`} spec={spec} lineGap={lineGap} />
        ))}
      </View>

      <View style={[styles.strip, { height: stripH }]}>
        <View style={styles.stripGradient} />
        <Text style={[styles.stripLabel, { fontSize: labelSize }]}>
          {config.label}
        </Text>
      </View>

      <View style={[styles.section, { padding: pad, paddingTop: pad * 0.6, flex: 1 }]}>
        {layout.body.slice(0, bodyCount).map((spec, i) => (
          <DocLine key={`b${i}`} spec={spec} lineGap={lineGap} />
        ))}
      </View>

      <View style={[styles.curlContainer, { width: curlSize, height: curlSize }]}>
        <View style={[styles.curlFold, { 
          width: curlSize, 
          height: curlSize,
          borderTopLeftRadius: curlSize * 0.3,
        }]} />
        <View style={[styles.curlShadow, {
          width: curlSize,
          height: curlSize,
        }]} />
      </View>

      {previewEnabled && (
        <View style={[styles.hoverOverlay, hovered ? styles.hoverOverlayVisible : styles.hoverOverlayHidden]}>
          <Ionicons name="eye-outline" size={eyeSize} color="#FFFFFF" />
          {showLabel && (
            <Text style={[styles.hoverLabel, { fontSize: previewFontSize }]}>Preview</Text>
          )}
        </View>
      )}
    </View>
  );

  if (!previewEnabled) {
    return cardContent;
  }

  return (
    <>
      <Pressable
        onPress={() => setPreviewOpen(true)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={({ pressed }: any) => [
          pressed && styles.pressed,
          Platform.OS === 'web' ? { cursor: 'pointer' } as any : {},
        ]}
      >
        {cardContent}
      </Pressable>

      <DocumentPreviewModal
        visible={previewOpen}
        onClose={() => setPreviewOpen(false)}
        type={type}
        documentName={documentName}
        pandadocDocumentId={pandadocDocumentId}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xs + 1,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative' as const,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 1px 4px rgba(0,0,0,0.08), 0 0.5px 1.5px rgba(0,0,0,0.05)',
      transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out',
    } : {}),
  } as any,
  section: {
    overflow: 'hidden',
  },
  curlContainer: {
    position: 'absolute' as const,
    bottom: 0,
    right: 0,
    overflow: 'hidden',
  },
  curlFold: {
    position: 'absolute' as const,
    bottom: 0,
    right: 0,
    ...(Platform.OS === 'web' ? {
      background: 'linear-gradient(135deg, #E5E7EB 0%, #D1D5DB 40%, #F3F4F6 100%)',
    } : {
      backgroundColor: '#E5E7EB',
    }),
  } as any,
  curlShadow: {
    position: 'absolute' as const,
    bottom: 0,
    right: 0,
    ...(Platform.OS === 'web' ? {
      background: 'linear-gradient(135deg, rgba(0,0,0,0.08) 0%, transparent 60%)',
    } : {}),
  } as any,
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
  hoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.xs + 1,
    gap: 3,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(2px)',
      transition: 'opacity 0.2s ease-out',
      pointerEvents: 'none',
    } : {}),
  } as any,
  hoverOverlayVisible: {
    opacity: 1,
  },
  hoverOverlayHidden: {
    opacity: 0,
  },
  hoverLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
    ...(Platform.OS === 'web' ? {
      textShadow: '0 1px 3px rgba(0,0,0,0.3)',
    } : {}),
  } as any,
  pressed: {
    transform: [{ scale: 0.96 }],
  },
});
