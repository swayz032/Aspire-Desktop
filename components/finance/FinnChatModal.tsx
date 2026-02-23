import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';
import { useAgentVoice } from '@/hooks/useAgentVoice';
import { useSupabase } from '@/providers';

type ChatMsg = {
  id: string;
  from: 'finn' | 'user';
  text: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function FinnChatModal({ visible, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const { suiteId, session } = useSupabase();

  const finnVoice = useAgentVoice({
    agent: 'finn',
    suiteId: suiteId ?? undefined,
    accessToken: session?.access_token,
    onResponse: (text) => {
      setMessages(prev => [...prev, { id: `finn_${Date.now()}`, from: 'finn', text }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    },
    onError: (_err) => {},
  });

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [visible, slideAnim]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setMessages(prev => [...prev, { id: `user_${Date.now()}`, from: 'user', text: trimmed }]);
    finnVoice.sendText(trimmed);
    setInput('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [input, finnVoice]);

  if (!visible) return null;

  return (
    <Animated.View style={[
      modalStyles.container,
      {
        opacity: slideAnim,
        transform: [{
          translateY: slideAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [20, 0],
          }),
        }],
      },
    ]}>
      <View style={modalStyles.modal}>
        {/* Header */}
        <View style={modalStyles.header}>
          <View style={modalStyles.headerLeft}>
            <View style={modalStyles.finnIcon}>
              <Ionicons name="chatbubble-ellipses" size={14} color="#A78BFA" />
            </View>
            <Text style={modalStyles.headerTitle}>Chat with Finn</Text>
          </View>
          <Pressable onPress={onClose} style={modalStyles.closeBtn}>
            <Ionicons name="close" size={16} color={Colors.text.tertiary} />
          </Pressable>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={modalStyles.messageArea}
          contentContainerStyle={modalStyles.messageContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={modalStyles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={28} color={Colors.text.disabled} />
              <Text style={modalStyles.emptyText}>Ask Finn about cash runway, invoices, expenses, or financial strategy.</Text>
            </View>
          ) : (
            messages.map((msg) => (
              <View key={msg.id} style={[modalStyles.msgRow, msg.from === 'user' && modalStyles.msgRowUser]}>
                {msg.from === 'finn' && (
                  <View style={modalStyles.finnAvatar}>
                    <Ionicons name="sparkles" size={10} color="#A78BFA" />
                  </View>
                )}
                <View style={[modalStyles.msgBubble, msg.from === 'user' ? modalStyles.msgBubbleUser : modalStyles.msgBubbleFinn]}>
                  <Text style={[modalStyles.msgText, msg.from === 'user' && modalStyles.msgTextUser]}>{msg.text}</Text>
                </View>
              </View>
            ))
          )}
          {finnVoice.status === 'thinking' && (
            <View style={modalStyles.msgRow}>
              <View style={modalStyles.finnAvatar}>
                <Ionicons name="sparkles" size={10} color="#A78BFA" />
              </View>
              <View style={modalStyles.msgBubbleFinn}>
                <Text style={modalStyles.thinkingText}>Finn is thinking...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View style={modalStyles.inputRow}>
          <Pressable style={modalStyles.attachBtn}>
            <Ionicons name="attach" size={18} color={Colors.text.tertiary} />
          </Pressable>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask Finn..."
            placeholderTextColor={Colors.text.tertiary}
            style={modalStyles.input}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable
            style={[modalStyles.sendBtn, input.trim() ? modalStyles.sendBtnActive : undefined]}
            onPress={handleSend}
          >
            <Ionicons name="send" size={14} color={input.trim() ? '#fff' : Colors.text.muted} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const modalStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    zIndex: 100,
  } as any,
  modal: {
    width: 360,
    height: 480,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(22,22,26,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.1)',
    } : {}),
  } as any,
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  finnIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(139,92,246,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  } as any,
  messageArea: {
    flex: 1,
  },
  messageContent: {
    padding: 16,
    gap: 10,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    color: Colors.text.tertiary,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 19,
  },
  msgRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  msgRowUser: {
    flexDirection: 'row-reverse',
  },
  finnAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(139,92,246,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  msgBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  msgBubbleUser: {
    backgroundColor: 'rgba(139,92,246,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
    borderBottomRightRadius: 4,
  },
  msgBubbleFinn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderBottomLeftRadius: 4,
  },
  msgText: {
    color: '#ccc',
    fontSize: 13,
    lineHeight: 19,
  },
  msgTextUser: {
    color: '#C4B5FD',
  },
  thinkingText: {
    color: '#888',
    fontSize: 13,
    fontStyle: 'italic',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  attachBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(139,92,246,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: {
    backgroundColor: 'rgba(139,92,246,0.5)',
  },
});
