/**
 * RoutingContactsSection — Pass 10 Lane B (plan §10.3 Section 4)
 *
 * Numbered "4" — Routing Contacts. Table with 4 columns:
 *   Role | Destination (avatar + name + phone) | Fallback chip | Transfer
 *
 * Top-right "+ Add contact" ghost button opens an inline modal for
 * add/edit (name, phone, role, fallback, transfer permission). Each
 * row has a 3-dot overflow menu (Edit / Delete).
 *
 * Per §12.1: avatars use deterministic blue-tinted gradient backgrounds
 * (no random colors), table has subtle hairline dividers, modal uses
 * BlurView backdrop on web with spring entrance.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  Platform,
  ScrollView,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors, BorderRadius } from '@/constants/tokens';
import { SectionPanel } from './SectionPanel';
import type {
  RoutingContact,
  RoutingContactRole,
  RoutingFallbackMode,
} from './setup-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RoutingContactsSectionProps {
  contacts: RoutingContact[];
  onChange: (contacts: RoutingContact[]) => void;
  /** Optional zero-based index for staggered entrance */
  enterIndex?: number;
}

// ---------------------------------------------------------------------------
// Role + fallback metadata
// ---------------------------------------------------------------------------

const ROLE_OPTIONS: { value: RoutingContactRole; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'sales', label: 'Sales' },
  { value: 'support', label: 'Support' },
  { value: 'operations', label: 'Operations' },
  { value: 'custom', label: 'Custom' },
];

const FALLBACK_OPTIONS: { value: RoutingFallbackMode; label: string }[] = [
  { value: 'TRANSFER_ALLOWED', label: 'Transfer allowed' },
  { value: 'MESSAGE_FALLBACK', label: 'Message fallback' },
];

function roleLabel(role: RoutingContactRole, customLabel?: string): string {
  if (role === 'custom' && customLabel) return customLabel;
  const found = ROLE_OPTIONS.find((r) => r.value === role);
  return found ? found.label : role;
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatRoutingPhoneInput(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  const normalized = cleaned.startsWith('1') && cleaned.length > 10 ? cleaned.slice(1) : cleaned;
  if (normalized.length <= 3) return normalized;
  if (normalized.length <= 6) return `(${normalized.slice(0, 3)}) ${normalized.slice(3)}`;
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6, 10)}`;
}

// ---------------------------------------------------------------------------
// One-time CSS
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.id = 'fds-routing-contacts-css';
  style.textContent = `
    .fds-rc-add { transition: background-color 160ms ease-out, border-color 160ms ease-out, transform 160ms ease-out; }
    .fds-rc-add:hover { background-color: rgba(59,130,246,0.12); border-color: rgba(59,130,246,0.45); transform: translateY(-1px); }
    .fds-rc-add:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 3px; }
    .fds-rc-row { transition: background-color 160ms ease-out; }
    .fds-rc-row:hover { background-color: rgba(255,255,255,0.025); }
    .fds-rc-overflow { transition: background-color 140ms ease-out; }
    .fds-rc-overflow:hover { background-color: rgba(255,255,255,0.06); }
    .fds-rc-overflow:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 2px; }
    .fds-rc-input:focus, .fds-rc-input:focus-visible { outline: none; border-color: rgba(59,130,246,0.55); box-shadow: 0 0 0 3px rgba(59,130,246,0.18); }
    @keyframes fds-modal-pop {
      from { opacity: 0; transform: scale(0.96) translateY(8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    .fds-rc-modal { animation: fds-modal-pop 220ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RoutingContactsSection({ contacts, onChange, enterIndex }: RoutingContactsSectionProps) {
  injectCss();

  const [editing, setEditing] = useState<RoutingContact | null>(null);
  const [overflowOpenId, setOverflowOpenId] = useState<string | null>(null);

  const startAdd = () => {
    setEditing({
      id: 'new',
      role: 'owner',
      name: '',
      phone: '',
      fallbackMode: 'TRANSFER_ALLOWED',
      transferAllowed: true,
      priority: contacts.length,
    });
  };

  const startEdit = (c: RoutingContact) => {
    setOverflowOpenId(null);
    setEditing(c);
  };

  const persist = (saved: RoutingContact) => {
    if (saved.id === 'new') {
      const id = `rc-${Date.now()}`;
      onChange([...contacts, { ...saved, id, initials: deriveInitials(saved.name) }]);
    } else {
      onChange(
        contacts.map((c) =>
          c.id === saved.id ? { ...saved, initials: deriveInitials(saved.name) } : c,
        ),
      );
    }
    setEditing(null);
  };

  const remove = (id: string) => {
    setOverflowOpenId(null);
    onChange(contacts.filter((c) => c.id !== id));
  };

  return (
    <SectionPanel
      step={4}
      title="Routing Contacts"
      enterIndex={enterIndex}
      headerRight={
        <Pressable
          onPress={startAdd}
          accessibilityRole="button"
          accessibilityLabel="Add a new routing contact"
          style={styles.addBtn}
          {...(Platform.OS === 'web' ? ({ className: 'fds-rc-add' } as any) : {})}
        >
          <Ionicons name="add" size={14} color={Colors.accent.cyan} />
          <Text style={styles.addBtnText}>Add contact</Text>
        </Pressable>
      }
    >
      <View style={styles.tableWrap}>
        {/* Header */}
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
          <Text style={[styles.tableHeader, styles.colRole]}>Role</Text>
          <Text style={[styles.tableHeader, styles.colDest]}>Destination</Text>
          <Text style={[styles.tableHeader, styles.colFallback]}>Fallback</Text>
          <Text style={[styles.tableHeader, styles.colTransfer]}>Transfer</Text>
        </View>

        {contacts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={28} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>No routing contacts yet</Text>
            <Text style={styles.emptyBody}>
              Add the people Sarah should reach when forwarding calls.
            </Text>
          </View>
        ) : (
          contacts.map((c, idx) => (
            <View
              key={c.id}
              style={[
                styles.tableRow,
                styles.tableBodyRow,
                idx === contacts.length - 1 && styles.tableBodyRowLast,
              ]}
              {...(Platform.OS === 'web' ? ({ className: 'fds-rc-row' } as any) : {})}
            >
              {/* Role */}
              <View style={styles.colRole}>
                <Text style={styles.roleText}>{roleLabel(c.role, c.customRoleLabel)}</Text>
              </View>

              {/* Destination */}
              <View style={[styles.colDest, styles.destCell]}>
                <Avatar name={c.name} initials={c.initials} />
                <View style={styles.destBody}>
                  <Text style={styles.destName} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={styles.destPhone} numberOfLines={1}>
                    {c.phone}
                  </Text>
                </View>
              </View>

              {/* Fallback */}
              <View style={styles.colFallback}>
                <FallbackChip mode={c.fallbackMode} />
              </View>

              {/* Transfer */}
              <View style={[styles.colTransfer, styles.transferCell]}>
                <View style={styles.transferStatus}>
                  <Ionicons
                    name={c.transferAllowed ? 'checkmark-circle' : 'remove-circle-outline'}
                    size={14}
                    color={c.transferAllowed ? Colors.semantic.success : Colors.text.muted}
                  />
                  <Text
                    style={[
                      styles.transferText,
                      { color: c.transferAllowed ? Colors.text.primary : Colors.text.muted },
                    ]}
                  >
                    {c.transferAllowed ? 'Allowed' : 'Blocked'}
                  </Text>
                </View>

                <Pressable
                  onPress={() =>
                    setOverflowOpenId(overflowOpenId === c.id ? null : c.id)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`More actions for ${c.name}`}
                  style={styles.overflowBtn}
                  {...(Platform.OS === 'web' ? ({ className: 'fds-rc-overflow' } as any) : {})}
                >
                  <Ionicons name="ellipsis-horizontal" size={16} color={Colors.text.tertiary} />
                </Pressable>

                {overflowOpenId === c.id ? (
                  <View style={styles.overflowMenu}>
                    <Pressable
                      onPress={() => startEdit(c)}
                      style={({ pressed }) => [
                        styles.overflowItem,
                        pressed && styles.overflowItemPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Edit contact"
                    >
                      <Ionicons name="pencil-outline" size={14} color={Colors.text.secondary} />
                      <Text style={styles.overflowItemText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => remove(c.id)}
                      style={({ pressed }) => [
                        styles.overflowItem,
                        pressed && styles.overflowItemPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Delete contact"
                    >
                      <Ionicons name="trash-outline" size={14} color={Colors.semantic.error} />
                      <Text style={[styles.overflowItemText, { color: Colors.semantic.error }]}>
                        Delete
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </View>
          ))
        )}
      </View>

      {/* Add/Edit modal */}
      {editing ? (
        <ContactEditorModal
          contact={editing}
          onCancel={() => setEditing(null)}
          onSave={persist}
        />
      ) : null}
    </SectionPanel>
  );
}

// ---------------------------------------------------------------------------
// Avatar — deterministic blue-tinted initials circle
// ---------------------------------------------------------------------------

function Avatar({ name, initials }: { name: string; initials?: string }) {
  const text = initials || deriveInitials(name);
  return (
    <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={styles.avatarText}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Fallback chip
// ---------------------------------------------------------------------------

function FallbackChip({ mode }: { mode: RoutingFallbackMode }) {
  const palette =
    mode === 'TRANSFER_ALLOWED'
      ? { bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.30)', text: Colors.accent.cyan, icon: 'arrow-forward' as const }
      : { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)', text: Colors.text.tertiary, icon: 'mail-outline' as const };
  const label = FALLBACK_OPTIONS.find((f) => f.value === mode)?.label ?? mode;

  return (
    <View style={[styles.chip, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Ionicons name={palette.icon} size={11} color={palette.text} />
      <Text style={[styles.chipText, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ContactEditorModal — add/edit dialog
// ---------------------------------------------------------------------------

function ContactEditorModal({
  contact,
  onCancel,
  onSave,
}: {
  contact: RoutingContact;
  onCancel: () => void;
  onSave: (saved: RoutingContact) => void;
}) {
  const [name, setName] = useState(contact.name);
  const [phone, setPhone] = useState(contact.phone);
  const [role, setRole] = useState<RoutingContactRole>(contact.role);
  const [customRoleLabel, setCustomRoleLabel] = useState(contact.customRoleLabel ?? '');
  const [fallbackMode, setFallbackMode] = useState<RoutingFallbackMode>(contact.fallbackMode);
  const [transferAllowed, setTransferAllowed] = useState(contact.transferAllowed);

  // Escape key closes modal (web)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  const isValid = name.trim().length > 0 && phone.trim().length > 0;
  const isNew = contact.id === 'new';

  const submit = () => {
    if (!isValid) return;
    onSave({
      ...contact,
      name: name.trim(),
      phone: phone.trim(),
      role,
      customRoleLabel: role === 'custom' ? customRoleLabel.trim() : undefined,
      fallbackMode,
      transferAllowed,
    });
  };

  return (
    <Modal transparent animationType="none" onRequestClose={onCancel} visible>
      <View style={modalStyles.backdrop}>
        {Platform.OS === 'web' ? (
          <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill as ViewStyle} />
        ) : null}
        <Pressable
          style={StyleSheet.absoluteFill as ViewStyle}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Close contact editor"
        />

        <View
          style={modalStyles.modal}
          {...(Platform.OS === 'web' ? ({ className: 'fds-rc-modal' } as any) : {})}
        >
          <View style={modalStyles.header}>
            <Text style={modalStyles.title} accessibilityRole="header">
              {isNew ? 'Add contact' : 'Edit contact'}
            </Text>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Close dialog"
              style={modalStyles.closeBtn}
            >
              <Ionicons name="close" size={18} color={Colors.text.secondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={modalStyles.body} showsVerticalScrollIndicator={false}>
            <Field label="Name">
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Tonio Scott"
                placeholderTextColor={Colors.text.muted}
                style={modalStyles.input}
                accessibilityLabel="Contact name"
                {...(Platform.OS === 'web' ? ({ className: 'fds-rc-input' } as any) : {})}
              />
            </Field>

            <Field label="Phone">
              <TextInput
                value={phone}
                onChangeText={(value) => setPhone(formatRoutingPhoneInput(value))}
                placeholder="(404) 555-0182"
                placeholderTextColor={Colors.text.muted}
                style={modalStyles.input}
                keyboardType="phone-pad"
                accessibilityLabel="Contact phone number"
                {...(Platform.OS === 'web' ? ({ className: 'fds-rc-input' } as any) : {})}
              />
            </Field>

            <Field label="Role">
              <View style={modalStyles.chipRow}>
                {ROLE_OPTIONS.map((opt) => {
                  const selected = role === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setRole(opt.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={`Role: ${opt.label}`}
                      style={[modalStyles.choiceChip, selected && modalStyles.choiceChipSelected]}
                    >
                      <Text style={[modalStyles.choiceChipText, selected && modalStyles.choiceChipTextSelected]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {role === 'custom' ? (
                <TextInput
                  value={customRoleLabel}
                  onChangeText={setCustomRoleLabel}
                  placeholder="Custom role label"
                  placeholderTextColor={Colors.text.muted}
                  style={[modalStyles.input, { marginTop: 8 }]}
                  accessibilityLabel="Custom role label"
                  {...(Platform.OS === 'web' ? ({ className: 'fds-rc-input' } as any) : {})}
                />
              ) : null}
            </Field>

            <Field label="Fallback">
              <View style={modalStyles.chipRow}>
                {FALLBACK_OPTIONS.map((opt) => {
                  const selected = fallbackMode === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setFallbackMode(opt.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={`Fallback: ${opt.label}`}
                      style={[modalStyles.choiceChip, selected && modalStyles.choiceChipSelected]}
                    >
                      <Text style={[modalStyles.choiceChipText, selected && modalStyles.choiceChipTextSelected]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <Field label="Transfer permission">
              <Pressable
                onPress={() => setTransferAllowed(!transferAllowed)}
                accessibilityRole="switch"
                accessibilityState={{ checked: transferAllowed }}
                accessibilityLabel={`Transfer ${transferAllowed ? 'allowed' : 'blocked'}`}
                style={[modalStyles.toggleRow, transferAllowed && modalStyles.toggleRowOn]}
              >
                <View style={[modalStyles.toggleTrack, transferAllowed && modalStyles.toggleTrackOn]}>
                  <View
                    style={[
                      modalStyles.toggleThumb,
                      transferAllowed && modalStyles.toggleThumbOn,
                    ]}
                  />
                </View>
                <Text style={modalStyles.toggleLabel}>
                  {transferAllowed ? 'Calls may transfer to this contact' : 'Take a message instead'}
                </Text>
              </Pressable>
            </Field>
          </ScrollView>

          <View style={modalStyles.footer}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={({ pressed }) => [modalStyles.btnGhost, pressed && { opacity: 0.85 }]}
            >
              <Text style={modalStyles.btnGhostText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={!isValid}
              accessibilityRole="button"
              accessibilityLabel={isNew ? 'Add contact' : 'Save changes'}
              accessibilityState={{ disabled: !isValid }}
              style={({ pressed }) => [
                modalStyles.btnPrimary,
                !isValid && modalStyles.btnDisabled,
                pressed && isValid && { opacity: 0.92 },
              ]}
            >
              <Text style={modalStyles.btnPrimaryText}>{isNew ? 'Add contact' : 'Save changes'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={modalStyles.field}>
      <Text style={modalStyles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // ----- Add button ----------------------------------------------------
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.32)',
    backgroundColor: 'rgba(59,130,246,0.07)',
    minHeight: 36,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accent.cyan,
    letterSpacing: 0.2,
  },

  // ----- Table ---------------------------------------------------------
  tableWrap: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: BorderRadius.lg,
    backgroundColor: '#0d0d10',
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  tableHeaderRow: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  tableHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tableBodyRow: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    minHeight: 56,
  },
  tableBodyRowLast: {
    borderBottomWidth: 0,
  },

  // Column widths
  colRole: {
    width: 90,
    flexShrink: 0,
  },
  colDest: {
    flex: 1,
    minWidth: 200,
  },
  colFallback: {
    width: 150,
    flexShrink: 0,
  },
  colTransfer: {
    width: 140,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },

  // ----- Cells ---------------------------------------------------------
  roleText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: 0.2,
  },

  destCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  destBody: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  destName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  destPhone: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
    fontVariant: ['tabular-nums'],
  },

  // Avatar
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.30)',
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.accent.cyan,
    letterSpacing: 0.5,
  },

  // Fallback chip
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '500',
  },

  // Transfer status
  transferCell: {},
  transferStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  transferText: {
    fontSize: 12,
    fontWeight: '500',
  },

  overflowBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  overflowMenu: {
    position: 'absolute',
    top: 36,
    right: 0,
    minWidth: 140,
    backgroundColor: '#1a1a1d',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingVertical: 4,
    zIndex: 50,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 24px rgba(0,0,0,0.4)' } as object)
      : { shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 }),
  } as any,
  overflowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minHeight: 36,
  },
  overflowItemPressed: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  overflowItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary,
  },

  // Empty state
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  emptyBody: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.muted,
    textAlign: 'center',
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6,6,8,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: '#101012',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 24px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)' } as object)
      : { shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 24 }),
  } as any,

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  body: {
    padding: 20,
    gap: 16,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.tertiary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  input: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#0a0a0c',
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  } as any,

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  choiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'transparent',
    minHeight: 32,
    justifyContent: 'center',
  },
  choiceChipSelected: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderColor: 'rgba(59,130,246,0.50)',
  },
  choiceChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.tertiary,
  },
  choiceChipTextSelected: {
    color: Colors.accent.cyan,
    fontWeight: '600',
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0a0a0c',
    minHeight: 44,
  },
  toggleRowOn: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderColor: 'rgba(59,130,246,0.32)',
  },
  toggleTrack: {
    width: 36,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.10)',
    padding: 2,
    justifyContent: 'center',
  },
  toggleTrackOn: {
    backgroundColor: Colors.accent.cyan,
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ffffff',
    transform: [{ translateX: 0 }],
  },
  toggleThumbOn: {
    transform: [{ translateX: 14 }],
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.primary,
    flex: 1,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  btnGhost: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'transparent',
    minHeight: 40,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  btnPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent.cyan,
    minHeight: 40,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 14px rgba(59,130,246,0.35)' } as object)
      : { shadowColor: Colors.accent.cyan, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }),
  } as any,
  btnDisabled: {
    opacity: 0.45,
  },
  btnPrimaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.1,
  },
});

export default RoutingContactsSection;
