import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Animated, StatusBar, useWindowDimensions, ScrollView, TextInput, Alert, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '@/constants/tokens';
import { Toast } from '@/components/session/Toast';
import { ConfirmationModal } from '@/components/session/ConfirmationModal';
import { useDesktop } from '@/lib/useDesktop';
import { FullscreenSessionShell } from '@/components/desktop/FullscreenSessionShell';
import { RoomAvaTile, RoomAvaState } from '@/components/session/RoomAvaTile';
import { ConferenceChatDrawer, ChatMessage as DrawerChatMessage, MaterialItem as DrawerMaterialItem, AuthorityItem as DrawerAuthorityItem } from '@/components/session/ConferenceChatDrawer';
import { AvatarTileSurface } from '@/components/session/AvatarTileSurface';
import { Image } from 'expo-image';
import { Platform } from 'react-native';
import { useAgentVoice } from '@/hooks/useAgentVoice';
import { useSupabase } from '@/providers';
import { useParticipants, useTracks, useRoomContext } from '@livekit/components-react';
import { Track, ConnectionState } from 'livekit-client';
import { LiveKitConferenceProvider } from '@/components/session/LiveKitConferenceProvider';
import { LiveKitVideoTile } from '@/components/session/LiveKitVideoTile';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core';

function WebcamView({ stream }: { stream: MediaStream }) {
  const containerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !containerRef.current || !stream) return;
    const container = containerRef.current;
    if (!videoRef.current) {
      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.transform = 'scaleX(-1)';
      video.style.position = 'absolute';
      video.style.top = '0';
      video.style.left = '0';
      video.style.borderRadius = 'inherit';
      container.appendChild(video);
      videoRef.current = video;
    }
    videoRef.current.srcObject = stream;
    return () => {
      if (videoRef.current && container.contains(videoRef.current)) {
        container.removeChild(videoRef.current);
        videoRef.current = null;
      }
    };
  }, [stream]);

  return <View ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' } as any} />;
}

const avaLogo = require('../../assets/images/ava-logo.png');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type ViewMode = 'gallery' | 'speaker' | 'multiSpeaker' | 'immersive' | 'floatingThumbnail';
type ShareMode = 'none' | 'standard' | 'sideBySideSpeaker' | 'sideBySideGallery' | 'sideBySideMulti';
type ChromeMode = 'visible' | 'hidden';

interface Participant {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isSpeaking: boolean;
  isHost: boolean;
  isExternal?: boolean;
  isPinned?: boolean;
  isSpotlighted?: boolean;
}

// Host participant — other participants joined via LiveKit room events
const INITIAL_PARTICIPANTS: Participant[] = [
  { id: 'you', name: 'You', role: 'Host', avatarColor: '#2D3748', isMuted: false, isVideoOff: false, isSpeaking: false, isHost: true },
];

const AVA_PARTICIPANT: Participant = {
  id: 'ava',
  name: 'Ava',
  role: 'Room Assistant',
  avatarColor: Colors.accent.cyan,
  isMuted: false,
  isVideoOff: false,
  isSpeaking: false,
  isHost: false,
};

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

// Chat messages and materials populated during live session
const INITIAL_MESSAGES: ChatMessage[] = [];
const INITIAL_MATERIALS: MaterialItem[] = [];

// Authority items populated from Supabase approval_requests during live session
const INITIAL_AUTHORITY: AuthorityItem[] = [];

function AvaTile({ 
  avaState, 
  onPress,
  onInnerBoxPress,
  isNoraSpeaking = false,
  width,
  height,
  fillContainer = false,
}: { 
  avaState: RoomAvaState;
  onPress: () => void;
  onInnerBoxPress?: () => void;
  isNoraSpeaking?: boolean;
  width?: number;
  height?: number;
  fillContainer?: boolean;
}) {
  const isActive = avaState === 'listening' || avaState === 'thinking' || avaState === 'speaking';
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const colorAnim = useRef(new Animated.Value(0)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const colorLoopRef = useRef<Animated.CompositeAnimation | null>(null);

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

    return () => {
      if (pulseLoopRef.current) pulseLoopRef.current.stop();
    };
  }, [isActive]);

  useEffect(() => {
    colorLoopRef.current = Animated.loop(
      Animated.timing(colorAnim, { toValue: 1, duration: 4000, useNativeDriver: false })
    );
    colorLoopRef.current.start();
    return () => {
      if (colorLoopRef.current) colorLoopRef.current.stop();
    };
  }, []);

  const borderColor = colorAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ['#3B82F6', '#3B82F6', '#3B82F6', '#3B82F6', '#3B82F6'],
  });

  const getStatusColor = () => {
    switch (avaState) {
      case 'listening': return '#3B82F6';
      case 'speaking': return '#4ade80';
      case 'thinking': return '#A78BFA';
      default: return '#4ade80';
    }
  };

  const containerStyle = fillContainer 
    ? { flex: 1 as const, width: '100%' as const, height: '100%' as const }
    : { width, height };

  return (
    <Pressable 
      onPress={onPress} 
      style={[
        styles.avaTileContainer,
        containerStyle,
        { borderColor: '#3B82F6', borderWidth: 2 },
      ]}
    >
      <View style={styles.avaTileBackground}>
        {/* Inner glowing feedback box - clickable to start Nora */}
        <Pressable onPress={onInnerBoxPress}>
          <Animated.View 
            style={[
              styles.avaInnerGlowBox,
              { 
                transform: [{ scale: pulseAnim }],
                borderColor: isNoraSpeaking ? '#3B82F6' : borderColor,
                borderWidth: 2,
              },
              Platform.OS === 'web' && {
                boxShadow: isNoraSpeaking 
                  ? '0 0 12px 4px rgba(0, 255, 255, 0.8), 0 0 25px 8px rgba(79, 172, 254, 0.6), 0 0 40px 12px rgba(0, 242, 254, 0.4)'
                  : '0 0 8px 2px rgba(79, 172, 254, 0.6), 0 0 15px 3px rgba(0, 242, 254, 0.4), 0 0 25px 5px rgba(79, 172, 254, 0.3)',
                cursor: 'pointer',
              } as any,
            ]}
          >
            <Image 
              source={avaLogo}
              style={styles.avaLogoImage}
              contentFit="contain"
            />
          </Animated.View>
        </Pressable>

        <View style={styles.avaLabelContainer}>
          <Text style={styles.avaAssistantName}>
            {isNoraSpeaking ? 'Nora Speaking...' : 'Nora - Room Assistant'}
          </Text>
          <View style={[styles.avaStatusDotNew, { backgroundColor: isNoraSpeaking ? '#3B82F6' : getStatusColor() }]} />
        </View>
      </View>
    </Pressable>
  );
}

function VideoTile({ 
  participant, 
  size = 'normal',
  isActiveSpeaker = false,
  onPin,
  onSpotlight,
  showPinControls = false,
  webcamStream,
}: { 
  participant: Participant; 
  size?: 'normal' | 'small' | 'spotlight';
  isActiveSpeaker?: boolean;
  onPin?: () => void;
  onSpotlight?: () => void;
  showPinControls?: boolean;
  webcamStream?: MediaStream | null;
}) {
  const isSpeaking = participant.isSpeaking || isActiveSpeaker;
  const isSpotlight = size === 'spotlight';
  const isSmall = size === 'small';
  const tileSize = isSmall ? 'small' : isSpotlight ? 'spotlight' : 'normal';
  const showWebcam = participant.id === 'you' && webcamStream && !participant.isVideoOff;

  return (
    <View style={[
      styles.videoTile,
      isSmall && styles.videoTileSmall,
      isSpotlight && styles.videoTileSpotlight,
    ]}>
      <AvatarTileSurface
        name={participant.name}
        seed={participant.id}
        accentColor={participant.avatarColor}
        size={tileSize}
        videoOff={participant.isVideoOff}
        style={styles.videoFeed}
      />
      {showWebcam && Platform.OS === 'web' && <WebcamView stream={webcamStream} />}

      {isSpeaking && <View style={styles.speakingBorder} />}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.tileOverlay}
      >
        <View style={styles.tileBottomRow}>
          <View style={styles.nameContainer}>
            <Text style={[styles.tileName, isSmall && styles.tileNameSmall]} numberOfLines={1}>
              {participant.name}
            </Text>
            {participant.isHost && (
              <View style={styles.hostBadge}>
                <Ionicons name="star" size={8} color={Colors.semantic.warning} />
              </View>
            )}
            {participant.isPinned && (
              <View style={styles.pinBadge}>
                <Ionicons name="pin" size={8} color={Colors.accent.cyan} />
              </View>
            )}
          </View>
          {participant.isMuted && (
            <View style={styles.mutedIndicator}>
              <Ionicons name="mic-off" size={12} color={Colors.semantic.error} />
            </View>
          )}
        </View>
      </LinearGradient>

      <View style={styles.avaIndicator}>
        <Ionicons name="sparkles" size={10} color={Colors.accent.cyan} />
      </View>
    </View>
  );
}

export default function ConferenceLive() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isDesktop = useDesktop();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [layout, setLayout] = useState<'gallery' | 'speaker'>('gallery');
  const [activeSpeakerId, setActiveSpeakerId] = useState('you');
  const [elapsedTime, setElapsedTime] = useState(0);

  // LiveKit room connection
  const [liveKitToken, setLiveKitToken] = useState<string | null>(null);

  // LiveKit hooks — useParticipants/useTracks from @livekit/components-react
  // These work when wrapped in <LiveKitConferenceProvider>; return empty when not connected
  let lkParticipants: ReturnType<typeof useParticipants> = [];
  let lkVideoTracks: TrackReferenceOrPlaceholder[] = [];
  let lkRoom: ReturnType<typeof useRoomContext> | null = null;
  try {
    lkParticipants = useParticipants();
    lkVideoTracks = useTracks(
      [
        { source: Track.Source.Camera, withPlaceholder: true },
        { source: Track.Source.ScreenShare, withPlaceholder: false },
      ],
    );
    lkRoom = useRoomContext();
  } catch {
    // Not inside LiveKitRoom context yet (token not ready)
  }

  // Map LiveKit participants to our UI Participant interface
  const participants: Participant[] = lkParticipants.length > 0
    ? lkParticipants.map(p => {
        const audioTrack = p.getTrackPublication(Track.Source.Microphone);
        const videoTrack = p.getTrackPublication(Track.Source.Camera);
        return {
          id: p.identity,
          name: p.name || p.identity,
          role: p.isLocal ? 'Host' : '',
          avatarColor: p.isLocal ? '#2D3748' : '#374151',
          isMuted: audioTrack ? audioTrack.isMuted : true,
          isVideoOff: videoTrack ? videoTrack.isMuted || !videoTrack.isSubscribed : true,
          isSpeaking: p.isSpeaking,
          isHost: p.isLocal,
          isPinned: false,
          isSpotlighted: false,
        } as Participant;
      })
    : INITIAL_PARTICIPANTS;

  // Build a lookup: participant identity → TrackReferenceOrPlaceholder for camera
  const trackRefMap = new Map<string, TrackReferenceOrPlaceholder>();
  for (const tr of lkVideoTracks) {
    if (tr.source === Track.Source.Camera && tr.participant) {
      trackRefMap.set(tr.participant.identity, tr);
    }
  }
  
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const [controlsVisible, setControlsVisible] = useState(true);
  
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [materials, setMaterials] = useState(INITIAL_MATERIALS);
  const [authorityQueue, setAuthorityQueue] = useState(INITIAL_AUTHORITY);
  const [avaState, setAvaState] = useState<RoomAvaState>('idle');
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'materials' | 'authority'>('chat');
  const [isPrivateMessage, setIsPrivateMessage] = useState(true);
  const [chatVisible, setChatVisible] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [shareMode, setShareMode] = useState<ShareMode>('none');
  const [chromeMode, setChromeMode] = useState<ChromeMode>('visible');
  const [alwaysShowControls, setAlwaysShowControls] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [hideSelfView, setHideSelfView] = useState(false);
  const [hideNonVideo, setHideNonVideo] = useState(false);
  const [galleryPage, setGalleryPage] = useState(0);
  const [participantsPanelVisible, setParticipantsPanelVisible] = useState(false);
  const [sideBySideDivider, setSideBySideDivider] = useState(0.5);
  const chromeOpacity = useRef(new Animated.Value(1)).current;
  const chromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInteractingRef = useRef(false);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);

  // Tenant context for voice requests (Law #6: Tenant Isolation)
  const { suiteId } = useSupabase();

  // Fetch LiveKit token and connect to room on mount
  useEffect(() => {
    const roomName = (params.roomName as string) || `suite-${suiteId || 'dev'}-conference`;
    const participantName = (params.participantName as string) || 'You';

    fetch('/api/livekit/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName, participantName, suiteId }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          setLiveKitToken(data.token);
        }
      })
      .catch(err => {
        console.error('LiveKit token fetch failed:', err.message);
      });
  }, [suiteId, params.roomName, params.participantName]);

  // Connection/disconnection is handled automatically by <LiveKitConferenceProvider>
  // when token prop changes. No manual connect/disconnect needed.

  // Orchestrator-routed voice: STT → Orchestrator → TTS (Law #1: Single Brain)
  const noraVoice = useAgentVoice({
    agent: 'nora',
    suiteId: suiteId ?? undefined,
    onStatusChange: (voiceStatus) => {
      if (voiceStatus === 'speaking') setAvaState('speaking');
      else if (voiceStatus === 'listening') setAvaState('listening');
      else if (voiceStatus === 'thinking') setAvaState('thinking');
      else setAvaState('idle');
    },
    onResponse: (text) => {
      console.log('Nora response:', text);
    },
    onError: (error) => {
      console.error('Nora voice error:', error);
      setAvaState('idle');
    },
  });

  const isNoraSpeaking = noraVoice.status === 'speaking';

  const handleInnerBoxPress = useCallback(async () => {
    if (noraVoice.isActive) {
      noraVoice.endSession();
    } else {
      try {
        await noraVoice.startSession();
      } catch (error) {
        console.error('Failed to start Nora voice session:', error);
        Alert.alert('Connection Error', 'Unable to connect to Nora. Please try again.');
      }
    }
  }, [noraVoice]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let active = true;
    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      .then(stream => {
        if (active) setWebcamStream(stream);
        else stream.getTracks().forEach(t => t.stop());
      })
      .catch(() => {});
    return () => {
      active = false;
      setWebcamStream(prev => {
        prev?.getTracks().forEach(t => t.stop());
        return null;
      });
    };
  }, []);

  useEffect(() => {
    if (isVideoOff && webcamStream) {
      webcamStream.getVideoTracks().forEach(t => { t.enabled = false; });
    } else if (!isVideoOff && webcamStream) {
      webcamStream.getVideoTracks().forEach(t => { t.enabled = true; });
    }
  }, [isVideoOff, webcamStream]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Track active speaker from LiveKit
  useEffect(() => {
    const speaking = participants.find(p => p.isSpeaking);
    if (speaking) setActiveSpeakerId(speaking.id);
  }, [participants]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (lkRoom) {
      lkRoom.localParticipant?.setMicrophoneEnabled(!newMuted).catch(() => {});
    }
    showToast(newMuted ? 'Microphone off' : 'Microphone on', 'info');
  };

  const handleToggleVideo = () => {
    const newVideoOff = !isVideoOff;
    setIsVideoOff(newVideoOff);
    if (lkRoom) {
      lkRoom.localParticipant?.setCameraEnabled(!newVideoOff).catch(() => {});
    }
    showToast(newVideoOff ? 'Camera off' : 'Camera on', 'info');
  };

  const handleEndCall = () => {
    setShowEndModal(false);
    // Disconnect from LiveKit room (handled by LiveKitConferenceProvider unmount)
    if (lkRoom) {
      lkRoom.disconnect().catch(() => {});
    }
    showToast('Session ended. Generating receipt...', 'success');
    setTimeout(() => router.replace('/(tabs)'), 1500);
  };

  const handleToggleLayout = () => {
    setLayout(prev => prev === 'gallery' ? 'speaker' : 'gallery');
    showToast(`Switched to ${layout === 'gallery' ? 'speaker' : 'gallery'} view`, 'info');
  };

  const resetChromeTimer = useCallback(() => {
    if (alwaysShowControls) return;
    if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current);
    if (chromeMode === 'hidden') {
      setChromeMode('visible');
      Animated.timing(chromeOpacity, { toValue: 1, duration: 200, useNativeDriver: false }).start();
    }
    chromeTimerRef.current = setTimeout(() => {
      if (isInteractingRef.current || chatVisible || showViewMenu || participantsPanelVisible) return;
      setChromeMode('hidden');
      Animated.timing(chromeOpacity, { toValue: 0, duration: 400, useNativeDriver: false }).start();
    }, 2500);
  }, [alwaysShowControls, chromeMode, chatVisible, showViewMenu, participantsPanelVisible]);

  useEffect(() => {
    if (!isDesktop || Platform.OS !== 'web') return;
    resetChromeTimer();
    const handleInteraction = () => resetChromeTimer();
    window.addEventListener('mousemove', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('click', handleInteraction);
    return () => {
      window.removeEventListener('mousemove', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('click', handleInteraction);
      if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current);
    };
  }, [resetChromeTimer, isDesktop]);

  useEffect(() => {
    if (alwaysShowControls) {
      setChromeMode('visible');
      Animated.timing(chromeOpacity, { toValue: 1, duration: 200, useNativeDriver: false }).start();
      if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current);
    }
  }, [alwaysShowControls]);

  const toggleFullscreen = useCallback(() => {
    if (Platform.OS !== 'web') return;
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isDesktop) return;
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isDesktop]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isDesktop) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
      if (e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
      }
      if (e.ctrlKey && e.altKey && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setAlwaysShowControls(prev => !prev);
        showToast(alwaysShowControls ? 'Auto-hide controls enabled' : 'Controls always visible', 'info');
      }
      if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setChatVisible(prev => !prev);
      }
      if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        setParticipantsPanelVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDesktop, isFullscreen, toggleFullscreen, alwaysShowControls]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isDesktop) return;
    const handleDblClick = () => toggleFullscreen();
    const videoSection = document.querySelector('[data-video-section]');
    if (videoSection) {
      videoSection.addEventListener('dblclick', handleDblClick);
      return () => videoSection.removeEventListener('dblclick', handleDblClick);
    }
  }, [isDesktop, toggleFullscreen]);

  // Local UI state for pin/spotlight (not part of LiveKit)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [spotlightedIds, setSpotlightedIds] = useState<Set<string>>(new Set());

  // Merge pin/spotlight into participants
  const participantsWithUI = participants.map(p => ({
    ...p,
    isPinned: pinnedIds.has(p.id),
    isSpotlighted: spotlightedIds.has(p.id),
  }));

  const handlePinParticipant = (id: string) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else if (next.size < 9) { next.add(id); }
      return next;
    });
  };

  const handleSpotlightParticipant = (id: string) => {
    const currentUser = participants.find(p => p.id === 'you');
    if (!currentUser?.isHost) return;
    setSpotlightedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else if (next.size < 9) { next.add(id); }
      return next;
    });
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setShowViewMenu(false);
    showToast(`Switched to ${mode === 'multiSpeaker' ? 'Multi-speaker' : mode === 'floatingThumbnail' ? 'Floating Thumbnail' : mode.charAt(0).toUpperCase() + mode.slice(1)} view`, 'info');
  };

  const filteredParticipants = participantsWithUI.filter(p => {
    if (hideSelfView && p.id === 'you') return false;
    if (hideNonVideo && p.isVideoOff) return false;
    return true;
  });

  const allTiles = [...filteredParticipants, AVA_PARTICIPANT];
  const maxTilesPerPage = Math.min(49, Math.floor((windowWidth * windowHeight) / (180 * 135)));
  const totalPages = Math.ceil(allTiles.length / maxTilesPerPage);
  const pagedTiles = allTiles.slice(galleryPage * maxTilesPerPage, (galleryPage + 1) * maxTilesPerPage);

  const pinnedParticipant = participantsWithUI.find(p => p.isPinned);
  const stageParticipant = pinnedParticipant || participantsWithUI.find(p => p.id === activeSpeakerId) || participantsWithUI[0];
  const filmstripParticipants = allTiles.filter(p => p.id !== stageParticipant?.id);

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;
    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: 'you',
      senderName: 'You',
      text,
      timestamp: new Date(),
      isPrivate: isPrivateMessage,
    };
    setMessages([...messages, newMessage]);
    setChatInput('');
    
    if (isPrivateMessage) {
      setTimeout(() => {
        const avaResponse: ChatMessage = {
          id: `msg-${Date.now()}-ava`,
          senderId: 'ava',
          senderName: 'Ava',
          text: 'I understand. Let me help you with that.',
          timestamp: new Date(),
          isPrivate: true,
        };
        setMessages(prev => [...prev, avaResponse]);
      }, 1500);
    }
  };

  const handleSaveMaterial = (materialId: string) => {
    setMaterials(prev => prev.map(m => 
      m.id === materialId ? { ...m, saved: true } : m
    ));
    showToast('Saved to Office Inbox', 'success');
  };

  const handleApproveAuthority = (id: string) => {
    setAuthorityQueue(prev => prev.filter(a => a.id !== id));
    showToast('Approved. Action executed.', 'success');
  };

  const handleDenyAuthority = (id: string) => {
    setAuthorityQueue(prev => prev.filter(a => a.id !== id));
    showToast('Denied. Action blocked.', 'info');
  };

  const handleAvaTap = () => {
    if (avaState === 'idle') {
      setAvaState('listening');
      setTimeout(() => {
        setAvaState('thinking');
        setTimeout(() => {
          setAvaState('speaking');
          setTimeout(() => {
            setAvaState('idle');
          }, 3000);
        }, 2000);
      }, 4000);
    }
  };

  const handleStopListening = () => {
    setAvaState('idle');
  };

  const activeSpeaker = participantsWithUI.find(p => p.id === activeSpeakerId) || participantsWithUI[0];
  const otherParticipants = participantsWithUI.filter(p => p.id !== activeSpeakerId);

  const getGridLayout = () => {
    const count = participantsWithUI.length;
    if (isDesktop) {
      if (count <= 1) return { cols: 1, rows: 1 };
      if (count <= 2) return { cols: 2, rows: 1 };
      if (count <= 4) return { cols: 2, rows: 2 };
      if (count <= 6) return { cols: 3, rows: 2 };
      return { cols: 3, rows: 3 };
    }
    if (count <= 1) return { cols: 1, rows: 1 };
    if (count <= 2) return { cols: 1, rows: 2 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 2, rows: 3 };
    return { cols: 3, rows: 3 };
  };

  const { cols, rows } = getGridLayout();
  const tileGap = isDesktop ? 2 : 6;
  const tilePadding = isDesktop ? 0 : 12;
  const bottomBarHeight = isDesktop ? 56 : 100;
  const availableWidth = (isDesktop ? windowWidth : SCREEN_WIDTH) - (tilePadding * 2);
  const availableHeight = (isDesktop ? windowHeight : SCREEN_HEIGHT) - bottomBarHeight;
  const tileWidth = (availableWidth - (tileGap * (cols - 1))) / cols;
  const tileHeight = (availableHeight - (tileGap * (rows - 1))) / rows;

  const conferenceContent = (
    <View style={[styles.container, isDesktop && styles.desktopContainer]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <Toast 
        visible={toastVisible} 
        message={toastMessage} 
        type={toastType}
        onHide={() => setToastVisible(false)} 
      />

      <View style={styles.topBar}>
        <LinearGradient
          colors={['rgba(0,0,0,0.8)', 'transparent']}
          style={styles.topBarGradient}
        >
          <View style={styles.topBarContent}>
            <View style={styles.callInfo}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live</Text>
              </View>
              <Text style={styles.callTimer}>{formatTime(elapsedTime)}</Text>
            </View>
            
            <View style={styles.meetingInfo}>
              <Text style={styles.meetingTitle}>Conference Room</Text>
              <View style={styles.sessionStateRow}>
                <View style={styles.sessionStateIndicator}>
                  <View style={[styles.sessionStateDot, { backgroundColor: Colors.semantic.success }]} />
                  <Text style={styles.sessionStateText}>Live</Text>
                </View>
                <Text style={styles.sessionStateSeparator}>•</Text>
                <View style={styles.sessionStateIndicator}>
                  <Ionicons name="radio" size={10} color={Colors.semantic.error} />
                  <Text style={styles.sessionStateText}>Recording</Text>
                </View>
                <Text style={styles.sessionStateSeparator}>•</Text>
                <View style={styles.sessionStateIndicator}>
                  <View style={[styles.sessionStateDot, { backgroundColor: Colors.accent.cyan }]} />
                  <Text style={styles.sessionStateText}>Ava Active</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.topBarActions}>
              <Pressable style={styles.topBarButton} onPress={handleToggleLayout}>
                <Ionicons 
                  name={layout === 'gallery' ? 'person' : 'grid'} 
                  size={18} 
                  color={Colors.text.primary} 
                />
              </Pressable>
              <Pressable 
                style={styles.topBarButton}
                onPress={() => setShowParticipants(true)}
              >
                <Ionicons name="people" size={18} color={Colors.text.primary} />
                <View style={styles.participantBadge}>
                  <Text style={styles.participantBadgeText}>{participantsWithUI.length}</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.videoArea}>
        {layout === 'gallery' ? (
          <View style={styles.galleryGrid}>
            {participantsWithUI.map((participant) => (
              <View
                key={participant.id}
                style={[styles.gridTileWrapper, { width: tileWidth, height: tileHeight }]}
              >
                <VideoTile
                  participant={participant}
                  isActiveSpeaker={participant.id === activeSpeakerId}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.speakerLayout}>
            <View style={styles.spotlightArea}>
              <VideoTile 
                participant={activeSpeaker}
                size="spotlight"
                isActiveSpeaker={true}
              />
            </View>
            <View style={styles.filmstrip}>
              {otherParticipants.map((participant) => (
                <Pressable 
                  key={participant.id}
                  onPress={() => setActiveSpeakerId(participant.id)}
                >
                  <VideoTile 
                    participant={participant}
                    size="small"
                  />
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={styles.bottomBar}>
        <View style={styles.avaIndicatorBar}>
          <Ionicons name="sparkles" size={12} color={Colors.accent.cyan} />
          <Text style={styles.avaBarText}>Ava listening</Text>
        </View>
        <View style={styles.controlsRow}>
          <Pressable 
            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            onPress={handleToggleMute}
          >
            <Ionicons 
              name={isMuted ? 'mic-off' : 'mic'} 
              size={18} 
              color={isMuted ? Colors.semantic.error : Colors.text.primary} 
            />
          </Pressable>
          <Pressable 
            style={[styles.controlButton, isVideoOff && styles.controlButtonActive]}
            onPress={handleToggleVideo}
          >
            <Ionicons 
              name={isVideoOff ? 'videocam-off' : 'videocam'} 
              size={18} 
              color={isVideoOff ? Colors.semantic.error : Colors.text.primary} 
            />
          </Pressable>
          <Pressable 
            style={styles.endCallButton}
            onPress={() => setShowEndModal(true)}
          >
            <Ionicons name="call" size={20} color={Colors.text.primary} />
          </Pressable>
          <Pressable style={styles.controlButton}>
            <Ionicons name="share-outline" size={18} color={Colors.text.primary} />
          </Pressable>
          <Pressable style={styles.controlButton}>
            <Ionicons name="chatbubble-ellipses" size={18} color={Colors.text.primary} />
          </Pressable>
        </View>
        <Pressable style={styles.leaveButton}>
          <Text style={styles.leaveButtonText}>Leave</Text>
        </Pressable>
      </View>

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
  );

  const getGridDimensions = (count: number) => {
    if (count <= 1) return { cols: 1, rows: 1 };
    if (count <= 2) return { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    if (count <= 9) return { cols: 3, rows: 3 };
    if (count <= 16) return { cols: 4, rows: 4 };
    if (count <= 25) return { cols: 5, rows: 5 };
    if (count <= 36) return { cols: 6, rows: 6 };
    return { cols: 7, rows: 7 };
  };

  const renderGalleryGrid = () => {
    const tiles = pagedTiles;
    const { cols } = getGridDimensions(tiles.length);
    const gap = 4;
    const rows: (typeof tiles)[] = [];
    for (let i = 0; i < tiles.length; i += cols) {
      rows.push(tiles.slice(i, i + cols));
    }

    const numRows = rows.length;
    return (
      <View style={desktopStyles.galleryContainer}>
        {rows.map((row, rowIdx) => {
          const isLastRow = rowIdx === rows.length - 1;
          const isOddLastRow = isLastRow && row.length < cols;
          return (
            <View key={rowIdx} style={[desktopStyles.galleryRow, isOddLastRow && { justifyContent: 'center' }]}>
              {row.map((participant) => (
                <View
                  key={participant.id}
                  style={[
                    desktopStyles.galleryTile,
                    {
                      width: `${(100 / cols) - 0.5}%` as any,
                    },
                  ]}
                >
                  {participant.id === 'ava' ? (
                    <AvaTile
                      avaState={avaState}
                      onPress={handleAvaTap}
                      onInnerBoxPress={handleInnerBoxPress}
                      isNoraSpeaking={isNoraSpeaking}
                      fillContainer={true}
                    />
                  ) : (
                    <LiveKitVideoTile
                      trackRef={trackRefMap.get(participant.id)}
                      name={participant.name}
                      isActiveSpeaker={participant.id === activeSpeakerId}
                      isLocal={participant.isHost}
                      webcamStream={webcamStream}
                    />
                  )}
                </View>
              ))}
            </View>
          );
        })}
        {totalPages > 1 && (
          <View style={desktopStyles.pageIndicator}>
            <Pressable
              style={[desktopStyles.pageArrow, galleryPage === 0 && { opacity: 0.3 }]}
              onPress={() => setGalleryPage(p => Math.max(0, p - 1))}
              disabled={galleryPage === 0}
            >
              <Ionicons name="chevron-back" size={16} color="#fff" />
            </Pressable>
            <Text style={desktopStyles.pageText}>Page {galleryPage + 1}/{totalPages}</Text>
            <Pressable
              style={[desktopStyles.pageArrow, galleryPage >= totalPages - 1 && { opacity: 0.3 }]}
              onPress={() => setGalleryPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={galleryPage >= totalPages - 1}
            >
              <Ionicons name="chevron-forward" size={16} color="#fff" />
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  const renderSpeakerView = () => (
    <View style={desktopStyles.speakerContainer}>
      <View style={desktopStyles.stageArea}>
        {stageParticipant && stageParticipant.id !== 'ava' ? (
          <LiveKitVideoTile
            trackRef={trackRefMap.get(stageParticipant.id)}
            name={stageParticipant.name}
            size="spotlight"
            isActiveSpeaker={true}
            isLocal={stageParticipant.isHost}
            webcamStream={webcamStream}
          />
        ) : (
          <AvaTile
            avaState={avaState}
            onPress={handleAvaTap}
            onInnerBoxPress={handleInnerBoxPress}
            isNoraSpeaking={isNoraSpeaking}
            fillContainer={true}
          />
        )}
      </View>
      <View style={desktopStyles.filmstripRight}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 4, padding: 4 }}>
          {filmstripParticipants.map((p) => (
            <Pressable
              key={p.id}
              style={desktopStyles.filmstripTile}
              onPress={() => p.id !== 'ava' && setActiveSpeakerId(p.id)}
            >
              {p.id === 'ava' ? (
                <AvaTile
                  avaState={avaState}
                  onPress={handleAvaTap}
                  onInnerBoxPress={handleInnerBoxPress}
                  isNoraSpeaking={isNoraSpeaking}
                  fillContainer={true}
                />
              ) : (
                <LiveKitVideoTile
                  trackRef={trackRefMap.get(p.id)}
                  name={p.name}
                  size="small"
                  isActiveSpeaker={false}
                  isLocal={p.isHost}
                  webcamStream={webcamStream}
                />
              )}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  const renderMultiSpeakerView = () => {
    const topSpeakers = filteredParticipants
      .filter(p => p.isSpeaking || p.id === activeSpeakerId)
      .slice(0, 4);
    if (topSpeakers.length === 0 && filteredParticipants.length > 0) {
      topSpeakers.push(filteredParticipants[0]);
    }
    const bottomTiles = allTiles.filter(p => !topSpeakers.find(s => s.id === p.id));

    return (
      <View style={desktopStyles.multiSpeakerContainer}>
        <View style={desktopStyles.multiStage}>
          {topSpeakers.map((p) => (
            <View key={p.id} style={[desktopStyles.multiStageTile, { width: `${100 / Math.max(topSpeakers.length, 1) - 1}%` as any }]}>
              <LiveKitVideoTile trackRef={trackRefMap.get(p.id)} name={p.name} size="spotlight" isActiveSpeaker={p.id === activeSpeakerId} isLocal={p.isHost} webcamStream={webcamStream} />
            </View>
          ))}
        </View>
        {bottomTiles.length > 0 && (
          <View style={desktopStyles.multiBottom}>
            {bottomTiles.map((p) => (
              <View key={p.id} style={desktopStyles.multiBottomTile}>
                {p.id === 'ava' ? (
                  <AvaTile avaState={avaState} onPress={handleAvaTap} onInnerBoxPress={handleInnerBoxPress} isNoraSpeaking={isNoraSpeaking} fillContainer={true} />
                ) : (
                  <LiveKitVideoTile trackRef={trackRefMap.get(p.id)} name={p.name} size="small" isLocal={p.isHost} webcamStream={webcamStream} />
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderShareOverlay = () => {
    if (shareMode === 'none') return null;
    const isSideBySide = shareMode.startsWith('sideBySide');

    return (
      <View style={desktopStyles.shareOverlay}>
        {isSideBySide ? (
          <View style={desktopStyles.sideBySideContainer}>
            <View style={[desktopStyles.shareContent, { flex: sideBySideDivider }]}>
              <View style={desktopStyles.sharePlaceholder}>
                <Ionicons name="desktop-outline" size={48} color="#555" />
                <Text style={desktopStyles.sharePlaceholderText}>Screen Share</Text>
              </View>
            </View>
            <Pressable
              style={desktopStyles.dividerHandle}
              {...(Platform.OS === 'web' ? {
                onMouseDown: () => {
                  isInteractingRef.current = true;
                },
              } : {} as any)}
            >
              <View style={desktopStyles.dividerLine} />
            </Pressable>
            <View style={[desktopStyles.shareVideoArea, { flex: 1 - sideBySideDivider }]}>
              {shareMode === 'sideBySideGallery' ? renderGalleryGrid() :
               shareMode === 'sideBySideMulti' ? renderMultiSpeakerView() :
               renderSpeakerView()}
            </View>
          </View>
        ) : (
          <View style={desktopStyles.standardShareContainer}>
            <View style={desktopStyles.sharePlaceholder}>
              <Ionicons name="desktop-outline" size={64} color="#555" />
              <Text style={desktopStyles.sharePlaceholderText}>Screen Share</Text>
            </View>
            <View style={desktopStyles.shareThumbnails}>
              {pagedTiles.slice(0, 6).map((p) => (
                <View key={p.id} style={desktopStyles.shareThumbnail}>
                  {p.id === 'ava' ? (
                    <AvaTile avaState={avaState} onPress={handleAvaTap} onInnerBoxPress={handleInnerBoxPress} isNoraSpeaking={isNoraSpeaking} fillContainer={true} />
                  ) : (
                    <LiveKitVideoTile trackRef={trackRefMap.get(p.id)} name={p.name} size="small" isLocal={p.isHost} />
                  )}
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderViewMenu = () => {
    if (!showViewMenu) return null;
    const modes: { mode: ViewMode; label: string; icon: string }[] = [
      { mode: 'gallery', label: 'Gallery', icon: 'grid' },
      { mode: 'speaker', label: 'Speaker', icon: 'person' },
      { mode: 'multiSpeaker', label: 'Multi-speaker', icon: 'people' },
      { mode: 'immersive', label: 'Immersive', icon: 'expand' },
      { mode: 'floatingThumbnail', label: 'Floating Thumbnail', icon: 'browsers' },
    ];

    return (
      <Pressable style={desktopStyles.viewMenuBackdrop} onPress={() => setShowViewMenu(false)}>
        <View style={desktopStyles.viewMenu}>
          <Text style={desktopStyles.viewMenuTitle}>Layout</Text>
          {modes.map((m) => (
            <Pressable
              key={m.mode}
              style={[desktopStyles.viewMenuItem, viewMode === m.mode && desktopStyles.viewMenuItemActive]}
              onPress={() => handleViewModeChange(m.mode)}
            >
              <Ionicons name={m.icon as any} size={16} color={viewMode === m.mode ? Colors.accent.cyan : '#A1A1AA'} />
              <Text style={[desktopStyles.viewMenuItemText, viewMode === m.mode && { color: Colors.accent.cyan }]}>{m.label}</Text>
              {viewMode === m.mode && <Ionicons name="checkmark" size={16} color={Colors.accent.cyan} />}
            </Pressable>
          ))}
          <View style={desktopStyles.viewMenuDivider} />
          <Pressable style={desktopStyles.viewMenuItem} onPress={() => { setHideNonVideo(!hideNonVideo); }}>
            <Ionicons name={hideNonVideo ? 'checkbox' : 'square-outline'} size={16} color="#A1A1AA" />
            <Text style={desktopStyles.viewMenuItemText}>Hide Non-video Participants</Text>
          </Pressable>
          <Pressable style={desktopStyles.viewMenuItem} onPress={() => { setHideSelfView(!hideSelfView); }}>
            <Ionicons name={hideSelfView ? 'checkbox' : 'square-outline'} size={16} color="#A1A1AA" />
            <Text style={desktopStyles.viewMenuItemText}>Hide Self View</Text>
          </Pressable>
          <View style={desktopStyles.viewMenuDivider} />
          <Text style={desktopStyles.viewMenuSectionTitle}>Share Mode</Text>
          {([
            { mode: 'none' as ShareMode, label: 'No Sharing' },
            { mode: 'standard' as ShareMode, label: 'Standard' },
            { mode: 'sideBySideSpeaker' as ShareMode, label: 'Side-by-side Speaker' },
            { mode: 'sideBySideGallery' as ShareMode, label: 'Side-by-side Gallery' },
            { mode: 'sideBySideMulti' as ShareMode, label: 'Side-by-side Multi' },
          ]).map((s) => (
            <Pressable
              key={s.mode}
              style={[desktopStyles.viewMenuItem, shareMode === s.mode && desktopStyles.viewMenuItemActive]}
              onPress={() => { setShareMode(s.mode); }}
            >
              <Text style={[desktopStyles.viewMenuItemText, shareMode === s.mode && { color: Colors.accent.cyan }]}>{s.label}</Text>
              {shareMode === s.mode && <Ionicons name="checkmark" size={14} color={Colors.accent.cyan} />}
            </Pressable>
          ))}
        </View>
      </Pressable>
    );
  };

  const renderImmersiveView = () => (
    <View style={desktopStyles.immersiveContainer}>
      <LinearGradient colors={['#0a0a0c', '#111827', '#0a0a0c']} style={desktopStyles.immersiveBg}>
        <Text style={desktopStyles.immersiveLabel}>Immersive View</Text>
        <Text style={desktopStyles.immersiveSub}>Coming soon</Text>
      </LinearGradient>
    </View>
  );

  const renderFloatingThumbnail = () => {
    if (isFullscreen) return null;
    return (
      <View style={desktopStyles.floatingThumbnailContainer}>
        <View style={desktopStyles.floatingThumbnailInner}>
          {stageParticipant && stageParticipant.id !== 'ava' ? (
            <LiveKitVideoTile trackRef={trackRefMap.get(stageParticipant.id)} name={stageParticipant.name} size="small" isActiveSpeaker={true} isLocal={stageParticipant.isHost} />
          ) : (
            <AvaTile avaState={avaState} onPress={handleAvaTap} onInnerBoxPress={handleInnerBoxPress} isNoraSpeaking={isNoraSpeaking} fillContainer={true} />
          )}
        </View>
      </View>
    );
  };

  if (isDesktop) {
    return (
      <FullscreenSessionShell showBackButton={false} backLabel="Exit Conference">
        <LiveKitConferenceProvider
          token={liveKitToken}
          serverUrl={process.env.EXPO_PUBLIC_LIVEKIT_URL || 'wss://aspire-3rdm9zjn.livekit.cloud'}
        >
        <View style={desktopStyles.container}>
          <Toast
            visible={toastVisible}
            message={toastMessage}
            type={toastType}
            onHide={() => setToastVisible(false)}
          />

          <View style={desktopStyles.videoSection} {...(Platform.OS === 'web' ? { 'data-video-section': true } as any : {})}>
            <Animated.View style={[desktopStyles.topBar, { opacity: chromeOpacity }, chromeMode === 'hidden' && !alwaysShowControls && { pointerEvents: 'none' as any }]}>
              <View style={desktopStyles.callInfo}>
                <View style={desktopStyles.liveBadge}>
                  <View style={desktopStyles.liveDot} />
                  <Text style={desktopStyles.liveText}>Live</Text>
                </View>
                <Text style={desktopStyles.callTimer}>{formatTime(elapsedTime)}</Text>
              </View>
              <View style={desktopStyles.meetingInfo}>
                <Text style={desktopStyles.meetingTitle}>Conference Room</Text>
                <View style={desktopStyles.sessionBadges}>
                  <View style={desktopStyles.recordingBadge}>
                    <Ionicons name="radio" size={10} color={Colors.semantic.error} />
                    <Text style={desktopStyles.recordingText}>Recording</Text>
                  </View>
                  <View style={desktopStyles.avaBadge}>
                    <Ionicons name="sparkles" size={10} color={Colors.accent.cyan} />
                    <Text style={desktopStyles.avaText}>Ava Active</Text>
                  </View>
                </View>
              </View>
              <View style={desktopStyles.topBarActions}>
                <Pressable
                  style={[desktopStyles.topBarButton, showViewMenu && desktopStyles.topBarButtonActive]}
                  onPress={() => setShowViewMenu(!showViewMenu)}
                >
                  <Ionicons name="options" size={18} color="#fff" />
                </Pressable>
                <Pressable
                  style={[desktopStyles.topBarButton, isFullscreen && desktopStyles.topBarButtonActive]}
                  onPress={toggleFullscreen}
                >
                  <Ionicons name={isFullscreen ? 'contract' : 'expand'} size={18} color="#fff" />
                </Pressable>
                <Pressable
                  style={desktopStyles.topBarButton}
                  onPress={() => setParticipantsPanelVisible(!participantsPanelVisible)}
                >
                  <Ionicons name="people" size={18} color="#fff" />
                  <View style={desktopStyles.participantBadge}>
                    <Text style={desktopStyles.participantBadgeText}>{allTiles.length}</Text>
                  </View>
                </Pressable>
              </View>
            </Animated.View>

            <View style={desktopStyles.videoArea}>
              {renderViewMenu()}

              {shareMode !== 'none' ? renderShareOverlay() : (
                <>
                  {viewMode === 'gallery' && renderGalleryGrid()}
                  {viewMode === 'speaker' && renderSpeakerView()}
                  {viewMode === 'multiSpeaker' && renderMultiSpeakerView()}
                  {viewMode === 'immersive' && renderImmersiveView()}
                  {viewMode === 'floatingThumbnail' && renderFloatingThumbnail()}
                </>
              )}
            </View>

            <Animated.View style={[desktopStyles.controlBar, { opacity: chromeOpacity }, chromeMode === 'hidden' && !alwaysShowControls && { pointerEvents: 'none' as any }]}>
              <View style={desktopStyles.avaIndicatorBar}>
                <Ionicons name="sparkles" size={12} color={Colors.accent.cyan} />
                <Text style={desktopStyles.avaBarText}>Ava {avaState === 'idle' ? 'ready' : avaState}</Text>
              </View>
              <View style={desktopStyles.controlsRow}>
                <Pressable
                  style={[desktopStyles.controlButton, isMuted && desktopStyles.controlButtonActive]}
                  onPress={handleToggleMute}
                >
                  <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={20} color={isMuted ? Colors.semantic.error : '#fff'} />
                  <Text style={desktopStyles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
                </Pressable>
                <Pressable
                  style={[desktopStyles.controlButton, isVideoOff && desktopStyles.controlButtonActive]}
                  onPress={handleToggleVideo}
                >
                  <Ionicons name={isVideoOff ? 'videocam-off' : 'videocam'} size={20} color={isVideoOff ? Colors.semantic.error : '#fff'} />
                  <Text style={desktopStyles.controlLabel}>{isVideoOff ? 'Start Video' : 'Stop Video'}</Text>
                </Pressable>
                <Pressable
                  style={desktopStyles.controlButton}
                  onPress={() => setShareMode(shareMode === 'none' ? 'standard' : 'none')}
                >
                  <Ionicons name="desktop-outline" size={20} color={shareMode !== 'none' ? Colors.accent.cyan : '#fff'} />
                  <Text style={desktopStyles.controlLabel}>Share Screen</Text>
                </Pressable>
                <Pressable
                  style={desktopStyles.controlButton}
                  onPress={() => setParticipantsPanelVisible(!participantsPanelVisible)}
                >
                  <Ionicons name="people" size={20} color={participantsPanelVisible ? Colors.accent.cyan : '#fff'} />
                  <Text style={desktopStyles.controlLabel}>Participants</Text>
                </Pressable>
                <Pressable
                  style={desktopStyles.controlButton}
                  onPress={() => setChatVisible(!chatVisible)}
                >
                  <View>
                    <Ionicons name="chatbubble" size={20} color={chatVisible ? Colors.accent.cyan : '#fff'} />
                    {messages.length > 0 && (
                      <View style={desktopStyles.chatBadge}>
                        <Text style={desktopStyles.chatBadgeText}>{messages.length}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={desktopStyles.controlLabel}>Chat</Text>
                </Pressable>
                <Pressable
                  style={desktopStyles.controlButton}
                  onPress={() => setShowViewMenu(!showViewMenu)}
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
                  <Text style={desktopStyles.controlLabel}>More</Text>
                </Pressable>
              </View>
              <Pressable style={desktopStyles.leaveButton} onPress={() => setShowEndModal(true)}>
                <Text style={desktopStyles.leaveButtonText}>Leave</Text>
              </Pressable>
            </Animated.View>
          </View>

          {participantsPanelVisible && (
            <View style={desktopStyles.participantsPanel}>
              <View style={desktopStyles.participantsPanelHeader}>
                <Text style={desktopStyles.participantsPanelTitle}>Participants ({allTiles.length})</Text>
                <Pressable onPress={() => setParticipantsPanelVisible(false)} style={desktopStyles.closeDrawerButton}>
                  <Ionicons name="close" size={18} color="#fff" />
                </Pressable>
              </View>
              <ScrollView style={desktopStyles.participantsList}>
                {allTiles.map((p) => (
                  <View key={p.id} style={desktopStyles.participantRow}>
                    <View style={desktopStyles.participantInfo}>
                      <View style={[desktopStyles.participantDot, { backgroundColor: p.avatarColor }]} />
                      <Text style={desktopStyles.participantName}>{p.name}</Text>
                      <Text style={desktopStyles.participantRole}>{p.role}</Text>
                    </View>
                    <View style={desktopStyles.participantActions}>
                      {p.isMuted && <Ionicons name="mic-off" size={14} color={Colors.semantic.error} />}
                      {p.isHost && <Ionicons name="star" size={14} color={Colors.semantic.warning} />}
                      {p.id !== 'ava' && (
                        <>
                          <Pressable onPress={() => handlePinParticipant(p.id)} style={desktopStyles.tileActionBtn}>
                            <Ionicons name={p.isPinned ? 'pin' : 'pin-outline'} size={14} color={p.isPinned ? Colors.accent.cyan : '#666'} />
                          </Pressable>
                          {participants.find(pp => pp.id === 'you')?.isHost && (
                            <Pressable onPress={() => handleSpotlightParticipant(p.id)} style={desktopStyles.tileActionBtn}>
                              <Ionicons name={p.isSpotlighted ? 'flash' : 'flash-outline'} size={14} color={p.isSpotlighted ? Colors.semantic.warning : '#666'} />
                            </Pressable>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <ConferenceChatDrawer
            visible={chatVisible}
            onClose={() => setChatVisible(false)}
            messages={messages as DrawerChatMessage[]}
            materials={materials as DrawerMaterialItem[]}
            onSendMessage={(text, isPrivate) => {
              const newMessage = {
                id: `msg-${Date.now()}`,
                senderId: 'you',
                senderName: 'You',
                text,
                timestamp: new Date(),
                isPrivate,
              };
              setMessages(prev => [...prev, newMessage]);
            }}
            onSaveMaterial={(id) => {
              setMaterials(prev => prev.map(m => m.id === id ? { ...m, saved: true } : m));
            }}
            authorityQueue={authorityQueue as DrawerAuthorityItem[]}
            onApproveAuthority={(id) => {
              setAuthorityQueue(prev => prev.filter(a => a.id !== id));
            }}
            onDenyAuthority={(id) => {
              setAuthorityQueue(prev => prev.filter(a => a.id !== id));
            }}
          />

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
        </LiveKitConferenceProvider>
      </FullscreenSessionShell>
    );
  }

  return conferenceContent;
}

const desktopStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  videoSection: {
    flex: 1,
    backgroundColor: '#000',
    flexDirection: 'column',
  },
  topBar: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(10,10,12,0.85)',
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
    zIndex: 200,
  },
  videoArea: {
    flex: 1,
    overflow: 'hidden',
  },
  callInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.25)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.semantic.success,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.semantic.success,
  },
  callTimer: {
    fontSize: 14,
    fontWeight: '500',
    color: '#D4D4D8',
    fontVariant: ['tabular-nums'],
  },
  meetingInfo: {
    alignItems: 'center',
  },
  meetingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  sessionBadges: {
    flexDirection: 'row',
    gap: 12,
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recordingText: {
    fontSize: 11,
    color: Colors.semantic.error,
  },
  avaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  avaText: {
    fontSize: 11,
    color: Colors.accent.cyan,
  },
  topBarActions: {
    flexDirection: 'row',
    gap: 8,
  },
  topBarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  topBarButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  participantBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.accent.cyan,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  galleryContainer: {
    flex: 1,
    padding: 6,
    gap: 4,
  },
  galleryRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'flex-start',
  },
  galleryTile: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  pageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  pageArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  pageText: {
    fontSize: 12,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  speakerContainer: {
    flex: 1,
    flexDirection: 'row',
    padding: 8,
    gap: 6,
  },
  stageArea: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  filmstripRight: {
    width: 180,
  },
  filmstripTile: {
    width: 172,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  multiSpeakerContainer: {
    flex: 1,
    padding: 8,
    gap: 6,
  },
  multiStage: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  multiStageTile: {
    borderRadius: 10,
    overflow: 'hidden',
    aspectRatio: 16 / 9,
  },
  multiBottom: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    paddingTop: 4,
  },
  multiBottomTile: {
    width: 160,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  immersiveContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  immersiveBg: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  immersiveLabel: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  immersiveSub: {
    fontSize: 14,
    color: '#A1A1AA',
  },
  floatingThumbnailContainer: {
    position: 'absolute',
    bottom: 80,
    right: 24,
    width: 240,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#2C2C2E',
    zIndex: 150,
  },
  floatingThumbnailInner: {
    flex: 1,
  },
  shareOverlay: {
    flex: 1,
  },
  sideBySideContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  shareContent: {
    backgroundColor: '#0a0a0c',
    borderRightWidth: 1,
    borderRightColor: '#2C2C2E',
  },
  sharePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  sharePlaceholderText: {
    fontSize: 16,
    color: '#555',
    fontWeight: '500',
  },
  dividerHandle: {
    width: 8,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'col-resize' as any,
  },
  dividerLine: {
    width: 3,
    height: 32,
    borderRadius: 2,
    backgroundColor: '#3C3C3E',
  },
  shareVideoArea: {
    backgroundColor: '#000',
  },
  standardShareContainer: {
    flex: 1,
    position: 'relative',
  },
  shareThumbnails: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  shareThumbnail: {
    width: 120,
    height: 72,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  viewMenuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 300,
  },
  viewMenu: {
    position: 'absolute',
    top: 60,
    right: 24,
    width: 260,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    padding: 8,
    zIndex: 301,
  },
  viewMenuTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A1A1AA',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  viewMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  viewMenuItemActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  viewMenuItemText: {
    flex: 1,
    fontSize: 13,
    color: '#D4D4D8',
    fontWeight: '500',
  },
  viewMenuDivider: {
    height: 1,
    backgroundColor: '#2C2C2E',
    marginVertical: 6,
  },
  viewMenuSectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 4,
  },
  participantsPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 320,
    backgroundColor: '#141414',
    borderLeftWidth: 1,
    borderLeftColor: '#2C2C2E',
    zIndex: 200,
  },
  participantsPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  participantsPanelTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  closeDrawerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantsList: {
    flex: 1,
    padding: 8,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 2,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  participantDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  participantName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#D4D4D8',
  },
  participantRole: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
  },
  participantActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tileActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBar: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: 'rgba(20,20,20,0.85)',
    borderTopWidth: 1,
    borderTopColor: '#1C1C1E',
    zIndex: 200,
  },
  avaIndicatorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  avaBarText: {
    fontSize: 12,
    color: Colors.accent.cyan,
    fontWeight: '500',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
  },
  controlLabel: {
    fontSize: 10,
    color: '#A1A1AA',
    marginTop: 4,
    fontWeight: '500',
  },
  chatBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.semantic.error,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  desktopContainer: {
    borderRadius: 0,
    margin: 0,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  topBarGradient: {
    paddingTop: 50,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  callInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.semantic.success,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.semantic.success,
  },
  callTimer: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  meetingInfo: {
    alignItems: 'center',
    flex: 1,
  },
  meetingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  sessionStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  sessionStateIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sessionStateDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  sessionStateText: {
    fontSize: 10,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  sessionStateSeparator: {
    fontSize: 10,
    color: Colors.text.muted,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  topBarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#242426',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.accent.cyan,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  videoArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignContent: 'center',
    gap: 2,
    flex: 1,
  },
  gridTileWrapper: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  speakerLayout: {
    flex: 1,
    paddingHorizontal: 8,
  },
  spotlightArea: {
    flex: 1,
    marginBottom: 8,
  },
  filmstrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 8,
  },
  videoTile: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: Colors.background.tertiary,
    position: 'relative',
  },
  videoTileSmall: {
    width: 80,
    height: 60,
    flex: 0,
  },
  videoTileSpotlight: {
    flex: 1,
  },
  videoTileActive: {},
  videoOffContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoFeed: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  avatarInitialsSmall: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  tileOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  tileBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  tileName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  tileNameSmall: {
    fontSize: 10,
  },
  hostBadge: {
    backgroundColor: 'rgba(212, 160, 23, 0.3)',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutedIndicator: {
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakingBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BorderRadius.md,
    borderWidth: 3,
    borderColor: Colors.semantic.success,
  },
  avaAvatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  avaAvatarCircleActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    borderColor: Colors.accent.cyan,
  },
  avaLogoImageSmall: {
    width: 48,
    height: 48,
  },
  avaBadgeSmall: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  avaStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avaStatusBadgeActive: {},
  avaStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  avaStatusDotActive: {
    backgroundColor: Colors.semantic.success,
  },
  avaTileContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  avaTileBackground: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  avaTileGlow: {
    shadowColor: '#3B82F6',
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  avaLogoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avaInnerGlowBox: {
    width: 180,
    height: 180,
    borderRadius: 12,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avaLogoImage: {
    width: 140,
    height: 140,
  },
  avaLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avaAssistantName: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 0.3,
  },
  avaStatusDotNew: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  avatarContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
  },
  avaIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(79, 172, 254, 0.2)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    height: 56,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  avaIndicatorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 172, 254, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  avaBarText: {
    fontSize: 11,
    color: Colors.accent.cyan,
    fontWeight: '500',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#242426',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
  },
  endCallButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.semantic.error,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '135deg' }],
  },
  leaveButton: {
    backgroundColor: Colors.semantic.error,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  leaveButtonText: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
