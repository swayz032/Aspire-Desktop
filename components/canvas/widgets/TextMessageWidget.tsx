import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, Pressable, FlatList, StyleSheet, Platform,
  TextInput, KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSmsThreads, useSmsMessages } from '@/hooks/useSmsThreads';
import type { SmsMessage, SmsThread } from '@/types/frontdesk';
import { playClickSound, playMessageSentSound } from '@/lib/sounds';

interface TextMessageWidgetProps {
  suiteId: string;
  officeId: string;
}

const SENT_GRADIENT: [string, string] = ['#FF1B6B', '#7C3AED'];

const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#0EA5E9'];

function colorFromPhone(phone: string): string {
  const seed = phone.replace(/\D/g, '').slice(-4) || '1234';
  return AVATAR_COLORS[Number(seed) % AVATAR_COLORS.length];
}

function formatPhone(phone: string): string {
  const c = phone.replace(/\D/g, '');
  if (c.length === 11 && c.startsWith('1')) return `(${c.slice(1, 4)}) ${c.slice(4, 7)}-${c.slice(7)}`;
  if (c.length === 10) return `(${c.slice(0, 3)}) ${c.slice(3, 6)}-${c.slice(6)}`;
  return phone;
}

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return Math.floor(h / 24) === 1 ? 'Yesterday' : `${Math.floor(h / 24)}d`;
}

function phoneInitial(phone: string): string {
  const c = phone.replace(/\D/g, '');
  return c.slice(-2, -1) || '#';
}

export function TextMessageWidget({ suiteId, officeId }: TextMessageWidgetProps) {
  const { threads, loading: threadsLoading } = useSmsThreads();
  const [selectedThread, setSelectedThread] = useState<SmsThread | null>(null);
  const { messages, loading: msgsLoading } = useSmsMessages(
    selectedThread?.thread_id ?? null
  );
  const [inputText, setInputText] = useState('');
  const flatRef = useRef<FlatList<SmsMessage>>(null);

  useEffect(() => {
    if (!selectedThread && threads && threads.length > 0) {
      setSelectedThread(threads[0]);
    }
  }, [threads]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !selectedThread) return;
    playMessageSentSound();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setInputText('');
    try {
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: selectedThread.thread_id, body: text }),
      });
    } catch {}
  }, [inputText, selectedThread]);

  if (selectedThread) {
    const color = colorFromPhone(selectedThread.counterparty_e164 || '');
    const displayName = formatPhone(selectedThread.counterparty_e164 || '');
    return (
      <View style={s.root}>
        {/* Conversation header */}
        <View style={s.convHeader}>
          <Pressable style={s.backBtn} onPress={() => setSelectedThread(null)}>
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </Pressable>
          <View style={[s.convAvatar, { backgroundColor: color }]}>
            <Text style={s.convAvatarText}>{phoneInitial(selectedThread.counterparty_e164 || '')}</Text>
          </View>
          <View style={s.convHeaderInfo}>
            <Text style={s.convName} numberOfLines={1}>{displayName}</Text>
            <Text style={s.convStatus}>SMS</Text>
          </View>
          <Pressable style={s.callBtn}>
            <Ionicons name="call-outline" size={18} color="rgba(255,255,255,0.55)" />
          </Pressable>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={m => m.sms_message_id}
          contentContainerStyle={s.msgList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={s.emptyConv}>
              <Text style={s.emptyConvText}>{msgsLoading ? 'Loading…' : 'No messages yet'}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSent = item.direction === 'outbound';
            return (
              <View style={[s.bubbleRow, isSent ? s.bubbleRowRight : s.bubbleRowLeft]}>
                {isSent ? (
                  <LinearGradient
                    colors={SENT_GRADIENT}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[s.bubble, s.bubbleSent]}
                  >
                    <Text style={s.bubbleText}>{item.body}</Text>
                  </LinearGradient>
                ) : (
                  <View style={[s.bubble, s.bubbleRecv]}>
                    <Text style={s.bubbleText}>{item.body}</Text>
                  </View>
                )}
              </View>
            );
          }}
        />

        {/* Compose */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.compose}>
            <TextInput
              style={s.composeInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Message…"
              placeholderTextColor="rgba(255,255,255,0.25)"
              multiline
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
            <Pressable
              onPress={handleSend}
              style={[s.sendBtn, !inputText.trim() && s.sendBtnDisabled]}
            >
              {inputText.trim() ? (
                <LinearGradient colors={SENT_GRADIENT} style={s.sendGrad}>
                  <Ionicons name="arrow-up" size={18} color="#FFF" />
                </LinearGradient>
              ) : (
                <View style={s.sendGradInactive}>
                  <Ionicons name="arrow-up" size={18} color="rgba(255,255,255,0.3)" />
                </View>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Thread list header */}
      <View style={s.listHeader}>
        <Text style={s.listTitle}>Messages</Text>
        <Pressable style={s.composeIconBtn} onPress={() => playClickSound()}>
          <Ionicons name="create-outline" size={20} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </View>

      {/* Thread list */}
      <FlatList
        data={threads}
        keyExtractor={t => t.thread_id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.emptyList}>
            <Ionicons name="chatbubbles-outline" size={36} color="rgba(255,255,255,0.1)" />
            <Text style={s.emptyListText}>{threadsLoading ? 'Loading…' : 'No conversations'}</Text>
          </View>
        }
        renderItem={({ item: thread }) => {
          const color = colorFromPhone(thread.counterparty_e164 || '');
          const displayName = formatPhone(thread.counterparty_e164 || '');
          return (
            <Pressable
              style={s.threadRow}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                playClickSound();
                setSelectedThread(thread);
              }}
            >
              <View style={[s.threadAvatar, { backgroundColor: color }]}>
                <Text style={s.threadAvatarText}>{phoneInitial(thread.counterparty_e164 || '')}</Text>
              </View>
              <View style={s.threadInfo}>
                <View style={s.threadTopRow}>
                  <Text style={s.threadName} numberOfLines={1}>{displayName}</Text>
                  <Text style={s.threadTime}>{relativeTime(thread.last_message_at)}</Text>
                </View>
                <Text style={s.threadPreview} numberOfLines={1}>
                  {thread.counterparty_e164 || 'SMS conversation'}
                </Text>
              </View>
              {(thread.unread_count ?? 0) > 0 && (
                <View style={s.unreadBadge}>
                  <Text style={s.unreadBadgeText}>{thread.unread_count}</Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#08090F',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  listTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
  } as any,
  composeIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 12,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  threadAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  threadAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  } as any,
  threadInfo: { flex: 1, gap: 3 },
  threadTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  threadName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    flex: 1,
  } as any,
  threadTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginLeft: 8,
  },
  threadPreview: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.38)',
  },
  unreadBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  } as any,
  emptyList: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  emptyListText: {
    color: 'rgba(255,255,255,0.22)',
    fontSize: 14,
  },
  convHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  convAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  convAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  } as any,
  convHeaderInfo: { flex: 1 },
  convName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  } as any,
  convStatus: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 1,
  },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  msgList: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  emptyConv: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyConvText: {
    color: 'rgba(255,255,255,0.22)',
    fontSize: 13,
  },
  bubbleRow: {
    marginBottom: 6,
  },
  bubbleRowLeft: { alignItems: 'flex-start' },
  bubbleRowRight: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleSent: {
    borderRadius: 18,
    borderBottomRightRadius: 3,
  },
  bubbleRecv: {
    borderRadius: 18,
    borderBottomLeftRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  bubbleText: {
    fontSize: 14,
    color: '#FFF',
    lineHeight: 20,
  },
  compose: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    gap: 8,
  },
  composeInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFF',
    maxHeight: 100,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendGrad: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendGradInactive: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
