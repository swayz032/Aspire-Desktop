/**
 * InviteSheet — Premium 4-tab invite system for Conference Room
 *
 * Tab 1: "Team"         — Search & invite suite members (internal)
 * Tab 2: "Aspire User"  — Cross-suite lookup by Suite ID + Office ID
 * Tab 3: "External"     — Email invite to non-Aspire guests (YELLOW tier via Eli)
 * Tab 4: "Link"         — Shareable room link with guest token
 *
 * Law #3: All API calls use authenticatedFetch (JWT + X-Suite-Id).
 * Law #6: Internal search is RLS-scoped. Cross-suite returns display names only.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows, Animation } from '@/constants/tokens';
import { useAuthFetch } from '@/lib/authenticatedFetch';

// ─── Shared sub-components ──────────────────────────────────────────────────

/** Animated shimmer bar for skeleton loading — LinearGradient sweep from left to right, 1.5s cycle */
function ShimmerBar({ width, height, borderRadius: br }: { width: number | string; height: number; borderRadius: number }) {
  const shimmerTranslate = useSharedValue(-1);

  useEffect(() => {
    shimmerTranslate.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerTranslate.value * 120 }],
  }));

  return (
    <View
      style={[
        { width: width as number, height, borderRadius: br, backgroundColor: Colors.background.tertiary, overflow: 'hidden' },
      ]}
      accessibilityElementsHidden
    >
      <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: -60, width: 60 }, animatedStyle]}>
        <LinearGradient
          colors={['transparent', Colors.surface.card, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

/** Animated press wrapper — scale 0.97 on press with Animation.fast duration */
function PressableScale({
  children,
  style,
  disabled,
  onPress,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
}: {
  children: React.ReactNode;
  style?: any;
  disabled?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'none';
  accessibilityState?: { disabled?: boolean; selected?: boolean };
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPressIn={() => { scale.value = withTiming(0.97, { duration: Animation.fast }); }}
      onPressOut={() => { scale.value = withTiming(1, { duration: Animation.fast }); }}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole || 'button'}
      accessibilityState={accessibilityState || { disabled: !!disabled }}
    >
      <Animated.View style={[style, animStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// Web clipboard helper (matches bookings/index.tsx pattern)
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface InviteSheetProps {
  visible: boolean;
  onClose: () => void;
  roomName: string;
  hostName: string;
  purpose: string;
  correlationId?: string;
  onInviteMember: (userId: string, name: string, inviteType?: 'internal' | 'cross-suite') => void;
  onInviteGuest: (name: string, contact: string) => void;
}

type Tab = 'team' | 'aspire' | 'external' | 'link';

interface MemberResult {
  userId: string;
  name: string;
  email: string;
  officeId: string;
  officeLabel: string;
  avatarUrl: string | null;
}

interface LookupResult {
  userId: string;
  name: string;
  businessName: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function InviteSheet({
  visible,
  onClose,
  roomName,
  hostName,
  purpose,
  correlationId,
  onInviteMember,
  onInviteGuest,
}: InviteSheetProps) {
  const { authenticatedFetch } = useAuthFetch();

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('team');

  // Tab 1: Team search
  const [searchQuery, setSearchQuery] = useState('');
  const [members, setMembers] = useState<MemberResult[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  // Tab 2: Aspire User lookup
  const [lookupSuiteId, setLookupSuiteId] = useState('');
  const [lookupOfficeId, setLookupOfficeId] = useState('');
  const [lookupResults, setLookupResults] = useState<LookupResult[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  // Tab 3: External invite
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Tab 4: Link
  const [roomLink, setRoomLink] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [flashMemberId, setFlashMemberId] = useState<string | null>(null);

  // Tab switch animation (withSpring) — tracks active tab index for indicator sliding
  const tabIndex = useSharedValue(0);
  const TABS_ORDER: Tab[] = ['team', 'aspire', 'external', 'link'];
  const TAB_COUNT = TABS_ORDER.length;

  const handleTabSwitch = (tab: Tab) => {
    const idx = TABS_ORDER.indexOf(tab);
    tabIndex.value = withSpring(idx, {
      damping: Animation.spring.damping,
      stiffness: Animation.spring.stiffness,
    });
    setActiveTab(tab);
  };

  // Indicator slides as a percentage of the tab bar width (each tab = 25%)
  const tabIndicatorStyle = useAnimatedStyle(() => ({
    left: `${(tabIndex.value / TAB_COUNT) * 100}%` as unknown as number,
    width: `${100 / TAB_COUNT}%` as unknown as number,
  }));

  // Success checkmark scale animation — overshoot bounce then settle
  const checkScale = useSharedValue(0);
  useEffect(() => {
    if (inviteSent) {
      // Reset to 0 then bounce to 1.2 and settle at 1
      checkScale.value = 0;
      checkScale.value = withSequence(
        withSpring(1.2, { damping: 8, stiffness: 200 }),
        withSpring(1, { damping: 12, stiffness: Animation.spring.stiffness }),
      );
    }
  }, [inviteSent]);
  const checkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  // Flash glow animation for member invite success — green glow that fades over 800ms
  const flashGlowOpacity = useSharedValue(0);
  useEffect(() => {
    if (flashMemberId) {
      flashGlowOpacity.value = 1;
      flashGlowOpacity.value = withTiming(0, { duration: 800 });
    }
  }, [flashMemberId]);
  const flashGlowStyle = useAnimatedStyle(() => ({
    opacity: flashGlowOpacity.value,
  }));

  // Focus glow state for inputs
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // Reset state when sheet closes; abort any in-flight search to prevent stale setState
  useEffect(() => {
    if (!visible) {
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
        searchAbortRef.current = null;
      }
      setSearchQuery('');
      setMembers([]);
      setMembersLoading(false);
      setLookupSuiteId('');
      setLookupOfficeId('');
      setLookupResults([]);
      setLookupError('');
      setGuestName('');
      setGuestEmail('');
      setInviteSent(false);
      setInviteError('');
      setRoomLink('');
      setLinkCopied(false);
    }
  }, [visible]);

  // ─── Tab 1: Debounced member search ──────────────────────────────────────

  const searchMembers = useCallback(async (q: string) => {
    if (!q.trim()) {
      setMembers([]);
      return;
    }
    // Cancel any in-flight search to prevent stale results overwriting fresh data
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    const controller = new AbortController();
    searchAbortRef.current = controller;
    try {
      setMembersLoading(true);
      const resp = await authenticatedFetch(`/api/conference/members?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
        headers: correlationId ? { 'X-Correlation-Id': correlationId } : undefined,
      });
      if (!resp.ok) return;
      const data = await resp.json();
      // Guard: abort check AFTER json parse prevents stale data overwriting fresh results
      if (controller.signal.aborted) return;
      setMembers(data);
    } catch (err: unknown) {
      // Ignore abort errors (expected when superseded by new search)
      if (err instanceof Error && err.name === 'AbortError') return;
    } finally {
      if (!controller.signal.aborted) {
        setMembersLoading(false);
      }
    }
  }, [authenticatedFetch]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim()) {
      setMembers([]);
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      searchMembers(searchQuery);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, searchMembers]);

  const handleInviteMember = (member: MemberResult) => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setInvitedIds(prev => new Set(prev).add(member.userId));
    setFlashMemberId(member.userId);
    setTimeout(() => setFlashMemberId(null), 800);
    onInviteMember(member.userId, member.name, 'internal');
  };

  // ─── Tab 2: Cross-suite lookup ───────────────────────────────────────────

  const handleLookup = async () => {
    if (!lookupSuiteId.trim() || !lookupOfficeId.trim()) return;
    try {
      setLookupLoading(true);
      setLookupError('');
      setLookupResults([]);
      const resp = await authenticatedFetch(
        `/api/conference/lookup?suiteId=${encodeURIComponent(lookupSuiteId.trim())}&officeId=${encodeURIComponent(lookupOfficeId.trim())}`,
        { headers: correlationId ? { 'X-Correlation-Id': correlationId } : undefined },
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data.length === 0) {
          setLookupError('No users found at this office');
        } else {
          setLookupResults(data);
        }
      } else {
        const err = await resp.json().catch(() => ({ error: 'Lookup failed' }));
        setLookupError(err.error || 'Not found');
      }
    } catch {
      setLookupError('Lookup failed. Check your connection.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleInviteAspireUser = (user: LookupResult) => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setInvitedIds(prev => new Set(prev).add(user.userId));
    onInviteMember(user.userId, user.name, 'cross-suite');
  };

  // ─── Tab 3: External email invite ────────────────────────────────────────

  const handleSendExternalInvite = async () => {
    if (!guestName.trim() || !guestEmail.trim()) return;
    try {
      setSendingInvite(true);
      setInviteError('');
      setInviteSent(false);
      const resp = await authenticatedFetch('/api/conference/invite-external', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}),
        },
        body: JSON.stringify({
          email: guestEmail.trim(),
          guestName: guestName.trim(),
          roomName,
          hostName,
          purpose,
        }),
      });
      const data = await resp.json();
      if (data.sent) {
        setInviteSent(true);
        onInviteGuest(guestName.trim(), guestEmail.trim());
      } else if (data.joinUrl) {
        // Fallback: email failed but we got a link — copy it
        setInviteError(data.error || 'Email unavailable. Link copied instead.');
        await copyToClipboard(data.joinUrl);
      } else {
        setInviteError(data.error || 'Failed to send invite');
      }
    } catch {
      setInviteError('Failed to send invite. Try copying the room link instead.');
    } finally {
      setSendingInvite(false);
    }
  };

  // ─── Tab 4: Room link generation ─────────────────────────────────────────

  const generateRoomLink = useCallback(async () => {
    if (roomLink) return; // Already generated
    try {
      setLinkLoading(true);
      const resp = await authenticatedFetch('/api/conference/room-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}),
        },
        body: JSON.stringify({ roomName }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setRoomLink(data.link);
      }
    } catch {
      // Link generation failed silently
    } finally {
      setLinkLoading(false);
    }
  }, [authenticatedFetch, roomName, roomLink]);

  // Auto-generate link when Link tab is selected
  useEffect(() => {
    if (activeTab === 'link' && visible && !roomLink) {
      generateRoomLink();
    }
  }, [activeTab, visible, roomLink, generateRoomLink]);

  const handleCopyLink = async () => {
    if (!roomLink) return;
    const copied = await copyToClipboard(roomLink);
    if (copied) {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'team', label: 'Team', icon: 'people' },
    { id: 'aspire', label: 'Aspire User', icon: 'business' },
    { id: 'external', label: 'External', icon: 'mail' },
    { id: 'link', label: 'Link', icon: 'link' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { pointerEvents: 'box-none' }]}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Close invite sheet"
          accessibilityRole="button"
        />
        <View style={[styles.sheet, { pointerEvents: 'auto' }]} accessible accessibilityLabel="Invite participant dialog">
          {/* Handle bar — 36x4 centered, Colors.border.default */}
          <View style={styles.handle} accessibilityElementsHidden />
          <Text style={styles.title} accessibilityRole="header">Invite Participant</Text>

          {/* Tab bar with sliding indicator */}
          <View style={styles.tabs} accessibilityRole="tablist">
            <Animated.View style={[styles.tabIndicator, tabIndicatorStyle]} />
            {TABS.map((tab) => (
              <Pressable
                key={tab.id}
                style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                onPress={() => handleTabSwitch(tab.id)}
                accessibilityRole="tab"
                accessibilityLabel={`${tab.label} tab`}
                accessibilityState={{ selected: activeTab === tab.id }}
              >
                <Ionicons
                  name={tab.icon}
                  size={14}
                  color={activeTab === tab.id ? Colors.text.primary : Colors.text.muted}
                  style={{ marginBottom: Spacing.xs / 2 }}
                  accessibilityElementsHidden
                />
                <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* ─── Tab 1: Team (internal) ─────────────────────────────────── */}
          {activeTab === 'team' && (
            <View style={styles.content}>
              <View
                style={[
                  styles.searchContainer,
                  focusedInput === 'teamSearch' && styles.searchContainerFocused,
                ]}
              >
                <Ionicons name="search" size={18} color={Colors.text.muted} accessibilityElementsHidden />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search your team members by name..."
                  placeholderTextColor={Colors.text.muted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={() => setFocusedInput('teamSearch')}
                  onBlur={() => setFocusedInput(null)}
                  autoFocus
                  accessibilityLabel="Search team members"
                  accessibilityRole="search"
                />
              </View>

              {/* Skeleton loading with LinearGradient shimmer sweep */}
              {membersLoading && (
                <View
                  style={styles.loadingContainer}
                  accessibilityRole="progressbar"
                  accessibilityLabel="Loading team members"
                  accessibilityState={{ busy: true }}
                >
                  {[0, 1, 2].map((i) => (
                    <View key={i} style={styles.skeletonRow}>
                      <ShimmerBar width={40} height={40} borderRadius={20} />
                      <View style={styles.skeletonInfo}>
                        <ShimmerBar width={160} height={12} borderRadius={BorderRadius.sm} />
                        <View style={{ height: Spacing.sm }} />
                        <ShimmerBar width={100} height={12} borderRadius={BorderRadius.sm} />
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {!membersLoading && members.length === 0 && searchQuery.trim() !== '' && (
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={32} color={Colors.text.muted} accessibilityElementsHidden />
                  <Text style={styles.emptyStateText} accessibilityRole="text">No members found</Text>
                </View>
              )}

              {!membersLoading && members.length === 0 && searchQuery.trim() === '' && (
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={32} color={Colors.text.muted} accessibilityElementsHidden />
                  <Text style={styles.emptyStateText} accessibilityRole="text">Search your team members by name</Text>
                </View>
              )}

              {!membersLoading && members.length > 0 && (
                <ScrollView style={styles.memberList} showsVerticalScrollIndicator={false}>
                  {members.map((member) => {
                    const alreadyInvited = invitedIds.has(member.userId);
                    const isFlashing = flashMemberId === member.userId;
                    return (
                      <View key={member.userId} style={{ position: 'relative' }}>
                        {/* Green glow overlay for invite success flash */}
                        {isFlashing && (
                          <Animated.View
                            style={[styles.memberFlashGlow, flashGlowStyle]}
                            pointerEvents="none"
                          />
                        )}
                        <PressableScale
                          style={[
                            styles.memberItem,
                            isFlashing && styles.memberFlash,
                            alreadyInvited && styles.memberItemDisabled,
                          ]}
                          onPress={() => !alreadyInvited && handleInviteMember(member)}
                          disabled={alreadyInvited}
                          accessibilityLabel={alreadyInvited ? `${member.name}, already invited` : `Invite ${member.name}`}
                          accessibilityState={{ disabled: alreadyInvited }}
                        >
                          <View style={styles.memberAvatar}>
                            <Text style={styles.memberInitial}>{member.name.charAt(0).toUpperCase()}</Text>
                          </View>
                          <View style={styles.memberInfo}>
                            <Text style={styles.memberName}>{member.name}</Text>
                            <Text style={styles.memberRole}>{member.officeLabel || member.email}</Text>
                          </View>
                          {alreadyInvited ? (
                            <Ionicons name="checkmark-circle" size={24} color={Colors.semantic.success} accessibilityElementsHidden />
                          ) : (
                            <Ionicons name="add-circle" size={24} color={Colors.accent.cyan} accessibilityElementsHidden />
                          )}
                        </PressableScale>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

          {/* ─── Tab 2: Aspire User (cross-suite) ──────────────────────── */}
          {activeTab === 'aspire' && (
            <View style={styles.content}>
              <Text style={styles.inputLabel}>Suite ID</Text>
              <TextInput
                style={[
                  styles.textInput,
                  focusedInput === 'suiteId' && styles.textInputFocused,
                ]}
                placeholder="STE-XXXXXX"
                placeholderTextColor={Colors.text.muted}
                value={lookupSuiteId}
                onChangeText={setLookupSuiteId}
                onFocus={() => setFocusedInput('suiteId')}
                onBlur={() => setFocusedInput(null)}
                autoCapitalize="characters"
                accessibilityLabel="Suite ID input"
              />
              <Text style={styles.formatHint}>Format: STE-XXXXXX</Text>
              <Text style={styles.inputLabel}>Office ID</Text>
              <TextInput
                style={[
                  styles.textInput,
                  focusedInput === 'officeId' && styles.textInputFocused,
                ]}
                placeholder="OFF-XXXXXX"
                placeholderTextColor={Colors.text.muted}
                value={lookupOfficeId}
                onChangeText={setLookupOfficeId}
                onFocus={() => setFocusedInput('officeId')}
                onBlur={() => setFocusedInput(null)}
                autoCapitalize="characters"
                accessibilityLabel="Office ID input"
              />
              <Text style={styles.formatHint}>Format: OFF-XXXXXX</Text>
              <PressableScale
                style={[
                  styles.actionButton,
                  (!lookupSuiteId.trim() || !lookupOfficeId.trim()) && styles.actionButtonDisabled,
                ]}
                onPress={handleLookup}
                disabled={!lookupSuiteId.trim() || !lookupOfficeId.trim() || lookupLoading}
                accessibilityLabel="Look up Aspire user"
              >
                {lookupLoading ? (
                  <ActivityIndicator size="small" color={Colors.background.primary} />
                ) : (
                  <>
                    <Ionicons name="search" size={16} color={Colors.background.primary} accessibilityElementsHidden />
                    <Text style={styles.actionButtonText}>Look Up</Text>
                  </>
                )}
              </PressableScale>

              {lookupError !== '' && (
                <View style={styles.lookupErrorContainer} accessibilityRole="alert">
                  <Ionicons name="alert-circle-outline" size={20} color={Colors.text.muted} accessibilityElementsHidden />
                  <Text style={styles.lookupErrorText}>{lookupError}</Text>
                </View>
              )}

              {lookupResults.length > 0 && (
                <ScrollView style={styles.memberList} showsVerticalScrollIndicator={false}>
                  {lookupResults.map((user) => {
                    const alreadyInvited = invitedIds.has(user.userId);
                    return (
                      <View key={user.userId} style={styles.lookupResultCard}>
                        <View style={styles.memberAvatar}>
                          <Text style={styles.memberInitial}>{user.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>{user.name}</Text>
                          <View style={styles.businessBadge}>
                            <Ionicons name="business-outline" size={12} color={Colors.text.muted} accessibilityElementsHidden />
                            <Text style={styles.businessName}>{user.businessName}</Text>
                          </View>
                        </View>
                        <PressableScale
                          style={[styles.inviteRowBtn, alreadyInvited && styles.actionButtonDisabled]}
                          onPress={() => !alreadyInvited && handleInviteAspireUser(user)}
                          disabled={alreadyInvited}
                          accessibilityLabel={alreadyInvited ? `${user.name}, already invited` : `Invite ${user.name}`}
                        >
                          <Text style={styles.inviteRowBtnText}>
                            {alreadyInvited ? 'Invited' : 'Invite'}
                          </Text>
                        </PressableScale>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

          {/* ─── Tab 3: External (email invite) ────────────────────────── */}
          {activeTab === 'external' && (
            <View style={styles.content}>
              {inviteSent ? (
                <View style={styles.successState} accessibilityRole="alert">
                  <Animated.View style={checkAnimStyle}>
                    <Ionicons name="checkmark-circle" size={48} color={Colors.semantic.success} accessibilityElementsHidden />
                  </Animated.View>
                  <Text style={styles.successTitle}>Invite Sent</Text>
                  <Text style={styles.successSubtitle}>
                    {guestName} will receive a branded meeting link at {guestEmail}
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.inputLabel}>Guest Name</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      focusedInput === 'guestName' && styles.textInputFocused,
                    ]}
                    placeholder="Enter name"
                    placeholderTextColor={Colors.text.muted}
                    value={guestName}
                    onChangeText={setGuestName}
                    onFocus={() => setFocusedInput('guestName')}
                    onBlur={() => setFocusedInput(null)}
                    accessibilityLabel="Guest name"
                  />
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      focusedInput === 'guestEmail' && styles.textInputFocused,
                    ]}
                    placeholder="guest@company.com"
                    placeholderTextColor={Colors.text.muted}
                    value={guestEmail}
                    onChangeText={setGuestEmail}
                    onFocus={() => setFocusedInput('guestEmail')}
                    onBlur={() => setFocusedInput(null)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    accessibilityLabel="Guest email address"
                  />

                  <Text style={styles.hintText}>
                    They'll receive a branded meeting link from aspireos.app
                  </Text>

                  {inviteError !== '' && (
                    <View style={styles.errorBanner} accessibilityRole="alert">
                      <Ionicons name="warning-outline" size={16} color={Colors.semantic.error} accessibilityElementsHidden />
                      <Text style={styles.errorBannerText}>{inviteError}</Text>
                    </View>
                  )}

                  <PressableScale
                    style={[
                      styles.actionButton,
                      (!guestName.trim() || !guestEmail.trim()) && styles.actionButtonDisabled,
                    ]}
                    onPress={handleSendExternalInvite}
                    disabled={!guestName.trim() || !guestEmail.trim() || sendingInvite}
                    accessibilityLabel="Send email invite"
                  >
                    {sendingInvite ? (
                      <ActivityIndicator size="small" color={Colors.background.primary} />
                    ) : (
                      <>
                        <Ionicons name="send" size={16} color={Colors.background.primary} accessibilityElementsHidden />
                        <Text style={styles.actionButtonText}>Send Email Invite</Text>
                      </>
                    )}
                  </PressableScale>
                </>
              )}
            </View>
          )}

          {/* ─── Tab 4: Link (shareable) ────────────────────────────────── */}
          {activeTab === 'link' && (
            <View style={styles.content}>
              {linkLoading && (
                <View
                  style={styles.linkLoadingContainer}
                  accessibilityRole="progressbar"
                  accessibilityLabel="Generating secure link"
                  accessibilityState={{ busy: true }}
                >
                  <ActivityIndicator size="small" color={Colors.accent.cyan} />
                  <Text style={styles.linkLoadingText}>Generating secure link...</Text>
                </View>
              )}

              {!linkLoading && roomLink !== '' && (
                <>
                  <View style={styles.linkCard}>
                    <Ionicons name="link" size={20} color={Colors.accent.cyan} accessibilityElementsHidden />
                    <Text
                      style={styles.linkUrl}
                      numberOfLines={2}
                      selectable
                      accessibilityLabel={`Room link: ${roomLink}`}
                    >
                      {roomLink}
                    </Text>
                  </View>

                  <View style={styles.linkMeta} accessibilityElementsHidden>
                    <Ionicons name="time-outline" size={14} color={Colors.text.muted} />
                    <Text style={styles.linkMetaText}>Valid for 10 minutes</Text>
                  </View>

                  <PressableScale
                    style={[styles.copyButton, linkCopied && styles.copyButtonSuccess]}
                    onPress={handleCopyLink}
                    accessibilityLabel={linkCopied ? 'Link copied' : 'Copy link to clipboard'}
                  >
                    <Ionicons
                      name={linkCopied ? 'checkmark' : 'copy'}
                      size={18}
                      color={linkCopied ? Colors.semantic.success : Colors.text.primary}
                      accessibilityElementsHidden
                    />
                    <Text style={[styles.copyButtonText, linkCopied && { color: Colors.semantic.success }]}>
                      {linkCopied ? 'Copied!' : 'Copy Link'}
                    </Text>
                  </PressableScale>
                </>
              )}

              {!linkLoading && roomLink === '' && (
                <View style={styles.emptyState}>
                  <Ionicons name="link-outline" size={32} color={Colors.text.muted} accessibilityElementsHidden />
                  <Text style={styles.emptyStateText} accessibilityRole="alert">Failed to generate link</Text>
                  <PressableScale
                    style={styles.retryButton}
                    onPress={() => { setRoomLink(''); generateRoomLink(); }}
                    accessibilityLabel="Retry generating room link"
                  >
                    <Text style={styles.retryButtonText}>Try Again</Text>
                  </PressableScale>
                </View>
              )}
            </View>
          )}

          {/* Cancel button */}
          <PressableScale
            style={styles.cancelButton}
            onPress={onClose}
            accessibilityLabel="Close invite sheet"
          >
            <Text style={styles.cancelText}>Close</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  sheet: {
    backgroundColor: Colors.background.secondary,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    maxHeight: '85%',
    zIndex: 1,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border.default,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.headline,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },

  // Tabs — segmented control with animated sliding indicator
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
    marginBottom: Spacing.lg,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: Spacing.xs,
    bottom: Spacing.xs,
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.sm,
    zIndex: 0,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs / 2,
    zIndex: 1,
    minHeight: 44, // Minimum 44pt tap target
  },
  tabActive: {
    // Visual handled by sliding indicator — no static bg needed
  },
  tabText: {
    ...Typography.micro,
    fontWeight: '500',
    color: Colors.text.muted,
  },
  tabTextActive: {
    color: Colors.text.primary,
  },

  // Content area
  content: {
    minHeight: 220,
  },

  // Search — row with icon + TextInput, tertiary bg, md radius
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    marginBottom: Spacing.md,
  },
  searchContainerFocused: {
    borderColor: Colors.accent.cyan,
    ...Shadows.glow(Colors.accent.cyan),
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingLeft: Spacing.sm,
    color: Colors.text.primary,
    ...Typography.body,
  },

  // Loading skeleton — ShimmerBar sweep animation
  loadingContainer: {
    gap: Spacing.md,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  skeletonInfo: {
    flex: 1,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.sm,
  },
  emptyStateText: {
    ...Typography.caption,
    color: Colors.text.muted,
    textAlign: 'center',
  },

  // Member list — avatar circle + info column + action button, separator
  memberList: {
    maxHeight: 280,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    minHeight: 44, // Minimum 44pt tap target
  },
  memberFlash: {
    borderBottomColor: Colors.semantic.success,
    backgroundColor: 'rgba(52, 199, 89, 0.06)',
  },
  memberFlashGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.semantic.success,
    ...Shadows.glow(Colors.semantic.success),
  },
  memberItemDisabled: {
    opacity: 0.5,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  memberInitial: {
    ...Typography.body,
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  memberRole: {
    ...Typography.small,
    color: Colors.text.muted,
  },

  // Input fields
  inputLabel: {
    ...Typography.small,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  textInput: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.text.primary,
    ...Typography.body,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  textInputFocused: {
    borderColor: Colors.accent.cyan,
    ...Shadows.glow(Colors.accent.cyan),
  },
  hintText: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  formatHint: {
    ...Typography.micro,
    color: Colors.text.muted,
    marginTop: Spacing.xs / 2,
  },

  // Action button (primary)
  actionButton: {
    backgroundColor: Colors.accent.cyan,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    ...Typography.body,
    color: Colors.background.primary,
    fontWeight: '600',
  },

  // Lookup error
  lookupErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    justifyContent: 'center',
  },
  lookupErrorText: {
    ...Typography.caption,
    color: Colors.text.muted,
  },

  // Lookup result card — elevated with Shadows.md
  lookupResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    ...Shadows.md,
  },
  businessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs / 2,
  },
  businessName: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  inviteRowBtn: {
    backgroundColor: Colors.accent.cyan,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  inviteRowBtnText: {
    ...Typography.small,
    color: Colors.background.primary,
    fontWeight: '600',
  },

  // Success state (external invite)
  successState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.md,
  },
  successTitle: {
    ...Typography.headline,
    color: Colors.semantic.success,
  },
  successSubtitle: {
    ...Typography.caption,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.semantic.errorLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  errorBannerText: {
    ...Typography.small,
    color: Colors.semantic.error,
    flex: 1,
  },

  // Link tab
  linkLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxxl,
  },
  linkLoadingText: {
    ...Typography.caption,
    color: Colors.text.muted,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    gap: Spacing.md,
    ...Shadows.md,
  },
  linkUrl: {
    flex: 1,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  linkMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    justifyContent: 'center',
  },
  linkMetaText: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent.cyanDark,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  copyButtonSuccess: {
    backgroundColor: Colors.semantic.successDark,
  },
  copyButtonText: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background.tertiary,
  },
  retryButtonText: {
    ...Typography.caption,
    color: Colors.accent.cyan,
    fontWeight: '500',
  },

  // Cancel
  cancelButton: {
    backgroundColor: Colors.background.tertiary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  cancelText: {
    ...Typography.body,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
});
