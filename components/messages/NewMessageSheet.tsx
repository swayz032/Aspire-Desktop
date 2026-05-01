/**
 * NewMessageSheet — Lane E5 (plan §3.9.5).
 *
 * Full-overlay compose modal that floats over the messages page right pane.
 * Triggered from:
 *   - `MessagesHero` `+ New Message` CTA
 *   - `MessagesZeroState` two zero-state CTAs
 *   - `MessagesSuggestedActions` quick-action cards (later w/ prefill)
 *
 * Architecture (matches `AspireNumberPickerSheet` pattern):
 *   - React Native `Modal` with `presentationStyle="overFullScreen"` +
 *     `transparent` + `statusBarTranslucent`
 *   - Explicit zIndex 9999 backdrop guarantees the sheet sits above the
 *     desktop right-pane shell + any sticky chrome (verified pattern from
 *     Pass 19 Lane A AspireNumberPickerSheet z-index fix)
 *   - Glass + halo aesthetic — Aspire-blue ambient ring around the card
 *   - Spring physics on entrance (damping 22, stiffness 220 — snappy)
 *
 * Composition:
 *   - Header — "New Message" + close X
 *   - To: field — `<ContactAutocomplete>` with selected-chip render mode
 *   - Body composer — multiline TextInput with auto-grow up to 6 lines
 *   - Use template button — opens `<MessageTemplatePicker>` dropdown
 *   - Attach media — grayed-out V1.1 stub
 *   - A2P gate banner — amber banner when tenant unregistered, send disabled
 *   - Send button — Aspire-blue gradient with Yellow-tier confirm
 *
 * Yellow-tier flow:
 *   - On Send tap → confirm dialog "Send SMS to {name} at {phone}?"
 *   - On confirm → `onSent(threadId, messageId)` → page navigates to thread
 *
 * Accessibility:
 *   - All interactive elements ≥ 44pt
 *   - Escape closes sheet (Lane E2 page also handles)
 *   - Focus trap inside the sheet via accessibilityViewIsModal
 *   - Screen-reader-friendly char counter announces SMS segments
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  Modal,
  ScrollView,
  Alert,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors, BorderRadius } from '@/constants/tokens';
import {
  ContactAutocomplete,
  type ContactSearchResult,
} from './ContactAutocomplete';
import { MessageTemplatePicker } from './MessageTemplatePicker';
import { useSendMessage } from '@/lib/messages/useSendMessage';
import { useTenantA2pStatus } from '@/lib/messages/useTenantA2pStatus';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A2P registration status — Lane E6 will wire `useTenantA2pStatus()`. */
export type TenantA2pStatus = 'unregistered' | 'pending' | 'registered';

/** Optional prefill — for state-(D) suggestions integration (plan §3.9.5). */
export interface NewMessagePrefill {
  contact?: ContactSearchResult;
  body?: string;
}

export interface NewMessageSheetProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Called after a confirmed Yellow-tier send. The page closes the sheet
   * and navigates to (the new or existing) thread.
   *
   * For Lane E5 the threadId is generated client-side from the contact's
   * phone — Lane E6 replaces this with the real `POST /api/messages/send`
   * response (which returns the canonical thread/message IDs).
   */
  onSent: (threadId: string, messageId: string) => void;
  /** Optional prefill from upstream (zero-state CTA / suggestions card). */
  prefill?: NewMessagePrefill;

  /** Test/demo override — bypass the local A2P mock. */
  a2pStatusOverride?: TenantA2pStatus;
}

// ---------------------------------------------------------------------------
// One-time CSS — entrance spring, hover, focus rings
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectSheetCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.id = 'msg-new-message-sheet-css';
  style.textContent = `
    @keyframes msg-nms-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes msg-nms-pop {
      0%   { opacity: 0; transform: translateY(12px) scale(0.96); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    .msg-nms-backdrop { animation: msg-nms-fade 200ms ease-out both; }
    .msg-nms-card { animation: msg-nms-pop 240ms cubic-bezier(0.22, 1.2, 0.32, 1) both; }
    .msg-nms-input { transition: border-color 140ms ease-out, box-shadow 140ms ease-out; }
    .msg-nms-input:hover { border-color: rgba(255,255,255,0.18); }
    .msg-nms-input:focus-within {
      border-color: rgba(59,130,246,0.55);
      box-shadow: 0 0 0 3px rgba(59,130,246,0.18);
    }
    .msg-nms-btn { transition: transform 160ms ease-out, background-color 160ms ease-out, box-shadow 160ms ease-out, opacity 160ms ease-out; }
    .msg-nms-btn:hover:not(:disabled) { transform: translateY(-1px); }
    .msg-nms-btn:active:not(:disabled) { transform: translateY(0); }
    .msg-nms-btn:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 2px; }
    .msg-nms-btn:disabled { cursor: not-allowed; opacity: 0.5; }
    .msg-nms-tpl-anchor { position: relative; }
    .msg-nms-tpl-menu { position: absolute; top: calc(100% + 6px); left: 0; z-index: 12; }
    @media (prefers-reduced-motion: reduce) {
      .msg-nms-backdrop, .msg-nms-card, .msg-nms-input, .msg-nms-btn {
        animation: none;
        transition: none;
      }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPhone(e164: string): string {
  const digits = (e164 || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return e164 || '';
}

function computeSegments(body: string): { segments: number; max: number } {
  if (body.length === 0) return { segments: 0, max: 160 };
  if (body.length <= 160) return { segments: 1, max: 160 };
  const segments = Math.ceil(body.length / 153);
  return { segments, max: segments * 153 };
}

// Lane E6: thread + message ids come from `POST /api/messages/send` response
// via `useSendMessage`. The synthetic-id fallbacks below were removed.

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NewMessageSheet({
  visible,
  onClose,
  onSent,
  prefill,
  a2pStatusOverride,
}: NewMessageSheetProps) {
  injectSheetCss();

  // Lane E6 — real A2P status via `useTenantA2pStatus`. Fails closed to
  // 'unregistered' if Lane B's route 404s; demo override bypasses entirely.
  const a2p = useTenantA2pStatus();
  const a2pStatus: TenantA2pStatus = a2pStatusOverride ?? a2p.status;
  const a2pBlocked = a2pStatus !== 'registered';

  // Lane E6 — real send mutation. Optimistic outbound bubble + status
  // transitions are handled inside the hook (writes the thread cache).
  const sender = useSendMessage();

  const [contact, setContact] = useState<ContactSearchResult | null>(null);
  const [body, setBody] = useState('');
  const [templateOpen, setTemplateOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const bodyInputRef = useRef<TextInput>(null);

  // Reset / hydrate from prefill on open
  useEffect(() => {
    if (visible) {
      setContact(prefill?.contact ?? null);
      setBody(prefill?.body ?? '');
      setTemplateOpen(false);
      setIsSending(false);
      // Auto-focus body if a contact is already prefilled (skip the To step).
      if (prefill?.contact) {
        setTimeout(() => bodyInputRef.current?.focus(), 100);
      }
    }
  }, [visible, prefill]);

  // Web Escape dismiss
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (templateOpen) {
          setTemplateOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, templateOpen, onClose]);

  const { segments, max } = computeSegments(body);
  const trimmedBody = body.trim();
  const canSend = !!contact && trimmedBody.length > 0 && !a2pBlocked && !isSending;

  const handleSend = useCallback(() => {
    if (!canSend || !contact) return;
    const display =
      contact.name?.trim() || formatPhone(contact.phone) || contact.phone;
    const phoneFormatted = formatPhone(contact.phone);
    const proceed = async () => {
      // Lane E6: real `POST /api/messages/send` via `useSendMessage`.
      // The hook generates a fresh `idempotencyKey` (UUID), submits the
      // mutation, and writes the optimistic outbound bubble into the thread
      // cache so the user sees the bubble appear immediately if they
      // navigate to the thread.
      setIsSending(true);
      try {
        const result = await sender.mutateAsync({
          phone: contact.phone,
          body: trimmedBody,
          // No threadId: server returns the canonical id for new conversations.
          author: 'owner',
        });
        onSent(result.thread_id, result.message_id);
      } catch (err) {
        // The hook surfaces error via `sender.error`; we also alert the
        // owner here so failures are unmissable from the compose modal.
        const message =
          err instanceof Error ? err.message : 'SMS send failed.';
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined' && typeof window.alert === 'function') {
            window.alert(`Send failed: ${message}`);
          }
        } else {
          Alert.alert('Send failed', message, [{ text: 'OK', style: 'default' }]);
        }
      } finally {
        setIsSending(false);
      }
    };

    const message = `Send SMS to ${display} at ${phoneFormatted}?`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        const ok = window.confirm(message);
        if (ok) void proceed();
      } else {
        void proceed();
      }
    } else {
      Alert.alert('Send SMS', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', style: 'default', onPress: () => void proceed() },
      ]);
    }
  }, [canSend, contact, onSent, sender, trimmedBody]);

  // Body multiline auto-grow — RN handles this with multiline; we cap height
  // via maxHeight in styles. On web the textarea auto-grows up to ~6 lines.

  if (!visible) return null;

  const sheetBody = (
    <>
      {/* Backdrop — full-viewport, click-to-close */}
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close compose sheet"
        style={styles.backdrop}
        {...(Platform.OS === 'web'
          ? ({ className: 'msg-nms-backdrop' } as any)
          : {})}
      />

      <BlurView
        intensity={20}
        tint="dark"
        style={styles.backdropBlur}
        pointerEvents="none"
      />

      {/* Sheet card */}
      <View
        style={styles.sheetWrap}
        pointerEvents="box-none"
        accessibilityViewIsModal
        accessibilityLabel="Compose new SMS"
      >
        <View
          style={styles.card}
          {...(Platform.OS === 'web'
            ? ({ className: 'msg-nms-card' } as any)
            : {})}
        >
          {/* Halo ring — premium ambient blue glow around card edges */}
          <View pointerEvents="none" style={styles.halo} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerCol}>
              <Text style={styles.kicker}>NEW MESSAGE</Text>
              <Text style={styles.title} accessibilityRole="header">
                Compose
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              accessibilityHint="Closes the new message sheet"
              hitSlop={12}
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && styles.closeBtnPressed,
              ]}
            >
              <Ionicons name="close" size={18} color={Colors.text.tertiary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* To: row */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>TO</Text>
              <ContactAutocomplete
                value={contact}
                onSelect={(c) => {
                  setContact(c);
                  // Move focus to body once a contact is picked — feels right.
                  setTimeout(() => bodyInputRef.current?.focus(), 80);
                }}
                onClear={() => setContact(null)}
                autoFocus={!contact}
              />
            </View>

            {/* A2P gate banner — appears above the composer when blocked */}
            {a2pBlocked ? <A2pBanner status={a2pStatus} /> : null}

            {/* Composer */}
            <View style={styles.field}>
              <View style={styles.composerHeader}>
                <Text style={styles.fieldLabel}>MESSAGE</Text>

                {/* Template trigger + dropdown */}
                <View
                  style={styles.tplAnchor}
                  {...(Platform.OS === 'web'
                    ? ({ className: 'msg-nms-tpl-anchor' } as any)
                    : {})}
                >
                  <Pressable
                    onPress={() => setTemplateOpen((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel="Use message template"
                    accessibilityHint="Opens a list of common reply templates"
                    accessibilityState={{ expanded: templateOpen }}
                    style={({ pressed }) => [
                      styles.tplBtn,
                      templateOpen && styles.tplBtnOpen,
                      pressed && styles.tplBtnPressed,
                    ]}
                    {...(Platform.OS === 'web'
                      ? ({ className: 'msg-nms-btn' } as any)
                      : {})}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={13}
                      color={
                        templateOpen
                          ? Colors.accent.cyan
                          : Colors.text.tertiary
                      }
                    />
                    <Text
                      style={[
                        styles.tplBtnText,
                        templateOpen && styles.tplBtnTextOpen,
                      ]}
                    >
                      Templates
                    </Text>
                    <Ionicons
                      name={templateOpen ? 'chevron-up' : 'chevron-down'}
                      size={11}
                      color={
                        templateOpen
                          ? Colors.accent.cyan
                          : Colors.text.muted
                      }
                    />
                  </Pressable>
                  {templateOpen ? (
                    <View
                      style={styles.tplMenuPos}
                      {...(Platform.OS === 'web'
                        ? ({ className: 'msg-nms-tpl-menu' } as any)
                        : {})}
                    >
                      <MessageTemplatePicker
                        open
                        onClose={() => setTemplateOpen(false)}
                        onSelect={(tplBody) => {
                          setBody(tplBody);
                          setTemplateOpen(false);
                          setTimeout(() => bodyInputRef.current?.focus(), 60);
                        }}
                        threadContext={{
                          contactName: contact?.name,
                        }}
                      />
                    </View>
                  ) : null}
                </View>
              </View>

              <View
                style={[
                  styles.composerWrap,
                  a2pBlocked && styles.composerWrapDisabled,
                ]}
                {...(Platform.OS === 'web'
                  ? ({ className: 'msg-nms-input' } as any)
                  : {})}
              >
                <TextInput
                  ref={bodyInputRef}
                  value={body}
                  onChangeText={setBody}
                  multiline
                  editable={!a2pBlocked}
                  placeholder={
                    a2pBlocked
                      ? 'SMS disabled until A2P registration is complete'
                      : 'Type your message…'
                  }
                  placeholderTextColor={Colors.text.muted}
                  accessibilityLabel="Message body"
                  accessibilityHint="Type the SMS message you want to send"
                  style={styles.composerInput}
                  textAlignVertical="top"
                  onKeyPress={(e) => {
                    if (Platform.OS !== 'web') return;
                    const ne: any = e.nativeEvent;
                    if (
                      ne?.key === 'Enter' &&
                      (ne?.metaKey || ne?.ctrlKey)
                    ) {
                      e.preventDefault?.();
                      handleSend();
                    }
                  }}
                />
              </View>

              <View style={styles.composerMeta}>
                <Text
                  style={[
                    styles.charCounter,
                    body.length > max - 10 && styles.charCounterWarn,
                    body.length > max && styles.charCounterError,
                  ]}
                  accessibilityLiveRegion="polite"
                >
                  {body.length === 0
                    ? '0/160 (1 SMS)'
                    : `${body.length}/${max} (${segments} SMS)`}
                </Text>
                {Platform.OS === 'web' ? (
                  <Text style={styles.composerHint}>
                    <Text style={styles.composerHintKey}>⌘</Text>
                    <Text>+</Text>
                    <Text style={styles.composerHintKey}>Enter</Text>
                    <Text> to send</Text>
                  </Text>
                ) : null}
              </View>
            </View>

            {/* MMS — V1.1 stub */}
            <View style={styles.mmsRow}>
              <View style={styles.mmsPill}>
                <Ionicons
                  name="camera-outline"
                  size={13}
                  color={Colors.text.muted}
                />
                <Text style={styles.mmsText}>MMS — coming soon</Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && styles.cancelBtnPressed,
              ]}
              {...(Platform.OS === 'web'
                ? ({ className: 'msg-nms-btn' } as any)
                : {})}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityHint={
                a2pBlocked
                  ? 'Disabled until A2P registration is complete'
                  : !contact
                  ? 'Pick a contact first'
                  : !trimmedBody
                  ? 'Type a message to enable send'
                  : `Sends the message to ${
                      contact.name?.trim() || formatPhone(contact.phone)
                    }`
              }
              accessibilityState={{ disabled: !canSend }}
              style={({ pressed }) => [
                styles.sendBtn,
                !canSend && styles.sendBtnDisabled,
                canSend && pressed && styles.sendBtnPressed,
              ]}
              {...(Platform.OS === 'web'
                ? ({
                    className: 'msg-nms-btn',
                    disabled: !canSend ? true : undefined,
                  } as any)
                : {})}
            >
              <Ionicons
                name={isSending ? 'hourglass-outline' : 'send'}
                size={15}
                color={canSend ? '#ffffff' : Colors.text.muted}
              />
              <Text
                style={[
                  styles.sendBtnText,
                  !canSend && styles.sendBtnTextDisabled,
                ]}
              >
                {isSending ? 'Sending…' : 'Send'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>{sheetBody}</View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// A2P banner — amber warning when SMS is gated by tenant A2P registration
// ---------------------------------------------------------------------------

function A2pBanner({ status }: { status: TenantA2pStatus }) {
  const isPending = status === 'pending';
  return (
    <View
      style={styles.a2pBanner}
      accessibilityRole="alert"
      accessibilityLabel={
        isPending
          ? 'A2P 10DLC registration pending — SMS will enable once approved'
          : 'A2P 10DLC registration required — SMS is disabled'
      }
    >
      <View style={styles.a2pIconWrap}>
        <Ionicons name="alert-circle-outline" size={16} color="#FBBF24" />
      </View>
      <View style={styles.a2pBody}>
        <Text style={styles.a2pTitle}>
          {isPending ? 'A2P 10DLC registration pending' : 'A2P 10DLC required'}
        </Text>
        <Text style={styles.a2pSubtitle}>
          {isPending
            ? 'SMS will enable once carriers approve your campaign — usually 1–3 business days.'
            : 'Outbound SMS is disabled until your tenant completes A2P registration. Visit Settings → SMS Registration.'}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const SHEET_WIDTH = 560;
const SHEET_MAX_HEIGHT = 720;

const styles = StyleSheet.create({
  // ----- Modal root --------------------------------------------------------
  modalRoot: {
    flex: 1,
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed' as any,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
        } as object)
      : {}),
  } as any,

  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
    zIndex: 9999,
  } as any,
  backdropBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  } as any,

  sheetWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 10000,
  } as any,

  // ----- Card --------------------------------------------------------------
  card: {
    width: '100%',
    maxWidth: SHEET_WIDTH,
    maxHeight: SHEET_MAX_HEIGHT,
    backgroundColor: '#1A1A1C',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    zIndex: 10001,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 24px 80px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.35), 0 0 60px rgba(59,130,246,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
          backdropFilter: 'blur(24px) saturate(140%)',
          WebkitBackdropFilter: 'blur(24px) saturate(140%)',
        } as object)
      : {
          shadowColor: Colors.accent.cyan,
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.4,
          shadowRadius: 24,
          elevation: 14,
        }),
  } as ViewStyle,

  /** Decorative ambient glow ring on top of the card edge — Aspire-blue. */
  halo: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: BorderRadius.xl + 2,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.18)',
    zIndex: -1,
    ...(Platform.OS === 'web'
      ? ({ pointerEvents: 'none' } as object)
      : {}),
  } as any,

  // ----- Header ------------------------------------------------------------
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.accent.cyan,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  closeBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // ----- Scroll body -------------------------------------------------------
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 18,
  },

  // ----- Field wrapper -----------------------------------------------------
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.tertiary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  // ----- Composer ----------------------------------------------------------
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  composerWrap: {
    backgroundColor: '#141416',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    minHeight: 120,
  } as ViewStyle,
  composerWrapDisabled: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  composerInput: {
    minHeight: 120,
    maxHeight: 168,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          // Allows web textarea to grow naturally to maxHeight.
          resize: 'none',
        } as object)
      : {}),
  } as any,
  composerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 4,
  },
  charCounter: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted,
    fontVariant: ['tabular-nums'],
  },
  charCounterWarn: {
    color: Colors.semantic.warning,
  },
  charCounterError: {
    color: Colors.semantic.error,
  },
  composerHint: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.text.muted,
  },
  composerHintKey: {
    fontWeight: '600',
    color: Colors.text.tertiary,
  },

  // ----- Templates anchor + button -----------------------------------------
  tplAnchor: {
    position: 'relative',
  } as any,
  tplBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minHeight: 30,
  },
  tplBtnOpen: {
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderColor: 'rgba(59,130,246,0.30)',
  },
  tplBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tplBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.tertiary,
    letterSpacing: 0.1,
  },
  tplBtnTextOpen: {
    color: Colors.accent.cyan,
  },
  tplMenuPos: {
    // Native fallback positioning — we render the picker just below the
    // button. On web the .msg-nms-tpl-menu CSS rule wins (absolute pos).
    position: 'absolute',
    top: 36,
    right: 0,
    zIndex: 12,
  } as any,

  // ----- MMS V1.1 stub -----------------------------------------------------
  mmsRow: {
    flexDirection: 'row',
    paddingTop: 4,
  },
  mmsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    opacity: 0.7,
  },
  mmsText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted,
    letterSpacing: 0.1,
  },

  // ----- A2P banner --------------------------------------------------------
  a2pBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.32)',
  },
  a2pIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 1,
  },
  a2pBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  a2pTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FBBF24',
    letterSpacing: 0.1,
  },
  a2pSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(251,191,36,0.85)',
    lineHeight: 17,
  },

  // ----- Footer ------------------------------------------------------------
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(10,10,12,0.4)',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    minHeight: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
    minHeight: 44,
    minWidth: 110,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent.cyan,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'linear-gradient(180deg, #3B82F6 0%, #2563EB 100%)',
          boxShadow:
            '0 1px 2px rgba(0,0,0,0.3), 0 6px 18px rgba(59,130,246,0.30)',
        } as object)
      : {
          shadowColor: Colors.accent.cyan,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 10,
        }),
  } as any,
  sendBtnPressed: {
    backgroundColor: Colors.accent.cyanDark,
    opacity: 0.95,
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web'
      ? ({ backgroundImage: 'none', boxShadow: 'none' } as object)
      : {}),
  } as any,
  sendBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.1,
  },
  sendBtnTextDisabled: {
    color: Colors.text.muted,
  },
});
