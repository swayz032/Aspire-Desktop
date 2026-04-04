/**
 * GuestConferenceHeader — Branded header for the guest conference view.
 *
 * Shows Aspire logo (left), room name (center), encrypted badge (right).
 * Dark glassmorphism background. Height: 56px (matches host ConferenceHeader).
 */
import React from 'react';
import { View, Text, StyleSheet, Platform, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';

const aspireLogo = require('../../assets/images/aspire-logo-premium.png');

interface GuestConferenceHeaderProps {
  roomName: string;
}

export function GuestConferenceHeader({ roomName }: GuestConferenceHeaderProps) {
  return (
    <View
      style={styles.header}
      accessibilityRole="header"
      accessibilityLabel={`${roomName || 'Conference'} — End-to-end encrypted`}
    >
      <View style={styles.logoSection}>
        <Image
          source={aspireLogo}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel="Aspire"
        />
      </View>

      <View style={styles.centerSection}>
        <Text style={styles.roomName} numberOfLines={1} selectable>
          {roomName || 'Conference'}
        </Text>
      </View>

      <View style={styles.rightSection}>
        <View
          style={styles.encryptedBadge}
          accessibilityRole="text"
          accessibilityLabel="End-to-end encrypted"
        >
          <Ionicons name="lock-closed" size={12} color={Colors.accent.cyan} />
          <Text style={styles.encryptedText}>Encrypted</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56, // Matches host ConferenceHeader height
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl, // 20px — matches host header
    backgroundColor: 'rgba(10, 10, 12, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    } as unknown as ViewStyle : {}),
  },
  logoSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  logo: {
    height: 22, // Slightly smaller — logo should not dominate the header
    width: 80,
  },
  centerSection: {
    flex: 2,
    alignItems: 'center',
  },
  roomName: {
    ...Typography.captionMedium, // 14px/500 — matches host roomName (14px/600)
    color: Colors.text.secondary, // #d1d1d6 — readable, not white (hierarchy)
    letterSpacing: 0.3,
  },
  rightSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  encryptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs, // 4px
    paddingHorizontal: Spacing.sm, // 8px
    paddingVertical: Spacing.xs, // 4px
    borderRadius: BorderRadius.sm, // 6px
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.10)',
    minHeight: 28,
  },
  encryptedText: {
    ...Typography.small, // 12px — matches host encryptedLabel
    color: Colors.text.muted, // #6e6e73 — matches host "Encrypted" color
    fontWeight: '400',
  },
});
