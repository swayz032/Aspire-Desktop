/**
 * MemoryDetailTask — center column for `task` and `followup_task` types.
 *
 * Layout (per plan §15.B):
 *   - Status pill + due date + assignee (top hero strip)
 *   - Description body
 *   - Linked memory back-ref
 *   - Subtasks list (uses ActionItemsList)
 */

import React, { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import type { MemoryDetail } from '../types';
import { MemorySummaryCard } from '../MemorySummaryCard';
import { MemoryBody } from './MemoryBody';
import { ActionItemsList, type ActionItem } from '../blocks/ActionItemsList';

export interface MemoryDetailTaskProps {
  memory: MemoryDetail;
  onLinkedMemoryPress?: (id: string) => void;
}

function statusTone(label: string): { bg: string; fg: string; ring: string } {
  const l = label.toLowerCase();
  if (l.includes('done') || l.includes('complete'))
    return { bg: 'rgba(52,199,89,0.14)', fg: '#34D399', ring: 'rgba(52,199,89,0.28)' };
  if (l.includes('block') || l.includes('fail') || l.includes('error'))
    return { bg: 'rgba(255,59,48,0.14)', fg: '#FB7185', ring: 'rgba(244,63,94,0.28)' };
  if (l.includes('progress') || l.includes('active'))
    return { bg: 'rgba(59,130,246,0.14)', fg: '#60A5FA', ring: 'rgba(59,130,246,0.28)' };
  return { bg: 'rgba(245,158,11,0.14)', fg: '#FBBF24', ring: 'rgba(245,158,11,0.28)' };
}

export function MemoryDetailTask({ memory, onLinkedMemoryPress }: MemoryDetailTaskProps) {
  const task = memory.task;
  const tone = task ? statusTone(task.statusLabel) : statusTone('open');

  // Local subtask state — V1 in-memory toggle. Backend wiring is Pass 17.
  const [subtasks, setSubtasks] = useState<ActionItem[]>(task?.subtasks ?? []);
  const handleToggle = useCallback((id: string, completed: boolean) => {
    setSubtasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed } : t)));
  }, []);

  return (
    <View style={styles.column}>
      {task && (
        <View style={styles.heroCard}>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: tone.bg, borderColor: tone.ring },
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: tone.fg }]} />
            <Text style={[styles.statusText, { color: tone.fg }]}>{task.statusLabel}</Text>
          </View>

          <View style={styles.heroMetaRow}>
            {task.dueDate && (
              <View style={styles.heroMeta}>
                <Ionicons name="calendar-outline" size={14} color={Colors.text.tertiary as string} />
                <Text style={styles.heroMetaText}>Due {task.dueDate}</Text>
              </View>
            )}
            {task.assignee && (
              <View style={styles.heroMeta}>
                <Ionicons name="person-circle-outline" size={14} color={Colors.text.tertiary as string} />
                <Text style={styles.heroMetaText}>{task.assignee}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      <MemorySummaryCard summary={memory.summary} eyebrow="Task Summary" />

      {task?.description && (
        <MemoryBody content={task.description} format="markdown" eyebrow="Description" />
      )}

      {task?.parentMemoryId && (
        <Pressable
          onPress={() => onLinkedMemoryPress?.(task.parentMemoryId as string)}
          accessibilityRole="link"
          accessibilityLabel="Open linked memory"
          style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [
            styles.linkedRow,
            hovered && styles.linkedRowHover,
            pressed && styles.linkedRowPressed,
          ]}
        >
          <View style={styles.linkedIcon}>
            <Ionicons name="link" size={14} color={'#60A5FA'} />
          </View>
          <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
            <Text style={styles.linkedEyebrow}>Linked Memory</Text>
            <Text style={styles.linkedTitle} numberOfLines={1}>
              {task.parentMemoryId}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={Colors.text.tertiary as string} />
        </Pressable>
      )}

      {subtasks.length > 0 && (
        <ActionItemsList
          items={subtasks}
          onToggle={handleToggle}
          eyebrow="Subtasks"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 16 },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
    padding: 20,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.memory.cardBg as string,
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
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMetaText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary as string,
  },
  linkedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.memory.cardBg as string,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.20)',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'border-color 140ms ease-out, background-color 140ms ease-out',
        } as unknown as ViewStyle)
      : {}),
  },
  linkedRowHover: {
    backgroundColor: 'rgba(59,130,246,0.04)',
    borderColor: 'rgba(59,130,246,0.40)',
  },
  linkedRowPressed: {
    transform: [{ scale: 0.99 }],
  },
  linkedIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.28)',
  },
  linkedEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.muted as string,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  linkedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary as string,
    letterSpacing: -0.05,
  },
});

export default MemoryDetailTask;
