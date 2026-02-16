import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Platform, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { PageHeader } from '@/components/PageHeader';
import { OfficeStoreCard, OfficeStoreStaff } from '@/components/OfficeStoreCard';
import { useDesktop } from '@/lib/useDesktop';

const officeStoreStaff: OfficeStoreStaff[] = [
  {
    id: 'staff_eli',
    name: 'Eli',
    role: 'Inbox Specialist',
    state: 'active',
    headline: 'Reply fast. Never drop follow-ups.',
    description: 'Triages your business inbox, drafts replies and follow-ups, and queues everything for approval with a receipt trail.',
    bullets: [
      'Summarizes threads and flags urgent messages',
      'Drafts replies + follow-ups for approval',
      'Receipts for what was sent and why',
    ],
    avatarImage: require('@/assets/avatars/eli.png'),
    introVideoUrl: '/staff-intros/eli.mp4',
  },
  {
    id: 'staff_sarah',
    name: 'Sarah',
    role: 'Front Desk Specialist',
    state: 'active',
    headline: 'Stop missing calls — and stop getting interrupted.',
    description: 'Answers your business number, captures structured intake, and routes each request to the right next step.',
    bullets: [
      'Answers calls and captures lead/support/vendor intent',
      'Drafts call summary + next steps for approval',
      'Receipts for call outcomes and dispositions',
    ],
    avatarImage: require('@/assets/avatars/sarah.png'),
    introVideoUrl: '/staff-intros/sarah.mp4',
  },
  {
    id: 'staff_clara',
    name: 'Clara',
    role: 'Legal Desk (Contracts + e-Signature)',
    state: 'active',
    headline: 'Get contracts signed without the back-and-forth.',
    description: 'Drafts agreements from your templates, prepares signature packets, and tracks status—always with approvals and receipts.',
    bullets: [
      'Drafts from approved templates + intake details',
      'Preps sends + reminders for approval',
      'Receipts for versions, sends, and signatures',
    ],
    avatarImage: require('@/assets/avatars/clara.png'),
    introVideoUrl: '/staff-intros/clara.mp4',
  },
  {
    id: 'staff_nora',
    name: 'Nora',
    role: 'Conference Room Assistant',
    state: 'active',
    headline: 'Cleaner meetings. Fewer no-shows.',
    description: 'Sets up your conference room workflow—invites, confirmations, reminders, and approved recap packs.',
    bullets: [
      'Sends invites + reminders for approval',
      'Recording/transcripts: ON, ASK, or OFF',
      'Recap pack: notes + action items (approved)',
    ],
    avatarImage: require('@/assets/avatars/nora.png'),
    introVideoUrl: '/staff-intros/nora.mp4',
  },
  {
    id: 'staff_quinn',
    name: 'Quinn',
    role: 'Invoices & Quotes Specialist',
    state: 'active',
    headline: 'Send quotes and invoices on time—get paid faster.',
    description: 'Drafts quotes and invoices, prepares follow-ups, and tracks billing events with approval gates and receipts.',
    bullets: [
      'Drafts quotes/invoices for approval',
      'Queues follow-ups without you chasing',
      'Receipts for invoice and payment events',
    ],
    avatarImage: require('@/assets/avatars/quinn.png'),
    introVideoUrl: '/staff-intros/quinn.mp4',
  },
];
import { DesktopPageWrapper } from '@/components/desktop/DesktopPageWrapper';

type TabType = 'staff' | 'addons';

function VideoPlayerModal({
  videoUrl,
  staffName,
  visible,
  onClose,
}: {
  videoUrl: string;
  staffName: string;
  visible: boolean;
  onClose: () => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  if (!visible) return null;

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <Animated.View style={[videoStyles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={videoStyles.backdrop} onPress={handleClose} />
        <Animated.View style={[videoStyles.content, { transform: [{ scale: scaleAnim }] }]}>
          <View style={videoStyles.header}>
            <Text style={videoStyles.title}>Meet {staffName}</Text>
            <Pressable onPress={handleClose} style={({ pressed }) => [videoStyles.closeBtn, pressed && { opacity: 0.7 }]}>
              <Ionicons name="close" size={24} color={Colors.text.primary} />
            </Pressable>
          </View>
          <View style={videoStyles.videoContainer}>
            {Platform.OS === 'web' ? (
              <video
                src={videoUrl}
                controls
                autoPlay
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 12,
                  backgroundColor: '#000',
                }}
              />
            ) : (
              <View style={videoStyles.nativeMessage}>
                <Ionicons name="desktop-outline" size={48} color={Colors.text.muted} />
                <Text style={videoStyles.nativeText}>Intro videos play on desktop.</Text>
              </View>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const videoStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    width: '100%',
    maxWidth: 800,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    color: Colors.text.primary,
    fontSize: Typography.title.fontSize,
    fontWeight: '600',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#242426',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoContainer: {
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  nativeMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  nativeText: {
    color: Colors.text.muted,
    fontSize: Typography.body.fontSize,
  },
});

function StaffProfileModal({ 
  staff, 
  visible, 
  onClose,
  onWatchIntro,
}: { 
  staff: OfficeStoreStaff | null; 
  visible: boolean; 
  onClose: () => void;
  onWatchIntro: () => void;
}) {
  if (!staff) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { pointerEvents: 'box-none' }]}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={[styles.modalContent, { pointerEvents: 'auto' }]}>
          <View style={styles.modalHandle} />
          
          <View style={styles.profileHeader}>
            <Image source={staff.avatarImage} style={styles.profileAvatar} />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{staff.name}</Text>
              <Text style={styles.profileRole}>{staff.role}</Text>
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <Ionicons name="close" size={24} color={Colors.text.secondary} />
            </Pressable>
          </View>

          <Text style={styles.profileHeadline}>{staff.headline}</Text>
          
          <ScrollView style={styles.profileScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.profileDescription}>{staff.description}</Text>
            
            <View style={styles.profileSection}>
              <Text style={styles.sectionTitle}>Key Capabilities</Text>
              {staff.bullets.map((bullet, index) => (
                <View key={index} style={styles.profileBullet}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.semantic.success} />
                  <Text style={styles.profileBulletText}>{bullet}</Text>
                </View>
              ))}
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.sectionTitle}>Governance</Text>
              <View style={styles.governanceItem}>
                <Ionicons name="arrow-forward-circle" size={18} color={Colors.accent.cyan} />
                <Text style={styles.governanceText}>Draft → Approve → Execute → Receipt</Text>
              </View>
              <View style={styles.governanceItem}>
                <Ionicons name="shield-checkmark" size={18} color={Colors.accent.cyan} />
                <Text style={styles.governanceText}>Nothing sends without approval</Text>
              </View>
              <View style={styles.governanceItem}>
                <Ionicons name="document-text" size={18} color={Colors.accent.cyan} />
                <Text style={styles.governanceText}>Receipts for every important action</Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.profileActions}>
            {staff.introVideoUrl && (
              <Pressable 
                style={({ pressed }) => [styles.watchIntroBtn, pressed && styles.pressed]}
                onPress={onWatchIntro}
              >
                <Ionicons name="play-circle" size={20} color={Colors.accent.cyan} />
                <Text style={styles.watchIntroBtnText}>Watch Intro</Text>
              </Pressable>
            )}
            <Pressable style={({ pressed }) => [styles.profilePrimaryBtn, pressed && styles.pressed]}>
              <Text style={styles.profilePrimaryBtnText}>
                {staff.state === 'active' ? 'Manage Settings' : 'Enable Staff'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function OfficeStoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDesktop = useDesktop();
  const [activeTab, setActiveTab] = useState<TabType>('staff');
  const [selectedStaff, setSelectedStaff] = useState<OfficeStoreStaff | null>(null);
  const [profileVisible, setProfileVisible] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);

  const headerHeight = isDesktop ? 0 : insets.top + 60;
  const activeStaff = officeStoreStaff.filter(s => s.state === 'active');
  const availableStaff = officeStoreStaff.filter(s => s.state === 'available');
  const comingSoonStaff = officeStoreStaff.filter(s => s.state === 'coming_soon');

  const handleViewProfile = (staff: OfficeStoreStaff) => {
    setSelectedStaff(staff);
    setProfileVisible(true);
  };

  const handleSecondaryAction = (staff: OfficeStoreStaff) => {
    setSelectedStaff(staff);
    setProfileVisible(true);
  };

  const handleWatchIntro = () => {
    setProfileVisible(false);
    setTimeout(() => setVideoVisible(true), 200);
  };

  const content = (
    <View style={styles.container}>
      {!isDesktop && <PageHeader title="Office Store" showBackButton />}

      <View style={[styles.contentWrapper, { paddingTop: headerHeight }]}>
        <View style={styles.tabContainer}>
          <Pressable 
            style={[styles.tab, activeTab === 'staff' && styles.tabActive]}
            onPress={() => setActiveTab('staff')}
          >
            <Ionicons 
              name="people" 
              size={18} 
              color={activeTab === 'staff' ? Colors.accent.cyan : Colors.text.muted} 
            />
            <Text style={[styles.tabText, activeTab === 'staff' && styles.tabTextActive]}>
              Staff Members
            </Text>
          </Pressable>
          <Pressable 
            style={[styles.tab, activeTab === 'addons' && styles.tabActive]}
            onPress={() => setActiveTab('addons')}
          >
            <Ionicons 
              name="cube" 
              size={18} 
              color={activeTab === 'addons' ? Colors.accent.cyan : Colors.text.muted} 
            />
            <Text style={[styles.tabText, activeTab === 'addons' && styles.tabTextActive]}>
              Suite & Office Add-ons
            </Text>
          </Pressable>
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'staff' ? (
            <>
              {activeStaff.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>Active</Text>
                    <Text style={styles.sectionCount}>{activeStaff.length}</Text>
                  </View>
                  {activeStaff.map((staff) => (
                    <OfficeStoreCard
                      key={staff.id}
                      staff={staff}
                      onPrimaryAction={() => handleViewProfile(staff)}
                      onSecondaryAction={() => handleSecondaryAction(staff)}
                    />
                  ))}
                </View>
              )}

              {availableStaff.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>Available</Text>
                    <Text style={styles.sectionCount}>{availableStaff.length}</Text>
                  </View>
                  {availableStaff.map((staff) => (
                    <OfficeStoreCard
                      key={staff.id}
                      staff={staff}
                      onPrimaryAction={() => handleViewProfile(staff)}
                      onSecondaryAction={() => handleSecondaryAction(staff)}
                    />
                  ))}
                </View>
              )}

              {comingSoonStaff.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>Coming Soon</Text>
                    <Text style={styles.sectionCount}>{comingSoonStaff.length}</Text>
                  </View>
                  {comingSoonStaff.map((staff) => (
                    <OfficeStoreCard
                      key={staff.id}
                      staff={staff}
                      onPrimaryAction={() => handleViewProfile(staff)}
                      onSecondaryAction={() => handleSecondaryAction(staff)}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color={Colors.text.muted} />
              <Text style={styles.emptyTitle}>Coming Soon</Text>
              <Text style={styles.emptyText}>
                Suite and Office add-ons will be available here. Expand your virtual office with premium capabilities.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      <StaffProfileModal
        staff={selectedStaff}
        visible={profileVisible}
        onClose={() => setProfileVisible(false)}
        onWatchIntro={handleWatchIntro}
      />

      {selectedStaff?.introVideoUrl && (
        <VideoPlayerModal
          videoUrl={selectedStaff.introVideoUrl}
          staffName={selectedStaff.name}
          visible={videoVisible}
          onClose={() => setVideoVisible(false)}
        />
      )}
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
  },
  contentWrapper: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  tabActive: {
    backgroundColor: '#242426',
  },
  tabText: {
    color: Colors.text.muted,
    fontSize: Typography.caption.fontSize,
    fontWeight: '500',
  },
  tabTextActive: {
    color: Colors.accent.cyan,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    color: Colors.text.secondary,
    fontSize: Typography.captionMedium.fontSize,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    color: Colors.text.muted,
    fontSize: Typography.small.fontSize,
    backgroundColor: '#242426',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    color: Colors.text.primary,
    fontSize: Typography.headline.fontSize,
    fontWeight: '600',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    color: Colors.text.tertiary,
    fontSize: Typography.caption.fontSize,
    textAlign: 'center',
    maxWidth: 280,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  pressed: {
    opacity: 0.7,
  },
  modalContent: {
    backgroundColor: Colors.background.secondary,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 40,
    maxHeight: '85%',
    zIndex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomWidth: 0,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#343436',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: Spacing.md,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: Colors.text.primary,
    fontSize: Typography.title.fontSize,
    fontWeight: '600',
  },
  profileRole: {
    color: Colors.accent.cyan,
    fontSize: Typography.caption.fontSize,
  },
  closeButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: '#1E1E20',
  },
  profileHeadline: {
    color: Colors.text.primary,
    fontSize: Typography.body.fontSize,
    fontWeight: '700',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  profileScroll: {
    flex: 1,
  },
  profileDescription: {
    color: Colors.text.secondary,
    fontSize: Typography.body.fontSize,
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  profileSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: Typography.captionMedium.fontSize,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  profileBullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  profileBulletText: {
    color: Colors.text.secondary,
    fontSize: Typography.body.fontSize,
    flex: 1,
    lineHeight: 22,
  },
  governanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  governanceText: {
    color: Colors.text.secondary,
    fontSize: Typography.body.fontSize,
  },
  profileActions: {
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: Spacing.md,
  },
  watchIntroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  watchIntroBtnText: {
    color: Colors.accent.cyan,
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: '600',
  },
  profilePrimaryBtn: {
    backgroundColor: Colors.accent.cyan,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  profilePrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: '600',
  },
});
