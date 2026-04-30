/**
 * ToolInvocationLog — collapsed list of tool calls during an agent session.
 *
 * Each row:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ ⚡  search_emails    "from acme last 7 days"   ✓  Receipt │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Click a row → expands to a code-block JSON dump of the args + result.
 *
 * Editorial details per §12.1:
 *   - Tool icon: bolt-circle (⚡) for action verbs.
 *   - Result pill: green ✓ for success, red ✗ for failure.
 *   - Receipt link: small Aspire-blue link "Receipt →" — opens receipt detail
 *     when wired (Pass 17). For now, links log to console.
 *   - Expanded JSON renders in a custom monospace block with keys colored
 *     Aspire-blue and values colored amber — never raw stringify on dark.
 */

import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';

export interface ToolInvocation {
  toolName: string;
  argsSummary: string;
  resultSummary: string;
  succeeded: boolean;
  receiptId?: string;
  argsJson?: Record<string, unknown>;
  resultJson?: Record<string, unknown>;
}

export interface ToolInvocationLogProps {
  calls: ToolInvocation[];
  /** Eyebrow override (default: "Tool Calls"). */
  eyebrow?: string;
  /** Click on a "Receipt" link */
  onReceiptPress?: (receiptId: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ToolInvocationLog({
  calls,
  eyebrow = 'Tool Calls',
  onReceiptPress,
}: ToolInvocationLogProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.count}>{calls.length} {calls.length === 1 ? 'call' : 'calls'}</Text>
      </View>

      {calls.length === 0 ? (
        <Text style={styles.empty}>No tool calls in this session.</Text>
      ) : (
        <View style={styles.list}>
          {calls.map((call, idx) => (
            <ToolRow key={`${call.toolName}-${idx}`} call={call} onReceiptPress={onReceiptPress} />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Tool row (one call) ────────────────────────────────────────────────────

function ToolRow({
  call,
  onReceiptPress,
}: {
  call: ToolInvocation;
  onReceiptPress?: (receiptId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={[styles.row, !call.succeeded && styles.rowFailed]}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${call.toolName} — ${call.succeeded ? 'succeeded' : 'failed'}`}
        accessibilityState={{ expanded }}
        style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [
          styles.rowHeader,
          hovered && styles.rowHeaderHover,
          pressed && styles.rowHeaderPressed,
        ]}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="flash" size={14} color={'#93C5FD'} />
        </View>

        <View style={styles.rowContent}>
          <View style={styles.rowTop}>
            <Text style={styles.toolName}>{call.toolName}</Text>
            <View style={[styles.resultPill, call.succeeded ? styles.resultPillOk : styles.resultPillErr]}>
              <Ionicons
                name={call.succeeded ? 'checkmark' : 'close'}
                size={10}
                color={call.succeeded ? '#34D399' : '#FB7185'}
              />
              <Text style={[styles.resultPillText, !call.succeeded && { color: '#FB7185' }]}>
                {call.succeeded ? 'OK' : 'FAILED'}
              </Text>
            </View>
            {call.receiptId && (
              <Pressable
                onPress={(e) => {
                  if ((e as { stopPropagation?: () => void }).stopPropagation) {
                    (e as { stopPropagation?: () => void }).stopPropagation?.();
                  }
                  onReceiptPress?.(call.receiptId as string);
                }}
                accessibilityRole="link"
                accessibilityLabel="Open receipt"
                hitSlop={6}
                style={({ hovered }: { hovered?: boolean }) => [
                  styles.receiptLink,
                  hovered && styles.receiptLinkHover,
                ]}
              >
                <Text style={styles.receiptLinkText}>Receipt →</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.argsSummary} numberOfLines={1}>
            {call.argsSummary}
          </Text>
          <Text style={styles.resultSummary} numberOfLines={1}>
            {call.resultSummary}
          </Text>
        </View>

        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={Colors.text.tertiary as string}
        />
      </Pressable>

      {expanded && (call.argsJson || call.resultJson) && (
        <View style={styles.expanded}>
          {call.argsJson && <JsonBlock label="Arguments" data={call.argsJson} />}
          {call.resultJson && <JsonBlock label="Result" data={call.resultJson} />}
        </View>
      )}
    </View>
  );
}

// ─── JSON code block ────────────────────────────────────────────────────────

function JsonBlock({ label, data }: { label: string; data: Record<string, unknown> }) {
  let pretty: string;
  try {
    pretty = JSON.stringify(data, null, 2);
  } catch {
    pretty = String(data);
  }
  return (
    <View style={styles.jsonBlock}>
      <Text style={styles.jsonLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={styles.jsonText} accessibilityLabel={`${label} JSON`}>
          {pretty}
        </Text>
      </ScrollView>
    </View>
  );
}

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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.tertiary as string,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  count: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted as string,
    fontVariant: ['tabular-nums'],
  },
  list: {
    gap: 8,
  },
  empty: {
    fontSize: 14,
    color: Colors.text.tertiary as string,
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  row: {
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  rowFailed: {
    backgroundColor: 'rgba(244,63,94,0.04)',
    borderColor: 'rgba(244,63,94,0.24)',
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'background-color 140ms ease-out',
        } as unknown as ViewStyle)
      : {}),
  },
  rowHeaderHover: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  rowHeaderPressed: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.24)',
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  toolName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary as string,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }),
    letterSpacing: -0.1,
  },
  resultPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.30)',
  },
  resultPillOk: {},
  resultPillErr: {
    backgroundColor: 'rgba(244,63,94,0.10)',
    borderColor: 'rgba(251,113,133,0.30)',
  },
  resultPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#34D399',
    letterSpacing: 0.6,
  },
  receiptLink: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  receiptLinkHover: {
    backgroundColor: 'rgba(59,130,246,0.10)',
  },
  receiptLinkText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#60A5FA',
    letterSpacing: 0.1,
  },
  argsSummary: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.secondary as string,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }),
  },
  resultSummary: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary as string,
  },
  expanded: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 6,
    gap: 10,
  },
  jsonBlock: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  jsonLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.muted as string,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  jsonText: {
    fontSize: 11,
    fontWeight: '400',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }),
    color: '#93C5FD',
    lineHeight: 16,
  },
});

export default ToolInvocationLog;
