import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { trackInteraction } from '@/lib/interactionTelemetry';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Platform, Animated, Linking, Alert, Image, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/tokens';
import { ShimmeringText } from '@/components/ui/ShimmeringText';
import { useVoice, type VoiceDiagnosticEvent } from '@/hooks/useVoice';
import { useSupabase, useTenant } from '@/providers';
import {
  type FileAttachment,
  ThinkingIndicator,
  MessagePartRenderer,
} from '@/components/chat';
import { resolvePublicAssetUrl } from '@/lib/publicAssetUrl';
import { playConnectionSound, playSuccessSound } from '@/lib/soundEffects';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { isLocalSyntheticAuthBypass } from '@/lib/supabaseRuntime';
import { useAvaChat } from '@/hooks/useAvaChat';
import { useAvaPresentsContext } from '@/contexts/AvaPresentsContext';
import type { UIMessage } from 'ai';

type AvaMode = 'voice' | 'video';
type VideoConnectionState = 'idle' | 'connecting' | 'connected';

function buildAvaVideoFrameDoc(sessionToken: string) {
  const encodedSessionToken = JSON.stringify(sessionToken);
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle at top, #111827 0%, #020617 45%, #000 100%);
        overflow: hidden;
      }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        font-family: Arial, sans-serif;
      }
      #anam-video {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
        object-position: center top;
        background: transparent;
      }
      #anam-audio {
        position: absolute;
        left: -9999px;
        width: 1px;
        height: 1px;
      }
      #status {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #94a3b8;
        font-size: 14px;
        gap: 16px;
        background: radial-gradient(circle at top, #111827 0%, #020617 45%, #000 100%);
      }
      .spinner {
        width: 36px;
        height: 36px;
        border: 3px solid rgba(59,130,246,0.15);
        border-top-color: #3B82F6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <video id="anam-video" autoplay playsinline muted></video>
    <audio id="anam-audio" autoplay></audio>
    <div id="status"><div class="spinner"></div><div id="status-text">Connecting to Ava...</div></div>
    <script type="module">
      const sessionToken = ${encodedSessionToken};
      const statusEl = document.getElementById('status');
      const post = (payload) => window.parent.postMessage({ source: 'ava-anam-frame', ...payload }, '*');
      const statusTextEl = document.getElementById('status-text');
      const setStatus = (message) => {
        if (statusTextEl) statusTextEl.textContent = message;
      };

      let client = null;

      // Unblock audio on user gesture within the iframe (fallback)
      const playAudio = async () => {
        const audio = document.getElementById('anam-audio');
        if (audio && audio.paused) {
          try {
            await audio.play();
          } catch (e) {
            console.warn('Manual audio play failed', e);
          }
        }
      };
      document.body.addEventListener('click', playAudio);

      const start = async () => {
        try {
          const sdk = await import('https://esm.sh/@anam-ai/js-sdk@latest');
          const types = await import('https://esm.sh/@anam-ai/js-sdk@latest/dist/module/types');
          client = sdk.createClient(sessionToken);
          const AnamEvent = types.AnamEvent;

          client.addListener(AnamEvent.SESSION_READY, () => {
            if (statusEl) statusEl.remove();
            post({ type: 'connected' });
            playAudio(); // Try to unblock sound immediately
          });

          client.addListener(AnamEvent.CONNECTION_ESTABLISHED, () => {
            if (statusEl) statusEl.remove();
            post({ type: 'connected' });
            playAudio();
          });

          client.addListener(AnamEvent.AUDIO_STREAM_STARTED, () => {
            playAudio();
          });

          client.addListener(AnamEvent.CONNECTION_CLOSED, (code) => {
            post({ type: 'closed', code });
          });

          await client.streamToVideoAndAudioElements('anam-video', 'anam-audio');
        } catch (error) {
          console.error('Ava video bootstrap failed', error);
          setStatus('Unable to start Ava video');
          post({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unable to start Ava video',
          });
        }
      };

      window.addEventListener('beforeunload', () => {
        client?.stopStreaming?.().catch?.(() => {});
      });

      start();
    </script>
  </body>
</html>`;
}


function AvaOrbVideoInline({ size = 320 }: { size?: number }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const orbSrc = resolvePublicAssetUrl('ava-orb.mp4');

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
        src={orbSrc}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
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
  const [anamSessionToken, setAnamSessionToken] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [latestVoiceDiagnostic, setLatestVoiceDiagnostic] = useState<VoiceDiagnosticEvent | null>(null);
  const avaPresents = useAvaPresentsContext();
  const runTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const connectingAnim = useRef(new Animated.Value(0)).current;
  const voiceLineAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);
  const connectionTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const dotPulseAnim = useRef(new Animated.Value(1)).current;

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
    ownerName?: string;
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
        ownerName: parsed.ownerName || undefined,
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
  const resolvedOwnerName = tenant?.ownerName || bootstrapIdentity?.ownerName || '';
  const avaProfileFallback = useMemo(() => {
    const ownerName = resolvedOwnerName.trim();
    const nameParts = ownerName ? ownerName.split(/\s+/) : [];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    return {
      ownerName: ownerName || undefined,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      salutation: lastName ? 'Mr.' : undefined,
      businessName: resolvedBusinessName || undefined,
      industry: tenant?.industry || undefined,
    };
  }, [resolvedBusinessName, resolvedOwnerName, tenant?.industry]);
  const avaVideoFrameDoc = useMemo(
    () => (anamSessionToken ? buildAvaVideoFrameDoc(anamSessionToken) : null),
    [anamSessionToken],
  );

  // W4: Authority queue polling — provides context to orchestrator (approvals shown in Authority Queue, not chat)
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);

  // Vercel AI SDK chat — source of truth for all Aspire chat (Law #1)
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const videoStateRef = useRef(videoState);
  videoStateRef.current = videoState;

  // Orchestrator-routed voice: STT → Orchestrator → TTS (Law #1: Single Brain)
  const avaVoice = useVoice({
    agent: 'ava',
    suiteId: suiteId ?? undefined,
    userId: session?.user?.id,
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
    onTranscript: (text: string) => {
      // Show user speech in chat panel for visibility
      if (text.trim()) appendLocalMessage('user', text);
    },
    onResponse: (text: string) => {
      // Show agent response in chat panel
      if (text.trim()) {
        appendLocalMessage('assistant', text);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
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
        showVoiceError('Voice unavailable — responses shown in chat.');
      } else {
        showVoiceError(msg.length > 80 ? msg.slice(0, 80) + '...' : msg);
      }
    },
    onShowCards: (data: { artifact_type: string; records: any[]; summary: string; confidence?: any }) => {
      avaPresents.showCards({
        artifactType: data.artifact_type,
        records: data.records,
        summary: data.summary,
        confidence: data.confidence,
      });
    },
    onDiagnostic: (diag) => {
      setLatestVoiceDiagnostic(diag);
      if (diag.stage === 'autoplay') {
        showVoiceError(`Audio blocked by browser. Tap voice again to retry. Trace: ${diag.traceId}`);
      }
    },
  });

  const avaChatResult = useAvaChat({
    avaVoice, // Pass the active voice session to useAvaChat to prevent double-hook overhead
    onResponseText: (_text) => {
      // Anam hosted embed handles TTS internally — no SDK talk() needed
    },
    // Fallback: if ElevenLabs show_cards client tool isn't called (text-only chat path),
    // detect structured_results in the HTTP SSE response and trigger the card modal
    onStructuredResults: (data) => {
      if (!avaPresents.visible) {
        avaPresents.showCards({
          artifactType: data.artifact_type,
          records: data.records,
          summary: data.summary ?? '',
          confidence: data.confidence as { status: 'verified' | 'partial' | 'unverified'; score: number } | null | undefined,
        });
      }
    },
    extraBody: {
      pendingApprovals: pendingApprovals.length,
      approvalSummary: pendingApprovals.slice(0, 3).map((p: unknown) => (p as Record<string, string>).title || (p as Record<string, string>).type || 'Approval'),
    },
  });

  const { messages, setMessages, sendMessage } = avaChatResult;

  // Append a local message to the chat display (voice transcripts, file uploads, approvals)
  const appendLocalMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    setMessages((prev: any[]) => [
      ...prev,
      {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role,
        content,
        parts: [{ type: 'text' as const, text: content }],
        createdAt: new Date(),
      },
    ]);
  }, [setMessages]);

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

  // Use refs to avoid stale closures in animation loop callbacks
  const isConversingRef = useRef(isConversing);
  isConversingRef.current = isConversing;

  useEffect(() => {
    if (isConversing) {
      const randomPulse = () => {
        const duration = 150 + Math.random() * 300;
        const toValue = 0.4 + Math.random() * 0.6;
        Animated.sequence([
          Animated.timing(voiceLineAnim, { toValue, duration, useNativeDriver: false }),
          Animated.timing(voiceLineAnim, { toValue: 1, duration: duration * 0.8, useNativeDriver: false }),
        ]).start(() => {
          if (isConversingRef.current) randomPulse();
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
  const isAvaSpeakingRef = useRef(isAvaSpeaking);
  isAvaSpeakingRef.current = isAvaSpeaking;

  useEffect(() => {
    if (isAvaSpeaking) {
      setIsConversing(true);
      const pulseAnimation = () => {
        Animated.sequence([
          Animated.timing(dotPulseAnim, { toValue: 1.8, duration: 200, useNativeDriver: false }),
          Animated.timing(dotPulseAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        ]).start(() => {
          if (isAvaSpeakingRef.current) pulseAnimation();
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

  const handleConnectToAva = useCallback(async () => {
    if (videoState !== 'idle') return;
    trackInteraction('agent_connect', 'ava-desk-panel', { mode: 'video', agent: 'ava' });
    clearConnectionTimeouts();
    setVideoState('connecting');
    setConnectionStatus('Connecting to Ava...');
    playConnectionSound();
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const resp = await fetch('/api/anam/session', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          persona: 'ava',
          profile: avaProfileFallback,
        }),
      });
      if (!resp.ok) throw new Error(`Session failed: ${resp.status}`);
      const data = await resp.json();
      if (!data.sessionToken) throw new Error('No session token returned');
      setAnamSessionToken(data.sessionToken);
      setConnectionStatus('Starting Ava video...');
      connectionTimeouts.current.push(setTimeout(() => {
        setAnamSessionToken(null);
        setVideoState('idle');
        setConnectionStatus('Connect failed');
      }, 40000));
    } catch (err) {
      clearConnectionTimeouts();
      setAnamSessionToken(null);
      setVideoState('idle');
      setConnectionStatus('Connect failed');
    }
  }, [avaProfileFallback, clearConnectionTimeouts, videoState, session?.access_token]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.source !== 'ava-anam-frame') return;
      if (event.data.type === 'connected') {
        clearConnectionTimeouts();
        setVideoState('connected');
        setConnectionStatus('');
        playSuccessSound();
        return;
      }
      if (event.data.type === 'error') {
        clearConnectionTimeouts();
        setAnamSessionToken(null);
        setVideoState('idle');
        setConnectionStatus('Connect failed');
        return;
      }
      if (event.data.type === 'closed') {
        clearConnectionTimeouts();
        setAnamSessionToken(null);
        setVideoState('idle');
        setConnectionStatus('Session ended');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [clearConnectionTimeouts]);

  const handleEndSession = useCallback(() => {
    trackInteraction('agent_disconnect', 'ava-desk-panel', { agent: 'ava' });
    clearConnectionTimeouts();
    setAnamSessionToken(null);
    setVideoState('idle');
    setConnectionStatus('');
  }, [clearConnectionTimeouts]);

  const voiceStatusLabel = useMemo(() => {
    if (!isSessionActive) return companyPillLabel || 'Tap to start';
    if (avaVoice.status === 'speaking') return 'Ava is speaking...';
    if (avaVoice.status === 'thinking') return 'Thinking...';
    return 'Listening...';
  }, [isSessionActive, avaVoice.status, companyPillLabel]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [messages.length]);

  // Show thinking indicator when submitted but no reasoning/text chunks yet
  const hasPendingChat = avaChatResult.status === 'submitted';

  useEffect(() => {
    return () => {
      runTimers.current.forEach(clearTimeout);
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

  // Text chat send — routes through ElevenLabs agent (same as voice, unified pipeline)
  const onSend = useCallback(() => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    setChatInput('');

    // Add user message to chat UI immediately
    appendLocalMessage('user', trimmed);

    // Send through ElevenLabs agent if session is active, otherwise fall back to LangGraph
    if (avaVoice.isActive) {
      avaVoice.sendText(trimmed);
    } else {
      // Fallback: send through LangGraph if no ElevenLabs session
      sendMessage({ text: trimmed });
    }
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [chatInput, sendMessage, avaVoice, appendLocalMessage]);

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
            {/* Anam iframe — loads hidden, fades in when SDK fires SESSION_READY */}
            {anamSessionToken && Platform.OS === 'web' && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: videoState === 'connected' ? 2 : 0,
                overflow: 'hidden', borderRadius: 12,
              } as any}>
                <iframe
                  key={anamSessionToken}
                  title="Ava video"
                  srcDoc={avaVideoFrameDoc || undefined}
                  allow="microphone; autoplay"
                  style={{
                    width: '100%', height: '100%', border: '0', display: 'block', backgroundColor: '#000',
                    opacity: videoState === 'connected' ? 1 : 0,
                    transition: 'opacity 0.5s ease-in',
                  }}
                />
              </div>
            )}
            {videoState !== 'connected' ? (
              <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=800' }}
                style={styles.videoIdleContainer}
                imageStyle={{ opacity: 0.25 }}
              >
                <LinearGradient
                  colors={['rgba(0,0,0,0.6)', 'transparent']}
                  style={styles.videoIdleVignetteTop}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                />
                <LinearGradient
                  colors={['transparent', Colors.background.primary]}
                  style={styles.videoIdleVignetteBottom}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                />
                <View style={styles.videoIdleCenter}>
                  {videoState === 'connecting' ? (
                    <>
                      <Animated.View style={[styles.connectingRing, { transform: [{ rotate: connectingAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
                        <View style={styles.connectingRingInner} />
                      </Animated.View>
                      <View style={styles.avaAvatarIdle}>
                        <Ionicons name="videocam" size={32} color={Colors.accent.cyan} />
                      </View>
                      {Platform.OS === 'web' ? (
                        <ShimmeringText
                          text={connectionStatus}
                          duration={2}
                          color={Colors.text.muted}
                          shimmerColor={Colors.accent.cyan}
                          style={{ fontSize: 14, fontWeight: '500', marginTop: 16 }}
                        />
                      ) : (
                        <Text style={styles.connectionStatusText}>{connectionStatus}</Text>
                      )}
                    </>
                  ) : (
                    <>
                      <View style={styles.avaAvatarIdleGlow}>
                        <View style={styles.avaAvatarIdle}>
                          <Ionicons name="videocam" size={32} color={Colors.accent.cyan} />
                        </View>
                      </View>
                      <Text style={styles.videoIdleTitle}>Video with Ava</Text>
                      <Text style={styles.videoIdleSubtitle}>Start a face-to-face session</Text>
                      <Pressable style={styles.connectBtn} onPress={handleConnectToAva}>
                        <Ionicons name="videocam" size={18} color="#fff" />
                        <Text style={styles.connectBtnText}>Connect to Ava</Text>
                      </Pressable>
                      {connectionStatus ? (
                        <Text style={styles.connectionStatusText}>{connectionStatus}</Text>
                      ) : null}
                    </>
                  )}
                </View>
              </ImageBackground>
            ) : null}
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
              fileInput.onchange = async (e: any) => {
                const file = e.target?.files?.[0];
                if (!file) return;
                appendLocalMessage('user', `Attached: ${file.name}`);
                try {
                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('suite_id', suiteId || '');
                  const headers: Record<string, string> = {};
                  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
                  const resp = await fetch('/v1/tools/analyze-document', { method: 'POST', headers, body: formData });
                  if (resp.ok) {
                    const result = await resp.json();
                    const preview = result.extracted_text || 'Document received but text extraction is pending.';
                    appendLocalMessage('assistant', `I received ${file.name}. ${preview}`);
                  } else {
                    appendLocalMessage('assistant', `I received ${file.name} but could not analyze it right now. I have it saved for review.`);
                  }
                } catch {
                  appendLocalMessage('assistant', `I received ${file.name} but had trouble processing it. It has been saved.`);
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
    flex: 1,
    minHeight: 840,
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
