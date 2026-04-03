# Conference Production Build — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Production-grade video conference using Zoom SDK components + ConferenceChatDrawer + Nora full tile

**Architecture:** Rewrite conference-live.tsx as composition of: ConferenceHeader (new), ZoomConferenceProvider + ZoomVideoTile (existing Zoom), NoraTile (new), ConferenceControlBar (new), ConferenceChatDrawer (existing). All video/audio/screen share/recording through Zoom SDK directly.

**Tech Stack:** @zoom/videosdk ^2.3.15, React Native / Expo, reanimated, Ionicons, design tokens

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `components/session/ConferenceHeader.tsx` | CREATE | Header bar: room name, timer, participants, recording, network |
| `components/session/ConferenceControlBar.tsx` | CREATE | Footer: mic, camera, share, record, chat, participants, view, leave |
| `components/session/NoraTile.tsx` | CREATE | Full-size Nora AI tile for video grid |
| `components/session/ConferenceParticipantsPanel.tsx` | CREATE | Slide-in participant list |
| `hooks/useConferenceControls.ts` | CREATE | Mic/camera/share/record toggle state via Zoom SDK stream |
| `hooks/useConferenceTimer.ts` | CREATE | Duration timer (Date.now delta) |
| `components/session/ZoomConferenceProvider.tsx` | MODIFY | Add recording, screen share, network quality to context |
| `app/session/conference-live.tsx` | REWRITE | Compose all components |

---

## Task 1: useConferenceTimer hook

**Files:** Create `hooks/useConferenceTimer.ts`

- [ ] Create the hook:

```typescript
import { useState, useEffect, useRef } from 'react';

export function useConferenceTimer() {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return { elapsed, formatted: `${mm}:${ss}` };
}
```

- [ ] Commit: `feat(conference): add useConferenceTimer hook`

---

## Task 2: useConferenceControls hook

**Files:** Create `hooks/useConferenceControls.ts`

- [ ] Create the hook (manages mic/camera/share/record via Zoom SDK stream):

```typescript
import { useState, useCallback } from 'react';
import { reportProviderError } from '@/lib/providerErrorReporter';

interface ConferenceControlsOptions {
  stream: any | null;
  client: any | null;
}

export function useConferenceControls({ stream, client }: ConferenceControlsOptions) {
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const toggleMic = useCallback(async () => {
    if (!stream) return;
    try {
      if (isMuted) {
        await stream.unmuteAudio();
      } else {
        await stream.muteAudio();
      }
      setIsMuted(!isMuted);
    } catch (e) {
      reportProviderError({ provider: 'zoom', action: 'toggle_mic', error: e, component: 'ConferenceControls' });
    }
  }, [stream, isMuted]);

  const toggleCamera = useCallback(async () => {
    if (!stream) return;
    try {
      if (isCameraOff) {
        await stream.startVideo({ fullHd: true, hd: true, facingMode: 'user' });
      } else {
        await stream.stopVideo();
      }
      setIsCameraOff(!isCameraOff);
    } catch (e) {
      reportProviderError({ provider: 'zoom', action: 'toggle_camera', error: e, component: 'ConferenceControls' });
    }
  }, [stream, isCameraOff]);

  const toggleScreenShare = useCallback(async () => {
    if (!stream) return;
    try {
      if (isScreenSharing) {
        await stream.stopShareScreen();
      } else {
        await stream.startShareScreen();
      }
      setIsScreenSharing(!isScreenSharing);
    } catch (e) {
      reportProviderError({ provider: 'zoom', action: 'toggle_screen_share', error: e, component: 'ConferenceControls' });
    }
  }, [stream, isScreenSharing]);

  const toggleRecording = useCallback(async () => {
    if (!client) return;
    try {
      const rc = client.getRecordingClient();
      if (isRecording) {
        await rc.stopCloudRecording();
      } else {
        await rc.startCloudRecording();
      }
      setIsRecording(!isRecording);
    } catch (e) {
      reportProviderError({ provider: 'zoom', action: 'toggle_recording', error: e, component: 'ConferenceControls' });
    }
  }, [client, isRecording]);

  return {
    isMuted, isCameraOff, isScreenSharing, isRecording,
    toggleMic, toggleCamera, toggleScreenShare, toggleRecording,
    setIsRecording, setIsScreenSharing,
  };
}
```

- [ ] Commit: `feat(conference): add useConferenceControls hook`

---

## Task 3: Extend ZoomConferenceProvider with recording + screen share + network quality

**Files:** Modify `components/session/ZoomConferenceProvider.tsx`

- [ ] Add to ZoomContextValue interface:

```typescript
isRecording: boolean;
networkQuality: { uplink: number; downlink: number };
screenShareUserId: number | null;
```

- [ ] Add state + event listeners in ZoomConferenceProviderWeb:

```typescript
const [isRecording, setIsRecording] = useState(false);
const [networkQuality, setNetworkQuality] = useState({ uplink: 5, downlink: 5 });
const [screenShareUserId, setScreenShareUserId] = useState<number | null>(null);

// Inside initAndJoin, after existing event listeners:
client.on('recording-change', (...args: unknown[]) => {
  if (!mountedRef.current) return;
  const payload = args[0] as { state: string };
  setIsRecording(payload.state === 'Recording');
});

client.on('active-share-change', (...args: unknown[]) => {
  if (!mountedRef.current) return;
  const payload = args[0] as { state: string; userId: number };
  setScreenShareUserId(payload.state === 'Active' ? payload.userId : null);
});

client.on('network-quality-change', (...args: unknown[]) => {
  if (!mountedRef.current) return;
  const payload = args[0] as { level: number; type: 'uplink' | 'downlink' };
  setNetworkQuality(prev => ({ ...prev, [payload.type]: payload.level }));
});
```

- [ ] Add to contextValue object and DEFAULT_CONTEXT
- [ ] Commit: `feat(conference): extend ZoomConferenceProvider with recording, share, network`

---

## Task 4: ConferenceHeader component

**Files:** Create `components/session/ConferenceHeader.tsx`

- [ ] Build header bar:

```typescript
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '@/constants/tokens';

interface ConferenceHeaderProps {
  roomName: string;
  participantCount: number;
  duration: string;
  isRecording: boolean;
  networkQuality: { uplink: number; downlink: number };
}

export function ConferenceHeader({
  roomName,
  participantCount,
  duration,
  isRecording,
  networkQuality,
}: ConferenceHeaderProps) {
  const qualityLevel = Math.min(networkQuality.uplink, networkQuality.downlink);
  const qualityColor = qualityLevel >= 4 ? '#22C55E' : qualityLevel >= 2 ? '#F59E0B' : '#EF4444';

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Ionicons name="lock-closed" size={14} color={Colors.text.muted} />
        <Text style={styles.encryptedLabel}>Encrypted</Text>
        <Text style={styles.separator}>·</Text>
        <Text style={styles.roomName} numberOfLines={1}>{roomName}</Text>
      </View>

      <View style={styles.headerCenter}>
        <Ionicons name="people" size={14} color={Colors.text.tertiary} />
        <Text style={styles.participantCount}>{participantCount}</Text>
        <Text style={styles.separator}>·</Text>
        <Text style={styles.duration}>{duration}</Text>
      </View>

      <View style={styles.headerRight}>
        {isRecording && (
          <View style={styles.recBadge}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>REC</Text>
          </View>
        )}
        <View style={styles.networkBars}>
          {[1, 2, 3, 4, 5].map(i => (
            <View
              key={i}
              style={[
                styles.networkBar,
                { height: 4 + i * 3, backgroundColor: i <= qualityLevel ? qualityColor : '#333' },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } : {}),
  } as any,
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'flex-end' },
  encryptedLabel: { fontSize: 12, color: Colors.text.muted },
  separator: { fontSize: 12, color: Colors.text.muted },
  roomName: { fontSize: 14, fontWeight: '600', color: Colors.text.secondary, maxWidth: 200 },
  participantCount: { fontSize: 13, color: Colors.text.tertiary },
  duration: { fontSize: 13, color: Colors.text.tertiary, fontVariant: ['tabular-nums'] },
  recBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  recText: { fontSize: 11, fontWeight: '700', color: '#EF4444', letterSpacing: 0.5 },
  networkBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  networkBar: { width: 3, borderRadius: 1 },
});
```

- [ ] Commit: `feat(conference): add ConferenceHeader component`

---

## Task 5: ConferenceControlBar component

**Files:** Create `components/session/ConferenceControlBar.tsx`

- [ ] Build footer control bar with all buttons:

```typescript
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';

interface ControlBarProps {
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
  viewMode: 'gallery' | 'speaker';
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleRecording: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onToggleView: () => void;
  onLeave: () => void;
}

function ControlButton({
  icon,
  label,
  isActive,
  isDestructive,
  isWarning,
  onPress,
}: {
  icon: string;
  label: string;
  isActive?: boolean;
  isDestructive?: boolean;
  isWarning?: boolean;
  onPress: () => void;
}) {
  const bgColor = isDestructive
    ? '#DC2626'
    : isWarning
    ? 'rgba(239,68,68,0.15)'
    : isActive
    ? 'rgba(59,130,246,0.2)'
    : 'rgba(28,28,30,0.9)';

  const iconColor = isDestructive
    ? '#fff'
    : isWarning
    ? '#EF4444'
    : isActive
    ? '#3B82F6'
    : '#fff';

  const borderColor = isActive ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)';

  return (
    <Pressable
      onPress={onPress}
      style={[styles.controlButton, { backgroundColor: bgColor, borderColor }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon as any} size={22} color={iconColor} />
      <Text style={[styles.controlLabel, { color: iconColor }]}>{label}</Text>
    </Pressable>
  );
}

export function ConferenceControlBar(props: ControlBarProps) {
  return (
    <View style={styles.controlBar}>
      <View style={styles.controlGroup}>
        <ControlButton
          icon={props.isMuted ? 'mic-off' : 'mic'}
          label={props.isMuted ? 'Unmute' : 'Mute'}
          isWarning={props.isMuted}
          onPress={props.onToggleMic}
        />
        <ControlButton
          icon={props.isCameraOff ? 'videocam-off' : 'videocam'}
          label={props.isCameraOff ? 'Start Video' : 'Stop Video'}
          isWarning={props.isCameraOff}
          onPress={props.onToggleCamera}
        />
        <ControlButton
          icon={props.isScreenSharing ? 'share' : 'share-outline'}
          label={props.isScreenSharing ? 'Stop Share' : 'Share Screen'}
          isActive={props.isScreenSharing}
          onPress={props.onToggleScreenShare}
        />
        <ControlButton
          icon="radio-button-on"
          label={props.isRecording ? 'Stop Rec' : 'Record'}
          isActive={props.isRecording}
          onPress={props.onToggleRecording}
        />
      </View>

      <View style={styles.controlGroup}>
        <ControlButton
          icon="chatbubble"
          label="Chat"
          isActive={props.isChatOpen}
          onPress={props.onToggleChat}
        />
        <ControlButton
          icon="people"
          label="People"
          isActive={props.isParticipantsOpen}
          onPress={props.onToggleParticipants}
        />
        <ControlButton
          icon={props.viewMode === 'gallery' ? 'expand' : 'grid'}
          label={props.viewMode === 'gallery' ? 'Speaker' : 'Gallery'}
          onPress={props.onToggleView}
        />
      </View>

      <ControlButton
        icon="call"
        label="Leave"
        isDestructive
        onPress={props.onLeave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  controlBar: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } : {}),
  } as any,
  controlGroup: { flexDirection: 'row', gap: 8 },
  controlButton: {
    width: 64,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    gap: 2,
  },
  controlLabel: { fontSize: 9, fontWeight: '500', letterSpacing: 0.3 },
});
```

- [ ] Commit: `feat(conference): add ConferenceControlBar component`

---

## Task 6: NoraTile component

**Files:** Create `components/session/NoraTile.tsx`

- [ ] Build full-size Nora AI participant tile:

```typescript
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '@/constants/tokens';
import type { RoomAvaState } from '@/components/session/RoomAvaTile';

const noraAvatar = require('../../assets/images/ava-logo.png');

interface NoraTileProps {
  avaState: RoomAvaState;
  isNoraSpeaking: boolean;
  onPress: () => void;
}

export function NoraTile({ avaState, isNoraSpeaking, onPress }: NoraTileProps) {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const ringAnim = useRef(new Animated.Value(1)).current;

  const isActive = avaState === 'listening' || avaState === 'thinking' || avaState === 'speaking';

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.7, duration: 1200, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 1200, useNativeDriver: false }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim, { toValue: 1.06, duration: 1600, useNativeDriver: false }),
          Animated.timing(ringAnim, { toValue: 1, duration: 1600, useNativeDriver: false }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(0.3);
      ringAnim.setValue(1);
    }
  }, [isActive]);

  const glowColor = avaState === 'listening' ? '#3B82F6'
    : avaState === 'thinking' ? '#A78BFA'
    : avaState === 'speaking' ? '#22C55E'
    : '#3B82F6';

  const statusText = avaState === 'listening' ? 'Listening...'
    : avaState === 'thinking' ? 'Thinking...'
    : avaState === 'speaking' ? 'Speaking...'
    : 'Ready';

  return (
    <Pressable onPress={onPress} style={styles.container} accessibilityRole="button" accessibilityLabel={`Nora AI assistant, ${statusText}`}>
      <LinearGradient colors={['#0B1020', '#0F172A']} style={styles.gradient}>
        {/* Glow ring */}
        <Animated.View style={[styles.glowRing, {
          transform: [{ scale: ringAnim }],
          borderColor: glowColor,
          ...(Platform.OS === 'web' ? { boxShadow: `0 0 20px ${glowColor}44, 0 0 40px ${glowColor}22` } : {}),
        }]}>
          <Animated.View style={[styles.avatarContainer, { opacity: Animated.add(0.6, pulseAnim) }]}>
            <Image source={noraAvatar} style={styles.avatar} contentFit="contain" />
          </Animated.View>
        </Animated.View>

        {/* Audio bars when speaking */}
        {isNoraSpeaking && (
          <View style={styles.audioBars}>
            {[1, 2, 3, 4, 5].map(i => (
              <Animated.View
                key={i}
                style={[styles.audioBar, {
                  height: 8 + Math.random() * 16,
                  backgroundColor: glowColor,
                  opacity: pulseAnim,
                }]}
              />
            ))}
          </View>
        )}

        {/* Bottom label */}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.bottomOverlay}>
          <View style={styles.labelRow}>
            <Text style={styles.name}>Nora</Text>
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={8} color="#3B82F6" />
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: glowColor }]} />
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        </LinearGradient>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#0a0a0c' },
  gradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glowRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarContainer: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  avatar: { width: 56, height: 56 },
  audioBars: { flexDirection: 'row', gap: 3, marginTop: 12, alignItems: 'flex-end', height: 24 },
  audioBar: { width: 4, borderRadius: 2 },
  bottomOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 10, paddingVertical: Spacing.sm, paddingTop: Spacing.xl },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 13, fontWeight: '600', color: Colors.text.secondary },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(59,130,246,0.15)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  aiBadgeText: { fontSize: 9, fontWeight: '700', color: '#3B82F6' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, color: Colors.text.muted },
});
```

- [ ] Commit: `feat(conference): add NoraTile full participant component`

---

## Task 7: ConferenceParticipantsPanel

**Files:** Create `components/session/ConferenceParticipantsPanel.tsx`

- [ ] Build slide-in panel showing participant list:

```typescript
import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '@/constants/tokens';
import type { ZoomParticipant } from './ZoomConferenceProvider';
import { getInitials, getAvatarColor } from '@/utils/avatar';

interface ParticipantsPanelProps {
  visible: boolean;
  participants: ZoomParticipant[];
  onClose: () => void;
}

export function ConferenceParticipantsPanel({ visible, participants, onClose }: ParticipantsPanelProps) {
  if (!visible) return null;

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>Participants ({participants.length + 1})</Text>
        <Pressable onPress={onClose} accessibilityLabel="Close participants">
          <Ionicons name="close" size={20} color={Colors.text.secondary} />
        </Pressable>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {/* Nora AI — always first */}
        <View style={styles.participantRow}>
          <View style={[styles.avatarCircle, { backgroundColor: 'rgba(59,130,246,0.2)' }]}>
            <Ionicons name="sparkles" size={14} color="#3B82F6" />
          </View>
          <View style={styles.participantInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.participantName}>Nora</Text>
              <View style={styles.badge}><Text style={styles.badgeText}>AI</Text></View>
            </View>
          </View>
          <Ionicons name="mic" size={14} color="#22C55E" />
        </View>

        {participants.map(p => (
          <View key={p.userId} style={styles.participantRow}>
            <View style={[styles.avatarCircle, { backgroundColor: getAvatarColor(p.displayName) + '33' }]}>
              <Text style={styles.avatarInitials}>{getInitials(p.displayName)}</Text>
            </View>
            <View style={styles.participantInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.participantName}>{p.displayName}</Text>
                {p.isLocal && <View style={styles.badge}><Text style={styles.badgeText}>You</Text></View>}
              </View>
            </View>
            <View style={styles.indicators}>
              <Ionicons
                name={p.isMuted ? 'mic-off' : 'mic'}
                size={14}
                color={p.isMuted ? '#EF4444' : '#22C55E'}
              />
              <Ionicons
                name={p.isVideoOn ? 'videocam' : 'videocam-off'}
                size={14}
                color={p.isVideoOn ? '#22C55E' : '#6e6e73'}
              />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute', top: 56, bottom: 72, right: 0, width: 320,
    backgroundColor: 'rgba(14,14,16,0.95)', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.06)',
    zIndex: 200,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } : {}),
  } as any,
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  panelTitle: { fontSize: 15, fontWeight: '600', color: Colors.text.primary },
  list: { flex: 1, padding: 8 },
  participantRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 13, fontWeight: '600', color: Colors.text.primary },
  participantInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  participantName: { fontSize: 14, fontWeight: '500', color: Colors.text.secondary },
  badge: { backgroundColor: 'rgba(59,130,246,0.15)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#3B82F6' },
  indicators: { flexDirection: 'row', gap: 8 },
});
```

- [ ] Commit: `feat(conference): add ConferenceParticipantsPanel`

---

## Task 8: Rewrite conference-live.tsx — compose everything

**Files:** Rewrite `app/session/conference-live.tsx`

- [ ] Full rewrite composing all components. This is the main file — complete code:

The rewrite composes: ConferenceHeader + video grid (ZoomVideoTile + NoraTile) + ConferenceControlBar + ConferenceChatDrawer + ConferenceParticipantsPanel + keyboard shortcuts + all state management.

Key structure:
```
FullscreenSessionShell
  └─ ZoomConferenceProvider
       ├─ ConferenceHeader
       ├─ Video Grid (gallery/speaker) with ZoomVideoTile × N + NoraTile
       ├─ ConferenceControlBar
       ├─ ConferenceChatDrawer (existing, slides over)
       ├─ ConferenceParticipantsPanel (slides over)
       ├─ Toast
       └─ ConfirmationModal (end call)
```

Keyboard shortcuts: Alt+M (mic), Alt+V (camera), Alt+S (share), Alt+R (record), Alt+H (chat), Alt+P (people), Alt+L (view).

- [ ] Commit: `feat(conference): rewrite conference-live with full production UI`

---

## Task 9: Commit all + push

- [ ] `git push github main`
