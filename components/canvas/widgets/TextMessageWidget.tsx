import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSmsMessages, useSmsThreads } from '@/hooks/useSmsThreads';
import type { SmsMessage } from '@/types/frontdesk';

interface TextMessageWidgetProps {
  suiteId: string;
  officeId: string;
}

function formatE164(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return value;
}

function normalizeE164(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (!cleaned) return '';
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`;
  if (cleaned.length === 10) return `+1${cleaned}`;
  return value.startsWith('+') ? value : `+${cleaned}`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return day === 1 ? 'Yesterday' : `${day}d`;
}

function dateSeparatorText(message: SmsMessage | undefined): string {
  if (!message) return 'Today';
  const date = new Date(message.received_at || message.created_at);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function colorFromPhone(phone: string): [string, string] {
  const seed = phone.replace(/\D/g, '').slice(-4) || '1234';
  const num = Number(seed);
  const palettes: [string, string][] = [
    ['#1D4ED8', '#0284C7'],
    ['#0EA5E9', '#0284C7'],
    ['#0891B2', '#0369A1'],
    ['#1E40AF', '#0EA5E9'],
  ];
  return palettes[num % palettes.length];
}

function MessageBubble({ message }: { message: SmsMessage }): React.ReactElement {
  const outbound = message.direction === 'outbound';
  return (
    <View style={[styles.bubbleWrap, outbound ? styles.bubbleWrapOut : styles.bubbleWrapIn]}>
      <View style={[styles.bubble, outbound ? styles.bubbleOut : styles.bubbleIn]}>
        <Text style={styles.bubbleBody}>{message.body}</Text>
        <View style={styles.bubbleMeta}>
          <Text style={styles.bubbleTime}>{relativeTime(message.received_at || message.created_at)}</Text>
          {outbound ? (
            <Ionicons
              name={message.delivery_status === 'delivered' || message.delivery_status === 'read' ? 'checkmark-done' : 'time-outline'}
              size={11}
              color={message.delivery_status === 'delivered' || message.delivery_status === 'read' ? '#22C55E' : 'rgba(255,255,255,0.6)'}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function TextMessageWidget(_: TextMessageWidgetProps) {
  const router = useRouter();
  const { threads, loading: threadsLoading, error: threadsError } = useSmsThreads({ pollInterval: 5000, limit: 30 });
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const { messages, loading: messagesLoading, error: messagesError, refresh } = useSmsMessages(selectedThreadId);
  const [search, setSearch] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [newConversation, setNewConversation] = useState(false);
  const [newTo, setNewTo] = useState('');

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.thread_id === selectedThreadId) || null,
    [threads, selectedThreadId],
  );

  const filteredThreads = useMemo(() => {
    if (!search.trim()) return threads;
    const term = search.trim();
    return threads.filter((thread) => formatE164(thread.counterparty_e164).includes(term) || thread.counterparty_e164.includes(term));
  }, [threads, search]);

  const sendMessage = async (): Promise<void> => {
    const toE164 = selectedThread ? selectedThread.counterparty_e164 : normalizeE164(newTo);
    if (!toE164 || !body.trim() || sending) return;
    setSending(true);
    setSendError(null);

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toE164, body: body.trim() }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `Failed to send (${res.status})`);
      }

      setBody('');
      setNewConversation(false);
      setNewTo('');
      refresh();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const showConversation = !!selectedThreadId || newConversation;

  return (
    <View style={styles.container}>
      <View style={styles.bgAccentA} />
      <View style={styles.bgAccentB} />

      <View style={styles.headerRow}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title}>Messages</Text>
          <Text style={styles.subtitle}>{threads.length} threads</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              setSelectedThreadId(null);
              setNewConversation(true);
            }}
            style={styles.newBtn}
          >
            <Ionicons name="add" size={14} color="#BAE6FD" />
          </Pressable>
          <Pressable onPress={() => router.push('/session/messages')} style={styles.expandBtn}>
            <Text style={styles.expandText}>Expand</Text>
          </Pressable>
        </View>
      </View>

      {!showConversation ? (
        <View style={styles.threadPane}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={14} color="rgba(255,255,255,0.65)" />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search conversations"
              placeholderTextColor="rgba(255,255,255,0.4)"
            />
          </View>

          {threadsLoading ? <Text style={styles.helper}>Loading threads...</Text> : null}
          {threadsError ? <Text style={styles.errorText}>{threadsError}</Text> : null}
          {!threadsLoading && filteredThreads.length === 0 ? <Text style={styles.helper}>No messages yet</Text> : null}

          <ScrollView style={styles.threadList} showsVerticalScrollIndicator={false}>
            {filteredThreads.map((thread) => {
              const gradient = colorFromPhone(thread.counterparty_e164);
              const avatarStyle = Platform.OS === 'web'
                ? ({ backgroundImage: `linear-gradient(140deg, ${gradient[0]}, ${gradient[1]})` } as unknown as ViewStyle)
                : { backgroundColor: gradient[0] };

              return (
                <Pressable
                  key={thread.thread_id}
                  style={[styles.threadRow, thread.unread_count > 0 && styles.threadRowUnread]}
                  onPress={() => {
                    setNewConversation(false);
                    setSelectedThreadId(thread.thread_id);
                  }}
                >
                  <View style={[styles.threadAvatar, avatarStyle]}>
                    <Text style={styles.threadAvatarText}>{thread.counterparty_e164.slice(-2)}</Text>
                  </View>
                  <View style={styles.threadBody}>
                    <Text style={styles.threadName} numberOfLines={1}>{formatE164(thread.counterparty_e164)}</Text>
                    <Text style={styles.threadPreview} numberOfLines={1}>Tap to open conversation</Text>
                  </View>
                  <View style={styles.threadMeta}>
                    <Text style={styles.threadTime}>{relativeTime(thread.last_message_at)}</Text>
                    {thread.unread_count > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{thread.unread_count}</Text>
                      </View>
                    ) : (
                      <View style={styles.readDot} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.conversationPane}>
          <View style={styles.conversationHeader}>
            <Pressable
              onPress={() => {
                setSelectedThreadId(null);
                setNewConversation(false);
              }}
            >
              <Ionicons name="arrow-back" size={16} color="#E0F2FE" />
            </Pressable>
            <Text style={styles.conversationTitle} numberOfLines={1}>
              {newConversation ? 'New Conversation' : formatE164(selectedThread?.counterparty_e164 || '')}
            </Text>
            <Pressable onPress={() => router.push('/session/messages')}>
              <Text style={styles.linkText}>View Contact</Text>
            </Pressable>
          </View>

          {newConversation ? (
            <View style={styles.newConversationRow}>
              <Text style={styles.newConversationLabel}>To</Text>
              <TextInput
                value={newTo}
                onChangeText={setNewTo}
                placeholder="+1 (555) 123-4567"
                placeholderTextColor="rgba(255,255,255,0.38)"
                keyboardType="phone-pad"
                style={styles.newConversationInput}
              />
            </View>
          ) : null}

          {messagesLoading ? <Text style={styles.helper}>Loading messages...</Text> : null}
          {messagesError ? <Text style={styles.errorText}>{messagesError}</Text> : null}

          <ScrollView style={styles.messageList} contentContainerStyle={styles.messageListContent}>
            {!newConversation && messages.length > 0 ? (
              <View style={styles.dateSeparator}>
                <Text style={styles.dateSeparatorText}>{dateSeparatorText(messages[0])}</Text>
              </View>
            ) : null}
            {messages.map((message) => (
              <MessageBubble key={message.sms_message_id} message={message} />
            ))}
            {!newConversation && !messagesLoading && messages.length === 0 ? (
              <Text style={styles.helper}>No messages yet in this thread.</Text>
            ) : null}
          </ScrollView>

          <View style={styles.composeRow}>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Type message"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.composeInput}
              multiline
            />
            <Pressable
              onPress={sendMessage}
              disabled={(!body.trim() || sending || (newConversation && !normalizeE164(newTo)))}
              style={[
                styles.sendBtn,
                (!body.trim() || sending || (newConversation && !normalizeE164(newTo))) && styles.sendBtnDisabled,
              ]}
            >
              <Ionicons name="arrow-up" size={16} color="#fff" />
            </Pressable>
          </View>
          {sendError ? <Text style={styles.errorText}>{sendError}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071A2F',
    padding: 10,
    gap: 8,
    overflow: 'hidden',
  },
  bgAccentA: {
    position: 'absolute',
    top: -60,
    right: -35,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(14,165,233,0.12)',
  },
  bgAccentB: {
    position: 'absolute',
    bottom: -80,
    left: -45,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleWrap: {
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E0F2FE',
  },
  subtitle: {
    color: 'rgba(224,242,254,0.7)',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newBtn: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.45)',
    backgroundColor: 'rgba(56,189,248,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  expandText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '700',
  },
  threadPane: {
    flex: 1,
    gap: 8,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.24)',
    paddingHorizontal: 10,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' } as unknown as ViewStyle)
      : {}),
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 12,
    paddingVertical: 8,
  },
  threadList: {
    flex: 1,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  threadRowUnread: {
    backgroundColor: 'rgba(14,165,233,0.04)',
  },
  threadAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.42)',
  },
  threadAvatarText: {
    color: '#E0F2FE',
    fontSize: 10,
    fontWeight: '700',
  },
  threadBody: {
    flex: 1,
    gap: 2,
  },
  threadName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  threadPreview: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 10,
  },
  threadMeta: {
    alignItems: 'flex-end',
    gap: 4,
    minWidth: 32,
  },
  threadTime: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
  },
  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  readDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  helper: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
  },
  conversationPane: {
    flex: 1,
    gap: 8,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 8,
  },
  conversationTitle: {
    flex: 1,
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '700',
  },
  linkText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
  },
  newConversationRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(0,0,0,0.24)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  newConversationLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  newConversationInput: {
    flex: 1,
    color: '#fff',
    fontSize: 12,
    paddingVertical: 8,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    gap: 6,
    paddingBottom: 8,
  },
  dateSeparator: {
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 4,
  },
  dateSeparatorText: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  bubbleWrap: {
    width: '100%',
  },
  bubbleWrapOut: {
    alignItems: 'flex-end',
  },
  bubbleWrapIn: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bubbleOut: {
    backgroundColor: '#0284C7',
    ...(Platform.OS === 'web' ? ({ backgroundImage: 'linear-gradient(135deg,#0EA5E9,#0284C7)' } as unknown as ViewStyle) : {}),
  },
  bubbleIn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  bubbleBody: {
    color: '#fff',
    fontSize: 11,
  },
  bubbleMeta: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'flex-end',
  },
  bubbleTime: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 9,
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingTop: 4,
  },
  composeInput: {
    flex: 1,
    color: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(0,0,0,0.24)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    maxHeight: 80,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 0 16px rgba(14,165,233,0.45)' } as unknown as ViewStyle) : {}),
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 11,
  },
});
