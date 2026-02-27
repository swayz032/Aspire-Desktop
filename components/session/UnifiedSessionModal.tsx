/**
 * UnifiedSessionModal — Premium 2-step modal combining session configuration + invite
 *
 * Step 1: Configure — Purpose grid (5 options) + participant list with remove buttons
 * Step 2: Invite — Compact participant strip (avatar circles) + inline InviteTabContent + "Start Session" button
 *
 * Replaces the old pattern of Start Session modal + separate InviteSheet overlay.
 * Single unified flow prevents context loss when adding participants.
 *
 * Design: "Command Center Glass" — dark elevated surface with gradient border,
 * step indicator dots with connecting line, spring-animated step transitions.
 *
 * Wave 4 Polish: Backdrop blur on overlay, enhanced multi-layer glass border glow,
 * spring-interpolated step slide with opacity crossfade, premium layered box shadows,
 * subtle inner glow on active step, web-only CSS transitions for hover states.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, BorderRadius, Shadows, Animation, Canvas } from '@/constants/tokens';
import { SessionPurpose } from '@/data/session';
import { InviteTabContent, PressableScale } from '@/components/session/InviteTabContent';

// ─── Web-only hover styles ────────────────────────────────────────────────────

function injectModalKeyframes() {
  if (Platform.OS !== 'web') return;
  if (document.getElementById('aspire-modal-keyframes')) return;
  const style = document.createElement('style');
  style.id = 'aspire-modal-keyframes';
  style.textContent = `
    .modal-close-btn:hover {
      background-color: ${Colors.background.elevated} !important;
      transform: scale(1.05);
    }
    .modal-close-btn:active { transform: scale(0.95); }
    .modal-purpose-opt:hover {
      background-color: ${Colors.background.elevated} !important;
      border-color: ${Colors.border.strong} !important;
    }
    .modal-cancel-btn:hover {
      background-color: ${Colors.background.elevated} !important;
      border-color: ${Colors.border.strong} !important;
    }
    .modal-next-btn:hover {
      box-shadow: 0 6px 24px rgba(37, 99, 235, 0.45), 0 0 0 1px rgba(59, 130, 246, 0.25) inset !important;
      transform: translateY(-1px);
    }
    .modal-next-btn:active { transform: translateY(0) scale(0.98); }
    .modal-back-btn:hover {
      background-color: ${Colors.background.elevated} !important;
      border-color: ${Colors.border.strong} !important;
    }
  `;
  document.head.appendChild(style);
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MODAL_WIDTH = 600;
const MODAL_BORDER_RADIUS = 20;

/** Step indicator layout */
const STEP_DOT_SIZE = 10;
const STEP_DOT_GAP = 0; // Gap between dot and connector — connector is inset
const STEP_CONNECTOR_WIDTH = 40;
const STEP_CONNECTOR_HEIGHT = 2;

const PURPOSE_OPTIONS: { id: SessionPurpose; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'Internal', label: 'Internal', icon: 'business' },
  { id: 'Client Call', label: 'Client', icon: 'person' },
  { id: 'Vendor Call', label: 'Vendor', icon: 'storefront' },
  { id: 'Deal Review', label: 'Deal', icon: 'briefcase' },
  { id: 'Networking', label: 'Network', icon: 'people' },
];

// ─── PulsingDot (reused from lobby) ──────────────────────────────────────────

function PulsingDot({ color }: { color: string }) {
  const opacity = useSharedValue(1);
  React.useEffect(() => {
    opacity.value = withSpring(0.3, { damping: 2, stiffness: 8 });
    // Simple cycling approach via repeated spring
    const interval = setInterval(() => {
      opacity.value = withSpring(opacity.value === 0.3 ? 1 : 0.3, { damping: 6, stiffness: 30 });
    }, 800);
    return () => clearInterval(interval);
  }, []);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }, animStyle]}
      accessibilityElementsHidden
    />
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Participant {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  status: 'ready' | 'invited' | 'joining';
  inviteType?: 'internal' | 'cross-suite' | 'external';
}

interface UnifiedSessionModalProps {
  visible: boolean;
  onClose: () => void;
  onStartSession: () => void;
  isJoining: boolean;
  purpose: SessionPurpose;
  onPurposeChange: (purpose: SessionPurpose) => void;
  participants: Participant[];
  onAddParticipant: (userId: string, name: string, inviteType?: 'internal' | 'cross-suite') => void;
  onAddGuest: (name: string, contact: string) => void;
  onRemoveParticipant: (id: string) => void;
  roomName: string;
  hostName: string;
  correlationId?: string;
}

type Step = 1 | 2;

// ─── Component ───────────────────────────────────────────────────────────────

export function UnifiedSessionModal({
  visible,
  onClose,
  onStartSession,
  isJoining,
  purpose,
  onPurposeChange,
  participants,
  onAddParticipant,
  onAddGuest,
  onRemoveParticipant,
  roomName,
  hostName,
  correlationId,
}: UnifiedSessionModalProps) {
  const [step, setStep] = useState<Step>(1);

  // Inject web hover CSS once
  useEffect(() => { injectModalKeyframes(); }, []);

  // Animated step transition — spring-interpolated horizontal offset with opacity crossfade
  const stepOffset = useSharedValue(0);

  const goToStep = useCallback((targetStep: Step) => {
    setStep(targetStep);
    stepOffset.value = withSpring(targetStep === 1 ? 0 : 1, {
      damping: Canvas.motion.spring.damping,
      stiffness: Canvas.motion.spring.stiffness,
      mass: Canvas.motion.spring.mass,
    });
  }, []);

  // Reset step when modal closes
  useEffect(() => {
    if (!visible) {
      setStep(1);
      stepOffset.value = 0;
    }
  }, [visible]);

  // Step 1 slides left and fades out as stepOffset goes 0 -> 1
  const step1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(stepOffset.value, [0, 1], [0, -MODAL_WIDTH * 0.3], Extrapolation.CLAMP) }],
    opacity: interpolate(stepOffset.value, [0, 0.4, 1], [1, 0.4, 0], Extrapolation.CLAMP),
  }));

  // Step 2 slides in from right and fades in as stepOffset goes 0 -> 1
  const step2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(stepOffset.value, [0, 1], [MODAL_WIDTH * 0.3, 0], Extrapolation.CLAMP) }],
    opacity: interpolate(stepOffset.value, [0, 0.6, 1], [0, 0.4, 1], Extrapolation.CLAMP),
  }));

  if (!visible) return null;

  // Step indicator dot styles
  const step1Active = step === 1;
  const step2Active = step === 2;

  return (
    <View style={styles.overlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Close session modal"
        accessibilityRole="button"
      />

      {/* Gradient border wrapper — outer LinearGradient + inner solid fill */}
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(140)}
        style={styles.borderWrapper}
      >
        <LinearGradient
          colors={['rgba(59, 130, 246, 0.25)', 'rgba(59, 130, 246, 0.08)', 'rgba(255, 255, 255, 0.06)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBorder}
        >
          <View style={styles.modalContainer} accessible accessibilityLabel="Start session dialog">

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <View style={styles.headerIcon}>
                  <Ionicons name="videocam" size={20} color={Colors.accent.cyan} />
                </View>
                <View>
                  <Text style={styles.headerTitle}>
                    {step === 1 ? 'Start New Session' : 'Add Participants'}
                  </Text>
                  <Text style={styles.headerSubtitle}>
                    {step === 1 ? 'Configure your meeting preferences' : 'Invite your team and guests'}
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.closeButton}
                onPress={onClose}
                accessibilityLabel="Close"
                accessibilityRole="button"
                {...(Platform.OS === 'web' ? { className: 'modal-close-btn' } as Record<string, string> : {})}
              >
                <Ionicons name="close" size={20} color={Colors.text.muted} />
              </Pressable>
            </View>

            {/* Step Indicator */}
            <View style={styles.stepIndicatorRow} accessibilityRole="progressbar" accessibilityLabel={`Step ${step} of 2`}>
              {/* Dot 1 */}
              <View style={[
                styles.stepDot,
                step1Active && styles.stepDotActive,
                step === 2 && styles.stepDotComplete,
              ]}>
                {step === 2 && (
                  <Ionicons name="checkmark" size={7} color="#FFFFFF" accessibilityElementsHidden />
                )}
              </View>

              {/* Connector line */}
              <View style={[
                styles.stepConnector,
                step === 2 && styles.stepConnectorActive,
              ]} />

              {/* Dot 2 */}
              <View style={[
                styles.stepDot,
                step2Active && styles.stepDotActive,
              ]} />

              {/* Step labels */}
              <View style={styles.stepLabels}>
                <Text style={[styles.stepLabel, step1Active && styles.stepLabelActive]}>Configure</Text>
                <Text style={[styles.stepLabel, step2Active && styles.stepLabelActive]}>Invite</Text>
              </View>
            </View>

            {/* Step Content — clipped horizontal slide with crossfade */}
            <View style={styles.contentClip}>
              {/* Step 1: Configure */}
              {step === 1 && (
                <Animated.View style={[{ flex: 1 }, step1Style]}>
                <ScrollView
                  style={styles.scrollBody}
                  contentContainerStyle={styles.scrollBodyContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Meeting Purpose Selection */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Meeting Purpose</Text>
                    <View style={styles.purposeGrid}>
                      {PURPOSE_OPTIONS.map((option) => (
                        <Pressable
                          key={option.id}
                          style={({ pressed }) => [
                            styles.purposeOption,
                            purpose === option.id && styles.purposeOptionActive,
                            pressed && styles.pressedOpacity,
                          ]}
                          onPress={() => onPurposeChange(option.id)}
                          accessibilityLabel={`${option.label} meeting purpose`}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: purpose === option.id }}
                          {...(Platform.OS === 'web' ? { className: 'modal-purpose-opt' } as Record<string, string> : {})}
                        >
                          <View style={[
                            styles.purposeIconBox,
                            purpose === option.id && styles.purposeIconBoxActive,
                          ]}>
                            <Ionicons
                              name={option.icon}
                              size={20}
                              color={purpose === option.id ? '#FFFFFF' : Colors.text.muted}
                            />
                          </View>
                          <Text style={[
                            styles.purposeOptionText,
                            purpose === option.id && styles.purposeOptionTextActive,
                          ]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Participants Section */}
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>Participants</Text>
                      <Text style={styles.participantCount}>{participants.length} added</Text>
                    </View>

                    <View style={styles.participantsContainer}>
                      {participants.map((participant) => (
                        <View key={participant.id} style={styles.participantRow}>
                          <View style={[styles.participantAvatar, { backgroundColor: participant.avatarColor }]}>
                            <Text style={styles.participantInitial}>{participant.name.charAt(0)}</Text>
                          </View>
                          <View style={styles.participantInfo}>
                            <Text style={styles.participantName}>{participant.name}</Text>
                            <Text style={styles.participantRole}>{participant.role}</Text>
                          </View>
                          {/* Status badges */}
                          {participant.status === 'invited' && (
                            <View
                              style={styles.invitedBadge}
                              accessibilityLabel={`${participant.name} invited${participant.inviteType === 'external' ? ', external guest' : participant.inviteType === 'cross-suite' ? ', cross-suite user' : ''}`}
                            >
                              <PulsingDot color={Colors.semantic.warning} />
                              {participant.inviteType === 'external' && (
                                <Ionicons name="globe-outline" size={12} color={Colors.semantic.warning} accessibilityElementsHidden />
                              )}
                              {participant.inviteType === 'cross-suite' && (
                                <Ionicons name="business-outline" size={12} color={Colors.accent.cyan} accessibilityElementsHidden />
                              )}
                              <Text style={styles.invitedBadgeText}>Invited</Text>
                            </View>
                          )}
                          {participant.id === 'you' ? (
                            <View style={styles.youBadge}>
                              <Text style={styles.youBadgeText}>You</Text>
                            </View>
                          ) : (
                            <Pressable
                              style={({ pressed }) => [styles.removeBtn, pressed && styles.pressedOpacity]}
                              onPress={() => onRemoveParticipant(participant.id)}
                              accessibilityLabel={`Remove ${participant.name}`}
                              accessibilityRole="button"
                            >
                              <Ionicons name="close" size={14} color={Colors.text.muted} />
                            </Pressable>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                </ScrollView>
                </Animated.View>
              )}

              {/* Step 2: Invite */}
              {step === 2 && (
                <Animated.View style={[{ flex: 1 }, step2Style]}>
                <ScrollView
                  style={styles.scrollBody}
                  contentContainerStyle={styles.scrollBodyContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Compact participant strip */}
                  {participants.length > 0 && (
                    <View style={styles.participantStrip}>
                      <View style={styles.avatarStrip}>
                        {participants.slice(0, 6).map((p, i) => (
                          <View
                            key={p.id}
                            style={[
                              styles.stripAvatar,
                              { backgroundColor: p.avatarColor, zIndex: 10 - i },
                              i > 0 && { marginLeft: -8 },
                            ]}
                          >
                            <Text style={styles.stripAvatarText}>{p.name.charAt(0)}</Text>
                          </View>
                        ))}
                        {participants.length > 6 && (
                          <View style={[styles.stripAvatar, styles.stripOverflow, { marginLeft: -8 }]}>
                            <Text style={styles.stripOverflowText}>+{participants.length - 6}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.stripLabel}>
                        {participants.length} participant{participants.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}

                  {/* Inline invite tabs */}
                  <InviteTabContent
                    roomName={roomName}
                    hostName={hostName}
                    purpose={purpose}
                    correlationId={correlationId}
                    onInviteMember={onAddParticipant}
                    onInviteGuest={onAddGuest}
                    compact
                  />
                </ScrollView>
                </Animated.View>
              )}
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              {step === 1 ? (
                <>
                  <Pressable
                    style={styles.cancelBtn}
                    onPress={onClose}
                    accessibilityLabel="Cancel"
                    accessibilityRole="button"
                    {...(Platform.OS === 'web' ? { className: 'modal-cancel-btn' } as Record<string, string> : {})}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <PressableScale
                    style={styles.nextBtn}
                    onPress={() => goToStep(2)}
                    accessibilityLabel="Continue to add participants"
                  >
                    <Text style={styles.nextBtnText}>Add Participants</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" accessibilityElementsHidden />
                  </PressableScale>
                </>
              ) : (
                <>
                  <Pressable
                    style={styles.backBtn}
                    onPress={() => goToStep(1)}
                    accessibilityLabel="Back to configure"
                    accessibilityRole="button"
                    {...(Platform.OS === 'web' ? { className: 'modal-back-btn' } as Record<string, string> : {})}
                  >
                    <Ionicons name="arrow-back" size={16} color={Colors.text.secondary} accessibilityElementsHidden />
                    <Text style={styles.backBtnText}>Back</Text>
                  </Pressable>
                  <PressableScale
                    style={[styles.startBtn, isJoining && styles.startBtnDisabled]}
                    onPress={onStartSession}
                    disabled={isJoining}
                    accessibilityLabel={isJoining ? 'Checking conference service' : 'Start session'}
                  >
                    <Ionicons
                      name={isJoining ? 'hourglass' : 'play'}
                      size={16}
                      color="#FFFFFF"
                      accessibilityElementsHidden
                    />
                    <Text style={styles.startBtnText}>
                      {isJoining ? 'Checking...' : 'Start Session'}
                    </Text>
                  </PressableScale>
                </>
              )}
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 100,
    // Backdrop blur for web — frosted glass overlay
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(8px) saturate(1.2)',
      WebkitBackdropFilter: 'blur(8px) saturate(1.2)',
    } as unknown as ViewStyle : {}),
  },

  // Gradient border wrapper — multi-layer premium shadow
  borderWrapper: {
    borderRadius: MODAL_BORDER_RADIUS + 1,
    // Layered shadow: deep ambient + cyan glow halo + tight edge shadow
    boxShadow: [
      '0 32px 80px -16px rgba(0, 0, 0, 0.8)',
      '0 0 60px rgba(59, 130, 246, 0.06)',
      '0 0 1px rgba(255, 255, 255, 0.1)',
    ].join(', '),
  } as ViewStyle,
  gradientBorder: {
    borderRadius: MODAL_BORDER_RADIUS + 1,
    padding: 1,
  },

  // Modal surface — elevated dark glass
  modalContainer: {
    width: MODAL_WIDTH,
    maxWidth: '90%' as unknown as number,
    maxHeight: '85%' as unknown as number,
    backgroundColor: '#111113',
    borderRadius: MODAL_BORDER_RADIUS,
    overflow: 'hidden',
    // Subtle inner glow at top edge for depth
    ...(Platform.OS === 'web' ? {
      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
    } as unknown as ViewStyle : {}),
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  headerTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
  },
  headerSubtitle: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
    ...(Platform.OS === 'web' ? { transition: 'all 0.15s ease', cursor: 'pointer' } as unknown as ViewStyle : {}),
  },

  // Step Indicator
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    position: 'relative',
  },
  stepDot: {
    width: STEP_DOT_SIZE,
    height: STEP_DOT_SIZE,
    borderRadius: STEP_DOT_SIZE / 2,
    backgroundColor: Colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: Colors.accent.cyan,
    // Layered glow: tight ring + diffuse halo
    boxShadow: `0 0 6px ${Colors.accent.cyan}, 0 0 16px ${Colors.accent.cyanLight}`,
  } as ViewStyle,
  stepDotComplete: {
    backgroundColor: Colors.semantic.success,
  },
  stepConnector: {
    width: STEP_CONNECTOR_WIDTH,
    height: STEP_CONNECTOR_HEIGHT,
    backgroundColor: Colors.border.strong,
    marginHorizontal: Spacing.sm,
  },
  stepConnectorActive: {
    backgroundColor: Colors.semantic.success,
  },
  stepLabels: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Spacing.xs,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: STEP_CONNECTOR_WIDTH + STEP_DOT_SIZE + Spacing.lg,
  },
  stepLabel: {
    ...Typography.micro,
    color: Colors.text.muted,
  },
  stepLabelActive: {
    color: Colors.text.primary,
  },

  // Content clip — ensures step content doesn't overflow modal bounds
  contentClip: {
    flex: 1,
    overflow: 'hidden',
  },
  scrollBody: {
    flex: 1,
  },
  scrollBodyContent: {
    padding: Spacing.xxl,
    gap: Spacing.xl,
  },

  // Section layout
  section: {
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    ...Typography.small,
    fontWeight: '600',
    color: Colors.text.secondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  participantCount: {
    ...Typography.small,
    color: Colors.text.muted,
  },

  // Purpose grid
  purposeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm + 2,
  },
  purposeOption: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.background.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    minWidth: 90,
    ...(Platform.OS === 'web' ? { transition: 'all 0.15s ease', cursor: 'pointer' } as unknown as ViewStyle : {}),
  },
  purposeOptionActive: {
    backgroundColor: Colors.accent.blueLight,
    borderColor: Colors.accent.cyanDark,
  },
  purposeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purposeIconBoxActive: {
    backgroundColor: Colors.accent.cyanDark,
  },
  purposeOptionText: {
    ...Typography.small,
    fontWeight: '500',
    color: Colors.text.muted,
  },
  purposeOptionTextActive: {
    color: Colors.text.primary,
  },

  // Participants list (Step 1)
  participantsContainer: {
    gap: Spacing.sm,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.tertiary,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  participantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  participantInitial: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    ...Typography.caption,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  participantRole: {
    ...Typography.micro,
    color: Colors.text.muted,
    marginTop: 1,
  },
  invitedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    marginRight: Spacing.sm,
  },
  invitedBadgeText: {
    ...Typography.micro,
    color: Colors.semantic.warning,
  },
  youBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  youBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent.cyan,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
  },

  // Participant strip (Step 2 — compact header)
  participantStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: Spacing.md,
  },
  avatarStrip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stripAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#111113',
  },
  stripAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stripOverflow: {
    backgroundColor: Colors.background.tertiary,
    borderColor: '#111113',
  },
  stripOverflowText: {
    ...Typography.micro,
    color: Colors.text.muted,
  },
  stripLabel: {
    ...Typography.small,
    color: Colors.text.muted,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
    padding: Spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#0E0E10',
  },
  cancelBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    backgroundColor: Colors.background.secondary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    minHeight: 44,
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { transition: 'all 0.15s ease', cursor: 'pointer' } as unknown as ViewStyle : {}),
  },
  cancelBtnText: {
    ...Typography.caption,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    backgroundColor: Colors.accent.cyanDark,
    boxShadow: '0 4px 16px rgba(37, 99, 235, 0.35), 0 0 0 1px rgba(59, 130, 246, 0.15) inset',
    ...(Platform.OS === 'web' ? { transition: 'all 0.2s ease-out', cursor: 'pointer' } as unknown as ViewStyle : {}),
  } as ViewStyle,
  nextBtnText: {
    ...Typography.caption,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    backgroundColor: Colors.background.secondary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    minHeight: 44,
    ...(Platform.OS === 'web' ? { transition: 'all 0.15s ease', cursor: 'pointer' } as unknown as ViewStyle : {}),
  },
  backBtnText: {
    ...Typography.caption,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    backgroundColor: Colors.accent.cyanDark,
    boxShadow: '0 4px 16px rgba(37, 99, 235, 0.35), 0 0 0 1px rgba(59, 130, 246, 0.15) inset',
    ...(Platform.OS === 'web' ? { transition: 'all 0.2s ease-out', cursor: 'pointer' } as unknown as ViewStyle : {}),
  } as ViewStyle,
  startBtnDisabled: {
    opacity: 0.6,
  },
  startBtnText: {
    ...Typography.caption,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  pressedOpacity: {
    opacity: 0.7,
  },
});
