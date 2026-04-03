/**
 * ConferenceCaptions — live transcription captions overlay.
 * Shows the last 3 transcript entries at the bottom of the video grid.
 * Entries auto-dismiss after 8 seconds.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Colors } from '@/constants/tokens';
import type { ZoomTranscriptEntry } from './ZoomConferenceProvider';

interface CaptionsProps {
  entries: ZoomTranscriptEntry[];
  visible: boolean;
}

interface CaptionLine {
  id: string;
  speakerName: string;
  text: string;
  addedAt: number;
}

export function ConferenceCaptions({ entries, visible }: CaptionsProps) {
  const [lines, setLines] = useState<CaptionLine[]>([]);

  // Add new entries as caption lines
  useEffect(() => {
    if (entries.length === 0) return;
    const latest = entries[entries.length - 1];
    setLines(prev => {
      const id = `${latest.speakerId}-${latest.timestamp}`;
      if (prev.some(l => l.id === id)) return prev;
      const next = [...prev, { id, speakerName: latest.speakerName, text: latest.text, addedAt: Date.now() }];
      // Keep only last 3
      return next.slice(-3);
    });
  }, [entries]);

  // Auto-dismiss old lines
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setLines(prev => prev.filter(l => now - l.addedAt < 8000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!visible || lines.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {lines.map(line => (
        <View key={line.id} style={styles.captionLine}>
          <Text style={styles.speaker}>{line.speakerName}:</Text>
          <Text style={styles.text}>{line.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 150,
  },
  captionLine: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 4,
    maxWidth: '80%',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } : {}),
  } as any,
  speaker: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accent.cyan,
  },
  text: {
    fontSize: 13,
    color: '#fff',
    flex: 1,
  },
});
