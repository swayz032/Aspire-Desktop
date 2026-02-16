import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Pressable, 
  Modal,
  TextInput,
  Platform,
  Animated,
  Image,
  ImageBackground,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '@/constants/tokens';
import { LinearGradient } from 'expo-linear-gradient';

const teamWorkspaceHero = require('@/assets/images/team-workspace-hero.jpg');
const avatarImages: Record<string, any> = {
  'member_1': require('@/assets/images/avatar-marcus.jpg'),
  'member_2': require('@/assets/images/avatar-sarah.jpg'),
  'member_3': require('@/assets/images/avatar-james.jpg'),
};
const approvalThumbnails: Record<string, any> = {
  'contract_send': require('@/assets/images/approval-contract.jpg'),
  'money_move': require('@/assets/images/approval-money.jpg'),
  'email_send': require('@/assets/images/approval-email.jpg'),
  'invite_member': require('@/assets/images/approval-invite.jpg'),
  'suite_change': require('@/assets/images/approval-suite.jpg'),
};
import { DesktopPageWrapper } from '@/components/desktop/DesktopPageWrapper';
import { useDesktop } from '@/lib/useDesktop';
import { hasPermission, isOwnerOrAdmin, getRoleName, type RoleType, type PermissionKey, type Member } from '@/lib/permissions';
import { useTenant } from '@/providers/TenantProvider';
import { supabase } from '@/lib/supabase';

type ActionType = 'email_send' | 'contract_send' | 'money_move' | 'invite_member' | 'suite_change';

interface Suite {
  id: string;
  name: string;
  suiteNumber: string;
  isActive: boolean;
  createdAt: string;
}

interface Invite {
  id: string;
  email: string;
  name: string;
  roleId: RoleType;
  suiteAccessIds: string[];
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
  requiresApproval: boolean;
}

interface ApprovalRule {
  id: string;
  scope: 'suite' | 'global';
  actionType: ActionType;
  requiredApproverRole: RoleType;
  requiresOwnerVideo: boolean;
}

interface ApprovalRequest {
  id: string;
  actionType: ActionType;
  createdBy: string;
  createdByName: string;
  assignedToRole: RoleType;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  dueAt?: string;
  payloadSummary: string;
  requiresVideo: boolean;
  suiteId: string;
}

type DeskType = 'frontDesk' | 'inbox' | 'billing' | 'legal' | 'conference';

interface QueueItem {
  id: string;
  desk: DeskType;
  summary: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'ready_for_approval' | 'completed';
  assigneeId?: string;
  assigneeName?: string;
  createdAt: string;
  suiteId: string;
}

type ActorType = 'human' | 'aiDesk' | 'system';

interface Receipt {
  id: string;
  actionType: ActionType | 'queue_complete' | 'login' | 'settings_change';
  actorId: string;
  actorName: string;
  actorType: ActorType;
  suiteId: string;
  status: 'drafted' | 'approved' | 'executed' | 'failed' | 'blocked';
  timestamp: string;
  summary: string;
  approverId?: string;
  approverName?: string;
}

interface UsageLedger {
  suiteId: string;
  memberId?: string;
  memberName?: string;
  period: string;
  actionsUsed: number;
  actionsLimit: number;
  phoneInboundMins: number;
  phoneInboundLimit: number;
  phoneOutboundMins: number;
  phoneOutboundLimit: number;
  smsSegments: number;
  smsLimit: number;
  voiceMins: number;
  voiceLimit: number;
  videoMins: number;
  videoLimit: number;
  conferenceSessions: number;
  conferenceSessionsLimit: number;
  conferenceMins: number;
  conferenceMinsCap: number;
}

const deskInfo: Record<DeskType, { name: string; staffName: string; icon: string; color: string }> = {
  frontDesk: { name: 'Front Desk', staffName: 'Sarah', icon: 'call', color: '#22D3EE' },
  inbox: { name: 'Inbox', staffName: 'Eli', icon: 'mail', color: '#3B82F6' },
  billing: { name: 'Billing', staffName: 'Quinn', icon: 'card', color: '#10B981' },
  legal: { name: 'Legal', staffName: 'Clara', icon: 'document-text', color: '#8B5CF6' },
  conference: { name: 'Conference', staffName: 'Nora', icon: 'videocam', color: '#F59E0B' },
};

const actionTypeLabels: Record<ActionType, string> = {
  email_send: 'Email Send',
  contract_send: 'Contract Send / e-Sign',
  money_move: 'Money Movement',
  invite_member: 'Invite Teammate',
  suite_change: 'Suite Settings Change',
};

const pricing = {
  teamMemberSeat: 299,
  secondSuite: 349,
};

const officeStoreStaff = [
  { id: 'staff_eli', name: 'Eli' },
  { id: 'staff_sarah', name: 'Sarah' },
  { id: 'staff_clara', name: 'Clara' },
  { id: 'staff_nora', name: 'Nora' },
  { id: 'staff_quinn', name: 'Quinn' },
];

const EMPTY_USAGE: UsageLedger = {
  suiteId: '',
  period: new Date().toISOString().slice(0, 7),
  actionsUsed: 0,
  actionsLimit: 500,
  phoneInboundMins: 0,
  phoneInboundLimit: 250,
  phoneOutboundMins: 0,
  phoneOutboundLimit: 600,
  smsSegments: 0,
  smsLimit: 300,
  voiceMins: 0,
  voiceLimit: 300,
  videoMins: 0,
  videoLimit: 150,
  conferenceSessions: 0,
  conferenceSessionsLimit: 12,
  conferenceMins: 0,
  conferenceMinsCap: 360,
};

type TabType = 'people' | 'approvals' | 'queues' | 'receipts' | 'usage';

const deskToStaffMap: Record<DeskType, string> = {
  frontDesk: 'staff_sarah',
  inbox: 'staff_eli',
  billing: 'staff_quinn',
  legal: 'staff_clara',
  conference: 'staff_nora',
};




function SeatCounter({ used, available }: { used: number; available: number }) {
  return (
    <View style={styles.seatCounter}>
      <Ionicons name="person" size={16} color="rgba(255,255,255,0.7)" />
      <Text style={styles.seatText}>
        <Text style={styles.seatUsed}>{used}</Text>/{available} seats
      </Text>
    </View>
  );
}

function getRoleBadgeStyle(roleId: RoleType) {
  switch (roleId) {
    case 'owner':
      return { backgroundColor: 'rgba(251,191,36,0.15)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)' };
    case 'admin':
      return { backgroundColor: 'rgba(59,130,246,0.15)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' };
    case 'member':
      return { backgroundColor: 'rgba(139,92,246,0.12)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)' };
    case 'viewer':
      return { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' };
    case 'external':
      return { backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)' };
    default:
      return { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' };
  }
}

function getRoleBadgeTextColor(roleId: RoleType) {
  switch (roleId) {
    case 'owner':
      return '#FBBF24';
    case 'admin':
      return '#60A5FA';
    case 'member':
      return '#A78BFA';
    case 'viewer':
      return '#D4D4D8';
    case 'external':
      return '#4ADE80';
    default:
      return '#FFFFFF';
  }
}

function PeopleTab({
  members,
  invites,
  onInvite,
  seatCount,
  currentUser,
}: {
  members: Member[];
  invites: Invite[];
  onInvite: () => void;
  seatCount: { used: number; available: number };
  currentUser: Member | null;
}) {
  const canInvite = hasPermission(currentUser, 'team.invite');

  return (
    <View style={styles.tabScrollContent}>
      <View style={styles.contextToolbar}>
        <SeatCounter used={seatCount.used} available={seatCount.available} />
        <View style={styles.toolbarRight}>
          {isOwnerOrAdmin(currentUser) && (
            <>
              <Pressable style={({ hovered }: any) => [styles.secondaryBtn, hovered && styles.secondaryBtnHover]}>
                <View style={styles.btnIconWrap}>
                  <Ionicons name="add-circle" size={16} color={Colors.accent.cyan} />
                </View>
                <Text style={styles.secondaryBtnText}>Add Seat</Text>
                <View style={styles.pricePill}>
                  <Text style={styles.pricePillText}>${pricing.teamMemberSeat}/mo</Text>
                </View>
              </Pressable>
              <Pressable style={({ hovered }: any) => [styles.secondaryBtn, hovered && styles.secondaryBtnHover]}>
                <View style={styles.btnIconWrap}>
                  <Ionicons name="business" size={16} color={Colors.accent.cyan} />
                </View>
                <Text style={styles.secondaryBtnText}>Add Suite</Text>
                <View style={styles.pricePill}>
                  <Text style={styles.pricePillText}>${pricing.secondSuite}/mo</Text>
                </View>
              </Pressable>
            </>
          )}
          {canInvite && (
            <Pressable onPress={onInvite} style={({ hovered }: any) => [styles.secondaryBtn, hovered && styles.secondaryBtnHover]}>
              <View style={styles.btnIconWrap}>
                <Ionicons name="person-add" size={16} color={Colors.accent.cyan} />
              </View>
              <Text style={styles.secondaryBtnText}>Invite Teammate</Text>
            </Pressable>
          )}
        </View>
      </View>
      
      <View style={styles.glassmorphismCard}>
        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Name</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Role</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Office No.</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Status</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Last Active</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Actions</Text>
          </View>
          
          {members.map(member => (
            <Pressable 
              key={member.id} 
              style={({ hovered }: any) => [styles.tableRow, hovered && styles.tableRowHover]}
            >
              <View style={[styles.tableCell, { flex: 2 }]}>
                <View style={styles.memberInfo}>
                  {avatarImages[member.id] ? (
                    <Image source={avatarImages[member.id]} style={styles.memberAvatarImg} />
                  ) : (
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>{member.name[0]}</Text>
                    </View>
                  )}
                  <View>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberEmail}>{member.email}</Text>
                  </View>
                </View>
              </View>
              <View style={[styles.tableCell, { flex: 1 }]}>
                <View style={[styles.roleBadge, getRoleBadgeStyle(member.roleId)]}>
                  <Ionicons 
                    name={member.roleId === 'owner' ? 'shield' : member.roleId === 'admin' ? 'key' : 'person'} 
                    size={12} 
                    color={getRoleBadgeTextColor(member.roleId)} 
                  />
                  <Text style={[styles.roleBadgeText, { color: getRoleBadgeTextColor(member.roleId) }]}>
                    {getRoleName(member.roleId)}
                  </Text>
                </View>
              </View>
              <View style={[styles.tableCell, { flex: 1 }]}>
                <View style={styles.officeNumberBadge}>
                  <Ionicons name="business" size={14} color={Colors.accent.cyan} />
                  <Text style={styles.officeNumberText}>Suite {member.extension || '—'}</Text>
                </View>
              </View>
              <View style={[styles.tableCell, { flex: 1 }]}>
                <View style={[styles.statusBadge, styles[`status_${member.status}` as keyof typeof styles] as any]}>
                  <View style={[styles.statusDot, member.status === 'active' && styles.statusDotActive]} />
                  <Text style={[styles.statusText, member.status === 'active' && { color: Colors.semantic.success }]}>
                    {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                  </Text>
                </View>
              </View>
              <View style={[styles.tableCell, { flex: 1 }]}>
                <Text style={styles.cellTextMuted}>{formatTimeAgo(member.lastActiveAt)}</Text>
              </View>
              <View style={[styles.tableCell, { flex: 0.5 }]}>
                <Pressable style={({ hovered }: any) => [styles.actionBtn, hovered && styles.actionBtnHover]}>
                  <Ionicons name="ellipsis-horizontal" size={16} color="rgba(255,255,255,0.7)" />
                </Pressable>
              </View>
            </Pressable>
          ))}
          
          {invites.filter(i => i.status === 'pending').map(invite => (
            <View key={invite.id} style={[styles.tableRow, styles.pendingRow]}>
              <View style={[styles.tableCell, { flex: 2 }]}>
                <View style={styles.memberInfo}>
                  <View style={[styles.memberAvatar, styles.pendingAvatar]}>
                    <Ionicons name="mail" size={18} color="rgba(255,255,255,0.5)" />
                  </View>
                  <View>
                    <Text style={styles.memberName}>{invite.name}</Text>
                    <Text style={styles.memberEmail}>{invite.email}</Text>
                  </View>
                </View>
              </View>
              <View style={[styles.tableCell, { flex: 1 }]}>
                <View style={[styles.roleBadge, getRoleBadgeStyle(invite.roleId)]}>
                  <Text style={[styles.roleBadgeText, { color: getRoleBadgeTextColor(invite.roleId) }]}>
                    {getRoleName(invite.roleId)}
                  </Text>
                </View>
              </View>
              <View style={[styles.tableCell, { flex: 1 }]}>
                <Text style={styles.cellTextMuted}>Pending</Text>
              </View>
              <View style={[styles.tableCell, { flex: 1 }]}>
                <View style={[styles.statusBadge, styles.status_pending]}>
                  <Text style={styles.statusText}>Pending Invite</Text>
                </View>
              </View>
              <View style={[styles.tableCell, { flex: 1 }]}>
                <Text style={styles.cellTextMuted}>Sent {formatTimeAgo(invite.createdAt)}</Text>
              </View>
              <View style={[styles.tableCell, { flex: 0.5, flexDirection: 'row', gap: 4 }]}>
                <Pressable style={({ hovered }: any) => [styles.actionBtn, hovered && styles.actionBtnHover]}>
                  <Ionicons name="refresh" size={14} color="rgba(255,255,255,0.7)" />
                </Pressable>
                <Pressable style={({ hovered }: any) => [styles.actionBtn, hovered && styles.actionBtnHover]}>
                  <Ionicons name="close" size={14} color={Colors.semantic.error} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function ApprovalsTab({ 
  requests, 
  rules,
  onApprove,
  onReject,
}: { 
  requests: ApprovalRequest[];
  rules: ApprovalRule[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [showRules, setShowRules] = useState(false);
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const overdueAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(overdueAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
        Animated.timing(overdueAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);
  
  return (
    <View style={styles.tabScrollContent}>
      <View style={styles.contextToolbar}>
        <View style={styles.toolbarLeft}>
          <Text style={styles.tabSectionTitle}>Approval Queue</Text>
          {pendingRequests.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{pendingRequests.length}</Text>
            </View>
          )}
        </View>
        <Pressable 
          style={({ hovered }: any) => [styles.secondaryBtn, hovered && styles.secondaryBtnHover]}
          onPress={() => setShowRules(!showRules)}
        >
          <Ionicons name="settings-outline" size={16} color="#A1A1AA" />
          <Text style={styles.secondaryBtnText}>{showRules ? 'View Queue' : 'Edit Rules'}</Text>
        </Pressable>
      </View>
      
      <View style={styles.glassmorphismCard}>
        {!showRules ? (
          <View style={styles.approvalList}>
            {pendingRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={56} color="rgba(255,255,255,0.2)" />
                <Text style={styles.emptyTitle}>All Caught Up</Text>
                <Text style={styles.emptyText}>No pending approvals at this time</Text>
                <Text style={styles.emptySubtext}>New requests will appear here for your review</Text>
              </View>
            ) : (
              pendingRequests.map(request => (
                <View key={request.id} style={styles.approvalCard}>
                  <View style={styles.approvalCardInner}>
                    <View style={styles.approvalThumbnailWrap}>
                      <Image 
                        source={approvalThumbnails[request.actionType]} 
                        style={styles.approvalThumbnail} 
                      />
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.6)']}
                        style={styles.approvalThumbnailOverlay}
                      />
                      <View style={styles.approvalThumbnailBadge}>
                        <Ionicons 
                          name={getActionIcon(request.actionType)} 
                          size={14} 
                          color="#FFFFFF" 
                        />
                      </View>
                    </View>
                    <View style={styles.approvalContent}>
                      <View style={styles.approvalHeader}>
                        <Text style={styles.approvalTypeName}>
                          {actionTypeLabels[request.actionType]}
                        </Text>
                        <View style={styles.approvalMeta}>
                          {request.requiresVideo && (
                            <View style={styles.videoBadge}>
                              <Ionicons name="videocam" size={13} color="#60A5FA" />
                              <Text style={styles.videoBadgeText}>Video with Ava</Text>
                            </View>
                          )}
                          {isOverdue(request.dueAt) ? (
                            <Animated.View style={[styles.slaBadgeUrgent, { opacity: overdueAnim }]}>
                              <Ionicons name="alert-circle" size={13} color="#EF4444" />
                              <Text style={styles.slaBadgeUrgentText}>OVERDUE</Text>
                            </Animated.View>
                          ) : (
                            <View style={styles.slaBadge}>
                              <Text style={styles.slaBadgeText}>
                                {formatTimeAgo(request.createdAt)}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Text style={styles.approvalSummary}>{request.payloadSummary}</Text>
                      <View style={styles.approvalFooter}>
                        <View style={styles.approvalCreatorWrap}>
                          {avatarImages[request.createdBy] ? (
                            <Image source={avatarImages[request.createdBy]} style={styles.approvalCreatorAvatar} />
                          ) : (
                            <View style={styles.approvalCreatorAvatarFallback}>
                              <Text style={styles.approvalCreatorAvatarText}>{request.createdByName[0]}</Text>
                            </View>
                          )}
                          <Text style={styles.approvalCreator}>{request.createdByName}</Text>
                        </View>
                        <View style={styles.approvalActions}>
                          <Pressable 
                            style={({ hovered }: any) => [styles.rejectBtn, hovered && styles.rejectBtnHover]}
                            onPress={() => onReject(request.id)}
                          >
                            <Ionicons name="close-circle" size={16} color="#A1A1AA" />
                            <Text style={styles.rejectBtnText}>Deny</Text>
                          </Pressable>
                          <Pressable 
                            onPress={() => onApprove(request.id)}
                          >
                            {({ hovered }: any) => (
                              <LinearGradient
                                colors={['#3B82F6', '#2563EB']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={[styles.approveBtn, hovered && styles.approveBtnHover]}
                              >
                                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                                <Text style={styles.approveBtnText}>Approve</Text>
                              </LinearGradient>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={styles.rulesMatrix}>
            <Text style={styles.rulesTitle}>Approval Rules</Text>
            <Text style={styles.rulesSubtitle}>Configure who can approve each action type</Text>
            
            <View style={styles.rulesTable}>
              <View style={styles.rulesHeader}>
                <Text style={[styles.rulesHeaderCell, { flex: 2 }]}>Action Type</Text>
                <Text style={[styles.rulesHeaderCell, { flex: 1 }]}>Required Approver</Text>
                <Text style={[styles.rulesHeaderCell, { flex: 1 }]}>Video Required</Text>
              </View>
              {rules.map(rule => (
                <View key={rule.id} style={styles.rulesRow}>
                  <View style={[styles.rulesCellView, { flex: 2 }]}>
                    <Text style={styles.rulesCell}>{actionTypeLabels[rule.actionType]}</Text>
                  </View>
                  <View style={[styles.rulesCellView, { flex: 1 }]}>
                    <View style={[styles.roleBadge, getRoleBadgeStyle(rule.requiredApproverRole)]}>
                      <Text style={[styles.roleBadgeText, { color: getRoleBadgeTextColor(rule.requiredApproverRole) }]}>
                        {getRoleName(rule.requiredApproverRole)}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.rulesCellView, { flex: 1 }]}>
                    <View style={[styles.toggleSwitch, rule.requiresOwnerVideo && styles.toggleSwitchOn]}>
                      <View style={[styles.toggleKnob, rule.requiresOwnerVideo && styles.toggleKnobOn]} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const VISIBLE_ITEMS = 3;
const deskDisplayNames: Record<DeskType, string> = {
  frontDesk: 'Front Desk',
  inbox: 'Inbox Desk',
  billing: 'Billing Desk',
  legal: 'Legal Desk',
  conference: 'Conference Desk',
};

function QueuesTab({ 
  items,
  members,
  onAssign,
}: { 
  items: QueueItem[];
  members: Member[];
  onAssign: (itemId: string, memberId: string) => void;
}) {
  const desks: DeskType[] = ['frontDesk', 'inbox', 'billing', 'legal', 'conference'];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const currentDesk = desks[currentIndex];
  const info = deskInfo[currentDesk];
  const deskItems = items.filter(i => i.desk === currentDesk);
  const pendingCount = deskItems.filter(i => i.status === 'pending').length;
  const staffId = deskToStaffMap[currentDesk];
  const staffMember = officeStoreStaff.find(s => s.id === staffId);
  const hasOverflow = deskItems.length > VISIBLE_ITEMS;
  const visibleItems = expanded ? deskItems : deskItems.slice(0, VISIBLE_ITEMS);

  const animateTransition = (newIndex: number, dir: 'left' | 'right') => {
    setExpanded(false);
    const exitValue = dir === 'right' ? -60 : 60;
    const enterValue = dir === 'right' ? 60 : -60;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: exitValue, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setCurrentIndex(newIndex);
      slideAnim.setValue(enterValue);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
      ]).start();
    });
  };

  const goNext = () => {
    if (currentIndex < desks.length - 1) animateTransition(currentIndex + 1, 'right');
  };
  const goPrev = () => {
    if (currentIndex > 0) animateTransition(currentIndex - 1, 'left');
  };

  return (
    <View style={styles.tabScrollContent}>
      <View style={styles.deskCarouselContainer}>
        <Pressable
          onPress={goPrev}
          style={({ hovered }: any) => [
            styles.deskArrowBtn,
            currentIndex === 0 && styles.deskArrowDisabled,
            hovered && currentIndex > 0 && styles.deskArrowHover,
          ]}
          disabled={currentIndex === 0}
        >
          <Ionicons name="chevron-back" size={22} color={currentIndex === 0 ? '#333' : '#A1A1AA'} />
        </Pressable>

        <Animated.View
          style={[
            styles.deskCardWrapper,
            { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
          ]}
        >
          <View style={styles.deskCard}>
            <View style={styles.deskCardHeader}>
              <View style={styles.deskCardHeaderLeft}>
                {staffMember ? (
                  <Image source={staffMember.avatarImage} style={styles.deskStaffAvatar} />
                ) : (
                  <View style={[styles.deskStaffIconWrap, { backgroundColor: `${info.color}15` }]}>
                    <Ionicons name={info.icon as any} size={22} color={info.color} />
                  </View>
                )}
                <View style={styles.deskHeaderInfo}>
                  <Text style={styles.deskStaffName}>{info.staffName}</Text>
                  <Text style={styles.deskName}>{deskDisplayNames[currentDesk]}</Text>
                </View>
              </View>
              <View style={styles.deskHeaderRight}>
                {pendingCount > 0 && (
                  <View style={styles.deskPendingBadge}>
                    <Text style={styles.deskPendingText}>{pendingCount} pending</Text>
                  </View>
                )}
                <Text style={styles.deskCounter}>{currentIndex + 1} of {desks.length}</Text>
              </View>
            </View>

            <View style={styles.deskDivider} />

            <View style={styles.deskItemsList}>
              {deskItems.length === 0 ? (
                <View style={styles.queueEmpty}>
                  <Ionicons name="checkmark-circle" size={36} color="#2C2C2E" />
                  <Text style={styles.queueEmptyText}>All caught up</Text>
                  <Text style={styles.queueEmptySubtext}>No pending items</Text>
                </View>
              ) : (
                <>
                  {visibleItems.map((item, idx) => (
                    <Pressable
                      key={item.id}
                      style={({ hovered }: any) => [
                        styles.deskQueueItem,
                        hovered && styles.deskQueueItemHover,
                        idx === visibleItems.length - 1 && !hasOverflow && { borderBottomWidth: 0 },
                      ]}
                    >
                      <View style={styles.deskQueueItemRow}>
                        <View style={[styles.priorityDot, styles[`priority_${item.priority}` as keyof typeof styles] as any]} />
                        <View style={styles.deskQueueItemContent}>
                          <Text style={styles.deskQueueItemSummary} numberOfLines={2}>{item.summary}</Text>
                          <View style={styles.deskQueueItemMeta}>
                            <Text style={styles.deskQueueItemAge}>{formatTimeAgo(item.createdAt)}</Text>
                            {item.assigneeName ? (
                              <View style={styles.deskQueueAssignee}>
                                <Ionicons name="person" size={11} color="#71717A" />
                                <Text style={styles.deskQueueAssigneeName}>{item.assigneeName}</Text>
                              </View>
                            ) : (
                              <Pressable style={({ hovered }: any) => [styles.deskAssignLink, hovered && styles.deskAssignLinkHover]}>
                                <Ionicons name="person-add-outline" size={11} color="#3B82F6" />
                                <Text style={styles.deskAssignLinkText}>Assign</Text>
                              </Pressable>
                            )}
                          </View>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </>
              )}
            </View>

            {hasOverflow && deskItems.length > 0 && (
              <Pressable
                onPress={() => setExpanded(!expanded)}
                style={({ hovered }: any) => [styles.viewAllBar, hovered && styles.viewAllBarHover]}
              >
                <View style={styles.viewAllBarContent}>
                  <Ionicons
                    name={expanded ? 'chevron-up-outline' : 'list-outline'}
                    size={15}
                    color="#60A5FA"
                  />
                  <Text style={styles.viewAllText}>
                    {expanded ? 'Collapse' : 'View all tasks'}
                  </Text>
                  {!expanded && (
                    <View style={styles.viewAllCountBadge}>
                      <Text style={styles.viewAllCountText}>{deskItems.length}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            )}
          </View>
        </Animated.View>

        <Pressable
          onPress={goNext}
          style={({ hovered }: any) => [
            styles.deskArrowBtn,
            currentIndex === desks.length - 1 && styles.deskArrowDisabled,
            hovered && currentIndex < desks.length - 1 && styles.deskArrowHover,
          ]}
          disabled={currentIndex === desks.length - 1}
        >
          <Ionicons name="chevron-forward" size={22} color={currentIndex === desks.length - 1 ? '#333' : '#A1A1AA'} />
        </Pressable>
      </View>

      <View style={styles.deskDots}>
        {desks.map((d, i) => (
          <Pressable key={d} onPress={() => { if (i !== currentIndex) animateTransition(i, i > currentIndex ? 'right' : 'left'); }}>
            <View style={[styles.deskDot, i === currentIndex && styles.deskDotActive]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const getActionTypeIcon = (actionType: string): { icon: string; color: string } => {
  switch (actionType) {
    case 'money_move':
      return { icon: 'card', color: '#F59E0B' }; // Gold for payments
    case 'contract_send':
      return { icon: 'document-text', color: '#8B5CF6' }; // Purple for contracts
    case 'email_send':
      return { icon: 'mail', color: '#3B82F6' }; // Blue for emails
    case 'queue_complete':
      return { icon: 'checkmark-circle', color: '#34C759' }; // Green for completed
    case 'invite_member':
      return { icon: 'person-add', color: '#06B6D4' }; // Cyan for invites
    case 'suite_change':
      return { icon: 'business', color: '#EC4899' }; // Pink for suite changes
    case 'login':
      return { icon: 'log-in', color: '#6B7280' }; // Gray for logins
    case 'settings_change':
      return { icon: 'settings', color: '#6B7280' }; // Gray for settings
    default:
      return { icon: 'flash', color: '#A1A1AA' }; // Default gray
  }
};

function ReceiptsTab({ receipts }: { receipts: Receipt[] }) {
  const [actorFilter, setActorFilter] = useState<'all' | 'human' | 'aiDesk' | 'system'>('all');
  
  const filteredReceipts = receipts.filter(r => 
    actorFilter === 'all' || r.actorType === actorFilter
  );
  
  const blockedReceipts = receipts.filter(r => r.status === 'blocked');
  
  return (
    <View style={styles.tabScrollContent}>
      <View style={styles.contextToolbar}>
        <Text style={styles.tabSectionTitle}>Receipts</Text>
        <View style={styles.filterRow}>
          {(['all', 'human', 'aiDesk', 'system'] as const).map(filter => (
            <Pressable
              key={filter}
              style={({ hovered }: any) => [styles.filterChip, actorFilter === filter && styles.filterChipActive, hovered && actorFilter !== filter && styles.filterChipHover]}
              onPress={() => setActorFilter(filter)}
            >
              <Text style={[styles.filterChipText, actorFilter === filter && styles.filterChipTextActive]}>
                {filter === 'all' ? 'All' : filter === 'aiDesk' ? 'AI Desk' : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
            </Pressable>
          ))}
          <Pressable style={({ hovered }: any) => [styles.exportBtn, hovered && styles.exportBtnHover]}>
            <Ionicons name="download-outline" size={16} color="rgba(255,255,255,0.7)" />
            <Text style={styles.exportBtnText}>Export</Text>
          </Pressable>
        </View>
      </View>
      
      <View style={styles.glassmorphismCard}>
        <View style={styles.receiptsList}>
          {filteredReceipts.map(receipt => {
            const actionIcon = getActionTypeIcon(receipt.actionType);
            return (
              <View key={receipt.id} style={styles.receiptCard}>
                <View style={styles.receiptHeader}>
                  <View style={styles.receiptLeft}>
                    <Ionicons 
                      name={actionIcon.icon as any} 
                      size={20} 
                      color={actionIcon.color} 
                    />
                    <View style={styles.receiptInfo}>
                      <Text style={styles.receiptSummary}>{receipt.summary}</Text>
                      <Text style={styles.receiptActorName}>{receipt.actorName}</Text>
                    </View>
                  </View>
                  <View style={[
                    styles.receiptStatus,
                    receipt.status === 'executed' && styles.receiptStatusSuccess,
                    receipt.status === 'blocked' && styles.receiptStatusBlocked,
                    receipt.status === 'approved' && styles.receiptStatusApproved,
                  ]}>
                    <Text style={styles.receiptStatusText}>{receipt.status}</Text>
                  </View>
                </View>
                <View style={styles.receiptFooter}>
                  <Text style={styles.receiptTime}>{formatTimeAgo(receipt.timestamp)}</Text>
                  {receipt.approverName && (
                    <Text style={styles.receiptApprover}>Approved by {receipt.approverName}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
        
        {blockedReceipts.length > 0 && (
          <View style={styles.blockedSection}>
            <View style={styles.blockedHeader}>
              <Ionicons name="alert-circle" size={18} color={Colors.semantic.error} />
              <Text style={styles.blockedTitle}>Blocked Actions</Text>
            </View>
            {blockedReceipts.map(receipt => (
              <View key={receipt.id} style={styles.blockedItem}>
                <Text style={styles.blockedSummary}>{receipt.summary}</Text>
                <Text style={styles.blockedTime}>{formatTimeAgo(receipt.timestamp)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function UsageTab({ suiteUsage, memberUsage }: { suiteUsage: UsageLedger; memberUsage: UsageLedger[] }) {
  const [now, setNow] = useState(new Date());
  const barAnims = useRef(
    Array.from({ length: 7 }, () => new Animated.Value(0))
  ).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1200, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const usageCards = [
    { icon: 'flash' as const, title: 'Actions', used: suiteUsage.actionsUsed, limit: suiteUsage.actionsLimit },
    { icon: 'call' as const, title: 'Phone In', used: suiteUsage.phoneInboundMins, limit: suiteUsage.phoneInboundLimit, unit: 'min' },
    { icon: 'arrow-redo' as const, title: 'Phone Out', used: suiteUsage.phoneOutboundMins, limit: suiteUsage.phoneOutboundLimit, unit: 'min' },
    { icon: 'chatbubble-ellipses' as const, title: 'SMS', used: suiteUsage.smsSegments, limit: suiteUsage.smsLimit, unit: 'seg' },
    { icon: 'mic' as const, title: 'Voice', used: suiteUsage.voiceMins, limit: suiteUsage.voiceLimit, unit: 'min' },
    { icon: 'videocam' as const, title: 'Video', used: suiteUsage.videoMins, limit: suiteUsage.videoLimit, unit: 'min' },
    { icon: 'people' as const, title: 'Conferences', used: suiteUsage.conferenceSessions, limit: suiteUsage.conferenceSessionsLimit },
  ];

  useEffect(() => {
    usageCards.forEach((card, i) => {
      const percent = Math.min((card.used / card.limit) * 100, 100);
      Animated.timing(barAnims[i], {
        toValue: percent,
        duration: 900,
        delay: i * 80,
        useNativeDriver: false,
      }).start();
    });
  }, [suiteUsage]);

  const formatTime = (d: Date) => {
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m} ${ampm}`;
  };

  return (
    <View style={styles.tabScrollContent}>
      <View style={styles.contextToolbar}>
        <Text style={styles.tabSectionTitle}>Usage & Billing</Text>
        <View style={styles.usageLiveRow}>
          <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
          <Text style={styles.liveLabel}>Live</Text>
          <Text style={styles.usageUpdatedAt}>Updated {formatTime(now)}</Text>
        </View>
      </View>
      
      <View style={styles.glassmorphismCard}>
        <View style={styles.usageGrid}>
          {usageCards.map((card, i) => {
            const percent = (card.used / card.limit) * 100;
            const isWarning = percent >= 75;
            const isCritical = percent >= 90;
            const barWidth = barAnims[i].interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            });
            
            return (
              <View key={i} style={styles.usageCard}>
                <View style={styles.usageCardHeader}>
                  <View style={[styles.usageIconWrap, isCritical ? styles.usageIconCritical : isWarning ? styles.usageIconWarning : styles.usageIconNormal]}>
                    <Ionicons name={card.icon} size={15} color={isCritical ? '#EF4444' : isWarning ? '#F59E0B' : '#3B82F6'} />
                  </View>
                  <Text style={styles.usageCardTitle}>{card.title}</Text>
                </View>
                <View style={styles.usageNumbers}>
                  <Text style={styles.usageUsed}>{card.used}</Text>
                  <Text style={styles.usageLimit}>/ {card.limit} {card.unit || ''}</Text>
                </View>
                <View style={styles.usageBar}>
                  <Animated.View 
                    style={[
                      styles.usageBarFill, 
                      { width: barWidth as any },
                      isWarning && styles.usageBarWarning,
                      isCritical && styles.usageBarCritical,
                    ]} 
                  />
                </View>
                <Text style={[styles.usagePercent, isCritical && { color: '#EF4444' }, isWarning && !isCritical && { color: '#F59E0B' }]}>
                  {Math.round(percent)}% used
                </Text>
              </View>
            );
          })}
        </View>
        
        <View style={styles.memberUsageSection}>
          <Text style={styles.sectionTitle}>Usage by Member</Text>
          <View style={styles.memberUsageTable}>
            <View style={styles.memberUsageHeader}>
              <Text style={[styles.memberUsageHeaderCell, { flex: 2.5 }]}>Member</Text>
              <Text style={[styles.memberUsageHeaderCell, { flex: 1 }]}>Actions</Text>
              <Text style={[styles.memberUsageHeaderCell, { flex: 1 }]}>Phone</Text>
              <Text style={[styles.memberUsageHeaderCell, { flex: 1 }]}>Voice</Text>
              <Text style={[styles.memberUsageHeaderCell, { flex: 1 }]}>Video</Text>
            </View>
            {memberUsage.map(member => (
              <View key={member.memberId} style={styles.memberUsageRow}>
                <View style={[styles.memberUsageMemberCell, { flex: 2.5 }]}>
                  <Image 
                    source={avatarImages[member.memberId || ''] || avatarImages['member_1']} 
                    style={styles.usageMemberAvatar} 
                  />
                  <View>
                    <Text style={styles.usageMemberName}>{member.memberName}</Text>
                    <Text style={styles.usageMemberRole}>
                      {member.memberId === 'member_1' ? 'Owner' : member.memberId === 'member_2' ? 'Admin' : 'Member'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.memberUsageCell, { flex: 1 }]}>{member.actionsUsed}</Text>
                <Text style={[styles.memberUsageCell, { flex: 1 }]}>{member.phoneInboundMins + member.phoneOutboundMins}m</Text>
                <Text style={[styles.memberUsageCell, { flex: 1 }]}>{member.voiceMins}m</Text>
                <Text style={[styles.memberUsageCell, { flex: 1 }]}>{member.videoMins}m</Text>
              </View>
            ))}
          </View>
        </View>
        
        <View style={styles.addOnsSection}>
          <Text style={styles.sectionTitle}>Add-ons</Text>
          <View style={styles.addOnsGrid}>
            <View style={styles.addOnCard}>
              <View style={styles.addOnIconPremium}>
                <Ionicons name="person-add" size={22} color="#3B82F6" />
              </View>
              <View style={styles.addOnInfo}>
                <Text style={styles.addOnTitle}>Team Member Seat</Text>
                <Text style={styles.addOnDescription}>Add another team member to your suite</Text>
                <Text style={styles.addOnPriceInline}>${pricing.teamMemberSeat}/mo</Text>
              </View>
              <Pressable style={({ hovered }: any) => [styles.addOnBtn, hovered && styles.addOnBtnHover]}>
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.addOnBtnGradient}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.addOnBtnText}>Add Seat</Text>
                </LinearGradient>
              </Pressable>
            </View>
            <View style={styles.addOnCard}>
              <View style={styles.addOnIconPremium}>
                <Ionicons name="business" size={22} color="#3B82F6" />
              </View>
              <View style={styles.addOnInfo}>
                <Text style={styles.addOnTitle}>Additional Suite</Text>
                <Text style={styles.addOnDescription}>Create another business identity</Text>
                <Text style={styles.addOnPriceInline}>${pricing.secondSuite}/mo</Text>
              </View>
              <Pressable style={({ hovered }: any) => [styles.addOnBtn, hovered && styles.addOnBtnHover]}>
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.addOnBtnGradient}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.addOnBtnText}>Add Suite</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function InviteModal({ 
  visible, 
  onClose,
  suites,
}: { 
  visible: boolean; 
  onClose: () => void;
  suites: Suite[];
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<RoleType>('member');
  const [selectedSuites, setSelectedSuites] = useState<string[]>([suites[0]?.id]);
  const [requiresApproval, setRequiresApproval] = useState(true);
  
  const toggleSuite = (suiteId: string) => {
    setSelectedSuites(prev => 
      prev.includes(suiteId) 
        ? prev.filter(id => id !== suiteId)
        : [...prev, suiteId]
    );
  };
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Invite Team Member</Text>
            <Pressable 
              style={({ hovered }: any) => [styles.modalClose, hovered && styles.modalCloseHover]}
              onPress={onClose}
            >
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>
          
          <ScrollView style={styles.modalBody}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Email</Text>
              <TextInput
                style={styles.formInput}
                value={email}
                onChangeText={setEmail}
                placeholder="colleague@company.com"
                placeholderTextColor="rgba(255,255,255,0.5)"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Name</Text>
              <TextInput
                style={styles.formInput}
                value={name}
                onChangeText={setName}
                placeholder="Full Name"
                placeholderTextColor="rgba(255,255,255,0.5)"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Role</Text>
              <View style={styles.roleOptions}>
                {(['admin', 'member', 'viewer'] as RoleType[]).map(r => (
                  <Pressable
                    key={r}
                    style={[styles.roleOption, role === r && styles.roleOptionActive]}
                    onPress={() => setRole(r)}
                  >
                    <Text style={[styles.roleOptionText, role === r && styles.roleOptionTextActive]}>
                      {getRoleName(r)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Suite Access</Text>
              {suites.map(suite => (
                <Pressable
                  key={suite.id}
                  style={styles.suiteCheckbox}
                  onPress={() => toggleSuite(suite.id)}
                >
                  <View style={[styles.checkbox, selectedSuites.includes(suite.id) && styles.checkboxChecked]}>
                    {selectedSuites.includes(suite.id) && (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    )}
                  </View>
                  <Text style={styles.suiteCheckboxLabel}>{suite.name}</Text>
                </Pressable>
              ))}
            </View>
            
            <View style={styles.approvalToggle}>
              <View style={[styles.toggleSwitch, requiresApproval && styles.toggleSwitchOn]}>
                <Pressable onPress={() => setRequiresApproval(!requiresApproval)}>
                  <View style={[styles.toggleKnob, requiresApproval && styles.toggleKnobOn]} />
                </Pressable>
              </View>
              <Text style={styles.approvalToggleLabel}>Require owner approval before access</Text>
            </View>
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <Pressable 
              style={({ hovered }: any) => [styles.cancelBtn, hovered && styles.cancelBtnHover]}
              onPress={onClose}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={({ hovered }: any) => [styles.submitBtn, hovered && styles.submitBtnHover]}>
              <Ionicons name="send" size={16} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>Send Invite</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function isOverdue(dueAt?: string): boolean {
  if (!dueAt) return false;
  return new Date(dueAt) < new Date();
}

function getActionIcon(actionType: ActionType): any {
  switch (actionType) {
    case 'email_send': return 'mail';
    case 'contract_send': return 'document-text';
    case 'money_move': return 'cash';
    case 'invite_member': return 'person-add';
    case 'suite_change': return 'business';
    default: return 'flash';
  }
}

export default function TeamWorkspacePage() {
  const isDesktop = useDesktop();
  const { profile } = useTenant();
  const [selectedSuiteId, setSelectedSuiteId] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('people');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [suites, setSuites] = useState<Suite[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [approvalRules, setApprovalRules] = useState<ApprovalRule[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [suiteUsage, setSuiteUsage] = useState<UsageLedger>(EMPTY_USAGE);
  const [memberUsage, setMemberUsage] = useState<UsageLedger[]>([]);

  // Build currentUser from tenant profile
  const currentUser: Member | null = profile ? {
    id: profile.id ?? '',
    name: profile.business_name ?? profile.full_name ?? 'User',
    email: '',
    roleId: 'owner' as RoleType,
    status: 'active' as const,
    suiteAccessIds: profile.suite_id ? [profile.suite_id] : [],
    lastActiveAt: new Date().toISOString(),
  } : null;

  useEffect(() => {
    // Fetch team data from Supabase
    const fetchData = async () => {
      try {
        // Fetch suite members
        const { data: memberRows } = await supabase
          .from('suite_members')
          .select('id, user_id, full_name, email, role, status, created_at');
        if (memberRows) {
          setMembers(memberRows.map((r: any) => ({
            id: r.user_id ?? r.id,
            name: r.full_name ?? 'Team Member',
            email: r.email ?? '',
            roleId: (r.role ?? 'member') as RoleType,
            status: r.status ?? 'active',
            suiteAccessIds: [],
            lastActiveAt: r.created_at ?? new Date().toISOString(),
          })));
        }
        // Fetch approval requests
        const { data: approvalRows } = await supabase
          .from('approval_requests')
          .select('*')
          .order('created_at', { ascending: false });
        if (approvalRows) {
          setApprovalRequests(approvalRows.map((r: any) => ({
            id: r.id ?? r.request_id,
            actionType: r.action_type ?? 'email_send',
            createdBy: r.actor ?? '',
            createdByName: r.actor_name ?? 'Unknown',
            assignedToRole: (r.assigned_to_role ?? 'member') as RoleType,
            status: r.status ?? 'pending',
            createdAt: r.created_at ?? new Date().toISOString(),
            dueAt: r.due_at,
            payloadSummary: r.payload_summary ?? r.title ?? '',
            requiresVideo: r.requires_video ?? false,
            suiteId: r.suite_id ?? '',
          })));
        }
        // Fetch receipts for the workspace view
        const { data: receiptRows } = await supabase
          .from('receipts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        if (receiptRows) {
          setReceipts(receiptRows.map((r: any) => ({
            id: r.id,
            actionType: r.action_type ?? 'email_send',
            actorId: r.actor ?? '',
            actorName: r.actor_name ?? 'System',
            actorType: (r.actor_type ?? 'system') as ActorType,
            suiteId: r.suite_id ?? '',
            status: r.outcome ?? 'executed',
            timestamp: r.created_at ?? new Date().toISOString(),
            summary: r.summary ?? r.action_type ?? '',
            approverId: r.approver_id,
            approverName: r.approver_name,
          })));
        }
        // Set suite from profile
        if (profile?.suite_id) {
          setSelectedSuiteId(profile.suite_id);
          setSuites([{
            id: profile.suite_id,
            name: profile.business_name ?? 'My Suite',
            suiteNumber: '1001',
            isActive: true,
            createdAt: new Date().toISOString(),
          }]);
        }
      } catch (e) {
        console.warn('Failed to load team workspace data:', e);
      }
    };
    fetchData();
  }, [profile]);
  
  const pendingApprovals = approvalRequests.filter(r => r.status === 'pending').length;
  
  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'people', label: 'People', icon: 'people' },
    { id: 'approvals', label: 'Approvals', icon: 'checkmark-circle' },
    { id: 'queues', label: 'Queues', icon: 'list' },
    { id: 'receipts', label: 'Receipts', icon: 'receipt' },
    { id: 'usage', label: 'Usage', icon: 'analytics' },
  ];
  
  const handleApprove = (id: string) => {
    setApprovalRequests(prev => 
      prev.map(r => r.id === id ? { ...r, status: 'approved' as const } : r)
    );
  };
  
  const handleReject = (id: string) => {
    setApprovalRequests(prev => 
      prev.map(r => r.id === id ? { ...r, status: 'rejected' as const } : r)
    );
  };
  
  const handleAssign = (itemId: string, memberId: string) => {
    const member = members.find(m => m.id === memberId);
    setQueueItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, assigneeId: memberId, assigneeName: member?.name, status: 'in_progress' as const }
          : item
      )
    );
  };
  
  const content = (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
      <ImageBackground source={teamWorkspaceHero} style={styles.headerBanner} imageStyle={styles.headerBannerImage}>
        <LinearGradient
          colors={['rgba(10, 10, 10, 0.35)', 'rgba(10, 10, 10, 0.65)']}
          style={styles.headerOverlay}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <LinearGradient colors={[Colors.accent.cyan, Colors.accent.cyanDark]} style={styles.headerIconWrap}>
                <Ionicons name="people" size={24} color="#fff" />
              </LinearGradient>
              <View style={{ marginLeft: 16 }}>
                <Text style={styles.headerTitle}>Team Workspace</Text>
                <Text style={styles.headerSubtitle}>
                  {members.length} members · {suites.length} suite{suites.length > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>

      <View style={styles.tabBar}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const count = tab.id === 'people' ? members.length
            : tab.id === 'approvals' ? approvalRequests.filter(r => r.status === 'pending').length
            : tab.id === 'queues' ? queueItems.length
            : tab.id === 'receipts' ? receipts.filter(r => r.suiteId === selectedSuiteId).length
            : 0;
          return (
            <TouchableOpacity key={tab.id} onPress={() => setActiveTab(tab.id)} activeOpacity={0.7}>
              {isActive ? (
                <LinearGradient colors={[Colors.accent.cyan, Colors.accent.cyanDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tabActiveGradient}>
                  <Ionicons name={tab.icon as any} size={18} color="#fff" />
                  <Text style={styles.tabTextActive}>{tab.label}</Text>
                  {count > 0 && (
                    <View style={styles.tabBadgeActive}>
                      <Text style={styles.tabBadgeTextActive}>{count}</Text>
                    </View>
                  )}
                  <View style={styles.tabGlowBorder} />
                </LinearGradient>
              ) : (
                <View style={styles.tabInactive}>
                  <Ionicons name={tab.icon as any} size={18} color={Colors.text.tertiary} />
                  <Text style={styles.tabTextInactive}>{tab.label}</Text>
                  {count > 0 && (
                    <View style={styles.tabBadgeInactive}>
                      <Text style={styles.tabBadgeTextInactive}>{count}</Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      
      <View style={styles.contentArea}>
        {activeTab === 'people' && (
          <PeopleTab
            members={members}
            invites={invites}
            onInvite={() => setShowInviteModal(true)}
            seatCount={{ used: members.length, available: 5 }}
            currentUser={currentUser}
          />
        )}
        {activeTab === 'approvals' && (
          <ApprovalsTab
            requests={approvalRequests}
            rules={approvalRules}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}
        {activeTab === 'queues' && (
          <QueuesTab
            items={queueItems.filter(i => i.suiteId === selectedSuiteId)}
            members={members}
            onAssign={handleAssign}
          />
        )}
        {activeTab === 'receipts' && (
          <ReceiptsTab receipts={receipts.filter(r => r.suiteId === selectedSuiteId)} />
        )}
        {activeTab === 'usage' && (
          <UsageTab
            suiteUsage={suiteUsage}
            memberUsage={memberUsage}
          />
        )}
      </View>
      </ScrollView>
      
      <InviteModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        suites={suites}
      />
    </View>
  );
  
  if (isDesktop) {
    return (
      <DesktopPageWrapper scrollable={false}>
        {content}
      </DesktopPageWrapper>
    );
  }
  
  return content;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    height: '100%',
  },
  
  headerBanner: {
    height: 130,
    overflow: 'hidden',
  },
  headerBannerImage: {
    resizeMode: 'cover',
  },
  headerOverlay: {
    flex: 1,
    paddingHorizontal: 48,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.glow(Colors.accent.cyan),
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 48,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    gap: 6,
  },
  tabActiveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    position: 'relative',
    gap: 6,
  },
  tabInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 6,
  },
  tabTextActive: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  tabTextInactive: {
    fontSize: 13,
    color: Colors.text.tertiary,
    fontWeight: '500',
  },
  tabBadgeActive: {
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
    marginLeft: 2,
  },
  tabBadgeTextActive: {
    fontSize: 10,
    color: Colors.accent.cyanDark,
    fontWeight: '700',
  },
  tabBadgeInactive: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
    marginLeft: 2,
  },
  tabBadgeTextInactive: {
    fontSize: 10,
    color: Colors.text.muted,
  },
  tabGlowBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.accent.cyan,
    ...Shadows.glow(Colors.accent.cyan),
  },
  
  contentArea: {},
  
  tabScrollContent: {
    paddingHorizontal: 48,
    paddingTop: 24,
    paddingBottom: 48,
  },
  
  contextToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 16,
    zIndex: 100,
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  
  seatCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  seatText: {
    fontSize: 14,
    color: '#D4D4D8',
  },
  seatUsed: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  
  tabContent: {
    flex: 1,
    paddingHorizontal: 48,
    paddingTop: 24,
    paddingBottom: 48,
  },
  tabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tabTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tabSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tabActions: {
    flexDirection: 'row',
    gap: 12,
  },
  periodLabel: {
    fontSize: 14,
    color: '#A1A1AA',
  },
  emptySubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
  },
  filterChipHover: {
    backgroundColor: '#242426',
  },
  
  glassmorphismCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    padding: 24,
  },
  
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnHover: {
    opacity: 0.9,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  secondaryBtnHover: {
    backgroundColor: '#242426',
    borderColor: 'rgba(59,130,246,0.3)',
  },
  secondaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
  },
  btnIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(59,130,246,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pricePill: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 4,
  },
  pricePillText: {
    fontSize: 11,
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  officeNumberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(59,130,246,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  officeNumberText: {
    fontSize: 13,
    color: Colors.accent.cyan,
    fontWeight: '500',
  },
  
  tableContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: 80,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  tableRowHover: {
    backgroundColor: '#141414',
    borderColor: '#2C2C2E',
  },
  pendingRow: {
    backgroundColor: '#141414',
  },
  tableCell: {
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  cellTextMuted: {
    fontSize: 13,
    color: '#A1A1AA',
  },
  
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingAvatar: {
    backgroundColor: '#242426',
  },
  memberAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(59,130,246,1)',
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  memberEmail: {
    fontSize: 13,
    color: '#A1A1AA',
    marginTop: 2,
  },
  
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  status_active: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  status_pending: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  status_suspended: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  statusDotActive: {
    backgroundColor: Colors.semantic.success,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)',
    } : {}),
  },
  statusText: {
    fontSize: 13,
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  
  actionBtn: {
    padding: 8,
    borderRadius: 8,
  },
  actionBtnHover: {
    backgroundColor: '#242426',
  },
  
  countBadge: {
    backgroundColor: Colors.semantic.error,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  
  approvalList: {
    gap: 16,
  },
  approvalCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  approvalCardInner: {
    flexDirection: 'row',
  },
  approvalThumbnailWrap: {
    width: 140,
    position: 'relative',
    overflow: 'hidden',
  },
  approvalThumbnail: {
    width: 140,
    height: '100%',
    minHeight: 140,
  } as any,
  approvalThumbnailOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
  },
  approvalThumbnailBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  approvalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  approvalTypeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  approvalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  videoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(59,130,246,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.25)',
  },
  videoBadgeText: {
    fontSize: 11,
    color: '#60A5FA',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  slaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#242426',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  slaBadgeUrgent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  slaBadgeText: {
    fontSize: 11,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  slaBadgeUrgentText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  approvalSummary: {
    fontSize: 14,
    color: '#D4D4D8',
    marginBottom: 14,
    lineHeight: 21,
  },
  approvalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  approvalCreatorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  approvalCreatorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  approvalCreatorAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalCreatorAvatarText: {
    fontSize: 11,
    color: '#A1A1AA',
    fontWeight: '600',
  },
  approvalCreator: {
    fontSize: 13,
    color: '#A1A1AA',
  },
  approvalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#1C1C1E',
  },
  rejectBtnHover: {
    backgroundColor: '#242426',
    borderColor: '#444',
  },
  rejectBtnText: {
    fontSize: 13,
    color: '#A1A1AA',
    fontWeight: '600',
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 10,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  approveBtnHover: {
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  approveBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  
  rulesMatrix: {
    gap: 16,
  },
  rulesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rulesSubtitle: {
    fontSize: 14,
    color: '#A1A1AA',
    marginBottom: 16,
  },
  rulesTable: {
    borderWidth: 1,
    borderColor: '#2C2C2E',
    borderRadius: 12,
    overflow: 'hidden',
  },
  rulesHeader: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rulesHeaderCell: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  rulesRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
  },
  rulesCell: {
    fontSize: 14,
    color: '#D4D4D8',
  },
  rulesCellView: {
    justifyContent: 'center',
  },
  
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2C2C2E',
    padding: 2,
  },
  toggleSwitchOn: {
    backgroundColor: 'rgba(59,130,246,1)',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  toggleKnobOn: {
    marginLeft: 20,
  },
  
  deskCarouselContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  deskArrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deskArrowDisabled: {
    opacity: 0.35,
  },
  deskArrowHover: {
    backgroundColor: '#242426',
    borderColor: '#3B82F6',
  },
  deskCardWrapper: {
    flex: 1,
    maxWidth: 700,
    alignSelf: 'center',
    width: '100%',
  },
  deskCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    overflow: 'hidden',
  },
  deskCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingBottom: 20,
  },
  deskCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  deskStaffAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#2C2C2E',
  },
  deskStaffIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2C2C2E',
  },
  deskHeaderInfo: {
    gap: 2,
  },
  deskStaffName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  deskName: {
    fontSize: 14,
    color: '#71717A',
    fontWeight: '500',
  },
  deskHeaderRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  deskPendingBadge: {
    backgroundColor: 'rgba(59,130,246,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  deskPendingText: {
    fontSize: 12,
    color: '#60A5FA',
    fontWeight: '600',
  },
  deskCounter: {
    fontSize: 12,
    color: '#52525B',
    fontWeight: '500',
  },
  deskDivider: {
    height: 1,
    backgroundColor: '#1E1E20',
    marginHorizontal: 24,
  },
  deskItemsList: {
    padding: 16,
    paddingTop: 8,
    minHeight: 220,
  },
  deskQueueItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E20',
    borderRadius: 10,
  },
  deskQueueItemHover: {
    backgroundColor: '#1A1A1C',
  },
  deskQueueItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  deskQueueItemContent: {
    flex: 1,
  },
  deskQueueItemSummary: {
    fontSize: 14,
    color: '#D4D4D8',
    lineHeight: 21,
    marginBottom: 6,
  },
  deskQueueItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  deskQueueItemAge: {
    fontSize: 12,
    color: '#52525B',
  },
  deskQueueAssignee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  deskQueueAssigneeName: {
    fontSize: 12,
    color: '#71717A',
  },
  deskAssignLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deskAssignLinkHover: {
    opacity: 0.7,
  },
  deskAssignLinkText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
  },
  viewAllBar: {
    borderTopWidth: 1,
    borderTopColor: '#1E1E20',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#111113',
  },
  viewAllBarHover: {
    backgroundColor: '#161618',
  },
  viewAllBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  viewAllText: {
    fontSize: 13,
    color: '#60A5FA',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  viewAllCountBadge: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  viewAllCountText: {
    fontSize: 11,
    color: '#60A5FA',
    fontWeight: '700',
  },
  deskDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  deskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2C2C2E',
  },
  deskDotActive: {
    backgroundColor: '#3B82F6',
    width: 24,
    borderRadius: 4,
  },
  queueEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 10,
  },
  queueEmptyText: {
    fontSize: 15,
    color: '#52525B',
    fontWeight: '500',
  },
  queueEmptySubtext: {
    fontSize: 13,
    color: '#3F3F46',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 7,
  },
  priority_low: {
    backgroundColor: '#52525B',
  },
  priority_medium: {
    backgroundColor: '#3B82F6',
  },
  priority_high: {
    backgroundColor: '#F59E0B',
  },
  priority_urgent: {
    backgroundColor: Colors.semantic.error,
  },
  
  delegationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  delegationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  delegationText: {
    gap: 4,
  },
  delegationTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  delegationSubtitle: {
    fontSize: 14,
    color: '#D4D4D8',
  },
  delegationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(59,130,246,1)',
  },
  delegationBtnHover: {
    opacity: 0.9,
  },
  delegationBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  filterChipActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  filterChipText: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  filterChipTextActive: {
    color: 'rgba(59,130,246,1)',
    fontWeight: '500',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  exportBtnHover: {
    backgroundColor: '#1E1E20',
  },
  exportBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  receiptsList: {
    gap: 12,
  },
  receiptCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  receiptLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  receiptInfo: {
    flex: 1,
    gap: 4,
  },
  receiptActorName: {
    fontSize: 13,
    color: '#A1A1AA',
  },
  receiptStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#242426',
  },
  receiptStatusSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  receiptStatusBlocked: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  receiptStatusApproved: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  receiptStatusText: {
    fontSize: 12,
    color: '#FFFFFF',
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  receiptSummary: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    lineHeight: 20,
  },
  receiptFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  receiptTime: {
    fontSize: 13,
    color: '#A1A1AA',
  },
  receiptApprover: {
    fontSize: 13,
    color: '#A1A1AA',
  },
  blockedSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },
  blockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  blockedTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.semantic.error,
  },
  blockedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(239, 68, 68, 0.1)',
  },
  blockedSummary: {
    fontSize: 14,
    color: '#D4D4D8',
  },
  blockedTime: {
    fontSize: 13,
    color: '#A1A1AA',
  },
  
  usageLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  liveLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#22C55E',
  },
  usageUpdatedAt: {
    fontSize: 12,
    color: '#52525B',
    marginLeft: 4,
  },
  usageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32,
  },
  usageCard: {
    width: 180,
    backgroundColor: '#141416',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E1E20',
  },
  usageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  usageIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usageIconNormal: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  usageIconWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  usageIconCritical: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  usageCardTitle: {
    fontSize: 14,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  usageNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 12,
  },
  usageUsed: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  usageLimit: {
    fontSize: 14,
    color: '#52525B',
  },
  usageBar: {
    height: 6,
    backgroundColor: '#1E1E20',
    borderRadius: 3,
    overflow: 'hidden',
  },
  usageBarFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 3,
  },
  usageBarWarning: {
    backgroundColor: '#F59E0B',
  },
  usageBarCritical: {
    backgroundColor: '#EF4444',
  },
  usagePercent: {
    fontSize: 12,
    color: '#52525B',
    marginTop: 8,
    fontWeight: '500',
  },
  
  memberUsageSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  memberUsageTable: {
    borderWidth: 1,
    borderColor: '#1E1E20',
    borderRadius: 14,
    overflow: 'hidden',
  },
  memberUsageHeader: {
    flexDirection: 'row',
    backgroundColor: '#141416',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  memberUsageHeaderCell: {
    fontSize: 11,
    fontWeight: '600',
    color: '#52525B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  memberUsageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E1E20',
  },
  memberUsageMemberCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  usageMemberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#2C2C2E',
  },
  usageMemberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  usageMemberRole: {
    fontSize: 12,
    color: '#52525B',
    marginTop: 1,
  },
  memberUsageCell: {
    fontSize: 14,
    color: '#D4D4D8',
    fontWeight: '500',
  },
  
  addOnsSection: {
    gap: 16,
  },
  addOnsGrid: {
    gap: 14,
  },
  addOnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    backgroundColor: '#141416',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: '#1E1E20',
  },
  addOnIconPremium: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addOnInfo: {
    flex: 1,
    gap: 3,
  },
  addOnTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addOnDescription: {
    fontSize: 13,
    color: '#71717A',
  },
  addOnPriceInline: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3B82F6',
    marginTop: 2,
  },
  addOnBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  addOnBtnHover: {
    opacity: 0.9,
  },
  addOnBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addOnBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addOnPrice: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 15,
    color: '#A1A1AA',
  },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#0a0a0a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3C3C3E',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalClose: {
    padding: 8,
    borderRadius: 10,
  },
  modalCloseHover: {
    backgroundColor: '#242426',
  },
  modalBody: {
    padding: 20,
    maxHeight: 420,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  formInput: {
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#3C3C3E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
  },
  roleOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    alignItems: 'center',
  },
  roleOptionActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  roleOptionText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  roleOptionTextActive: {
    color: 'rgba(59,130,246,1)',
    fontWeight: '500',
  },
  suiteCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: 'rgba(59,130,246,1)',
    borderColor: 'rgba(59,130,246,1)',
  },
  suiteCheckboxLabel: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  approvalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  approvalToggleLabel: {
    fontSize: 14,
    color: '#D4D4D8',
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  cancelBtnHover: {
    backgroundColor: '#1C1C1E',
  },
  cancelBtnText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(59,130,246,1)',
  },
  submitBtnHover: {
    opacity: 0.9,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
