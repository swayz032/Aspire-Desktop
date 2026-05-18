/**
 * ServiceMemoryDetailRightRail — sticky right-side card stack on the service
 * memory detail page.
 *
 * Mirror of `MemoryDetailRightRail` (Office Memory) with service-hub flavored
 * type-list memberships. Card styling, padding, typography, and behavior are
 * IDENTICAL to the office rail — only the type membership sets change so the
 * right rail surfaces facts most relevant to service work (jobs, supplier
 * decisions, handoff notes, timeline events).
 *
 *   Always:      Details, Tags, Attachments & Activity (when files present).
 *   Conditional:
 *     - Participants     → meeting / call / session_summary / sms_thread / transcript
 *     - Linked Receipts  → invoice / quote / contract / session_summary
 *     - Linked Memories  → strategy / research / summary / thread_summary /
 *                          office_brief / finance_brief / decision_fact /
 *                          handoff_note / timeline_event
 *
 * The expanded LINKED_MEMORY_TYPES vs. the office rail reflects that service
 * memories often surface alongside service-hub coordination spine objects
 * (decision_fact for material picks, handoff_note for job transfers,
 * timeline_event for property history).
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import type {
  MemoryDetail,
  MemoryType,
} from '@/components/office-memory/types';
import { MemoryDetailsCard } from '@/components/office-memory/MemoryDetailsCard';
import { MemoryActivityReceiptsRow } from '@/components/office-memory/MemoryActivityReceiptsRow';

const PARTICIPANT_TYPES: MemoryType[] = [
  'meeting',
  'call',
  'session_summary',
  'sms_thread',
  'transcript',
];
const RECEIPT_TYPES: MemoryType[] = ['invoice', 'quote', 'contract', 'session_summary'];
const LINKED_MEMORY_TYPES: MemoryType[] = [
  'strategy',
  'research',
  'summary',
  'thread_summary',
  'office_brief',
  'finance_brief',
  // Service-hub additions — these coordination-spine memories surface in
  // job/property/supplier threads and benefit from cross-reference cards.
  'decision_fact',
  'handoff_note',
  'timeline_event',
];

export interface ServiceMemoryDetailRightRailProps {
  memory: MemoryDetail;
  onFilePress?: (fileId: string) => void;
  onLinkedMemoryPress?: (id: string) => void;
  onReceiptPress?: (id: string) => void;
}

export function ServiceMemoryDetailRightRail({
  memory,
  onFilePress,
  onLinkedMemoryPress,
  onReceiptPress,
}: ServiceMemoryDetailRightRailProps) {
  const showParticipants =
    PARTICIPANT_TYPES.includes(memory.type) && memory.participants.length > 0;
  const showReceipts =
    RECEIPT_TYPES.includes(memory.type) && (memory.linkedReceipts?.length ?? 0) > 0;
  const showLinkedMemories =
    LINKED_MEMORY_TYPES.includes(memory.type) && (memory.linkedMemories?.length ?? 0) > 0;

  return (
    <View style={styles.rail} accessibilityLabel="Service memory metadata">
      {showParticipants && <ParticipantsCard participants={memory.participants} />}

      <MemoryDetailsCard
        details={{
          participants: memory.participants,
          location: memory.location,
          createdBy: memory.createdBy,
          tags: memory.tags,
        }}
      />

      {showReceipts && (
        <LinkedListCard
          eyebrow="Linked Receipts"
          icon="receipt-outline"
          tint="#5EEAD4"
          items={(memory.linkedReceipts ?? []).map((r) => ({
            id: r.id,
            label: r.label,
            sub: r.href ? 'Receipt' : undefined,
          }))}
          onItemPress={(id) => onReceiptPress?.(id)}
          emptyMessage="No receipts linked yet."
        />
      )}

      {showLinkedMemories && (
        <LinkedListCard
          eyebrow="Linked Memories"
          icon="layers-outline"
          tint="#C084FC"
          items={(memory.linkedMemories ?? []).map((m) => ({
            id: m.id,
            label: m.title,
            sub: humanizeType(m.type),
          }))}
          onItemPress={(id) => onLinkedMemoryPress?.(id)}
          emptyMessage="No referenced memories."
        />
      )}

      {memory.activityFiles.length > 0 && (
        <MemoryActivityReceiptsRow
          files={memory.activityFiles}
          onFilePress={(f) => onFilePress?.(f.id)}
          eyebrow="Attachments"
        />
      )}
    </View>
  );
}

// ─── ParticipantsCard ───────────────────────────────────────────────────────

function ParticipantsCard({ participants }: { participants: string[] }) {
  return (
    <View style={cardStyles.card}>
      <Text style={cardStyles.eyebrow}>Participants</Text>
      <View style={cardStyles.list}>
        {participants.map((p, i) => {
          const initials = p
            .split(/\s+/)
            .map((s) => s[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase();
          return (
            <View key={`${p}-${i}`} style={cardStyles.row}>
              <View style={cardStyles.avatar}>
                <Text style={cardStyles.avatarText}>{initials || '·'}</Text>
              </View>
              <Text style={cardStyles.rowLabel} numberOfLines={1}>
                {p}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── LinkedListCard (receipts / memories) ───────────────────────────────────

interface LinkedListItem {
  id: string;
  label: string;
  sub?: string;
}

function LinkedListCard({
  eyebrow,
  icon,
  tint,
  items,
  onItemPress,
  emptyMessage,
}: {
  eyebrow: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  items: LinkedListItem[];
  onItemPress?: (id: string) => void;
  emptyMessage: string;
}) {
  return (
    <View style={cardStyles.card}>
      <Text style={cardStyles.eyebrow}>{eyebrow}</Text>
      {items.length === 0 ? (
        <Text style={cardStyles.empty}>{emptyMessage}</Text>
      ) : (
        <View style={cardStyles.list}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onItemPress?.(item.id)}
              accessibilityRole="link"
              accessibilityLabel={item.label}
              style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [
                cardStyles.linkRow,
                hovered && cardStyles.linkRowHover,
                pressed && cardStyles.linkRowPressed,
              ]}
            >
              <View
                style={[
                  cardStyles.linkIcon,
                  { backgroundColor: hexA(tint, 0.1), borderColor: hexA(tint, 0.24) },
                ]}
              >
                <Ionicons name={icon} size={14} color={tint} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={cardStyles.linkLabel} numberOfLines={1}>
                  {item.label}
                </Text>
                {item.sub && <Text style={cardStyles.linkSub}>{item.sub}</Text>}
              </View>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={Colors.text.tertiary as string}
              />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function humanizeType(t: MemoryType): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  rail: {
    gap: 16,
    width: '100%',
    ...(Platform.OS === 'web'
      ? ({
          position: 'sticky',
          top: 96,
        } as unknown as ViewStyle)
      : {}),
  },
});

const cardStyles = StyleSheet.create({
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
          shadowOpacity: 0.3,
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
    marginBottom: 14,
  },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#93C5FD',
    letterSpacing: 0.4,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary as string,
    letterSpacing: -0.05,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginHorizontal: -10,
    borderRadius: 8,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'background-color 140ms ease-out',
        } as unknown as ViewStyle)
      : {}),
  },
  linkRowHover: { backgroundColor: 'rgba(255,255,255,0.03)' },
  linkRowPressed: { backgroundColor: 'rgba(255,255,255,0.05)' },
  linkIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  linkLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary as string,
    letterSpacing: -0.05,
  },
  linkSub: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.tertiary as string,
    marginTop: 1,
  },
  empty: {
    fontSize: 13,
    color: Colors.text.tertiary as string,
    fontStyle: 'italic',
  },
});

export default ServiceMemoryDetailRightRail;
