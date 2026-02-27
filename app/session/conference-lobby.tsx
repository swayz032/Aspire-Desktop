import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable, ScrollView, Image, ImageBackground, ViewStyle, LayoutAnimation, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Typography, BorderRadius, Canvas } from '@/constants/tokens';
import { Toast } from '@/components/session/Toast';
import { BottomSheet } from '@/components/session/BottomSheet';
import { DocumentThumbnail } from '@/components/DocumentThumbnail';
import {
  SessionPurpose,
} from '@/data/session';
import { useDesktop } from '@/lib/useDesktop';
import { useSupabase, useTenant } from '@/providers';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { formatDisplayId } from '@/lib/formatters';
import { FullscreenSessionShell } from '@/components/desktop/FullscreenSessionShell';
import { UnifiedSessionModal } from '@/components/session/UnifiedSessionModal';

// ─── Pulsing dot for pending/invited participants ────────────────────────────
function PulsingDot({ color }: { color: string }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }, animStyle]}
      accessibilityElementsHidden
    />
  );
}

// ─── Web-only hover & animation CSS ─────────────────────────────────────────

function injectLobbyKeyframes() {
  if (Platform.OS !== 'web') return;
  if (document.getElementById('aspire-lobby-keyframes')) return;
  const style = document.createElement('style');
  style.id = 'aspire-lobby-keyframes';
  style.textContent = `
    @keyframes lobbyStartGlow {
      0%, 100% { box-shadow: 0 4px 20px rgba(37, 99, 235, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset; }
      50% { box-shadow: 0 4px 28px rgba(37, 99, 235, 0.55), 0 0 40px rgba(59, 130, 246, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.15) inset; }
    }
    .lobby-start-btn {
      animation: lobbyStartGlow 2.8s ease-in-out infinite;
      transition: transform 0.2s ease, box-shadow 0.2s ease !important;
      cursor: pointer;
    }
    .lobby-start-btn:hover {
      transform: translateY(-2px) !important;
      box-shadow: 0 6px 32px rgba(37, 99, 235, 0.55), 0 0 48px rgba(59, 130, 246, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.2) inset !important;
      animation: none;
    }
    .lobby-start-btn:active {
      transform: translateY(0) scale(0.98) !important;
    }
    .lobby-join-btn {
      transition: transform 0.2s ease, box-shadow 0.2s ease !important;
      cursor: pointer;
    }
    .lobby-join-btn:hover {
      transform: translateY(-1px) !important;
      box-shadow: 0 6px 24px rgba(37, 99, 235, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.15) inset !important;
    }
    .lobby-join-btn:active {
      transform: translateY(0) scale(0.98) !important;
    }
    .lobby-flip-card {
      transition: box-shadow 0.3s ease !important;
    }
    .lobby-flip-card:hover {
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.06) inset !important;
    }
    .lobby-authority-card {
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease !important;
      cursor: default;
    }
    .lobby-authority-card:hover {
      transform: translateY(-2px) !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3) !important;
      border-color: ${Colors.border.strong} !important;
    }
    .lobby-approve-btn {
      transition: all 0.15s ease !important;
      cursor: pointer;
    }
    .lobby-approve-btn:hover {
      box-shadow: 0 4px 16px rgba(37, 99, 235, 0.35) !important;
      transform: translateY(-1px);
    }
    .lobby-approve-btn:active {
      transform: translateY(0) scale(0.97);
    }
    .lobby-deny-btn {
      transition: all 0.15s ease !important;
      cursor: pointer;
    }
    .lobby-deny-btn:hover {
      background-color: ${Colors.background.elevated} !important;
      border-color: ${Colors.border.strong} !important;
    }
    .lobby-exit-btn {
      transition: all 0.15s ease !important;
      cursor: pointer;
    }
    .lobby-exit-btn:hover {
      background-color: ${Colors.background.elevated} !important;
      border-color: ${Colors.border.strong} !important;
      transform: scale(1.05);
    }
    .lobby-exit-btn:active { transform: scale(0.95); }
    .lobby-menu-btn {
      transition: all 0.15s ease !important;
      cursor: pointer;
    }
    .lobby-menu-btn:hover {
      background-color: ${Colors.background.elevated} !important;
      border-color: ${Colors.border.strong} !important;
      transform: scale(1.05);
    }
    .lobby-menu-btn:active { transform: scale(0.95); }
  `;
  document.head.appendChild(style);
}

const CONFERENCE_ROOM_IMAGE = require('@/assets/images/conference-room-meeting.jpg');
const TEAM_MEETING_IMAGE = require('@/assets/images/executive-conference.jpg');
const NORA_AVATAR = require('@/assets/images/nora-avatar.png');

const PURPOSE_OPTIONS: { id: SessionPurpose; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'Internal', label: 'Internal', icon: 'business' },
  { id: 'Client Call', label: 'Client', icon: 'person' },
  { id: 'Vendor Call', label: 'Vendor', icon: 'storefront' },
  { id: 'Deal Review', label: 'Deal', icon: 'briefcase' },
  { id: 'Networking', label: 'Network', icon: 'people' },
];

const MENU_OPTIONS = [
  { id: 'settings', label: 'Room Settings', icon: 'settings' as const },
  { id: 'schedule', label: 'Schedule for Later', icon: 'calendar' as const },
  { id: 'copy-link', label: 'Copy Meeting Link', icon: 'link' as const },
];

interface Participant {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  status: 'ready' | 'invited' | 'joining';
  inviteType?: 'internal' | 'cross-suite' | 'external';
}

interface AuthorityItem {
  id: string;
  title: string;
  description: string;
  risk: 'Low' | 'Medium' | 'High';
  status: 'pending' | 'approved' | 'denied';
  documentName?: string;
  documentType?: 'invoice' | 'contract' | 'report' | 'document' | 'recording';
  thumbnailImage?: any;
  icon: keyof typeof Ionicons.glyphMap;
}

// Authority items loaded from Supabase approval_requests — starts empty
const INITIAL_AUTHORITY_QUEUE: AuthorityItem[] = [];

const getRiskConfig = (risk: AuthorityItem['risk']) => {
  switch (risk) {
    case 'High':
      return { color: Colors.semantic.error, bg: 'rgba(239, 68, 68, 0.12)' };
    case 'Medium':
      return { color: Colors.semantic.warning, bg: 'rgba(245, 158, 11, 0.12)' };
    case 'Low':
      return { color: Colors.semantic.success, bg: 'rgba(52, 199, 89, 0.12)' };
  }
};

export default function ConferenceLobby() {
  const router = useRouter();
  const isDesktop = useDesktop();
  const { session, suiteId } = useSupabase();
  const { tenant } = useTenant();
  const { authenticatedFetch } = useAuthFetch();

  // Inject web hover CSS once
  useEffect(() => { injectLobbyKeyframes(); }, []);

  const userName = session?.user?.user_metadata?.full_name
    ?? session?.user?.email?.split('@')[0]
    ?? 'You';
  const suiteLabel = `Suite ${formatDisplayId(tenant?.displayId, suiteId)}` || 'Conference Room';

  const [purpose, setPurpose] = useState<SessionPurpose>('Internal');
  const [participants, setParticipants] = useState<Participant[]>([
    { id: 'you', name: userName, role: 'Founder', avatarColor: Colors.accent.cyan, status: 'ready' },
  ]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [authorityItems, setAuthorityItems] = useState<AuthorityItem[]>(INITIAL_AUTHORITY_QUEUE);
  
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  
  const [showStartSessionModal, setShowStartSessionModal] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isConferenceReady, setIsConferenceReady] = useState<boolean | null>(null);
  const conferenceCheckTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const flipProgress = useSharedValue(0);

  // Sync animation with state - single source of truth
  // Slower, smoother rotation for premium feel
  useEffect(() => {
    flipProgress.value = withSpring(isSessionActive ? 1 : 0, {
      damping: 25,
      stiffness: 30,
      mass: 1.5,
    });
  }, [isSessionActive]);

  const toggleFlip = () => {
    setIsSessionActive(prev => !prev);
  };

  // Front card animated style - rotates from 0 to -180 degrees (vertical flip)
  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateX = interpolate(
      flipProgress.value,
      [0, 1],
      [0, -180],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { rotateX: `${rotateX}deg` },
      ],
      backfaceVisibility: 'hidden' as const,
    };
  });

  // Back card animated style - rotates from 180 to 0 degrees
  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateX = interpolate(
      flipProgress.value,
      [0, 1],
      [180, 0],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { rotateX: `${rotateX}deg` },
      ],
      backfaceVisibility: 'hidden' as const,
    };
  });


  // Arrow rotation follows flip
  const arrowAnimatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      flipProgress.value,
      [0, 1],
      [0, 180],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ rotate: `${rotate}deg` }],
    };
  });

  const roomName = `suite-${suiteId || 'dev'}-conference`;

  // Session-level correlation ID for tracing all conference actions
  // Generated once per component mount, threaded through InviteSheet → API calls → receipts
  const [correlationId] = useState(() => {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID
    return `conf-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  });

  // Pre-join validation: check if LiveKit is configured before starting a session
  // Law #3: Fail Closed — 5s timeout prevents indefinite hang
  const checkConferenceReady = async (): Promise<boolean> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    // Store timeout ID in ref so unmount cleanup can clear it
    conferenceCheckTimeoutRef.current = timeoutId;
    try {
      setIsJoining(true);
      const resp = await authenticatedFetch('/api/livekit/status', {
        signal: controller.signal,
      });
      if (!resp.ok) {
        showToast('Conference service is not available', 'error');
        return false;
      }
      const data = await resp.json();
      setIsConferenceReady(data.configured);
      if (!data.configured) {
        showToast('Conference service is not available', 'error');
        return false;
      }
      return true;
    } catch {
      showToast('Conference service is not available', 'error');
      return false;
    } finally {
      clearTimeout(timeoutId);
      conferenceCheckTimeoutRef.current = null;
      setIsJoining(false);
    }
  };

  // Cleanup timer on unmount to prevent orphaned setTimeout
  useEffect(() => {
    return () => {
      if (conferenceCheckTimeoutRef.current) {
        clearTimeout(conferenceCheckTimeoutRef.current);
      }
    };
  }, []);

  const handleStartNewSession = () => {
    setShowStartSessionModal(true);
  };

  const handleConfirmStartSession = async () => {
    const ready = await checkConferenceReady();
    if (!ready) return;
    setShowStartSessionModal(false);
    setIsSessionActive(true);
    showToast('Session started successfully', 'success');
  };

  const handleEndSession = () => {
    setIsSessionActive(false);
    showToast('Session ended', 'info');
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  // handleAddMember is now handled by InviteSheet callbacks

  const handleRemoveParticipant = (id: string) => {
    if (id !== 'you') {
      const participant = participants.find(p => p.id === id);
      if (Platform.OS !== 'web') {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      setParticipants(participants.filter(p => p.id !== id));
      showToast(`${participant?.name} removed`, 'info');
    }
  };

  const handleApprove = (itemId: string) => {
    const item = authorityItems.find(i => i.id === itemId);
    setAuthorityItems(prev => prev.map(i => 
      i.id === itemId ? { ...i, status: 'approved' as const } : i
    ));
    showToast(`Approved: ${item?.title}`, 'success');
  };

  const handleDeny = (itemId: string) => {
    const item = authorityItems.find(i => i.id === itemId);
    setAuthorityItems(prev => prev.map(i => 
      i.id === itemId ? { ...i, status: 'denied' as const } : i
    ));
    showToast(`Denied: ${item?.title}`, 'error');
  };

  const handleMenuSelect = (optionId: string) => {
    switch (optionId) {
      case 'settings':
        showToast('Room settings', 'info');
        break;
      case 'schedule':
        showToast('Schedule meeting for later', 'info');
        break;
      case 'copy-link':
        showToast('Meeting link copied!', 'success');
        break;
    }
  };

  const handleStartSession = async () => {
    const ready = await checkConferenceReady();
    if (!ready) return;
    router.push({
      pathname: '/session/conference-live' as any,
      params: {
        purpose,
        roomName,
        participantIds: participants.map(p => p.id).join(','),
      }
    });
  };

  const pendingCount = authorityItems.filter(i => i.status === 'pending').length;

  const lobbyContent = (
    <SafeAreaView style={styles.container}>
      <Toast 
        visible={toastVisible} 
        message={toastMessage} 
        type={toastType}
        onHide={() => setToastVisible(false)} 
      />

      {/* Header Bar */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push('/(tabs)')}
          style={({ pressed }) => [styles.exitButton, pressed && styles.pressedOpacity]}
          accessibilityLabel="Exit conference lobby"
          accessibilityRole="button"
          {...(Platform.OS === 'web' ? { className: 'lobby-exit-btn' } as Record<string, string> : {})}
        >
          <Ionicons name="close" size={20} color={Colors.text.secondary} />
        </Pressable>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Conference Room</Text>
          <Text style={styles.headerSubtitle}>{suiteLabel} • Room CR-01</Text>
        </View>
        
        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [styles.menuButton, pressed && styles.pressedOpacity]}
            onPress={() => setMenuVisible(true)}
            accessibilityLabel="Open room options"
            accessibilityRole="button"
            {...(Platform.OS === 'web' ? { className: 'lobby-menu-btn' } as Record<string, string> : {})}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={Colors.text.secondary} />
          </Pressable>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
        {/* Large Visual Preview - Flip Card with Idle/Live Modes */}
        <View style={styles.lobbyVisual}>
          {/* Premium Arrow - Toggle between idle/live modes */}
          <View style={styles.sessionNavigator}>
            <Pressable 
              style={styles.navArrow} 
              onPress={toggleFlip}
            >
              <Animated.View style={arrowAnimatedStyle}>
                <Ionicons name="chevron-up" size={20} color="rgba(255,255,255,0.5)" />
              </Animated.View>
            </Pressable>
          </View>
          
          <View style={styles.flipCardContainer}>

            {/* FRONT CARD - Idle Mode (Team Meeting Image + Start Session) */}
            <Animated.View
              style={[
                styles.flipCard,
                styles.flipCardFront,
                frontAnimatedStyle
              ]}
              pointerEvents={isSessionActive ? 'none' : 'auto'}
              {...(Platform.OS === 'web' ? { className: 'lobby-flip-card' } as Record<string, string> : {})}
            >
              <View style={styles.sessionPreviewCard}>
                <ImageBackground 
                  source={TEAM_MEETING_IMAGE}
                  style={styles.sessionImageBackground}
                  imageStyle={styles.sessionImage}
                >
                  <LinearGradient
                    colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.7)']}
                    style={styles.sessionGradientOverlay}
                  >
                    {/* Top Row: Ready Badge */}
                    <View style={styles.sessionTopRow}>
                      <View style={styles.readyBadge}>
                        <Ionicons name="radio-button-on" size={12} color={Colors.accent.cyan} />
                        <Text style={styles.readyBadgeText}>READY</Text>
                      </View>
                      <View style={styles.noraAIBadge}>
                        <Image source={NORA_AVATAR} style={styles.noraAvatar} />
                        <Text style={styles.noraAIText}>Nora Available</Text>
                      </View>
                    </View>

                    {/* Idle Mode Details */}
                    <View style={styles.sessionDetails}>
                      <Text style={styles.sessionMeetingTitle}>Conference Room</Text>
                      <Text style={styles.sessionLocation}>{suiteLabel} • Room CR-01</Text>
                      
                      <View style={styles.idleInfoRow}>
                        <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.6)" />
                        <Text style={styles.idleInfoText}>No active session</Text>
                      </View>
                      
                      <Text style={styles.idleSubtext}>
                        Start a session to collaborate with your team
                      </Text>
                    </View>

                    {/* Start Session Button */}
                    <Pressable
                      style={styles.joinButton}
                      onPress={handleStartNewSession}
                      accessibilityLabel="Start new session"
                      accessibilityRole="button"
                      {...(Platform.OS === 'web' ? { className: 'lobby-start-btn' } as Record<string, string> : {})}
                    >
                      <Ionicons name="play" size={16} color="#FFFFFF" />
                      <Text style={styles.joinButtonText}>Start Session</Text>
                    </Pressable>
                  </LinearGradient>
                </ImageBackground>
              </View>
            </Animated.View>

            {/* BACK CARD - Live Mode (Meeting Room + Join Session) */}
            <Animated.View
              style={[
                styles.flipCard,
                styles.flipCardBack,
                backAnimatedStyle
              ]}
              pointerEvents={isSessionActive ? 'auto' : 'none'}
              {...(Platform.OS === 'web' ? { className: 'lobby-flip-card' } as Record<string, string> : {})}
            >
              <View style={styles.sessionPreviewCard}>
                <ImageBackground 
                  source={CONFERENCE_ROOM_IMAGE}
                  style={styles.sessionImageBackground}
                  imageStyle={styles.sessionImage}
                >
                  <LinearGradient
                    colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.7)']}
                    style={styles.sessionGradientOverlay}
                  >
                    {/* Top Row: Status Badges */}
                    <View style={styles.sessionTopRow}>
                      <View style={styles.liveBadge}>
                        <View style={styles.liveDotPulse} />
                        <Text style={styles.liveBadgeText}>LIVE</Text>
                      </View>
                      <View style={styles.noraAIBadge}>
                        <Image source={NORA_AVATAR} style={styles.noraAvatar} />
                        <Text style={styles.noraAIText}>Nora Active</Text>
                      </View>
                    </View>

                    {/* Meeting Details - Bottom Section */}
                    <View style={styles.sessionDetails}>
                      <Text style={styles.sessionMeetingTitle}>{purpose} Session</Text>
                      <Text style={styles.sessionLocation}>{suiteLabel} • Room CR-01</Text>
                      
                      {/* Participants */}
                      <View style={styles.sessionParticipantsRow}>
                        <View style={styles.avatarStack}>
                          <View style={[styles.stackedAvatar, { backgroundColor: Colors.accent.cyan, zIndex: 4 }]}>
                            <Text style={styles.stackedAvatarText}>M</Text>
                          </View>
                          {participants.slice(1, 3).map((p, i) => (
                            <View 
                              key={p.id} 
                              style={[
                                styles.stackedAvatar, 
                                { backgroundColor: i === 0 ? '#8B5CF6' : '#3B82F6', marginLeft: -8, zIndex: 3 - i }
                              ]}
                            >
                              <Text style={styles.stackedAvatarText}>{p.name.charAt(0)}</Text>
                            </View>
                          ))}
                        </View>
                        <Text style={styles.participantLabel}>
                          {participants.length} participant{participants.length !== 1 ? 's' : ''} ready
                        </Text>
                      </View>

                      {/* Agenda Preview */}
                      <View style={styles.agendaPreview}>
                        <Text style={styles.agendaPreviewText}>
                          Nora is ready to transcribe and take notes
                        </Text>
                      </View>
                    </View>

                    {/* Join Button */}
                    <Pressable
                      style={[styles.joinButton, isJoining && { opacity: 0.6 }]}
                      onPress={handleStartSession}
                      disabled={isJoining}
                      accessibilityLabel={isJoining ? 'Checking conference status' : 'Join session'}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: isJoining }}
                      {...(Platform.OS === 'web' ? { className: 'lobby-join-btn' } as Record<string, string> : {})}
                    >
                      <Ionicons name={isJoining ? "hourglass" : "videocam"} size={16} color="#FFFFFF" />
                      <Text style={styles.joinButtonText}>{isJoining ? 'Checking...' : 'Join Session'}</Text>
                    </Pressable>
                  </LinearGradient>
                </ImageBackground>
              </View>
            </Animated.View>
          </View>
        </View>

        {/* Full Width Authority Queue Section */}
        <View style={styles.authoritySection}>
          <View style={styles.authorityHeader}>
            <View style={styles.authorityTitleRow}>
              <View style={styles.authorityIconContainer}>
                <Ionicons name="shield-checkmark" size={20} color={Colors.accent.cyan} />
              </View>
              <View>
                <Text style={styles.authorityTitle}>Pre-Session Approvals</Text>
                <Text style={styles.authoritySubtitle}>Documents requiring your authorization</Text>
              </View>
            </View>
            {pendingCount > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingCount} pending</Text>
              </View>
            )}
          </View>

          {/* Authority Queue - Horizontal Scrollable */}
          {authorityItems.length === 0 ? (
            <View style={styles.authorityEmptyState}>
              <Ionicons name="checkmark-circle-outline" size={28} color={Colors.accent.cyan} style={{ marginBottom: Spacing.sm }} accessibilityElementsHidden />
              <Text style={styles.authorityEmptyTitle}>No approvals needed</Text>
              <Text style={styles.authorityEmptySubtitle}>
                When documents or actions need your sign-off before the session, they'll appear here.
              </Text>
            </View>
          ) : (
          <View style={styles.authorityScrollRow}>
            {authorityItems.map((item, index) => {
              const riskConfig = getRiskConfig(item.risk);
              const isPending = item.status === 'pending';
              
              return (
                <View
                  key={item.id}
                  style={[
                    styles.authorityCard,
                    !isPending && styles.authorityCardResolved,
                  ]}
                  {...(Platform.OS === 'web' ? { className: 'lobby-authority-card' } as Record<string, string> : {})}
                >
                  <View style={styles.authorityCardContent}>
                    {/* Document Thumbnail, Image, or Icon */}
                    <View style={styles.authorityVisual}>
                      {item.thumbnailImage ? (
                        <Image 
                          source={item.thumbnailImage} 
                          style={styles.authorityThumbnailImage}
                          resizeMode="cover"
                        />
                      ) : item.documentType ? (
                        <DocumentThumbnail 
                          type={item.documentType} 
                          size="lg" 
                          variant={index}
                          context="conference"
                        />
                      ) : (
                        <View style={styles.authorityIconBox}>
                          <Ionicons name={item.icon} size={24} color={Colors.accent.cyan} />
                        </View>
                      )}
                    </View>
                    
                    {/* Card Info */}
                    <View style={styles.authorityCardInfo}>
                      <View style={styles.authorityCardTop}>
                        <Text style={styles.authorityCardTitle} numberOfLines={1}>{item.title}</Text>
                        <View style={[styles.riskBadge, { backgroundColor: riskConfig.bg }]}>
                          <Text style={[styles.riskText, { color: riskConfig.color }]}>{item.risk}</Text>
                        </View>
                      </View>
                      <Text style={styles.authorityCardDesc} numberOfLines={2}>{item.description}</Text>
                      {item.documentName && (
                        <View style={styles.documentTag}>
                          <Ionicons name="document-attach" size={12} color={Colors.text.muted} />
                          <Text style={styles.documentName}>{item.documentName}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Actions */}
                  {isPending ? (
                    <View style={styles.authorityActions}>
                      <Pressable
                        style={styles.denyBtn}
                        onPress={() => handleDeny(item.id)}
                        accessibilityLabel={`Deny ${item.title}`}
                        accessibilityRole="button"
                        {...(Platform.OS === 'web' ? { className: 'lobby-deny-btn' } as Record<string, string> : {})}
                      >
                        <Ionicons name="close-circle-outline" size={16} color={Colors.text.secondary} />
                        <Text style={styles.denyText}>Deny</Text>
                      </Pressable>
                      <Pressable
                        style={styles.approveBtn}
                        onPress={() => handleApprove(item.id)}
                        accessibilityLabel={`Approve ${item.title}`}
                        accessibilityRole="button"
                        {...(Platform.OS === 'web' ? { className: 'lobby-approve-btn' } as Record<string, string> : {})}
                      >
                        <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                        <Text style={styles.approveText}>Approve</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.resolvedStatus}>
                      <Ionicons 
                        name={item.status === 'approved' ? 'checkmark-circle' : 'close-circle'} 
                        size={16} 
                        color={item.status === 'approved' ? '#2563EB' : Colors.text.muted} 
                      />
                      <Text style={[
                        styles.resolvedText,
                        { color: item.status === 'approved' ? '#2563EB' : Colors.text.muted }
                      ]}>
                        {item.status === 'approved' ? 'Approved' : 'Denied'}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          )}
        </View>
        </View>

      </ScrollView>

      {/* Unified Start Session + Invite Modal (replaces old inline modal + InviteSheet) */}
      <UnifiedSessionModal
        visible={showStartSessionModal}
        onClose={() => setShowStartSessionModal(false)}
        onStartSession={handleConfirmStartSession}
        isJoining={isJoining}
        purpose={purpose}
        onPurposeChange={setPurpose}
        participants={participants}
        onAddParticipant={(userId, name, inviteType) => {
          if (!participants.find(p => p.id === userId)) {
            if (Platform.OS !== 'web') {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            }
            setParticipants(prev => [...prev, {
              id: userId,
              name,
              role: 'Member',
              avatarColor: inviteType === 'cross-suite' ? '#3B82F6' : '#8B5CF6',
              status: 'invited',
              inviteType: inviteType || 'internal',
            }]);
            showToast(`${name} invited`, 'success');
          }
        }}
        onAddGuest={(name, contact) => {
          const guestId = `guest-${Date.now()}`;
          if (Platform.OS !== 'web') {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          }
          setParticipants(prev => [...prev, {
            id: guestId,
            name,
            role: contact || 'External Guest',
            avatarColor: '#10B981',
            status: 'invited',
            inviteType: 'external',
          }]);
          showToast(`${name} invited`, 'success');
        }}
        onRemoveParticipant={handleRemoveParticipant}
        roomName={roomName}
        hostName={userName}
        correlationId={correlationId}
      />

      <BottomSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        title="Options"
        options={MENU_OPTIONS}
        onSelect={handleMenuSelect}
      />
    </SafeAreaView>
  );

  if (isDesktop) {
    return (
      <FullscreenSessionShell showBackButton={false} backLabel="Exit Lobby">
        {lobbyContent}
      </FullscreenSessionShell>
    );
  }

  return lobbyContent;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  exitButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 2,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 1240,
    paddingHorizontal: 32,
    paddingTop: 28,
    paddingBottom: 40,
  },

  // Lobby Visual - The Focal Point
  lobbyVisual: {
    marginBottom: 32,
  },
  
  // Session Navigator (Premium Invisible Arrow)
  sessionNavigator: {
    alignItems: 'center',
    marginBottom: 8,
  },
  navArrow: {
    padding: 8,
  },
  
  // Flip Card Container
  flipCardContainer: {
    position: 'relative',
    height: 360,
  },
  flipCard: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
    borderRadius: 16,
    overflow: 'hidden',
  },
  flipCardFront: {
    zIndex: 2,
  },
  flipCardBack: {
    zIndex: 1,
  },
  // 3D Block Depth Strip (visible during flip) - creates block thickness
  
  // Session Preview Card with Image
  sessionPreviewCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.03) inset',
  } as ViewStyle,
  sessionImageBackground: {
    height: 360,
  },
  sessionImage: {
    borderRadius: 15,
  },
  sessionGradientOverlay: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  sessionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 100, 100, 0.4)',
    boxShadow: '0 0 20px rgba(220, 38, 38, 0.6), 0 0 40px rgba(220, 38, 38, 0.3), 0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
  } as ViewStyle,
  liveDotPulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 0 6px #FFFFFF, 0 0 12px rgba(255, 255, 255, 0.8), 0 0 20px rgba(255, 100, 100, 0.6)',
  } as ViewStyle,
  liveBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
    boxShadow: '0 4px 16px rgba(6, 182, 212, 0.2), 0 0 0 1px rgba(6, 182, 212, 0.1) inset',
  } as ViewStyle,
  readyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent.cyan,
    letterSpacing: 1,
  },
  noraAIBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
    paddingRight: 14,
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
  },
  noraAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  noraAIText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent.cyan,
    letterSpacing: 0.5,
  },
  sessionDetails: {
    gap: 8,
  },
  sessionMeetingTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  sessionLocation: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
  },
  sessionParticipantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackedAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.5)',
  },
  stackedAvatarText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  participantLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  agendaPreview: {
    marginTop: 6,
  },
  agendaPreviewText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 18,
  },
  joinButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    boxShadow: '0 4px 20px rgba(37, 99, 235, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
  } as ViewStyle,
  joinButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  idleInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  idleInfoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  idleSubtext: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 8,
    lineHeight: 18,
  },
  // Authority Section (Full Width)
  authoritySection: {
    marginBottom: 32,
    backgroundColor: Colors.background.secondary,
    borderRadius: 16,
    paddingTop: 24,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  authorityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  authorityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authorityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  authoritySubtitle: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 2,
  },
  pendingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 12,
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.semantic.warning,
  },
  authorityScrollContent: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 24,
  },
  authorityCard: {
    width: 300,
    minWidth: 300,
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  authorityCardResolved: {
    opacity: 0.7,
  },
  authorityCardContent: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
  },
  authorityVisual: {
    flexShrink: 0,
  },
  authorityThumbnailImage: {
    width: 72,
    height: 92,
    borderRadius: 8,
  },
  authorityIconBox: {
    width: 72,
    height: 92,
    borderRadius: 8,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.15)',
  },
  authorityCardInfo: {
    flex: 1,
  },
  authorityCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  authorityCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
    marginRight: 8,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  riskText: {
    fontSize: 10,
    fontWeight: '600',
  },
  authorityCardDesc: {
    fontSize: 12,
    color: '#FFFFFF',
    lineHeight: 16,
    marginBottom: 6,
  },
  documentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  documentName: {
    fontSize: 11,
    color: '#FFFFFF',
  },
  authorityActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    paddingTop: 12,
  },
  denyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  denyText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
  } as ViewStyle,
  approveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resolvedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  resolvedText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Shared pressed feedback — opacity 0.7 per design spec
  pressedOpacity: {
    opacity: 0.7,
  },

  // Authority empty state (replaces inline styles)
  authorityEmptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xxl,
  },
  authorityEmptyTitle: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  authorityEmptySubtitle: {
    ...Typography.small,
    color: Colors.text.muted,
    textAlign: 'center',
    lineHeight: 17,
  },

  // Authority horizontal scroll row (replaces inline styles)
  authorityScrollRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    paddingLeft: Spacing.xxl,
    paddingRight: Spacing.xxl,
    paddingBottom: Spacing.sm,
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollbarWidth: 'thin',
    scrollbarColor: `${Colors.border.strong} transparent`,
  } as ViewStyle,
});
