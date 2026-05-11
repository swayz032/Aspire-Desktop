/**
 * FrontDeskHeader — page-level title row (spec §8).
 *
 * - Title "Front Desk" + persona-aware subtitle.
 * - "Back to Aspire" + "Front Desk Setup" buttons (NOT icon-only per spec).
 * - Persona name comes from FrontDeskHub via the existing `fetchFrontDeskConfig`
 *   + `fetchReceptionistPersonas` chain. Zero hardcoding when Tiffany is
 *   selected.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';
import { useIsFinePointer } from '@/lib/useDesktop';

interface FrontDeskHeaderProps {
  /** Resolved persona display name, e.g. "Sarah" or "Tiffany". */
  personaName: string;
  /**
   * True when the persona slug has been resolved from the API. When false,
   * the subtitle renders a neutral shimmer skeleton instead of the
   * persona-specific copy — prevents a "Sarah is handling..." flash for
   * Tiffany-configured tenants on first paint.
   */
  personaResolved?: boolean;
}

export function FrontDeskHeader({ personaName, personaResolved = true }: FrontDeskHeaderProps) {
  const router = useRouter();
  const isFine = useIsFinePointer();

  return (
    <View style={styles.container}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Front Desk</Text>
        {personaResolved ? (
          <Text style={styles.subtitle}>
            {personaName} is handling calls, voice messages, texts, and callback notes.
          </Text>
        ) : (
          <View
            style={styles.subtitleSkeleton}
            accessibilityLabel="Loading receptionist"
          />
        )}
      </View>

      <View style={styles.actions}>
        <Pressable
          // Verified: `app/(tabs)/index.tsx` exists and renders `DesktopHome`
          // (see project structure as of 2026-05-11). `/(tabs)` is the canonical
          // app home route for the desktop shell.
          onPress={() => router.push('/(tabs)' as never)}
          accessibilityRole="button"
          accessibilityLabel="Back to Aspire"
          style={({ hovered, pressed }: any) => [
            styles.btn,
            styles.btnSecondary,
            isFine && hovered && styles.btnSecondaryHover,
            pressed && styles.btnPressed,
          ]}
        >
          <Ionicons name="chevron-back" size={14} color={Colors.text.secondary} />
          <Text style={styles.btnTextSecondary}>Back to Aspire</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/session/calls/setup' as never)}
          accessibilityRole="button"
          accessibilityLabel="Open Front Desk Setup"
          style={({ hovered, pressed }: any) => [
            styles.btn,
            styles.btnPrimary,
            isFine && hovered && styles.btnPrimaryHover,
            pressed && styles.btnPressed,
          ]}
        >
          <Ionicons name="settings-outline" size={14} color="#fff" />
          <Text style={styles.btnTextPrimary}>Front Desk Setup</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  titleBlock: {
    flex: 1,
    minWidth: 280,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    flexWrap: 'wrap',
  },
  // Reduced from 26 -> 18 + dropped bottom margin so this reads as a
  // page-section title, NOT a second header bar competing with the
  // global Aspire DesktopHeader. Subtitle inlines next to the title.
  title: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: Colors.text.tertiary,
    fontSize: 12,
    lineHeight: 16,
  },
  subtitleSkeleton: {
    height: 12,
    width: 240,
    maxWidth: '70%',
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    minHeight: 32,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', transition: 'all 0.15s ease' } as any)
      : {}),
  },
  btnSecondary: {
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  btnSecondaryHover: {
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: '#222224',
  },
  btnPrimary: {
    backgroundColor: '#3B82F6',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.5)',
  },
  btnPrimaryHover: {
    backgroundColor: '#2563EB',
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnTextSecondary: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  btnTextPrimary: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
