import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useTenant } from '@/providers/TenantProvider';
import { 
  getDefaultSession, 
  updateSessionPurpose, 
  addParticipant,
  updateStaffState,
  approveAuthorityItem,
  denyAuthorityItem,
  addChatMessage,
  bookmarkTranscript,
  createActionItem,
  SessionPurpose,
  MEMBER_DIRECTORY,
  AVAILABLE_STAFF
} from '@/data/session';
import { SessionParticipant, SessionStaffMember, SessionAuthorityItem } from '@/types/session';
import { BottomSheet } from '@/components/session/BottomSheet';
import { InviteSheet } from '@/components/session/InviteSheet';
import { StaffCommandSheet } from '@/components/session/StaffCommandSheet';
import { ChatDrawer } from '@/components/session/ChatDrawer';
import { ConfirmationModal } from '@/components/session/ConfirmationModal';
import { Toast } from '@/components/session/Toast';
import { AddStaffSheet } from '@/components/session/AddStaffSheet';
import { RoomSettingsSheet } from '@/components/session/RoomSettingsSheet';
import { ExportSheet } from '@/components/session/ExportSheet';
import { ShareSheet } from '@/components/session/ShareSheet';
import { ConferenceGrid } from '@/components/session/ConferenceGrid';
import { ParticipantPanel } from '@/components/session/ParticipantPanel';
import { ConferenceParticipant } from '@/components/session/ParticipantTile';
import { useDesktop } from '@/lib/useDesktop';
import { FullscreenSessionShell } from '@/components/desktop/FullscreenSessionShell';

const PRESENCE_COLORS: Record<string, string> = {
  good: Colors.semantic.success,
  fair: Colors.semantic.warning,
  poor: Colors.semantic.error,
};

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  Low: { bg: 'rgba(34, 197, 94, 0.2)', text: Colors.semantic.success },
  Medium: { bg: 'rgba(251, 191, 36, 0.2)', text: Colors.semantic.warning },
  High: { bg: 'rgba(239, 68, 68, 0.2)', text: Colors.semantic.error },
};

const STAFF_STATE_COLORS: Record<string, { bg: string; text: string }> = {
  idle: { bg: 'rgba(107, 114, 128, 0.2)', text: '#9CA3AF' },
  working: { bg: 'rgba(59, 130, 246, 0.2)', text: Colors.accent.cyan },
  done: { bg: 'rgba(34, 197, 94, 0.2)', text: Colors.semantic.success },
};

const MENU_OPTIONS = [
  { id: 'purpose', label: 'Change Purpose', icon: 'flag' as const },
  { id: 'invite', label: 'Invite Participant', icon: 'person-add' as const },
  { id: 'staff', label: 'Add AI Staff', icon: 'people' as const },
  { id: 'settings', label: 'Room Settings', icon: 'settings' as const },
  { id: 'export', label: 'Export Transcript', icon: 'download' as const },
  { id: 'end', label: 'End Session & Save', icon: 'stop-circle' as const, destructive: true },
];

const PURPOSE_OPTIONS: { id: SessionPurpose; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'Internal', label: 'Internal', icon: 'business' },
  { id: 'Networking', label: 'Networking', icon: 'people' },
  { id: 'Client Call', label: 'Client Call', icon: 'person' },
  { id: 'Vendor Call', label: 'Vendor Call', icon: 'storefront' },
  { id: 'Deal Review', label: 'Deal Review', icon: 'briefcase' },
];

export default function ConferenceSession() {
  const router = useRouter();
  const isDesktop = useDesktop();
  const { tenant } = useTenant();
  const session = getDefaultSession();
  
  const [isMuted, setIsMuted] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [participants, setParticipants] = useState(session.participants);
  const [staff, setStaff] = useState(session.staff);
  const [authorityQueue, setAuthorityQueue] = useState(session.authorityQueue);
  const [chatMessages, setChatMessages] = useState(session.chatMessages);
  const [purpose, setPurpose] = useState<SessionPurpose>(session.purpose);
  const [authorityExpanded, setAuthorityExpanded] = useState(false);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  
  const [menuVisible, setMenuVisible] = useState(false);
  const [purposeSheetVisible, setPurposeSheetVisible] = useState(false);
  const [inviteSheetVisible, setInviteSheetVisible] = useState(false);
  const [staffCommandVisible, setStaffCommandVisible] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<SessionStaffMember | null>(null);
  const [chatVisible, setChatVisible] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [endSessionVisible, setEndSessionVisible] = useState(false);
  const [addStaffVisible, setAddStaffVisible] = useState(false);
  const [roomSettingsVisible, setRoomSettingsVisible] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(true);
  const [gridLayout, setGridLayout] = useState<'gallery' | 'speaker'>('gallery');
  const [participantPanelVisible, setParticipantPanelVisible] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | undefined>(participants[0]?.id);
  
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const handleMenuSelect = (optionId: string) => {
    switch (optionId) {
      case 'purpose':
        setPurposeSheetVisible(true);
        break;
      case 'invite':
        setInviteSheetVisible(true);
        break;
      case 'staff':
        setAddStaffVisible(true);
        break;
      case 'settings':
        setRoomSettingsVisible(true);
        break;
      case 'export':
        setExportVisible(true);
        break;
      case 'end':
        setEndSessionVisible(true);
        break;
    }
  };

  const handleAddStaff = (staffId: string, staffName: string) => {
    const staffInfo = AVAILABLE_STAFF.find(s => s.id === staffId);
    const newStaffMember: SessionStaffMember = {
      id: staffId,
      name: staffName,
      role: staffInfo?.role || 'Assistant',
      avatarColor: staffInfo?.avatarColor || Colors.accent.cyan,
      state: 'idle',
      outputCount: 0,
    };
    setStaff([...staff, newStaffMember]);
    showToast(`${staffName} joined the session`, 'success');
  };

  const handleExport = (format: 'pdf' | 'txt' | 'json') => {
    showToast(`Transcript exported as ${format.toUpperCase()}`, 'success');
  };

  const handleShare = (type: 'screen' | 'file' | 'link' | 'whiteboard') => {
    const messages: Record<string, string> = {
      screen: 'Screen sharing started',
      file: 'Select file to share',
      link: 'Room link copied to clipboard',
      whiteboard: 'Whiteboard opened',
    };
    showToast(messages[type], 'success');
  };

  const handlePurposeChange = (newPurpose: string) => {
    updateSessionPurpose(newPurpose as SessionPurpose);
    setPurpose(newPurpose as SessionPurpose);
    showToast(`Purpose changed to ${newPurpose}`, 'success');
  };

  const handleInviteMember = (memberId: string, name: string) => {
    const member = MEMBER_DIRECTORY.find(m => m.id === memberId);
    if (member) {
      const newParticipant: SessionParticipant = {
        id: memberId,
        name: member.name,
        role: 'Member',
        initial: member.name.charAt(0),
        color: '#8B5CF6',
        isSpeaking: false,
        isMuted: false,
        presence: 'good',
      };
      addParticipant(newParticipant);
      setParticipants([...participants, newParticipant]);
      showToast(`${member.name} invited`, 'success');
    }
  };

  const handleInviteGuest = (name: string, contact: string) => {
    const newParticipant: SessionParticipant = {
      id: `guest-${Date.now()}`,
      name,
      role: 'Guest',
      initial: name.charAt(0),
      color: Colors.semantic.warning,
      isSpeaking: false,
      isMuted: false,
      presence: 'good',
    };
    addParticipant(newParticipant);
    setParticipants([...participants, newParticipant]);
    showToast(`Invite sent to ${name}`, 'success');
  };

  const handleCopyLink = () => {
    showToast('Room link copied', 'success');
  };

  const conferenceParticipants: ConferenceParticipant[] = participants.map((p, index) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    avatarColor: p.color,
    isMuted: p.isMuted,
    isVideoOff: false,
    isSpeaking: p.isSpeaking,
    isHandRaised: false,
    isHost: index === 0,
    avaTaskCount: Math.floor(Math.random() * 3),
  }));

  const handleParticipantPress = (participant: ConferenceParticipant) => {
    setActiveSpeakerId(participant.id);
    showToast(`Viewing ${participant.name}`, 'info');
  };

  const handleMuteParticipant = (participantId: string) => {
    setParticipants(prev => prev.map(p => 
      p.id === participantId ? { ...p, isMuted: !p.isMuted } : p
    ));
    const participant = participants.find(p => p.id === participantId);
    showToast(`${participant?.name} ${participant?.isMuted ? 'unmuted' : 'muted'}`, 'info');
  };

  const handleLayoutToggle = () => {
    setGridLayout(prev => prev === 'gallery' ? 'speaker' : 'gallery');
    showToast(`Switched to ${gridLayout === 'gallery' ? 'speaker' : 'gallery'} view`, 'info');
  };

  const handleStaffCommand = (commandId: string) => {
    if (selectedStaff) {
      updateStaffState(selectedStaff.id, 'working', 'Processing command...');
      setStaff([...session.staff]);
      showToast(`${selectedStaff.name} is working on it`, 'info');
      
      setTimeout(() => {
        updateStaffState(selectedStaff.id, 'done');
        setStaff([...session.staff]);
        showToast(`${selectedStaff.name} completed task`, 'success');
      }, 3000);
    }
  };

  const handleApprove = (item: SessionAuthorityItem) => {
    approveAuthorityItem(item.id);
    setAuthorityQueue([...session.authorityQueue]);
    showToast(`Approved: ${item.title}`, 'success');
  };

  const handleDeny = (item: SessionAuthorityItem) => {
    denyAuthorityItem(item.id);
    setAuthorityQueue([...session.authorityQueue]);
    showToast(`Denied: ${item.title}`, 'error');
  };

  const handleSendChat = (text: string) => {
    addChatMessage({ senderId: 'host-1', senderName: 'You', text });
    setChatMessages([...session.chatMessages]);
  };

  const handleEndSession = () => {
    showToast('Session ended. Transcript saved.', 'success');
    setTimeout(() => router.replace('/(tabs)'), 1000);
  };

  const pendingAuthority = authorityQueue.filter(a => a.status === 'pending');

  const conferenceContent = (
    <SafeAreaView style={styles.container}>
      <Toast 
        visible={toastVisible} 
        message={toastMessage} 
        type={toastType}
        onHide={() => setToastVisible(false)} 
      />
      
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-down" size={24} color={Colors.text.secondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Conference Lobby</Text>
          <View style={styles.headerMeta}>
            <Text style={styles.headerSubtitle}>
              Suite {tenant?.suiteId ?? ''} • Room CR-01
            </Text>
            <View style={styles.headerBadges}>
              <View style={styles.lobbyBadge}>
                <Ionicons name="time-outline" size={12} color={Colors.accent.cyan} />
                <Text style={styles.lobbyText}>Staging</Text>
              </View>
            </View>
          </View>
        </View>
        <Pressable style={styles.menuButton} onPress={() => setMenuVisible(true)}>
          <Ionicons name="ellipsis-vertical" size={20} color={Colors.text.secondary} />
        </Pressable>
      </View>
      
      <View style={styles.stagingBanner}>
        <Ionicons name="shield-checkmark" size={18} color={Colors.accent.cyan} />
        <View style={styles.stagingBannerText}>
          <Text style={styles.stagingTitle}>Pre-Session Staging Room</Text>
          <Text style={styles.stagingSubtitle}>Review participants, AI staff, and permissions before starting. Nothing is recorded or shared until you start the session.</Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.purposeBadge}>
          <Ionicons name="flag" size={14} color={Colors.accent.cyan} />
          <Text style={styles.purposeText}>{purpose}</Text>
          <Pressable onPress={() => setPurposeSheetVisible(true)}>
            <Ionicons name="chevron-down" size={16} color={Colors.text.muted} />
          </Pressable>
        </View>

        <Card variant="elevated" style={styles.videoGridCard}>
          <View style={styles.videoGridHeader}>
            <Text style={styles.sectionTitle}>Video Conference</Text>
            <Pressable 
              style={styles.participantsButton}
              onPress={() => setParticipantPanelVisible(true)}
            >
              <Ionicons name="people" size={16} color={Colors.accent.cyan} />
              <Text style={styles.participantsButtonText}>{participants.length}</Text>
            </Pressable>
          </View>
          <ConferenceGrid
            participants={conferenceParticipants}
            layout={gridLayout}
            activeSpeakerId={activeSpeakerId}
            onParticipantPress={handleParticipantPress}
            onLayoutToggle={handleLayoutToggle}
          />
        </Card>

        <Card variant="filled" style={styles.transcriptCard}>
          <Pressable 
            style={styles.collapsibleHeader}
            onPress={() => setTranscriptExpanded(!transcriptExpanded)}
          >
            <View style={styles.collapsibleTitle}>
              <Ionicons name="document-text" size={16} color={Colors.accent.cyan} />
              <Text style={styles.transcriptTitle}>Transcript Preview</Text>
              <Badge label="Not Recording" variant="default" size="sm" />
            </View>
            <Ionicons 
              name={transcriptExpanded ? "chevron-up" : "chevron-down"} 
              size={16} 
              color={Colors.text.muted} 
            />
          </Pressable>
          {transcriptExpanded && (
            <>
              <View style={styles.transcriptContent}>
                {session.transcript.slice(-3).map((entry) => (
                  <View key={entry.id} style={styles.transcriptEntry}>
                    <Text style={[styles.transcriptSpeaker, { color: entry.speakerColor }]}>
                      {entry.speaker}:
                    </Text>
                    <Text style={styles.transcriptText} numberOfLines={2}>{entry.text}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.transcriptNotice}>
                Transcript recording will begin when session starts.
              </Text>
            </>
          )}
          {!transcriptExpanded && (
            <Text style={styles.collapsedHint}>Tap to preview transcript format</Text>
          )}
        </Card>

        <View style={styles.staffSection}>
          <SectionHeader title="Staff in Room" />
          <View style={styles.staffRow}>
            {staff.map((s) => {
              const stateColor = STAFF_STATE_COLORS[s.state];
              return (
                <Pressable 
                  key={s.id} 
                  style={styles.staffChip}
                  onPress={() => {
                    setSelectedStaff(s);
                    setStaffCommandVisible(true);
                  }}
                >
                  <View style={[styles.staffDot, { backgroundColor: s.avatarColor }]} />
                  <Text style={styles.staffName}>{s.name}</Text>
                  <View style={[styles.staffStateBadge, { backgroundColor: stateColor.bg }]}>
                    <Text style={[styles.staffStateText, { color: stateColor.text }]}>
                      {s.state.charAt(0).toUpperCase() + s.state.slice(1)}
                    </Text>
                  </View>
                  {s.outputCount > 0 && (
                    <View style={styles.outputBadge}>
                      <Text style={styles.outputText}>{s.outputCount}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <Card variant="filled" style={styles.authoritySection}>
          <Pressable 
            style={styles.collapsibleHeader}
            onPress={() => setAuthorityExpanded(!authorityExpanded)}
          >
            <View style={styles.collapsibleTitle}>
              <Ionicons name="shield-checkmark" size={16} color={Colors.accent.cyan} />
              <Text style={styles.transcriptTitle}>Authority Queue</Text>
              <Badge label={`${pendingAuthority.length} Pending`} variant="default" size="sm" />
            </View>
            <Ionicons 
              name={authorityExpanded ? "chevron-up" : "chevron-down"} 
              size={16} 
              color={Colors.text.muted} 
            />
          </Pressable>
          {authorityExpanded && (
            <>
              {pendingAuthority.slice(0, 2).map((item) => {
                const riskColor = RISK_COLORS[item.risk];
                return (
                  <View key={item.id} style={styles.authorityCard}>
                    <View style={styles.authorityHeader}>
                      <Text style={styles.authorityTitle}>{item.title}</Text>
                      <View style={[styles.riskBadge, { backgroundColor: riskColor.bg }]}>
                        <Text style={[styles.riskText, { color: riskColor.text }]}>{item.risk}</Text>
                      </View>
                    </View>
                    <Text style={styles.authorityDescription}>{item.description}</Text>
                    <View style={styles.whyContainer}>
                      <Ionicons name="information-circle" size={14} color={Colors.accent.cyan} />
                      <Text style={styles.whyText}>{item.whyRequired}</Text>
                    </View>
                    <View style={styles.authorityActions}>
                      <Pressable 
                        style={styles.denyButton}
                        onPress={() => handleDeny(item)}
                      >
                        <Ionicons name="close" size={16} color={Colors.semantic.error} />
                        <Text style={styles.denyText}>Deny</Text>
                      </Pressable>
                      <Pressable 
                        style={styles.approveButton}
                        onPress={() => handleApprove(item)}
                      >
                        <Ionicons name="checkmark" size={16} color={Colors.semantic.success} />
                        <Text style={styles.approveText}>Approve</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </>
          )}
          {!authorityExpanded && (
            <Text style={styles.collapsedHint}>Tap to review pending approvals</Text>
          )}
        </Card>
      </ScrollView>

      <View style={styles.startSessionContainer}>
        <Text style={styles.startSessionContext}>
          This will start the live conference and enable recording and AI actions.
        </Text>
        <Pressable 
          style={({ pressed }) => [styles.startSessionButton, pressed && { opacity: 0.8 }]}
          onPress={() => router.push('/session/conference-live')}
        >
          <Ionicons name="play" size={20} color={Colors.text.primary} />
          <Text style={styles.startSessionButtonText}>Start Session</Text>
        </Pressable>
        <Text style={styles.startSessionMicrocopy}>
          A receipt will be generated when the session ends.
        </Text>
      </View>

      <BottomSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        title="Session Options"
        options={MENU_OPTIONS}
        onSelect={handleMenuSelect}
      />

      <BottomSheet
        visible={purposeSheetVisible}
        onClose={() => setPurposeSheetVisible(false)}
        title="Session Purpose"
        options={PURPOSE_OPTIONS.map(p => ({ id: p.id, label: p.label, icon: p.icon }))}
        onSelect={handlePurposeChange}
      />

      <InviteSheet
        visible={inviteSheetVisible}
        onClose={() => setInviteSheetVisible(false)}
        onInviteMember={handleInviteMember}
        onInviteGuest={handleInviteGuest}
        onCopyLink={handleCopyLink}
      />

      <StaffCommandSheet
        visible={staffCommandVisible}
        onClose={() => setStaffCommandVisible(false)}
        staff={selectedStaff}
        onCommand={handleStaffCommand}
      />

      <ChatDrawer
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        messages={chatMessages}
        onSend={handleSendChat}
      />

      <ConfirmationModal
        visible={endSessionVisible}
        onClose={() => setEndSessionVisible(false)}
        onConfirm={handleEndSession}
        title="End Session"
        message="Are you sure you want to end this session? The transcript will be saved and a receipt will be generated."
        confirmLabel="End & Save"
        destructive
        icon="stop-circle"
      />

      <AddStaffSheet
        visible={addStaffVisible}
        onClose={() => setAddStaffVisible(false)}
        currentStaffIds={staff.map(s => s.id)}
        onAddStaff={handleAddStaff}
      />

      <RoomSettingsSheet
        visible={roomSettingsVisible}
        onClose={() => setRoomSettingsVisible(false)}
        isRecording={isRecording}
        onToggleRecording={setIsRecording}
        onSaveSettings={() => showToast('Settings saved', 'success')}
      />

      <ExportSheet
        visible={exportVisible}
        onClose={() => setExportVisible(false)}
        transcriptLength={session.transcript.length}
        onExport={handleExport}
      />

      <ShareSheet
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        roomId={session.roomId}
        onShare={handleShare}
      />

      <ParticipantPanel
        visible={participantPanelVisible}
        onClose={() => setParticipantPanelVisible(false)}
        participants={conferenceParticipants}
        onMuteParticipant={handleMuteParticipant}
        onInvite={() => {
          setParticipantPanelVisible(false);
          setInviteSheetVisible(true);
        }}
      />
    </SafeAreaView>
  );

  if (isDesktop) {
    return (
      <FullscreenSessionShell showBackButton={true} backLabel="Exit Conference">
        {conferenceContent}
      </FullscreenSessionShell>
    );
  }

  return conferenceContent;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
  },
  headerMeta: {
    alignItems: 'center',
    marginTop: 2,
  },
  headerSubtitle: {
    ...Typography.micro,
    color: Colors.text.muted,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
  },
  lobbyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent.cyanDark,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  lobbyText: {
    ...Typography.micro,
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  stagingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.accent.cyanDark,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent.cyan + '30',
  },
  stagingBannerText: {
    flex: 1,
  },
  stagingTitle: {
    ...Typography.body,
    color: Colors.accent.cyan,
    fontWeight: '600',
    marginBottom: 4,
  },
  stagingSubtitle: {
    ...Typography.small,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  collapsibleTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  startSessionContainer: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  startSessionContext: {
    ...Typography.small,
    color: Colors.text.muted,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  startSessionButton: {
    backgroundColor: Colors.semantic.success,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  startSessionButtonText: {
    ...Typography.headline,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  startSessionMicrocopy: {
    ...Typography.micro,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  menuButton: {
    padding: Spacing.sm,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 140,
  },
  purposeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  purposeText: {
    ...Typography.small,
    color: Colors.text.secondary,
  },
  participantsCard: {
    marginBottom: Spacing.xl,
  },
  videoGridCard: {
    marginBottom: Spacing.xl,
    padding: 0,
    overflow: 'hidden',
  },
  videoGridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  participantsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent.cyanLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  participantsButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accent.cyan,
  },
  sectionTitle: {
    ...Typography.micro,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  participantsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
  },
  participant: {
    alignItems: 'center',
    width: 70,
  },
  participantAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  participantSpeaking: {
    borderWidth: 2,
    borderColor: Colors.accent.cyan,
  },
  participantInitial: {
    fontSize: Typography.headline.fontSize,
    fontWeight: '700',
  },
  mutedOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.background.primary,
    borderRadius: 8,
    padding: 2,
  },
  presenceIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: Colors.background.primary,
  },
  participantName: {
    color: Colors.text.primary,
    fontSize: Typography.small.fontSize,
    fontWeight: '500',
  },
  rolePill: {
    backgroundColor: Colors.background.tertiary,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  roleText: {
    ...Typography.micro,
    color: Colors.text.muted,
  },
  addParticipant: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.background.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: {
    color: Colors.text.muted,
    fontSize: 10,
    marginTop: 2,
  },
  transcriptCard: {
    marginBottom: Spacing.xl,
  },
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  transcriptTitle: {
    flex: 1,
    color: Colors.text.secondary,
    fontSize: Typography.captionMedium.fontSize,
  },
  expandButton: {
    padding: Spacing.xs,
  },
  transcriptContent: {
    gap: Spacing.md,
  },
  transcriptEntry: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  transcriptSpeaker: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '600',
    width: 50,
  },
  transcriptText: {
    flex: 1,
    color: Colors.text.secondary,
    fontSize: Typography.caption.fontSize,
    lineHeight: 20,
  },
  transcriptActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  transcriptActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accent.cyanDark,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  transcriptActionText: {
    ...Typography.micro,
    color: Colors.accent.cyan,
    fontWeight: '500',
  },
  transcriptNotice: {
    ...Typography.micro,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: Spacing.md,
    fontStyle: 'italic',
  },
  collapsedHint: {
    ...Typography.micro,
    color: Colors.text.muted,
    marginTop: Spacing.xs,
  },
  staffSection: {
    marginBottom: Spacing.xl,
  },
  staffRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  staffChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.background.secondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  staffDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  staffName: {
    color: Colors.text.secondary,
    fontSize: Typography.small.fontSize,
  },
  staffStateBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
    borderRadius: 4,
  },
  staffStateText: {
    ...Typography.micro,
    fontWeight: '600',
  },
  outputBadge: {
    backgroundColor: Colors.accent.cyan,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  outputText: {
    ...Typography.micro,
    color: Colors.background.primary,
    fontWeight: '700',
  },
  authoritySection: {
    marginBottom: Spacing.xl,
  },
  authoritySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAllText: {
    ...Typography.small,
    color: Colors.accent.cyan,
  },
  authorityCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  authorityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  authorityTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.sm,
  },
  riskBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  riskText: {
    ...Typography.micro,
    fontWeight: '600',
  },
  authorityDescription: {
    ...Typography.small,
    color: Colors.text.muted,
    marginBottom: Spacing.md,
  },
  whyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.accent.cyanDark,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  whyText: {
    ...Typography.micro,
    color: Colors.accent.cyan,
    flex: 1,
  },
  authorityActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  denyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.semantic.errorDark,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  denyText: {
    ...Typography.small,
    color: Colors.semantic.error,
    fontWeight: '600',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.semantic.successDark,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  approveText: {
    ...Typography.small,
    color: Colors.semantic.success,
    fontWeight: '600',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
    paddingBottom: 40,
    backgroundColor: Colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  controlButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  controlButtonActive: {
    backgroundColor: Colors.semantic.errorDark,
    borderColor: Colors.semantic.error,
  },
  controlButtonRaised: {
    backgroundColor: Colors.semantic.warningDark,
    borderColor: Colors.semantic.warning,
  },
  endCallButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.semantic.error,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '135deg' }],
  },
  chatBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.accent.cyan,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  chatBadgeText: {
    ...Typography.micro,
    color: Colors.background.primary,
    fontWeight: '700',
  },
});
