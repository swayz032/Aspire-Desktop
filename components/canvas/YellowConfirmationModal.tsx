/**
 * YellowConfirmationModal -- YELLOW tier action confirmation
 *
 * Premium Bloomberg Terminal-quality modal for YELLOW risk tier actions.
 * Shows action details, risk chip, and approve/cancel buttons.
 *
 * Law #4: YELLOW tier requires explicit user confirmation.
 * Law #2: Receipt note reminds user that all actions generate receipts.
 *
 * Quality: $10K aesthetic -- multi-layer shadows, backdrop blur,
 *   6-layer depth system, smooth spring animations, accessible UX.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  type ViewStyle,
  type TextStyle,
  AccessibilityInfo,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { CanvasTokens } from '@/constants/canvas.tokens';
import { WarningTriangleIcon } from '@/components/icons/ui/WarningTriangleIcon';
import { CloseIcon } from '@/components/icons/ui/CloseIcon';
import {
  onActionEvent,
  approveAction,
  denyAction,
  type CanvasAction,
} from '@/lib/canvasActionBus';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Human-readable action type labels */
const ACTION_LABELS: Record<string, string> = {
  'email.send': 'Send Email',
  'email.compose': 'Compose Email',
  'invoice.create': 'Create Invoice',
  'invoice.send': 'Send Invoice',
  'calendar.create': 'Create Calendar Event',
  'contact.update': 'Update Contact',
  'meeting.schedule': 'Schedule Meeting',
};

function getActionLabel(actionType: string): string {
  return ACTION_LABELS[actionType] || actionType;
}

/** Format payload for display (redact sensitive fields) */
function formatPayloadForDisplay(payload: Record<string, unknown>): string {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    // Redact sensitive field patterns
    if (/password|token|secret|key|credential/i.test(key)) {
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

export function YellowConfirmationModal() {
  const [visible, setVisible] = useState(false);
  const [action, setAction] = useState<CanvasAction | null>(null);
  const [loading, setLoading] = useState(false);

  // Animation values
  const backdropOpacity = useSharedValue(0);
  const modalScale = useSharedValue(CanvasTokens.modal.animation.entranceScale.from as number);
  const modalOpacity = useSharedValue(0);

  // Ref to track mounted state
  const mountedRef = useRef(true);

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
      'confirmation:yellow:requested',
      (payload) => {
        const incomingAction = payload as CanvasAction;
        setAction(incomingAction);
        setVisible(true);

        // Animate entrance
        backdropOpacity.value = withTiming(1, {
          duration: CanvasTokens.modal.animation.backdropFade,
          easing: Easing.out(Easing.ease),
        });
        modalScale.value = withSpring(
          CanvasTokens.modal.animation.entranceScale.to as number,
          CanvasTokens.modal.animation.spring,
        );
        modalOpacity.value = withTiming(1, {
          duration: CanvasTokens.modal.animation.backdropFade,
        });
      },
    );

    return unsubscribe;
  }, [backdropOpacity, modalScale, modalOpacity]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const animateOut = useCallback(
    (onComplete: () => void) => {
      backdropOpacity.value = withTiming(0, {
        duration: CanvasTokens.modal.animation.exitDuration,
      });
      modalScale.value = withTiming(
        CanvasTokens.modal.animation.exitScale.from as number,
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
    if (!action || loading) return;
    setLoading(true);

    animateOut(() => {
      if (mountedRef.current) {
        approveAction(action.id, 'yellow');
        setVisible(false);
        setLoading(false);
        setAction(null);
      }
    });
  }, [action, loading, animateOut]);

  const handleCancel = useCallback(() => {
    if (!action || loading) return;

    animateOut(() => {
      if (mountedRef.current) {
        denyAction(action.id, 'yellow');
        setVisible(false);
        setAction(null);
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
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, animatedBackdropStyle]}>
        <Pressable
          style={styles.backdropPressable}
          onPress={handleCancel}
          accessibilityRole="button"
          accessibilityLabel="Close confirmation dialog"
        >
          {/* Modal Container */}
          <Animated.View style={[styles.modalContainer, animatedModalStyle]}>
            <Pressable
              style={styles.modalInner}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <View style={styles.header}>
                <WarningTriangleIcon size={20} color="#F59E0B" />
                <Text
                  style={styles.headerTitle}
                  accessibilityRole="header"
                >
                  Confirmation Required
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

              {/* Divider with glow */}
              <View style={styles.divider} />

              {/* Content */}
              <View style={styles.content}>
                <Text style={styles.actionTitle}>
                  {getActionLabel(action.type)}
                </Text>
                <Text style={styles.description}>
                  You are about to perform this action. Please review the details below.
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
                  <View style={styles.yellowChip}>
                    <Text style={styles.riskChipText}>YELLOW</Text>
                  </View>
                  <Text style={styles.receiptNote}>
                    A receipt will be generated upon completion.
                  </Text>
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
                    loading && styles.approveButtonLoading,
                  ]}
                  onPress={handleApprove}
                  accessibilityRole="button"
                  accessibilityLabel="Approve action"
                  disabled={loading}
                >
                  <Text style={styles.approveButtonText}>
                    {loading ? 'Approving...' : 'Approve'}
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
    backgroundColor: CanvasTokens.modal.bg.backdrop.yellow,
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
    width: CanvasTokens.modal.yellowWidth,
    maxWidth: '90%' as unknown as number,
    maxHeight: CanvasTokens.modal.maxHeight,
  },

  modalInner: {
    backgroundColor: CanvasTokens.modal.bg.surface,
    borderRadius: 12,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: CanvasTokens.modal.shadowYellow,
        } as unknown as ViewStyle)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 24 },
          shadowOpacity: 0.8,
          shadowRadius: 64,
          elevation: 24,
        }),
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
    backgroundColor: CanvasTokens.modal.divider.yellow,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: `0 0 8px ${CanvasTokens.modal.divider.yellow}`,
        } as unknown as ViewStyle)
      : {
          shadowColor: '#F59E0B',
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

  yellowChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: CanvasTokens.modal.chip.yellow.bg,
  },

  riskChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: CanvasTokens.modal.chip.yellow.text,
    letterSpacing: 0.8,
  },

  receiptNote: {
    fontSize: 12,
    color: CanvasTokens.text.muted,
    fontStyle: 'italic',
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

  approveButtonLoading: {
    opacity: 0.6,
  },

  approveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
