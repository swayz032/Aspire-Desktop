/**
 * MemoryDetailHeader — top bar of the memory detail page.
 *
 * Layout (per plan §8.2 + mockup):
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ ← Back to Memory Results                                    │
 *   │                                                              │
 *   │ Title (28/700, letter-spacing -0.5)        [entity chip]    │
 *   │ Apr 18, 2026 at 10:35 AM · 45 min          [project chip]   │
 *   │                                                       [⋯]   │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Editorial detail per §12.1:
 *   - "Back" link is text-only with hover→white (the muted state reads as
 *     "secondary navigation" not "primary button")
 *   - Datetime line uses bullet separator (`·`) for elegance, not pipes/commas
 *   - Entity + project sit in a tiny floating pill stack on the right —
 *     they're "metadata at a glance," visually distinct from the title
 *   - Actions menu is a single ellipsis tap-target, NOT a row of buttons —
 *     keeps the header clean. Menu reveals on press.
 */

import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing } from '@/constants/tokens';
import type { MemoryDetail } from './types';
import { injectMemoryKeyframes } from './cardAnimations';

injectMemoryKeyframes();

export type MemoryDetailAction = 'share' | 'edit' | 'pin' | 'delete';

export interface MemoryDetailHeaderProps {
  memory: MemoryDetail;
  onBack: () => void;
  onAction: (action: MemoryDetailAction) => void;
}

// ─── Datetime helper ─────────────────────────────────────────────────────────

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${hours}:${minutes} ${ampm}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MemoryDetailHeader({
  memory,
  onBack,
  onAction,
}: MemoryDetailHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleAction = (action: MemoryDetailAction) => {
    setMenuOpen(false);
    onAction(action);
  };

  return (
    <View style={styles.container}>
      {/* Back link — top, full row */}
      <Pressable
        onPress={onBack}
        accessibilityRole="link"
        accessibilityLabel="Back to memory results"
        style={({ pressed }) => [
          styles.backLink,
          pressed && styles.backLinkPressed,
        ]}
        {...(Platform.OS === 'web' ? ({ className: 'aspire-memory-link' } as any) : {})}
      >
        <Ionicons name="chevron-back" size={16} color={Colors.text.secondary} />
        <Text style={styles.backText}>Back to Memory Results</Text>
      </Pressable>

      {/* Main row — title + meta on the left, entity chip + actions on the right */}
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
            {memory.title}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {formatDateTime(memory.date)}
            </Text>
            {memory.duration && (
              <>
                <Text style={styles.metaSeparator}>·</Text>
                <Text style={styles.metaText}>{memory.duration}</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.right}>
          {/* Entity + project floating chip (vertical stack) */}
          {(memory.entity || memory.project) && (
            <View style={styles.entityChip}>
              {memory.entity && (
                <View style={styles.entityRow}>
                  <Ionicons name="business-outline" size={12} color={Colors.text.tertiary} />
                  <Text style={styles.entityText}>{memory.entity.name}</Text>
                </View>
              )}
              {memory.project && (
                <View style={styles.entityRow}>
                  <Ionicons name="folder-outline" size={12} color={Colors.text.tertiary} />
                  <Text style={styles.entityText}>{memory.project.name}</Text>
                </View>
              )}
            </View>
          )}

          {/* Actions menu — ellipsis trigger + dropdown */}
          <View style={styles.actionsWrap}>
            <Pressable
              onPress={() => setMenuOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="Memory actions"
              accessibilityState={{ expanded: menuOpen }}
              hitSlop={8}
              style={({ pressed }) => [
                styles.actionsTrigger,
                menuOpen && styles.actionsTriggerOpen,
                pressed && styles.actionsTriggerPressed,
              ]}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={Colors.text.secondary} />
            </Pressable>

            {menuOpen && (
              <View style={styles.menu}>
                <ActionItem
                  icon="share-outline"
                  label="Share"
                  onPress={() => handleAction('share')}
                />
                <ActionItem
                  icon="create-outline"
                  label="Edit"
                  onPress={() => handleAction('edit')}
                />
                <ActionItem
                  icon="pin-outline"
                  label="Pin"
                  onPress={() => handleAction('pin')}
                />
                <View style={styles.menuDivider} />
                <ActionItem
                  icon="trash-outline"
                  label="Delete"
                  onPress={() => handleAction('delete')}
                  destructive
                />
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Sub-component: ActionItem ───────────────────────────────────────────────

function ActionItem({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      style={({ pressed, hovered }: any) => [
        styles.menuItem,
        hovered && styles.menuItemHover,
        pressed && styles.menuItemPressed,
      ]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={destructive ? Colors.semantic.error : Colors.text.secondary}
      />
      <Text
        style={[
          styles.menuItemText,
          destructive && { color: Colors.semantic.error },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.memory.detailDivider,
    marginBottom: Spacing.xxxl,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingRight: Spacing.sm,
    marginBottom: 4,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer' } as unknown as ViewStyle)
      : {}),
  },
  backLinkPressed: {
    opacity: 0.6,
  },
  backText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.xxl,
  },
  left: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.5,
    lineHeight: 34,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 6,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.text.tertiary,
  },
  metaSeparator: {
    fontSize: 14,
    color: Colors.text.muted,
    marginHorizontal: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  entityChip: {
    backgroundColor: Colors.memory.cardBg,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 4,
    minWidth: 140,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 1px 2px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.03)' } as unknown as ViewStyle)
      : {}),
  },
  entityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  entityText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  actionsWrap: {
    position: 'relative',
    zIndex: 10,
  },
  actionsTrigger: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  actionsTriggerOpen: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  actionsTriggerPressed: {
    transform: [{ scale: 0.95 }],
  },
  menu: {
    position: 'absolute',
    top: 44,
    right: 0,
    minWidth: 180,
    backgroundColor: '#141417',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 6,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)' } as unknown as ViewStyle)
      : { shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 16, shadowOffset: { width: 0, height: 16 }, elevation: 12 }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  menuItemHover: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  menuItemPressed: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 4,
    marginHorizontal: 8,
  },
});

export default MemoryDetailHeader;
