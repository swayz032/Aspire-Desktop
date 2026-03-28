import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { trackInteraction } from '@/lib/interactionTelemetry';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Platform, Animated, Linking, Alert, Image, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/tokens';
import { ShimmeringText } from '@/components/ui/ShimmeringText';
import { useVoice, type VoiceDiagnosticEvent } from '@/hooks/useVoice';
import { useSupabase, useTenant } from '@/providers';
import { connectAnamAvatar, clearConversationHistory, type AnamClientInstance, AnamConnectOptions, interruptPersona, muteAnamInput, unmuteAnamInput, sendThinkingFiller } from '@/lib/anam';
import {
  type FileAttachment,
  ThinkingIndicator,
  MessagePartRenderer,
} from '@/components/chat';
import { playConnectionSound, playSuccessSound } from '@/lib/soundEffects';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { isLocalSyntheticAuthBypass } from '@/lib/supabaseRuntime';
import { useAvaChat } from '@/hooks/useAvaChat';
import type { UIMessage } from 'ai';

const ANAM_AVA_PERSONA_ID = '58f82b89-8ae7-43cc-930d-be8def14dff3';

type AvaMode = 'voice' | 'video';
type VideoConnectionState = 'idle' | 'connecting' | 'connected';


function AvaOrbVideoInline({ size = 320 }: { size?: number }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.textContent = `
        video.ava-orb-video::-webkit-media-controls,
        video.ava-orb-video::-webkit-media-controls-enclosure,
        video.ava-orb-video::-webkit-media-controls-panel,
        video.ava-orb-video::-webkit-media-controls-start-playback-button,
        video.ava-orb-video::-webkit-media-controls-overlay-play-button {
          display: none !important;
          -webkit-appearance: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        video.ava-orb-video::-moz-media-controls { display: none !important; }
        video.ava-orb-video { object-fit: contain; }
      `;
      document.head.appendChild(style);

      const vid = videoRef.current;
      if (vid) {
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.play().catch(() => {});
      }

      return () => { document.head.removeChild(style); };
    }
  }, []);

  if (Platform.OS !== 'web') return null;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <video
        ref={videoRef as any}
        className="ava-orb-video"
        src="/ava-orb.mp4"
        autoPlay
        loop
        muted
        playsInline
        controls={false}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          background: 'transparent',
        }}
      />
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, background: 'transparent' }} />
    </div>
  );
}



function AvaDeskPanelInner() {
  const [mode, setMode] = useState<AvaMode>('voice');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isConversing, setIsConversing] = useState(false);
  const [videoState, setVideoState] = useState<VideoConnectionState>('idle');
  const [connectionStatus, setConnectionStatus] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [latestVoiceDiagnostic, setLatestVoiceDiagnostic] = useState<VoiceDiagnosticEvent | null>(null);
  const runTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const connectingAnim = useRef(new Animated.Value(0)).current;
  const voiceLineAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);
  const connectionTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const dotPulseAnim = useRef(new Animated.Value(1)).current;
  const anamStreamMessageIdRef = useRef<string | null>(null);

  /** Show a voice/video error banner that auto-clears after 5s */
  const showVoiceError = useCallback((msg: string) => {
    setVoiceError(msg);
    setTimeout(() => setVoiceError(null), 5000);
  }, []);

  // Tenant context for voice requests (Law #6: Tenant Isolation)
  const { suiteId, session } = useSupabase();
  const { tenant } = useTenant();
  const [bootstrapIdentity, setBootstrapIdentity] = useState<{
    businessName?: string;
    suiteDisplayId?: string;
    officeDisplayId?: string;
  } | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('aspire.bootstrap.identity');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setBootstrapIdentity({
        businessName: parsed.businessName || undefined,
        suiteDisplayId: parsed.suiteDisplayId || undefined,
        officeDisplayId: parsed.officeDisplayId || undefined,
      });
    } catch {
      // Ignore malformed cache.
    }
  }, []);
  const suiteDisplayId = tenant?.displayId || bootstrapIdentity?.suiteDisplayId || '';
  const officeDisplayId = tenant?.officeDisplayId || bootstrapIdentity?.officeDisplayId || '';
  const resolvedBusinessName = tenant?.businessName || bootstrapIdentity?.businessName || 'Your Company';
  const companyPillLabel = resolvedBusinessName;

  // W4: Authority queue polling — provides context to orchestrator (approvals shown in Authority Queue, not chat)
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);

  // Vercel AI SDK chat — source of truth for all Aspire chat (Law #1)
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const videoStateRef = useRef(videoState);
  videoStateRef.current = videoState;

  const avaChatResult = useAvaChat({
    onResponseText: (text) => {
      // Pipe response to Anam avatar TTS when video is active
      if (modeRef.current === 'video' && videoStateRef.current === 'connected' && anamClientRef.current) {
        try { anamClientRef.current.talk(text); } catch { /* ignore */ }
      }
    },
    extraBody: {
      pendingApprovals: pendingApprovals.length,
      approvalSummary: pendingApprovals.slice(0, 3).map((p: unknown) => (p as Record<string, string>).title || (p as Record<string, string>).type || 'Approval'),
    },
  });

  const {
    messages,
    sendMessage,
    status: chatStatus,
    setMessages,
  } = avaChatResult;

  // Input state managed locally (AI SDK v6 useChat doesn't include input/setInput)
  const [chatInput, setChatInput] = useState('');

  // Derive isConversing from AI SDK status
  const isChatActive = chatStatus === 'submitted' || chatStatus === 'streaming';

  // Sync isConversing with AI SDK status for voice line animation
  useEffect(() => {
    setIsConversing(isChatActive);
  }, [isChatActive]);

  // Helper to append a UIMessage without triggering API call
  const appendLocalMessage = useCallback(
    (role: 'user' | 'assistant', text: string) => {
      const msg: UIMessage = {
        id: `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        role,
        parts: [{ type: 'text' as const, text }],
      };
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    },
    [setMessages],
  );

  // Fetch a dynamic greeting from the orchestrator on mount
  useEffect(() => {
    if (isLocalSyntheticAuthBypass()) return;
    if (!suiteId || !session?.access_token) return;
    const fetchGreeting = async () => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Suite-Id': suiteId,
          'Authorization': `Bearer ${session.access_token}`,
        };
        const resp = await fetch('/api/orchestrator/intent', {
          method: 'POST',
          headers,
          body: JSON.stringify({ agent: 'ava', text: '__greeting__', channel: 'chat' }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const greeting = data.response || data.text;
          if (greeting && typeof greeting === 'string') {
            setMessages([{
              id: `greeting_${Date.now()}`,
              role: 'assistant' as const,
              parts: [{ type: 'text' as const, text: greeting }],
            }]);
          }
        }
      } catch {
        // Silent fail — no greeting is better than a stale one
      }
    };
    fetchGreeting();
  }, [suiteId, session?.access_token, setMessages]);

  useEffect(() => {
    if (isLocalSyntheticAuthBypass()) return;
    const fetchApprovals = async () => {
      try {
        const res = await fetch('/api/authority-queue', {
          headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setPendingApprovals(data.pendingApprovals || []);
        }
      } catch (e) { /* authority queue not available */ }
    };

    fetchApprovals();
    const interval = setInterval(fetchApprovals, 30000);
    return () => clearInterval(interval);
  }, [session?.access_token]);

  // Orchestrator-routed voice: STT â†' Orchestrator â†' TTS (Law #1: Single Brain)
  const avaVoice = useVoice({
    agent: 'ava',
    suiteId: suiteId ?? undefined,
    accessToken: session?.access_token,
    userProfile: tenant ? {
      ownerName: tenant.ownerName,
      businessName: tenant.businessName,
      industry: tenant.industry ?? undefined,
      teamSize: tenant.teamSize ?? undefined,
      industrySpecialty: tenant.industrySpecialty ?? undefined,
      businessGoals: tenant.businessGoals ?? undefined,
      painPoint: tenant.painPoint ?? undefined,
      preferredChannel: tenant.preferredChannel ?? undefined,
    } : undefined,
    onStatusChange: (voiceStatus) => {
      setIsSessionActive(voiceStatus !== 'idle' && voiceStatus !== 'error');
    },
    onTranscript: (text) => {
      // W5: Voice transcript → chat (user message with voice indicator)
      appendLocalMessage('user', `\uD83C\uDFA4 ${text}`);
    },
    onResponse: (text, receiptId) => {
      // W5: Voice response → chat (Ava message synced from voice)
      appendLocalMessage('assistant', text);
    },
    onError: (error) => {
      console.error('Ava voice error:', error);
      setIsSessionActive(false);
      // Classify and surface the error to the user
      const msg = error.message || String(error);
      if (/auth_required/i.test(msg)) {
        showVoiceError('Session expired. Please sign in again.');
      } else if (/circuit_open/i.test(msg)) {
        showVoiceError('Ava Brain is warming back up. Try again in a few seconds.');
      } else if (/orchestrator_timeout|timeout/i.test(msg)) {
        showVoiceError('Ava took too long to respond. Please try again.');
      } else if (/autoplay|not allowed|play\(\)/i.test(msg)) {
        showVoiceError('Tap anywhere on the page, then try again.');
      } else if (/permission|denied|not found.*microphone|getUserMedia/i.test(msg)) {
        showVoiceError('Microphone access denied. Check browser permissions.');
      } else if (/tts|voice.*unavailable|synthesis|elevenlabs/i.test(msg)) {
        showVoiceError('Voice unavailable â€" responses shown in chat.');
      } else {
        showVoiceError(msg.length > 80 ? msg.slice(0, 80) + '...' : msg);
      }
    },
    onDiagnostic: (diag) => {
      setLatestVoiceDiagnostic(diag);
      if (diag.stage === 'autoplay') {
        showVoiceError(`Audio blocked by browser. Tap voice again to retry. Trace: ${diag.traceId}`);
      }
    },
  });

  const handleCompanyPillPress = useCallback(async () => {
    if (latestVoiceDiagnostic?.stage === 'autoplay') {
      const replayed = await avaVoice.replayLastAudio();
      if (replayed) return;
    }
    if (avaVoice.isActive) {
      avaVoice.endSession();
    } else {
      try {
        await avaVoice.startSession();
        await avaVoice.sendText('Confirm voice is live in one short sentence and ask how you can help.', { silent: true });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('Failed to start Ava voice session:', msg);
        if (/auth_required/i.test(msg)) {
          showVoiceError('Session expired. Please sign in again.');
        } else if (/circuit_open/i.test(msg)) {
          showVoiceError('Ava Brain is warming back up. Try again in a few seconds.');
        } else if (/permission|denied|getUserMedia/i.test(msg)) {
          showVoiceError('Microphone access denied. Check browser permissions.');
        } else {
          showVoiceError(`Voice session failed: ${msg.length > 60 ? msg.slice(0, 60) + '...' : msg}`);
        }
      }
    }
  }, [avaVoice, showVoiceError, latestVoiceDiagnostic]);

  useEffect(() => {
    if (isSessionActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isSessionActive]);

  useEffect(() => {
    if (videoState === 'connecting') {
      Animated.loop(
        Animated.timing(connectingAnim, { toValue: 1, duration: 1500, useNativeDriver: false })
      ).start();
    } else {
      connectingAnim.setValue(0);
    }
  }, [videoState]);

  useEffect(() => {
    if (isConversing) {
      const randomPulse = () => {
        const duration = 150 + Math.random() * 300;
        const toValue = 0.4 + Math.random() * 0.6;
        Animated.sequence([
          Animated.timing(voiceLineAnim, { toValue, duration, useNativeDriver: false }),
          Animated.timing(voiceLineAnim, { toValue: 1, duration: duration * 0.8, useNativeDriver: false }),
        ]).start(() => {
          if (isConversing) randomPulse();
        });
      };
      randomPulse();
    } else {
      voiceLineAnim.setValue(1);
    }
  }, [isConversing]);

  useEffect(() => {
    return () => {
      connectionTimeouts.current.forEach(clearTimeout);
      connectionTimeouts.current = [];
    };
  }, []);

  const isAvaSpeaking = avaVoice.status === 'speaking';

  useEffect(() => {
    if (isAvaSpeaking) {
      setIsConversing(true);
      const pulseAnimation = () => {
        Animated.sequence([
          Animated.timing(dotPulseAnim, { toValue: 1.8, duration: 200, useNativeDriver: false }),
          Animated.timing(dotPulseAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        ]).start(() => {
          if (isAvaSpeaking) pulseAnimation();
        });
      };
      pulseAnimation();
    } else {
      setIsConversing(false);
      dotPulseAnim.setValue(1);
    }
  }, [isAvaSpeaking]);

  const clearConnectionTimeouts = useCallback(() => {
    connectionTimeouts.current.forEach(clearTimeout);
    connectionTimeouts.current = [];
  }, []);

  const anamClientRef = useRef<AnamClientInstance | null>(null);

  const handleConnectToAva = useCallback(async () => {
    if (videoState !== 'idle') return;
    trackInteraction('agent_connect', 'ava-desk-panel', { mode: 'video', agent: 'ava' });

    clearConnectionTimeouts();
    setVideoState('connecting');
    setConnectionStatus('Connecting to Ava...');
    playConnectionSound();

    const t1 = setTimeout(() => {
      setConnectionStatus('Establishing secure video...');
    }, 800);

    // Timeout fallback â€" 15s for SDK WebRTC handshake (Law #3: Fail Closed)
    const t2 = setTimeout(() => {
      setVideoState('idle');
      setConnectionStatus('');
      anamClientRef.current = null;
      Alert.alert('Connection Timeout', 'Unable to connect to Ava video. Please try again.');
    }, 15000);

    connectionTimeouts.current = [t1, t2];

    try {
      // Wait for React to render the <video> element before streaming
      await new Promise(resolve => setTimeout(resolve, 100));

      // Anam SDK: fetch session token â†' create client (CUSTOMER_CLIENT_V1) â†' stream to <video>
      const connectOptions: AnamConnectOptions = {
        onConnectionEstablished: () => {
          console.log('[Anam] WebRTC connection established');
        },
        onVideoStarted: () => {
          console.log('[Anam] Video stream playing');
          clearConnectionTimeouts();
          playSuccessSound();
          setVideoState('connected');
          setConnectionStatus('');

          // Greeting fires after video is visible + 800ms buffer for avatar to fully initialize
          setTimeout(() => {
            if (anamClientRef.current && typeof (anamClientRef.current as any).talk === 'function') {
              const ownerName = tenant?.ownerName;
              const lastName = ownerName?.trim().split(' ').pop();
              const hour = new Date().getHours();
              const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
              const greeting = lastName
                ? `${timeGreeting}, Mr. ${lastName}. I'm Ava, your chief of staff. What can I help you with?`
                : `${timeGreeting}! I'm Ava, your chief of staff. How can I help you today?`;
              (anamClientRef.current as any).talk(greeting);
            }
          }, 800);
        },
        onConnectionClosed: (reason, details) => {
          console.log('[Anam] Connection closed', reason ? { reason, details } : undefined);
          setVideoState('idle');
          setConnectionStatus('');
          anamClientRef.current = null;
        },
        onUserMessage: async (userMessage: string) => {
          // Show user message in chat
          appendLocalMessage('user', `\uD83C\uDFA4 ${userMessage}`);
          anamStreamMessageIdRef.current = null;

          // Wave 2A: Send immediate "thinking" filler to prevent Anam's engine
          // timeout from generating "I can't think right now" fallback.
          if (anamClientRef.current) {
            sendThinkingFiller(anamClientRef.current);
          }
        },
        onMessageStream: (text, role) => {
          if (!text?.trim()) return;
          const normalizedRole = String(role || '').toLowerCase();
          if (!['assistant', 'persona'].includes(normalizedRole)) return;

          const currentId = anamStreamMessageIdRef.current;
          if (!currentId) {
            const id = `anam_ava_${Date.now()}`;
            anamStreamMessageIdRef.current = id;
            setMessages((prev) => [...prev, {
              id,
              role: 'assistant' as const,
              parts: [{ type: 'text' as const, text }],
            }]);
          } else {
            setMessages((prev) => prev.map((msg) =>
              msg.id === currentId
                ? { ...msg, parts: [{ type: 'text' as const, text: msg.parts.filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text').map(p => p.text).join('') + text }] }
                : msg
            ));
          }
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
        },
      };
      const client = await connectAnamAvatar('anam-video-element', session?.access_token, connectOptions);
      anamClientRef.current = client;

      // Event listeners registered inside connectAnamAvatar via setupAllEventListeners.
      // Video state + greeting are triggered by onVideoStarted callback above —
      // keeps spinner visible until avatar is actually rendering on screen.
    } catch (error: any) {
      clearConnectionTimeouts();
      anamClientRef.current = null;
      setVideoState('idle');
      setConnectionStatus('');
      const msg = error?.message || String(error);
      console.error('Video connection failed:', msg);

      // Classify error with actionable message
      if (/not configured|503|AVATAR_NOT_CONFIGURED/i.test(msg)) {
        showVoiceError('Ava video not configured for this environment. Voice mode is ready.');
      } else if (/not found in DOM/i.test(msg)) {
        showVoiceError('Video element not ready. Please try again.');
      } else if (/AUTH_REQUIRED|401.*avatar/i.test(msg)) {
        showVoiceError('Authentication failed. Please sign in again.');
      } else if (/AVATAR_SESSION_FAILED|Anam API/i.test(msg)) {
        showVoiceError('Avatar service temporarily unavailable. Voice mode is ready.');
      } else if (/Authentication failed when starting|CLIENT_ERROR_CODE_AUTHENTICATION/i.test(msg)) {
        showVoiceError('Anam avatar auth error. Check Anam account/plan status.');
      } else if (/sign up for a plan|NO_PLAN_FOUND|usage limit|spend cap/i.test(msg)) {
        showVoiceError('Anam plan limit reached. Check Anam account billing.');
      } else if (/network|fetch|ERR_/i.test(msg)) {
        showVoiceError('Network error. Check your connection and try again.');
      } else if (/timeout/i.test(msg)) {
        showVoiceError('Connection timed out. Please try again.');
      } else {
        showVoiceError(msg.length > 100 ? msg.slice(0, 100) + '...' : msg);
      }
    }
  }, [videoState, clearConnectionTimeouts]);

  const handleEndSession = useCallback(() => {
    trackInteraction('agent_disconnect', 'ava-desk-panel', { agent: 'ava' });
    clearConnectionTimeouts();
    if (anamClientRef.current) {
      try { anamClientRef.current.stopStreaming(); } catch (_) { /* ignore cleanup errors */ }
      anamClientRef.current = null;
    }
    clearConversationHistory();
    setVideoState('idle');
    setConnectionStatus('');
  }, [clearConnectionTimeouts]);

  const voiceStatusLabel = useMemo(() => {
    return isSessionActive ? 'Listening...' : 'Listening...';
  }, [isSessionActive]);

  // Show thinking indicator when submitted but no reasoning/text chunks yet
  const hasPendingChat = chatStatus === 'submitted';

  useEffect(() => {
    return () => {
      runTimers.current.forEach(clearTimeout);
      // Cleanup Anam connection on unmount
      if (anamClientRef.current) {
        try { anamClientRef.current.stopStreaming(); } catch (_) { /* ignore */ }
        anamClientRef.current = null;
      }
    };
  }, []);

  // W6: Approve-then-execute — chains approval into orchestrator resume, surfaces narration in chat
  const approveAndExecute = useCallback(async (approvalId: string) => {
    setIsConversing(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch(`/api/authority-queue/${approvalId}/approve`, {
        method: 'POST',
        headers,
      });

      if (!res.ok) throw new Error(`Approve returned ${res.status}`);
      const data = await res.json();
      const narrationText = data.narration || data.user_message || (data.executed ? 'Approved and executed successfully.' : 'Approved. Execution will follow.');
      appendLocalMessage('assistant', narrationText);
    } catch {
      appendLocalMessage('assistant', 'Approval failed. Please try again from the Authority Queue.');
    } finally {
      setIsConversing(false);
    }
  }, [session?.access_token, appendLocalMessage]);

  // Text chat send — delegates to Vercel AI SDK useChat (Law #1: Single Brain)
  const onSend = useCallback(() => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    setChatInput('');
    // sendMessage sends through AspireChatTransport which handles
    // SSE → UIMessageChunk conversion, error mapping, auth, tenant isolation, Anam TTS
    sendMessage({ text: trimmed });
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [chatInput, sendMessage]);

  const handleStartSession = () => setIsSessionActive(!isSessionActive);

  return (
    <View style={styles.card} testID="ava-desk-panel">
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title} testID="ava-desk-title">Ava Desk</Text>
        </View>
        <View style={styles.tabs}>
          <TabButton label="Voice with Ava" icon="mic" active={mode === 'voice'} onPress={() => { trackInteraction('agent_mode_switch', 'ava-desk-panel', { mode: 'voice' }); setMode('voice'); }} testID="ava-voice-tab" />
          <TabButton label="Video with Ava" icon="videocam" active={mode === 'video'} onPress={() => { trackInteraction('agent_mode_switch', 'ava-desk-panel', { mode: 'video' }); setMode('video'); }} />
        </View>
      </View>

      <View style={[styles.surfaceContainer, mode === 'video' && videoState === 'connected' && styles.surfaceContainerExpanded]}>
        {/* Voice/Video error banner â€" surfaces errors that were previously swallowed */}
        {voiceError && (
          <Pressable
            onPress={() => setVoiceError(null)}
            style={{
              backgroundColor: 'rgba(239,68,68,0.15)',
              borderLeftWidth: 3,
              borderLeftColor: '#EF4444',
              paddingHorizontal: 12,
              paddingVertical: 8,
              marginHorizontal: 12,
              marginTop: 4,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
            <Text style={{ color: '#FCA5A5', fontSize: 12, flex: 1 }}>{voiceError}</Text>
            <Ionicons name="close" size={14} color="#FCA5A5" />
          </Pressable>
        )}
        {mode === 'voice' ? (
          <View style={styles.voiceSurface}>
            <View style={styles.voiceHeader}>
              <Pressable 
                style={[
                  styles.companyPill,
                  isSessionActive && styles.companyPillActive,
                ]} 
                onPress={handleCompanyPillPress}
                testID="ava-company-pill"
              >
                <Animated.View 
                  style={[
                    styles.onlineDot,
                    isSessionActive && styles.onlineDotActive,
                    { 
                      transform: [{ scale: dotPulseAnim }],
                    },
                    isAvaSpeaking && Platform.OS === 'web' && {
                      boxShadow: '0 0 12px #3B82F6, 0 0 24px #3B82F6, 0 0 36px rgba(59,130,246,0.6)',
                    },
                  ]}
                />
                <Text style={styles.companyName} testID="ava-company-pill-text">
                  {avaVoice.isActive ? 'Talking with Ava...' : companyPillLabel}
                </Text>
              </Pressable>
            </View>

            <View style={styles.orbWrap}>
              {Platform.OS === 'web' ? (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <AvaOrbVideoInline size={320} />
                </Animated.View>
              ) : (
                <View style={styles.orbPlaceholderLarge}>
                  <Ionicons name="sparkles" size={80} color={Colors.accent.cyan} />
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.videoSurface}>
            {/* Anam hosted embed — avatar video rendering */}
            {Platform.OS === 'web' ? (
              <div
                style={{ width: '100%', height: '100%', minHeight: 480, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' } as any}
                dangerouslySetInnerHTML={{
                  __html: `<anam-agent agent-id="${ANAM_AVA_PERSONA_ID}"></anam-agent><script src="https://unpkg.com/@anam-ai/agent-widget" async><\/script>`,
                }}
              />
            ) : null}
            {/* End session overlay — floats above video when connected */}
            {videoState === 'connected' && (
              <Pressable
                style={{
                  position: 'absolute',
                  bottom: 16,
                  right: 16,
                  backgroundColor: 'rgba(239,68,68,0.9)',
                  borderRadius: 24,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  zIndex: 3,
                }}
                onPress={() => { trackInteraction('session_end', 'ava-desk-panel', { agent: 'ava' }); handleEndSession(); }}
              >
                <Ionicons name="close-circle" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>End Session</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {isConversing && (
        <Animated.View 
          style={[
            styles.divider, 
            { 
              backgroundColor: Colors.accent.cyan,
              height: 2,
              transform: [{ scaleY: voiceLineAnim }],
              ...(Platform.OS === 'web' ? {
                boxShadow: '0 0 10px #3B82F6, 0 0 20px #3B82F6, 0 0 30px rgba(59,130,246,0.6)',
              } : {}),
            }
          ]} 
        />
      )}

        <View style={styles.chatDock}>
        <ScrollView 
          ref={scrollRef}
          style={styles.chatScroll}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <MessagePartRenderer key={msg.id} message={msg} agent="ava" />
          ))}
          {hasPendingChat && (
            <ThinkingIndicator
              agent="ava"
              text="Ava is thinking..."
              style={{ marginTop: 4, marginBottom: 8 }}
            />
          )}
        </ScrollView>

        <View style={styles.inputRow}>
          <Pressable style={styles.attachBtn} onPress={() => {
            if (Platform.OS === 'web') {
              const fileInput = document.createElement('input');
              fileInput.type = 'file';
              fileInput.accept = '.pdf,.docx,.xlsx,.png,.jpg,.jpeg,.csv';
              fileInput.onchange = (e: any) => {
                const file = e.target?.files?.[0];
                if (file) {
                  appendLocalMessage('user', `Attached: ${file.name}`);
                }
              };
              fileInput.click();
            }
          }}>
            <Ionicons name="attach" size={20} color={Colors.text.secondary} />
          </Pressable>
          <TextInput
            value={chatInput}
            onChangeText={setChatInput}
            placeholder="Message Ava..."
            placeholderTextColor={Colors.text.tertiary}
            style={styles.input}
            onSubmitEditing={onSend}
            returnKeyType="send"
          />
          <Pressable style={styles.sendBtn} onPress={onSend}>
            <Ionicons name="arrow-up" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function TabButton({ label, icon, active, onPress, testID }: { label: string; icon: keyof typeof Ionicons.glyphMap; active: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.tabBtn, active && styles.tabBtnActive]} testID={testID}>
      <Ionicons name={icon} size={14} color={active ? Colors.accent.cyan : Colors.text.tertiary} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#1C1C1E',
    ...(Platform.OS === 'web' ? {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    } : {
      flex: 1,
    }),
  } as any,
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1C1E',
    zIndex: 10,
  },
  headerLeft: {},
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: 0.2,
  },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 10,
    padding: 3,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#242426',
  },
  tabText: {
    fontSize: 11,
    color: Colors.text.tertiary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.text.primary,
  },
  surfaceContainer: {
    height: 360,
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
  },
  surfaceContainerExpanded: {
    flex: 1,
    height: 'auto',
  } as any,
  voiceSurface: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  voiceHeader: {
    alignSelf: 'stretch',
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  companyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#242426',
    borderRadius: 20,
    cursor: 'pointer',
    ...(Platform.OS === 'web' ? {
      transition: 'all 0.2s ease',
    } : {}),
  } as any,
  companyPillActive: {
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.5)',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 16px rgba(59,130,246,0.3)',
    } : {}),
  } as any,
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  onlineDotActive: {
    backgroundColor: '#3B82F6',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 8px #3B82F6',
    } : {}),
  } as any,
  companyName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  orbWrap: { 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 8,
  },
  orbPlaceholder: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 100,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  orbPlaceholderLarge: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 140,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  listeningText: {
    fontSize: 16,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  listeningTextClose: {
    fontSize: 16,
    color: '#A1A1AA',
    fontWeight: '500',
    marginTop: 12,
  },
  voiceControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endCallBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startCallBtn: {
    backgroundColor: '#22c55e',
  },
  floatingMicOrb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 20px rgba(59,130,246,0.3), 0 0 40px rgba(59,130,246,0.15)',
    } : {}),
  } as any,
  floatingMicOrbActive: {
    backgroundColor: Colors.accent.cyan,
    borderColor: Colors.accent.cyan,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 20px rgba(59,130,246,0.6), 0 0 40px rgba(59,130,246,0.4)',
    } : {}),
  } as any,
  videoSurface: {
    flex: 1,
    position: 'relative',
  },
  videoBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  videoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  videoHeader: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  sessionBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(59,130,246,0.3)',
    borderRadius: 4,
  },
  sessionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B82F6',
    letterSpacing: 0.5,
  },
  liveIndicators: {
    flexDirection: 'row',
    gap: 12,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22c55e',
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recordingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
  avaAvatarWrap: {
    alignItems: 'center',
    gap: 8,
  },
  avaAvatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  avaAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#1a3a5c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avaAvatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#3B82F6',
  },
  avaName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginTop: 4,
  },
  avaStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  videoCompanyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoCompanyText: {
    fontSize: 13,
    color: '#D4D4D8',
  },
  videoControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#343436',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
  },
  chatDock: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 0,
  } as any,
  chatScroll: {
    flex: 1,
    paddingHorizontal: 16,
    ...(Platform.OS === 'web' ? {
      scrollbarWidth: 'none',
    } : {}),
  } as any,
  chatContent: {
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    backgroundColor: Colors.background.secondary,
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    color: Colors.text.primary,
    backgroundColor: Colors.background.tertiary,
    fontSize: 13,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent.cyan,
  },
  anamContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  endSessionBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 20,
  },
  endSessionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  videoIdleContainer: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  } as any,
  videoIdleVignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  videoIdleVignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  videoIdleCenter: {
    alignItems: 'center',
    gap: 16,
    zIndex: 10,
  },
  avaAvatarIdle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59,130,246,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  avaAvatarIdleGlow: {
    padding: 8,
    borderRadius: 48,
    backgroundColor: 'rgba(59,130,246,0.05)',
  },
  videoIdleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 8,
  },
  videoIdleSubtitle: {
    fontSize: 13,
    color: Colors.text.tertiary,
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: Colors.accent.cyan,
    borderRadius: 24,
    marginTop: 8,
  },
  connectBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  connectingRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: Colors.accent.cyan,
    borderRightColor: 'rgba(59,130,246,0.3)',
  },
  connectingRingInner: {
    width: '100%',
    height: '100%',
  },
  connectionStatusText: {
    fontSize: 14,
    color: Colors.accent.cyan,
    fontWeight: '500',
    marginTop: 16,
  },
});

export function AvaDeskPanel() {
  return (
    <PageErrorBoundary pageName="ava-desk-panel">
      <AvaDeskPanelInner />
    </PageErrorBoundary>
  );
}
