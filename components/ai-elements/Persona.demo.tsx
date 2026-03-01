/**
 * Persona Demo — Interactive component verification
 *
 * Cycles through all states to verify premium animations
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { Persona, PersonaState } from './Persona';
import { Colors } from '@/constants/tokens';
import type { AgentName } from '@/lib/elevenlabs';

const STATES: PersonaState[] = ['idle', 'listening', 'thinking', 'speaking'];
const AGENTS: AgentName[] = ['ava', 'finn', 'eli'];

export function PersonaDemo() {
  const [state, setState] = useState<PersonaState>('idle');
  const [agent, setAgent] = useState<AgentName>('ava');
  const [autoPlay, setAutoPlay] = useState(false);

  // Auto-cycle through states every 3s when autoPlay is enabled
  useEffect(() => {
    if (!autoPlay) return;

    const interval = setInterval(() => {
      setState(current => {
        const currentIndex = STATES.indexOf(current);
        const nextIndex = (currentIndex + 1) % STATES.length;
        return STATES[nextIndex];
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [autoPlay]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Persona Component Demo</Text>
        <Text style={styles.subtitle}>
          Premium AI agent orb with voice state animations
        </Text>
      </View>

      {/* Persona Component */}
      <Persona
        state={state}
        variant={agent}
        onVoiceInput={(text) => console.log('Voice input:', text)}
        onVoiceEnd={() => console.log('Voice ended')}
      />

      {/* State Controls */}
      <View style={styles.controls}>
        <Text style={styles.controlLabel}>State:</Text>
        <View style={styles.buttonRow}>
          {STATES.map(s => (
            <Pressable
              key={s}
              style={[
                styles.button,
                state === s && styles.buttonActive,
              ]}
              onPress={() => setState(s)}
            >
              <Text style={[
                styles.buttonText,
                state === s && styles.buttonTextActive,
              ]}>
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Agent Controls */}
      <View style={styles.controls}>
        <Text style={styles.controlLabel}>Agent:</Text>
        <View style={styles.buttonRow}>
          {AGENTS.map(a => (
            <Pressable
              key={a}
              style={[
                styles.button,
                agent === a && styles.buttonActive,
              ]}
              onPress={() => setAgent(a)}
            >
              <Text style={[
                styles.buttonText,
                agent === a && styles.buttonTextActive,
              ]}>
                {a}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Auto-play Toggle */}
      <Pressable
        style={[styles.autoPlayButton, autoPlay && styles.autoPlayButtonActive]}
        onPress={() => setAutoPlay(!autoPlay)}
      >
        <Text style={styles.autoPlayText}>
          {autoPlay ? 'Stop Auto-Cycle' : 'Start Auto-Cycle'}
        </Text>
      </Pressable>

      {/* Verification Checklist */}
      <View style={styles.checklist}>
        <Text style={styles.checklistTitle}>Verification Checklist:</Text>
        <Text style={styles.checklistItem}>✓ Idle: Breathing animation (2s cycle)</Text>
        <Text style={styles.checklistItem}>✓ Listening: Pulsing glow + waveform (1s cycle)</Text>
        <Text style={styles.checklistItem}>✓ Thinking: Rotating shimmer gradient</Text>
        <Text style={styles.checklistItem}>✓ Speaking: Active glow animation</Text>
        <Text style={styles.checklistItem}>✓ Agent colors: Ava purple / Finn green / Eli blue</Text>
        <Text style={styles.checklistItem}>✓ NO jank, NO cheap bounce effects</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    padding: 32,
    alignItems: 'center',
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.tertiary,
  },
  controls: {
    marginTop: 24,
    width: '100%',
    maxWidth: 500,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text.secondary,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  buttonActive: {
    backgroundColor: Colors.accent.cyanLight,
    borderColor: Colors.accent.cyan,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text.tertiary,
  },
  buttonTextActive: {
    color: Colors.accent.cyan,
  },
  autoPlayButton: {
    marginTop: 32,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  autoPlayButtonActive: {
    backgroundColor: Colors.accent.cyanLight,
    borderColor: Colors.accent.cyan,
  },
  autoPlayText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text.primary,
  },
  checklist: {
    marginTop: 32,
    padding: 16,
    backgroundColor: Colors.surface.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.default,
    width: '100%',
    maxWidth: 500,
  },
  checklistTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.text.secondary,
    marginBottom: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  checklistItem: {
    fontSize: 13,
    color: Colors.text.tertiary,
    marginBottom: 6,
    lineHeight: 18,
  },
});
