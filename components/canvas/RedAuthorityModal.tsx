/**
 * RedAuthorityModal -- RED tier authority authorization
 *
 * Premium Bloomberg Terminal-quality modal for RED risk tier actions.
 * Requires user to type "I APPROVE" to authorize irreversible actions.
 *
 * Law #4: RED tier requires explicit authority + strong confirmation UX.
 * Law #2: Receipt note reminds user that all actions generate receipts.
 * Law #3: Fail closed -- button disabled until exact match.
 *
 * Quality: $10K aesthetic -- multi-layer shadows, backdrop blur,
 *   warning banner, red glow divider, spring animations, accessible UX.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { CanvasTokens } from '@/constants/canvas.tokens';
import { ShieldAlertIcon } from '@/components/icons/ui/ShieldAlertIcon';
import { CloseIcon } from '@/components/icons/ui/CloseIcon';
import { LockIcon } from '@/components/icons/ui/LockIcon';
import {
  onActionEvent,
  approveAction,
  denyAction,
  type CanvasAction,
} from '@/lib/canvasActionBus';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const APPROVAL_TEXT = 'I APPROVE';

/** Human-readable action type labels */
const ACTION_LABELS: Record<string, string> = {
  'payment.send': 'Send Payment',
  'contract.sign': 'Sign Contract',
  'data.delete': 'Delete Data',
  'invoice.send': 'Send Invoice',
  'filing.submit': 'Submit Filing',
  'transfer.execute': 'Execute Transfer',
};

function getActionLabel(actionType: string): string {
  return ACTION_LABELS[actionType] || actionType;
}

/** Format payload for display (redact sensitive fields) */
function formatPayloadForDisplay(payload: Record<string, unknown>): string {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (/password|token|secret|key|credential|ssn|card/i.test(key)) {
      sanitized[key] = '<REDACTED>';
    } else {
      sanitized[key] = value;
    }
  }
  return JSON.stringify(sanitized, null, 2);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RedAuthorityModal() {
  const [visible, setVisible] = useState(false);
  const [action, setAction] = useState<CanvasAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [inputFocused, setInputFocused] = useState(false);

  const isValid = inputText.trim().toUpperCase() === APPROVAL_TEXT;

  // Animation values
  const backdropOpacity = useSharedValue(0);
  const modalScale = useSharedValue(CanvasTokens.modal.animation.entranceScaleRed.from as number);
  const modalOpacity = useSharedValue(0);
  const bannerPulse = useSharedValue(1);

  // Ref to track mounted state
  const mountedRef = useRef(true);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Event Subscription
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const unsubscribe = onActionEvent(
      'confirmation:red:requested',
      (payload) => {
        const incomingAction = payload as CanvasAction;
        setAction(incomingAction);
        setInputText('');
        setVisible(true);

        // Animate entrance (stronger scale for RED)
        backdropOpacity.value = withTiming(1, {
          duration: CanvasTokens.modal.animation.backdropFade,
          easing: Easing.out(Easing.ease),
        });
        modalScale.value = withSpring(
          CanvasTokens.modal.animation.entranceScaleRed.to as number,
          CanvasTokens.modal.animation.spring,
        );
        modalOpacity.value = withTiming(1, {
          duration: CanvasTokens.modal.animation.backdropFade,
        });

        // Warning banner pulse animation
        bannerPulse.value = withRepeat(
          withSequence(
            withTiming(0.85, {
              duration: CanvasTokens.modal.animation.bannerPulseDuration / 2,
              easing: Easing.inOut(Easing.sin),
            }),
            withTiming(1, {
              duration: CanvasTokens.modal.animation.bannerPulseDuration / 2,
              easing: Easing.inOut(Easing.sin),
            }),
          ),
          -1, // infinite
          false,
        );

        // Focus input after animation
        setTimeout(() => {
          inputRef.current?.focus();
        }, 300);
      },
    );

    return unsubscribe;
  }, [backdropOpacity, modalScale, modalOpacity, bannerPulse]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const animateOut = useCallback(
    (onComplete: () => void) => {
      backdropOpacity.value = withTiming(0, {
        duration: CanvasTokens.modal.animation.exitDuration,
      });
      modalScale.value = withTiming(
        CanvasTokens.modal.animation.exitScaleRed.from as number,
        { duration: CanvasTokens.modal.animation.exitDuration },
        () => {
          runOnJS(onComplete)();
        },
      );
      modalOpacity.value = withTiming(0, {
        duration: CanvasTokens.modal.animation.exitDuration,
      });
    },
    [backdropOpacity, modalScale, modalOpacity],
  );

  const handleApprove = useCallback(() => {
    if (!action || loading || !isValid) return;
    setLoading(true);

    animateOut(() => {
      if (mountedRef.current) {
        approveAction(action.id, 'red');
        setVisible(false);
        setLoading(false);
        setAction(null);
        setInputText('');
      }
    });
  }, [action, loading, isValid, animateOut]);

  const handleCancel = useCallback(() => {
    if (!action || loading) return;

    animateOut(() => {
      if (mountedRef.current) {
        denyAction(action.id, 'red');
        setVisible(false);
        setAction(null);
        setInputText('');
      }
    });
  }, [action, loading, animateOut]);

  // ---------------------------------------------------------------------------
  // Animated Styles
  // ---------------------------------------------------------------------------

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const animatedModalStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
    transform: [{ scale: modalScale.value }],
  }));

  const animatedBannerStyle = useAnimatedStyle(() => ({
    opacity: bannerPulse.value,
  }));

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!action) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleCancel}
      accessibilityViewIsModal
    >
      {/* Backdrop (darker for RED) */}
      <Animated.View style={[styles.backdrop, animatedBackdropStyle]}>
        <Pressable
          style={styles.backdropPressable}
          onPress={handleCancel}
          accessibilityRole="button"
          accessibilityLabel="Close authority dialog"
        >
          {/* Modal Container */}
          <Animated.View style={[styles.modalContainer, animatedModalStyle]}>
            <Pressable
              style={styles.modalInner}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Warning Banner */}
              <Animated.View style={[styles.warningBanner, animatedBannerStyle]}>
                <ShieldAlertIcon size={16} color="#FFFFFF" />
                <Text style={styles.warningBannerText}>
                  WARNING: This action may be irreversible
                </Text>
              </Animated.View>

              {/* Header */}
              <View style={styles.header}>
                <ShieldAlertIcon size={20} color="#EF4444" />
                <Text
                  style={styles.headerTitle}
                  accessibilityRole="header"
                >
                  Authority Required
                </Text>
                <Pressable
                  onPress={handleCancel}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  style={styles.closeButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <CloseIcon size={16} color="rgba(255,255,255,0.6)" />
                </Pressable>
              </View>

              {/* Divider with red glow */}
              <View style={styles.divider} />

              {/* Content */}
              <View style={styles.content}>
                <Text style={styles.actionTitle}>
                  {getActionLabel(action.type)}
                </Text>
                <Text style={styles.description}>
                  This is a high-risk action that requires explicit authorization.
                  Please review the details carefully before proceeding.
                </Text>

                {/* Action details card */}
                <View style={styles.detailsCard}>
                  <Text
                    style={styles.detailsText}
                    accessibilityLabel={`Action details: ${formatPayloadForDisplay(action.payload)}`}
                  >
                    {formatPayloadForDisplay(action.payload)}
                  </Text>
                </View>

                {/* Risk tier + receipt note */}
                <View style={styles.riskTierRow}>
                  <View style={styles.redChip}>
                    <Text style={styles.riskChipText}>RED</Text>
                  </View>
                  <Text style={styles.receiptNote}>
                    An immutable receipt will be generated for audit.
                  </Text>
                </View>

                {/* Authorization input */}
                <View style={styles.inputSection}>
                  <View style={styles.inputLabelRow}>
                    <LockIcon size={14} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.inputLabel}>
                      Type{' '}
                      <Text style={styles.inputLabelBold}>I APPROVE</Text>
                      {' '}to authorize
                    </Text>
                  </View>
                  <TextInput
                    ref={inputRef}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder="Type I APPROVE"
                    placeholderTextColor={CanvasTokens.modal.input.placeholder}
                    style={[
                      styles.textInput,
                      inputFocused && styles.textInputFocused,
                      isValid && styles.textInputValid,
                    ]}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    autoComplete="off"
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    onSubmitEditing={isValid ? handleApprove : undefined}
                    accessibilityLabel="Type I APPROVE to authorize this action"
                    accessibilityHint="You must type the exact text I APPROVE in uppercase"
                  />
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={handleCancel}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel action"
                  disabled={loading}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.approveButton,
                    !isValid && styles.approveButtonDisabled,
                    loading && styles.approveButtonLoading,
                  ]}
                  onPress={handleApprove}
                  accessibilityRole="button"
                  accessibilityLabel="Authorize action"
                  accessibilityState={{ disabled: !isValid || loading }}
                  disabled={!isValid || loading}
                >
                  <Text
                    style={[
                      styles.approveButtonText,
                      !isValid && styles.approveButtonTextDisabled,
                    ]}
                  >
                    {loading ? 'Authorizing...' : 'Authorize'}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: CanvasTokens.modal.bg.backdrop.red,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: `blur(${CanvasTokens.modal.backdropBlur}px)`,
        } as unknown as ViewStyle)
      : {}),
  },

  backdropPressable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },

  modalContainer: {
    width: CanvasTokens.modal.redWidth,
    maxWidth: '90%' as unknown as number,
    maxHeight: CanvasTokens.modal.maxHeight,
  },

  modalInner: {
    backgroundColor: CanvasTokens.modal.bg.surface,
    borderRadius: 12,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: CanvasTokens.modal.shadowRed,
        } as unknown as ViewStyle)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 24 },
          shadowOpacity: 0.8,
          shadowRadius: 64,
          elevation: 24,
        }),
  },

  warningBanner: {
    height: CanvasTokens.modal.warningBannerHeight,
    backgroundColor: CanvasTokens.modal.warningBanner.bg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },

  warningBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: CanvasTokens.modal.warningBanner.text,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: CanvasTokens.modal.headerHeight,
    paddingHorizontal: 16,
    backgroundColor: CanvasTokens.modal.bg.header,
    gap: 8,
  },

  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: CanvasTokens.text.primary,
    letterSpacing: 0.2,
  },

  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },

  divider: {
    height: 1,
    backgroundColor: CanvasTokens.modal.divider.red,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: `0 0 8px ${CanvasTokens.modal.divider.red}`,
        } as unknown as ViewStyle)
      : {
          shadowColor: '#EF4444',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.4,
          shadowRadius: 4,
        }),
  },

  content: {
    padding: CanvasTokens.modal.padding,
    gap: 16,
  },

  actionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: CanvasTokens.text.primary,
    letterSpacing: -0.2,
  },

  description: {
    fontSize: 14,
    color: CanvasTokens.text.secondary,
    lineHeight: 20,
  },

  detailsCard: {
    padding: CanvasTokens.modal.innerCardPadding,
    backgroundColor: CanvasTokens.modal.innerCardBg,
    borderRadius: CanvasTokens.modal.innerCardRadius,
    borderWidth: 1,
    borderColor: CanvasTokens.modal.innerCardBorder,
  },

  detailsText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
    color: CanvasTokens.text.secondary,
    lineHeight: 18,
  } as TextStyle,

  riskTierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  redChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: CanvasTokens.modal.chip.red.bg,
  },

  riskChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: CanvasTokens.modal.chip.red.text,
    letterSpacing: 0.8,
  },

  receiptNote: {
    fontSize: 12,
    color: CanvasTokens.text.muted,
    fontStyle: 'italic',
  },

  inputSection: {
    gap: 8,
  },

  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  inputLabel: {
    fontSize: 13,
    color: CanvasTokens.text.secondary,
  },

  inputLabelBold: {
    fontWeight: '700',
    color: '#EF4444',
  },

  textInput: {
    height: CanvasTokens.modal.inputHeight,
    borderWidth: 2,
    borderColor: CanvasTokens.modal.input.borderInactive,
    borderRadius: 8,
    backgroundColor: CanvasTokens.modal.input.bg,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '700',
    color: CanvasTokens.text.primary,
    letterSpacing: 2,
    textAlign: 'center',
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          transition: `border-color ${CanvasTokens.modal.animation.buttonTransition}ms ease`,
        } as unknown as TextStyle)
      : {}),
  } as TextStyle,

  textInputFocused: {
    borderColor: CanvasTokens.modal.input.borderFocused,
  },

  textInputValid: {
    borderColor: '#10B981',
  },

  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: CanvasTokens.modal.padding,
    paddingTop: 0,
  },

  cancelButton: {
    flex: 1,
    height: CanvasTokens.modal.buttonHeight,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: CanvasTokens.modal.cancelButton.bg,
    borderRadius: 8,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: `all ${CanvasTokens.modal.animation.buttonTransition}ms ease`,
        } as unknown as ViewStyle)
      : {}),
  },

  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: CanvasTokens.text.primary,
  },

  approveButton: {
    flex: 1,
    height: CanvasTokens.modal.buttonHeight,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: CanvasTokens.modal.approveButton.enabled,
    borderRadius: 8,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: `all ${CanvasTokens.modal.animation.buttonTransition}ms ease`,
        } as unknown as ViewStyle)
      : {}),
  },

  approveButtonDisabled: {
    backgroundColor: CanvasTokens.modal.approveButton.disabled,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'not-allowed',
        } as unknown as ViewStyle)
      : {}),
  },

  approveButtonLoading: {
    opacity: 0.6,
  },

  approveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  approveButtonTextDisabled: {
    opacity: 0.5,
  },
});
