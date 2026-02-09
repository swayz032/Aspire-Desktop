import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';

const USER_PROFILE = require('@/assets/images/user-profile.jpg');

interface DesktopHeaderProps {
  businessName?: string;
  role?: string;
  suiteId?: string;
}

export function DesktopHeader({ 
  businessName = 'Zenith Solutions',
  role = 'Founder',
  suiteId = '1042'
}: DesktopHeaderProps) {
  return (
    <View style={styles.container}>
      {/* Left spacer for balance */}
      <View style={styles.leftSection} />

      {/* Centered search bar */}
      <View style={styles.centerSection}>
        <Pressable 
          style={({ hovered }: any) => [
            styles.searchBar,
            hovered && styles.searchBarHover,
          ]}
        >
          <Ionicons name="search" size={16} color={Colors.text.tertiary} />
          <Text style={styles.searchPlaceholder}>Search or press ⌘K</Text>
        </Pressable>
      </View>

      {/* Right section with company info and profile */}
      <View style={styles.rightSection}>
        <View style={styles.companyInfo}>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.businessName}>{businessName}</Text>
          </View>
          <Text style={styles.roleText}>{role} • Suite {suiteId}</Text>
        </View>

        <Pressable 
          style={({ pressed, hovered }: any) => [
            styles.iconButton,
            hovered && styles.iconButtonHover,
            pressed && styles.iconButtonPressed,
          ]}
        >
          <Ionicons name="notifications" size={18} color={Colors.text.secondary} />
          <View style={styles.notificationBadge} />
        </Pressable>

        <Pressable 
          style={({ pressed, hovered }: any) => [
            styles.profileButton,
            hovered && styles.profileButtonHover,
            pressed && styles.profileButtonPressed,
          ]}
        >
          <View style={styles.profileRing}>
            <Image source={USER_PROFILE} style={styles.profileImage} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    backgroundColor: Colors.background.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  leftSection: {
    flex: 1,
  },
  centerSection: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.input,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    gap: 10,
    width: '100%',
    maxWidth: 400,
    ...(Platform.OS === 'web' ? {
      transition: 'all 0.15s ease-out',
      cursor: 'pointer',
    } : {}),
  } as any,
  searchBarHover: {
    borderColor: '#3C3C3E',
    backgroundColor: '#1E1E20',
  },
  searchPlaceholder: {
    fontSize: 13,
    color: Colors.text.tertiary,
  },
  rightSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
  },
  companyInfo: {
    alignItems: 'flex-end',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4facfe',
  },
  businessName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  roleText: {
    fontSize: 12,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    backgroundColor: '#1C1C1E',
    ...(Platform.OS === 'web' ? {
      transition: 'all 0.15s ease-out',
      cursor: 'pointer',
    } : {}),
  } as any,
  iconButtonHover: {
    backgroundColor: '#242426',
    borderColor: '#3C3C3E',
  },
  iconButtonPressed: {
    backgroundColor: '#0a0a0c',
    transform: [{ scale: 0.95 }],
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.semantic.error,
  },
  profileButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    backgroundColor: '#1C1C1E',
    ...(Platform.OS === 'web' ? {
      transition: 'all 0.15s ease-out',
      cursor: 'pointer',
    } : {}),
  } as any,
  profileButtonHover: {
    backgroundColor: '#242426',
    borderColor: '#3C3C3E',
  },
  profileButtonPressed: {
    backgroundColor: '#0a0a0c',
    transform: [{ scale: 0.95 }],
  },
  profileRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});
