import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { useSidebarState } from '@/lib/uiStore';
import { canAccessTeamWorkspace } from '@/lib/permissions';
import { currentUser } from '@/data/teamWorkspace';

const logoSource = require('../../assets/images/aspire-logo-new.png');
const iconSource = require('../../assets/images/aspire-icon-new.png');

interface SubNavItem {
  id: string;
  label: string;
  route: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  route: string;
  subItems?: SubNavItem[];
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: 'home', iconActive: 'home', route: '/(tabs)' },
  { id: 'bookings', label: 'Bookings', icon: 'calendar', iconActive: 'calendar', route: '/bookings' },
  { id: 'inbox', label: 'Inbox', icon: 'mail', iconActive: 'mail', route: '/(tabs)/inbox' },
  { 
    id: 'calls', 
    label: 'Return Calls', 
    icon: 'call', 
    iconActive: 'call', 
    route: '/session/calls',
    subItems: [
      { id: 'front-desk-setup', label: 'Front Desk Setup', route: '/session/calls/setup' },
    ]
  },
  { id: 'receipts', label: 'Receipts', icon: 'document-text', iconActive: 'document-text', route: '/(tabs)/receipts' },
  { id: 'team', label: 'Team Workspace', icon: 'people', iconActive: 'people', route: '/team-workspace' },
  { id: 'store', label: 'Office Store', icon: 'storefront', iconActive: 'storefront', route: '/office-store' },
];

const SIDEBAR_EXPANDED = 240;
const SIDEBAR_COLLAPSED = 64;

interface DesktopSidebarProps {
  expanded?: boolean;
}

export function DesktopSidebar({ expanded = true }: DesktopSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { toggleSidebar } = useSidebarState();
  const widthAnim = useRef(new Animated.Value(expanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED)).current;
  const opacityAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const [isLogoHovered, setIsLogoHovered] = useState(false);

  const filteredNavItems = useMemo(() => {
    return navItems.filter(item => {
      if (item.id === 'team') {
        return canAccessTeamWorkspace(currentUser, 1);
      }
      return true;
    });
  }, []);

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

  const isActive = (route: string) => {
    if (route === '/(tabs)') {
      return pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/index';
    }
    return pathname.startsWith(route.replace('/(tabs)', ''));
  };

  const webStyle = Platform.OS === 'web' ? {
    transition: 'width 200ms ease-out',
    width: expanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED,
  } : {};

  return (
    <Animated.View style={[styles.container, Platform.OS !== 'web' && { width: widthAnim }, webStyle as any]}>
      {/* Logo section with Lovable-style collapse toggle */}
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
              {/* Show collapse toggle on hover when expanded */}
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
              {/* Show real Aspire icon when collapsed */}
              <View style={styles.logoIconWrapper}>
                <Image 
                  source={iconSource}
                  style={styles.logoIcon}
                  resizeMode="contain"
                />
              </View>
              {/* Show expand chevron on hover */}
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
        {filteredNavItems.map((item) => {
          const active = isActive(item.route);
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isParentOfActive = hasSubItems && item.subItems!.some(sub => pathname.startsWith(sub.route));
          const showActive = active || isParentOfActive;
          const webProps = Platform.OS === 'web' && !expanded ? { title: item.label } : {};
          return (
            <View key={item.id}>
              <Pressable
                style={({ hovered, pressed }: any) => [
                  styles.navItem,
                  expanded && showActive && styles.navItemActive,
                  !expanded && styles.navItemCollapsed,
                  !expanded && showActive && styles.navItemCollapsedActive,
                  expanded && !showActive && hovered && styles.navItemHover,
                  !expanded && hovered && styles.navItemCollapsedHover,
                  pressed && styles.navItemPressed,
                ]}
                onPress={() => router.push(item.route as any)}
                {...webProps}
              >
                {expanded ? (
                  <View style={[styles.iconContainer, showActive && styles.iconContainerActive]}>
                    <Ionicons
                      name={showActive ? item.iconActive : item.icon}
                      size={20}
                      color={showActive ? Colors.accent.cyan : Colors.text.secondary}
                    />
                  </View>
                ) : (
                  <View style={styles.collapsedIconContainer}>
                    <Ionicons
                      name={showActive ? item.iconActive : item.icon}
                      size={22}
                      color={showActive ? Colors.accent.cyan : Colors.text.secondary}
                    />
                  </View>
                )}
                {Platform.OS === 'web' ? (
                  <Text 
                    style={[
                      styles.navLabel, 
                      showActive && styles.navLabelActive,
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
                      showActive && styles.navLabelActive,
                      { opacity: opacityAnim }
                    ]}
                    numberOfLines={1}
                  >
                    {expanded ? item.label : ''}
                  </Animated.Text>
                )}
                {showActive && expanded && <View style={styles.activeIndicator} />}
              </Pressable>
              {/* Sub-items */}
              {expanded && hasSubItems && (showActive || active) && (
                <View style={styles.subNavList}>
                  {item.subItems!.map((subItem) => {
                    const subActive = pathname.startsWith(subItem.route);
                    return (
                      <Pressable
                        key={subItem.id}
                        style={({ hovered }: any) => [
                          styles.subNavItem,
                          subActive && styles.subNavItemActive,
                          !subActive && hovered && styles.subNavItemHover,
                        ]}
                        onPress={() => router.push(subItem.route as any)}
                      >
                        <View style={styles.subNavDot} />
                        <Text style={[styles.subNavLabel, subActive && styles.subNavLabelActive]}>
                          {subItem.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={[styles.footer, !expanded && styles.footerCollapsed]}>
        <View style={[styles.footerDivider, !expanded && styles.footerDividerCollapsed]} />
        <Pressable 
          style={({ hovered }: any) => [
            styles.footerItem, 
            !expanded && styles.footerItemCollapsed,
            hovered && styles.footerItemHover,
          ]}
          onPress={() => router.push('/(tabs)/more' as any)}
          {...(Platform.OS === 'web' && !expanded ? { title: 'More' } : {})}
        >
          <View style={styles.footerIconContainer}>
            <Ionicons name="ellipsis-horizontal-circle" size={18} color={isActive('/(tabs)/more') ? Colors.accent.cyan : Colors.text.tertiary} />
          </View>
          {Platform.OS === 'web' ? (
            <Text 
              style={[
                styles.navLabelMuted,
                isActive('/(tabs)/more') && styles.navLabelActive,
                { 
                  opacity: expanded ? 1 : 0,
                  width: expanded ? 'auto' : 0,
                  overflow: 'hidden',
                  transition: 'opacity 200ms ease-out, width 200ms ease-out',
                } as any
              ]}
            >
              More
            </Text>
          ) : (
            <Animated.Text 
              style={[styles.navLabelMuted, isActive('/(tabs)/more') && styles.navLabelActive, { opacity: opacityAnim }]}
              numberOfLines={1}
            >
              {expanded ? 'More' : ''}
            </Animated.Text>
          )}
        </Pressable>
        <Pressable 
          style={({ hovered }: any) => [
            styles.footerItem, 
            !expanded && styles.footerItemCollapsed,
            hovered && styles.footerItemHover,
          ]}
          {...(Platform.OS === 'web' && !expanded ? { title: 'Help & Support' } : {})}
        >
          <View style={styles.footerIconContainer}>
            <Ionicons name="help-circle" size={18} color={Colors.text.tertiary} />
          </View>
          {Platform.OS === 'web' ? (
            <Text 
              style={[
                styles.navLabelMuted,
                { 
                  opacity: expanded ? 1 : 0,
                  width: expanded ? 'auto' : 0,
                  overflow: 'hidden',
                  transition: 'opacity 200ms ease-out, width 200ms ease-out',
                } as any
              ]}
            >
              Help & Support
            </Text>
          ) : (
            <Animated.Text 
              style={[styles.navLabelMuted, { opacity: opacityAnim }]}
              numberOfLines={1}
            >
              {expanded ? 'Help & Support' : ''}
            </Animated.Text>
          )}
        </Pressable>
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
    justifyContent: 'space-between',
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
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoIcon: {
    width: 44,
    height: 44,
    marginLeft: 6,
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
  navList: {
    gap: 2,
    paddingHorizontal: 8,
    flex: 1,
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
  iconStyle: {
    width: 20,
    height: 20,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 1,
  } as any,
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
    gap: 2,
  },
  footerCollapsed: {
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  footerDivider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
    marginHorizontal: 8,
    marginBottom: 2,
  },
  footerDividerCollapsed: {
    marginHorizontal: 12,
    marginBottom: 2,
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
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    width: 48,
    height: 48,
    borderRadius: 10,
    gap: 0,
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
  subNavList: {
    paddingLeft: 42,
    paddingTop: 2,
    paddingBottom: 4,
    gap: 2,
  },
  subNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 8,
    ...(Platform.OS === 'web' ? {
      transition: 'all 0.15s ease-out',
      cursor: 'pointer',
    } : {}),
  } as any,
  subNavItemActive: {
    backgroundColor: '#1a2a3a',
  },
  subNavItemHover: {
    backgroundColor: '#1C1C1E',
  },
  subNavDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.text.tertiary,
  },
  subNavLabel: {
    fontSize: 13,
    color: Colors.text.tertiary,
  },
  subNavLabelActive: {
    color: Colors.accent.cyan,
    fontWeight: '500',
  },
});
