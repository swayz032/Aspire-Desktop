/**
 * AddressCorrectionPrompt — soft yellow banner shown when Address Validation
 * returns `needs_correction`.
 *
 * Aspire Law #3: never silently rewrite — user accepts or rejects explicitly.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  suggestedAddress: string;
  onAccept: () => void;
  onReject: () => void;
}

export function AddressCorrectionPrompt({
  suggestedAddress,
  onAccept,
  onReject,
}: Props) {
  return (
    <View style={styles.banner} testID="address-correction-prompt" accessibilityRole="alert">
      <View style={styles.iconWrap}>
        <Ionicons name="navigate-outline" size={16} color="#fbbf24" />
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>Did you mean:</Text>
        <Text style={styles.suggestion} numberOfLines={2}>
          {suggestedAddress}
        </Text>
        <View style={styles.actions}>
          <Pressable
            onPress={onAccept}
            accessibilityRole="button"
            accessibilityLabel="Use suggested address"
            style={({ hovered, pressed }: any) => [
              styles.primary,
              hovered && styles.primaryHover,
              pressed && styles.primaryPressed,
            ]}
          >
            <Text style={styles.primaryText}>Use this</Text>
          </Pressable>
          <Pressable
            onPress={onReject}
            accessibilityRole="button"
            accessibilityLabel="Try a different address"
            style={({ hovered, pressed }: any) => [
              styles.ghost,
              hovered && styles.ghostHover,
              pressed && styles.ghostPressed,
            ]}
          >
            <Text style={styles.ghostText}>Try a different address</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(251,191,36,0.95)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  suggestion: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  primary: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#fbbf24',
  },
  primaryHover: {
    backgroundColor: '#f5b518',
  },
  primaryPressed: {
    opacity: 0.9,
  },
  primaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0A0A0F',
    letterSpacing: -0.1,
  },
  ghost: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'transparent',
  },
  ghostHover: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.20)',
  },
  ghostPressed: {
    opacity: 0.85,
  },
  ghostText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.1,
  },
});
