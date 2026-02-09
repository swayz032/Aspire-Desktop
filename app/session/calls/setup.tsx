import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { DesktopShell } from '@/components/desktop/DesktopShell';

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const VOICE_ID = 'uMM5TEnpKKgD758knVJO';

type LineMode = 'ASPIRE_NUMBER' | 'EXISTING_NUMBER_INBOUND_ONLY';
type AfterHoursMode = 'TAKE_MESSAGE' | 'ASK_CALLBACK_TIME';
type BusyMode = 'TAKE_MESSAGE' | 'ASK_CALLBACK_TIME' | 'RETRY_ONCE';
type DetailLevel = 'FAST' | 'DETAILED';
type TargetType = 'OWNER' | 'SALES' | 'SUPPORT' | 'SCHEDULING' | 'MESSAGE_ONLY';

interface BusinessHours {
  [day: string]: { enabled: boolean; start: string; end: string };
}

interface TeamMember {
  name: string;
  role: 'Sales' | 'Support' | 'Scheduling';
  extension: string;
}

interface ReasonConfig {
  detailLevel: DetailLevel;
  questionIds: string[];
  target: TargetType;
}

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

const TARGET_OPTIONS = [
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

export default function FrontDeskSetupScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  const [lineMode, setLineMode] = useState<LineMode>('ASPIRE_NUMBER');
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

  const loadSetup = async () => {
    try {
      const res = await fetch(`/api/frontdesk/setup?userId=${DEMO_USER_ID}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setLineMode(data.lineMode || 'ASPIRE_NUMBER');
          setExistingNumber(data.existingNumberE164 || '');
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
    } catch (e) {
      console.error('Failed to load setup', e);
    } finally {
      setLoading(false);
    }
  };

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
    const current = reasonConfigs[id] || { detailLevel: 'FAST', questionIds: [], target: 'OWNER' };
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

  const addTeamMember = () => {
    if (!newMemberName.trim()) return;
    const extension = `Ext ${101 + teamMembers.length}`;
    setTeamMembers([...teamMembers, { name: newMemberName.trim(), role: newMemberRole, extension }]);
    setNewMemberName('');
  };

  const removeTeamMember = (index: number) => {
    const updated = teamMembers.filter((_, i) => i !== index);
    updated.forEach((m, i) => { m.extension = `Ext ${101 + i}`; });
    setTeamMembers(updated);
  };

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

  const isSetupComplete = (): boolean => {
    return !getValidationError();
  };

  const saveSetup = async () => {
    const error = getValidationError();
    if (error) {
      return;
    }

    setSaving(true);
    try {
      const questionsByReason: Record<string, any> = {};
      const targetByReason: Record<string, any> = {};
      
      enabledReasons.forEach(r => {
        const config = reasonConfigs[r];
        questionsByReason[r] = { detailLevel: config.detailLevel, questionIds: config.questionIds };
        targetByReason[r] = { targetType: config.target };
      });

      const res = await fetch('/api/frontdesk/setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          lineMode,
          existingNumberE164: lineMode === 'EXISTING_NUMBER_INBOUND_ONLY' ? existingNumber : null,
          businessName,
          businessHours,
          afterHoursMode,
          pronunciation,
          enabledReasons,
          questionsByReason,
          targetByReason,
          busyMode,
          teamMembers,
          setupComplete: isSetupComplete(),
        }),
      });
      
      if (res.ok) {
        setShowTeam(false);
        setQuestionMenuOpen(null);
        setExpandedReason(null);
      }
    } catch (e) {
      console.error('Save failed', e);
    } finally {
      setSaving(false);
    }
  };

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
      console.log('Requesting audio preview:', { clipType, reason: previewReason, businessName });
      
      const res = await fetch('/api/frontdesk/preview-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipType,
          reason: previewReason,
          businessName: businessName || 'Your Business',
          voiceId: VOICE_ID,
        }),
      });
      
      console.log('Audio API response status:', res.status);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Audio API error:', errorData);
        setPlayingAudio(null);
        return;
      }
      
      const data = await res.json();
      console.log('Audio URL received:', data.audioUrl ? 'Yes' : 'No');
      
      if (data.audioUrl && Platform.OS === 'web' && typeof window !== 'undefined') {
        const audio = new window.Audio(data.audioUrl);
        audioRef.current = audio;
        audio.onended = () => {
          console.log('Audio playback ended');
          setPlayingAudio(null);
          audioRef.current = null;
        };
        audio.onerror = (e) => {
          console.error('Audio element error:', e);
          setPlayingAudio(null);
          audioRef.current = null;
        };
        audio.oncanplaythrough = () => {
          console.log('Audio ready to play');
        };
        await audio.play();
        console.log('Audio play() called');
      } else {
        console.error('No audio URL in response or not web platform');
        setPlayingAudio(null);
      }
    } catch (e) {
      console.error('Audio playback failed:', e);
      setPlayingAudio(null);
    }
  };

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

  if (loading) {
    return (
      <DesktopShell>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </DesktopShell>
    );
  }

  return (
    <DesktopShell>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Front Desk Setup</Text>
            <Text style={styles.subtitle}>Choose what Sarah handles and who gets the call note.</Text>
          </View>
          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={saveSetup}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save changes'}</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.columns} showsVerticalScrollIndicator={false} contentContainerStyle={styles.columnsContent}>
          <View style={styles.leftColumn}>
            {/* Business Phone Line */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Business Phone Line</Text>
              <View style={styles.radioGroup}>
                <Pressable
                  style={[styles.radioCard, lineMode === 'ASPIRE_NUMBER' && styles.radioCardSelected]}
                  onPress={() => setLineMode('ASPIRE_NUMBER')}
                >
                  <View style={styles.radioCircle}>
                    {lineMode === 'ASPIRE_NUMBER' && <View style={styles.radioCircleFilled} />}
                  </View>
                  <View style={styles.radioContent}>
                    <Text style={styles.radioLabel}>Get an Aspire business number</Text>
                    <Text style={styles.radioHint}>Recommended</Text>
                  </View>
                  <View style={styles.chipGroup}>
                    <View style={styles.chipSuccess}><Text style={styles.chipText}>Inbound ready</Text></View>
                    <View style={styles.chipAccent}><Text style={styles.chipText}>Outbound available</Text></View>
                  </View>
                </Pressable>

                <Pressable
                  style={[styles.radioCard, lineMode === 'EXISTING_NUMBER_INBOUND_ONLY' && styles.radioCardSelected]}
                  onPress={() => setLineMode('EXISTING_NUMBER_INBOUND_ONLY')}
                >
                  <View style={styles.radioCircle}>
                    {lineMode === 'EXISTING_NUMBER_INBOUND_ONLY' && <View style={styles.radioCircleFilled} />}
                  </View>
                  <View style={styles.radioContent}>
                    <Text style={styles.radioLabel}>Use my existing business number</Text>
                    <Text style={styles.radioHint}>Inbound only</Text>
                  </View>
                  <View style={styles.chipGroup}>
                    <View style={styles.chipMuted}><Text style={styles.chipTextMuted}>Outbound not available</Text></View>
                  </View>
                </Pressable>
              </View>

              {lineMode === 'EXISTING_NUMBER_INBOUND_ONLY' && (
                <View style={styles.existingNumberSection}>
                  <Text style={styles.inputLabel}>Existing business number</Text>
                  <TextInput
                    style={styles.input}
                    value={existingNumber}
                    onChangeText={setExistingNumber}
                    placeholder="+1 (555) 123-4567"
                    placeholderTextColor={Colors.text.muted}
                  />
                  <Text style={styles.helperText}>
                    {forwardingVerified ? '✓ Forwarding verified' : 'Forwarding required. No calls received yet.'}
                  </Text>
                </View>
              )}
            </View>

            {/* Business Basics */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Business Basics</Text>
              
              <Text style={styles.inputLabel}>Business name</Text>
              <TextInput
                style={styles.input}
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="Your Business Name"
                placeholderTextColor={Colors.text.muted}
              />

              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Business hours</Text>
              <View style={styles.hoursGrid}>
                {DAYS.map(day => (
                  <View key={day} style={styles.hoursRow}>
                    <Pressable
                      style={styles.dayToggle}
                      onPress={() => setBusinessHours({
                        ...businessHours,
                        [day]: { ...businessHours[day], enabled: !businessHours[day].enabled }
                      })}
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
                          onChangeText={(v) => setBusinessHours({
                            ...businessHours,
                            [day]: { ...businessHours[day], start: v }
                          })}
                          placeholder="09:00"
                          placeholderTextColor={Colors.text.muted}
                        />
                        <Text style={styles.timeSeparator}>to</Text>
                        <TextInput
                          style={styles.timeInput}
                          value={businessHours[day].end}
                          onChangeText={(v) => setBusinessHours({
                            ...businessHours,
                            [day]: { ...businessHours[day], end: v }
                          })}
                          placeholder="17:00"
                          placeholderTextColor={Colors.text.muted}
                        />
                      </View>
                    )}
                  </View>
                ))}
              </View>

              <Text style={[styles.inputLabel, { marginTop: 16 }]}>After-hours handling</Text>
              <View style={styles.radioGroupSmall}>
                <Pressable
                  style={[styles.radioSmall, afterHoursMode === 'TAKE_MESSAGE' && styles.radioSmallSelected]}
                  onPress={() => setAfterHoursMode('TAKE_MESSAGE')}
                >
                  <View style={styles.radioCircleSmall}>
                    {afterHoursMode === 'TAKE_MESSAGE' && <View style={styles.radioCircleFilledSmall} />}
                  </View>
                  <Text style={styles.radioLabelSmall}>Take a message (recommended)</Text>
                </Pressable>
                <Pressable
                  style={[styles.radioSmall, afterHoursMode === 'ASK_CALLBACK_TIME' && styles.radioSmallSelected]}
                  onPress={() => setAfterHoursMode('ASK_CALLBACK_TIME')}
                >
                  <View style={styles.radioCircleSmall}>
                    {afterHoursMode === 'ASK_CALLBACK_TIME' && <View style={styles.radioCircleFilledSmall} />}
                  </View>
                  <Text style={styles.radioLabelSmall}>Ask for a callback time</Text>
                </Pressable>
              </View>

              <Text style={[styles.inputLabel, { marginTop: 16 }]}>How to say your business name (optional)</Text>
              <TextInput
                style={styles.input}
                value={pronunciation}
                onChangeText={setPronunciation}
                placeholder="e.g., Zen-ith So-LOO-shuns"
                placeholderTextColor={Colors.text.muted}
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
            </View>

            {/* Common reasons customers call */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Common reasons customers call</Text>
              <Text style={styles.cardDescription}>Tap to enable. Expand to customize.</Text>
              
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
                      >
                        <View style={styles.reasonHeader}>
                          <Pressable 
                            style={[styles.checkbox, enabled && styles.checkboxChecked]}
                            onPress={(e) => {
                              e.stopPropagation();
                              toggleReason(reason.id);
                              if (enabled && expandedReason === reason.id) {
                                setExpandedReason(null);
                              } else if (!enabled) {
                                setExpandedReason(reason.id);
                              }
                            }}
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
                              name={isExpanded ? "chevron-up" : "chevron-down"} 
                              size={20} 
                              color={Colors.text.muted} 
                            />
                          )}
                        </View>
                      </Pressable>

                      {enabled && config && isExpanded && (
                        <View style={styles.reasonExpanded}>
                          <Text style={styles.expandedLabel}>How detailed should Sarah be?</Text>
                          <View style={styles.segmentedControl}>
                            <Pressable
                              style={[styles.segment, config.detailLevel === 'FAST' && styles.segmentActive]}
                              onPress={() => updateReasonConfig(reason.id, { detailLevel: 'FAST' })}
                            >
                              <Text style={[styles.segmentText, config.detailLevel === 'FAST' && styles.segmentTextActive]}>Fast (2 questions)</Text>
                            </Pressable>
                            <Pressable
                              style={[styles.segment, config.detailLevel === 'DETAILED' && styles.segmentActive]}
                              onPress={() => updateReasonConfig(reason.id, { detailLevel: 'DETAILED' })}
                            >
                              <Text style={[styles.segmentText, config.detailLevel === 'DETAILED' && styles.segmentTextActive]}>Detailed (3 questions)</Text>
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

                          <Text style={[styles.expandedLabel, { marginTop: 16 }]}>Who should get the call note?</Text>
                          <View style={styles.targetDropdown}>
                            {TARGET_OPTIONS.map(opt => (
                              <Pressable
                                key={opt.value}
                                style={[styles.targetOption, config.target === opt.value && styles.targetOptionSelected]}
                                onPress={() => updateReasonConfig(reason.id, { target: opt.value as TargetType })}
                              >
                                <Text style={[styles.targetOptionText, config.target === opt.value && styles.targetOptionTextSelected]}>
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
            </View>

            {/* When we're busy */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>When we're busy</Text>
              <View style={styles.radioGroupSmall}>
                <Pressable
                  style={[styles.radioSmall, busyMode === 'TAKE_MESSAGE' && styles.radioSmallSelected]}
                  onPress={() => setBusyMode('TAKE_MESSAGE')}
                >
                  <View style={styles.radioCircleSmall}>
                    {busyMode === 'TAKE_MESSAGE' && <View style={styles.radioCircleFilledSmall} />}
                  </View>
                  <Text style={styles.radioLabelSmall}>Take a message (recommended)</Text>
                </Pressable>
                <Pressable
                  style={[styles.radioSmall, busyMode === 'ASK_CALLBACK_TIME' && styles.radioSmallSelected]}
                  onPress={() => setBusyMode('ASK_CALLBACK_TIME')}
                >
                  <View style={styles.radioCircleSmall}>
                    {busyMode === 'ASK_CALLBACK_TIME' && <View style={styles.radioCircleFilledSmall} />}
                  </View>
                  <Text style={styles.radioLabelSmall}>Ask for a callback time</Text>
                </Pressable>
                <Pressable
                  style={[styles.radioSmall, busyMode === 'RETRY_ONCE' && styles.radioSmallSelected]}
                  onPress={() => setBusyMode('RETRY_ONCE')}
                >
                  <View style={styles.radioCircleSmall}>
                    {busyMode === 'RETRY_ONCE' && <View style={styles.radioCircleFilledSmall} />}
                  </View>
                  <Text style={styles.radioLabelSmall}>Try again once (30 seconds)</Text>
                </Pressable>
              </View>
              <Text style={styles.helperText}>Sarah will always save a call note.</Text>
            </View>

            {/* Team (Optional) */}
            <View style={styles.card}>
              <Pressable style={styles.collapsibleHeader} onPress={() => setShowTeam(!showTeam)}>
                <Text style={styles.cardTitle}>Team (Optional)</Text>
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
                    />
                    <View style={styles.roleSelector}>
                      {(['Sales', 'Support', 'Scheduling'] as const).map(role => (
                        <Pressable
                          key={role}
                          style={[styles.roleOption, newMemberRole === role && styles.roleOptionSelected]}
                          onPress={() => setNewMemberRole(role)}
                        >
                          <Text style={[styles.roleOptionText, newMemberRole === role && styles.roleOptionTextSelected]}>{role}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable style={styles.addButton} onPress={addTeamMember}>
                      <Ionicons name="add" size={20} color="#fff" />
                    </Pressable>
                  </View>

                  {teamMembers.map((member, i) => (
                    <View key={i} style={styles.teamMemberRow}>
                      <View style={styles.teamMemberInfo}>
                        <Text style={styles.teamMemberName}>{member.name}</Text>
                        <Text style={styles.teamMemberRole}>{member.role}</Text>
                      </View>
                      <Text style={styles.teamMemberExt}>{member.extension}</Text>
                      <Pressable onPress={() => removeTeamMember(i)}>
                        <Ionicons name="close-circle" size={20} color={Colors.text.muted} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Right Column - Preview */}
          <View style={styles.rightColumn}>
            <View style={styles.readinessCard}>
              {validationError ? (
                <View style={styles.readinessWarning}>
                  <Ionicons name="warning" size={18} color="#f59e0b" />
                  <Text style={styles.readinessWarningText}>{validationError}</Text>
                </View>
              ) : (
                <View style={styles.readinessReady}>
                  <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                  <Text style={styles.readinessReadyText}>Ready to turn on</Text>
                </View>
              )}
            </View>

            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>What callers will hear</Text>
              
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
                        <Text style={[styles.previewOptionText, previewReason === id && styles.previewOptionTextSelected]}>
                          {reason?.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {transcript && (
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
                    <Text style={styles.transcriptResultText}>A call note is sent to: {transcript.target}</Text>
                  </View>
                </View>
              )}

              <View style={styles.audioButtons}>
                <Pressable
                  style={[styles.audioButton, playingAudio === 'greeting' && styles.audioButtonPlaying]}
                  onPress={() => playAudio('greeting')}
                >
                  <Ionicons name={playingAudio === 'greeting' ? 'stop' : 'play'} size={16} color={Colors.accent.cyan} />
                  <Text style={styles.audioButtonText}>{playingAudio === 'greeting' ? 'Stop' : 'Hear greeting'}</Text>
                </Pressable>
                <Pressable
                  style={[styles.audioButton, playingAudio === 'example' && styles.audioButtonPlaying]}
                  onPress={() => playAudio('example')}
                >
                  <Ionicons name={playingAudio === 'example' ? 'stop' : 'play'} size={16} color={Colors.accent.cyan} />
                  <Text style={styles.audioButtonText}>{playingAudio === 'example' ? 'Stop' : 'Hear this example'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </DesktopShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.text.secondary,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: Colors.accent.cyan,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  columns: {
    flex: 1,
  },
  columnsContent: {
    flexDirection: 'row',
    padding: 24,
    gap: 24,
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    width: 360,
    gap: 16,
    position: 'sticky' as any,
    top: 24,
    alignSelf: 'flex-start',
  },
  card: {
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  cardDescription: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  radioGroup: {
    gap: 12,
  },
  radioCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.secondary,
    gap: 12,
  },
  radioCardSelected: {
    borderColor: Colors.accent.cyan,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
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
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  radioHint: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  chipGroup: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  chipSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  chipAccent: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  chipMuted: {
    backgroundColor: 'rgba(113, 113, 122, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 11,
    color: Colors.text.primary,
  },
  chipTextMuted: {
    fontSize: 11,
    color: Colors.text.muted,
  },
  existingNumberSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.background.secondary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text.primary,
  },
  helperText: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 6,
  },
  hoursGrid: {
    gap: 8,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 80,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
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
    fontSize: 13,
    color: Colors.text.primary,
  },
  timeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInput: {
    backgroundColor: Colors.background.secondary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: Colors.text.primary,
    width: 70,
    textAlign: 'center',
  },
  timeSeparator: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  radioGroupSmall: {
    gap: 8,
  },
  radioSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
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
    fontSize: 13,
    color: Colors.text.primary,
  },
  lockedNotes: {
    marginTop: 16,
    gap: 8,
  },
  lockedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedNoteText: {
    fontSize: 12,
    color: Colors.text.muted,
    fontStyle: 'italic',
  },
  reasonCards: {
    gap: 8,
  },
  reasonCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.secondary,
  },
  reasonCardEnabled: {
    borderColor: Colors.accent.cyan,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  reasonHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  reasonInfo: {
    flex: 1,
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  reasonDescription: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  reasonExample: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  reasonExpanded: {
    paddingLeft: 30,
    paddingRight: 14,
    paddingBottom: 14,
    backgroundColor: 'rgba(59, 130, 246, 0.02)',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    marginTop: -8,
    paddingTop: 12,
  },
  expandedLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Colors.background.secondary,
    borderRadius: 8,
    padding: 3,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: Colors.accent.cyan,
  },
  segmentText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  segmentTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  questionsList: {
    marginTop: 12,
    gap: 8,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  questionNumber: {
    fontSize: 12,
    color: Colors.text.muted,
    width: 16,
  },
  questionText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.primary,
  },
  changeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  changeButtonText: {
    fontSize: 12,
    color: Colors.accent.cyan,
  },
  questionMenu: {
    backgroundColor: Colors.background.primary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    marginTop: 8,
    overflow: 'hidden',
  },
  questionMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  questionMenuItemText: {
    fontSize: 13,
    color: Colors.text.primary,
  },
  targetDropdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  targetOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.secondary,
  },
  targetOptionSelected: {
    borderColor: Colors.accent.cyan,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  targetOptionText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  targetOptionTextSelected: {
    color: Colors.accent.cyan,
    fontWeight: '500',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamSection: {
    marginTop: 12,
    gap: 12,
  },
  addMemberRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 4,
  },
  roleOption: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: Colors.background.secondary,
  },
  roleOptionSelected: {
    backgroundColor: Colors.accent.cyan,
  },
  roleOptionText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  roleOptionTextSelected: {
    color: '#fff',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.accent.cyan,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.background.secondary,
    borderRadius: 8,
  },
  teamMemberInfo: {
    flex: 1,
  },
  teamMemberName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  teamMemberRole: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  teamMemberExt: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  readinessCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  readinessWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readinessWarningText: {
    fontSize: 13,
    color: '#f59e0b',
    flex: 1,
  },
  readinessReady: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readinessReadyText: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '500',
  },
  previewCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  previewDropdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  previewOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.background.secondary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  previewOptionSelected: {
    borderColor: Colors.accent.cyan,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  previewOptionText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  previewOptionTextSelected: {
    color: Colors.accent.cyan,
    fontWeight: '500',
  },
  transcriptPreview: {
    gap: 12,
    marginBottom: 16,
  },
  transcriptLine: {
    gap: 4,
  },
  transcriptSpeaker: {
    fontSize: 11,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  transcriptSpeakerSarah: {
    fontSize: 11,
    color: Colors.accent.cyan,
    fontWeight: '500',
  },
  transcriptText: {
    fontSize: 13,
    color: Colors.text.primary,
    lineHeight: 18,
  },
  transcriptResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    marginTop: 8,
  },
  transcriptResultText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  audioButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  audioButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.accent.cyan,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  audioButtonPlaying: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  audioButtonText: {
    fontSize: 12,
    color: Colors.accent.cyan,
    fontWeight: '500',
  },
});
