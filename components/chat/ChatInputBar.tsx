/**
 * ChatInputBar -- Shared text input + mic toggle + send button for all agent chats.
 *
 * Replaces duplicated input footer implementations in:
 *   - EliVoiceChatPanel (~lines 354-396)
 *   - AvaDeskPanel (inline input area)
 *   - FinnDeskPanel (inline input area)
 *
 * Features:
 *   - Text input with Enter to send, Shift+Enter for newline
 *   - Send button appears when input has text, colored by agent accent
 *   - Mic toggle button (optional, shown when onMicToggle provided)
 *   - Loading state disables input and shows subtle indicator
 *   - Agent-colored focus ring on web
 *   - Consistent Aspire dark glass aesthetic
 */

import React, { useRef, useCallback, useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  type ViewStyle,
  type TextStyle,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '@/constants/tokens';
import type { AgentId } from './types';
import { AGENT_COLORS } from './types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatInputBarProps {
  /** Current input text value. */
  value: string;
  /** Called when text changes. */
  onChangeText: (text: string) => void;
  /** Called when user presses send. */
  onSend: () => void;
  /** Called when mic button is toggled. If undefined, mic button is hidden. */
  onMicToggle?: () => void;
  /** Whether mic is currently active/recording. */
  isMicActive?: boolean;
  /** Disables input and send while processing. */
  isLoading?: boolean;
  /** Input placeholder text. */
  placeholder?: string;
  /** Agent identity for accent color on focus/send. */
  agent?: AgentId;
  /** Additional container style. */
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const ChatInputBar = React.memo(function ChatInputBar({
  value,
  onChangeText,
  onSend,
  onMicToggle,
  isMicActive = false,
  isLoading = false,
  placeholder = 'Type a message...',
  agent,
  style,
}: ChatInputBarProps) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const agentColor = agent ? AGENT_COLORS[agent] : Colors.accent.cyan;
  const hasText = value.trim().length > 0;

  const handleSend = useCallback(() => {
    if (!hasText || isLoading) return;
    onSend();
  }, [hasText, isLoading, onSend]);

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (Platform.OS !== 'web') return;
      const nativeEvent = e.nativeEvent as TextInputKeyPressEventData & {
        shiftKey?: boolean;
      };
      if (nativeEvent.key === 'Enter' && !nativeEvent.shiftKey) {
        e.preventDefault?.();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleMicPress = useCallback(() => {
    if (!onMicToggle) return;
    // Pulse feedback
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.08,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(pulseAnim, {
        toValue: 1,
        damping: 15,
        stiffness: 200,
        useNativeDriver: true,
      }),
    ]).start();
    onMicToggle();
  }, [onMicToggle, pulseAnim]);

  // Dynamic focus border style
  const focusBorderStyle: ViewStyle = isFocused
    ? { borderColor: agentColor }
    : {};

  return (
    <View style={[s.container, style]}>
      <View style={[s.inputWrapper, focusBorderStyle]}>
        <TextInput
          ref={inputRef}
          style={[s.input, isLoading && s.inputDisabled]}
          placeholder={placeholder}
          placeholderTextColor={Colors.text.muted}
          value={value}
          onChangeText={onChangeText}
          onKeyPress={handleKeyPress}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          returnKeyType="send"
          editable={!isLoading}
          multiline={false}
          accessibilityLabel="Message input"
          accessibilityHint="Type a message and press Enter to send"
        />

        {/* Send button */}
        {hasText && (
          <TouchableOpacity
            onPress={handleSend}
            disabled={isLoading}
            style={[
              s.sendButton,
              { backgroundColor: isLoading ? Colors.text.muted : agentColor },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Ionicons name="arrow-up" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Mic toggle button */}
      {onMicToggle && (
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            onPress={handleMicPress}
            disabled={isLoading}
            style={[
              s.micButton,
              { borderColor: agentColor },
              isMicActive && { backgroundColor: agentColor },
            ]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={
              isMicActive ? 'End voice input' : 'Start voice input'
            }
            accessibilityState={{ selected: isMicActive }}
          >
            <Ionicons
              name={isMicActive ? 'mic' : 'mic-outline'}
              size={20}
              color={isMicActive ? '#fff' : agentColor}
            />
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.surface.cardBorder,
  },

  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.input,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surface.inputBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'web' ? 8 : Spacing.sm,
    ...(Platform.OS === 'web'
      ? ({
          transition: 'border-color 150ms ease-out',
        } as unknown as ViewStyle)
      : {}),
  },

  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none' } as unknown as TextStyle)
      : {}),
  },
  inputDisabled: {
    opacity: 0.5,
  },

  sendButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },

  micButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.surface.input,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
