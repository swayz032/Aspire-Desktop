import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ImageBackground,
  FlatList,
  ViewStyle,
  Animated as RNAnimated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useSmsThreads, useSmsMessages } from '@/hooks/useSmsThreads';
import type { SmsThread, SmsMessage } from '@/types/frontdesk';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HERO_IMAGE = require('@/assets/images/professional_busines_3e03cde8.jpg');
const THREAD_LIST_WIDTH = 340;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format E.164 phone number for display. */
function formatE164(e164: string): string {
  if (!e164) return '';
  const digits = e164.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return e164;
}

/** Relative timestamp label (e.g. "2m ago", "Yesterday"). */
function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Full timestamp for message bubbles. */
function messageTimestamp(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Delivery status icon
// ---------------------------------------------------------------------------

function DeliveryIcon({ status }: { status: string | null }) {
  if (!status) return null;
  const lower = (status ?? '').toLowerCase();
  if (lower === 'failed' || lower === 'undelivered') {
    return <Ionicons name="alert-circle" size={12} color={Colors.semantic.error} />;
  }
  if (lower === 'delivered' || lower === 'read') {
    return <Ionicons name="checkmark-done" size={12} color={Colors.semantic.success} />;
  }
  // sent / queued / accepted
  return <Ionicons name="checkmark" size={12} color={Colors.text.muted} />;
}

// ---------------------------------------------------------------------------
// Thread List Item
// ---------------------------------------------------------------------------

interface ThreadItemProps {
  thread: SmsThread;
  selected: boolean;
  onSelect: (id: string) => void;
}

function ThreadItem({ thread, selected, onSelect }: ThreadItemProps) {
  return (
    <Pressable onPress={() => onSelect(thread.thread_id)}>
      <Card
        variant="default"
        padding="sm"
        style={[
          threadItemStyles.card,
          selected ? threadItemStyles.cardSelected : undefined,
        ] as any}
      >
        <View style={threadItemStyles.row}>
          {/* Contact avatar placeholder */}
          <View style={threadItemStyles.avatar}>
            <Ionicons name="person" size={18} color={Colors.text.secondary} />
          </View>

          <View style={threadItemStyles.body}>
            <View style={threadItemStyles.topRow}>
              <Text style={threadItemStyles.phone} numberOfLines={1}>
                {formatE164(thread.counterparty_e164)}
              </Text>
              <Text style={threadItemStyles.time}>
                {relativeTime(thread.last_message_at)}
              </Text>
            </View>

            <View style={threadItemStyles.bottomRow}>
              <Text style={threadItemStyles.preview} numberOfLines={1}>
                {thread.status === 'active' ? 'Tap to view conversation' : thread.status}
              </Text>
              {thread.unread_count > 0 && (
                <Badge
                  label={String(thread.unread_count)}
                  variant="warning"
                  size="sm"
                />
              )}
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const threadItemStyles = StyleSheet.create({
  card: {
    marginBottom: 6,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface.card,
  },
  cardSelected: {
    backgroundColor: Colors.surface.cardHover,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent.cyan,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phone: {
    ...Typography.bodyMedium,
    color: Colors.text.primary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  time: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preview: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    flex: 1,
    marginRight: Spacing.sm,
  },
});

// ---------------------------------------------------------------------------
// Message Bubble
// ---------------------------------------------------------------------------

interface BubbleProps {
  message: SmsMessage;
}

function MessageBubble({ message }: BubbleProps) {
  const isOutbound = message.direction === 'outbound';

  return (
    <View
      style={[
        bubbleStyles.wrapper,
        isOutbound ? bubbleStyles.wrapperOutbound : bubbleStyles.wrapperInbound,
      ]}
    >
      <View
        style={[
          bubbleStyles.bubble,
          isOutbound ? bubbleStyles.bubbleOutbound : bubbleStyles.bubbleInbound,
        ]}
      >
        <Text style={bubbleStyles.text}>{message.body}</Text>
        <View style={bubbleStyles.meta}>
          <Text style={bubbleStyles.timestamp}>
            {messageTimestamp(message.received_at ?? message.created_at)}
          </Text>
          {isOutbound && <DeliveryIcon status={message.delivery_status} />}
        </View>
      </View>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  wrapperOutbound: {
    alignItems: 'flex-end',
  },
  wrapperInbound: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  bubbleOutbound: {
    backgroundColor: Colors.accent.cyanLight,
    borderBottomRightRadius: BorderRadius.xs,
  },
  bubbleInbound: {
    backgroundColor: Colors.surface.cardElevated,
    borderBottomLeftRadius: BorderRadius.xs,
  },
  text: {
    ...Typography.caption,
    color: Colors.text.primary,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  timestamp: {
    ...Typography.micro,
    color: Colors.text.muted,
  },
});

// ---------------------------------------------------------------------------
// Compose Bar
// ---------------------------------------------------------------------------

interface ComposeBarProps {
  onSend: (body: string) => void;
  sending: boolean;
}

function ComposeBar({ onSend, sending }: ComposeBarProps) {
  const [text, setText] = useState('');

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    onSend(trimmed);
    setText('');
  }, [text, sending, onSend]);

  return (
    <View style={composeStyles.container}>
      <TextInput
        style={composeStyles.input}
        placeholder="Type a message..."
        placeholderTextColor={Colors.text.muted}
        value={text}
        onChangeText={setText}
        onSubmitEditing={handleSend}
        returnKeyType="send"
        editable={!sending}
        multiline
        accessibilityLabel="Message input"
        accessibilityHint="Type your SMS message here"
      />
      <Pressable
        style={[
          composeStyles.sendButton,
          (!text.trim() || sending) && composeStyles.sendButtonDisabled,
        ]}
        onPress={handleSend}
        disabled={!text.trim() || sending}
        accessibilityLabel="Send message"
        accessibilityRole="button"
      >
        <Ionicons
          name="send"
          size={18}
          color={text.trim() && !sending ? '#FFFFFF' : Colors.text.disabled}
        />
      </Pressable>
    </View>
  );
}

const composeStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    backgroundColor: Colors.background.secondary,
  },
  input: {
    flex: 1,
    ...Typography.caption,
    color: Colors.text.primary,
    backgroundColor: Colors.surface.input,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.surface.inputBorder,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.background.tertiary,
  },
});

// ---------------------------------------------------------------------------
// Empty / Compliance States
// ---------------------------------------------------------------------------

function EmptyConversation() {
  return (
    <View style={emptyStyles.container}>
      <Ionicons name="chatbubbles-outline" size={48} color={Colors.text.muted} />
      <Text style={emptyStyles.title}>No conversation selected</Text>
      <Text style={emptyStyles.subtitle}>Choose a thread from the left to view messages</Text>
    </View>
  );
}

function EmptyThreads() {
  return (
    <View style={emptyStyles.container}>
      <Ionicons name="chatbubbles-outline" size={48} color={Colors.text.muted} />
      <Text style={emptyStyles.title}>No conversations yet</Text>
      <Text style={emptyStyles.subtitle}>
        Messages with your business line will appear here
      </Text>
    </View>
  );
}

function ComplianceBanner() {
  return (
    <Card variant="default" padding="md" style={complianceStyles.card as ViewStyle}>
      <View style={complianceStyles.row}>
        <Ionicons name="warning" size={20} color={Colors.semantic.warning} />
        <View style={complianceStyles.textBlock}>
          <Text style={complianceStyles.title}>SMS not enabled</Text>
          <Text style={complianceStyles.body}>
            Set up your Front Desk business line to enable text messaging capabilities.
          </Text>
        </View>
      </View>
    </Card>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xxxl,
  },
  title: {
    ...Typography.bodyMedium,
    color: Colors.text.secondary,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.text.muted,
    textAlign: 'center',
  },
});

const complianceStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.accent.amberLight,
    borderColor: Colors.accent.amberMedium,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...Typography.captionMedium,
    color: Colors.semantic.warning,
  },
  body: {
    ...Typography.small,
    color: Colors.text.tertiary,
  },
});

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function MessagesPage() {
  // -- Data hooks -----------------------------------------------------------
  const { threads, loading: threadsLoading, error: threadsError } = useSmsThreads();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    refresh: refreshMessages,
  } = useSmsMessages(selectedThreadId);

  // -- Search ---------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');

  // -- Compose / Send -------------------------------------------------------
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // -- SMS enabled (derived: if we have threads OR no error, treat as enabled) -
  const smsEnabled = !threadsError;

  // -- Thread selection animation -------------------------------------------
  const fadeAnim = useRef(new RNAnimated.Value(1)).current;

  const handleSelectThread = useCallback(
    (threadId: string) => {
      if (threadId === selectedThreadId) return;
      // Fade out, swap, fade in
      RNAnimated.timing(fadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }).start(() => {
        setSelectedThreadId(threadId);
        setSendError(null);
        RNAnimated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }).start();
      });
    },
    [selectedThreadId, fadeAnim],
  );

  // -- Auto-scroll to bottom on new messages --------------------------------
  const flatListRef = useRef<FlatList<SmsMessage>>(null);
  useEffect(() => {
    if (messages.length > 0) {
      // Small delay so FlatList has time to render
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  // -- Send message handler -------------------------------------------------
  const selectedThread = threads.find((t) => t.thread_id === selectedThreadId);

  const handleSend = useCallback(
    async (body: string) => {
      if (!selectedThread) return;
      setSending(true);
      setSendError(null);
      try {
        const res = await fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toE164: selectedThread.counterparty_e164,
            body,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        refreshMessages();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to send message';
        setSendError(message);
      } finally {
        setSending(false);
      }
    },
    [selectedThread, refreshMessages],
  );

  // -- Filtered threads -----------------------------------------------------
  const filteredThreads = searchQuery
    ? threads.filter((t) =>
        formatE164(t.counterparty_e164)
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        t.counterparty_e164.includes(searchQuery),
      )
    : threads;

  // -- Message list renderer ------------------------------------------------
  const renderMessage = useCallback(
    ({ item }: { item: SmsMessage }) => <MessageBubble message={item} />,
    [],
  );
  const messageKeyExtractor = useCallback(
    (item: SmsMessage) => item.sms_message_id,
    [],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <DesktopShell fullBleed>
      <View style={styles.root}>
        {/* ============================================================== */}
        {/* Hero Banner                                                     */}
        {/* ============================================================== */}
        <ImageBackground
          source={HERO_IMAGE}
          style={styles.heroBanner}
          imageStyle={styles.heroImage}
        >
          <LinearGradient
            colors={['rgba(10, 10, 10, 0.3)', 'rgba(10, 10, 10, 0.75)']}
            style={styles.heroOverlay}
          >
            <View style={styles.heroContent}>
              <LinearGradient
                colors={[Colors.accent.cyan, Colors.accent.cyanDark]}
                style={styles.heroIconWrap}
              >
                <Ionicons name="chatbubbles" size={24} color="#fff" />
              </LinearGradient>
              <View style={styles.heroTextBlock}>
                <Text style={styles.heroTitle}>Text Messages</Text>
                <Text style={styles.heroSubtitle}>
                  {threads.length} conversation{threads.length !== 1 ? 's' : ''}
                  {threads.reduce((n, t) => n + t.unread_count, 0) > 0 &&
                    ` \u00B7 ${threads.reduce((n, t) => n + t.unread_count, 0)} unread`}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>

        {/* ============================================================== */}
        {/* Compliance banner if SMS not enabled                            */}
        {/* ============================================================== */}
        {!smsEnabled && <ComplianceBanner />}

        {/* ============================================================== */}
        {/* Split Pane                                                      */}
        {/* ============================================================== */}
        <View style={styles.splitPane}>
          {/* ------------------------------------------------------------ */}
          {/* Left Panel - Thread List                                      */}
          {/* ------------------------------------------------------------ */}
          <View style={styles.leftPanel}>
            {/* Search bar */}
            <View style={styles.searchContainer}>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={16} color={Colors.text.muted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search conversations..."
                  placeholderTextColor={Colors.text.muted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  accessibilityLabel="Search conversations"
                />
                {searchQuery.length > 0 && (
                  <Pressable
                    onPress={() => setSearchQuery('')}
                    accessibilityLabel="Clear search"
                    accessibilityRole="button"
                  >
                    <Ionicons name="close-circle" size={16} color={Colors.text.muted} />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Thread list */}
            <ScrollView
              style={styles.threadScroll}
              contentContainerStyle={styles.threadScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {threadsLoading && filteredThreads.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading threads...</Text>
                </View>
              ) : filteredThreads.length === 0 ? (
                <EmptyThreads />
              ) : (
                filteredThreads.map((thread) => (
                  <ThreadItem
                    key={thread.thread_id}
                    thread={thread}
                    selected={thread.thread_id === selectedThreadId}
                    onSelect={handleSelectThread}
                  />
                ))
              )}
            </ScrollView>
          </View>

          {/* ------------------------------------------------------------ */}
          {/* Right Panel - Conversation                                    */}
          {/* ------------------------------------------------------------ */}
          <RNAnimated.View style={[styles.rightPanel, { opacity: fadeAnim }]}>
            {!selectedThreadId ? (
              <EmptyConversation />
            ) : (
              <View style={styles.conversationContainer}>
                {/* Conversation header */}
                <View style={styles.conversationHeader}>
                  <View style={styles.conversationHeaderAvatar}>
                    <Ionicons name="person" size={20} color={Colors.text.secondary} />
                  </View>
                  <View style={styles.conversationHeaderInfo}>
                    <Text style={styles.conversationHeaderPhone}>
                      {selectedThread
                        ? formatE164(selectedThread.counterparty_e164)
                        : ''}
                    </Text>
                    <Text style={styles.conversationHeaderSub}>
                      {selectedThread
                        ? `via ${formatE164(selectedThread.business_number_e164)}`
                        : ''}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.conversationHeaderAction}
                    onPress={refreshMessages}
                    accessibilityLabel="Refresh messages"
                    accessibilityRole="button"
                  >
                    <Ionicons name="refresh" size={18} color={Colors.text.secondary} />
                  </Pressable>
                </View>

                {/* Message list */}
                {messagesLoading && messages.length === 0 ? (
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading messages...</Text>
                  </View>
                ) : messagesError ? (
                  <View style={styles.loadingContainer}>
                    <Ionicons name="alert-circle" size={24} color={Colors.semantic.error} />
                    <Text style={styles.errorText}>Failed to load messages</Text>
                  </View>
                ) : messages.length === 0 ? (
                  <View style={emptyStyles.container}>
                    <Ionicons name="chatbubble-outline" size={36} color={Colors.text.muted} />
                    <Text style={emptyStyles.subtitle}>No messages in this thread yet</Text>
                  </View>
                ) : (
                  <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={messageKeyExtractor}
                    contentContainerStyle={styles.messageListContent}
                    showsVerticalScrollIndicator={false}
                    style={styles.messageList}
                  />
                )}

                {/* Send error banner */}
                {sendError && (
                  <View style={styles.sendErrorBanner}>
                    <Ionicons name="alert-circle" size={14} color={Colors.semantic.error} />
                    <Text style={styles.sendErrorText}>{sendError}</Text>
                    <Pressable
                      onPress={() => setSendError(null)}
                      accessibilityLabel="Dismiss error"
                      accessibilityRole="button"
                    >
                      <Ionicons name="close" size={14} color={Colors.text.muted} />
                    </Pressable>
                  </View>
                )}

                {/* Compose bar */}
                <ComposeBar onSend={handleSend} sending={sending} />
              </View>
            )}
          </RNAnimated.View>
        </View>
      </View>
    </DesktopShell>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },

  // -- Hero Banner ----------------------------------------------------------
  heroBanner: {
    height: 130,
    overflow: 'hidden',
  },
  heroImage: {
    resizeMode: 'cover',
  },
  heroOverlay: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextBlock: {
    flex: 1,
  },
  heroTitle: {
    ...Typography.title,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    ...Typography.caption,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },

  // -- Split Pane -----------------------------------------------------------
  splitPane: {
    flex: 1,
    flexDirection: 'row',
  },

  // -- Left Panel (Thread List) ---------------------------------------------
  leftPanel: {
    width: THREAD_LIST_WIDTH,
    borderRightWidth: 1,
    borderRightColor: Colors.border.subtle,
    backgroundColor: Colors.background.secondary,
  },
  searchContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface.input,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.surface.inputBorder,
  },
  searchInput: {
    flex: 1,
    ...Typography.caption,
    color: Colors.text.primary,
    padding: 0,
  },
  threadScroll: {
    flex: 1,
  },
  threadScrollContent: {
    padding: Spacing.sm,
    paddingBottom: Spacing.xl,
  },

  // -- Right Panel (Conversation) -------------------------------------------
  rightPanel: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },

  // -- Conversation ---------------------------------------------------------
  conversationContainer: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    backgroundColor: Colors.background.secondary,
    gap: Spacing.md,
  },
  conversationHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversationHeaderInfo: {
    flex: 1,
  },
  conversationHeaderPhone: {
    ...Typography.bodyMedium,
    color: Colors.text.primary,
  },
  conversationHeaderSub: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: 1,
  },
  conversationHeaderAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingVertical: Spacing.lg,
  },

  // -- Loading / Error ------------------------------------------------------
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.sm,
  },
  loadingText: {
    ...Typography.caption,
    color: Colors.text.muted,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.semantic.error,
  },

  // -- Send Error Banner ----------------------------------------------------
  sendErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.semantic.errorLight,
  },
  sendErrorText: {
    ...Typography.small,
    color: Colors.semantic.error,
    flex: 1,
  },
});
