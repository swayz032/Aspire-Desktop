import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable, ScrollView, Image, ImageBackground, ViewStyle } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  interpolate,
  Extrapolation
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { Toast } from '@/components/session/Toast';
import { BottomSheet } from '@/components/session/BottomSheet';
import { DocumentThumbnail } from '@/components/DocumentThumbnail';
import { 
  SessionPurpose,
  MEMBER_DIRECTORY,
} from '@/data/session';
import { useDesktop } from '@/lib/useDesktop';
import { FullscreenSessionShell } from '@/components/desktop/FullscreenSessionShell';

const CONFERENCE_ROOM_IMAGE = require('@/assets/images/conference-room-meeting.jpg');
const TEAM_MEETING_IMAGE = require('@/assets/images/executive-conference.jpg');
const NORA_AVATAR = require('@/assets/images/nora-avatar.png');

const PURPOSE_OPTIONS: { id: SessionPurpose; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'Internal', label: 'Internal', icon: 'business' },
  { id: 'Client Call', label: 'Client', icon: 'person' },
  { id: 'Vendor Call', label: 'Vendor', icon: 'storefront' },
  { id: 'Deal Review', label: 'Deal', icon: 'briefcase' },
  { id: 'Networking', label: 'Network', icon: 'people' },
];

const MENU_OPTIONS = [
  { id: 'settings', label: 'Room Settings', icon: 'settings' as const },
  { id: 'schedule', label: 'Schedule for Later', icon: 'calendar' as const },
  { id: 'copy-link', label: 'Copy Meeting Link', icon: 'link' as const },
];

interface Participant {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  status: 'ready' | 'invited' | 'joining';
}

interface AuthorityItem {
  id: string;
  title: string;
  description: string;
  risk: 'Low' | 'Medium' | 'High';
  status: 'pending' | 'approved' | 'denied';
  documentName?: string;
  documentType?: 'invoice' | 'contract' | 'report' | 'document' | 'recording';
  icon: keyof typeof Ionicons.glyphMap;
}

const AUTHORITY_QUEUE: AuthorityItem[] = [
  {
    id: 'auth-1',
    title: 'Share Q4 Financial Summary',
    description: 'Share financial documents with meeting participants',
    risk: 'Medium',
    status: 'pending',
    documentName: 'Q4_Financial_Report.pdf',
    documentType: 'report',
    icon: 'bar-chart',
  },
  {
    id: 'auth-2',
    title: 'Record Meeting Transcript',
    description: 'Auto-transcription with AI summarization',
    risk: 'Low',
    status: 'pending',
    documentType: 'recording',
    icon: 'mic',
  },
  {
    id: 'auth-3',
    title: 'Share Project Proposal',
    description: 'Send proposal to external client for review',
    risk: 'High',
    status: 'pending',
    documentName: 'Project_Proposal_v2.pdf',
    documentType: 'document',
    icon: 'document-text',
  },
  {
    id: 'auth-4',
    title: 'Execute NDA Agreement',
    description: 'Digital signature for mutual NDA',
    risk: 'Medium',
    status: 'pending',
    documentName: 'Mutual_NDA_2024.pdf',
    documentType: 'contract',
    icon: 'shield-checkmark',
  },
];

const getRiskConfig = (risk: AuthorityItem['risk']) => {
  switch (risk) {
    case 'High':
      return { color: Colors.semantic.error, bg: 'rgba(239, 68, 68, 0.12)' };
    case 'Medium':
      return { color: Colors.semantic.warning, bg: 'rgba(245, 158, 11, 0.12)' };
    case 'Low':
      return { color: Colors.semantic.success, bg: 'rgba(52, 199, 89, 0.12)' };
  }
};

export default function ConferenceLobby() {
  const router = useRouter();
  const isDesktop = useDesktop();
  
  const [purpose, setPurpose] = useState<SessionPurpose>('Internal');
  const [participants, setParticipants] = useState<Participant[]>([
    { id: 'you', name: 'Marcus Chen', role: 'Founder', avatarColor: Colors.accent.cyan, status: 'ready' },
  ]);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [authorityItems, setAuthorityItems] = useState(AUTHORITY_QUEUE);
  
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  
  const [showStartSessionModal, setShowStartSessionModal] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const flipProgress = useSharedValue(0);

  // Sync animation with state - single source of truth
  // Slower, smoother rotation for premium feel
  useEffect(() => {
    flipProgress.value = withSpring(isSessionActive ? 1 : 0, {
      damping: 25,
      stiffness: 30,
      mass: 1.5,
    });
  }, [isSessionActive]);

  const toggleFlip = () => {
    setIsSessionActive(prev => !prev);
  };

  // Front card animated style - rotates from 0 to -180 degrees (vertical flip)
  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateX = interpolate(
      flipProgress.value,
      [0, 1],
      [0, -180],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { rotateX: `${rotateX}deg` },
      ],
      backfaceVisibility: 'hidden' as const,
    };
  });

  // Back card animated style - rotates from 180 to 0 degrees
  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateX = interpolate(
      flipProgress.value,
      [0, 1],
      [180, 0],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { rotateX: `${rotateX}deg` },
      ],
      backfaceVisibility: 'hidden' as const,
    };
  });


  // Arrow rotation follows flip
  const arrowAnimatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      flipProgress.value,
      [0, 1],
      [0, 180],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ rotate: `${rotate}deg` }],
    };
  });

  const handleStartNewSession = () => {
    setShowStartSessionModal(true);
  };
  
  const handleConfirmStartSession = () => {
    setShowStartSessionModal(false);
    setIsSessionActive(true);
    showToast('Session started successfully', 'success');
  };

  const handleEndSession = () => {
    setIsSessionActive(false);
    showToast('Session ended', 'info');
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const handleAddMember = (member: typeof MEMBER_DIRECTORY[0]) => {
    if (!participants.find(p => p.id === member.id)) {
      setParticipants([...participants, {
        id: member.id,
        name: member.name,
        role: member.role,
        avatarColor: '#8B5CF6',
        status: 'invited',
      }]);
      showToast(`${member.name} invited`, 'success');
    }
    setShowMemberPicker(false);
  };

  const handleRemoveParticipant = (id: string) => {
    if (id !== 'you') {
      const participant = participants.find(p => p.id === id);
      setParticipants(participants.filter(p => p.id !== id));
      showToast(`${participant?.name} removed`, 'info');
    }
  };

  const handleApprove = (itemId: string) => {
    const item = authorityItems.find(i => i.id === itemId);
    setAuthorityItems(prev => prev.map(i => 
      i.id === itemId ? { ...i, status: 'approved' as const } : i
    ));
    showToast(`Approved: ${item?.title}`, 'success');
  };

  const handleDeny = (itemId: string) => {
    const item = authorityItems.find(i => i.id === itemId);
    setAuthorityItems(prev => prev.map(i => 
      i.id === itemId ? { ...i, status: 'denied' as const } : i
    ));
    showToast(`Denied: ${item?.title}`, 'error');
  };

  const handleMenuSelect = (optionId: string) => {
    switch (optionId) {
      case 'settings':
        showToast('Room settings', 'info');
        break;
      case 'schedule':
        showToast('Schedule meeting for later', 'info');
        break;
      case 'copy-link':
        showToast('Meeting link copied!', 'success');
        break;
    }
  };

  const handleStartSession = () => {
    router.push({
      pathname: '/session/conference-live' as any,
      params: {
        purpose,
        participantIds: participants.map(p => p.id).join(','),
      }
    });
  };

  const pendingCount = authorityItems.filter(i => i.status === 'pending').length;

  const lobbyContent = (
    <SafeAreaView style={styles.container}>
      <Toast 
        visible={toastVisible} 
        message={toastMessage} 
        type={toastType}
        onHide={() => setToastVisible(false)} 
      />

      {/* Header Bar */}
      <View style={styles.header}>
        <Pressable onPress={() => router.push('/(tabs)')} style={styles.exitButton}>
          <Ionicons name="close" size={20} color={Colors.text.secondary} />
        </Pressable>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Conference Room</Text>
          <Text style={styles.headerSubtitle}>Suite ZEN-014 • Room CR-01</Text>
        </View>
        
        <View style={styles.headerActions}>
          <Pressable style={styles.menuButton} onPress={() => setMenuVisible(true)}>
            <Ionicons name="ellipsis-horizontal" size={20} color={Colors.text.secondary} />
          </Pressable>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
        {/* Large Visual Preview - Flip Card with Idle/Live Modes */}
        <View style={styles.lobbyVisual}>
          {/* Premium Arrow - Toggle between idle/live modes */}
          <View style={styles.sessionNavigator}>
            <Pressable 
              style={styles.navArrow} 
              onPress={toggleFlip}
            >
              <Animated.View style={arrowAnimatedStyle}>
                <Ionicons name="chevron-up" size={20} color="rgba(255,255,255,0.5)" />
              </Animated.View>
            </Pressable>
          </View>
          
          <View style={styles.flipCardContainer}>

            {/* FRONT CARD - Idle Mode (Team Meeting Image + Start Session) */}
            <Animated.View 
              style={[
                styles.flipCard,
                styles.flipCardFront,
                frontAnimatedStyle
              ]}
              pointerEvents={isSessionActive ? 'none' : 'auto'}
            >
              <View style={styles.sessionPreviewCard}>
                <ImageBackground 
                  source={TEAM_MEETING_IMAGE}
                  style={styles.sessionImageBackground}
                  imageStyle={styles.sessionImage}
                >
                  <LinearGradient
                    colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.7)']}
                    style={styles.sessionGradientOverlay}
                  >
                    {/* Top Row: Ready Badge */}
                    <View style={styles.sessionTopRow}>
                      <View style={styles.readyBadge}>
                        <Ionicons name="radio-button-on" size={12} color={Colors.accent.cyan} />
                        <Text style={styles.readyBadgeText}>READY</Text>
                      </View>
                      <View style={styles.noraAIBadge}>
                        <Image source={NORA_AVATAR} style={styles.noraAvatar} />
                        <Text style={styles.noraAIText}>Nora Available</Text>
                      </View>
                    </View>

                    {/* Idle Mode Details */}
                    <View style={styles.sessionDetails}>
                      <Text style={styles.sessionMeetingTitle}>Conference Room</Text>
                      <Text style={styles.sessionLocation}>Suite ZEN-014 • Room CR-01</Text>
                      
                      <View style={styles.idleInfoRow}>
                        <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.6)" />
                        <Text style={styles.idleInfoText}>No active session</Text>
                      </View>
                      
                      <Text style={styles.idleSubtext}>
                        Start a session to collaborate with your team
                      </Text>
                    </View>

                    {/* Start Session Button */}
                    <Pressable style={styles.joinButton} onPress={handleStartNewSession}>
                      <Ionicons name="play" size={16} color="#FFFFFF" />
                      <Text style={styles.joinButtonText}>Start Session</Text>
                    </Pressable>
                  </LinearGradient>
                </ImageBackground>
              </View>
            </Animated.View>

            {/* BACK CARD - Live Mode (Meeting Room + Join Session) */}
            <Animated.View 
              style={[
                styles.flipCard,
                styles.flipCardBack,
                backAnimatedStyle
              ]}
              pointerEvents={isSessionActive ? 'auto' : 'none'}
            >
              <View style={styles.sessionPreviewCard}>
                <ImageBackground 
                  source={CONFERENCE_ROOM_IMAGE}
                  style={styles.sessionImageBackground}
                  imageStyle={styles.sessionImage}
                >
                  <LinearGradient
                    colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.7)']}
                    style={styles.sessionGradientOverlay}
                  >
                    {/* Top Row: Status Badges */}
                    <View style={styles.sessionTopRow}>
                      <View style={styles.liveBadge}>
                        <View style={styles.liveDotPulse} />
                        <Text style={styles.liveBadgeText}>LIVE</Text>
                      </View>
                      <View style={styles.noraAIBadge}>
                        <Image source={NORA_AVATAR} style={styles.noraAvatar} />
                        <Text style={styles.noraAIText}>Nora Active</Text>
                      </View>
                    </View>

                    {/* Meeting Details - Bottom Section */}
                    <View style={styles.sessionDetails}>
                      <Text style={styles.sessionMeetingTitle}>Q4 Strategy Review</Text>
                      <Text style={styles.sessionLocation}>Suite ZEN-014 • Room CR-01</Text>
                      
                      {/* Participants */}
                      <View style={styles.sessionParticipantsRow}>
                        <View style={styles.avatarStack}>
                          <View style={[styles.stackedAvatar, { backgroundColor: Colors.accent.cyan, zIndex: 4 }]}>
                            <Text style={styles.stackedAvatarText}>M</Text>
                          </View>
                          {participants.slice(1, 3).map((p, i) => (
                            <View 
                              key={p.id} 
                              style={[
                                styles.stackedAvatar, 
                                { backgroundColor: i === 0 ? '#8B5CF6' : '#3B82F6', marginLeft: -8, zIndex: 3 - i }
                              ]}
                            >
                              <Text style={styles.stackedAvatarText}>{p.name.charAt(0)}</Text>
                            </View>
                          ))}
                        </View>
                        <Text style={styles.participantLabel}>
                          {participants.length} participant{participants.length !== 1 ? 's' : ''} ready
                        </Text>
                      </View>

                      {/* Agenda Preview */}
                      <View style={styles.agendaPreview}>
                        <Text style={styles.agendaPreviewText}>
                          Review Q4 projections • Expansion timeline • Resource allocation
                        </Text>
                      </View>
                    </View>

                    {/* Join Button */}
                    <Pressable style={styles.joinButton} onPress={handleStartSession}>
                      <Ionicons name="videocam" size={16} color="#FFFFFF" />
                      <Text style={styles.joinButtonText}>Join Session</Text>
                    </Pressable>
                  </LinearGradient>
                </ImageBackground>
              </View>
            </Animated.View>
          </View>
        </View>

        {/* Full Width Authority Queue Section */}
        <View style={styles.authoritySection}>
          <View style={styles.authorityHeader}>
            <View style={styles.authorityTitleRow}>
              <View style={styles.authorityIconContainer}>
                <Ionicons name="shield-checkmark" size={20} color={Colors.accent.cyan} />
              </View>
              <View>
                <Text style={styles.authorityTitle}>Pre-Session Approvals</Text>
                <Text style={styles.authoritySubtitle}>Documents requiring your authorization</Text>
              </View>
            </View>
            {pendingCount > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingCount} pending</Text>
              </View>
            )}
          </View>

          {/* Authority Queue - Horizontal Scrollable */}
          <View
            style={{
              flexDirection: 'row',
              gap: 16,
              overflowX: 'auto',
              overflowY: 'hidden',
              paddingLeft: 24,
              paddingRight: 24,
              paddingBottom: 8,
              scrollbarWidth: 'thin',
              scrollbarColor: '#3B3B3D transparent',
            } as any}
          >
            {authorityItems.map((item, index) => {
              const riskConfig = getRiskConfig(item.risk);
              const isPending = item.status === 'pending';
              
              return (
                <View 
                  key={item.id} 
                  style={[
                    styles.authorityCard,
                    !isPending && styles.authorityCardResolved,
                  ]}
                >
                  <View style={styles.authorityCardContent}>
                    {/* Document Thumbnail or Icon */}
                    <View style={styles.authorityVisual}>
                      {item.documentType ? (
                        <DocumentThumbnail 
                          type={item.documentType} 
                          size="lg" 
                          variant={index}
                          context="conference"
                        />
                      ) : (
                        <View style={styles.authorityIconBox}>
                          <Ionicons name={item.icon} size={24} color={Colors.accent.cyan} />
                        </View>
                      )}
                    </View>
                    
                    {/* Card Info */}
                    <View style={styles.authorityCardInfo}>
                      <View style={styles.authorityCardTop}>
                        <Text style={styles.authorityCardTitle} numberOfLines={1}>{item.title}</Text>
                        <View style={[styles.riskBadge, { backgroundColor: riskConfig.bg }]}>
                          <Text style={[styles.riskText, { color: riskConfig.color }]}>{item.risk}</Text>
                        </View>
                      </View>
                      <Text style={styles.authorityCardDesc} numberOfLines={2}>{item.description}</Text>
                      {item.documentName && (
                        <View style={styles.documentTag}>
                          <Ionicons name="document-attach" size={12} color={Colors.text.muted} />
                          <Text style={styles.documentName}>{item.documentName}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Actions */}
                  {isPending ? (
                    <View style={styles.authorityActions}>
                      <Pressable 
                        style={styles.denyBtn}
                        onPress={() => handleDeny(item.id)}
                      >
                        <Ionicons name="close-circle-outline" size={16} color={Colors.text.secondary} />
                        <Text style={styles.denyText}>Deny</Text>
                      </Pressable>
                      <Pressable 
                        style={styles.approveBtn}
                        onPress={() => handleApprove(item.id)}
                      >
                        <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                        <Text style={styles.approveText}>Approve</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.resolvedStatus}>
                      <Ionicons 
                        name={item.status === 'approved' ? 'checkmark-circle' : 'close-circle'} 
                        size={16} 
                        color={item.status === 'approved' ? '#2563EB' : Colors.text.muted} 
                      />
                      <Text style={[
                        styles.resolvedText,
                        { color: item.status === 'approved' ? '#2563EB' : Colors.text.muted }
                      ]}>
                        {item.status === 'approved' ? 'Approved' : 'Denied'}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
        </View>

      </ScrollView>

      {/* Premium Start Session Modal */}
      {showStartSessionModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowStartSessionModal(false)} />
          </View>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View style={styles.modalIcon}>
                  <Ionicons name="videocam" size={20} color={Colors.accent.cyan} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Start New Session</Text>
                  <Text style={styles.modalSubtitle}>Configure your meeting preferences</Text>
                </View>
              </View>
              <Pressable style={styles.modalClose} onPress={() => setShowStartSessionModal(false)}>
                <Ionicons name="close" size={20} color={Colors.text.muted} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Meeting Purpose Selection */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Meeting Purpose</Text>
                <View style={styles.purposeGrid}>
                  {PURPOSE_OPTIONS.map((option) => (
                    <Pressable
                      key={option.id}
                      style={[
                        styles.purposeOption,
                        purpose === option.id && styles.purposeOptionActive,
                      ]}
                      onPress={() => setPurpose(option.id)}
                    >
                      <View style={[
                        styles.purposeIconBox,
                        purpose === option.id && styles.purposeIconBoxActive,
                      ]}>
                        <Ionicons 
                          name={option.icon} 
                          size={20} 
                          color={purpose === option.id ? '#FFFFFF' : Colors.text.muted} 
                        />
                      </View>
                      <Text style={[
                        styles.purposeOptionText,
                        purpose === option.id && styles.purposeOptionTextActive,
                      ]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Participants Section */}
              <View style={styles.modalSection}>
                <View style={styles.modalSectionHeader}>
                  <Text style={styles.modalSectionTitle}>Participants</Text>
                  <Text style={styles.participantCount}>{participants.length} added</Text>
                </View>
                
                <View style={styles.participantsContainer}>
                  {participants.map((participant) => (
                    <View key={participant.id} style={styles.modalParticipantRow}>
                      <View style={[styles.modalParticipantAvatar, { backgroundColor: participant.avatarColor }]}>
                        <Text style={styles.modalParticipantInitial}>{participant.name.charAt(0)}</Text>
                      </View>
                      <View style={styles.modalParticipantInfo}>
                        <Text style={styles.modalParticipantName}>{participant.name}</Text>
                        <Text style={styles.modalParticipantRole}>{participant.role}</Text>
                      </View>
                      {participant.id === 'you' ? (
                        <View style={styles.youBadge}>
                          <Text style={styles.youBadgeText}>You</Text>
                        </View>
                      ) : (
                        <Pressable 
                          style={styles.removeParticipantBtn}
                          onPress={() => handleRemoveParticipant(participant.id)}
                        >
                          <Ionicons name="close" size={14} color={Colors.text.muted} />
                        </Pressable>
                      )}
                    </View>
                  ))}
                </View>

                {/* Add Participant Button with Dropdown */}
                <View style={styles.addParticipantWrapper}>
                  <Pressable 
                    style={styles.addParticipantBtn}
                    onPress={() => setShowMemberPicker(!showMemberPicker)}
                  >
                    <Ionicons name={showMemberPicker ? "chevron-up" : "add-circle"} size={18} color={Colors.accent.cyan} />
                    <Text style={styles.addParticipantText}>{showMemberPicker ? "Close" : "Add Participants"}</Text>
                  </Pressable>

                  {showMemberPicker && (
                    <View style={styles.modalPickerDropdown}>
                      <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
                        {MEMBER_DIRECTORY.filter(m => !participants.find(p => p.id === m.id)).slice(0, 5).map((member) => (
                          <Pressable 
                            key={member.id}
                            style={styles.modalPickerItem}
                            onPress={() => handleAddMember(member)}
                          >
                            <View style={styles.modalPickerAvatar}>
                              <Text style={styles.modalPickerInitial}>{member.name.charAt(0)}</Text>
                            </View>
                            <View style={styles.modalPickerInfo}>
                              <Text style={styles.modalPickerName}>{member.name}</Text>
                              <Text style={styles.modalPickerRole}>{member.role}</Text>
                            </View>
                            <Ionicons name="add-circle" size={18} color={Colors.accent.cyan} />
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable 
                style={styles.cancelBtn}
                onPress={() => setShowStartSessionModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={styles.confirmBtn}
                onPress={handleConfirmStartSession}
              >
                <Ionicons name="play" size={16} color="#FFFFFF" />
                <Text style={styles.confirmBtnText}>Start Session</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      <BottomSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        title="Options"
        options={MENU_OPTIONS}
        onSelect={handleMenuSelect}
      />
    </SafeAreaView>
  );

  if (isDesktop) {
    return (
      <FullscreenSessionShell showBackButton={false} backLabel="Exit Lobby">
        {lobbyContent}
      </FullscreenSessionShell>
    );
  }

  return lobbyContent;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  exitButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 2,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 1240,
    paddingHorizontal: 32,
    paddingTop: 28,
    paddingBottom: 40,
  },

  // Lobby Visual - The Focal Point
  lobbyVisual: {
    marginBottom: 32,
  },
  
  // Session Navigator (Premium Invisible Arrow)
  sessionNavigator: {
    alignItems: 'center',
    marginBottom: 8,
  },
  navArrow: {
    padding: 8,
  },
  
  // Flip Card Container
  flipCardContainer: {
    position: 'relative',
    height: 360,
  },
  flipCard: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
    borderRadius: 16,
    overflow: 'hidden',
  },
  flipCardFront: {
    zIndex: 2,
  },
  flipCardBack: {
    zIndex: 1,
  },
  // 3D Block Depth Strip (visible during flip) - creates block thickness
  
  // Session Preview Card with Image
  sessionPreviewCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.03) inset',
  } as ViewStyle,
  sessionImageBackground: {
    height: 360,
  },
  sessionImage: {
    borderRadius: 15,
  },
  sessionGradientOverlay: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  idleHorizontalGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sessionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 100, 100, 0.4)',
    boxShadow: '0 0 20px rgba(220, 38, 38, 0.6), 0 0 40px rgba(220, 38, 38, 0.3), 0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
  } as ViewStyle,
  liveDotPulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 0 6px #FFFFFF, 0 0 12px rgba(255, 255, 255, 0.8), 0 0 20px rgba(255, 100, 100, 0.6)',
  } as ViewStyle,
  liveBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
    boxShadow: '0 4px 16px rgba(6, 182, 212, 0.2), 0 0 0 1px rgba(6, 182, 212, 0.1) inset',
  } as ViewStyle,
  readyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent.cyan,
    letterSpacing: 1,
  },
  noraAIBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
    paddingRight: 14,
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
  },
  noraAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  noraAIText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent.cyan,
    letterSpacing: 0.5,
  },
  sessionDetails: {
    gap: 8,
  },
  sessionMeetingTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  sessionLocation: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
  },
  sessionParticipantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackedAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.5)',
  },
  stackedAvatarText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  participantLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  agendaPreview: {
    marginTop: 6,
  },
  agendaPreviewText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 18,
  },
  joinButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    boxShadow: '0 4px 20px rgba(37, 99, 235, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
  } as ViewStyle,
  joinButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  idleInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  idleInfoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  idleSubtext: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 8,
    lineHeight: 18,
  },
  startButton: {
    position: 'absolute',
    bottom: 28,
    right: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    boxShadow: '0 6px 24px rgba(37, 99, 235, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
  } as ViewStyle,
  startButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  sessionParticipantCount: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  sessionAgenda: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  agendaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  agendaItem: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginBottom: 4,
    lineHeight: 18,
  },
  noraReadyBadge: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.15)',
  },
  noraReadyText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.accent.cyan,
  },
  joinSessionButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.accent.cyan,
    borderRadius: 8,
  },
  joinSessionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  // Quick Actions (legacy - can be removed)
  quickActionsLegacy: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent.cyan,
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  quickAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  quickActionActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: Colors.accent.cyan,
  },

  // Authority Section (Full Width)
  authoritySection: {
    marginBottom: 32,
    backgroundColor: Colors.background.secondary,
    borderRadius: 16,
    paddingTop: 24,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  authorityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  authorityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authorityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  authoritySubtitle: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 2,
  },
  pendingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 12,
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.semantic.warning,
  },
  authorityScrollContent: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 24,
  },
  authorityCard: {
    width: 300,
    minWidth: 300,
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  authorityCardResolved: {
    opacity: 0.7,
  },
  authorityCardContent: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
  },
  authorityVisual: {
    flexShrink: 0,
  },
  authorityIconBox: {
    width: 72,
    height: 92,
    borderRadius: 8,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.15)',
  },
  authorityCardInfo: {
    flex: 1,
  },
  authorityCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  authorityCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
    marginRight: 8,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  riskText: {
    fontSize: 10,
    fontWeight: '600',
  },
  authorityCardDesc: {
    fontSize: 12,
    color: '#FFFFFF',
    lineHeight: 16,
    marginBottom: 6,
  },
  documentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  documentName: {
    fontSize: 11,
    color: '#FFFFFF',
  },
  authorityActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    paddingTop: 12,
  },
  denyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  denyText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
  } as ViewStyle,
  approveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resolvedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  resolvedText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Bottom Row
  bottomRow: {
    flexDirection: 'row',
    gap: 20,
  },
  purposeSection: {
    flex: 1,
  },
  participantsSection: {
    flex: 1,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.background.secondary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.accent.cyan,
  },

  // Purpose Pills
  purposePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  purposePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.background.secondary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  purposePillActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderColor: Colors.accent.cyan,
  },
  purposePillText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.muted,
  },
  purposePillTextActive: {
    color: Colors.text.primary,
  },

  // Participants
  participantsList: {
    gap: 8,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  participantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  participantInitial: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  participantRole: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 1,
  },
  statusBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.accent.cyan,
  },
  removeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Picker
  pickerDropdown: {
    backgroundColor: Colors.background.elevated,
    borderRadius: 12,
    marginTop: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  pickerTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text.muted,
    paddingHorizontal: 8,
    paddingVertical: 6,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
  },
  pickerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pickerInitial: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  pickerInfo: {
    flex: 1,
  },
  pickerName: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  pickerRole: {
    fontSize: 10,
    color: Colors.text.muted,
  },

  // Start Session Modal
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  modalContainer: {
    width: 520,
    maxWidth: '90%',
    maxHeight: '85%',
    backgroundColor: '#141416',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
  } as ViewStyle,
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  modalIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.2)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.text.muted,
    marginTop: 2,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 24,
    gap: 20,
    flex: 1,
  },
  modalSection: {
    gap: 12,
  },
  modalSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  participantCount: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  purposeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  purposeOption: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: Colors.background.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    minWidth: 90,
  },
  purposeOptionActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderColor: '#2563EB',
  },
  purposeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purposeIconBoxActive: {
    backgroundColor: '#2563EB',
  },
  purposeOptionText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.muted,
  },
  purposeOptionTextActive: {
    color: Colors.text.primary,
  },
  participantsContainer: {
    gap: 8,
  },
  moreParticipantsText: {
    fontSize: 12,
    color: Colors.text.muted,
    textAlign: 'center',
    paddingVertical: 4,
  },
  addParticipantWrapper: {
    position: 'relative',
  },
  dropdownScroll: {
    maxHeight: 180,
  },
  modalParticipantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.tertiary,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  modalParticipantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modalParticipantInitial: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  modalParticipantInfo: {
    flex: 1,
  },
  modalParticipantName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  modalParticipantRole: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 1,
  },
  youBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  youBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent.cyan,
  },
  removeParticipantBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addParticipantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.background.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderStyle: 'dashed',
  },
  addParticipantText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.accent.cyan,
  },
  modalPickerDropdown: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 100,
    boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.5)',
  } as ViewStyle,
  modalPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
  },
  modalPickerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modalPickerInitial: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  modalPickerInfo: {
    flex: 1,
  },
  modalPickerName: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  modalPickerRole: {
    fontSize: 10,
    color: Colors.text.muted,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#0F0F10',
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.background.secondary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
  } as ViewStyle,
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
