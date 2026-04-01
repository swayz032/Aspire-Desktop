import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/tokens';
import { Toast } from '@/components/session/Toast';
import { ConfirmationModal } from '@/components/session/ConfirmationModal';
import { FullscreenSessionShell } from '@/components/desktop/FullscreenSessionShell';
import type { RoomAvaState } from '@/components/session/RoomAvaTile';
import { ConferenceChatDrawer, ChatMessage as DrawerChatMessage, MaterialItem as DrawerMaterialItem, AuthorityItem as DrawerAuthorityItem } from '@/components/session/ConferenceChatDrawer';
import { Image } from 'expo-image';
import { useVoice } from '@/hooks/useVoice';
import { useSupabase, useTenant } from '@/providers';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { trackInteraction } from '@/lib/interactionTelemetry';
import { useKeepAwake } from '@/hooks/useKeepAwake';
import { readSSEStream, extractResponseText } from '@/lib/sseStream';
// Zoom Meeting SDK loaded via CDN at runtime (87MB package too large for Metro bundler).
// ZoomMtgEmbedded is accessed from window after script injection.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ZoomClient = any;

const ZOOM_SDK_CDN = 'https://source.zoom.us/5.1.4/zoom-meeting-embedded-5.1.4.min.js';
let _zoomSdkPromise: Promise<any> | null = null;

/** Load Zoom Meeting SDK from CDN. Cached — safe to call multiple times. */
function loadZoomMeetingSdk(): Promise<any> {
  if (_zoomSdkPromise) return _zoomSdkPromise;
  // The embedded SDK exposes window.Zoom.createClient after loading
  if (typeof window !== 'undefined' && (window as any).Zoom?.createClient) {
    return Promise.resolve((window as any).Zoom);
  }

  _zoomSdkPromise = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') return reject(new Error('Not in browser'));

    const script = document.createElement('script');
    script.src = ZOOM_SDK_CDN;
    script.async = true;
    script.onload = () => {
      const ZoomSdk = (window as any).Zoom || (window as any).ZoomMtgEmbedded;
      if (ZoomSdk?.createClient) {
        resolve(ZoomSdk);
      } else {
        reject(new Error('Zoom SDK loaded but createClient not found on window'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Zoom Meeting SDK from CDN'));
    document.head.appendChild(script);
  });

  return _zoomSdkPromise;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
  isPrivate?: boolean;
}

interface MaterialItem {
  id: string;
  name: string;
  type: 'document' | 'note' | 'link';
  sender: string;
  timestamp: Date;
  sensitivity: 'room_safe' | 'internal_sensitive';
  saved: boolean;
}

interface AuthorityItem {
  id: string;
  title: string;
  description: string;
  type: string;
  sensitivity: string;
  requestedBy: string;
  recipients?: string[];
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Nora Tile (overlaid on Zoom UI)
// ---------------------------------------------------------------------------

const avaLogo = require('../../assets/images/ava-logo.png');

function NoraTileOverlay({
  avaState,
  isNoraSpeaking,
  onInnerBoxPress,
}: {
  avaState: RoomAvaState;
  isNoraSpeaking: boolean;
  onInnerBoxPress: () => void;
}) {
  const isActive = avaState === 'listening' || avaState === 'thinking' || avaState === 'speaking';
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isActive) {
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
        ])
      );
      pulseLoopRef.current.start();
    } else {
      if (pulseLoopRef.current) {
        pulseLoopRef.current.stop();
        pulseLoopRef.current = null;
      }
      pulseAnim.setValue(1);
    }
    return () => { if (pulseLoopRef.current) pulseLoopRef.current.stop(); };
  }, [isActive]);

  const getStatusColor = () => {
    switch (avaState) {
      case 'listening': return '#3B82F6';
      case 'speaking': return '#4ade80';
      case 'thinking': return '#A78BFA';
      default: return '#4ade80';
    }
  };

  return (
    <View style={styles.noraTileOverlay}>
      <Pressable
        onPress={onInnerBoxPress}
        style={styles.noraTileContent}
        accessibilityRole="button"
        accessibilityLabel={isNoraSpeaking ? 'Nora is speaking. Tap to stop.' : 'Start Nora voice assistant'}
      >
        <Animated.View
          style={[
            styles.noraInnerGlow,
            {
              transform: [{ scale: pulseAnim }],
              borderColor: isNoraSpeaking ? '#3B82F6' : '#3B82F6',
            },
            Platform.OS === 'web' && {
              boxShadow: isNoraSpeaking
                ? '0 0 12px 4px rgba(0, 255, 255, 0.8), 0 0 25px 8px rgba(79, 172, 254, 0.6)'
                : '0 0 8px 2px rgba(79, 172, 254, 0.6), 0 0 15px 3px rgba(0, 242, 254, 0.4)',
              cursor: 'pointer',
            } as any,
          ]}
        >
          <Image source={avaLogo} style={styles.noraLogo} contentFit="contain" />
        </Animated.View>
        <View style={styles.noraLabelRow}>
          <Text style={styles.noraLabel}>
            {isNoraSpeaking ? 'Nora Speaking...' : 'Nora'}
          </Text>
          <View style={[styles.noraStatusDot, { backgroundColor: isNoraSpeaking ? '#3B82F6' : getStatusColor() }]} />
        </View>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ConferenceLivePage() {
  return (
    <PageErrorBoundary pageName="conference-live">
      <ConferenceLive />
    </PageErrorBoundary>
  );
}

function ConferenceLive() {
  useKeepAwake();
  const router = useRouter();
  const params = useLocalSearchParams();

  // Auth & tenant context (Law #6: Tenant Isolation)
  const { suiteId, session } = useSupabase();
  const { tenant } = useTenant();
  const { authenticatedFetch } = useAuthFetch();

  // ---------------------------------------------------------------------------
  // Zoom Meeting SDK state
  // ---------------------------------------------------------------------------
  const [zoomStatus, setZoomStatus] = useState<'loading' | 'joining' | 'joined' | 'error'>('loading');
  const [zoomError, setZoomError] = useState<string | null>(null);
  const zoomContainerRef = useRef<HTMLDivElement | null>(null);
  const zoomClientRef = useRef<ZoomClient | null>(null);

  // ---------------------------------------------------------------------------
  // Chat, materials, authority state
  // ---------------------------------------------------------------------------
  const [chatVisible, setChatVisible] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [authorityQueue, setAuthorityQueue] = useState<AuthorityItem[]>([]);
  const [avaThinking, setAvaThinking] = useState(false);

  // ---------------------------------------------------------------------------
  // Nora voice
  // ---------------------------------------------------------------------------
  const [avaState, setAvaState] = useState<RoomAvaState>('idle');

  const noraVoice = useVoice({
    agent: 'nora',
    suiteId: suiteId ?? undefined,
    accessToken: session?.access_token,
    userProfile: tenant ? {
      ownerName: tenant.ownerName,
      businessName: tenant.businessName,
      industry: tenant.industry ?? undefined,
      teamSize: tenant.teamSize ?? undefined,
    } : undefined,
    onStatusChange: (voiceStatus) => {
      if (voiceStatus === 'speaking') setAvaState('speaking');
      else if (voiceStatus === 'listening') setAvaState('listening');
      else if (voiceStatus === 'thinking') setAvaState('thinking');
      else setAvaState('idle');
    },
    onResponse: () => {},
    onError: () => { setAvaState('idle'); },
  });

  const isNoraSpeaking = noraVoice.status === 'speaking';

  const handleInnerBoxPress = useCallback(async () => {
    if (noraVoice.isActive) {
      noraVoice.endSession();
    } else {
      try {
        await noraVoice.startSession();
      } catch (_e) {
        showToast('Unable to connect to Nora. Please try again.', 'error');
      }
    }
  }, [noraVoice]);

  // ---------------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------------
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  // ---------------------------------------------------------------------------
  // End call
  // ---------------------------------------------------------------------------
  const [showEndModal, setShowEndModal] = useState(false);

  const handleEndCall = useCallback(async () => {
    trackInteraction('session_end', 'conference-live', { agent: 'nora' });
    setShowEndModal(false);

    // Leave Zoom meeting
    try {
      if (zoomClientRef.current) {
        await zoomClientRef.current.leaveMeeting();
      }
    } catch (_e) {
      // Best-effort leave
    }

    showToast('Session ended. Generating receipt...', 'success');
    setTimeout(() => router.replace('/(tabs)'), 1500);
  }, [router]);

  // ---------------------------------------------------------------------------
  // Zoom Meeting SDK: init + join
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const controller = new AbortController();
    const roomName = (params.roomName as string) || `suite-${suiteId || 'dev'}-conference`;
    const participantName = (params.participantName as string) || 'You';

    let client: ZoomClient | null = null;

    (async () => {
      try {
        // 1. Fetch signature from server
        setZoomStatus('loading');
        const res = await authenticatedFetch('/api/zoom/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName, participantName, suiteId }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`Token endpoint returned ${res.status}`);
        const data = await res.json();
        if (!data.token) throw new Error(data.error || 'No token returned');
        if (controller.signal.aborted) return;

        // 2. Load Meeting SDK via CDN (too large for Metro bundler at 87MB)
        const ZoomMtgEmbedded = await loadZoomMeetingSdk();
        if (controller.signal.aborted || !ZoomMtgEmbedded) throw new Error('Failed to load Zoom Meeting SDK');

        // 3. Create client and init
        client = ZoomMtgEmbedded.createClient();
        zoomClientRef.current = client;

        const container = zoomContainerRef.current;
        if (!container) throw new Error('Zoom container element not found');

        await client.init({
          zoomAppRoot: container,
          language: 'en-US',
          patchJsMedia: true,
          leaveOnPageUnload: true,
          customize: {
            video: {
              isResizable: true,
              viewSizes: {
                default: {
                  width: Math.min(container.clientWidth, 1920),
                  height: Math.min(container.clientHeight, 1080),
                },
              },
            },
            meetingInfo: ['topic', 'host', 'mn', 'pwd', 'telPwd', 'invite', 'participant', 'dc', 'enctype'],
            toolbar: {
              buttons: [
                { text: 'Custom Button', className: 'CustomButton', onClick: () => setChatVisible(v => !v) },
              ],
            },
          },
        });
        if (controller.signal.aborted) return;

        // 4. Join meeting
        setZoomStatus('joining');

        const sdkKey = data.sdkKey || process.env.EXPO_PUBLIC_ZOOM_SDK_KEY || '';
        const meetingNumber = data.meetingNumber || data.topic || roomName;
        const signature = data.signature || data.token;
        const password = data.password || '';

        await client.join({
          signature,
          sdkKey,
          meetingNumber,
          password,
          userName: participantName,
        });

        if (controller.signal.aborted) return;
        setZoomStatus('joined');
        trackInteraction('session_start', 'conference-live', { agent: 'nora', roomName });

      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Conference service unavailable';
        setZoomError(message);
        setZoomStatus('error');
      }
    })();

    return () => {
      controller.abort();
      if (client) {
        client.leaveMeeting().catch(() => {});
      }
      zoomClientRef.current = null;
    };
  }, [suiteId, params.roomName, params.participantName, authenticatedFetch]);

  // ---------------------------------------------------------------------------
  // Chat handler (same SSE streaming to orchestrator)
  // ---------------------------------------------------------------------------
  const handleSendMessage = useCallback(async (text: string, isPrivate: boolean) => {
    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: 'you',
      senderName: 'You',
      text,
      timestamp: new Date(),
      isPrivate,
    };
    setMessages(prev => [...prev, newMessage]);

    if (!isPrivate) return; // Room messages stay local

    setAvaThinking(true);
    try {
      const resp = await fetch('/api/orchestrator/intent?stream=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(suiteId ? { 'X-Suite-Id': suiteId } : {}),
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          agent: 'ava',
          text,
          channel: 'conference_private',
        }),
      });

      if (!resp.ok || !resp.body) {
        const data = await resp.json().catch(() => ({}));
        const avaReply: ChatMessage = {
          id: `msg-ava-${Date.now()}`,
          senderId: 'ava',
          senderName: 'Ava',
          text: data.response || data.text || "I'm having trouble connecting. Try again in a moment.",
          timestamp: new Date(),
          isPrivate: true,
        };
        setMessages(prev => [...prev, avaReply]);
        return;
      }

      await readSSEStream(resp.body, (evt) => {
        if (evt.type === 'response') {
          const avaReply: ChatMessage = {
            id: `msg-ava-${Date.now()}`,
            senderId: 'ava',
            senderName: 'Ava',
            text: extractResponseText(evt),
            timestamp: new Date(),
            isPrivate: true,
          };
          setMessages(prev => [...prev, avaReply]);
        }
      });
    } catch (_err) {
      const avaReply: ChatMessage = {
        id: `msg-ava-err-${Date.now()}`,
        senderId: 'ava',
        senderName: 'Ava',
        text: "I'm having trouble connecting. Let me try again.",
        timestamp: new Date(),
        isPrivate: true,
      };
      setMessages(prev => [...prev, avaReply]);
    } finally {
      setAvaThinking(false);
    }
  }, [suiteId, session?.access_token]);

  // ---------------------------------------------------------------------------
  // Retry handler
  // ---------------------------------------------------------------------------
  const handleRetry = useCallback(() => {
    setZoomError(null);
    setZoomStatus('loading');
    // Re-trigger the effect by forcing a re-mount — simplest approach
    // The useEffect depends on authenticatedFetch which is stable, so we
    // navigate to the same route to force remount.
    const roomName = (params.roomName as string) || `suite-${suiteId || 'dev'}-conference`;
    const participantName = (params.participantName as string) || 'You';
    router.replace({
      pathname: '/session/conference-live',
      params: { roomName, participantName },
    });
  }, [router, params, suiteId]);

  // ---------------------------------------------------------------------------
  // Keyboard shortcut: Alt+H toggles chat
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setChatVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <FullscreenSessionShell showBackButton={false} backLabel="Exit Conference">
      <View style={styles.container}>
        <Toast
          visible={toastVisible}
          message={toastMessage}
          type={toastType}
          onHide={() => setToastVisible(false)}
        />

        {/* Error state (Law #3: Fail Closed) */}
        {zoomStatus === 'error' && (
          <View style={styles.errorContainer}>
            <Ionicons name="videocam-off-outline" size={48} color="#ef4444" />
            <Text style={styles.errorTitle}>Conference Service Unavailable</Text>
            <Text style={styles.errorMessage}>{zoomError}</Text>
            <View style={styles.errorActions}>
              <Pressable
                onPress={handleRetry}
                style={styles.retryButton}
                accessibilityRole="button"
                accessibilityLabel="Retry connection"
              >
                <Text style={styles.retryButtonText}>Retry Connection</Text>
              </Pressable>
              <Pressable
                onPress={() => router.back()}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel="Return to lobby"
              >
                <Text style={styles.backButtonText}>Return to Lobby</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Loading state */}
        {(zoomStatus === 'loading' || zoomStatus === 'joining') && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>
              {zoomStatus === 'loading' ? 'Connecting to conference...' : 'Joining meeting...'}
            </Text>
          </View>
        )}

        {/* Zoom Meeting SDK container — always mounted so ref is available */}
        {Platform.OS === 'web' && (
          <div
            ref={(el) => { zoomContainerRef.current = el; }}
            id="meetingSDKElement"
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              display: zoomStatus === 'error' ? 'none' : 'block',
            }}
          />
        )}

        {/* Nora tile overlay — bottom-left corner on top of Zoom UI */}
        {zoomStatus === 'joined' && (
          <NoraTileOverlay
            avaState={avaState}
            isNoraSpeaking={isNoraSpeaking}
            onInnerBoxPress={handleInnerBoxPress}
          />
        )}

        {/* Chat toggle button — top-right overlay */}
        {zoomStatus === 'joined' && (
          <View style={styles.chatToggleOverlay}>
            <Pressable
              style={[styles.chatToggleButton, chatVisible && styles.chatToggleButtonActive]}
              onPress={() => setChatVisible(!chatVisible)}
              accessibilityRole="button"
              accessibilityLabel={chatVisible ? 'Close chat' : 'Open chat'}
            >
              <Ionicons
                name="chatbubble"
                size={20}
                color={chatVisible ? Colors.accent.cyan : '#fff'}
              />
              {messages.length > 0 && (
                <View style={styles.chatBadge}>
                  <Text style={styles.chatBadgeText}>{messages.length}</Text>
                </View>
              )}
            </Pressable>
          </View>
        )}

        {/* Leave button — bottom-right overlay */}
        {zoomStatus === 'joined' && (
          <View style={styles.leaveOverlay}>
            <Pressable
              style={styles.leaveButton}
              onPress={() => setShowEndModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Leave conference"
            >
              <Text style={styles.leaveButtonText}>Leave</Text>
            </Pressable>
          </View>
        )}

        {/* Chat drawer */}
        <ConferenceChatDrawer
          visible={chatVisible}
          onClose={() => setChatVisible(false)}
          messages={messages as DrawerChatMessage[]}
          materials={materials as DrawerMaterialItem[]}
          avaThinking={avaThinking}
          onSendMessage={handleSendMessage}
          onSaveMaterial={(id: string) => {
            setMaterials(prev => prev.map(m => m.id === id ? { ...m, saved: true } : m));
          }}
          authorityQueue={authorityQueue as DrawerAuthorityItem[]}
          onApproveAuthority={(id: string) => {
            setAuthorityQueue(prev => prev.filter(a => a.id !== id));
          }}
          onDenyAuthority={(id: string) => {
            setAuthorityQueue(prev => prev.filter(a => a.id !== id));
          }}
        />

        {/* End session confirmation */}
        <ConfirmationModal
          visible={showEndModal}
          onClose={() => setShowEndModal(false)}
          onConfirm={handleEndCall}
          title="End Session"
          message="Are you sure you want to end this session? A receipt will be generated with the transcript."
          confirmLabel="End Session"
          destructive
          icon="call"
        />
      </View>
    </FullscreenSessionShell>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  // Error state
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  errorMessage: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 400,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#2563EB',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#1f2937',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  // Loading state
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  // Nora tile overlay
  noraTileOverlay: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    zIndex: 100,
  },
  noraTileContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      } as any,
      default: {},
    }),
  },
  noraInnerGlow: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  noraLogo: {
    width: 56,
    height: 56,
  },
  noraLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  noraLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 0.3,
  },
  noraStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // Chat toggle overlay
  chatToggleOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 100,
  },
  chatToggleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  chatToggleButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  chatBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.accent.cyan,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  chatBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000',
  },
  // Leave overlay
  leaveOverlay: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    zIndex: 100,
  },
  leaveButton: {
    backgroundColor: Colors.semantic.error,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  leaveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
