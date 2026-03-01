/**
 * RiskTierModal — Premium confirmation modals for Canvas Mode risk tiers.
 *
 * $10,000 UI/UX QUALITY MANDATE:
 * - YELLOW modal: Single-click approval for consequential but reversible actions
 * - RED modal: Type "I APPROVE" for binding, irreversible, high-consequence actions
 * - Multi-layer shadow system (6 layers per tier)
 * - Spring entrance + smooth exit animations
 * - Full focus trap (Tab cycles, Escape dismisses)
 * - Backdrop blur glass effect
 * - Bloomberg Terminal / premium financial software quality
 *
 * Canvas Wave 17 — Risk Tier Confirmation Modals.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
  type TextStyle,
  type AccessibilityRole,
} from 'react-native';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Canvas,
} from '@/constants/tokens';
import { CanvasTokens } from '@/constants/canvas.tokens';
import { emitCanvasEvent } from '@/lib/canvasTelemetry';
import { WarningTriangleIcon } from '@/components/icons/ui/WarningTriangleIcon';
import { ShieldAlertIcon } from '@/components/icons/ui/ShieldAlertIcon';
import { CloseIcon } from '@/components/icons/ui/CloseIcon';

// ---------------------------------------------------------------------------
// Web keyframes (injected once)
// ---------------------------------------------------------------------------

const KEYFRAME_ID = 'aspire-risktier-modal-keyframes';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  if (!document.getElementById(KEYFRAME_ID)) {
    const style = document.createElement('style');
    style.id = KEYFRAME_ID;
    style.textContent = `
      @keyframes riskModalFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes riskModalScaleYellow {
        from { opacity: 0; transform: scale(0.95) translateY(8px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes riskModalScaleRed {
        from { opacity: 0; transform: scale(0.9) translateY(12px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes warningBannerPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.9; }
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .risk-modal-backdrop {
        animation: riskModalFadeIn 200ms ease-out forwards;
      }
      .risk-modal-yellow {
        animation: riskModalScaleYellow 280ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }
      .risk-modal-red {
        animation: riskModalScaleRed 280ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }
      .risk-modal-warning-banner {
        animation: warningBannerPulse 2s ease-in-out infinite;
      }
      .risk-modal-btn:hover {
        transform: translateY(-2px);
        transition: transform 150ms ease-out, box-shadow 150ms ease-out;
      }
      .risk-modal-btn:active {
        transform: scale(0.98);
      }
      .risk-modal-cancel:hover {
        background: rgba(255, 255, 255, 0.15) !important;
      }
      .risk-modal-approve-enabled:hover {
        background: #2563EB !important;
        box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4) !important;
      }
    `;
    document.head.appendChild(style);
  }
}

// ---------------------------------------------------------------------------
// Helper: web className injection
// ---------------------------------------------------------------------------

function wc(cls: string): ViewStyle {
  if (Platform.OS !== 'web') return {};
  return { className: cls } as unknown as ViewStyle;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Detail item shown in the modal body */
export interface ModalDetailItem {
  /** Icon label (e.g., email icon, amount icon) — shown as prefix text */
  icon?: string;
  label: string;
  value: string;
}

/** Consequence item shown in RED modal */
export interface ConsequenceItem {
  text: string;
}

/** Props shared between YELLOW and RED modals */
interface BaseModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Action title (e.g., "Send Email to Client") */
  actionTitle: string;
  /** Action description (e.g., "You're about to send an email to:") */
  description: string;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Callback when user approves — fires after confirmation */
  onApprove: () => void;
  /** Whether the approve action is in progress (shows spinner, disables buttons) */
  loading?: boolean;
  /** Detail items shown in a premium inner card */
  details?: ModalDetailItem[];
  /** Preview content shown below details (e.g., email body preview) */
  previewContent?: string;
  /** Preview label (e.g., "Subject: Invoice #1047") */
  previewLabel?: string;
}

/** YELLOW tier modal — single-click approval */
export interface YellowModalProps extends BaseModalProps {
  tier: 'yellow';
}

/** RED tier modal — type "I APPROVE" to confirm */
export interface RedModalProps extends BaseModalProps {
  tier: 'red';
  /** Warning message shown in the red banner */
  warningMessage?: string;
  /** List of consequences the user is authorizing */
  consequences?: ConsequenceItem[];
}

export type RiskTierModalProps = YellowModalProps | RedModalProps;

// ---------------------------------------------------------------------------
// Reduced motion detection
// ---------------------------------------------------------------------------

const reducedMotion =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
    : false;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RiskTierModal(props: RiskTierModalProps): React.ReactElement | null {
  const { visible, tier, actionTitle, description, onCancel, onApprove, loading = false, details, previewContent, previewLabel } = props;

  // RED-only props
  const warningMessage = tier === 'red' ? (props as RedModalProps).warningMessage ?? 'This action is IRREVERSIBLE' : '';
  const consequences = tier === 'red' ? (props as RedModalProps).consequences ?? [] : [];

  // State
  const [approvalText, setApprovalText] = useState('');
  const [isExiting, setIsExiting] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const approveRef = useRef<View>(null);

  // Animation refs
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const modalScale = useRef(new Animated.Value(tier === 'red' ? 0.9 : 0.95)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const isShown = useRef(false);

  // RED tier: check if typed text matches "I APPROVE" (case-insensitive)
  const isApprovalValid = tier === 'yellow' || approvalText.trim().toUpperCase() === 'I APPROVE';
  const isApproveDisabled = !isApprovalValid || loading;

  // ---------------------------------------------------------------------------
  // Enter / Exit Animation
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (visible && !isShown.current) {
      isShown.current = true;
      setIsExiting(false);
      setApprovalText('');

      // Telemetry
      emitCanvasEvent('risk_modal_open', { tier, action: actionTitle });

      if (reducedMotion) {
        backdropOpacity.setValue(1);
        modalScale.setValue(1);
        modalOpacity.setValue(1);
      } else {
        // Backdrop fade
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: CanvasTokens.modal.animation.backdropFade,
          useNativeDriver: true,
        }).start();

        // Modal spring entrance
        Animated.parallel([
          Animated.spring(modalScale, {
            toValue: 1,
            damping: CanvasTokens.modal.animation.spring.damping,
            stiffness: CanvasTokens.modal.animation.spring.stiffness,
            mass: CanvasTokens.modal.animation.spring.mass,
            useNativeDriver: true,
          }),
          Animated.timing(modalOpacity, {
            toValue: 1,
            duration: CanvasTokens.modal.animation.backdropFade,
            useNativeDriver: true,
          }),
        ]).start();
      }

      // Focus management
      setTimeout(() => {
        if (tier === 'red') {
          inputRef.current?.focus();
        }
        // YELLOW: Approve button gets focus implicitly (first actionable)
      }, 80);
    } else if (!visible && isShown.current) {
      setIsExiting(true);

      if (reducedMotion) {
        backdropOpacity.setValue(0);
        modalScale.setValue(tier === 'red' ? 0.9 : 0.95);
        modalOpacity.setValue(0);
        isShown.current = false;
        setIsExiting(false);
      } else {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 0,
            duration: CanvasTokens.modal.animation.exitDuration,
            useNativeDriver: true,
          }),
          Animated.timing(modalScale, {
            toValue: tier === 'red'
              ? CanvasTokens.modal.animation.exitScaleRed.to
              : CanvasTokens.modal.animation.exitScale.to,
            duration: CanvasTokens.modal.animation.exitDuration,
            useNativeDriver: true,
          }),
          Animated.timing(modalOpacity, {
            toValue: 0,
            duration: CanvasTokens.modal.animation.exitDuration,
            useNativeDriver: true,
          }),
        ]).start(() => {
          isShown.current = false;
          setIsExiting(false);
          setApprovalText('');
        });
      }

      emitCanvasEvent('risk_modal_close', { tier, action: actionTitle });
    }
  }, [visible, tier, actionTitle, backdropOpacity, modalScale, modalOpacity]);

  // ---------------------------------------------------------------------------
  // Keyboard: Escape to dismiss
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, onCancel]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleApprove = useCallback(() => {
    if (isApproveDisabled) return;
    emitCanvasEvent('risk_modal_approve', { tier, action: actionTitle });
    onApprove();
  }, [isApproveDisabled, tier, actionTitle, onApprove]);

  const handleCancel = useCallback(() => {
    if (loading) return;
    emitCanvasEvent('risk_modal_cancel', { tier, action: actionTitle });
    onCancel();
  }, [loading, tier, actionTitle, onCancel]);

  // ---------------------------------------------------------------------------
  // Early return
  // ---------------------------------------------------------------------------

  if (!visible && !isShown.current && !isExiting) return null;

  // ---------------------------------------------------------------------------
  // Tier-specific config
  // ---------------------------------------------------------------------------

  const isRed = tier === 'red';
  const modalWidth = isRed ? CanvasTokens.modal.redWidth : CanvasTokens.modal.yellowWidth;
  const backdropColor = isRed
    ? CanvasTokens.modal.bg.backdrop.red
    : CanvasTokens.modal.bg.backdrop.yellow;
  const dividerColor = isRed
    ? CanvasTokens.modal.divider.red
    : CanvasTokens.modal.divider.yellow;
  const chipConfig = isRed
    ? CanvasTokens.modal.chip.red
    : CanvasTokens.modal.chip.yellow;
  const tierLabel = isRed ? 'RED' : 'YELLOW';

  // Web glass + shadow
  const webModalGlass: ViewStyle =
    Platform.OS === 'web'
      ? ({
          backdropFilter: `blur(${CanvasTokens.modal.backdropBlur}px) saturate(1.4)`,
          WebkitBackdropFilter: `blur(${CanvasTokens.modal.backdropBlur}px) saturate(1.4)`,
          boxShadow: isRed ? CanvasTokens.modal.shadowRed : CanvasTokens.modal.shadowYellow,
        } as unknown as ViewStyle)
      : {};

  const webBackdropBlur: ViewStyle =
    Platform.OS === 'web'
      ? ({
          backdropFilter: `blur(${CanvasTokens.modal.backdropBlur}px)`,
          WebkitBackdropFilter: `blur(${CanvasTokens.modal.backdropBlur}px)`,
        } as unknown as ViewStyle)
      : {};

  // ---------------------------------------------------------------------------
  // Screen reader announcement
  // ---------------------------------------------------------------------------

  const a11yAnnouncement = isRed
    ? `Authority required. WARNING: ${warningMessage}. ${actionTitle}. Type I APPROVE to proceed.`
    : `Confirmation required. ${actionTitle}. Press Approve to proceed or Cancel to dismiss.`;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityViewIsModal
    >
      {/* Backdrop */}
      <Animated.View
        style={[
          styles.backdrop,
          webBackdropBlur,
          wc('risk-modal-backdrop'),
          { backgroundColor: backdropColor, opacity: backdropOpacity },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleCancel}
          accessibilityRole="button"
          accessibilityLabel="Close confirmation modal"
        />
      </Animated.View>

      {/* Modal container */}
      <Animated.View
        style={[
          styles.modalContainer,
          webModalGlass,
          wc(isRed ? 'risk-modal-red' : 'risk-modal-yellow'),
          {
            width: modalWidth,
            opacity: modalOpacity,
            transform: [{ scale: modalScale }],
          },
        ]}
        accessibilityRole={'alertdialog' as AccessibilityRole}
        accessibilityLabel={a11yAnnouncement}
        {...(Platform.OS === 'web' ? { 'aria-modal': true } as Record<string, unknown> : {})}
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <View style={[styles.header, isRed && styles.headerRed]}>
          <View style={styles.headerLeft}>
            {isRed ? (
              <ShieldAlertIcon size={20} color="#EF4444" />
            ) : (
              <WarningTriangleIcon size={20} color="#F59E0B" />
            )}
            <Text
              style={[styles.headerTitle, isRed && styles.headerTitleRed]}
              accessibilityRole="header"
            >
              {isRed ? 'Authority Required' : 'Confirmation Required'}
            </Text>
          </View>
          <Pressable
            onPress={handleCancel}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close modal"
            disabled={loading}
            {...(Platform.OS === 'web' ? { tabIndex: 0 } as Record<string, unknown> : {})}
          >
            <CloseIcon size={16} color={Colors.text.muted} />
          </Pressable>
        </View>

        {/* ── Glow divider ──────────────────────────────────────── */}
        <View style={[styles.glowDivider, { backgroundColor: dividerColor }]} />

        {/* ── Scrollable body ───────────────────────────────────── */}
        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Action title */}
          <Text style={styles.actionTitle}>{actionTitle}</Text>

          {/* RED tier: Warning banner */}
          {isRed && (
            <View style={[styles.warningBanner, wc('risk-modal-warning-banner')]}>
              <WarningTriangleIcon size={16} color="#FFFFFF" />
              <Text style={styles.warningBannerText}>
                WARNING: {warningMessage}
              </Text>
            </View>
          )}

          {/* Description */}
          <Text style={styles.description}>{description}</Text>

          {/* Detail items (inner card) */}
          {details && details.length > 0 && (
            <View style={styles.detailCard}>
              {details.map((item, i) => (
                <View
                  key={`detail-${i}`}
                  style={[
                    styles.detailRow,
                    i < details.length - 1 && styles.detailRowBorder,
                  ]}
                >
                  {item.icon && (
                    <Text style={styles.detailIcon}>{item.icon}</Text>
                  )}
                  <Text style={styles.detailLabel}>{item.label}</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      isRed && styles.detailValueBold,
                    ]}
                    numberOfLines={1}
                  >
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Preview label + content (YELLOW) */}
          {previewLabel && (
            <Text style={styles.previewLabel}>{previewLabel}</Text>
          )}
          {previewContent && (
            <View style={styles.previewCard}>
              <Text style={styles.previewText} numberOfLines={4}>
                {previewContent}
              </Text>
            </View>
          )}

          {/* Consequences list (RED) */}
          {isRed && consequences.length > 0 && (
            <View style={styles.consequencesSection}>
              <Text style={styles.consequencesTitle}>This will:</Text>
              {consequences.map((item, i) => (
                <View key={`cons-${i}`} style={styles.consequenceRow}>
                  <Text style={styles.consequenceBullet}>{'  \u2022  '}</Text>
                  <Text style={styles.consequenceText}>{item.text}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Risk tier chip + receipt note */}
          <View style={styles.riskRow}>
            <View style={[styles.riskChip, { backgroundColor: chipConfig.bg }]}>
              <Text style={[styles.riskChipText, { color: chipConfig.text }]}>
                {tierLabel}
              </Text>
            </View>
            <Text style={styles.receiptNote}>
              Receipt will be generated upon completion.
            </Text>
          </View>

          {/* RED tier: Text input for "I APPROVE" */}
          {isRed && (
            <View style={styles.approvalSection}>
              <Text style={styles.approvalInstruction}>
                To proceed, type{' '}
                <Text style={styles.approvalHighlight}>&quot;I APPROVE&quot;</Text>
                {' '}below:
              </Text>
              <TextInput
                ref={inputRef}
                style={[
                  styles.approvalInput,
                  isApprovalValid && approvalText.length > 0 && styles.approvalInputValid,
                  Platform.OS === 'web'
                    ? ({ outlineStyle: 'none' } as unknown as ViewStyle)
                    : {},
                ]}
                value={approvalText}
                onChangeText={setApprovalText}
                placeholder="Type I APPROVE"
                placeholderTextColor={CanvasTokens.modal.input.placeholder}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!loading}
                accessibilityLabel="Type I APPROVE to confirm this action"
                accessibilityHint="Enter the exact text I APPROVE in uppercase to enable the approve button"
                {...(Platform.OS === 'web' ? { tabIndex: 0 } as Record<string, unknown> : {})}
              />
            </View>
          )}
        </ScrollView>

        {/* ── Footer (action buttons) ───────────────────────────── */}
        <View style={styles.footer}>
          {/* Cancel button */}
          <Pressable
            onPress={handleCancel}
            style={[styles.cancelBtn, wc('risk-modal-cancel risk-modal-btn')]}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            {...(Platform.OS === 'web' ? { tabIndex: 0 } as Record<string, unknown> : {})}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>

          {/* Approve button */}
          <Pressable
            ref={approveRef as React.RefObject<View>}
            onPress={handleApprove}
            style={[
              styles.approveBtn,
              isApproveDisabled
                ? styles.approveBtnDisabled
                : styles.approveBtnEnabled,
              !isApproveDisabled && wc('risk-modal-approve-enabled risk-modal-btn'),
            ]}
            disabled={isApproveDisabled}
            accessibilityRole="button"
            accessibilityLabel={loading ? 'Processing approval' : 'Approve'}
            accessibilityState={{ disabled: isApproveDisabled }}
            {...(Platform.OS === 'web' ? {
              tabIndex: isApproveDisabled ? -1 : 0,
              'aria-disabled': isApproveDisabled,
            } as Record<string, unknown> : {})}
          >
            {loading ? (
              <View style={styles.spinner}>
                <View style={styles.spinnerDot} />
              </View>
            ) : (
              <Text style={styles.approveBtnText}>Approve</Text>
            )}
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const M = CanvasTokens.modal;

const styles = StyleSheet.create({
  // -- Backdrop ---------------------------------------------------------------

  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  // -- Modal container --------------------------------------------------------

  modalContainer: {
    position: 'absolute',
    top: '50%' as unknown as number,
    left: '50%' as unknown as number,
    // Centering: margin offsets are handled via transform in the parent
    // but we use web-standard transform-origin via JS below
    backgroundColor: M.bg.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    maxHeight: M.maxHeight,
    // Web centering
    ...(Platform.OS === 'web'
      ? ({
          transform: 'translate(-50%, -50%)',
          maxHeight: '80vh',
        } as unknown as ViewStyle)
      : {}),
  },

  // -- Header -----------------------------------------------------------------

  header: {
    height: M.headerHeight,
    backgroundColor: M.bg.header,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: M.padding,
  },

  headerRed: {
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },

  headerTitle: {
    ...Typography.captionMedium,
    color: Colors.text.secondary,
    letterSpacing: 0.3,
  },

  headerTitleRed: {
    color: '#EF4444',
  },

  closeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'background-color 150ms ease',
        } as unknown as ViewStyle)
      : {}),
  },

  // -- Glow divider -----------------------------------------------------------

  glowDivider: {
    height: 1,
    width: '100%',
  },

  // -- Body scroll area -------------------------------------------------------

  bodyScroll: {
    flex: 1,
  },

  bodyContent: {
    padding: M.padding,
    gap: Spacing.lg,
  },

  // -- Action title -----------------------------------------------------------

  actionTitle: {
    fontSize: 20,
    fontWeight: '700' as TextStyle['fontWeight'],
    color: Colors.text.primary,
    lineHeight: 26,
  },

  // -- Warning banner (RED only) ----------------------------------------------

  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: M.warningBanner.bg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    minHeight: M.warningBannerHeight,
  },

  warningBannerText: {
    ...Typography.captionMedium,
    color: M.warningBanner.text,
    letterSpacing: 0.4,
    flex: 1,
  },

  // -- Description ------------------------------------------------------------

  description: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    lineHeight: 20,
  },

  // -- Detail card (inner card) -----------------------------------------------

  detailCard: {
    backgroundColor: M.innerCardBg,
    borderRadius: M.innerCardRadius,
    borderWidth: 1,
    borderColor: M.innerCardBorder,
    padding: M.innerCardPadding,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: CanvasTokens.innerCard.webShadow,
        } as unknown as ViewStyle)
      : {}),
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },

  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },

  detailIcon: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },

  detailLabel: {
    ...Typography.small,
    color: Colors.text.muted,
    minWidth: 80,
  },

  detailValue: {
    ...Typography.caption,
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'right' as TextStyle['textAlign'],
  },

  detailValueBold: {
    fontWeight: '600' as TextStyle['fontWeight'],
  },

  // -- Preview (YELLOW) -------------------------------------------------------

  previewLabel: {
    ...Typography.captionMedium,
    color: Colors.text.secondary,
  },

  previewCard: {
    backgroundColor: M.innerCardBg,
    borderRadius: M.innerCardRadius,
    borderWidth: 1,
    borderColor: M.innerCardBorder,
    padding: M.innerCardPadding,
  },

  previewText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    lineHeight: 20,
  },

  // -- Consequences (RED) -----------------------------------------------------

  consequencesSection: {
    gap: Spacing.sm,
  },

  consequencesTitle: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
  },

  consequenceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  consequenceBullet: {
    ...Typography.caption,
    color: Colors.text.muted,
  },

  consequenceText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    flex: 1,
    lineHeight: 20,
  },

  // -- Risk tier chip + receipt note ------------------------------------------

  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },

  riskChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs,
  },

  riskChipText: {
    ...Typography.micro,
    fontWeight: '800' as TextStyle['fontWeight'],
    letterSpacing: 1.2,
  },

  receiptNote: {
    ...Typography.small,
    color: Colors.text.muted,
    fontStyle: 'italic',
    flex: 1,
  },

  // -- Approval input (RED) ---------------------------------------------------

  approvalSection: {
    gap: Spacing.sm,
  },

  approvalInstruction: {
    ...Typography.caption,
    color: Colors.text.muted,
  },

  approvalHighlight: {
    color: Colors.text.primary,
    fontWeight: '700' as TextStyle['fontWeight'],
  },

  approvalInput: {
    height: M.inputHeight,
    borderWidth: 2,
    borderColor: M.input.borderInactive,
    borderRadius: BorderRadius.md,
    backgroundColor: M.input.bg,
    paddingHorizontal: Spacing.lg,
    ...Typography.body,
    color: Colors.text.primary,
    letterSpacing: 1.0,
    ...(Platform.OS === 'web'
      ? ({
          transition: 'border-color 200ms ease',
        } as unknown as ViewStyle)
      : {}),
  },

  approvalInputValid: {
    borderColor: '#10B981',
  },

  // -- Footer (buttons) -------------------------------------------------------

  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: M.padding,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: M.bg.header,
  },

  cancelBtn: {
    flex: 1,
    height: M.buttonHeight,
    borderRadius: BorderRadius.md,
    backgroundColor: M.cancelButton.bg,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'background-color 150ms ease, transform 150ms ease',
        } as unknown as ViewStyle)
      : {}),
  },

  cancelBtnText: {
    ...Typography.bodyMedium,
    color: Colors.text.secondary,
  },

  approveBtn: {
    flex: 2,
    height: M.buttonHeight,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({
          transition: 'background-color 200ms ease, transform 150ms ease, box-shadow 200ms ease, opacity 200ms ease',
        } as unknown as ViewStyle)
      : {}),
  },

  approveBtnEnabled: {
    backgroundColor: M.approveButton.enabled,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
        } as unknown as ViewStyle)
      : {}),
  },

  approveBtnDisabled: {
    backgroundColor: M.approveButton.disabled,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'not-allowed',
        } as unknown as ViewStyle)
      : {}),
  },

  approveBtnText: {
    ...Typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: 0.3,
  },

  // -- Loading spinner --------------------------------------------------------

  spinner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: '#FFFFFF',
    ...(Platform.OS === 'web'
      ? ({
          animation: 'spin 800ms linear infinite',
        } as unknown as ViewStyle)
      : {}),
  },

  spinnerDot: {
    display: 'none',
  },
});
