/**
 * ConferenceChatDrawer -- Premium in-meeting chat drawer with 3 tabs.
 *
 * Tabs:
 *   - Room: Multi-party room chat (human participants)
 *   - Materials: Shared documents + authority queue (pending approvals)
 *   - Ava: Private AI assistant chat (uses Ava backend)
 *
 * The Ava tab uses shared MessageBubble (agent="ava") for consistent
 * agent chat styling across the app. Room chat retains its own
 * multi-party bubble rendering since participants are humans, not agents.
 *
 * Device-optimized: maxWidth 480px on desktop, full-width on mobile.
 * Premium Aspire dark aesthetic with glassmorphism and design tokens.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/tokens';
import { MessageBubble, ThinkingIndicator } from '@/components/chat';
import type { AgentChatMessage } from '@/components/chat';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

const avaAvatar = require('../../assets/avatars/ava.png');

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
  isPrivate?: boolean;
  type?: 'message' | 'material';
}

export interface MaterialItem {
  id: string;
  name: string;
  type: 'document' | 'link' | 'action' | 'note';
  sender: string;
  timestamp: Date;
  sensitivity: 'room_safe' | 'internal_sensitive' | 'restricted';
  saved?: boolean;
}

export interface AuthorityItem {
  id: string;
  title: string;
  description: string;
  type: string;
  sensitivity: 'room_safe' | 'internal_sensitive' | 'restricted';
  requestedBy: string;
  recipients?: string[];
  timestamp: Date;
}

interface ConferenceChatDrawerProps {
  visible: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  materials: MaterialItem[];
  onSendMessage: (text: string, isPrivate: boolean) => void;
  onSaveMaterial: (materialId: string) => void;
  currentUserId?: string;
  officeNumber?: string;
  authorityQueue?: AuthorityItem[];
  onApproveAuthority?: (id: string) => void;
  onDenyAuthority?: (id: string) => void;
  /** Whether Ava is currently processing a response in the private tab. */
  avaThinking?: boolean;
}

type TabType = 'room' | 'materials' | 'ava';

// ---------------------------------------------------------------------------
// Web-only glass styles (backdrop-filter doesn't exist in RN native)
// ---------------------------------------------------------------------------
const GLASS_WEB: any = Platform.OS === 'web'
  ? { backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }
  : {};

const DRAWER_SHADOW_WEB: any = Platform.OS === 'web'
  ? { boxShadow: '0 -8px 40px rgba(0,0,0,0.5), 0 -2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)' }
  : {};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a private ChatMessage from Ava to AgentChatMessage for the shared bubble. */
function toAvaChatMessage(msg: ChatMessage, currentUserId: string): AgentChatMessage {
  const isUser = msg.senderId === currentUserId;
  return {
    id: msg.id,
    from: isUser ? 'user' : 'ava',
    text: msg.text,
    timestamp: msg.timestamp.getTime(),
    senderName: isUser ? undefined : msg.senderName,
    senderId: msg.senderId,
    isPrivate: msg.isPrivate,
  };
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function ConferenceChatDrawerInner({
  visible,
  onClose,
  messages,
  materials,
  onSendMessage,
  onSaveMaterial,
  currentUserId = 'you',
  officeNumber = '1247',
  authorityQueue = [],
  onApproveAuthority,
  onDenyAuthority,
  avaThinking = false,
}: ConferenceChatDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('room');
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const { width: windowWidth } = useWindowDimensions();

  // Auto-scroll on new messages
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages.length, avaThinking]);

  const handleSend = () => {
    if (inputText.trim()) {
      onSendMessage(inputText.trim(), activeTab === 'ava');
      setInputText('');
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getSensitivityColor = (sensitivity: MaterialItem['sensitivity']) => {
    switch (sensitivity) {
      case 'room_safe': return Colors.semantic.success;
      case 'internal_sensitive': return Colors.semantic.warning;
      case 'restricted': return Colors.semantic.error;
    }
  };

  const getSensitivityLabel = (sensitivity: MaterialItem['sensitivity']) => {
    switch (sensitivity) {
      case 'room_safe': return 'Room Safe';
      case 'internal_sensitive': return 'Internal';
      case 'restricted': return 'Restricted';
    }
  };

  const getMaterialIcon = (type: MaterialItem['type']): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'document': return 'document-text';
      case 'link': return 'link';
      case 'action': return 'flash';
      case 'note': return 'create';
    }
  };

  const roomMessages = messages.filter(m => !m.isPrivate);
  const privateMessages = messages.filter(m => m.isPrivate);

  const avaMessages = useMemo(
    () => privateMessages.map(m => toAvaChatMessage(m, currentUserId)),
    [privateMessages, currentUserId],
  );

  // Device-optimized width: 480px max on desktop, 100% on narrow screens
  const isWide = windowWidth > 600;
  const drawerWidth = isWide ? Math.min(480, windowWidth * 0.42) : '100%';

  const TABS: { key: TabType; label: string; icon: keyof typeof Ionicons.glyphMap; badge?: number }[] = [
    { key: 'room', label: 'Room', icon: 'chatbubbles', badge: roomMessages.length || undefined },
    { key: 'materials', label: 'Materials', icon: 'folder', badge: (materials.length + authorityQueue.length) || undefined },
    { key: 'ava', label: 'Ava', icon: 'sparkles' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={s.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={s.overlay}>
          <Pressable style={s.backdrop} onPress={onClose} />

          {/* Drawer — centered on desktop, full-width on mobile */}
          <View style={[
            s.drawer,
            isWide && s.drawerCentered,
            { width: drawerWidth } as any,
            DRAWER_SHADOW_WEB,
          ]}>

            {/* ── Drag handle (mobile affordance) ── */}
            <View style={s.handleBar}>
              <View style={s.handle} />
            </View>

            {/* ── Header ── */}
            <View style={s.header}>
              <Text style={s.title}>Session Chat</Text>
              <Pressable style={s.closeButton} onPress={onClose}>
                <View style={s.closeCircle}>
                  <Ionicons name="close" size={16} color={Colors.text.secondary} />
                </View>
              </Pressable>
            </View>

            {/* ── Tab bar ── */}
            <View style={s.tabs}>
              {TABS.map((t) => {
                const active = activeTab === t.key;
                return (
                  <Pressable
                    key={t.key}
                    style={[s.tab, active && s.tabActive]}
                    onPress={() => setActiveTab(t.key)}
                  >
                    {t.key === 'ava' ? (
                      <Image source={avaAvatar} style={s.avaTabAvatar} contentFit="cover" />
                    ) : (
                      <Ionicons
                        name={t.icon}
                        size={14}
                        color={active ? Colors.accent.cyan : Colors.text.muted}
                      />
                    )}
                    <Text style={[s.tabText, active && s.tabTextActive]}>
                      {t.label}
                    </Text>
                    {t.badge != null && t.badge > 0 && (
                      <View style={[s.tabBadge, active && s.tabBadgeActive]}>
                        <Text style={s.tabBadgeText}>{t.badge}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* ── Ava identity strip ── */}
            {activeTab === 'ava' && (
              <View style={[s.avaHeader, GLASS_WEB]}>
                <View style={s.avaInfo}>
                  <View style={s.avaAvatarRing}>
                    <Image source={avaAvatar} style={s.avaAvatarImg} contentFit="cover" />
                    <View style={s.avaOnlineDot} />
                  </View>
                  <View>
                    <Text style={s.avaName}>Ava</Text>
                    <Text style={s.avaRole}>Your AI Assistant · Office #{officeNumber}</Text>
                  </View>
                </View>
                <View style={s.encryptedBadge}>
                  <Ionicons name="shield-checkmark" size={11} color={Colors.semantic.success} />
                  <Text style={s.encryptedText}>Private</Text>
                </View>
              </View>
            )}

            {/* ── Content ── */}
            <View style={s.content}>
              <ScrollView
                ref={scrollRef}
                style={s.messageList}
                contentContainerStyle={s.messageListContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Room tab */}
                {activeTab === 'room' && (
                  roomMessages.length > 0 ? (
                    roomMessages.map((message) => (
                      <View
                        key={message.id}
                        style={[
                          s.messageRow,
                          message.senderId === currentUserId && s.messageRowOwn,
                        ]}
                      >
                        <View style={[
                          s.messageBubble,
                          message.senderId === currentUserId && s.messageBubbleOwn,
                        ]}>
                          {message.senderId !== currentUserId && (
                            <Text style={s.messageSender}>{message.senderName}</Text>
                          )}
                          <Text style={s.messageText}>{message.text}</Text>
                          <Text style={s.messageTime}>{formatTime(message.timestamp)}</Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={s.emptyState}>
                      <View style={s.emptyIcon}>
                        <Ionicons name="chatbubbles-outline" size={28} color={Colors.text.muted} />
                      </View>
                      <Text style={s.emptyTitle}>No messages yet</Text>
                      <Text style={s.emptyText}>Messages sent to the room will appear here</Text>
                    </View>
                  )
                )}

                {/* Materials tab */}
                {activeTab === 'materials' && (
                  <>
                    {authorityQueue.length > 0 && (
                      <View style={s.proposalSection}>
                        <Text style={s.sectionLabel}>PENDING APPROVALS</Text>
                        {authorityQueue.map((item) => (
                          <View key={item.id} style={s.proposalCard}>
                            <View style={s.proposalHeader}>
                              <View style={s.proposalIcon}>
                                <Ionicons name="send" size={14} color={Colors.accent.cyan} />
                              </View>
                              <View style={s.proposalInfo}>
                                <Text style={s.proposalTitle}>{item.title}</Text>
                                <Text style={s.proposalMeta}>Requested by {item.requestedBy}</Text>
                              </View>
                            </View>
                            <View style={[s.sensitivityBadge, { backgroundColor: `${getSensitivityColor(item.sensitivity)}15`, alignSelf: 'flex-start', marginTop: 8 }]}>
                              <View style={[s.sensitivityDot, { backgroundColor: getSensitivityColor(item.sensitivity) }]} />
                              <Text style={[s.sensitivityText, { color: getSensitivityColor(item.sensitivity) }]}>
                                {getSensitivityLabel(item.sensitivity)}
                              </Text>
                            </View>
                            <View style={s.proposalActions}>
                              <Pressable
                                style={s.proposalDeny}
                                onPress={() => onDenyAuthority?.(item.id)}
                              >
                                <Ionicons name="close" size={16} color={Colors.semantic.error} />
                                <Text style={s.proposalDenyText}>Deny</Text>
                              </Pressable>
                              <Pressable
                                style={s.proposalApprove}
                                onPress={() => onApproveAuthority?.(item.id)}
                              >
                                <Ionicons name="checkmark" size={16} color={Colors.semantic.success} />
                                <Text style={s.proposalApproveText}>Approve</Text>
                              </Pressable>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                    {materials.length > 0 ? (
                      materials.map((material) => (
                        <View key={material.id} style={s.materialCard}>
                          <View style={s.materialHeader}>
                            <View style={[s.materialIcon, { backgroundColor: `${getSensitivityColor(material.sensitivity)}20` }]}>
                              <Ionicons
                                name={getMaterialIcon(material.type)}
                                size={16}
                                color={getSensitivityColor(material.sensitivity)}
                              />
                            </View>
                            <View style={s.materialInfo}>
                              <Text style={s.materialName} numberOfLines={1}>{material.name}</Text>
                              <Text style={s.materialMeta}>From {material.sender} · {formatTime(material.timestamp)}</Text>
                            </View>
                          </View>
                          <View style={s.materialFooter}>
                            <View style={[s.sensitivityBadge, { backgroundColor: `${getSensitivityColor(material.sensitivity)}15` }]}>
                              <View style={[s.sensitivityDot, { backgroundColor: getSensitivityColor(material.sensitivity) }]} />
                              <Text style={[s.sensitivityText, { color: getSensitivityColor(material.sensitivity) }]}>
                                {getSensitivityLabel(material.sensitivity)}
                              </Text>
                            </View>
                            <Pressable
                              style={[s.saveButton, material.saved && s.saveButtonSaved]}
                              onPress={() => onSaveMaterial(material.id)}
                            >
                              <Ionicons
                                name={material.saved ? 'checkmark' : 'bookmark-outline'}
                                size={14}
                                color={material.saved ? Colors.semantic.success : Colors.text.secondary}
                              />
                              <Text style={[s.saveButtonText, material.saved && s.saveButtonTextSaved]}>
                                {material.saved ? 'Saved' : 'Save'}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      ))
                    ) : authorityQueue.length === 0 ? (
                      <View style={s.emptyState}>
                        <View style={s.emptyIcon}>
                          <Ionicons name="folder-outline" size={28} color={Colors.text.muted} />
                        </View>
                        <Text style={s.emptyTitle}>No materials shared</Text>
                        <Text style={s.emptyText}>Documents and files shared during the call will appear here</Text>
                      </View>
                    ) : null}
                  </>
                )}

                {/* Ava tab */}
                {activeTab === 'ava' && (
                  avaMessages.length > 0 || avaThinking ? (
                    <>
                      {avaMessages.map((message) => (
                        <MessageBubble
                          key={message.id}
                          message={message}
                          agent="ava"
                        />
                      ))}
                      {avaThinking && (
                        <ThinkingIndicator agent="ava" text="Ava is thinking..." />
                      )}
                    </>
                  ) : (
                    <View style={s.emptyState}>
                      <View style={s.avaEmptyAvatarWrap}>
                        <Image source={avaAvatar} style={s.avaEmptyAvatar} contentFit="cover" />
                      </View>
                      <Text style={s.emptyTitle}>Ask Ava anything</Text>
                      <Text style={s.emptyText}>Private channel — only you can see this conversation. Office data linked.</Text>
                    </View>
                  )
                )}
              </ScrollView>

              {/* ── Input bar ── */}
              {(activeTab === 'room' || activeTab === 'ava') && (
                <View style={[s.inputContainer, GLASS_WEB]}>
                  <TextInput
                    style={s.input}
                    placeholder={activeTab === 'ava' ? 'Ask Ava privately...' : 'Type a message...'}
                    placeholderTextColor={Colors.text.disabled}
                    value={inputText}
                    onChangeText={setInputText}
                    onSubmitEditing={handleSend}
                    returnKeyType="send"
                  />
                  <Pressable
                    style={[s.sendButton, !inputText.trim() && s.sendButtonDisabled]}
                    onPress={handleSend}
                    disabled={!inputText.trim()}
                  >
                    <Ionicons
                      name="arrow-up"
                      size={16}
                      color={inputText.trim() ? '#FFFFFF' : Colors.text.disabled}
                    />
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles — Aspire Premium Dark
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },

  // ── Drawer shell ──
  drawer: {
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '72%',
    maxHeight: 680,
    zIndex: 1,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.border.subtle,
    overflow: 'hidden',
  },
  drawerCentered: {
    // On desktop, drawer anchors to bottom-right like a chat widget
    alignSelf: 'flex-end',
    marginRight: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },

  // ── Drag handle ──
  handleBar: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border.default,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  closeButton: {
    padding: 2,
  },
  closeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Tabs ──
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    padding: 3,
    borderRadius: 12,
    backgroundColor: Colors.surface.tertiary,
    gap: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    gap: 5,
  },
  tabActive: {
    backgroundColor: Colors.surface.card,
    ...(Platform.OS === 'web' ? { boxShadow: '0 1px 3px rgba(0,0,0,0.3)' } as any : {}),
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.muted,
  },
  tabTextActive: {
    color: Colors.text.primary,
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: Colors.border.default,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 7,
    minWidth: 18,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: Colors.accent.cyanLight,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  avaTabAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },

  // ── Ava identity header ──
  avaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.08)',
  },
  avaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avaAvatarRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avaAvatarImg: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  avaOnlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.semantic.success,
    borderWidth: 2,
    borderColor: Colors.background.primary,
  },
  avaName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  avaRole: {
    fontSize: 11,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  encryptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.12)',
  },
  encryptedText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.semantic.success,
    letterSpacing: 0.3,
  },

  // ── Content ──
  content: {
    flex: 1,
    marginTop: 6,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
    flexGrow: 1,
  },

  // ── Room chat bubbles ──
  messageRow: {
    alignItems: 'flex-start',
  },
  messageRowOwn: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '82%',
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  messageBubbleOwn: {
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
    borderColor: 'rgba(59, 130, 246, 0.15)',
  },
  messageSender: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.tertiary,
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  messageText: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 10,
    color: Colors.text.muted,
    marginTop: 4,
    alignSelf: 'flex-end',
  },

  // ── Empty state ──
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 48,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
    letterSpacing: -0.2,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  avaEmptyAvatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avaEmptyAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },

  // ── Material cards ──
  materialCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  materialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  materialIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  materialInfo: {
    flex: 1,
  },
  materialName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  materialMeta: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 2,
  },
  materialFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  sensitivityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sensitivityDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  sensitivityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surface.cardHover,
  },
  saveButtonSaved: {
    backgroundColor: Colors.semantic.successLight,
  },
  saveButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  saveButtonTextSaved: {
    color: Colors.semantic.success,
  },

  // ── Input bar ──
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    backgroundColor: Colors.background.primary,
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: Colors.surface.input,
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 14,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.surface.cardHover,
  },

  // ── Proposals ──
  proposalSection: {
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  proposalCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.04)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
    marginBottom: 10,
  },
  proposalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  proposalIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.accent.cyanLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proposalInfo: {
    flex: 1,
  },
  proposalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  proposalMeta: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 2,
  },
  proposalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  proposalDeny: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.semantic.errorLight,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.15)',
  },
  proposalDenyText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.semantic.error,
  },
  proposalApprove: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.semantic.successLight,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.15)',
  },
  proposalApproveText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.semantic.success,
  },
});

export function ConferenceChatDrawer(props: any) {
  return (
    <PageErrorBoundary pageName="conference-chat-drawer">
      <ConferenceChatDrawerInner {...props} />
    </PageErrorBoundary>
  );
}
