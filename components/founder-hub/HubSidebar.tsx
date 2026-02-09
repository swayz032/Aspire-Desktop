import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { Colors, Typography } from '@/constants/tokens';
import { useSidebarState } from '@/lib/uiStore';

const logoSource = require('../../assets/images/aspire-logo-new.png');
const iconSource = require('../../assets/images/aspire-icon-square.png');

type NavItem = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  route: string;
  isExternal?: boolean;
};

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home', route: '/(tabs)', isExternal: true },
  { id: 'daily-brief', label: 'Daily Brief', icon: 'sunny-outline', iconActive: 'sunny', route: '/founder-hub/daily-brief' },
  { id: 'pulse', label: 'Pulse', icon: 'pulse-outline', iconActive: 'pulse', route: '/founder-hub/pulse' },
  { id: 'library', label: 'Library', icon: 'library-outline', iconActive: 'library', route: '/founder-hub/library' },
  { id: 'studio', label: 'Studio', icon: 'bulb-outline', iconActive: 'bulb', route: '/founder-hub/studio' },
  { id: 'notes', label: 'Notes', icon: 'journal-outline', iconActive: 'journal', route: '/founder-hub/notes' },
  { id: 'templates', label: 'Templates', icon: 'documents-outline', iconActive: 'documents', route: '/founder-hub/templates' },
  { id: 'masterminds', label: 'Masterminds', icon: 'people-outline', iconActive: 'people', route: '/founder-hub/masterminds' },
  { id: 'saved', label: 'Saved', icon: 'bookmark-outline', iconActive: 'bookmark', route: '/founder-hub/saved' },
];

const SIDEBAR_EXPANDED = 240;
const SIDEBAR_COLLAPSED = 64;

export function HubSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { sidebarExpanded, toggleSidebar } = useSidebarState();
  const expanded = sidebarExpanded;
  const widthAnim = useRef(new Animated.Value(expanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED)).current;
  const opacityAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const [isLogoHovered, setIsLogoHovered] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(widthAnim, {
        toValue: expanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: expanded ? 1 : 0,
        duration: expanded ? 200 : 100,
        useNativeDriver: false,
      }),
    ]).start();
  }, [expanded]);

  const isActive = (item: NavItem) => {
    if (item.isExternal) return false;
    if (item.route === '/founder-hub/daily-brief') {
      return pathname === '/founder-hub' || pathname === '/founder-hub/' || pathname.startsWith('/founder-hub/daily-brief');
    }
    return pathname.startsWith(item.route);
  };

  const webStyle = Platform.OS === 'web' ? {
    transition: 'width 200ms ease-out',
    width: expanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED,
  } : {};

  return (
    <Animated.View style={[styles.container, Platform.OS !== 'web' && { width: widthAnim }, webStyle as any]}>
      <View style={[styles.logoSection, !expanded && styles.logoSectionCollapsed]}>
        <Pressable 
          style={styles.logoContainer}
          onHoverIn={() => setIsLogoHovered(true)}
          onHoverOut={() => setIsLogoHovered(false)}
          onPress={expanded ? undefined : toggleSidebar}
        >
          {expanded ? (
            <View style={styles.expandedLogoRow}>
              <Image 
                source={logoSource}
                style={styles.logoImageFull}
                resizeMode="contain"
              />
              <Pressable
                style={[
                  styles.collapseToggle,
                  { opacity: isLogoHovered ? 1 : 0 } as any
                ]}
                onPress={toggleSidebar}
              >
                <Ionicons name="chevron-back" size={14} color="rgba(255, 255, 255, 0.7)" />
              </Pressable>
            </View>
          ) : (
            <Pressable 
              style={[styles.collapsedLogoContainer, isLogoHovered && styles.collapsedLogoHovered]}
              onPress={toggleSidebar}
            >
              <View style={styles.logoIconWrapper}>
                <Image 
                  source={iconSource}
                  style={styles.logoIcon}
                  resizeMode="contain"
                />
              </View>
              {isLogoHovered && (
                <View style={styles.expandChevronBadge}>
                  <Ionicons name="chevron-forward" size={10} color="#fff" />
                </View>
              )}
            </Pressable>
          )}
        </Pressable>
      </View>

      <View style={[styles.navList, !expanded && styles.navListCollapsed]}>
        {navItems.map((item, index) => {
          const active = isActive(item);
          const isHome = item.id === 'home';
          const webProps = Platform.OS === 'web' && !expanded ? { title: item.label } : {};
          
          return (
            <React.Fragment key={item.id}>
              {isHome && expanded && (
                <View style={styles.dividerAfterHome} />
              )}
              {index === 1 && expanded && (
                <Text style={styles.sectionLabel}>Founder Hub</Text>
              )}
              <Pressable
                style={({ hovered, pressed }: any) => [
                  styles.navItem,
                  expanded && active && styles.navItemActive,
                  !expanded && styles.navItemCollapsed,
                  !expanded && active && styles.navItemCollapsedActive,
                  expanded && !active && hovered && styles.navItemHover,
                  !expanded && hovered && styles.navItemCollapsedHover,
                  pressed && styles.navItemPressed,
                ]}
                onPress={() => router.push(item.route as any)}
                {...webProps}
              >
                {expanded ? (
                  <View style={[styles.iconContainer, active && styles.iconContainerActive]}>
                    <Ionicons
                      name={active ? item.iconActive : item.icon}
                      size={20}
                      color={active ? Colors.accent.cyan : Colors.text.secondary}
                    />
                  </View>
                ) : (
                  <View style={styles.collapsedIconContainer}>
                    <Ionicons
                      name={active ? item.iconActive : item.icon}
                      size={22}
                      color={active ? Colors.accent.cyan : Colors.text.secondary}
                    />
                  </View>
                )}
                {Platform.OS === 'web' ? (
                  <Text 
                    style={[
                      styles.navLabel, 
                      active && styles.navLabelActive,
                      { 
                        opacity: expanded ? 1 : 0,
                        width: expanded ? 'auto' : 0,
                        overflow: 'hidden',
                        transition: 'opacity 200ms ease-out, width 200ms ease-out',
                      } as any
                    ]}
                  >
                    {item.label}
                  </Text>
                ) : (
                  <Animated.Text 
                    style={[
                      styles.navLabel, 
                      active && styles.navLabelActive,
                      { opacity: opacityAnim }
                    ]}
                    numberOfLines={1}
                  >
                    {expanded ? item.label : ''}
                  </Animated.Text>
                )}
                {active && expanded && <View style={styles.activeIndicator} />}
              </Pressable>
            </React.Fragment>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.primary,
    borderRightWidth: 1,
    borderRightColor: Colors.border.subtle,
    paddingTop: 12,
    paddingBottom: 12,
    height: '100%',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  logoSection: {
    paddingHorizontal: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  logoSectionCollapsed: {
    paddingHorizontal: 0,
    width: '100%',
  },
  logoContainer: {
    width: '100%',
  },
  expandedLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 8,
    paddingRight: 4,
    height: 80,
  },
  logoImageFull: {
    height: 72,
    width: 180,
  },
  collapseToggle: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? {
      transition: 'opacity 150ms ease-out, background-color 150ms ease-out',
      cursor: 'pointer',
    } : {}),
  } as any,
  collapsedLogoContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderRadius: 10,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'all 150ms ease-out',
    } : {}),
  } as any,
  collapsedLogoHovered: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  logoIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoIcon: {
    width: 44,
    height: 44,
  },
  expandChevronBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  dividerAfterHome: {
    height: 1,
    backgroundColor: Colors.border.subtle,
    marginVertical: 8,
    marginHorizontal: 8,
  },
  navList: {
    flex: 1,
    gap: 2,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  navListCollapsed: {
    alignItems: 'center',
    paddingHorizontal: 0,
    width: '100%',
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    position: 'relative',
    gap: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    ...(Platform.OS === 'web' ? {
      transition: 'all 0.15s ease-out',
      cursor: 'pointer',
    } : {}),
  } as any,
  navItemActive: {
    borderColor: '#2C2C2E',
    backgroundColor: '#1a2a3a',
  },
  navItemHover: {
    backgroundColor: '#1C1C1E',
    borderColor: '#2C2C2E',
  },
  navItemPressed: {
    backgroundColor: '#0a0a0c',
  },
  navItemCollapsed: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    width: 48,
    height: 48,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    borderRadius: 10,
    gap: 0,
  },
  navItemCollapsedActive: {
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  navItemCollapsedHover: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  collapsedIconContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerActive: {
    backgroundColor: 'transparent',
  },
  navLabel: {
    ...Typography.bodyMedium,
    color: Colors.text.secondary,
    flex: 1,
    fontSize: 14,
  },
  navLabelActive: {
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  navLabelMuted: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    flex: 1,
    fontSize: 13,
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -10,
    width: 3,
    height: 20,
    backgroundColor: Colors.accent.cyan,
    borderRadius: 2,
  },
  footer: {
    paddingHorizontal: 8,
    gap: 4,
  },
  footerCollapsed: {
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 10,
    borderRadius: 8,
    ...(Platform.OS === 'web' ? {
      transition: 'all 0.15s ease-out',
      cursor: 'pointer',
    } : {}),
  } as any,
  footerItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  footerItemHover: {
    backgroundColor: '#1C1C1E',
  },
  footerIconContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
