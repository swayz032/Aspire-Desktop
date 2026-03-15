import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSmsThreads, useSmsMessages } from '@/hooks/useSmsThreads';
import type { PanelContentProps } from './types';
import { timeAgo } from './utils';

const BLUE    = '#0ea5e9';
const SURFACE = 'rgba(6,6,10,0.98)';
const GLASS   = 'rgba(255,255,255,0.06)';
const BORDER  = 'rgba(255,255,255,0.11)';
const TP      = '#FFFFFF';
const TS      = 'rgba(255,255,255,0.45)';
const TT      = 'rgba(255,255,255,0.25)';

const GLASS_WEB: any = Platform.OS === 'web'
  ? { backdropFilter: 'blur(20px)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }
  : {};

function nameColor(name: string): string {
  const palette = ['#0ea5e9','#22c55e','#a855f7','#f59e0b','#ef4444','#14b8a6','#f97316'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xFFFFFF;
  return palette[Math.abs(h) % palette.length];
}

function initials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

interface Thread { id: string; contact_name?: string; from_number?: string; last_message?: string; last_at?: string; unread_count?: number }
interface Message { id: string; body?: string; direction?: string; created_at?: string }

const AvatarCircle = memo(function AvatarCircle({ name, size = 44 }: { name: string; size?: number }) {
  const col = nameColor(name);
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: `${col}28`, borderColor: `${col}60` }]}>
      <Text style={[s.avatarText, { fontSize: size * 0.34, color: col }]}>{initials(name)}</Text>
    </View>
  );
});

interface ThreadRowProps { thread: Thread; onPress: (t: Thread) => void }
const ThreadRow = memo(function ThreadRow({ thread, onPress }: ThreadRowProps) {
  const name    = thread.contact_name || thread.from_number || 'Unknown';
  const hasUnread = (thread.unread_count ?? 0) > 0;
  return (
    <Pressable onPress={() => onPress(thread)} style={[s.threadCard, hasUnread && s.threadCardUnread]}>
      <AvatarCircle name={name} />
      <View style={s.threadBody}>
        <Text style={s.threadName} numberOfLines={1}>{name}</Text>
        <Text style={s.threadPreview} numberOfLines={1}>{thread.last_message || 'No messages yet'}</Text>
      </View>
      <View style={s.threadMeta}>
        {thread.last_at && <Text style={s.threadTime}>{timeAgo(thread.last_at)}</Text>}
        {hasUnread && (
          <View style={s.unreadDot}>
            <Text style={s.unreadCount}>{thread.unread_count}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});

interface ConversationProps {
  thread: Thread;
  onBack: () => void;
  onSend: (body: string, threadId: string) => void;
}
function Conversation({ thread, onBack, onSend }: ConversationProps) {
  const name                  = thread.contact_name || thread.from_number || 'Unknown';
  const { messages: rawMsgs } = useSmsMessages(thread.id);
  const messages              = (rawMsgs || []) as unknown as Message[];
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(t);
  }, [messages]);

  const handleSend = useCallback(() => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    onSend(body, thread.id);
  }, [draft, onSend, thread.id]);

  return (
    <View style={s.convRoot}>
      <Pressable style={s.convBack} onPress={onBack}>
        <Ionicons name="chevron-back" size={18} color={BLUE} />
        <AvatarCircle name={name} size={28} />
        <Text style={s.convName} numberOfLines={1}>{name}</Text>
      </Pressable>

      <ScrollView ref={scrollRef} style={s.bubbles} showsVerticalScrollIndicator={false} contentContainerStyle={s.bubblesContent}>
        {messages.map(msg => {
          const sent = msg.direction === 'outbound-api' || msg.direction === 'outbound';
          return (
            <View key={msg.id} style={[s.bubbleRow, sent ? s.bubbleRowSent : s.bubbleRowRecv]}>
              <View style={[s.bubble, sent ? s.bubbleSent : s.bubbleRecv]}>
                <Text style={[s.bubbleText, sent ? s.bubbleTextSent : s.bubbleTextRecv]}>
                  {msg.body}
                </Text>
              </View>
              {msg.created_at && (
                <Text style={s.bubbleTime}>{timeAgo(msg.created_at)}</Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={s.composeBar}>
        <TextInput
          style={s.composeInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message…"
          placeholderTextColor={TT}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <Pressable
          style={[s.sendBtn, { opacity: draft.trim() ? 1 : 0.4 }]}
          onPress={handleSend}
          disabled={!draft.trim()}
        >
          <Ionicons name="send" size={16} color="#FFF" />
        </Pressable>
      </View>
    </View>
  );
}

export default function MessagesPanelContent(_props: PanelContentProps) {
  const { threads: rawThreads }  = useSmsThreads();
  const threads                  = (rawThreads || []) as unknown as Thread[];
  const [active, setActive]    = useState<Thread | null>(null);

  const handleSend = useCallback(async (body: string, threadId: string) => {
    const thread = threads.find(t => t.id === threadId);
    if (!thread) return;
    try {
      await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: thread.from_number, body }),
      });
    } catch { /* ignore */ }
  }, [threads]);

  const totalUnread = threads.reduce((sum, t) => sum + (t.unread_count ?? 0), 0);

  if (active) {
    return <Conversation thread={active} onBack={() => setActive(null)} onSend={handleSend} />;
  }

  return (
    <View style={s.root}>
      <View style={s.heroZone}>
        <View style={s.orbBehind} pointerEvents="none" />
        <View style={s.heroRow}>
          <Text style={s.heroTitle}>Messages</Text>
          {totalUnread > 0 && (
            <View style={s.heroBadge}>
              <Text style={s.heroBadgeText}>{totalUnread}</Text>
            </View>
          )}
        </View>
        <Text style={s.heroSub}>{threads.length} conversation{threads.length !== 1 ? 's' : ''}</Text>
      </View>

      {threads.length > 0 && (
        <>
          <Text style={s.sectionLabel}>RECENT</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.recentStrip} contentContainerStyle={s.recentContent}>
            {threads.slice(0, 8).map(t => {
              const name = t.contact_name || t.from_number || 'Unknown';
              const col  = nameColor(name);
              return (
                <Pressable key={t.id} style={s.recentItem} onPress={() => setActive(t)}>
                  <View style={[s.recentAvatar, { backgroundColor: `${col}28`, borderColor: `${col}60` }]}>
                    <Text style={[s.recentAvatarText, { color: col }]}>{initials(name)}</Text>
                    {(t.unread_count ?? 0) > 0 && <View style={s.recentDot} />}
                  </View>
                  <Text style={s.recentName} numberOfLines={1}>{name.split(' ')[0]}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      <Text style={s.sectionLabel}>ALL THREADS</Text>

      <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
        {threads.length === 0 && (
          <View style={s.emptyState}>
            <Ionicons name="chatbubbles-outline" size={40} color={BLUE} />
            <Text style={s.emptyStateTitle}>No messages</Text>
            <Text style={s.emptyStateSub}>Conversations will appear here</Text>
          </View>
        )}
        {threads.map(t => (
          <ThreadRow key={t.id} thread={t} onPress={setActive} />
        ))}
        <View style={s.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:              { flex: 1, backgroundColor: SURFACE },
  heroZone:          { paddingTop: 24, paddingBottom: 20, paddingHorizontal: 16, position: 'relative', overflow: 'hidden' },
  orbBehind:         {
    position: 'absolute', top: -80, right: -60, width: 260, height: 260,
    borderRadius: 130, backgroundColor: 'rgba(14,165,233,0.12)',
    ...(Platform.OS === 'web' ? { filter: 'blur(70px)' } : {}),
  },
  heroRow:           { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroTitle:         { fontSize: 28, fontWeight: '800', color: TP, letterSpacing: -0.5 },
  heroBadge:         { backgroundColor: BLUE, borderRadius: 10, minWidth: 22, height: 22, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  heroBadgeText:     { fontSize: 12, fontWeight: '800', color: '#FFF' },
  heroSub:           { fontSize: 13, color: TS, marginTop: 4 },
  sectionLabel:      { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: TT, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  recentStrip:       { maxHeight: 90 },
  recentContent:     { paddingHorizontal: 16, gap: 12, paddingVertical: 4 },
  recentItem:        { alignItems: 'center', width: 52 },
  recentAvatar:      { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  recentAvatarText:  { fontSize: 16, fontWeight: '700' },
  recentDot:         { position: 'absolute', top: 1, right: 1, width: 10, height: 10, borderRadius: 5, backgroundColor: BLUE, borderWidth: 1.5, borderColor: SURFACE },
  recentName:        { fontSize: 10, color: TS, marginTop: 5, textAlign: 'center' },
  list:              { flex: 1 },
  threadCard:        { marginHorizontal: 16, marginBottom: 8, backgroundColor: GLASS, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...GLASS_WEB },
  threadCardUnread:  { backgroundColor: 'rgba(14,165,233,0.06)', borderColor: 'rgba(14,165,233,0.2)' },
  avatar:            { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:        { fontWeight: '700' },
  threadBody:        { flex: 1 },
  threadName:        { fontSize: 15, fontWeight: '700', color: TP },
  threadPreview:     { fontSize: 12, color: TS, marginTop: 3 },
  threadMeta:        { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  threadTime:        { fontSize: 10, color: TT },
  unreadDot:         { backgroundColor: BLUE, borderRadius: 9, minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  unreadCount:       { fontSize: 10, fontWeight: '800', color: '#FFF' },
  emptyState:        { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyStateTitle:   { fontSize: 16, fontWeight: '700', color: TP, marginTop: 4 },
  emptyStateSub:     { fontSize: 13, color: TT },
  convRoot:          { flex: 1 },
  convBack:          { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  convName:          { fontSize: 16, fontWeight: '700', color: TP, flex: 1 },
  bubbles:           { flex: 1 },
  bubblesContent:    { padding: 16, gap: 8 },
  bubbleRow:         { maxWidth: '80%', gap: 3 },
  bubbleRowSent:     { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleRowRecv:     { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble:            { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleSent:        { backgroundColor: BLUE },
  bubbleRecv:        { backgroundColor: GLASS, borderWidth: 1, borderColor: BORDER },
  bubbleText:        { fontSize: 14, lineHeight: 20 },
  bubbleTextSent:    { color: '#FFF' },
  bubbleTextRecv:    { color: TP },
  bubbleTime:        { fontSize: 10, color: TT },
  composeBar:        { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: GLASS, ...GLASS_WEB },
  composeInput:      { flex: 1, minHeight: 40, maxHeight: 100, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: TP },
  sendBtn:           { width: 40, height: 40, borderRadius: 20, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bottomSpacer:      { height: 32 },
});
