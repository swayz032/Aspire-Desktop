import React, { useState, useRef, useEffect } from 'react';
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<View>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && !target.closest('[data-suite-dropdown]')) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  return (
    <View style={styles.container}>
      <View style={styles.leftSection} />

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

      <View style={styles.rightSection}>
        <View style={styles.suiteDropdownWrapper} ref={dropdownRef} {...(Platform.OS === 'web' ? { 'data-suite-dropdown': 'true' } as any : {})}>
          <Pressable
            onPress={() => setDropdownOpen(!dropdownOpen)}
            style={({ hovered }: any) => [
              styles.suiteToggle,
              hovered && styles.suiteToggleHover,
              dropdownOpen && styles.suiteToggleActive,
            ]}
          >
            <View style={styles.companyInfo}>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.businessName}>{businessName}</Text>
              </View>
              <Text style={styles.roleText}>{role} • Suite {suiteId}</Text>
            </View>
            <Ionicons
              name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={Colors.text.tertiary}
              style={{ marginLeft: 6 }}
            />
          </Pressable>

          {dropdownOpen && (
            <View style={styles.dropdown}>
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownHeaderText}>Your Suites</Text>
              </View>

              <Pressable
                style={({ hovered }: any) => [
                  styles.dropdownItem,
                  styles.dropdownItemActive,
                  hovered && styles.dropdownItemHover,
                ]}
                onPress={() => setDropdownOpen(false)}
              >
                <View style={styles.dropdownItemLeft}>
                  <View style={[styles.suiteIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                    <Ionicons name="business" size={14} color="#3B82F6" />
                  </View>
                  <View>
                    <Text style={styles.dropdownItemTitle}>{businessName}</Text>
                    <Text style={styles.dropdownItemSub}>Suite {suiteId} • {role}</Text>
                  </View>
                </View>
                <Ionicons name="checkmark" size={16} color="#3B82F6" />
              </Pressable>

              <View style={styles.dropdownDivider} />

              <Pressable
                style={({ hovered }: any) => [
                  styles.dropdownItem,
                  hovered && styles.dropdownItemHover,
                ]}
                onPress={() => {
                  setDropdownOpen(false);
                }}
              >
                <View style={styles.dropdownItemLeft}>
                  <View style={[styles.suiteIcon, { backgroundColor: 'rgba(34, 197, 94, 0.12)' }]}>
                    <Ionicons name="add" size={16} color="#22c55e" />
                  </View>
                  <View>
                    <Text style={[styles.dropdownItemTitle, { color: '#22c55e' }]}>Add Suite</Text>
                    <Text style={styles.dropdownItemSub}>Register a new company</Text>
                  </View>
                </View>
              </Pressable>
            </View>
          )}
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
    zIndex: 100,
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
  suiteDropdownWrapper: {
    position: 'relative',
    zIndex: 200,
  },
  suiteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    ...(Platform.OS === 'web' ? {
      transition: 'all 0.15s ease-out',
      cursor: 'pointer',
    } : {}),
  } as any,
  suiteToggleHover: {
    backgroundColor: '#141416',
    borderColor: '#2C2C2E',
  },
  suiteToggleActive: {
    backgroundColor: '#141416',
    borderColor: '#3C3C3E',
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
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 6,
    width: 280,
    backgroundColor: '#161618',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
    } : {}),
  } as any,
  dropdownHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  dropdownHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6e6e73',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 6,
    borderRadius: 8,
    ...(Platform.OS === 'web' ? {
      transition: 'background-color 0.12s ease-out',
      cursor: 'pointer',
    } : {}),
  } as any,
  dropdownItemActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  dropdownItemHover: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  suiteIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownItemTitle: {
    color: '#f2f2f2',
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownItemSub: {
    color: '#6e6e73',
    fontSize: 11,
    marginTop: 1,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 14,
    marginVertical: 4,
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
