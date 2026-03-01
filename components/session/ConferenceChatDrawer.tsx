/**
 * ConferenceChatDrawer -- In-meeting chat drawer with 3 tabs.
 *
 * Tabs:
 *   - Room: Multi-party room chat (human participants)
 *   - Materials: Shared documents + authority queue (pending approvals)
 *   - Private Ava: Private AI assistant chat (uses Ava backend)
 *
 * The Ava tab uses shared MessageBubble (agent="ava") for consistent
 * agent chat styling across the app. Room chat retains its own
 * multi-party bubble rendering since participants are humans, not agents.
 */

import React, { useState, useMemo } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Colors, Spacing, BorderRadius } from '@/constants/tokens';
import { MessageBubble, ThinkingIndicator } from '@/components/chat';
import type { AgentChatMessage } from '@/components/chat';

const avaLogo = require('../../assets/images/ava-logo.png');

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

export function ConferenceChatDrawer({
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
      case 'room_safe': return '#4ade80';
      case 'internal_sensitive': return '#FBBF24';
      case 'restricted': return '#EF4444';
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

  // Convert private Ava messages to shared AgentChatMessage format
  const avaMessages = useMemo(
    () => privateMessages.map(m => toAvaChatMessage(m, currentUserId)),
    [privateMessages, currentUserId],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={onClose} />
          <View style={styles.drawer}>
            <View style={styles.header}>
              <Text style={styles.title}>Chat</Text>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
              </Pressable>
            </View>

          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, activeTab === 'room' && styles.tabActive]}
              onPress={() => setActiveTab('room')}
            >
              <Text style={[styles.tabText, activeTab === 'room' && styles.tabTextActive]}>
                Room
              </Text>
              {roomMessages.length > 0 && (
                <View style={[styles.tabBadge, activeTab === 'room' && styles.tabBadgeActive]}>
                  <Text style={styles.tabBadgeText}>{roomMessages.length}</Text>
                </View>
              )}
            </Pressable>

            <Pressable
              style={[styles.tab, activeTab === 'materials' && styles.tabActive]}
              onPress={() => setActiveTab('materials')}
            >
              <Text style={[styles.tabText, activeTab === 'materials' && styles.tabTextActive]}>
                Materials
              </Text>
              {materials.length > 0 && (
                <View style={[styles.tabBadge, activeTab === 'materials' && styles.tabBadgeActive]}>
                  <Text style={styles.tabBadgeText}>{materials.length}</Text>
                </View>
              )}
            </Pressable>

            <Pressable
              style={[styles.tab, activeTab === 'ava' && styles.tabActive]}
              onPress={() => setActiveTab('ava')}
            >
              <View style={styles.tabWithIcon}>
                <Ionicons
                  name="lock-closed"
                  size={10}
                  color={activeTab === 'ava' ? '#3B82F6' : 'rgba(255,255,255,0.5)'}
                />
                <Text style={[styles.tabText, activeTab === 'ava' && styles.tabTextActive]}>
                  Private Ava
                </Text>
              </View>
            </Pressable>
          </View>

          {activeTab === 'ava' && (
            <View style={styles.privateHeader}>
              <View style={styles.avaInfo}>
                <Image
                  source={avaLogo}
                  style={styles.avaAvatar}
                  contentFit="contain"
                />
                <View>
                  <Text style={styles.avaName}>Personal Ava</Text>
                  <Text style={styles.officeNumber}>Office #{officeNumber}</Text>
                </View>
              </View>
              <View style={styles.privateBadge}>
                <Ionicons name="lock-closed" size={10} color="#3B82F6" />
                <Text style={styles.privateBadgeText}>Private</Text>
              </View>
            </View>
          )}

          <View style={styles.content}>
            <ScrollView
              style={styles.messageList}
              contentContainerStyle={styles.messageListContent}
            >
              {activeTab === 'room' && (
                roomMessages.length > 0 ? (
                  roomMessages.map((message) => (
                    <View
                      key={message.id}
                      style={[
                        styles.messageRow,
                        message.senderId === currentUserId && styles.messageRowOwn,
                      ]}
                    >
                      <View style={[
                        styles.messageBubble,
                        message.senderId === currentUserId && styles.messageBubbleOwn,
                      ]}>
                        {message.senderId !== currentUserId && (
                          <Text style={styles.messageSender}>{message.senderName}</Text>
                        )}
                        <Text style={styles.messageText}>{message.text}</Text>
                        <Text style={styles.messageTime}>{formatTime(message.timestamp)}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons name="chatbubbles-outline" size={36} color="rgba(255,255,255,0.2)" />
                    <Text style={styles.emptyTitle}>No messages yet</Text>
                    <Text style={styles.emptyText}>Messages sent to the room will appear here</Text>
                  </View>
                )
              )}

              {activeTab === 'materials' && (
                <>
                  {authorityQueue.length > 0 && (
                    <View style={styles.proposalSection}>
                      <Text style={styles.proposalSectionTitle}>Pending Approvals</Text>
                      {authorityQueue.map((item) => (
                        <View key={item.id} style={styles.proposalCard}>
                          <View style={styles.proposalHeader}>
                            <View style={styles.proposalIcon}>
                              <Ionicons name="send" size={14} color="#3B82F6" />
                            </View>
                            <View style={styles.proposalInfo}>
                              <Text style={styles.proposalTitle}>{item.title}</Text>
                              <Text style={styles.proposalMeta}>Requested by {item.requestedBy}</Text>
                            </View>
                          </View>
                          <View style={[styles.sensitivityBadge, { backgroundColor: `${getSensitivityColor(item.sensitivity)}15`, alignSelf: 'flex-start', marginTop: 8 }]}>
                            <View style={[styles.sensitivityDot, { backgroundColor: getSensitivityColor(item.sensitivity) }]} />
                            <Text style={[styles.sensitivityText, { color: getSensitivityColor(item.sensitivity) }]}>
                              {getSensitivityLabel(item.sensitivity)}
                            </Text>
                          </View>
                          <View style={styles.proposalActions}>
                            <Pressable
                              style={styles.proposalDeny}
                              onPress={() => onDenyAuthority?.(item.id)}
                            >
                              <Ionicons name="close" size={16} color="#EF4444" />
                              <Text style={styles.proposalDenyText}>Deny</Text>
                            </Pressable>
                            <Pressable
                              style={styles.proposalApprove}
                              onPress={() => onApproveAuthority?.(item.id)}
                            >
                              <Ionicons name="checkmark" size={16} color="#4ade80" />
                              <Text style={styles.proposalApproveText}>Approve</Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                  {materials.length > 0 ? (
                    materials.map((material) => (
                      <View key={material.id} style={styles.materialCard}>
                        <View style={styles.materialHeader}>
                          <View style={[styles.materialIcon, { backgroundColor: `${getSensitivityColor(material.sensitivity)}20` }]}>
                            <Ionicons
                              name={getMaterialIcon(material.type)}
                              size={16}
                              color={getSensitivityColor(material.sensitivity)}
                            />
                          </View>
                          <View style={styles.materialInfo}>
                            <Text style={styles.materialName} numberOfLines={1}>{material.name}</Text>
                            <Text style={styles.materialMeta}>From {material.sender} • {formatTime(material.timestamp)}</Text>
                          </View>
                        </View>
                        <View style={styles.materialFooter}>
                          <View style={[styles.sensitivityBadge, { backgroundColor: `${getSensitivityColor(material.sensitivity)}15` }]}>
                            <View style={[styles.sensitivityDot, { backgroundColor: getSensitivityColor(material.sensitivity) }]} />
                            <Text style={[styles.sensitivityText, { color: getSensitivityColor(material.sensitivity) }]}>
                              {getSensitivityLabel(material.sensitivity)}
                            </Text>
                          </View>
                          <Pressable
                            style={[styles.saveButton, material.saved && styles.saveButtonSaved]}
                            onPress={() => onSaveMaterial(material.id)}
                          >
                            <Ionicons
                              name={material.saved ? 'checkmark' : 'bookmark-outline'}
                              size={14}
                              color={material.saved ? '#4ade80' : 'rgba(255,255,255,0.7)'}
                            />
                            <Text style={[styles.saveButtonText, material.saved && styles.saveButtonTextSaved]}>
                              {material.saved ? 'Saved' : 'Save'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ))
                  ) : authorityQueue.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="folder-outline" size={36} color="rgba(255,255,255,0.2)" />
                      <Text style={styles.emptyTitle}>No materials shared</Text>
                      <Text style={styles.emptyText}>Documents and files shared during the call will appear here</Text>
                    </View>
                  ) : null}
                </>
              )}

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
                  <View style={styles.emptyState}>
                    <Ionicons name="lock-closed" size={36} color="rgba(255,255,255,0.2)" />
                    <Text style={styles.emptyTitle}>Private Ava Channel</Text>
                    <Text style={styles.emptyText}>Ask Ava private questions that only you can see. Office data linked.</Text>
                  </View>
                )
              )}
            </ScrollView>

            {(activeTab === 'room' || activeTab === 'ava') && (
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder={activeTab === 'ava' ? 'Ask Ava privately...' : 'Type a message...'}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={handleSend}
                  returnKeyType="send"
                />
                <Pressable
                  style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                  onPress={handleSend}
                  disabled={!inputText.trim()}
                >
                  <Ionicons name="send" size={18} color={inputText.trim() ? '#3B82F6' : 'rgba(255,255,255,0.3)'} />
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

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  drawer: {
    backgroundColor: '#121417',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    height: '70%',
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  tabActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  tabWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#D4D4D8',
  },
  tabTextActive: {
    color: '#3B82F6',
  },
  tabBadge: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 18,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  privateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(59, 130, 246, 0.1)',
  },
  avaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avaAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  avaName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  officeNumber: {
    fontSize: 11,
    color: '#A1A1AA',
    marginTop: 1,
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  privateBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#3B82F6',
  },
  content: {
    flex: 1,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  // Room chat bubbles (multi-party human chat -- NOT agent chat)
  messageRow: {
    alignItems: 'flex-start',
  },
  messageRowOwn: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '85%',
    backgroundColor: '#242426',
    borderRadius: 14,
    borderTopLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageBubbleOwn: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 4,
  },
  messageSender: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D4D4D8',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 10,
    color: '#A1A1AA',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#D4D4D8',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13,
    color: '#A1A1AA',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  materialCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  materialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  materialIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  materialInfo: {
    flex: 1,
  },
  materialName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  materialMeta: {
    fontSize: 11,
    color: '#A1A1AA',
    marginTop: 2,
  },
  materialFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
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
    borderRadius: 6,
    backgroundColor: '#242426',
  },
  saveButtonSaved: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  saveButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#D4D4D8',
  },
  saveButtonTextSaved: {
    color: '#4ade80',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 34,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#121417',
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: '#1E1E20',
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#1E1E20',
  },
  proposalSection: {
    marginBottom: 16,
  },
  proposalSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A1A1AA',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  proposalCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
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
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proposalInfo: {
    flex: 1,
  },
  proposalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  proposalMeta: {
    fontSize: 11,
    color: '#A1A1AA',
    marginTop: 2,
  },
  proposalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  proposalDeny: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  proposalDenyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  proposalApprove: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
  },
  proposalApproveText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4ade80',
  },
});
