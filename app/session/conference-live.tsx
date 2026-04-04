/**
 * Conference Live — Production video conference page.
 *
 * Composes Zoom SDK components + Aspire UI:
 * - ConferenceHeader: room name, timer, participants, recording, network
 * - Video Grid: ZoomVideoTile (Zoom SDK) + NoraTile (AI participant)
 * - ConferenceControlBar: mic, camera, share, record, chat, people, view, leave
 * - ConferenceChatDrawer: existing 3-tab chat (Room/Materials/Ava)
 * - ConferenceParticipantsPanel: participant list with status
 *
 * Keyboard shortcuts: Alt+M (mic), Alt+V (camera), Alt+S (share),
 * Alt+R (record), Alt+H (chat), Alt+P (people), Alt+L (view layout).
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/tokens';
import { Toast } from '@/components/session/Toast';
import { ConfirmationModal } from '@/components/session/ConfirmationModal';
import { FullscreenSessionShell } from '@/components/desktop/FullscreenSessionShell';
import type { RoomAvaState } from '@/components/session/RoomAvaTile';
import {
  ConferenceChatDrawer,
  ChatMessage as DrawerChatMessage,
  MaterialItem as DrawerMaterialItem,
  AuthorityItem as DrawerAuthorityItem,
} from '@/components/session/ConferenceChatDrawer';
import { useVoice } from '@/hooks/useVoice';
import { useSupabase, useTenant } from '@/providers';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { trackInteraction } from '@/lib/interactionTelemetry';
import { useKeepAwake } from '@/hooks/useKeepAwake';
import { readSSEStream, extractResponseText } from '@/lib/sseStream';

// Zoom SDK components
import {
  ZoomConferenceProvider,
  useZoomContext,
  useZoomParticipants,
  useZoomActiveSpeaker,
} from '@/components/session/ZoomConferenceProvider';
import type { ZoomParticipant } from '@/components/session/ZoomConferenceProvider';
import { ZoomVideoTile } from '@/components/session/ZoomVideoTile';

// Conference UI components
import { ConferenceHeader } from '@/components/session/ConferenceHeader';
import { ConferenceControlBar } from '@/components/session/ConferenceControlBar';
import { NoraTile } from '@/components/session/NoraTile';
import { ConferenceParticipantsPanel } from '@/components/session/ConferenceParticipantsPanel';
import { ConferenceCaptions } from '@/components/session/ConferenceCaptions';

// Hooks
import { useConferenceTimer } from '@/hooks/useConferenceTimer';
import { useConferenceControls } from '@/hooks/useConferenceControls';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
// ConferenceContent — child of ZoomConferenceProvider, uses Zoom hooks
// ---------------------------------------------------------------------------

function ConferenceContent({
  roomName,
  avaState,
  isNoraSpeaking,
  onToggleNora,
  chatVisible,
  participantsVisible,
  messages,
  materials,
  authorityQueue,
  avaThinking,
  viewMode,
  onToggleChat,
  onToggleParticipants,
  onToggleView,
  onSendMessage,
  onSaveMaterial,
  onApproveAuthority,
  onDenyAuthority,
  onLeave,
}: {
  roomName: string;
  avaState: RoomAvaState;
  isNoraSpeaking: boolean;
  onToggleNora: () => void;
  chatVisible: boolean;
  participantsVisible: boolean;
  messages: ChatMessage[];
  materials: MaterialItem[];
  authorityQueue: AuthorityItem[];
  avaThinking: boolean;
  viewMode: 'gallery' | 'speaker';
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onToggleView: () => void;
  onSendMessage: (text: string, isPrivate: boolean) => void;
  onSaveMaterial: (id: string) => void;
  onApproveAuthority: (id: string) => void;
  onDenyAuthority: (id: string) => void;
  onLeave: () => void;
}) {
  const participants = useZoomParticipants();
  const {
    stream, client, isRecording, networkQuality, screenShareUserId,
    chatMessages, sendChatMessage, transcriptEntries, isTranscribing, toggleTranscription,
  } = useZoomContext();
  const activeSpeaker = useZoomActiveSpeaker();
  const { formatted: duration } = useConferenceTimer();
  const maxVideoQuality = useMemo(() => {
    try {
      const value = stream?.getVideoMaxQuality?.();
      return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    } catch (_e) {
      return undefined;
    }
  }, [stream]);

  const controls = useConferenceControls({ stream, client });

  // Sync recording state from provider
  useEffect(() => {
    controls.setIsRecording(isRecording);
  }, [isRecording]);

  // Sync screen share state from provider
  useEffect(() => {
    controls.setIsScreenSharing(screenShareUserId !== null);
  }, [screenShareUserId]);

  // Derive camera/mic display state from provider (single source of truth).
  // Controls hook keeps internal state for toggle logic, but display comes
  // from the SDK participant data to avoid bidirectional sync flicker.
  const localParticipant = participants.find((p) => p.isLocal);
  const derivedCameraOff = localParticipant ? !localParticipant.isVideoOn : true;
  const derivedMuted = localParticipant ? !!localParticipant.isMuted : false;

  // Keep controls hook in sync so toggle functions call the correct SDK method
  useEffect(() => {
    controls.setIsCameraOff(derivedCameraOff);
    controls.setIsMuted(derivedMuted);
  }, [derivedCameraOff, derivedMuted]);

  // Keyboard shortcuts
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.shiftKey) return;
      const key = e.key.toLowerCase();
      const actions: Record<string, () => void> = {
        m: controls.toggleMic,
        v: controls.toggleCamera,
        s: controls.toggleScreenShare,
        r: controls.toggleRecording,
        t: toggleTranscription,
        h: onToggleChat,
        p: onToggleParticipants,
        l: onToggleView,
      };
      if (actions[key]) {
        e.preventDefault();
        actions[key]();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [controls, onToggleChat, onToggleParticipants, onToggleView]);

  // Video grid — gallery or speaker view
  const renderGrid = () => {
    const allTiles = participants.length + 1; // +1 for Nora
    const isGallery = viewMode === 'gallery';

    if (!isGallery && activeSpeaker !== null) {
      // Speaker view: spotlight active speaker, filmstrip for rest + Nora
      const spotlight = participants.find(p => p.userId === activeSpeaker);
      const filmstrip = participants.filter(p => p.userId !== activeSpeaker);

      return (
        <View style={styles.speakerLayout}>
          <View style={styles.spotlightArea}>
            {spotlight ? (
              <ZoomVideoTile
                participant={spotlight}
                stream={stream as any}
                isActiveSpeaker={true}
                size="spotlight"
                networkQuality={networkQuality}
                maxVideoQuality={maxVideoQuality}
              />
            ) : (
              <NoraTile avaState={avaState} isNoraSpeaking={isNoraSpeaking} onPress={onToggleNora} />
            )}
          </View>
          <View style={styles.filmstrip}>
            {!spotlight && null /* Nora is in spotlight */}
            {spotlight && (
              <View style={styles.filmstripTile}>
                <NoraTile avaState={avaState} isNoraSpeaking={isNoraSpeaking} onPress={onToggleNora} />
              </View>
            )}
            {filmstrip.map(p => (
              <View key={p.userId} style={styles.filmstripTile}>
                <ZoomVideoTile
                  participant={p}
                  stream={stream as any}
                  isActiveSpeaker={false}
                  size="small"
                  networkQuality={networkQuality}
                  maxVideoQuality={maxVideoQuality}
                />
              </View>
            ))}
          </View>
        </View>
      );
    }

    // Gallery view: adaptive grid — compute cols AND rows so tiles fill the screen
    const cols = allTiles <= 1 ? 1 : allTiles <= 2 ? 2 : allTiles <= 4 ? 2 : allTiles <= 6 ? 3 : allTiles <= 9 ? 3 : 4;
    const rows = Math.ceil(allTiles / cols);
    // Use calc() to account for gap (4px) so tiles fill exactly
    const gap = 4;
    const tileWidth = `calc(${100 / cols}% - ${gap}px)` as any;
    const tileHeight = `calc(${100 / rows}% - ${gap}px)` as any;

    const gridStyle = allTiles <= 1 ? styles.grid1
      : allTiles <= 2 ? styles.grid2
      : allTiles <= 4 ? styles.grid4
      : allTiles <= 6 ? styles.grid6
      : allTiles <= 9 ? styles.grid9
      : styles.grid12;

    const tileStyle = { width: tileWidth, height: tileHeight };

    return (
      <View style={[styles.videoGrid, gridStyle]}>
        {/* Nora tile — always first in grid */}
        <View style={[styles.videoTileWrapper, tileStyle]}>
          <NoraTile avaState={avaState} isNoraSpeaking={isNoraSpeaking} onPress={onToggleNora} />
        </View>

        {/* Zoom participant tiles */}
        {participants.map((p: ZoomParticipant) => (
          <View key={p.userId} style={[styles.videoTileWrapper, tileStyle]}>
            <ZoomVideoTile
              participant={p}
              stream={stream as any}
              isActiveSpeaker={p.userId === activeSpeaker}
              networkQuality={networkQuality}
              maxVideoQuality={maxVideoQuality}
            />
          </View>
        ))}

        {participants.length === 0 && (
          <View style={[styles.emptyTile, tileStyle]}>
            <Text style={styles.emptyText}>Waiting for participants...</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <ConferenceHeader
        roomName={roomName}
        participantCount={participants.length + 1}
        duration={duration}
        isRecording={controls.isRecording}
        networkQuality={networkQuality}
      />

      <View style={styles.gridContainer}>
        {renderGrid()}
        <ConferenceCaptions entries={transcriptEntries} visible={isTranscribing} />
      </View>

      <ConferenceControlBar
        isMuted={derivedMuted}
        isCameraOff={derivedCameraOff}
        isScreenSharing={controls.isScreenSharing}
        isRecording={controls.isRecording}
        isTranscribing={isTranscribing}
        isChatOpen={chatVisible}
        isParticipantsOpen={participantsVisible}
        viewMode={viewMode}
        unreadCount={messages.length}
        onToggleMic={controls.toggleMic}
        onToggleCamera={controls.toggleCamera}
        onToggleScreenShare={controls.toggleScreenShare}
        onToggleRecording={controls.toggleRecording}
        onToggleTranscription={toggleTranscription}
        onToggleChat={onToggleChat}
        onToggleParticipants={onToggleParticipants}
        onToggleView={onToggleView}
        onLeave={onLeave}
      />

      {/* Slide-in panels */}
      <ConferenceParticipantsPanel
        visible={participantsVisible}
        participants={participants}
        activeSpeakerId={activeSpeaker}
        networkQuality={networkQuality}
        onClose={onToggleParticipants}
      />

      <ConferenceChatDrawer
        visible={chatVisible}
        onClose={onToggleChat}
        messages={messages as DrawerChatMessage[]}
        materials={materials as DrawerMaterialItem[]}
        avaThinking={avaThinking}
        onSendMessage={onSendMessage}
        onSaveMaterial={onSaveMaterial}
        authorityQueue={authorityQueue as DrawerAuthorityItem[]}
        onApproveAuthority={onApproveAuthority}
        onDenyAuthority={onDenyAuthority}
      />
    </>
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

  // Zoom Video SDK state
  const [zoomStatus, setZoomStatus] = useState<'loading' | 'joined' | 'error'>('loading');
  const [zoomError, setZoomError] = useState<string | null>(null);
  const [zoomToken, setZoomToken] = useState<string | null>(null);
  const [zoomTopic, setZoomTopic] = useState<string>('');

  const participantName = (params.participantName as string) || tenant?.ownerName || session?.user?.user_metadata?.full_name || 'You';
  const roomName = (params.roomName as string) || `suite-${suiteId || 'dev'}-conference`;
  const purpose = (params.purpose as string) || 'Internal';
  const sessionMode = (params.sessionMode as string) || 'conference';
  const autoRecord = params.isRecording === '1' || params.isRecording === undefined; // default on
  const isVoiceOnly = sessionMode === 'voice';

  // UI state
  const [chatVisible, setChatVisible] = useState(false);
  const [participantsVisible, setParticipantsVisible] = useState(false);
  const [viewMode, setViewMode] = useState<'gallery' | 'speaker'>('gallery');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [authorityQueue, setAuthorityQueue] = useState<AuthorityItem[]>([]);
  const [avaThinking, setAvaThinking] = useState(false);

  // Nora voice
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

  const handleToggleNora = useCallback(async () => {
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

  // Toast
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  // End call
  const [showEndModal, setShowEndModal] = useState(false);

  const handleEndCall = useCallback(async () => {
    trackInteraction('session_end', 'conference-live', { agent: 'nora' });
    setShowEndModal(false);
    showToast('Session ended. Generating receipt...', 'success');
    setTimeout(() => router.replace('/(tabs)'), 1500);
  }, [router]);

  // Zoom token fetch
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const controller = new AbortController();
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    (async () => {
      try {
        setZoomStatus('loading');
        let data: any = null;
        let lastError: unknown = null;

        for (let attempt = 0; attempt < 3; attempt += 1) {
          if (controller.signal.aborted) return;

          try {
            const res = await authenticatedFetch('/api/zoom/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ roomName, participantName, suiteId }),
              signal: controller.signal,
            });
            if (!res.ok) {
              if (res.status === 401 || res.status === 403) {
                throw new Error('Session expired. Please sign in again.');
              }
              if (res.status === 500 || res.status === 503) {
                throw new Error('Zoom server is not configured (SDK key/secret).');
              }
              throw new Error(`Token endpoint returned ${res.status}`);
            }
            data = await res.json();
            break;
          } catch (err) {
            lastError = err;
            if (attempt < 2 && !controller.signal.aborted) {
              await wait(400 * (attempt + 1));
            }
          }
        }

        if (!data) {
          throw lastError instanceof Error ? lastError : new Error('Unable to fetch Zoom token');
        }

        if (controller.signal.aborted) return;
        setZoomToken(data.token);
        setZoomTopic(data.topic || roomName);
        setZoomStatus('joined');
        trackInteraction('session_start', 'conference-live', { agent: 'nora', roomName });
      } catch (err) {
        if (controller.signal.aborted) return;
        setZoomError(err instanceof Error ? err.message : 'Conference service unavailable');
        setZoomStatus('error');
      }
    })();

    return () => controller.abort();
  }, [suiteId, roomName, authenticatedFetch]);

  // Chat handler (SSE streaming to orchestrator)
  const handleSendMessage = useCallback(async (text: string, isPrivate: boolean) => {
    const newMessage: ChatMessage = {
      id: `msg-${crypto.randomUUID()}`,
      senderId: 'you',
      senderName: 'You',
      text,
      timestamp: new Date(),
      isPrivate,
    };
    setMessages(prev => [...prev, newMessage]);

    if (!isPrivate) return;

    setAvaThinking(true);
    try {
      const resp = await fetch('/api/orchestrator/intent?stream=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(suiteId ? { 'X-Suite-Id': suiteId } : {}),
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ agent: 'ava', text, channel: 'conference_private' }),
      });

      if (!resp.ok || !resp.body) {
        const data = await resp.json().catch(() => ({}));
        setMessages(prev => [...prev, {
          id: `msg-ava-${crypto.randomUUID()}`, senderId: 'ava', senderName: 'Ava',
          text: data.response || data.text || "I'm having trouble connecting. Try again in a moment.",
          timestamp: new Date(), isPrivate: true,
        }]);
        return;
      }

      await readSSEStream(resp.body, (evt) => {
        if (evt.type === 'response') {
          setMessages(prev => [...prev, {
            id: `msg-ava-${crypto.randomUUID()}`, senderId: 'ava', senderName: 'Ava',
            text: extractResponseText(evt), timestamp: new Date(), isPrivate: true,
          }]);
        }
      });
    } catch (_err) {
      setMessages(prev => [...prev, {
        id: `msg-ava-err-${crypto.randomUUID()}`, senderId: 'ava', senderName: 'Ava',
        text: "I'm having trouble connecting. Let me try again.",
        timestamp: new Date(), isPrivate: true,
      }]);
    } finally {
      setAvaThinking(false);
    }
  }, [suiteId, session?.access_token]);

  // Retry
  const handleRetry = useCallback(() => {
    setZoomError(null);
    setZoomStatus('loading');
    router.replace({
      pathname: '/session/conference-live',
      params: { roomName, participantName },
    } as any);
  }, [router, roomName, participantName]);

  // Panel toggles
  const toggleChat = useCallback(() => {
    setChatVisible(prev => !prev);
    if (participantsVisible) setParticipantsVisible(false);
  }, [participantsVisible]);

  const toggleParticipants = useCallback(() => {
    setParticipantsVisible(prev => !prev);
    if (chatVisible) setChatVisible(false);
  }, [chatVisible]);

  const toggleView = useCallback(() => {
    setViewMode(prev => prev === 'gallery' ? 'speaker' : 'gallery');
  }, []);

  // Render
  return (
    <FullscreenSessionShell showBackButton={false} backLabel="Exit Conference">
      <View style={styles.container}>
        <Toast
          visible={toastVisible}
          message={toastMessage}
          type={toastType}
          onHide={() => setToastVisible(false)}
        />

        {/* Error state */}
        {zoomStatus === 'error' && (
          <View style={styles.errorContainer}>
            <Ionicons name="videocam-off-outline" size={48} color="#ef4444" />
            <Text style={styles.errorTitle}>Conference Service Unavailable</Text>
            <Text style={styles.errorMessage}>{zoomError}</Text>
            <View style={styles.errorActions}>
              <View style={styles.retryButton}>
                <Text style={styles.retryButtonText} onPress={handleRetry}>Retry Connection</Text>
              </View>
              <View style={styles.backButton}>
                <Text style={styles.backButtonText} onPress={() => router.back()}>Return to Lobby</Text>
              </View>
            </View>
          </View>
        )}

        {/* Loading state */}
        {zoomStatus === 'loading' && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Connecting to conference...</Text>
          </View>
        )}

        {/* Conference — Zoom SDK + full UI */}
        {zoomStatus === 'joined' && zoomToken && (
          <ZoomConferenceProvider token={zoomToken} topic={zoomTopic} userName={participantName} startVideo={!isVoiceOnly} autoRecord={autoRecord}>
            <ConferenceContent
              roomName={roomName}
              avaState={avaState}
              isNoraSpeaking={isNoraSpeaking}
              onToggleNora={handleToggleNora}
              chatVisible={chatVisible}
              participantsVisible={participantsVisible}
              messages={messages}
              materials={materials}
              authorityQueue={authorityQueue}
              avaThinking={avaThinking}
              viewMode={viewMode}
              onToggleChat={toggleChat}
              onToggleParticipants={toggleParticipants}
              onToggleView={toggleView}
              onSendMessage={handleSendMessage}
              onSaveMaterial={(id) => setMaterials(prev => prev.map(m => m.id === id ? { ...m, saved: true } : m))}
              onApproveAuthority={(id) => setAuthorityQueue(prev => prev.filter(a => a.id !== id))}
              onDenyAuthority={(id) => setAuthorityQueue(prev => prev.filter(a => a.id !== id))}
              onLeave={() => setShowEndModal(true)}
            />
          </ZoomConferenceProvider>
        )}

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

  // Grid container (between header and footer)
  gridContainer: {
    flex: 1,
    overflow: 'hidden',
  },

  // Gallery view grids — tiles must fill the entire space between header and footer
  videoGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    padding: 4,
  },
  videoTileWrapper: {
    // Height computed from row count, width from col count
    // Both set inline in renderGrid
  },
  grid1: { padding: 8 },
  grid2: { padding: 4 },
  grid4: { padding: 4 },
  grid6: { padding: 3 },
  grid9: { padding: 2 },
  grid12: { padding: 2 },

  emptyTile: {
    flex: 1,
    minWidth: 280,
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141414',
    borderRadius: 10,
  },
  emptyText: {
    color: '#6e6e73',
    fontSize: 14,
  },

  // Speaker view
  speakerLayout: {
    flex: 1,
    flexDirection: 'column',
  },
  spotlightArea: {
    flex: 1,
    padding: 4,
  },
  filmstrip: {
    height: 120,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  filmstripTile: {
    width: 180,
    height: '100%',
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
});
