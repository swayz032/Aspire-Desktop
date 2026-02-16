import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { LineMode, TeamMember } from '@/types/frontdesk';

// ---------------------------------------------------------------------------
// Hero image
// ---------------------------------------------------------------------------
const HERO_IMAGE = require('@/assets/images/inbox-hero.jpg');

// ---------------------------------------------------------------------------
// Sarah voice ID for preview playback
// ---------------------------------------------------------------------------
const SARAH_VOICE_ID = 'DODLEQrClDo8wCz460ld';

// ---------------------------------------------------------------------------
// Local types (UI-only, not persisted)
// ---------------------------------------------------------------------------
type AfterHoursMode = 'TAKE_MESSAGE' | 'ASK_CALLBACK_TIME';
type BusyMode = 'TAKE_MESSAGE' | 'ASK_CALLBACK_TIME' | 'RETRY_ONCE';
type DetailLevel = 'FAST' | 'DETAILED';
type TargetType = 'OWNER' | 'SALES' | 'SUPPORT' | 'SCHEDULING' | 'MESSAGE_ONLY';

interface BusinessHours {
  [day: string]: { enabled: boolean; start: string; end: string };
}

interface ReasonConfig {
  detailLevel: DetailLevel;
  questionIds: string[];
  target: TargetType;
}

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------
const CALL_REASONS = [
  { id: 'sales', label: 'Sales & Pricing', description: 'Quote requests, pricing questions, new customer inquiries.', example: 'Can I get a quote?' },
  { id: 'scheduling', label: 'Scheduling', description: 'Book, change, or confirm pickup, delivery, or appointments.', example: 'Can we schedule for Friday?' },
  { id: 'support', label: 'Support & Issues', description: 'Problems, defects, service issues, urgent help.', example: 'Something arrived damaged.' },
  { id: 'orders', label: 'Order Updates', description: 'Status checks for orders or ongoing work.', example: "What's the status?" },
  { id: 'message', label: 'Message & Callback', description: 'Take a message and capture a callback time.', example: 'Please call me back.' },
];

const DEFAULT_QUESTIONS: Record<string, string[]> = {
  sales: ['What product or service are you interested in?', 'What is your timeline for this project?', 'Do you have a budget in mind?'],
  scheduling: ['What type of appointment do you need?', 'What day works best for you?', 'What time of day is preferred?'],
  support: ['What issue are you experiencing?', 'When did this problem start?', 'Is this urgent?'],
  orders: ['What is your order or reference number?', 'What would you like to know about your order?', 'When did you place this order?'],
  message: ['What is your name?', 'What is the best number to reach you?', 'When is a good time to call back?'],
};

const QUESTION_ALTERNATIVES: Record<string, string[][]> = {
  sales: [
    ['What product or service are you interested in?', 'What brings you to us today?', 'How can we help you?'],
    ['What is your timeline for this project?', 'When do you need this completed?', 'Is there any urgency?'],
    ['Do you have a budget in mind?', 'What size project is this?', 'Have you worked with a company like us before?'],
  ],
  scheduling: [
    ['What type of appointment do you need?', 'What service do you need scheduled?', 'How can I help you with scheduling?'],
    ['What day works best for you?', 'Do you have a preferred date?', 'Are there any days that don\'t work?'],
    ['What time of day is preferred?', 'Morning or afternoon?', 'Is there a specific time you need?'],
  ],
  support: [
    ['What issue are you experiencing?', 'What seems to be the problem?', 'How can I help you today?'],
    ['When did this problem start?', 'How long has this been happening?', 'Is this a new issue?'],
    ['Is this urgent?', 'Do you need immediate assistance?', 'How quickly do you need this resolved?'],
  ],
  orders: [
    ['What is your order or reference number?', 'Do you have a confirmation number?', 'What name is the order under?'],
    ['What would you like to know about your order?', 'Are you checking on delivery?', 'Is there a concern with your order?'],
    ['When did you place this order?', 'How long ago was this ordered?', 'Do you remember the date of purchase?'],
  ],
  message: [
    ['What is your name?', 'Who am I speaking with?', 'May I have your name?'],
    ['What is the best number to reach you?', 'What\'s a good callback number?', 'Where can we reach you?'],
    ['When is a good time to call back?', 'Is there a preferred time?', 'What time works for a callback?'],
  ],
};

const TARGET_OPTIONS: { value: TargetType; label: string }[] = [
  { value: 'OWNER', label: 'Me (Owner)' },
  { value: 'SALES', label: 'Sales' },
  { value: 'SUPPORT', label: 'Support' },
  { value: 'SCHEDULING', label: 'Scheduling' },
  { value: 'MESSAGE_ONLY', label: 'Take a message only' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const getDefaultBusinessHours = (): BusinessHours => {
  const hours: BusinessHours = {};
  DAYS.forEach((day, i) => {
    hours[day] = { enabled: i < 5, start: '09:00', end: '17:00' };
  });
  return hours;
};

// ===========================================================================
// Component
// ===========================================================================
export default function FrontDeskSetupScreen() {
  // --- loading / saving --------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // --- audio --------------------------------------------------------------
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  // --- form state ---------------------------------------------------------
  const [lineMode, setLineMode] = useState<LineMode>('ASPIRE_FULL_DUPLEX');
  const [existingNumber, setExistingNumber] = useState('');
  const [forwardingVerified, setForwardingVerified] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [businessHours, setBusinessHours] = useState<BusinessHours>(getDefaultBusinessHours());
  const [afterHoursMode, setAfterHoursMode] = useState<AfterHoursMode>('TAKE_MESSAGE');
  const [pronunciation, setPronunciation] = useState('');
  const [enabledReasons, setEnabledReasons] = useState<string[]>([]);
  const [reasonConfigs, setReasonConfigs] = useState<Record<string, ReasonConfig>>({});
  const [busyMode, setBusyMode] = useState<BusyMode>('TAKE_MESSAGE');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showTeam, setShowTeam] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'Sales' | 'Support' | 'Scheduling'>('Sales');
  const [previewReason, setPreviewReason] = useState<string>('');
  const [questionMenuOpen, setQuestionMenuOpen] = useState<{ reason: string; index: number } | null>(null);
  const [expandedReason, setExpandedReason] = useState<string | null>(null);

  // --- effects ------------------------------------------------------------
  useEffect(() => {
    loadSetup();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (enabledReasons.length > 0 && !previewReason) {
      setPreviewReason(enabledReasons[0]);
    }
  }, [enabledReasons]);

  // --- data loading -------------------------------------------------------
  const loadSetup = async () => {
    try {
      const res = await fetch('/api/frontdesk/setup');
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setLineMode(data.lineMode || 'ASPIRE_FULL_DUPLEX');
          setExistingNumber(data.existingNumber || '');
          setForwardingVerified(data.forwardingVerified || false);
          setBusinessName(data.businessName || '');
          setBusinessHours(data.businessHours || getDefaultBusinessHours());
          setAfterHoursMode(data.afterHoursMode || 'TAKE_MESSAGE');
          setPronunciation(data.pronunciation || '');
          setEnabledReasons(data.enabledReasons || []);
          setBusyMode(data.busyMode || 'TAKE_MESSAGE');
          setTeamMembers(data.teamMembers || []);

          const configs: Record<string, ReasonConfig> = {};
          (data.enabledReasons || []).forEach((r: string) => {
            configs[r] = {
              detailLevel: data.questionsByReason?.[r]?.detailLevel || 'FAST',
              questionIds: data.questionsByReason?.[r]?.questionIds || DEFAULT_QUESTIONS[r]?.slice(0, 2) || [],
              target: data.targetByReason?.[r]?.targetType || 'OWNER',
            };
          });
          setReasonConfigs(configs);
        }
      }
    } catch (_e) {
      // Silently handle — page still renders with defaults
    } finally {
      setLoading(false);
    }
  };

  // --- reason management --------------------------------------------------
  const toggleReason = (id: string) => {
    if (enabledReasons.includes(id)) {
      setEnabledReasons(enabledReasons.filter(r => r !== id));
      const newConfigs = { ...reasonConfigs };
      delete newConfigs[id];
      setReasonConfigs(newConfigs);
    } else {
      setEnabledReasons([...enabledReasons, id]);
      setReasonConfigs({
        ...reasonConfigs,
        [id]: {
          detailLevel: 'FAST',
          questionIds: DEFAULT_QUESTIONS[id]?.slice(0, 2) || [],
          target: 'OWNER',
        },
      });
    }
  };

  const updateReasonConfig = (id: string, updates: Partial<ReasonConfig>) => {
    const current = reasonConfigs[id] || { detailLevel: 'FAST' as DetailLevel, questionIds: [] as string[], target: 'OWNER' as TargetType };
    const updated = { ...current, ...updates };

    if (updates.detailLevel) {
      const count = updates.detailLevel === 'FAST' ? 2 : 3;
      updated.questionIds = (DEFAULT_QUESTIONS[id] || []).slice(0, count);
    }

    setReasonConfigs({ ...reasonConfigs, [id]: updated });
  };

  const changeQuestion = (reasonId: string, questionIndex: number, newQuestion: string) => {
    const config = reasonConfigs[reasonId];
    if (!config) return;
    const newQuestions = [...config.questionIds];
    newQuestions[questionIndex] = newQuestion;
    setReasonConfigs({
      ...reasonConfigs,
      [reasonId]: { ...config, questionIds: newQuestions },
    });
    setQuestionMenuOpen(null);
  };

  // --- team management ----------------------------------------------------
  const addTeamMember = () => {
    if (!newMemberName.trim()) return;
    const extension = `Ext ${101 + teamMembers.length}`;
    setTeamMembers([...teamMembers, { name: newMemberName.trim(), role: newMemberRole, extension }]);
    setNewMemberName('');
  };

  const removeTeamMember = (index: number) => {
    const updated = teamMembers.filter((_, i) => i !== index);
    updated.forEach((m, i) => {
      m.extension = `Ext ${101 + i}`;
    });
    setTeamMembers(updated);
  };

  // --- validation ---------------------------------------------------------
  const getValidationError = (): string | null => {
    if (!businessName.trim()) return 'Enter your business name.';
    if (enabledReasons.length === 0) return 'Enable at least one reason customers call.';
    for (const r of enabledReasons) {
      const config = reasonConfigs[r];
      if (!config?.target) {
        const label = CALL_REASONS.find(cr => cr.id === r)?.label || r;
        return `Pick who gets ${label} calls.`;
      }
      const count = config.detailLevel === 'FAST' ? 2 : 3;
      if (!config.questionIds || config.questionIds.length < count) {
        const label = CALL_REASONS.find(cr => cr.id === r)?.label || r;
        return `Select questions for ${label}.`;
      }
    }
    return null;
  };

  const isSetupComplete = (): boolean => !getValidationError();

  // --- save ---------------------------------------------------------------
  const saveSetup = async () => {
    const error = getValidationError();
    if (error) return;

    setSaving(true);
    setSaveSuccess(false);
    try {
      const questionsByReason: Record<string, { detailLevel: DetailLevel; questionIds: string[] }> = {};
      const targetByReason: Record<string, { targetType: TargetType }> = {};

      enabledReasons.forEach(r => {
        const config = reasonConfigs[r];
        questionsByReason[r] = { detailLevel: config.detailLevel, questionIds: config.questionIds };
        targetByReason[r] = { targetType: config.target };
      });

      const res = await fetch('/api/frontdesk/setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineMode,
          businessName,
          existingNumber: lineMode === 'EXISTING_INBOUND_ONLY' ? existingNumber : null,
          businessHours,
          afterHoursMode,
          pronunciation,
          enabledReasons,
          questionsByReason,
          targetByReason,
          busyMode,
          teamMembers,
          setupComplete: isSetupComplete(),
          greetingVoiceId: SARAH_VOICE_ID,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setShowTeam(false);
        setQuestionMenuOpen(null);
        setExpandedReason(null);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (_e) {
      // Network error — saving state resets below
    } finally {
      setSaving(false);
    }
  };

  // --- audio preview ------------------------------------------------------
  const playAudio = async (clipType: 'greeting' | 'example') => {
    if (playingAudio) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingAudio(null);
      return;
    }

    try {
      setPlayingAudio(clipType);

      const res = await fetch('/api/frontdesk/preview-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipType,
          businessName: businessName || 'Your Business',
          voiceId: SARAH_VOICE_ID,
        }),
      });

      if (!res.ok) {
        setPlayingAudio(null);
        return;
      }

      const data = await res.json();

      if (data.audioUrl && Platform.OS === 'web' && typeof window !== 'undefined') {
        const audio = new window.Audio(data.audioUrl);
        audioRef.current = audio;
        audio.onended = () => {
          setPlayingAudio(null);
          audioRef.current = null;
        };
        audio.onerror = () => {
          setPlayingAudio(null);
          audioRef.current = null;
        };
        await audio.play();
      } else {
        setPlayingAudio(null);
      }
    } catch (_e) {
      setPlayingAudio(null);
    }
  };

  // --- transcript preview -------------------------------------------------
  const getTranscriptPreview = () => {
    if (!previewReason) return null;
    const reason = CALL_REASONS.find(r => r.id === previewReason);
    const config = reasonConfigs[previewReason];
    if (!reason || !config) return null;

    const target = TARGET_OPTIONS.find(t => t.value === config.target)?.label || 'Owner';
    return {
      callerExample: reason.example,
      greeting: `Hi, this is Sarah, the AI assistant for ${businessName || 'your business'}. How can I help you today?`,
      questions: config.questionIds,
      target,
    };
  };

  const transcript = getTranscriptPreview();
  const validationError = getValidationError();

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------
  if (loading) {
    return (
      <DesktopShell>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingSpinner}>
            <Ionicons name="headset-outline" size={32} color={Colors.accent.cyan} />
          </View>
          <Text style={styles.loadingText}>Loading Front Desk...</Text>
        </View>
      </DesktopShell>
    );
  }

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------
  return (
    <DesktopShell>
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* ============================================================= */}
          {/* Hero Image Header                                             */}
          {/* ============================================================= */}
          <View style={styles.heroWrapper}>
            <ImageBackground
              source={HERO_IMAGE}
              style={styles.heroImageBackground}
              imageStyle={styles.heroImage}
            >
              <LinearGradient
                colors={['rgba(10,10,10,0.35)', 'rgba(10,10,10,0.85)']}
                style={styles.heroGradient}
              >
                <View style={styles.heroTopRow}>
                  <Badge label="FRONT DESK" variant="info" size="md" />
                  {isSetupComplete() && (
                    <Badge label="READY" variant="success" size="md" />
                  )}
                </View>
                <View style={styles.heroBottom}>
                  <Text style={styles.heroTitle}>Front Desk Setup</Text>
                  <Text style={styles.heroSubtitle}>
                    Configure what Sarah handles and who gets the call note.
                  </Text>
                </View>
              </LinearGradient>
            </ImageBackground>
          </View>

          {/* ============================================================= */}
          {/* Save bar                                                      */}
          {/* ============================================================= */}
          <View style={styles.saveBar}>
            <View style={styles.saveBarLeft}>
              {validationError ? (
                <View style={styles.readinessRow}>
                  <Ionicons name="warning" size={16} color={Colors.accent.amber} />
                  <Text style={styles.readinessWarningText}>{validationError}</Text>
                </View>
              ) : (
                <View style={styles.readinessRow}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.semantic.success} />
                  <Text style={styles.readinessReadyText}>Ready to turn on</Text>
                </View>
              )}
            </View>
            <Pressable
              style={[
                styles.saveButton,
                saving && styles.saveButtonDisabled,
                saveSuccess && styles.saveButtonSuccess,
              ]}
              onPress={saveSetup}
              disabled={saving}
              accessibilityLabel="Save front desk settings"
              accessibilityRole="button"
            >
              {saveSuccess ? (
                <>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={styles.saveButtonText}>Saved</Text>
                </>
              ) : (
                <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save changes'}</Text>
              )}
            </Pressable>
          </View>

          {/* ============================================================= */}
          {/* Two-column layout                                             */}
          {/* ============================================================= */}
          <View style={styles.columns}>
            {/* =========================================================== */}
            {/* Left Column — Configuration                                 */}
            {/* =========================================================== */}
            <View style={styles.leftColumn}>

              {/* --- Business Phone Line --------------------------------- */}
              <Card variant="default" padding="lg">
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconBox}>
                    <Ionicons name="call-outline" size={18} color={Colors.accent.cyan} />
                  </View>
                  <Text style={styles.cardTitle}>Business Phone Line</Text>
                </View>

                <View style={styles.radioGroup}>
                  <Pressable
                    style={[styles.radioCard, lineMode === 'ASPIRE_FULL_DUPLEX' && styles.radioCardSelected]}
                    onPress={() => setLineMode('ASPIRE_FULL_DUPLEX')}
                    accessibilityLabel="Get an Aspire business number"
                    accessibilityRole="radio"
                  >
                    <View style={styles.radioCircle}>
                      {lineMode === 'ASPIRE_FULL_DUPLEX' && <View style={styles.radioCircleFilled} />}
                    </View>
                    <View style={styles.radioContent}>
                      <Text style={styles.radioLabel}>Get an Aspire business number</Text>
                      <Text style={styles.radioHint}>Full duplex -- inbound and outbound</Text>
                    </View>
                    <View style={styles.chipGroup}>
                      <Badge label="Inbound ready" variant="success" size="sm" />
                      <Badge label="Outbound available" variant="info" size="sm" />
                    </View>
                  </Pressable>

                  <Pressable
                    style={[styles.radioCard, lineMode === 'EXISTING_INBOUND_ONLY' && styles.radioCardSelected]}
                    onPress={() => setLineMode('EXISTING_INBOUND_ONLY')}
                    accessibilityLabel="Use my existing business number"
                    accessibilityRole="radio"
                  >
                    <View style={styles.radioCircle}>
                      {lineMode === 'EXISTING_INBOUND_ONLY' && <View style={styles.radioCircleFilled} />}
                    </View>
                    <View style={styles.radioContent}>
                      <Text style={styles.radioLabel}>Use my existing business number</Text>
                      <Text style={styles.radioHint}>Inbound only -- forward calls to Aspire</Text>
                    </View>
                    <View style={styles.chipGroup}>
                      <Badge label="Outbound not available" variant="muted" size="sm" />
                    </View>
                  </Pressable>
                </View>

                {lineMode === 'EXISTING_INBOUND_ONLY' && (
                  <View style={styles.existingNumberSection}>
                    <Text style={styles.inputLabel}>Existing business number</Text>
                    <TextInput
                      style={styles.input}
                      value={existingNumber}
                      onChangeText={setExistingNumber}
                      placeholder="+1 (555) 123-4567"
                      placeholderTextColor={Colors.text.muted}
                      accessibilityLabel="Existing business number"
                    />
                    <Text style={styles.helperText}>
                      {forwardingVerified
                        ? 'Forwarding verified'
                        : 'Forwarding required. No calls received yet.'}
                    </Text>
                  </View>
                )}
              </Card>

              {/* --- Business Basics ------------------------------------- */}
              <Card variant="default" padding="lg">
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconBox}>
                    <Ionicons name="business-outline" size={18} color={Colors.accent.cyan} />
                  </View>
                  <Text style={styles.cardTitle}>Business Basics</Text>
                </View>

                <Text style={styles.inputLabel}>Business name</Text>
                <TextInput
                  style={styles.input}
                  value={businessName}
                  onChangeText={setBusinessName}
                  placeholder="Your Business Name"
                  placeholderTextColor={Colors.text.muted}
                  accessibilityLabel="Business name"
                />

                <Text style={[styles.inputLabel, { marginTop: Spacing.lg }]}>Business hours</Text>
                <View style={styles.hoursGrid}>
                  {DAYS.map(day => (
                    <View key={day} style={styles.hoursRow}>
                      <Pressable
                        style={styles.dayToggle}
                        onPress={() =>
                          setBusinessHours({
                            ...businessHours,
                            [day]: { ...businessHours[day], enabled: !businessHours[day].enabled },
                          })
                        }
                        accessibilityLabel={`Toggle ${day}`}
                        accessibilityRole="checkbox"
                      >
                        <View style={[styles.checkbox, businessHours[day].enabled && styles.checkboxChecked]}>
                          {businessHours[day].enabled && <Ionicons name="checkmark" size={12} color="#fff" />}
                        </View>
                        <Text style={styles.dayLabel}>{day.slice(0, 3)}</Text>
                      </Pressable>
                      {businessHours[day].enabled && (
                        <View style={styles.timeInputs}>
                          <TextInput
                            style={styles.timeInput}
                            value={businessHours[day].start}
                            onChangeText={v =>
                              setBusinessHours({
                                ...businessHours,
                                [day]: { ...businessHours[day], start: v },
                              })
                            }
                            placeholder="09:00"
                            placeholderTextColor={Colors.text.muted}
                          />
                          <Text style={styles.timeSeparator}>to</Text>
                          <TextInput
                            style={styles.timeInput}
                            value={businessHours[day].end}
                            onChangeText={v =>
                              setBusinessHours({
                                ...businessHours,
                                [day]: { ...businessHours[day], end: v },
                              })
                            }
                            placeholder="17:00"
                            placeholderTextColor={Colors.text.muted}
                          />
                        </View>
                      )}
                    </View>
                  ))}
                </View>

                <Text style={[styles.inputLabel, { marginTop: Spacing.lg }]}>After-hours handling</Text>
                <View style={styles.radioGroupSmall}>
                  <Pressable
                    style={[styles.radioSmall, afterHoursMode === 'TAKE_MESSAGE' && styles.radioSmallSelected]}
                    onPress={() => setAfterHoursMode('TAKE_MESSAGE')}
                    accessibilityRole="radio"
                  >
                    <View style={styles.radioCircleSmall}>
                      {afterHoursMode === 'TAKE_MESSAGE' && <View style={styles.radioCircleFilledSmall} />}
                    </View>
                    <Text style={styles.radioLabelSmall}>Take a message (recommended)</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.radioSmall, afterHoursMode === 'ASK_CALLBACK_TIME' && styles.radioSmallSelected]}
                    onPress={() => setAfterHoursMode('ASK_CALLBACK_TIME')}
                    accessibilityRole="radio"
                  >
                    <View style={styles.radioCircleSmall}>
                      {afterHoursMode === 'ASK_CALLBACK_TIME' && <View style={styles.radioCircleFilledSmall} />}
                    </View>
                    <Text style={styles.radioLabelSmall}>Ask for a callback time</Text>
                  </Pressable>
                </View>

                <Text style={[styles.inputLabel, { marginTop: Spacing.lg }]}>
                  How to say your business name (optional)
                </Text>
                <TextInput
                  style={styles.input}
                  value={pronunciation}
                  onChangeText={setPronunciation}
                  placeholder="e.g., Zen-ith So-LOO-shuns"
                  placeholderTextColor={Colors.text.muted}
                  accessibilityLabel="Business name pronunciation"
                />

                <View style={styles.lockedNotes}>
                  <View style={styles.lockedNote}>
                    <Ionicons name="lock-closed" size={14} color={Colors.text.muted} />
                    <Text style={styles.lockedNoteText}>Sarah always says she is A.I. and works for your business.</Text>
                  </View>
                  <View style={styles.lockedNote}>
                    <Ionicons name="lock-closed" size={14} color={Colors.text.muted} />
                    <Text style={styles.lockedNoteText}>Sarah never asks for billing or payment details.</Text>
                  </View>
                </View>
              </Card>

              {/* --- Call Reasons ----------------------------------------- */}
              <Card variant="default" padding="lg">
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconBox}>
                    <Ionicons name="chatbubbles-outline" size={18} color={Colors.accent.cyan} />
                  </View>
                  <View>
                    <Text style={styles.cardTitle}>Common reasons customers call</Text>
                    <Text style={styles.cardDescription}>Tap to enable. Expand to customize.</Text>
                  </View>
                </View>

                <View style={styles.reasonCards}>
                  {CALL_REASONS.map(reason => {
                    const enabled = enabledReasons.includes(reason.id);
                    const config = reasonConfigs[reason.id];
                    const isExpanded = expandedReason === reason.id;
                    return (
                      <View key={reason.id}>
                        <Pressable
                          style={[styles.reasonCard, enabled && styles.reasonCardEnabled]}
                          onPress={() => {
                            if (!enabled) {
                              toggleReason(reason.id);
                              setExpandedReason(reason.id);
                            } else {
                              setExpandedReason(isExpanded ? null : reason.id);
                            }
                          }}
                          accessibilityLabel={`${reason.label} call reason`}
                          accessibilityRole="checkbox"
                        >
                          <View style={styles.reasonHeader}>
                            <Pressable
                              style={[styles.checkbox, enabled && styles.checkboxChecked]}
                              onPress={e => {
                                e.stopPropagation();
                                toggleReason(reason.id);
                                if (enabled && expandedReason === reason.id) {
                                  setExpandedReason(null);
                                } else if (!enabled) {
                                  setExpandedReason(reason.id);
                                }
                              }}
                              accessibilityRole="checkbox"
                            >
                              {enabled && <Ionicons name="checkmark" size={12} color="#fff" />}
                            </Pressable>
                            <View style={styles.reasonInfo}>
                              <Text style={styles.reasonLabel}>{reason.label}</Text>
                              <Text style={styles.reasonDescription}>{reason.description}</Text>
                              <Text style={styles.reasonExample}>Example: "{reason.example}"</Text>
                            </View>
                            {enabled && (
                              <Ionicons
                                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                size={20}
                                color={Colors.text.muted}
                              />
                            )}
                          </View>
                        </Pressable>

                        {/* Expanded config */}
                        {enabled && config && isExpanded && (
                          <View style={styles.reasonExpanded}>
                            <Text style={styles.expandedLabel}>How detailed should Sarah be?</Text>
                            <View style={styles.segmentedControl}>
                              <Pressable
                                style={[styles.segment, config.detailLevel === 'FAST' && styles.segmentActive]}
                                onPress={() => updateReasonConfig(reason.id, { detailLevel: 'FAST' })}
                              >
                                <Text
                                  style={[
                                    styles.segmentText,
                                    config.detailLevel === 'FAST' && styles.segmentTextActive,
                                  ]}
                                >
                                  Fast (2 questions)
                                </Text>
                              </Pressable>
                              <Pressable
                                style={[styles.segment, config.detailLevel === 'DETAILED' && styles.segmentActive]}
                                onPress={() => updateReasonConfig(reason.id, { detailLevel: 'DETAILED' })}
                              >
                                <Text
                                  style={[
                                    styles.segmentText,
                                    config.detailLevel === 'DETAILED' && styles.segmentTextActive,
                                  ]}
                                >
                                  Detailed (3 questions)
                                </Text>
                              </Pressable>
                            </View>

                            <View style={styles.questionsList}>
                              {config.questionIds.map((q, i) => (
                                <View key={i} style={styles.questionRow}>
                                  <Text style={styles.questionNumber}>{i + 1}.</Text>
                                  <Text style={styles.questionText}>{q}</Text>
                                  <Pressable
                                    style={styles.changeButton}
                                    onPress={() => setQuestionMenuOpen({ reason: reason.id, index: i })}
                                  >
                                    <Text style={styles.changeButtonText}>Change</Text>
                                  </Pressable>
                                </View>
                              ))}
                            </View>

                            {questionMenuOpen?.reason === reason.id && (
                              <View style={styles.questionMenu}>
                                {QUESTION_ALTERNATIVES[reason.id]?.[questionMenuOpen.index]?.map((alt, ai) => (
                                  <Pressable
                                    key={ai}
                                    style={styles.questionMenuItem}
                                    onPress={() => changeQuestion(reason.id, questionMenuOpen.index, alt)}
                                  >
                                    <Text style={styles.questionMenuItemText}>{alt}</Text>
                                  </Pressable>
                                ))}
                              </View>
                            )}

                            <Text style={[styles.expandedLabel, { marginTop: Spacing.lg }]}>
                              Who should get the call note?
                            </Text>
                            <View style={styles.targetDropdown}>
                              {TARGET_OPTIONS.map(opt => (
                                <Pressable
                                  key={opt.value}
                                  style={[
                                    styles.targetOption,
                                    config.target === opt.value && styles.targetOptionSelected,
                                  ]}
                                  onPress={() => updateReasonConfig(reason.id, { target: opt.value })}
                                >
                                  <Text
                                    style={[
                                      styles.targetOptionText,
                                      config.target === opt.value && styles.targetOptionTextSelected,
                                    ]}
                                  >
                                    {opt.label}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </Card>

              {/* --- Busy Mode ------------------------------------------- */}
              <Card variant="default" padding="lg">
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconBox}>
                    <Ionicons name="time-outline" size={18} color={Colors.accent.cyan} />
                  </View>
                  <Text style={styles.cardTitle}>When we're busy</Text>
                </View>

                <View style={styles.radioGroupSmall}>
                  <Pressable
                    style={[styles.radioSmall, busyMode === 'TAKE_MESSAGE' && styles.radioSmallSelected]}
                    onPress={() => setBusyMode('TAKE_MESSAGE')}
                    accessibilityRole="radio"
                  >
                    <View style={styles.radioCircleSmall}>
                      {busyMode === 'TAKE_MESSAGE' && <View style={styles.radioCircleFilledSmall} />}
                    </View>
                    <Text style={styles.radioLabelSmall}>Take a message (recommended)</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.radioSmall, busyMode === 'ASK_CALLBACK_TIME' && styles.radioSmallSelected]}
                    onPress={() => setBusyMode('ASK_CALLBACK_TIME')}
                    accessibilityRole="radio"
                  >
                    <View style={styles.radioCircleSmall}>
                      {busyMode === 'ASK_CALLBACK_TIME' && <View style={styles.radioCircleFilledSmall} />}
                    </View>
                    <Text style={styles.radioLabelSmall}>Ask for a callback time</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.radioSmall, busyMode === 'RETRY_ONCE' && styles.radioSmallSelected]}
                    onPress={() => setBusyMode('RETRY_ONCE')}
                    accessibilityRole="radio"
                  >
                    <View style={styles.radioCircleSmall}>
                      {busyMode === 'RETRY_ONCE' && <View style={styles.radioCircleFilledSmall} />}
                    </View>
                    <Text style={styles.radioLabelSmall}>Try again once (30 seconds)</Text>
                  </Pressable>
                </View>
                <Text style={styles.helperText}>Sarah will always save a call note.</Text>
              </Card>

              {/* --- Team (Optional) ------------------------------------- */}
              <Card variant="default" padding="lg">
                <Pressable
                  style={styles.collapsibleHeader}
                  onPress={() => setShowTeam(!showTeam)}
                  accessibilityLabel="Toggle team section"
                  accessibilityRole="button"
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardIconBox}>
                      <Ionicons name="people-outline" size={18} color={Colors.accent.cyan} />
                    </View>
                    <Text style={styles.cardTitle}>Team (Optional)</Text>
                  </View>
                  <Ionicons name={showTeam ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.text.secondary} />
                </Pressable>

                {showTeam && (
                  <View style={styles.teamSection}>
                    <View style={styles.addMemberRow}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        value={newMemberName}
                        onChangeText={setNewMemberName}
                        placeholder="Team member name"
                        placeholderTextColor={Colors.text.muted}
                        accessibilityLabel="New team member name"
                      />
                      <View style={styles.roleSelector}>
                        {(['Sales', 'Support', 'Scheduling'] as const).map(role => (
                          <Pressable
                            key={role}
                            style={[styles.roleOption, newMemberRole === role && styles.roleOptionSelected]}
                            onPress={() => setNewMemberRole(role)}
                          >
                            <Text style={[styles.roleOptionText, newMemberRole === role && styles.roleOptionTextSelected]}>
                              {role}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <Pressable style={styles.addButton} onPress={addTeamMember} accessibilityLabel="Add team member">
                        <Ionicons name="add" size={20} color="#fff" />
                      </Pressable>
                    </View>

                    {teamMembers.map((member, i) => (
                      <View key={i} style={styles.teamMemberRow}>
                        <View style={styles.teamMemberAvatar}>
                          <Text style={styles.teamMemberInitial}>{member.name.charAt(0)}</Text>
                        </View>
                        <View style={styles.teamMemberInfo}>
                          <Text style={styles.teamMemberName}>{member.name}</Text>
                          <Text style={styles.teamMemberRole}>{member.role}</Text>
                        </View>
                        <Text style={styles.teamMemberExt}>{member.extension}</Text>
                        <Pressable onPress={() => removeTeamMember(i)} accessibilityLabel={`Remove ${member.name}`}>
                          <Ionicons name="close-circle" size={20} color={Colors.text.muted} />
                        </Pressable>
                      </View>
                    ))}

                    {teamMembers.length === 0 && (
                      <Text style={styles.emptyTeamText}>No team members added yet.</Text>
                    )}
                  </View>
                )}
              </Card>
            </View>

            {/* =========================================================== */}
            {/* Right Column — Preview                                      */}
            {/* =========================================================== */}
            <View style={styles.rightColumn}>
              {/* Readiness card */}
              <Card variant="default" padding="lg">
                {validationError ? (
                  <View style={styles.readinessRow}>
                    <Ionicons name="warning" size={18} color={Colors.accent.amber} />
                    <Text style={styles.readinessWarningText}>{validationError}</Text>
                  </View>
                ) : (
                  <View style={styles.readinessRow}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.semantic.success} />
                    <Text style={styles.readinessReadyText}>Ready to turn on</Text>
                  </View>
                )}
              </Card>

              {/* Live transcript preview */}
              <Card variant="default" padding="lg">
                <View style={styles.previewHeader}>
                  <View style={styles.cardIconBox}>
                    <Ionicons name="chatbox-ellipses-outline" size={16} color={Colors.accent.cyan} />
                  </View>
                  <Text style={styles.previewTitle}>What callers will hear</Text>
                </View>

                {enabledReasons.length > 0 && (
                  <View style={styles.previewDropdown}>
                    {enabledReasons.map(id => {
                      const reason = CALL_REASONS.find(r => r.id === id);
                      return (
                        <Pressable
                          key={id}
                          style={[styles.previewOption, previewReason === id && styles.previewOptionSelected]}
                          onPress={() => setPreviewReason(id)}
                        >
                          <Text
                            style={[
                              styles.previewOptionText,
                              previewReason === id && styles.previewOptionTextSelected,
                            ]}
                          >
                            {reason?.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {transcript ? (
                  <View style={styles.transcriptPreview}>
                    <View style={styles.transcriptLine}>
                      <Text style={styles.transcriptSpeaker}>Caller:</Text>
                      <Text style={styles.transcriptText}>"{transcript.callerExample}"</Text>
                    </View>
                    <View style={styles.transcriptLine}>
                      <Text style={styles.transcriptSpeakerSarah}>Sarah:</Text>
                      <Text style={styles.transcriptText}>{transcript.greeting}</Text>
                    </View>
                    {transcript.questions.map((q, i) => (
                      <View key={i} style={styles.transcriptLine}>
                        <Text style={styles.transcriptSpeakerSarah}>Sarah:</Text>
                        <Text style={styles.transcriptText}>{q}</Text>
                      </View>
                    ))}
                    <View style={styles.transcriptResult}>
                      <Ionicons name="document-text" size={14} color={Colors.text.muted} />
                      <Text style={styles.transcriptResultText}>
                        A call note is sent to: {transcript.target}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.emptyPreview}>
                    <Ionicons name="headset-outline" size={32} color={Colors.text.disabled} />
                    <Text style={styles.emptyPreviewText}>Enable a call reason to see the preview.</Text>
                  </View>
                )}

                <View style={styles.audioButtons}>
                  <Pressable
                    style={[styles.audioButton, playingAudio === 'greeting' && styles.audioButtonPlaying]}
                    onPress={() => playAudio('greeting')}
                    accessibilityLabel={playingAudio === 'greeting' ? 'Stop greeting' : 'Hear greeting'}
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name={playingAudio === 'greeting' ? 'stop' : 'play'}
                      size={16}
                      color={Colors.accent.cyan}
                    />
                    <Text style={styles.audioButtonText}>
                      {playingAudio === 'greeting' ? 'Stop' : 'Hear greeting'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.audioButton, playingAudio === 'example' && styles.audioButtonPlaying]}
                    onPress={() => playAudio('example')}
                    accessibilityLabel={playingAudio === 'example' ? 'Stop example' : 'Hear this example'}
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name={playingAudio === 'example' ? 'stop' : 'play'}
                      size={16}
                      color={Colors.accent.cyan}
                    />
                    <Text style={styles.audioButtonText}>
                      {playingAudio === 'example' ? 'Stop' : 'Hear this example'}
                    </Text>
                  </Pressable>
                </View>
              </Card>

              {/* Voice info card */}
              <Card variant="elevated" padding="lg">
                <View style={styles.voiceInfoRow}>
                  <View style={styles.voiceAvatar}>
                    <Ionicons name="mic" size={16} color={Colors.accent.cyan} />
                  </View>
                  <View style={styles.voiceInfoText}>
                    <Text style={styles.voiceInfoName}>Sarah</Text>
                    <Text style={styles.voiceInfoDesc}>AI Front Desk Agent</Text>
                  </View>
                  <Badge label="Active" variant="success" size="sm" />
                </View>
              </Card>
            </View>
          </View>
        </ScrollView>
      </View>
    </DesktopShell>
  );
}

// ===========================================================================
// Styles
// ===========================================================================
const styles = StyleSheet.create({
  // --- Layout -------------------------------------------------------------
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingSpinner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent.cyanLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },

  // --- Hero ---------------------------------------------------------------
  heroWrapper: {
    marginBottom: Spacing.xl,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  heroImageBackground: {
    height: 200,
  },
  heroImage: {
    borderRadius: BorderRadius.xl,
  },
  heroGradient: {
    flex: 1,
    padding: Spacing.xxl,
    justifyContent: 'space-between',
  },
  heroTopRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  heroBottom: {
    gap: Spacing.xs,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.75)',
  },

  // --- Save bar -----------------------------------------------------------
  saveBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.xs,
  },
  saveBarLeft: {
    flex: 1,
  },
  readinessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  readinessWarningText: {
    ...Typography.caption,
    color: Colors.accent.amber,
    flex: 1,
  },
  readinessReadyText: {
    ...Typography.captionMedium,
    color: Colors.semantic.success,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent.cyan,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonSuccess: {
    backgroundColor: Colors.semantic.success,
  },
  saveButtonText: {
    ...Typography.captionMedium,
    color: '#fff',
  },

  // --- Columns ------------------------------------------------------------
  columns: {
    flexDirection: 'row',
    gap: Spacing.xxl,
  },
  leftColumn: {
    flex: 1,
    gap: Spacing.lg,
  },
  rightColumn: {
    width: 370,
    gap: Spacing.lg,
    position: 'sticky' as unknown as undefined,
    top: Spacing.xxl,
    alignSelf: 'flex-start',
  },

  // --- Card header --------------------------------------------------------
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  cardIconBox: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent.cyanLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    ...Typography.bodyMedium,
    color: Colors.text.primary,
  },
  cardDescription: {
    ...Typography.small,
    color: Colors.text.secondary,
    marginTop: 2,
  },

  // --- Radio group --------------------------------------------------------
  radioGroup: {
    gap: Spacing.md,
  },
  radioCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    backgroundColor: Colors.background.secondary,
    gap: Spacing.md,
  },
  radioCardSelected: {
    borderColor: Colors.accent.cyan,
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border.default,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  radioCircleFilled: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent.cyan,
  },
  radioContent: {
    flex: 1,
  },
  radioLabel: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
  },
  radioHint: {
    ...Typography.small,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  chipGroup: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },

  // --- Existing number ----------------------------------------------------
  existingNumberSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },

  // --- Inputs -------------------------------------------------------------
  inputLabel: {
    ...Typography.smallMedium,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.surface.input,
    borderWidth: 1,
    borderColor: Colors.surface.inputBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.caption,
    color: Colors.text.primary,
  },
  helperText: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: Spacing.xs,
  },

  // --- Hours grid ---------------------------------------------------------
  hoursGrid: {
    gap: Spacing.sm,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  dayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: 80,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.border.default,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.accent.cyan,
    borderColor: Colors.accent.cyan,
  },
  dayLabel: {
    ...Typography.small,
    color: Colors.text.primary,
  },
  timeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  timeInput: {
    backgroundColor: Colors.surface.input,
    borderWidth: 1,
    borderColor: Colors.surface.inputBorder,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    ...Typography.small,
    color: Colors.text.primary,
    width: 70,
    textAlign: 'center',
  },
  timeSeparator: {
    ...Typography.small,
    color: Colors.text.muted,
  },

  // --- Radio small --------------------------------------------------------
  radioGroupSmall: {
    gap: Spacing.sm,
  },
  radioSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  radioSmallSelected: {},
  radioCircleSmall: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border.default,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleFilledSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent.cyan,
  },
  radioLabelSmall: {
    ...Typography.small,
    color: Colors.text.primary,
  },

  // --- Locked notes -------------------------------------------------------
  lockedNotes: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  lockedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  lockedNoteText: {
    ...Typography.small,
    color: Colors.text.muted,
    fontStyle: 'italic',
  },

  // --- Reason cards -------------------------------------------------------
  reasonCards: {
    gap: Spacing.sm,
  },
  reasonCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    backgroundColor: Colors.background.secondary,
  },
  reasonCardEnabled: {
    borderColor: Colors.accent.cyan,
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
  },
  reasonHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  reasonInfo: {
    flex: 1,
  },
  reasonLabel: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
  },
  reasonDescription: {
    ...Typography.small,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  reasonExample: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },

  // --- Reason expanded ----------------------------------------------------
  reasonExpanded: {
    paddingLeft: 30,
    paddingRight: 14,
    paddingBottom: 14,
    backgroundColor: 'rgba(59, 130, 246, 0.03)',
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
    marginTop: -8,
    paddingTop: Spacing.md,
  },
  expandedLabel: {
    ...Typography.smallMedium,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
    padding: 3,
    gap: Spacing.xs,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: Colors.accent.cyan,
  },
  segmentText: {
    ...Typography.small,
    color: Colors.text.secondary,
  },
  segmentTextActive: {
    color: '#fff',
    fontWeight: '500',
  },

  // --- Questions ----------------------------------------------------------
  questionsList: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  questionNumber: {
    ...Typography.small,
    color: Colors.text.muted,
    width: 16,
  },
  questionText: {
    flex: 1,
    ...Typography.small,
    color: Colors.text.primary,
  },
  changeButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  changeButtonText: {
    ...Typography.small,
    color: Colors.accent.cyan,
  },
  questionMenu: {
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    marginTop: Spacing.sm,
    overflow: 'hidden',
  },
  questionMenuItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  questionMenuItemText: {
    ...Typography.small,
    color: Colors.text.primary,
  },

  // --- Target dropdown ----------------------------------------------------
  targetDropdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  targetOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    backgroundColor: Colors.background.secondary,
  },
  targetOptionSelected: {
    borderColor: Colors.accent.cyan,
    backgroundColor: Colors.accent.cyanLight,
  },
  targetOptionText: {
    ...Typography.small,
    color: Colors.text.secondary,
  },
  targetOptionTextSelected: {
    color: Colors.accent.cyan,
    fontWeight: '500',
  },

  // --- Collapsible / Team -------------------------------------------------
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamSection: {
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  addMemberRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  roleSelector: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  roleOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background.secondary,
  },
  roleOptionSelected: {
    backgroundColor: Colors.accent.cyan,
  },
  roleOptionText: {
    ...Typography.small,
    color: Colors.text.secondary,
  },
  roleOptionTextSelected: {
    color: '#fff',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent.cyan,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
  },
  teamMemberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent.cyanLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamMemberInitial: {
    ...Typography.smallMedium,
    color: Colors.accent.cyan,
  },
  teamMemberInfo: {
    flex: 1,
  },
  teamMemberName: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
  },
  teamMemberRole: {
    ...Typography.small,
    color: Colors.text.secondary,
  },
  teamMemberExt: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  emptyTeamText: {
    ...Typography.small,
    color: Colors.text.muted,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },

  // --- Preview card -------------------------------------------------------
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  previewTitle: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
  },
  previewDropdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  previewOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background.secondary,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
  },
  previewOptionSelected: {
    borderColor: Colors.accent.cyan,
    backgroundColor: Colors.accent.cyanLight,
  },
  previewOptionText: {
    ...Typography.small,
    color: Colors.text.secondary,
  },
  previewOptionTextSelected: {
    color: Colors.accent.cyan,
    fontWeight: '500',
  },

  // --- Transcript ---------------------------------------------------------
  transcriptPreview: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  transcriptLine: {
    gap: Spacing.xs,
  },
  transcriptSpeaker: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted,
  },
  transcriptSpeakerSarah: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.accent.cyan,
  },
  transcriptText: {
    ...Typography.small,
    color: Colors.text.primary,
    lineHeight: 18,
  },
  transcriptResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    marginTop: Spacing.sm,
  },
  transcriptResultText: {
    ...Typography.small,
    color: Colors.text.secondary,
  },

  // --- Empty preview ------------------------------------------------------
  emptyPreview: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xxl,
  },
  emptyPreviewText: {
    ...Typography.small,
    color: Colors.text.muted,
    textAlign: 'center',
  },

  // --- Audio buttons ------------------------------------------------------
  audioButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  audioButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent.cyan,
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
  },
  audioButtonPlaying: {
    backgroundColor: Colors.accent.cyanLight,
  },
  audioButtonText: {
    ...Typography.small,
    color: Colors.accent.cyan,
    fontWeight: '500',
  },

  // --- Voice info card ----------------------------------------------------
  voiceInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  voiceAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent.cyanLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceInfoText: {
    flex: 1,
  },
  voiceInfoName: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
  },
  voiceInfoDesc: {
    ...Typography.small,
    color: Colors.text.muted,
  },
});
