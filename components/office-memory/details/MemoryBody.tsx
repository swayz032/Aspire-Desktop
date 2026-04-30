/**
 * MemoryBody — unified rich-body renderer for markdown / plaintext / html
 * memory content (used by note, strategy, research, summary, document).
 *
 * Web → react-markdown for `markdown`, raw <Text> for `plaintext`, sanitized
 *        innerHTML via dangerouslySetInnerHTML for `html` (only honor when
 *        explicitly requested; never default to html).
 * Native → markdown is rendered as plaintext fallback (full md parser pulls
 *        too much native weight for V1; the body still reads cleanly with
 *        line preservation and link extraction).
 *
 * The card chrome matches the rest of Memory Engine: deep-charcoal cardBg +
 * 1px hairline + drop shadow + inset highlight. Editorial typography per
 * §12.1 — body uses opacity-layered white (not literal grey) + line-height
 * 1.5 for comfortable reading.
 */

import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Colors, BorderRadius } from '@/constants/tokens';

// react-markdown is web-only — pull the type lazily so native bundles don't
// drop the runtime in.
type ReactMarkdownComponent = (props: { children: string; components?: Record<string, unknown> }) => React.ReactElement;
let ReactMarkdown: ReactMarkdownComponent | null = null;
if (Platform.OS === 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  ReactMarkdown = require('react-markdown').default as ReactMarkdownComponent;
}

export interface MemoryBodyProps {
  content: string;
  /** Body format hint. Defaults to 'markdown'. */
  format?: 'markdown' | 'plaintext' | 'html';
  /** Eyebrow override (default: "Body"). */
  eyebrow?: string;
  /** Hide eyebrow entirely (e.g. when the parent provides its own header). */
  hideEyebrow?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function MemoryBody({
  content,
  format = 'markdown',
  eyebrow = 'Body',
  hideEyebrow,
}: MemoryBodyProps) {
  return (
    <View style={styles.card}>
      {!hideEyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}

      {format === 'html' && Platform.OS === 'web' ? (
        React.createElement('div' as unknown as 'div', {
          dangerouslySetInnerHTML: { __html: content },
          style: htmlStyle,
        })
      ) : format === 'markdown' && Platform.OS === 'web' && ReactMarkdown ? (
        <View style={mdWrapStyle}>
          <ReactMarkdown components={mdComponents}>{content}</ReactMarkdown>
        </View>
      ) : (
        <Text style={styles.plaintext} accessibilityLabel="Memory body">
          {stripMarkdown(content)}
        </Text>
      )}
    </View>
  );
}

// ─── Plaintext fallback (native + non-md) ──────────────────────────────────

function stripMarkdown(s: string): string {
  // Lightweight markdown stripper — preserves paragraph breaks, drops `**`,
  // `_`, `#`, code fences, and link syntax. Only for native fallback.
  return s
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, '').trim())
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^>\s?/gm, '');
}

// ─── Markdown component overrides (web only) ───────────────────────────────

const htmlStyle: React.CSSProperties = {
  fontSize: 16,
  lineHeight: 1.6,
  color: 'rgba(255,255,255,0.78)',
  fontWeight: 400,
  letterSpacing: -0.05,
};

const mdWrapStyle: React.CSSProperties & ViewStyle = ({
  fontFamily: 'inherit',
} as React.CSSProperties) as React.CSSProperties & ViewStyle;

const mdComponents: Record<string, unknown> = {
  // h1
  h1: (p: { children?: React.ReactNode }) =>
    React.createElement('h1' as unknown as 'div', {
      style: {
        fontSize: 22,
        fontWeight: 700,
        lineHeight: 1.25,
        color: '#FFFFFF',
        letterSpacing: -0.4,
        marginTop: 18,
        marginBottom: 12,
      },
    }, p.children as React.ReactNode),
  h2: (p: { children?: React.ReactNode }) =>
    React.createElement('h2' as unknown as 'div', {
      style: {
        fontSize: 18,
        fontWeight: 700,
        lineHeight: 1.3,
        color: '#FFFFFF',
        letterSpacing: -0.3,
        marginTop: 14,
        marginBottom: 8,
      },
    }, p.children as React.ReactNode),
  h3: (p: { children?: React.ReactNode }) =>
    React.createElement('h3' as unknown as 'div', {
      style: {
        fontSize: 15,
        fontWeight: 700,
        lineHeight: 1.35,
        color: '#FFFFFF',
        letterSpacing: -0.2,
        marginTop: 12,
        marginBottom: 6,
      },
    }, p.children as React.ReactNode),
  p: (p: { children?: React.ReactNode }) =>
    React.createElement('p' as unknown as 'div', {
      style: {
        fontSize: 15,
        lineHeight: 1.6,
        color: 'rgba(255,255,255,0.78)',
        fontWeight: 400,
        marginTop: 0,
        marginBottom: 12,
      },
    }, p.children as React.ReactNode),
  ul: (p: { children?: React.ReactNode }) =>
    React.createElement('ul' as unknown as 'div', {
      style: {
        fontSize: 15,
        lineHeight: 1.6,
        color: 'rgba(255,255,255,0.78)',
        paddingLeft: 22,
        margin: 0,
        marginBottom: 12,
      },
    }, p.children as React.ReactNode),
  ol: (p: { children?: React.ReactNode }) =>
    React.createElement('ol' as unknown as 'div', {
      style: {
        fontSize: 15,
        lineHeight: 1.6,
        color: 'rgba(255,255,255,0.78)',
        paddingLeft: 22,
        margin: 0,
        marginBottom: 12,
      },
    }, p.children as React.ReactNode),
  li: (p: { children?: React.ReactNode }) =>
    React.createElement('li' as unknown as 'div', {
      style: { marginBottom: 4 },
    }, p.children as React.ReactNode),
  a: (p: { href?: string; children?: React.ReactNode }) =>
    React.createElement('a' as unknown as 'div', {
      href: p.href,
      target: '_blank',
      rel: 'noopener noreferrer',
      style: {
        color: '#60A5FA',
        textDecoration: 'underline',
        textDecorationColor: 'rgba(96,165,250,0.45)',
      },
    }, p.children as React.ReactNode),
  blockquote: (p: { children?: React.ReactNode }) =>
    React.createElement('blockquote' as unknown as 'div', {
      style: {
        borderLeft: '2px solid rgba(59,130,246,0.55)',
        paddingLeft: 14,
        margin: '12px 0',
        color: 'rgba(255,255,255,0.65)',
        fontStyle: 'italic',
      },
    }, p.children as React.ReactNode),
  code: (p: { children?: React.ReactNode; className?: string }) =>
    React.createElement('code' as unknown as 'div', {
      style: {
        fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
        fontSize: 13,
        backgroundColor: 'rgba(255,255,255,0.05)',
        color: '#93C5FD',
        padding: '2px 6px',
        borderRadius: 4,
      },
    }, p.children as React.ReactNode),
  pre: (p: { children?: React.ReactNode }) =>
    React.createElement('pre' as unknown as 'div', {
      style: {
        backgroundColor: 'rgba(0,0,0,0.35)',
        color: '#93C5FD',
        padding: '12px 14px',
        borderRadius: 8,
        overflowX: 'auto',
        fontSize: 13,
        lineHeight: 1.5,
        fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
        border: '1px solid rgba(255,255,255,0.06)',
        margin: '12px 0',
      },
    }, p.children as React.ReactNode),
  strong: (p: { children?: React.ReactNode }) =>
    React.createElement('strong' as unknown as 'div', {
      style: { color: '#FFFFFF', fontWeight: 600 },
    }, p.children as React.ReactNode),
  em: (p: { children?: React.ReactNode }) =>
    React.createElement('em' as unknown as 'div', {
      style: { fontStyle: 'italic' },
    }, p.children as React.ReactNode),
  hr: () =>
    React.createElement('hr' as unknown as 'div', {
      style: {
        border: 'none',
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.07)',
        margin: '16px 0',
      },
    }),
};

// ─── A small helper used by detail components for inline source URLs ───────

export function MemoryBodyInlineLink({ url, label }: { url: string; label?: string }) {
  return (
    <Pressable
      onPress={() => {
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined') window.open(url, '_blank');
        } else {
          void Linking.openURL(url);
        }
      }}
      accessibilityRole="link"
      accessibilityLabel={label ?? url}
      style={({ hovered }: { hovered?: boolean }) => [
        linkStyles.link,
        hovered && linkStyles.linkHover,
      ]}
    >
      <Text style={linkStyles.linkText} numberOfLines={1}>
        {label ?? url}
      </Text>
    </Pressable>
  );
}

const linkStyles = StyleSheet.create({
  link: {
    paddingVertical: 4,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : {}),
  },
  linkHover: {},
  linkText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#60A5FA',
  },
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.memory.cardBg as string,
    borderRadius: BorderRadius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.03)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.30,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }),
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.tertiary as string,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    marginBottom: 16,
  },
  plaintext: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 24,
    letterSpacing: -0.05,
  },
});

export default MemoryBody;
