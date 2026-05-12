import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Phase 2 visual stub. Disabled — Phase N (Tim Enterprise) wires the real
// ElevenLabs voice session here.
export function TimRailVoiceButton() {
  const onHover = Platform.OS === 'web';
  const tooltip = 'Voice activates when Tim Enterprise launches';

  return (
    <View style={styles.container} testID="tim-rail-voice-button">
      <View style={styles.composer}>
        <View style={styles.composerLeft}>
          <Ionicons name="add" size={16} color="rgba(255,255,255,0.45)" />
          <Text style={styles.composerPlaceholder}>Ask Tim about this project…</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled
          style={styles.micButton}
          accessibilityLabel={tooltip}
          {...(onHover ? { title: tooltip } as any : {})}
          testID="tim-rail-mic-button"
        >
          <Ionicons name="mic" size={15} color="rgba(255,255,255,0.55)" />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled
          style={[styles.sendButton]}
          accessibilityLabel="Send disabled until Tim Enterprise launches"
          testID="tim-rail-send-button"
        >
          <Ionicons name="arrow-up" size={14} color="#0A0A0F" />
        </TouchableOpacity>
      </View>
      <Text style={styles.disclaimer}>Tim is in Private Beta. Voice + send activate with Tim Enterprise.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 6,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.30)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  composerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  composerPlaceholder: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.40)',
  },
  micButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  sendButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.55,
  },
  disclaimer: {
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
});
