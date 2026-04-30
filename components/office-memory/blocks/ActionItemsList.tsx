/**
 * ActionItemsList — checkbox + label + assignee chip + due date.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ ☐  Send revised contract to Acme  [Tonio]  Apr 22         │
 *   │ ☑  Confirm permit timeline         [Sarah]  Apr 20         │  <- struck-through
 *   │ ☐  Update budget spreadsheet       [Maya]   Apr 25         │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Editorial details per §12.1:
 *   - Checkbox: hollow ring → green-filled with check on completion (no
 *     scrolling animation in V1; just the swap).
 *   - Completed rows fade label to 0.55 opacity + strike-through.
 *   - Assignee chip uses MemoryDetailsCard tag-pill aesthetic for visual
 *     consistency (40-foot view across cards).
 *   - Due-date overdue (in the past, not completed) → amber with calendar-clock.
 */

import React, { useMemo } from 'react';
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

export interface ActionItem {
  id: string;
  label: string;
  assignee?: string;
  /** ISO date (YYYY-MM-DD or full ISO timestamp) */
  dueDate?: string;
  completed: boolean;
}

export interface ActionItemsListProps {
  items: ActionItem[];
  /** Eyebrow override (default: "Action Items"). */
  eyebrow?: string;
  /** Toggle handler — Yellow-tier in production. V1 calls back optimistically. */
  onToggle?: (id: string, completed: boolean) => void;
}

// ─── Date helpers ───────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
function isOverdue(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  // overdue if the due date is strictly before today (ignore time component)
  d.setHours(23, 59, 59, 999);
  return d.getTime() < now.getTime();
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ActionItemsList({
  items,
  eyebrow = 'Action Items',
  onToggle,
}: ActionItemsListProps) {
  const completedCount = useMemo(() => items.filter((i) => i.completed).length, [items]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.progress}>
          {completedCount} / {items.length} done
        </Text>
      </View>

      {items.length === 0 ? (
        <Text style={styles.empty}>No action items captured.</Text>
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <ActionRow key={item.id} item={item} onToggle={onToggle} />
          ))}
        </View>
      )}
    </View>
  );
}

function ActionRow({
  item,
  onToggle,
}: {
  item: ActionItem;
  onToggle?: (id: string, completed: boolean) => void;
}) {
  const overdue = !item.completed && isOverdue(item.dueDate);

  return (
    <Pressable
      onPress={() => onToggle?.(item.id, !item.completed)}
      accessibilityRole="checkbox"
      accessibilityLabel={item.label}
      accessibilityState={{ checked: item.completed }}
      style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [
        styles.row,
        hovered && styles.rowHover,
        pressed && styles.rowPressed,
      ]}
    >
      <View
        style={[styles.checkbox, item.completed && styles.checkboxChecked]}
        accessibilityElementsHidden
      >
        {item.completed && <Ionicons name="checkmark" size={13} color={'#FFFFFF'} />}
      </View>

      <Text
        style={[
          styles.label,
          item.completed && styles.labelDone,
        ]}
        numberOfLines={2}
      >
        {item.label}
      </Text>

      {item.assignee && (
        <View style={styles.assigneeChip}>
          <View style={styles.assigneeDot} />
          <Text style={styles.assigneeText} numberOfLines={1}>
            {item.assignee}
          </Text>
        </View>
      )}

      {item.dueDate && (
        <View style={[styles.dueChip, overdue && styles.dueChipOverdue]}>
          <Ionicons
            name={overdue ? 'time' : 'calendar-outline'}
            size={11}
            color={overdue ? '#FBBF24' : (Colors.text.tertiary as string)}
          />
          <Text style={[styles.dueText, overdue && styles.dueTextOverdue]}>
            {fmtDue(item.dueDate)}
          </Text>
        </View>
      )}
    </Pressable>
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
  progress: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted as string,
    fontVariant: ['tabular-nums'],
  },
  list: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 8,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'background-color 140ms ease-out',
        } as unknown as ViewStyle)
      : {}),
  },
  rowHover: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  rowPressed: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: Colors.semantic.success as string,
    borderColor: Colors.semantic.success as string,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 0 3px rgba(52,199,89,0.18)' } as unknown as ViewStyle)
      : {}),
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary as string,
    lineHeight: 20,
    letterSpacing: -0.05,
  },
  labelDone: {
    color: Colors.text.muted as string,
    textDecorationLine: 'line-through',
  },
  assigneeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.20)',
    maxWidth: 140,
  },
  assigneeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#60A5FA',
  },
  assigneeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#93C5FD',
    letterSpacing: 0.1,
  },
  dueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    minWidth: 70,
    justifyContent: 'center',
  },
  dueChipOverdue: {
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderColor: 'rgba(245,158,11,0.30)',
  },
  dueText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.tertiary as string,
    fontVariant: ['tabular-nums'],
  },
  dueTextOverdue: {
    color: '#FBBF24',
    fontWeight: '600',
  },
  empty: {
    fontSize: 14,
    color: Colors.text.tertiary as string,
    fontStyle: 'italic',
  },
});

export default ActionItemsList;
