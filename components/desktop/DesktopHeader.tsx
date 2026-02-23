import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';
import { useSupabase, useTenant } from '@/providers';

const USER_PROFILE = require('@/assets/images/user-profile.jpg');

interface Notification {
  id: string;
  type: 'activity' | 'approval' | 'system';
  title: string;
  message: string;
  time: string;
  read: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
}

// Notifications are fetched from Supabase (inbox_items, approval_requests)
// Start empty — populated via real-time subscriptions or polling
const INITIAL_NOTIFICATIONS: Notification[] = [];

interface ProfileMenuItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  section?: string;
  badge?: string;
  destructive?: boolean;
}

const PROFILE_MENU: ProfileMenuItem[] = [
  { id: 'account', label: 'Account Settings', icon: 'person-circle-outline', section: 'account' },
  { id: 'billing', label: 'Billing & Plans', icon: 'card-outline', section: 'account', badge: 'Pro' },
  { id: 'security', label: 'Security', icon: 'shield-checkmark-outline', section: 'account' },
  { id: 'preferences', label: 'Preferences', icon: 'options-outline', section: 'preferences' },
  { id: 'appearance', label: 'Appearance', icon: 'color-palette-outline', section: 'preferences' },
  { id: 'notifications', label: 'Notification Settings', icon: 'notifications-outline', section: 'preferences' },
  { id: 'help', label: 'Help & Support', icon: 'help-circle-outline', section: 'support' },
  { id: 'feedback', label: 'Send Feedback', icon: 'chatbox-ellipses-outline', section: 'support' },
  { id: 'signout', label: 'Sign Out', icon: 'log-out-outline', destructive: true, section: 'signout' },
];

type ActivePanel = 'none' | 'suite' | 'notifications' | 'profile';

interface DesktopHeaderProps {
  businessName?: string;
  role?: string;
  suiteId?: string;
}

export function DesktopHeader({
  businessName: businessNameProp,
  role: roleProp,
  suiteId: suiteIdProp,
}: DesktopHeaderProps) {
  const { session } = useSupabase();
  const { tenant } = useTenant();

  // Derive display values from auth context, falling back to props, then defaults
  const businessName = businessNameProp || tenant?.businessName || 'Your Business';
  const role = roleProp || tenant?.role || 'Founder';
  const suiteId = suiteIdProp || tenant?.displayId || tenant?.suiteId?.slice(0, 8) || '';
  const userName = tenant?.ownerName || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'User';
  const userEmail = session?.user?.email || tenant?.ownerEmail || '';

  const [activePanel, setActivePanel] = useState<ActivePanel>('none');
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (notifFilter === 'unread') return notifications.filter(n => !n.read);
    return notifications;
  }, [notifications, notifFilter]);

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel(prev => prev === panel ? 'none' : panel);
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || activePanel === 'none') return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && !target.closest('[data-header-panel]')) {
        setActivePanel('none');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activePanel]);

  const renderNotificationPanel = () => (
    <View style={s.panelDropdown} {...(Platform.OS === 'web' ? { 'data-header-panel': 'true' } as any : {})}>
      <View style={s.panelHeader}>
        <Text style={s.panelTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <Pressable onPress={markAllRead} style={({ hovered }: any) => [s.markAllBtn, hovered && s.markAllBtnHover]}>
            <Text style={s.markAllText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      <View style={s.filterRow}>
        {(['all', 'unread'] as const).map(f => (
          <Pressable
            key={f}
            onPress={() => setNotifFilter(f)}
            style={[s.filterChip, notifFilter === f && s.filterChipActive]}
          >
            <Text style={[s.filterChipText, notifFilter === f && s.filterChipTextActive]}>
              {f === 'all' ? 'All' : `Unread (${unreadCount})`}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={s.panelDivider} />

      <ScrollView style={s.notifScroll} showsVerticalScrollIndicator={false}>
        {filteredNotifications.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="checkmark-done-circle" size={40} color="#2C2C2E" />
            <Text style={s.emptyTitle}>All caught up</Text>
            <Text style={s.emptySubtitle}>No unread notifications</Text>
          </View>
        ) : (
          filteredNotifications.map((notif) => (
            <Pressable
              key={notif.id}
              onPress={() => markRead(notif.id)}
              style={({ hovered }: any) => [
                s.notifItem,
                !notif.read && s.notifItemUnread,
                hovered && s.notifItemHover,
              ]}
            >
              <View style={[s.notifIcon, { backgroundColor: notif.iconBg }]}>
                <Ionicons name={notif.icon} size={16} color={notif.iconColor} />
              </View>
              <View style={s.notifContent}>
                <View style={s.notifTopRow}>
                  <Text style={[s.notifTitle, !notif.read && s.notifTitleUnread]} numberOfLines={1}>
                    {notif.title}
                  </Text>
                  <Text style={s.notifTime}>{notif.time}</Text>
                </View>
                <Text style={s.notifMessage} numberOfLines={2}>{notif.message}</Text>
              </View>
              {!notif.read && <View style={s.unreadDot} />}
            </Pressable>
          ))
        )}
      </ScrollView>

      <View style={s.panelDivider} />
      <Pressable style={({ hovered }: any) => [s.panelFooterBtn, hovered && s.panelFooterBtnHover]}>
        <Text style={s.panelFooterText}>View All Notifications</Text>
        <Ionicons name="arrow-forward" size={14} color="#3B82F6" />
      </Pressable>
    </View>
  );

  const renderProfilePanel = () => {
    let lastSection = '';
    return (
      <View style={[s.panelDropdown, s.profileDropdown]} {...(Platform.OS === 'web' ? { 'data-header-panel': 'true' } as any : {})}>
        <View style={s.profileHeader}>
          <View style={s.profileHeaderRing}>
            <Image source={USER_PROFILE} style={s.profileHeaderImg} />
          </View>
          <View style={s.profileHeaderInfo}>
            <Text style={s.profileHeaderName}>{userName}</Text>
            <Text style={s.profileHeaderEmail}>{userEmail}</Text>
          </View>
          <View style={s.profileBadge}>
            <Text style={s.profileBadgeText}>{role}</Text>
          </View>
        </View>

        <View style={s.panelDivider} />

        <ScrollView style={s.profileScroll} showsVerticalScrollIndicator={false}>
          {PROFILE_MENU.map((item) => {
            const showDivider = lastSection !== '' && lastSection !== item.section;
            lastSection = item.section || '';
            return (
              <React.Fragment key={item.id}>
                {showDivider && <View style={s.panelDivider} />}
                <Pressable
                  style={({ hovered }: any) => [
                    s.profileMenuItem,
                    hovered && s.profileMenuItemHover,
                    item.destructive && s.profileMenuItemDestructive,
                  ]}
                  onPress={() => setActivePanel('none')}
                >
                  <View style={s.profileMenuLeft}>
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={item.destructive ? '#ef4444' : '#a1a1a6'}
                    />
                    <Text style={[s.profileMenuLabel, item.destructive && s.profileMenuLabelDestructive]}>
                      {item.label}
                    </Text>
                  </View>
                  {item.badge ? (
                    <View style={s.menuBadge}>
                      <Text style={s.menuBadgeText}>{item.badge}</Text>
                    </View>
                  ) : !item.destructive ? (
                    <Ionicons name="chevron-forward" size={14} color="#48484a" />
                  ) : null}
                </Pressable>
              </React.Fragment>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={s.container}>
      <View style={s.leftSection} />

      <View style={s.centerSection}>
        <Pressable
          style={({ hovered }: any) => [s.searchBar, hovered && s.searchBarHover]}
        >
          <Ionicons name="search" size={16} color={Colors.text.tertiary} />
          <Text style={s.searchPlaceholder}>Search or press ⌘K</Text>
        </Pressable>
      </View>

      <View style={s.rightSection}>
        <View style={s.panelWrapper} {...(Platform.OS === 'web' ? { 'data-header-panel': 'true' } as any : {})}>
          <Pressable
            onPress={() => togglePanel('suite')}
            style={({ hovered }: any) => [
              s.suiteToggle,
              hovered && s.suiteToggleHover,
              activePanel === 'suite' && s.suiteToggleActive,
            ]}
          >
            <View style={s.companyInfo}>
              <View style={s.statusRow}>
                <View style={s.statusDot} />
                <Text style={s.businessName}>{businessName}</Text>
              </View>
              <Text style={s.roleText}>{role} • Suite {suiteId}</Text>
            </View>
            <Ionicons
              name={activePanel === 'suite' ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={Colors.text.tertiary}
              style={{ marginLeft: 6 }}
            />
          </Pressable>

          {activePanel === 'suite' && (
            <View style={s.suiteDropdown}>
              <View style={s.sdHeader}>
                <Text style={s.sdHeaderText}>Your Suites</Text>
              </View>
              <Pressable
                style={({ hovered }: any) => [s.sdItem, s.sdItemActive, hovered && s.sdItemHover]}
                onPress={() => setActivePanel('none')}
              >
                <View style={s.sdItemLeft}>
                  <View style={[s.suiteIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                    <Ionicons name="business" size={14} color="#3B82F6" />
                  </View>
                  <View>
                    <Text style={s.sdItemTitle}>{businessName}</Text>
                    <Text style={s.sdItemSub}>Suite {suiteId} • {role}</Text>
                  </View>
                </View>
                <Ionicons name="checkmark" size={16} color="#3B82F6" />
              </Pressable>
              <View style={s.panelDivider} />
              <Pressable
                style={({ hovered }: any) => [s.sdItem, hovered && s.sdItemHover]}
                onPress={() => setActivePanel('none')}
              >
                <View style={s.sdItemLeft}>
                  <View style={[s.suiteIcon, { backgroundColor: 'rgba(34, 197, 94, 0.12)' }]}>
                    <Ionicons name="add" size={16} color="#22c55e" />
                  </View>
                  <View>
                    <Text style={[s.sdItemTitle, { color: '#22c55e' }]}>Add Suite</Text>
                    <Text style={s.sdItemSub}>Register a new company</Text>
                  </View>
                </View>
              </Pressable>
            </View>
          )}
        </View>

        <View style={s.panelWrapper} {...(Platform.OS === 'web' ? { 'data-header-panel': 'true' } as any : {})}>
          <Pressable
            onPress={() => togglePanel('notifications')}
            style={({ pressed, hovered }: any) => [
              s.iconButton,
              hovered && s.iconButtonHover,
              pressed && s.iconButtonPressed,
              activePanel === 'notifications' && s.iconButtonActive,
            ]}
          >
            <Ionicons name="notifications" size={18} color={activePanel === 'notifications' ? '#3B82F6' : Colors.text.secondary} />
            {unreadCount > 0 && (
              <View style={s.notificationBadge}>
                {unreadCount > 0 && <Text style={s.badgeCount}>{unreadCount > 9 ? '9+' : unreadCount}</Text>}
              </View>
            )}
          </Pressable>
          {activePanel === 'notifications' && renderNotificationPanel()}
        </View>

        <View style={s.panelWrapper} {...(Platform.OS === 'web' ? { 'data-header-panel': 'true' } as any : {})}>
          <Pressable
            onPress={() => togglePanel('profile')}
            style={({ pressed, hovered }: any) => [
              s.profileButton,
              hovered && s.profileButtonHover,
              pressed && s.profileButtonPressed,
              activePanel === 'profile' && s.profileButtonActive,
            ]}
          >
            <View style={[s.profileRing, activePanel === 'profile' && s.profileRingActive]}>
              <Image source={USER_PROFILE} style={s.profileImage} />
            </View>
          </Pressable>
          {activePanel === 'profile' && renderProfilePanel()}
        </View>
      </View>
    </View>
  );
}

const PANEL_BG = '#131315';
const PANEL_BORDER = 'rgba(255,255,255,0.07)';
const PANEL_SHADOW = '0 16px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)';
const TRANSITION_FAST = 'all 0.15s ease-out';

const s = StyleSheet.create({
  container: {
    height: 56,
    backgroundColor: Colors.background.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 100,
  },
  leftSection: { flex: 1 },
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
    ...(Platform.OS === 'web' ? { transition: TRANSITION_FAST, cursor: 'pointer' } : {}),
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
    gap: 12,
  },

  panelWrapper: {
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
    ...(Platform.OS === 'web' ? { transition: TRANSITION_FAST, cursor: 'pointer' } : {}),
  } as any,
  suiteToggleHover: { backgroundColor: '#141416', borderColor: '#2C2C2E' },
  suiteToggleActive: { backgroundColor: '#141416', borderColor: '#3C3C3E' },
  companyInfo: { alignItems: 'flex-end' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4facfe' },
  businessName: { fontSize: 14, fontWeight: '600', color: Colors.text.primary },
  roleText: { fontSize: 12, color: Colors.text.tertiary, marginTop: 2 },

  suiteDropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 6,
    width: 280,
    backgroundColor: PANEL_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PANEL_BORDER,
    overflow: 'hidden',
    paddingBottom: 6,
    ...(Platform.OS === 'web' ? { boxShadow: PANEL_SHADOW } : {}),
  } as any,
  sdHeader: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  sdHeaderText: { fontSize: 11, fontWeight: '600', color: '#6e6e73', textTransform: 'uppercase', letterSpacing: 0.5 },
  sdItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 6,
    borderRadius: 8,
    ...(Platform.OS === 'web' ? { transition: 'background-color 0.12s ease-out', cursor: 'pointer' } : {}),
  } as any,
  sdItemActive: { backgroundColor: 'rgba(59, 130, 246, 0.08)' },
  sdItemHover: { backgroundColor: 'rgba(255,255,255,0.04)' },
  sdItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  suiteIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sdItemTitle: { color: '#f2f2f2', fontSize: 13, fontWeight: '600' },
  sdItemSub: { color: '#6e6e73', fontSize: 11, marginTop: 1 },

  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    backgroundColor: '#1C1C1E',
    ...(Platform.OS === 'web' ? { transition: TRANSITION_FAST, cursor: 'pointer' } : {}),
  } as any,
  iconButtonHover: { backgroundColor: '#242426', borderColor: '#3C3C3E' },
  iconButtonPressed: { backgroundColor: '#0a0a0c', transform: [{ scale: 0.95 }] },
  iconButtonActive: { backgroundColor: '#1a1a2e', borderColor: 'rgba(59, 130, 246, 0.3)' },

  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#1C1C1E',
  },
  badgeCount: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },

  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    backgroundColor: '#1C1C1E',
    ...(Platform.OS === 'web' ? { transition: TRANSITION_FAST, cursor: 'pointer' } : {}),
  } as any,
  profileButtonHover: { backgroundColor: '#242426', borderColor: '#3C3C3E' },
  profileButtonPressed: { backgroundColor: '#0a0a0c', transform: [{ scale: 0.95 }] },
  profileButtonActive: { borderColor: 'rgba(59, 130, 246, 0.4)' },
  profileRing: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileRingActive: {
    borderColor: '#60A5FA',
  },
  profileImage: { width: 26, height: 26, borderRadius: 13 },

  panelDropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 8,
    width: 380,
    backgroundColor: PANEL_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PANEL_BORDER,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { boxShadow: PANEL_SHADOW } : {}),
  } as any,
  profileDropdown: {
    width: 300,
  },

  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f2f2f2',
    letterSpacing: -0.3,
  },
  markAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    ...(Platform.OS === 'web' ? { transition: 'background-color 0.12s ease-out', cursor: 'pointer' } : {}),
  } as any,
  markAllBtnHover: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6e6e73',
  },
  filterChipTextActive: {
    color: '#3B82F6',
  },

  panelDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 0,
  },

  notifScroll: {
    maxHeight: 340,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    ...(Platform.OS === 'web' ? { transition: 'background-color 0.12s ease-out', cursor: 'pointer' } : {}),
  } as any,
  notifItemUnread: {
    backgroundColor: 'rgba(59, 130, 246, 0.03)',
  },
  notifItemHover: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notifContent: {
    flex: 1,
  },
  notifTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#a1a1a6',
    flex: 1,
    marginRight: 8,
  },
  notifTitleUnread: {
    fontWeight: '600',
    color: '#f2f2f2',
  },
  notifTime: {
    fontSize: 11,
    color: '#48484a',
    flexShrink: 0,
  },
  notifMessage: {
    fontSize: 12,
    color: '#6e6e73',
    lineHeight: 17,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginTop: 6,
    flexShrink: 0,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6e6e73',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#48484a',
  },

  panelFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    ...(Platform.OS === 'web' ? { transition: 'background-color 0.12s ease-out', cursor: 'pointer' } : {}),
  } as any,
  panelFooterBtnHover: {
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
  },
  panelFooterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },

  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  profileHeaderRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileHeaderImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  profileHeaderInfo: {
    flex: 1,
  },
  profileHeaderName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f2f2f2',
    letterSpacing: -0.2,
  },
  profileHeaderEmail: {
    fontSize: 12,
    color: '#6e6e73',
    marginTop: 2,
  },
  profileBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  profileBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3B82F6',
  },

  profileScroll: {
    maxHeight: 360,
  },
  profileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginHorizontal: 6,
    marginVertical: 1,
    borderRadius: 8,
    ...(Platform.OS === 'web' ? { transition: 'background-color 0.12s ease-out', cursor: 'pointer' } : {}),
  } as any,
  profileMenuItemHover: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  profileMenuItemDestructive: {},
  profileMenuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileMenuLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#d1d1d6',
  },
  profileMenuLabelDestructive: {
    color: '#ef4444',
  },
  menuBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  menuBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3B82F6',
  },
});
