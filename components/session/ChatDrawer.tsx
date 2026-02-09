import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { ChatMessage } from '@/types/session';

interface ChatDrawerProps {
  visible: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSend: (text: string) => void;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatDrawer({ visible, onClose, messages, onSend }: ChatDrawerProps) {
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (inputText.trim()) {
      onSend(inputText.trim());
      setInputText('');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.overlay, { pointerEvents: 'box-none' }]}>
          <Pressable style={styles.backdrop} onPress={onClose} />
          <View style={[styles.drawer, { pointerEvents: 'auto' }]}>
            <View style={styles.header}>
              <Text style={styles.title}>Session Chat</Text>
              <Pressable onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </Pressable>
            </View>
            
            <ScrollView 
              style={styles.messagesList}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
            >
              {messages.map((message) => (
                <View 
                  key={message.id} 
                  style={[
                    styles.messageBubble,
                    message.senderId === 'host-1' && styles.myMessage
                  ]}
                >
                  {message.senderId !== 'host-1' && (
                    <Text style={styles.senderName}>{message.senderName}</Text>
                  )}
                  <Text style={styles.messageText}>{message.text}</Text>
                  <Text style={styles.timestamp}>{formatTime(message.timestamp)}</Text>
                </View>
              ))}
            </ScrollView>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Type a message..."
                placeholderTextColor={Colors.text.muted}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
              />
              <Pressable 
                style={({ pressed }) => [styles.sendButton, !inputText.trim() && styles.sendButtonDisabled, pressed && styles.pressed]}
                onPress={handleSend}
                disabled={!inputText.trim()}
              >
                <Ionicons 
                  name="send" 
                  size={20} 
                  color={inputText.trim() ? Colors.text.primary : Colors.text.muted} 
                />
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
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
    backgroundColor: Colors.background.secondary,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    height: '70%',
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  title: {
    ...Typography.headline,
    color: Colors.text.primary,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  messageBubble: {
    backgroundColor: Colors.background.tertiary,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderTopLeftRadius: BorderRadius.sm,
    maxWidth: '85%',
    alignSelf: 'flex-start',
  },
  myMessage: {
    backgroundColor: Colors.accent.cyanDark,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.sm,
    alignSelf: 'flex-end',
  },
  senderName: {
    ...Typography.micro,
    color: Colors.accent.cyan,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  messageText: {
    ...Typography.body,
    color: Colors.text.primary,
  },
  timestamp: {
    ...Typography.micro,
    color: Colors.text.muted,
    marginTop: Spacing.xs,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text.primary,
    ...Typography.body,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.background.tertiary,
  },
  pressed: {
    opacity: 0.7,
  },
});
