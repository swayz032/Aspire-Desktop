import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const timPortrait = require('@/assets/agents/tim/tim-portrait.png');

interface SampleMessage {
  id: string;
  time: string;
  text: string;
}

const sampleMessages: SampleMessage[] = [
  {
    id: 'm1',
    time: 'Today',
    text: "I'm Tim — Service Hub Manager. Once I'm wired up I'll help you size jobs, draft estimates, and keep your office on track.",
  },
  {
    id: 'm2',
    time: 'Coming soon',
    text: "Tim's chat lands in the Tim Enterprise build. For now, this rail is a visual stub — the framing and styling are production-ready.",
  },
];

export function TimRailChatStub() {
  return (
    <View style={styles.container} testID="tim-rail-chat-stub">
      <Text style={styles.dayDivider}>Today</Text>
      {sampleMessages.map((m) => (
        <View key={m.id} style={styles.messageRow}>
          <Image source={timPortrait} style={styles.miniAvatar} resizeMode="cover" />
          <View style={styles.messageBlock}>
            <View style={styles.messageMeta}>
              <Text style={styles.messageAuthor}>Tim</Text>
              <Text style={styles.messageTime}>· {m.time}</Text>
            </View>
            <View style={styles.messageBubble}>
              <Text style={styles.messageText}>{m.text}</Text>
            </View>
          </View>
        </View>
      ))}
      <View style={styles.placeholderRow}>
        <View style={styles.placeholderDot} />
        <Text style={styles.placeholderText}>Tim is coming soon — chat input lands with Tim Enterprise.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 14,
  },
  dayDivider: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.40)',
    textAlign: 'center',
    marginBottom: 2,
  },
  messageRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  miniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  messageBlock: {
    flex: 1,
    gap: 4,
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  messageAuthor: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  messageTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.40)',
  },
  messageBubble: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderTopLeftRadius: 3,
  },
  messageText: {
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.85)',
  },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    marginTop: 4,
  },
  placeholderDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(251, 191, 36, 0.55)',
  },
  placeholderText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.40)',
    fontStyle: 'italic',
    flex: 1,
  },
});
