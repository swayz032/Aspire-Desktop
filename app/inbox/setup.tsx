import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { LinearGradient } from 'expo-linear-gradient';
import type { MailProvider, MailOnboardingState, OnboardingCheck, DnsPlanRecord, MailSetupReceipt, DomainMode } from '@/types/mailbox';

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const STEPS = ['Choose Provider', 'Configure', 'Verify', 'Enable Eli'];

const DNS_MOCK: DnsPlanRecord[] = [
  { type: 'MX', host: '@', value: 'mail.aspire.email', ttl: 3600 },
  { type: 'SPF', host: '@', value: 'v=spf1 include:aspire.email ~all', ttl: 3600 },
  { type: 'DKIM', host: 'aspire._domainkey', value: 'v=DKIM1; k=rsa; p=MIIBIjANBgkq...', ttl: 3600 },
  { type: 'DMARC', host: '_dmarc', value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@aspire.email', ttl: 3600 },
];

export default function MailboxSetupScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [onboarding, setOnboarding] = useState<MailOnboardingState>({});
  const [receipts, setReceipts] = useState<MailSetupReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [mailboxInput, setMailboxInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [domainMode, setDomainMode] = useState<DomainMode>('EXISTING_DOMAIN');
  const [completed, setCompleted] = useState(false);
  const [activatedEmail, setActivatedEmail] = useState('');
  const [checksRunning, setChecksRunning] = useState(false);

  useEffect(() => {
    fetchOnboarding();
    fetchReceipts();
  }, []);

  const fetchOnboarding = async () => {
    try {
      const res = await fetch(`/api/mail/onboarding?userId=${DEMO_USER_ID}`);
      if (res.ok) {
        const data = await res.json();
        setOnboarding(data);
        if (data.provider) setCurrentStep(1);
        if (data.checks?.length) setCurrentStep(2);
        if (data.eli) setCurrentStep(3);
      }
    } catch (e) { console.error(e); }
  };

  const fetchReceipts = async () => {
    try {
      const res = await fetch(`/api/mail/receipts?userId=${DEMO_USER_ID}`);
      if (res.ok) {
        const data = await res.json();
        setReceipts(data.receipts || []);
      }
    } catch (e) { console.error(e); }
  };

  const patchOnboarding = async (updates: Partial<MailOnboardingState>) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/mail/onboarding?userId=${DEMO_USER_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, userId: DEMO_USER_ID }),
      });
      if (res.ok) {
        const data = await res.json();
        setOnboarding(data);
        fetchReceipts();
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSelectProvider = async (provider: MailProvider) => {
    await patchOnboarding({ provider });
    setCurrentStep(1);
  };

  const handleSaveDomain = async () => {
    if (!domainInput.trim()) return;
    const mailboxes = mailboxInput.trim()
      ? [{ email: `${mailboxInput.trim()}@${domainInput.trim()}`, displayName: displayNameInput.trim() || undefined }]
      : [{ email: `hello@${domainInput.trim()}`, displayName: 'Business Email' }];
    await patchOnboarding({
      domain: domainInput.trim(),
      domainMode,
      mailboxes,
      dnsPlan: DNS_MOCK.map(r => ({ ...r, host: r.host === '@' ? domainInput.trim() : `${r.host}.${domainInput.trim()}` })),
    });
    setCurrentStep(2);
  };

  const handleConnectGoogle = async () => {
    await patchOnboarding({
      oauthStatus: {
        connectedEmail: 'user@workspace.google.com',
        scopes: ['gmail.readonly', 'gmail.send', 'gmail.labels', 'gmail.modify'],
      },
      mailboxes: [{ email: 'user@workspace.google.com', displayName: 'Google Workspace' }],
    });
    setCurrentStep(2);
  };

  const handleRunChecks = async () => {
    setChecksRunning(true);
    try {
      const res = await fetch(`/api/mail/onboarding/checks/run?userId=${DEMO_USER_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: DEMO_USER_ID }),
      });
      if (res.ok) {
        const data = await res.json();
        setOnboarding(prev => ({ ...prev, checks: data.checks }));
        fetchReceipts();
      }
    } catch (e) { console.error(e); }
    setChecksRunning(false);
  };

  const handleSaveEli = async () => {
    const eli = onboarding.eli || {
      canDraft: true,
      canSend: false,
      externalApprovalRequired: true,
      attachmentsAlwaysApproval: true,
      rateLimitPreset: 'CONSERVATIVE' as const,
    };
    await patchOnboarding({ eli });
  };

  const handleActivate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/mail/onboarding/activate?userId=${DEMO_USER_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: DEMO_USER_ID }),
      });
      if (res.ok) {
        const data = await res.json();
        setActivatedEmail(data.account?.email || '');
        setCompleted(true);
        fetchReceipts();
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const updateEli = (key: string, value: any) => {
    setOnboarding(prev => ({
      ...prev,
      eli: {
        canDraft: true,
        canSend: false,
        externalApprovalRequired: true,
        attachmentsAlwaysApproval: true,
        rateLimitPreset: 'CONSERVATIVE' as const,
        ...prev.eli,
        [key]: value,
      },
    }));
  };

  if (completed) {
    return (
      <DesktopShell>
        <View style={s.page}>
          <View style={s.completionContainer}>
            <View style={s.completionIcon}>
              <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
            </View>
            <Text style={s.completionTitle}>Mailbox Active</Text>
            <Text style={s.completionSubtitle}>
              Your mailbox <Text style={s.completionEmail}>{activatedEmail}</Text> is now ready.
            </Text>
            <View style={s.completionBadge}>
              <View style={s.providerDot} />
              <Text style={s.completionBadgeText}>
                {onboarding.provider === 'GOOGLE' ? 'Google Workspace' : 'Aspire Business Email'}
              </Text>
            </View>
            <View style={s.completionActions}>
              <Pressable
                style={({ hovered }: any) => [s.primaryBtn, hovered && s.primaryBtnHover]}
                onPress={() => router.push('/(tabs)/inbox' as any)}
              >
                <Ionicons name="mail" size={18} color="#fff" />
                <Text style={s.primaryBtnText}>Go to Inbox → Mail</Text>
              </Pressable>
              <Pressable
                style={({ hovered }: any) => [s.secondaryBtn, hovered && s.secondaryBtnHover]}
                onPress={() => { setCompleted(false); setCurrentStep(0); setOnboarding({}); }}
              >
                <Ionicons name="add-circle-outline" size={18} color={Colors.text.secondary} />
                <Text style={s.secondaryBtnText}>Add another mailbox</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </DesktopShell>
    );
  }

  return (
    <DesktopShell>
      <View style={s.page}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <Pressable onPress={() => router.back()} style={({ hovered }: any) => [s.backBtn, hovered && s.backBtnHover]}>
                <Ionicons name="arrow-back" size={18} color={Colors.text.secondary} />
              </Pressable>
              <View>
                <Text style={s.headerTitle}>Mailbox Setup</Text>
                <Text style={s.headerSubtitle}>Provision Aspire Business Email or connect Google Workspace / Gmail.</Text>
              </View>
            </View>
            <View style={s.headerRight}>
              <Pressable
                style={({ hovered }: any) => [s.headerAction, hovered && s.headerActionHover]}
                onPress={() => router.push('/(tabs)/receipts' as any)}
              >
                <Ionicons name="receipt-outline" size={16} color={Colors.text.secondary} />
                <Text style={s.headerActionText}>View Receipts</Text>
              </Pressable>
              <Pressable style={({ hovered }: any) => [s.headerAction, hovered && s.headerActionHover]}>
                <Ionicons name="help-circle-outline" size={16} color={Colors.text.secondary} />
                <Text style={s.headerActionText}>Help</Text>
              </Pressable>
            </View>
          </View>

          {/* Two-column body */}
          <View style={s.body}>
            {/* Left column: Stepper + Content */}
            <View style={s.leftCol}>
              {/* Stepper */}
              <View style={s.stepper}>
                {STEPS.map((step, i) => {
                  const isActive = i === currentStep;
                  const isDone = i < currentStep;
                  return (
                    <Pressable
                      key={i}
                      style={s.stepRow}
                      onPress={() => { if (isDone) setCurrentStep(i); }}
                    >
                      <View style={[s.stepCircle, isActive && s.stepCircleActive, isDone && s.stepCircleDone]}>
                        {isDone ? (
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        ) : (
                          <Text style={[s.stepNumber, isActive && s.stepNumberActive]}>{i}</Text>
                        )}
                      </View>
                      {i < STEPS.length - 1 && (
                        <View style={[s.stepLine, isDone && s.stepLineDone]} />
                      )}
                      <Text style={[s.stepLabel, isActive && s.stepLabelActive, isDone && s.stepLabelDone]}>{step}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Step content */}
              <View style={s.stepContent}>
                {currentStep === 0 && (
                  <Step0ChooseProvider onSelect={handleSelectProvider} loading={loading} />
                )}
                {currentStep === 1 && onboarding.provider === 'POLARIS' && (
                  <Step1APolaris
                    domainMode={domainMode}
                    setDomainMode={setDomainMode}
                    domainInput={domainInput}
                    setDomainInput={setDomainInput}
                    mailboxInput={mailboxInput}
                    setMailboxInput={setMailboxInput}
                    displayNameInput={displayNameInput}
                    setDisplayNameInput={setDisplayNameInput}
                    onSave={handleSaveDomain}
                    loading={loading}
                  />
                )}
                {currentStep === 1 && onboarding.provider === 'GOOGLE' && (
                  <Step1BGoogle onConnect={handleConnectGoogle} loading={loading} oauthStatus={onboarding.oauthStatus} />
                )}
                {currentStep === 2 && (
                  <Step2Verify
                    checks={onboarding.checks || []}
                    onRunChecks={handleRunChecks}
                    running={checksRunning}
                    onContinue={() => setCurrentStep(3)}
                  />
                )}
                {currentStep === 3 && (
                  <Step3Eli
                    eli={onboarding.eli}
                    onUpdate={updateEli}
                    onSave={handleSaveEli}
                    onActivate={handleActivate}
                    loading={loading}
                  />
                )}
              </View>
            </View>

            {/* Right column: Summary */}
            <View style={s.rightCol}>
              <SetupSummary onboarding={onboarding} receipts={receipts} />
            </View>
          </View>
        </ScrollView>
      </View>
    </DesktopShell>
  );
}

/* ─── Step 0: Choose Provider ─── */
function Step0ChooseProvider({ onSelect, loading }: { onSelect: (p: MailProvider) => void; loading: boolean }) {
  const [selected, setSelected] = useState<MailProvider | null>(null);

  return (
    <View style={s.stepPanel}>
      <Text style={s.stepTitle}>Choose Your Email Provider</Text>
      <Text style={s.stepDescription}>Select how you'd like to set up business email for your office.</Text>

      <View style={s.providerCards}>
        <Pressable
          style={({ hovered }: any) => [s.providerCard, selected === 'POLARIS' && s.providerCardSelected, hovered && s.providerCardHover]}
          onPress={() => setSelected('POLARIS')}
        >
          <View style={[s.providerIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
            <Ionicons name="shield-checkmark" size={28} color="#3B82F6" />
          </View>
          <Text style={s.providerName}>Aspire Business Email</Text>
          <Text style={s.providerDesc}>Custom domain email powered by Aspire. Full control over DNS, DKIM, and mailbox provisioning.</Text>
          <View style={s.providerFeatures}>
            <FeatureTag label="Custom Domain" />
            <FeatureTag label="DKIM/SPF" />
            <FeatureTag label="Full Control" />
          </View>
          {selected === 'POLARIS' && (
            <View style={s.selectedCheck}>
              <Ionicons name="checkmark-circle" size={22} color="#3B82F6" />
            </View>
          )}
        </Pressable>

        <Pressable
          style={({ hovered }: any) => [s.providerCard, selected === 'GOOGLE' && s.providerCardSelected, hovered && s.providerCardHover]}
          onPress={() => setSelected('GOOGLE')}
        >
          <View style={[s.providerIconWrap, { backgroundColor: 'rgba(234, 67, 53, 0.12)' }]}>
            <Ionicons name="logo-google" size={28} color="#EA4335" />
          </View>
          <Text style={s.providerName}>Google Workspace / Gmail</Text>
          <Text style={s.providerDesc}>Connect your existing Google mailbox. OAuth-based access with full Gmail API integration.</Text>
          <View style={s.providerFeatures}>
            <FeatureTag label="OAuth" />
            <FeatureTag label="Gmail API" />
            <FeatureTag label="Labels" />
          </View>
          {selected === 'GOOGLE' && (
            <View style={s.selectedCheck}>
              <Ionicons name="checkmark-circle" size={22} color="#EA4335" />
            </View>
          )}
        </Pressable>
      </View>

      <Pressable
        style={({ hovered }: any) => [s.primaryBtn, !selected && s.primaryBtnDisabled, hovered && selected && s.primaryBtnHover]}
        onPress={() => selected && onSelect(selected)}
        disabled={!selected || loading}
      >
        <Text style={s.primaryBtnText}>{loading ? 'Saving...' : 'Continue'}</Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </Pressable>
    </View>
  );
}

/* ─── Step 1A: Aspire/Polaris Domain ─── */
function Step1APolaris({ domainMode, setDomainMode, domainInput, setDomainInput, mailboxInput, setMailboxInput, displayNameInput, setDisplayNameInput, onSave, loading }: any) {
  return (
    <View style={s.stepPanel}>
      <Text style={s.stepTitle}>Configure Domain & Mailbox</Text>
      <Text style={s.stepDescription}>Set up your custom domain and create your first mailbox.</Text>

      {/* Domain mode toggle */}
      <View style={s.segmentedControl}>
        <Pressable
          style={[s.segment, domainMode === 'EXISTING_DOMAIN' && s.segmentActive]}
          onPress={() => setDomainMode('EXISTING_DOMAIN')}
        >
          <Text style={[s.segmentText, domainMode === 'EXISTING_DOMAIN' && s.segmentTextActive]}>Use Existing Domain</Text>
        </Pressable>
        <Pressable
          style={[s.segment, domainMode === 'NEW_DOMAIN' && s.segmentActive]}
          onPress={() => setDomainMode('NEW_DOMAIN')}
        >
          <Text style={[s.segmentText, domainMode === 'NEW_DOMAIN' && s.segmentTextActive]}>Buy New Domain</Text>
        </Pressable>
      </View>

      {domainMode === 'NEW_DOMAIN' && (
        <View style={s.approvalNotice}>
          <Ionicons name="shield-checkmark" size={16} color="#f59e0b" />
          <Text style={s.approvalNoticeText}>Domain purchase is a red-tier action requiring approval before execution.</Text>
        </View>
      )}

      {/* Domain input */}
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>Domain</Text>
        <View style={s.inputRow}>
          <TextInput
            style={s.textInput}
            value={domainInput}
            onChangeText={setDomainInput}
            placeholder="yourbusiness.com"
            placeholderTextColor={Colors.text.muted}
          />
        </View>
      </View>

      {/* Mailbox input */}
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>Mailbox Address</Text>
        <View style={s.inputRow}>
          <TextInput
            style={[s.textInput, { flex: 1 }]}
            value={mailboxInput}
            onChangeText={setMailboxInput}
            placeholder="hello"
            placeholderTextColor={Colors.text.muted}
          />
          <Text style={s.inputSuffix}>@{domainInput || 'domain.com'}</Text>
        </View>
      </View>

      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>Display Name</Text>
        <TextInput
          style={s.textInput}
          value={displayNameInput}
          onChangeText={setDisplayNameInput}
          placeholder="Business Email"
          placeholderTextColor={Colors.text.muted}
        />
      </View>

      {/* DNS Preview */}
      {domainInput.trim() && (
        <View style={s.dnsSection}>
          <Text style={s.dnsSectionTitle}>DNS Records Required</Text>
          <Text style={s.dnsNote}>Add these records to your DNS provider. Propagation may take up to 48 hours.</Text>
          <View style={s.dnsTable}>
            <View style={s.dnsHeaderRow}>
              <Text style={[s.dnsHeaderCell, { flex: 0.6 }]}>Type</Text>
              <Text style={[s.dnsHeaderCell, { flex: 1.5 }]}>Host</Text>
              <Text style={[s.dnsHeaderCell, { flex: 2 }]}>Value</Text>
              <Text style={[s.dnsHeaderCell, { flex: 0.4 }]}></Text>
            </View>
            {DNS_MOCK.map((rec, i) => (
              <View key={i} style={[s.dnsRow, i % 2 === 0 && s.dnsRowAlt]}>
                <View style={[{ flex: 0.6 }]}>
                  <View style={s.dnsTypeBadge}>
                    <Text style={s.dnsTypeBadgeText}>{rec.type}</Text>
                  </View>
                </View>
                <Text style={[s.dnsCell, { flex: 1.5 }]} numberOfLines={1}>{rec.host === '@' ? domainInput : `${rec.host}.${domainInput}`}</Text>
                <Text style={[s.dnsCell, { flex: 2 }]} numberOfLines={1}>{rec.value}</Text>
                <Pressable style={[{ flex: 0.4, alignItems: 'center' }]}>
                  <Ionicons name="copy-outline" size={14} color={Colors.text.muted} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      )}

      <Pressable
        style={({ hovered }: any) => [s.primaryBtn, !domainInput.trim() && s.primaryBtnDisabled, hovered && domainInput.trim() && s.primaryBtnHover]}
        onPress={onSave}
        disabled={!domainInput.trim() || loading}
      >
        <Text style={s.primaryBtnText}>{loading ? 'Saving...' : 'Continue to Verification'}</Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </Pressable>
    </View>
  );
}

/* ─── Step 1B: Google OAuth ─── */
function Step1BGoogle({ onConnect, loading, oauthStatus }: any) {
  if (oauthStatus?.connectedEmail) {
    return (
      <View style={s.stepPanel}>
        <Text style={s.stepTitle}>Google Connected</Text>
        <View style={s.oauthConnected}>
          <View style={s.oauthAvatar}>
            <Ionicons name="logo-google" size={24} color="#EA4335" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.oauthEmail}>{oauthStatus.connectedEmail}</Text>
            <Text style={s.oauthScopes}>
              Scopes: {(oauthStatus.scopes || []).map((s: string) => s.replace('gmail.', '')).join(', ')}
            </Text>
          </View>
          <View style={s.connectedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
            <Text style={s.connectedBadgeText}>Connected</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={s.stepPanel}>
      <Text style={s.stepTitle}>Connect Google Workspace</Text>
      <Text style={s.stepDescription}>Authorize Aspire to access your Gmail account for reading, drafting, and sending messages.</Text>

      <View style={s.oauthFeatures}>
        <View style={s.oauthFeatureRow}>
          <Ionicons name="lock-closed" size={16} color={Colors.accent.cyan} />
          <Text style={s.oauthFeatureText}>OAuth 2.0 secure authorization</Text>
        </View>
        <View style={s.oauthFeatureRow}>
          <Ionicons name="eye-off" size={16} color={Colors.accent.cyan} />
          <Text style={s.oauthFeatureText}>We never store your password</Text>
        </View>
        <View style={s.oauthFeatureRow}>
          <Ionicons name="shield-checkmark" size={16} color={Colors.accent.cyan} />
          <Text style={s.oauthFeatureText}>Revocable access at any time</Text>
        </View>
      </View>

      <Pressable
        style={({ hovered }: any) => [s.googleBtn, hovered && s.googleBtnHover]}
        onPress={onConnect}
        disabled={loading}
      >
        <Ionicons name="logo-google" size={18} color="#fff" />
        <Text style={s.googleBtnText}>{loading ? 'Connecting...' : 'Connect Google Account'}</Text>
      </Pressable>
    </View>
  );
}

/* ─── Step 2: Verification Checks ─── */
function Step2Verify({ checks, onRunChecks, running, onContinue }: { checks: OnboardingCheck[]; onRunChecks: () => void; running: boolean; onContinue: () => void }) {
  const checkItems = [
    { id: 'LIST', label: 'List messages', icon: 'mail-outline' as const, desc: 'Verify mailbox can receive and list messages' },
    { id: 'DRAFT', label: 'Create draft', icon: 'create-outline' as const, desc: 'Verify draft creation capability' },
    { id: 'SEND_TEST', label: 'Send test email', icon: 'send-outline' as const, desc: 'Send a test message to yourself' },
    { id: 'LABEL', label: 'Apply label / mark read', icon: 'pricetag-outline' as const, desc: 'Verify label and read status management' },
  ];

  const allPassed = checks.length > 0 && checks.every(c => c.status === 'PASS');

  return (
    <View style={s.stepPanel}>
      <Text style={s.stepTitle}>Verification Checks</Text>
      <Text style={s.stepDescription}>Run these checks to confirm your mailbox is working correctly.</Text>

      <View style={s.checksList}>
        {checkItems.map((ci) => {
          const result = checks.find(c => c.id === ci.id);
          const status = result?.status || 'NOT_RUN';
          return (
            <View key={ci.id} style={s.checkRow}>
              <View style={s.checkIconWrap}>
                <Ionicons name={ci.icon} size={18} color={Colors.text.secondary} />
              </View>
              <View style={s.checkInfo}>
                <Text style={s.checkLabel}>{ci.label}</Text>
                <Text style={s.checkDesc}>{ci.desc}</Text>
                {status === 'FAIL' && result?.message && (
                  <Text style={s.checkFail}>{result.message}</Text>
                )}
              </View>
              <View style={[s.checkChip, status === 'PASS' && s.checkChipPass, status === 'FAIL' && s.checkChipFail]}>
                {status === 'PASS' && <Ionicons name="checkmark" size={12} color="#22c55e" />}
                {status === 'FAIL' && <Ionicons name="close" size={12} color="#ef4444" />}
                <Text style={[s.checkChipText, status === 'PASS' && { color: '#22c55e' }, status === 'FAIL' && { color: '#ef4444' }]}>
                  {status === 'NOT_RUN' ? 'Not Run' : status}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={s.checkActions}>
        <Pressable
          style={({ hovered }: any) => [s.primaryBtn, running && s.primaryBtnDisabled, hovered && !running && s.primaryBtnHover]}
          onPress={onRunChecks}
          disabled={running}
        >
          <Ionicons name="play" size={16} color="#fff" />
          <Text style={s.primaryBtnText}>{running ? 'Running Checks...' : 'Run All Checks'}</Text>
        </Pressable>
        {checks.length > 0 && (
          <Pressable
            style={({ hovered }: any) => [s.secondaryBtn, hovered && s.secondaryBtnHover]}
            onPress={onContinue}
          >
            <Text style={s.secondaryBtnText}>{allPassed ? 'Continue' : 'Skip for Now'}</Text>
            <Ionicons name="arrow-forward" size={14} color={Colors.text.secondary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/* ─── Step 3: Enable Eli ─── */
function Step3Eli({ eli, onUpdate, onSave, onActivate, loading }: any) {
  const config = eli || {
    canDraft: true,
    canSend: false,
    externalApprovalRequired: true,
    attachmentsAlwaysApproval: true,
    rateLimitPreset: 'CONSERVATIVE',
  };

  return (
    <View style={s.stepPanel}>
      <Text style={s.stepTitle}>Enable Eli (Optional)</Text>
      <Text style={s.stepDescription}>Configure Eli's email drafting and sending capabilities. You can change these settings later.</Text>

      <View style={s.eliToggleGroup}>
        <View style={s.eliToggle}>
          <View style={s.eliToggleInfo}>
            <Ionicons name="create-outline" size={18} color={Colors.accent.cyan} />
            <View style={{ flex: 1 }}>
              <Text style={s.eliToggleLabel}>Eli can draft emails</Text>
              <Text style={s.eliToggleDesc}>Eli will prepare email drafts for your review</Text>
            </View>
          </View>
          <Switch
            value={config.canDraft}
            onValueChange={(v: boolean) => onUpdate('canDraft', v)}
            trackColor={{ false: '#2C2C2E', true: 'rgba(59, 130, 246, 0.4)' }}
            thumbColor={config.canDraft ? '#3B82F6' : '#636366'}
          />
        </View>

        <View style={s.eliToggle}>
          <View style={s.eliToggleInfo}>
            <Ionicons name="send-outline" size={18} color={Colors.accent.cyan} />
            <View style={{ flex: 1 }}>
              <Text style={s.eliToggleLabel}>Eli can send emails</Text>
              <Text style={s.eliToggleDesc}>Allow Eli to send messages on your behalf</Text>
            </View>
          </View>
          <Switch
            value={config.canSend}
            onValueChange={(v: boolean) => onUpdate('canSend', v)}
            trackColor={{ false: '#2C2C2E', true: 'rgba(59, 130, 246, 0.4)' }}
            thumbColor={config.canSend ? '#3B82F6' : '#636366'}
          />
        </View>
      </View>

      {config.canSend && (
        <View style={s.sendPolicyCard}>
          <View style={s.sendPolicyHeader}>
            <Ionicons name="shield-checkmark" size={16} color="#f59e0b" />
            <Text style={s.sendPolicyTitle}>Send Policy Configuration</Text>
          </View>

          <View style={s.policyToggle}>
            <Text style={s.policyLabel}>External recipients require approval</Text>
            <Switch
              value={config.externalApprovalRequired}
              onValueChange={(v: boolean) => onUpdate('externalApprovalRequired', v)}
              trackColor={{ false: '#2C2C2E', true: 'rgba(245, 158, 11, 0.4)' }}
              thumbColor={config.externalApprovalRequired ? '#f59e0b' : '#636366'}
            />
          </View>

          <View style={s.policyToggle}>
            <Text style={s.policyLabel}>Attachments always require approval</Text>
            <Switch
              value={config.attachmentsAlwaysApproval}
              onValueChange={(v: boolean) => onUpdate('attachmentsAlwaysApproval', v)}
              trackColor={{ false: '#2C2C2E', true: 'rgba(245, 158, 11, 0.4)' }}
              thumbColor={config.attachmentsAlwaysApproval ? '#f59e0b' : '#636366'}
            />
          </View>

          <View style={s.rateLimitSection}>
            <Text style={s.policyLabel}>Rate limit preset</Text>
            <View style={s.segmentedControl}>
              <Pressable
                style={[s.segment, config.rateLimitPreset === 'CONSERVATIVE' && s.segmentActive]}
                onPress={() => onUpdate('rateLimitPreset', 'CONSERVATIVE')}
              >
                <Text style={[s.segmentText, config.rateLimitPreset === 'CONSERVATIVE' && s.segmentTextActive]}>Conservative</Text>
              </Pressable>
              <Pressable
                style={[s.segment, config.rateLimitPreset === 'STANDARD' && s.segmentActive]}
                onPress={() => onUpdate('rateLimitPreset', 'STANDARD')}
              >
                <Text style={[s.segmentText, config.rateLimitPreset === 'STANDARD' && s.segmentTextActive]}>Standard</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      <View style={s.checkActions}>
        <Pressable
          style={({ hovered }: any) => [s.primaryBtn, loading && s.primaryBtnDisabled, hovered && !loading && s.primaryBtnHover]}
          onPress={async () => { await onSave(); await onActivate(); }}
          disabled={loading}
        >
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={s.primaryBtnText}>{loading ? 'Activating...' : 'Activate Mailbox'}</Text>
        </Pressable>
        <Pressable
          style={({ hovered }: any) => [s.secondaryBtn, hovered && s.secondaryBtnHover]}
          onPress={onActivate}
          disabled={loading}
        >
          <Text style={s.secondaryBtnText}>Skip Eli, Activate Now</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ─── Setup Summary Panel ─── */
function SetupSummary({ onboarding, receipts }: { onboarding: MailOnboardingState; receipts: MailSetupReceipt[] }) {
  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatAction = (action: string) => {
    return action.replace(/^mail\./, '').replace(/\./g, ' › ').replace(/_/g, ' ');
  };

  return (
    <View style={s.summaryPanel}>
      <Text style={s.summaryTitle}>Setup Summary</Text>

      <View style={s.summarySection}>
        <Text style={s.summaryLabel}>Provider</Text>
        <View style={s.summaryRow}>
          {onboarding.provider ? (
            <>
              <View style={s.summaryIcon}>
                <Ionicons name={onboarding.provider === 'GOOGLE' ? 'logo-google' : 'shield-checkmark'} size={14} color={onboarding.provider === 'GOOGLE' ? '#EA4335' : '#3B82F6'} />
              </View>
              <Text style={s.summaryValue}>{onboarding.provider === 'GOOGLE' ? 'Google Workspace' : 'Aspire Business Email'}</Text>
            </>
          ) : (
            <Text style={s.summaryEmpty}>Not selected</Text>
          )}
        </View>
      </View>

      <View style={s.summaryDivider} />

      <View style={s.summarySection}>
        <Text style={s.summaryLabel}>Domain</Text>
        <Text style={onboarding.domain ? s.summaryValue : s.summaryEmpty}>
          {onboarding.domain || 'Not configured'}
        </Text>
      </View>

      <View style={s.summaryDivider} />

      <View style={s.summarySection}>
        <Text style={s.summaryLabel}>Mailbox</Text>
        {onboarding.mailboxes?.length ? (
          onboarding.mailboxes.map((mb, i) => (
            <View key={i} style={s.mailboxRow}>
              <Ionicons name="mail" size={13} color={Colors.accent.cyan} />
              <Text style={s.summaryValue}>{mb.email}</Text>
            </View>
          ))
        ) : (
          <Text style={s.summaryEmpty}>Not created</Text>
        )}
      </View>

      <View style={s.summaryDivider} />

      <View style={s.summarySection}>
        <Text style={s.summaryLabel}>Status</Text>
        <View style={s.statusRow}>
          <View style={[s.statusDot, { backgroundColor: onboarding.checks?.every(c => c.status === 'PASS') ? '#22c55e' : '#f59e0b' }]} />
          <Text style={s.summaryValue}>
            {onboarding.checks?.every(c => c.status === 'PASS') ? 'VERIFIED' : onboarding.checks?.length ? 'VERIFYING' : 'SETUP_REQUIRED'}
          </Text>
        </View>
      </View>

      {receipts.length > 0 && (
        <>
          <View style={s.summaryDivider} />
          <View style={s.summarySection}>
            <Text style={s.summaryLabel}>Recent Activity</Text>
            {receipts.slice(0, 5).map((r, i) => (
              <View key={r.id || i} style={s.receiptRow}>
                <View style={[s.receiptDot, r.status === 'success' ? s.receiptDotSuccess : r.status === 'failure' ? s.receiptDotFail : s.receiptDotPending]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.receiptAction} numberOfLines={1}>{formatAction(r.action)}</Text>
                  <Text style={s.receiptTime}>{formatTime(r.timestamp)}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

/* ─── Feature Tag ─── */
function FeatureTag({ label }: { label: string }) {
  return (
    <View style={s.featureTag}>
      <Text style={s.featureTagText}>{label}</Text>
    </View>
  );
}

/* ─── Styles ─── */
const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scrollContent: {
    padding: 32,
    paddingBottom: 80,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { transition: 'all 0.15s ease-out', cursor: 'pointer' } : {}),
  } as any,
  backBtnHover: {
    backgroundColor: Colors.background.tertiary,
    borderColor: Colors.border.default,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    ...(Platform.OS === 'web' ? { transition: 'all 0.15s ease-out', cursor: 'pointer' } : {}),
  } as any,
  headerActionHover: {
    backgroundColor: Colors.background.tertiary,
    borderColor: Colors.border.default,
  },
  headerActionText: {
    fontSize: 13,
    color: Colors.text.secondary,
    fontWeight: '500',
  },

  body: {
    flexDirection: 'row',
    gap: 28,
  },
  leftCol: {
    flex: 1,
    minWidth: 0,
  },
  rightCol: {
    width: 300,
  },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  } as any,
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surface.card,
    borderWidth: 1.5,
    borderColor: Colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  stepCircleActive: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  stepCircleDone: {
    borderColor: '#22c55e',
    backgroundColor: '#22c55e',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.muted,
  },
  stepNumberActive: {
    color: '#3B82F6',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.border.subtle,
    marginHorizontal: -2,
  },
  stepLineDone: {
    backgroundColor: '#22c55e',
  },
  stepLabel: {
    position: 'absolute',
    top: 34,
    left: 0,
    fontSize: 11,
    color: Colors.text.muted,
    fontWeight: '500',
    width: 80,
  } as any,
  stepLabelActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  stepLabelDone: {
    color: '#22c55e',
  },

  stepContent: {
    marginTop: 16,
  },
  stepPanel: {
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    ...(Platform.OS === 'web' ? { boxShadow: '0 2px 12px rgba(0,0,0,0.15)' } : {}),
  } as any,
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 22,
    marginBottom: 24,
  },

  providerCards: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  providerCard: {
    flex: 1,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 14,
    padding: 22,
    borderWidth: 1.5,
    borderColor: Colors.border.subtle,
    position: 'relative',
    ...(Platform.OS === 'web' ? { transition: 'all 0.2s ease-out', cursor: 'pointer' } : {}),
  } as any,
  providerCardSelected: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
  },
  providerCardHover: {
    borderColor: Colors.border.default,
    ...(Platform.OS === 'web' ? { transform: 'translateY(-2px)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' } : {}),
  } as any,
  providerIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  providerName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 6,
  },
  providerDesc: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: 14,
  },
  providerFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  selectedCheck: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  featureTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  featureTagText: {
    fontSize: 11,
    color: Colors.text.muted,
    fontWeight: '500',
  },

  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Colors.background.tertiary,
    borderRadius: 10,
    padding: 3,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#3B82F6',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.muted,
  },
  segmentTextActive: {
    color: '#fff',
  },

  approvalNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.15)',
    marginBottom: 20,
  },
  approvalNoticeText: {
    fontSize: 13,
    color: '#f59e0b',
    flex: 1,
    lineHeight: 20,
  },

  fieldGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    flex: 1,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none', transition: 'border-color 0.15s ease-out' } : {}),
  } as any,
  inputSuffix: {
    fontSize: 14,
    color: Colors.text.muted,
    marginLeft: 8,
    fontWeight: '500',
  },

  dnsSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  dnsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 6,
  },
  dnsNote: {
    fontSize: 12,
    color: Colors.text.muted,
    marginBottom: 12,
    lineHeight: 18,
  },
  dnsTable: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    overflow: 'hidden',
  },
  dnsHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  dnsHeaderCell: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  dnsRowAlt: {
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  dnsTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  dnsTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3B82F6',
    letterSpacing: 0.5,
  },
  dnsCell: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    ...(Platform.OS === 'web' ? { transition: 'all 0.15s ease-out', cursor: 'pointer', boxShadow: '0 4px 16px rgba(37, 99, 235, 0.25)' } : {}),
  } as any,
  primaryBtnHover: {
    backgroundColor: '#1d4ed8',
    ...(Platform.OS === 'web' ? { transform: 'translateY(-1px)', boxShadow: '0 6px 20px rgba(37, 99, 235, 0.35)' } : {}),
  } as any,
  primaryBtnDisabled: {
    opacity: 0.4,
    ...(Platform.OS === 'web' ? { cursor: 'not-allowed' } : {}),
  } as any,
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    ...(Platform.OS === 'web' ? { transition: 'all 0.15s ease-out', cursor: 'pointer' } : {}),
  } as any,
  secondaryBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  secondaryBtnText: {
    fontSize: 14,
    color: Colors.text.muted,
    fontWeight: '500',
  },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#EA4335',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    ...(Platform.OS === 'web' ? { transition: 'all 0.15s ease-out', cursor: 'pointer', boxShadow: '0 4px 16px rgba(234, 67, 53, 0.25)' } : {}),
  } as any,
  googleBtnHover: {
    backgroundColor: '#d33426',
    ...(Platform.OS === 'web' ? { transform: 'translateY(-1px)' } : {}),
  } as any,
  googleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  oauthFeatures: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: 12,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    gap: 14,
  },
  oauthFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  oauthFeatureText: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  oauthConnected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
    marginTop: 16,
  },
  oauthAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(234, 67, 53, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  oauthEmail: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  oauthScopes: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 3,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  connectedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22c55e',
  },

  checksList: {
    gap: 4,
    marginBottom: 24,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  checkIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInfo: {
    flex: 1,
  },
  checkLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  checkDesc: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 2,
  },
  checkFail: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  checkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  checkChipPass: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderColor: 'rgba(34, 197, 94, 0.15)',
  },
  checkChipFail: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },
  checkChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.muted,
  },
  checkActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },

  eliToggleGroup: {
    gap: 4,
    marginBottom: 20,
  },
  eliToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  eliToggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 16,
  },
  eliToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  eliToggleDesc: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 2,
  },

  sendPolicyCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.04)',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.12)',
    marginBottom: 24,
  },
  sendPolicyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sendPolicyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
  },
  policyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.08)',
  },
  policyLabel: {
    fontSize: 13,
    color: Colors.text.secondary,
    flex: 1,
  },
  rateLimitSection: {
    marginTop: 12,
    gap: 8,
  },

  summaryPanel: {
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    position: 'sticky' as any,
    top: 32,
    ...(Platform.OS === 'web' ? { boxShadow: '0 2px 12px rgba(0,0,0,0.12)' } : {}),
  } as any,
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 20,
    letterSpacing: -0.2,
  },
  summarySection: {
    gap: 6,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: {
    fontSize: 13,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  summaryEmpty: {
    fontSize: 13,
    color: Colors.text.muted,
    fontStyle: 'italic',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
    marginVertical: 14,
  },
  mailboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  providerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },

  receiptRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  receiptDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
  },
  receiptDotSuccess: {
    backgroundColor: '#22c55e',
  },
  receiptDotFail: {
    backgroundColor: '#ef4444',
  },
  receiptDotPending: {
    backgroundColor: '#f59e0b',
  },
  receiptAction: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  receiptTime: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 1,
  },

  completionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  completionIcon: {
    marginBottom: 20,
  },
  completionTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  completionSubtitle: {
    fontSize: 15,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  completionEmail: {
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  completionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.15)',
    marginBottom: 32,
  },
  completionBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  completionActions: {
    gap: 12,
    alignItems: 'center',
  },
});
