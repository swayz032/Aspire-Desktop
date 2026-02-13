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

const MICRO_CONTENT: Record<string, { above: string[]; below: string[] }> = {
  invoice: {
    above: [
      'INVOICE #10423',
      'Zenith Solutions LLC',
      'Date: Jan 15, 2026',
      'Due: Feb 14, 2026',
    ],
    below: [
      'Consulting Services    $3,200.00',
      'Platform License         $800.00',
      'Support (Q1)             $420.00',
      '―――――――――――――――',
      'Subtotal              $4,420.00',
      'Tax (8.5%)              $375.70',
      'TOTAL                $4,795.70',
    ],
  },
  contract: {
    above: [
      'NON-DISCLOSURE AGREEMENT',
      'Effective Date: January 10, 2026',
      'Between: Zenith Solutions LLC',
      'And: Apex Corp International',
    ],
    below: [
      '1. Confidential Information shall',
      'mean any data or information that',
      'is proprietary to the Disclosing',
      'Party, whether set forth orally,',
      'in writing, or in electronic form.',
      '___________    ___________',
      'Signature         Date',
    ],
  },
  report: {
    above: [
      'Q4 PERFORMANCE REPORT',
      'Zenith Solutions — FY2025',
      'Prepared: Jan 8, 2026',
      'Classification: Internal',
    ],
    below: [
      'Revenue        $284,500  ▲ 12%',
      'Expenses       $198,200  ▼  3%',
      'Net Income      $86,300  ▲ 24%',
      'Headcount            42  ▲  5',
      'Retention          94.2%',
      '―――――――――――――――',
      'Outlook: Positive',
    ],
  },
  email: {
    above: [
      'From: m.chen@apexcorp.com',
      'To: founder@zenith.io',
      'Subject: Partnership Proposal',
      'Date: Feb 12, 2026  9:41 AM',
    ],
    below: [
      'Hi,',
      'Following our call last week,',
      'I wanted to outline the terms',
      'we discussed regarding the Q2',
      'partnership expansion. Please',
      'review the attached and let me',
      'know your thoughts. — Michael',
    ],
  },
  document: {
    above: [
      'ZENITH SOLUTIONS LLC',
      '1240 Market Street, Suite 400',
      'San Francisco, CA 94102',
      'Tel: (415) 555-0142',
    ],
    below: [
      'Dear Valued Partner,',
      'We are pleased to confirm the',
      'terms outlined in our previous',
      'correspondence. The enclosed',
      'documents have been reviewed',
      'and approved by our legal team.',
      'Best regards, Operations',
    ],
  },
  recording: {
    above: [
      'MEETING TRANSCRIPT',
      'Board Review — Q4 Results',
      'Date: Jan 22, 2026',
      'Duration: 01:24:33',
    ],
    below: [
      '[00:00] Opening remarks',
      '[04:12] Revenue review — CFO',
      '[18:30] Product roadmap update',
      '[32:15] Hiring plan discussion',
      '[48:00] Budget approval vote',
      '[01:12] Action items summary',
      '[01:22] Closing — Adjourned',
    ],
  },
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
  const content = MICRO_CONTENT[type] || MICRO_CONTENT.document;

  const s = {
    sm: { label: 5.5, stripH: 10, fontSize: 2.2, lineH: 3.2, pad: 2.5, headerSize: 2.5 },
    md: { label: 7, stripH: 13, fontSize: 2.8, lineH: 4, pad: 3.5, headerSize: 3.2 },
    lg: { label: 8.5, stripH: 15, fontSize: 3.5, lineH: 4.8, pad: 5, headerSize: 4 },
    xl: { label: 10, stripH: 18, fontSize: 4.5, lineH: 6, pad: 6, headerSize: 5.5 },
  }[size];

  const aboveCount = size === 'sm' ? 2 : size === 'md' ? 3 : 4;
  const belowCount = size === 'sm' ? 3 : size === 'md' ? 4 : size === 'lg' ? 5 : 7;

  return (
    <View style={[styles.card, dimensions]}>
      {/* Above strip — header/letterhead micro-text */}
      <View style={[styles.section, { padding: s.pad, paddingBottom: 0 }]}>
        {content.above.slice(0, aboveCount).map((line, i) => (
          <Text
            key={`a${i}`}
            numberOfLines={1}
            style={[
              styles.microText,
              {
                fontSize: i === 0 ? s.headerSize : s.fontSize,
                lineHeight: s.lineH,
                opacity: i === 0 ? 0.4 : 0.25,
                fontWeight: i === 0 ? '700' : '400',
              },
            ]}
          >
            {line}
          </Text>
        ))}
      </View>

      {/* Blue type strip */}
      <View style={[styles.strip, { height: s.stripH }]}>
        <View style={styles.stripGradient} />
        <Text style={[styles.stripLabel, { fontSize: s.label }]}>
          {config.label}
        </Text>
      </View>

      {/* Below strip — body content micro-text */}
      <View style={[styles.section, { padding: s.pad, paddingTop: s.pad * 0.6, flex: 1 }]}>
        {content.below.slice(0, belowCount).map((line, i) => (
          <Text
            key={`b${i}`}
            numberOfLines={1}
            style={[
              styles.microText,
              {
                fontSize: s.fontSize,
                lineHeight: s.lineH,
                opacity: 0.22,
                fontWeight: line.includes('TOTAL') || line.includes('―') ? '600' : '400',
              },
            ]}
          >
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xs + 1,
    overflow: 'hidden',
    backgroundColor: '#F8F8F7',
    borderWidth: 1,
    borderColor: '#E2E2E0',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    } : {}),
  } as any,
  section: {
    overflow: 'hidden',
  },
  microText: {
    color: '#1A1A1A',
    ...(Platform.OS === 'web' ? {
      fontFamily: "'SF Mono', 'Menlo', 'Consolas', 'Liberation Mono', monospace",
      userSelect: 'none',
      whiteSpace: 'nowrap',
    } : {
      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    }),
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
});
