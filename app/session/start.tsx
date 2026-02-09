import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { SessionPurpose, SessionMode } from '@/types/session';
import { AVAILABLE_STAFF, createSession } from '@/data/session';
import { mockTenant } from '@/data/mockData';

const PURPOSES: { id: SessionPurpose; label: string; icon: keyof typeof Ionicons.glyphMap; description: string }[] = [
  { id: 'Internal', label: 'Internal', icon: 'business', description: 'Team sync or planning session' },
  { id: 'Networking', label: 'Networking', icon: 'people', description: 'Connect with industry contacts' },
  { id: 'Client Call', label: 'Client Call', icon: 'person', description: 'Client meeting or follow-up' },
  { id: 'Vendor Call', label: 'Vendor Call', icon: 'storefront', description: 'Vendor discussion or negotiation' },
  { id: 'Deal Review', label: 'Deal Review', icon: 'briefcase', description: 'Review and approve deals' },
];

const MODES: { id: SessionMode; label: string; icon: keyof typeof Ionicons.glyphMap; description: string }[] = [
  { id: 'voice', label: 'Voice', icon: 'mic', description: 'Audio-only session' },
  { id: 'video', label: 'Video', icon: 'videocam', description: 'Video conference' },
  { id: 'conference', label: 'Conference', icon: 'people-circle', description: 'Full conference room' },
];

export default function StartSessionScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [purpose, setPurpose] = useState<SessionPurpose | null>(null);
  const [mode, setMode] = useState<SessionMode | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string[]>(['staff-eli', 'staff-quinn']);

  const toggleStaff = (staffId: string) => {
    setSelectedStaff(prev => 
      prev.includes(staffId) 
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  };

  const handleStart = () => {
    if (!purpose || !mode) return;
    
    const staffParticipants = AVAILABLE_STAFF
      .filter(s => selectedStaff.includes(s.id))
      .map(s => ({
        id: s.id,
        name: s.name,
        role: 'AI' as const,
        initial: s.name.charAt(0),
        color: s.avatarColor,
        isSpeaking: false,
        isMuted: false,
        presence: 'good' as const,
      }));

    createSession(purpose, mode, staffParticipants);

    if (mode === 'conference') {
      router.push('/session/conference');
    } else if (mode === 'video') {
      router.push('/session/video');
    } else {
      router.push('/session/voice');
    }
  };

  const canProceed = () => {
    if (step === 1) return purpose !== null;
    if (step === 2) return true;
    if (step === 3) return mode !== null;
    return false;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={Colors.text.secondary} />
        </Pressable>
        <Text style={styles.headerTitle}>Start Session</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.progressContainer}>
        {[1, 2, 3].map((s) => (
          <View 
            key={s} 
            style={[
              styles.progressDot,
              s === step && styles.progressDotActive,
              s < step && styles.progressDotComplete
            ]} 
          />
        ))}
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identityBar}>
          <View style={styles.identityDot} />
          <Text style={styles.identityText}>
            {mockTenant.businessName} • Suite {mockTenant.suiteId}
          </Text>
        </View>

        {step === 1 && (
          <>
            <Text style={styles.stepTitle}>Session Purpose</Text>
            <Text style={styles.stepSubtitle}>What's this session about?</Text>
            
            <View style={styles.optionsGrid}>
              {PURPOSES.map((p) => (
                <Pressable
                  key={p.id}
                  style={[
                    styles.optionCard,
                    purpose === p.id && styles.optionCardSelected
                  ]}
                  onPress={() => setPurpose(p.id)}
                >
                  <View style={[styles.optionIcon, purpose === p.id && styles.optionIconSelected]}>
                    <Ionicons 
                      name={p.icon} 
                      size={24} 
                      color={purpose === p.id ? Colors.accent.cyan : Colors.text.muted} 
                    />
                  </View>
                  <Text style={[styles.optionLabel, purpose === p.id && styles.optionLabelSelected]}>
                    {p.label}
                  </Text>
                  <Text style={styles.optionDescription}>{p.description}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.stepTitle}>AI Staff</Text>
            <Text style={styles.stepSubtitle}>Select AI staff to join the session</Text>
            
            <View style={styles.participantSection}>
              <View style={styles.hostCard}>
                <View style={styles.hostAvatar}>
                  <Text style={styles.hostInitial}>Y</Text>
                </View>
                <View style={styles.hostInfo}>
                  <Text style={styles.hostName}>You</Text>
                  <Text style={styles.hostRole}>Session Host</Text>
                </View>
                <View style={styles.hostBadge}>
                  <Text style={styles.hostBadgeText}>HOST</Text>
                </View>
              </View>
            </View>
            
            <Text style={styles.sectionLabel}>Available AI Staff</Text>
            
            <View style={styles.staffList}>
              {AVAILABLE_STAFF.map((staff) => (
                <Pressable
                  key={staff.id}
                  style={[
                    styles.staffCard,
                    selectedStaff.includes(staff.id) && styles.staffCardSelected
                  ]}
                  onPress={() => toggleStaff(staff.id)}
                >
                  <View style={[styles.staffAvatar, { backgroundColor: staff.avatarColor + '20' }]}>
                    <Text style={[styles.staffInitial, { color: staff.avatarColor }]}>
                      {staff.name.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.staffInfo}>
                    <Text style={styles.staffName}>{staff.name}</Text>
                    <Text style={styles.staffRole}>{staff.role}</Text>
                  </View>
                  <View style={[
                    styles.checkbox,
                    selectedStaff.includes(staff.id) && styles.checkboxSelected
                  ]}>
                    {selectedStaff.includes(staff.id) && (
                      <Ionicons name="checkmark" size={16} color={Colors.background.primary} />
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.stepTitle}>Session Mode</Text>
            <Text style={styles.stepSubtitle}>How do you want to connect?</Text>
            
            <View style={styles.modesGrid}>
              {MODES.map((m) => (
                <Pressable
                  key={m.id}
                  style={[
                    styles.modeCard,
                    mode === m.id && styles.modeCardSelected
                  ]}
                  onPress={() => setMode(m.id)}
                >
                  <View style={[styles.modeIcon, mode === m.id && styles.modeIconSelected]}>
                    <Ionicons 
                      name={m.icon} 
                      size={32} 
                      color={mode === m.id ? Colors.accent.cyan : Colors.text.muted} 
                    />
                  </View>
                  <Text style={[styles.modeLabel, mode === m.id && styles.modeLabelSelected]}>
                    {m.label}
                  </Text>
                  <Text style={styles.modeDescription}>{m.description}</Text>
                </Pressable>
              ))}
            </View>
            
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Session Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Purpose:</Text>
                <Text style={styles.summaryValue}>{purpose}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>AI Staff:</Text>
                <Text style={styles.summaryValue}>{selectedStaff.length} selected</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Recording:</Text>
                <Text style={styles.summaryValue}>Enabled</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 1 && (
          <Pressable style={styles.backStepButton} onPress={() => setStep(step - 1)}>
            <Text style={styles.backStepText}>Back</Text>
          </Pressable>
        )}
        <Pressable 
          style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled]}
          onPress={() => {
            if (step < 3) {
              setStep(step + 1);
            } else {
              handleStart();
            }
          }}
          disabled={!canProceed()}
        >
          <Text style={styles.nextButtonText}>
            {step === 3 ? 'Start Session' : 'Continue'}
          </Text>
          <Ionicons 
            name={step === 3 ? 'mic' : 'arrow-forward'} 
            size={18} 
            color={Colors.background.primary} 
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
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
  headerTitle: {
    flex: 1,
    ...Typography.headline,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.background.tertiary,
  },
  progressDotActive: {
    backgroundColor: Colors.accent.cyan,
    width: 24,
  },
  progressDotComplete: {
    backgroundColor: Colors.semantic.success,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 120,
  },
  identityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
  },
  identityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.semantic.success,
  },
  identityText: {
    color: Colors.text.muted,
    fontSize: Typography.small.fontSize,
  },
  stepTitle: {
    ...Typography.title,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  stepSubtitle: {
    ...Typography.body,
    color: Colors.text.muted,
    marginBottom: Spacing.xl,
  },
  optionsGrid: {
    gap: Spacing.md,
  },
  optionCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  optionCardSelected: {
    borderColor: Colors.accent.cyan,
    backgroundColor: Colors.accent.cyanDark,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  optionIconSelected: {
    backgroundColor: Colors.background.primary,
  },
  optionLabel: {
    ...Typography.headline,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  optionLabelSelected: {
    color: Colors.accent.cyan,
  },
  optionDescription: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  participantSection: {
    marginBottom: Spacing.lg,
  },
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  hostAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  hostInitial: {
    ...Typography.headline,
    color: Colors.accent.cyan,
    fontWeight: '700',
  },
  hostInfo: {
    flex: 1,
  },
  hostName: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  hostRole: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  hostBadge: {
    backgroundColor: Colors.accent.cyanDark,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  hostBadgeText: {
    ...Typography.micro,
    color: Colors.accent.cyan,
    fontWeight: '700',
  },
  sectionLabel: {
    ...Typography.small,
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  staffList: {
    gap: Spacing.sm,
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  staffCardSelected: {
    borderColor: Colors.accent.cyan,
  },
  staffAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  staffInitial: {
    ...Typography.body,
    fontWeight: '600',
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  staffRole: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.accent.cyan,
    borderColor: Colors.accent.cyan,
  },
  modesGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  modeCard: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  modeCardSelected: {
    borderColor: Colors.accent.cyan,
    backgroundColor: Colors.accent.cyanDark,
  },
  modeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  modeIconSelected: {
    backgroundColor: Colors.background.primary,
  },
  modeLabel: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  modeLabelSelected: {
    color: Colors.accent.cyan,
  },
  modeDescription: {
    ...Typography.micro,
    color: Colors.text.muted,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  summaryTitle: {
    ...Typography.small,
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    ...Typography.body,
    color: Colors.text.muted,
  },
  summaryValue: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
    paddingBottom: 40,
    backgroundColor: Colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  backStepButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backStepText: {
    ...Typography.body,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent.cyan,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    ...Typography.body,
    color: Colors.background.primary,
    fontWeight: '600',
  },
});
