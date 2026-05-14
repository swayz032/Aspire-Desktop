/**
 * ContactRow — Contacts tab row with inline expand-to-edit.
 *
 * Reuses Badge (components/ui/Badge.tsx) for status pills. Inline edit form
 * uses native TextInput — matches the pattern in `app/founder-hub/notes.tsx`
 * for consistency.
 */

import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '@/components/ui/Badge';
import { Colors, Spacing, Typography } from '@/constants/tokens';
import { formatPhoneNumber, formatRelativeTime } from '@/lib/formatters';
import type { ContactPatch, FrontdeskContact } from '@/types/calls-messages';

interface Props {
  contact: FrontdeskContact;
  onCallBack: (contact: FrontdeskContact) => void;
  onSave: (contactId: string, patch: ContactPatch) => void;
}

export function ContactRow({
  contact,
  onCallBack,
  onSave,
}: Props): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(contact.display_name);
  const [company, setCompany] = useState(contact.company ?? '');
  const [notes, setNotes] = useState(contact.notes ?? '');
  const [tags, setTags] = useState((contact.tags ?? []).join(', '));

  const showStatusBadge =
    contact.status === 'unconfirmed' || contact.status === 'blocked';

  const save = () => {
    onSave(contact.contact_id, {
      display_name: name.trim() || contact.display_name,
      company: company.trim() || null,
      notes: notes.trim() || null,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setExpanded(false);
  };

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Contact ${contact.display_name}, ${expanded ? 'collapse' : 'expand'}`}
        onPress={() => setExpanded((v) => !v)}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <View style={styles.identityCol}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {contact.display_name}
            </Text>
            {showStatusBadge && (
              <Badge
                label={contact.status === 'unconfirmed' ? 'Unconfirmed' : 'Blocked'}
                variant={contact.status === 'blocked' ? 'error' : 'warning'}
                size="sm"
              />
            )}
          </View>
          {contact.company && (
            <Text style={styles.company} numberOfLines={1}>
              {contact.company}
            </Text>
          )}
        </View>

        <View style={styles.phoneCol}>
          <Text style={styles.phone}>{formatPhoneNumber(contact.phone_e164)}</Text>
        </View>

        <View style={styles.statsCol}>
          <Text style={styles.calls}>
            {contact.total_calls} call{contact.total_calls === 1 ? '' : 's'}
          </Text>
          {contact.last_seen_at && (
            <Text style={styles.lastSeen}>
              {formatRelativeTime(contact.last_seen_at)}
            </Text>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Call ${contact.display_name}`}
          onPress={(e) => {
            // Prevent the row press from firing when tapping the call button.
            e.stopPropagation();
            onCallBack(contact);
          }}
          style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
        >
          <Ionicons name="call" size={16} color={Colors.text.primary} />
        </Pressable>

        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.text.muted}
          style={styles.chevron}
        />
      </Pressable>

      {expanded && (
        <View style={styles.editor}>
          <View style={styles.editGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholder="Display name"
              placeholderTextColor={Colors.text.muted}
            />
          </View>

          <View style={styles.editGroup}>
            <Text style={styles.label}>Company</Text>
            <TextInput
              value={company}
              onChangeText={setCompany}
              style={styles.input}
              placeholder="Company"
              placeholderTextColor={Colors.text.muted}
            />
          </View>

          <View style={styles.editGroup}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              style={[styles.input, styles.textarea]}
              placeholder="Internal notes — only your team sees these."
              placeholderTextColor={Colors.text.muted}
              multiline
            />
          </View>

          <View style={styles.editGroup}>
            <Text style={styles.label}>Tags</Text>
            <TextInput
              value={tags}
              onChangeText={setTags}
              style={styles.input}
              placeholder="Comma-separated, e.g. repeat, commercial"
              placeholderTextColor={Colors.text.muted}
            />
          </View>

          {contact.last_call_summary && (
            <View style={styles.lastCallBlock}>
              <Text style={styles.lastCallLabel}>Last call</Text>
              <Text style={styles.lastCallText}>{contact.last_call_summary}</Text>
            </View>
          )}

          <View style={styles.editorActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel edits"
              onPress={() => setExpanded(false)}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save contact"
              onPress={save}
              style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
            >
              <Text style={styles.saveText}>Save changes</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    minHeight: 56,
  },
  rowPressed: {
    backgroundColor: Colors.surface.cardHover,
  },
  identityCol: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    color: Colors.text.primary,
    fontSize: Typography.captionMedium.fontSize,
    fontWeight: '600',
    flexShrink: 1,
  },
  company: {
    color: Colors.text.muted,
    fontSize: 12,
    marginTop: 2,
  },
  phoneCol: {
    width: 160,
  },
  phone: {
    color: Colors.text.secondary,
    fontSize: Typography.caption.fontSize,
    fontVariant: ['tabular-nums'],
  },
  statsCol: {
    width: 96,
    alignItems: 'flex-end',
  },
  calls: {
    color: Colors.text.secondary,
    fontSize: Typography.caption.fontSize,
  },
  lastSeen: {
    color: Colors.text.muted,
    fontSize: 12,
    marginTop: 2,
  },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    marginLeft: Spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
  editor: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
    backgroundColor: Colors.background.secondary,
  },
  editGroup: {
    gap: Spacing.xs,
  },
  label: {
    color: Colors.text.muted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: Colors.surface.input,
    borderWidth: 1,
    borderColor: Colors.surface.inputBorder,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text.primary,
    fontSize: Typography.caption.fontSize,
    minHeight: 44,
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  lastCallBlock: {
    padding: Spacing.md,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    gap: 4,
  },
  lastCallLabel: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  lastCallText: {
    color: Colors.text.secondary,
    fontSize: Typography.caption.fontSize,
    lineHeight: 20,
  },
  editorActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.default,
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelText: {
    color: Colors.text.secondary,
    fontSize: Typography.captionMedium.fontSize,
    fontWeight: '500',
  },
  saveBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.text.primary,
    minHeight: 44,
    justifyContent: 'center',
  },
  saveText: {
    color: '#0a0a0a',
    fontSize: Typography.captionMedium.fontSize,
    fontWeight: '600',
  },
});
