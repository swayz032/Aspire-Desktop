import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator, Linking, Modal, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FinanceHubShell } from '@/components/finance/FinanceHubShell';
import { Colors, Typography } from '@/constants/tokens';
import { CARD_BG, CARD_BORDER, svgPatterns, cardWithPattern } from '@/constants/cardPatterns';
import { getPlaidConsent } from '@/lib/security/plaidConsent';
import { getMfaStatus, isMfaVerifiedRecently } from '@/lib/security/mfa';

const DOMAIN = typeof window !== 'undefined' ? window.location.origin : '';

type ProviderStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

interface ProviderState {
  plaid: { status: ProviderStatus; detail: string; lastSync: string | null };
  quickbooks: { status: ProviderStatus; detail: string; lastSync: string | null; realmId: string | null };
  gusto: { status: ProviderStatus; detail: string; lastSync: string | null };
  stripe: { status: ProviderStatus; detail: string; lastSync: string | null; accountId: string | null };
}

const premiumCardBase = Platform.OS === 'web' ? {
  boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
} : {};

const providerPatternMap: Record<string, any> = Platform.OS === 'web' ? {
  plaid: cardWithPattern(svgPatterns.networkNodes(), 'right', '40% auto'),
  quickbooks: cardWithPattern(svgPatterns.barChart(), 'right', '35% auto'),
  gusto: cardWithPattern(svgPatterns.people(), 'right', '35% auto'),
  stripe: cardWithPattern(svgPatterns.currency(), 'right', '25% auto'),
} : {};

const getProviderCardStyle = (key: string) => providerPatternMap[key] || {};

export default function ConnectionsScreen() {
  const [providers, setProviders] = useState<ProviderState>({
    plaid: { status: 'disconnected', detail: 'Banking & transactions', lastSync: null },
    quickbooks: { status: 'disconnected', detail: 'Accounting & bookkeeping', lastSync: null, realmId: null },
    gusto: { status: 'disconnected', detail: 'Payroll & HR', lastSync: null },
    stripe: { status: 'disconnected', detail: 'Payments & invoicing', lastSync: null, accountId: null },
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [setupModalVisible, setSetupModalVisible] = useState(false);
  const [setupForm, setSetupForm] = useState({ firstName: '', lastName: '', email: '', companyName: '' });
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);
  const [crossLinking, setCrossLinking] = useState<string | null>(null);
  const [crossLinkSuccess, setCrossLinkSuccess] = useState<Record<string, boolean>>({});
  const plaidRouter = useRouter();

  const checkAllStatuses = useCallback(async () => {
    try {
      const [plaidRes, qbRes, gustoRes, stripeRes] = await Promise.all([
        fetch('/api/plaid/status').then(r => r.json()).catch(() => ({ connected: false })),
        fetch('/api/quickbooks/status').then(r => r.json()).catch(() => ({ connected: false })),
        fetch('/api/gusto/status').then(r => r.json()).catch(() => ({ connected: false })),
        fetch('/api/stripe-connect/status').then(r => r.json()).catch(() => ({ connected: false })),
      ]);

      setProviders({
        plaid: {
          status: plaidRes.connected ? 'connected' : 'disconnected',
          detail: plaidRes.connected ? 'Bank accounts linked' : 'Banking & transactions',
          lastSync: plaidRes.connected ? 'Just now' : null,
        },
        quickbooks: {
          status: qbRes.connected ? 'connected' : 'disconnected',
          detail: qbRes.connected ? 'Syncing financial data' : 'Accounting & bookkeeping',
          lastSync: qbRes.connected ? 'Just now' : null,
          realmId: qbRes.realmId || null,
        },
        gusto: {
          status: gustoRes.connected ? 'connected' : 'disconnected',
          detail: gustoRes.connected ? 'Payroll data syncing' : 'Payroll & HR',
          lastSync: gustoRes.connected ? 'Just now' : null,
        },
        stripe: {
          status: stripeRes.connected ? 'connected' : 'disconnected',
          detail: stripeRes.connected ? 'Payments active' : 'Payments & invoicing',
          lastSync: stripeRes.connected ? 'Just now' : null,
          accountId: stripeRes.accountId || null,
        },
      });
    } catch (err) {
      console.error('Status check failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLinkedAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/plaid/linked-accounts');
      const data = await res.json();
      if (data.accounts) setLinkedAccounts(data.accounts);
    } catch (e) {}
  }, []);

  useEffect(() => {
    checkAllStatuses();
    fetchLinkedAccounts();
  }, [checkAllStatuses, fetchLinkedAccounts]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('qb') === 'connected' || params.get('stripe') === 'connected') {
        checkAllStatuses();
        window.history.replaceState({}, '', window.location.pathname);
      }
      if (params.get('gusto') === 'connected') {
        window.history.replaceState({}, '', window.location.pathname);
        const signatoryEmail = localStorage.getItem('gusto_migrate_email');
        if (signatoryEmail) {
          localStorage.removeItem('gusto_migrate_email');
          fetch('/api/gusto/migrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: signatoryEmail }),
          })
            .then(r => r.json())
            .then(data => {
              if (data.success) {
                console.log('Gusto migration completed successfully');
              } else {
                console.warn('Gusto migration response:', data);
              }
            })
            .catch(err => console.error('Gusto migration error:', err))
            .finally(() => checkAllStatuses());
        } else {
          checkAllStatuses();
        }
      }
    }
  }, [checkAllStatuses]);

  const crossLinkToStripe = async (accountId: string) => {
    setCrossLinking('stripe');
    try {
      const res = await fetch('/api/plaid/processor/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      });
      const data = await res.json();
      if (data.success) {
        setCrossLinkSuccess(prev => ({ ...prev, stripe: true }));
      }
    } catch (e) {
      console.error('Cross-link to Stripe failed:', e);
    } finally {
      setCrossLinking(null);
    }
  };

  const crossLinkToGusto = async (accountId: string) => {
    setCrossLinking('gusto');
    try {
      const res = await fetch('/api/plaid/processor/gusto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      });
      const data = await res.json();
      if (data.success) {
        setCrossLinkSuccess(prev => ({ ...prev, gusto: true }));
      }
    } catch (e) {
      console.error('Cross-link to Gusto failed:', e);
    } finally {
      setCrossLinking(null);
    }
  };

  const connectPlaid = async () => {
    setActionLoading('plaid');
    try {
      const hasConsent = await getPlaidConsent();
      if (!hasConsent) {
        setActionLoading(null);
        plaidRouter.push('/more/plaid-consent' as any);
        return;
      }

      const mfaStatus = await getMfaStatus();
      if (!mfaStatus.enabled) {
        setActionLoading(null);
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert('MFA is required before connecting Plaid. Please enable MFA in More → Security first.');
        }
        return;
      }

      const recentlyVerified = await isMfaVerifiedRecently();
      if (!recentlyVerified) {
        setActionLoading(null);
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert('Please verify your MFA code before connecting Plaid. Your last verification has expired.');
        }
        return;
      }

      const res = await fetch('/api/plaid/create-link-token', { method: 'POST' });
      const data = await res.json();
      if (data.link_token && typeof window !== 'undefined') {
        const handler = (window as any).Plaid?.create({
          token: data.link_token,
          onSuccess: async (publicToken: string) => {
            await fetch('/api/plaid/exchange-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ public_token: publicToken }),
            });
            checkAllStatuses();
          },
          onExit: () => setActionLoading(null),
        });
        if (handler) {
          handler.open();
        } else {
          const linkUrl = `https://cdn.plaid.com/link/v2/stable/link.html?token=${data.link_token}`;
          window.open(linkUrl, '_blank', 'width=400,height=700');
          setTimeout(() => checkAllStatuses(), 5000);
        }
      }
    } catch (err) {
      console.error('Plaid connect error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const connectQuickBooks = async () => {
    setActionLoading('quickbooks');
    try {
      const res = await fetch('/api/quickbooks/authorize');
      const data = await res.json();
      if (data.url && typeof window !== 'undefined') {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('QuickBooks connect error:', err);
      setActionLoading(null);
    }
  };

  const openSetupPayroll = () => {
    setSetupForm({ firstName: '', lastName: '', email: '', companyName: '' });
    setSetupError(null);
    setSetupModalVisible(true);
  };

  const submitSetupPayroll = async () => {
    const { firstName, lastName, email, companyName } = setupForm;
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !companyName.trim()) {
      setSetupError('All fields are required.');
      return;
    }
    setSetupLoading(true);
    setSetupError(null);
    try {
      const res = await fetch('/api/gusto/create-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: { first_name: firstName.trim(), last_name: lastName.trim(), email: email.trim() },
          company: { name: companyName.trim() },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSetupModalVisible(false);
        checkAllStatuses();
      } else {
        setSetupError(data.error || 'Failed to create company.');
      }
    } catch (err: any) {
      setSetupError(err.message || 'Network error.');
    } finally {
      setSetupLoading(false);
    }
  };

  const importExistingGusto = async () => {
    setActionLoading('gusto');
    try {
      const emailPrompt = typeof window !== 'undefined'
        ? window.prompt('Enter the email address associated with your Gusto account:')
        : null;
      if (!emailPrompt) {
        setActionLoading(null);
        return;
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('gusto_migrate_email', emailPrompt);
      }
      const res = await fetch('/api/gusto/authorize');
      const data = await res.json();
      if (data.url) {
        if (Platform.OS === 'web') {
          window.location.href = data.url;
        }
      } else {
        setProviders(prev => ({
          ...prev,
          gusto: { status: 'error', detail: data.error || 'Failed to get authorization URL', lastSync: null },
        }));
        setActionLoading(null);
      }
    } catch (err) {
      console.error('Gusto connect error:', err);
      setActionLoading(null);
    }
  };

  const connectStripe = async () => {
    setActionLoading('stripe');
    try {
      const res = await fetch('/api/stripe-connect/authorize');
      const data = await res.json();
      if (data.url && typeof window !== 'undefined') {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Stripe connect error:', err);
      setActionLoading(null);
    }
  };

  const disconnectProvider = async (provider: string) => {
    setActionLoading(provider);
    try {
      const endpoints: Record<string, string> = {
        plaid: '/api/plaid/disconnect',
        quickbooks: '/api/quickbooks/disconnect',
        stripe: '/api/stripe-connect/disconnect',
      };
      if (endpoints[provider]) {
        await fetch(endpoints[provider], { method: 'POST' });
        checkAllStatuses();
      }
    } catch (err) {
      console.error('Disconnect error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const providerConfigs = [
    {
      key: 'plaid',
      name: 'Plaid',
      subtitle: 'Bank accounts, balances & transactions',
      icon: 'card-outline' as const,
      brandColor: '#00D09C',
      connectAction: connectPlaid,
      powers: ['Cash Position', 'Transaction Feed', 'Account Balances'],
    },
    {
      key: 'quickbooks',
      name: 'QuickBooks Online',
      subtitle: 'Chart of accounts, P&L, cash flow reports',
      icon: 'calculator-outline' as const,
      brandColor: '#2CA01C',
      connectAction: connectQuickBooks,
      powers: ['Financial Reports', 'Expense Tracking', 'Tax Preparation'],
    },
    {
      key: 'gusto',
      name: 'Payroll',
      subtitle: 'Employees, payroll, tax filing',
      icon: 'people-outline' as const,
      brandColor: '#F45D48',
      connectAction: openSetupPayroll,
      powers: ['Run Payroll', 'Employee Directory', 'Tax & Compliance'],
    },
    {
      key: 'stripe',
      name: 'Stripe',
      subtitle: 'Payment processing, invoices & subscriptions',
      icon: 'flash-outline' as const,
      brandColor: '#635BFF',
      connectAction: connectStripe,
      powers: ['Invoicing', 'Payment Processing', 'Revenue Tracking'],
    },
  ];

  const connectedCount = Object.values(providers).filter(p => p.status === 'connected').length;

  if (loading) {
    return (
      <FinanceHubShell>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={{ color: Colors.text.tertiary, marginTop: 16, fontSize: 14 }}>Checking provider connections...</Text>
        </View>
      </FinanceHubShell>
    );
  }

  const renderGustoFooter = (config: typeof providerConfigs[2], isConnected: boolean, isLoading: boolean, state: ProviderState['gusto']) => {
    if (isConnected) {
      return (
        <View style={s.footerConnected}>
          <View style={s.syncInfo}>
            <Ionicons name="sync-outline" size={14} color={Colors.text.muted} />
            <Text style={s.syncText}>Last sync: {state.lastSync}</Text>
          </View>
          <Pressable
            onPress={() => disconnectProvider(config.key)}
            style={({ hovered }: any) => [s.disconnectBtn, hovered && { backgroundColor: 'rgba(239,68,68,0.15)' }]}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Text style={s.disconnectText}>Disconnect</Text>
            )}
          </Pressable>
        </View>
      );
    }

    return (
      <View>
        <Pressable
          onPress={openSetupPayroll}
          disabled={isLoading}
          style={({ hovered }: any) => [
            s.connectBtn,
            { backgroundColor: config.brandColor },
            Platform.OS === 'web' && { boxShadow: `0 4px 16px ${config.brandColor}40` } as any,
            hovered && { opacity: 0.9, transform: [{ scale: 1.01 }] },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <View style={s.connectBtnContent}>
              <Ionicons name="add-circle-outline" size={16} color="#fff" />
              <Text style={s.connectBtnText}>Set Up Payroll</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          onPress={importExistingGusto}
          disabled={isLoading}
          style={({ hovered }: any) => [
            s.importLink,
            hovered && { opacity: 0.8 },
          ]}
        >
          <Text style={s.importLinkText}>Import Existing Account</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <FinanceHubShell>
      {Platform.OS === 'web' && (
        <script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js" />
      )}
      <View style={[s.heroBanner, premiumCardBase as any, Platform.OS === 'web' && { background: `radial-gradient(ellipse at top right, rgba(59,130,246,0.08) 0%, transparent 50%), ${CARD_BG}` } as any]}>
        <View style={s.heroContent}>
          <View style={s.heroLeft}>
            <View style={s.heroIconWrap}>
              <Ionicons name="git-network-outline" size={24} color="#60A5FA" />
            </View>
            <View>
              <Text style={s.heroTitle}>Connections</Text>
              <Text style={s.heroSubtitle}>Manage your financial service integrations</Text>
            </View>
          </View>
          <View style={s.heroRight}>
            <View style={[s.heroStatBadge, connectedCount === 4 && s.heroStatBadgeComplete]}>
              <Text style={s.heroStatNumber}>{connectedCount}/4</Text>
              <Text style={s.heroStatLabel}>Connected</Text>
            </View>
          </View>
        </View>
      </View>

      {Platform.OS === 'web' && linkedAccounts.length > 0 && (
        <div style={{
          marginTop: 24,
          borderRadius: 16,
          padding: 24,
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          position: 'relative' as const,
          overflow: 'hidden' as const,
        }}>
          <div style={{
            position: 'absolute' as const, top: 0, right: 0, bottom: 0, width: '35%',
            backgroundImage: svgPatterns.networkNodes('rgba(255,255,255,0.025)', 'rgba(59,130,246,0.04)'),
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center center',
            backgroundSize: '80% auto',
            pointerEvents: 'none' as const,
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'rgba(59,130,246,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="git-merge-outline" size={18} color="#60A5FA" />
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: '600', letterSpacing: 0.2 }}>
                Unified Banking
              </div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 1 }}>
                Use one bank account across all connected services
              </div>
            </div>
          </div>
          <div style={{
            borderRadius: 10,
            padding: 12,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.04)',
            marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Ionicons name="business-outline" size={18} color="#60A5FA" />
            <div style={{ flex: 1 }}>
              <div style={{ color: '#e0e0e0', fontSize: 13, fontWeight: '500' }}>
                {linkedAccounts[0]?.name} {linkedAccounts[0]?.mask ? `••${linkedAccounts[0].mask}` : ''}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 1 }}>
                Connected via Plaid
              </div>
            </div>
            <div style={{
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
              background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)',
            }}>
              <Text style={{ color: '#34D399', fontSize: 10, fontWeight: '600' }}>Active</Text>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { key: 'plaid', label: 'Cash Monitoring', icon: 'analytics-outline' as const, color: '#10B981', alwaysLinked: true },
              { key: 'stripe', label: 'ACH Payments', icon: 'card-outline' as const, color: '#635BFF' },
              { key: 'gusto', label: 'Payroll Funding', icon: 'people-outline' as const, color: '#F45D48' },
            ].map((svc) => {
              const isLinked = svc.alwaysLinked || crossLinkSuccess[svc.key];
              return (
                <div key={svc.key} style={{
                  flex: 1,
                  borderRadius: 10,
                  padding: 14,
                  background: isLinked ? `rgba(${svc.color === '#10B981' ? '16,185,129' : svc.color === '#635BFF' ? '99,91,255' : '244,93,72'},0.06)` : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isLinked ? `${svc.color}30` : 'rgba(255,255,255,0.04)'}`,
                  display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 8,
                  textAlign: 'center' as const,
                  position: 'relative' as const,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: isLinked ? `${svc.color}18` : 'rgba(255,255,255,0.04)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name={isLinked ? 'checkmark-circle' : svc.icon} size={18} color={isLinked ? svc.color : 'rgba(255,255,255,0.3)'} />
                  </div>
                  <div style={{ color: isLinked ? '#e0e0e0' : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' }}>
                    {svc.label}
                  </div>
                  {isLinked ? (
                    <div style={{ color: svc.color, fontSize: 10, fontWeight: '600' }}>Linked</div>
                  ) : (
                    <Pressable
                      onPress={() => svc.key === 'stripe' ? crossLinkToStripe(linkedAccounts[0].account_id) : crossLinkToGusto(linkedAccounts[0].account_id)}
                      disabled={crossLinking === svc.key}
                      style={({ hovered }: any) => [{
                        paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6,
                        backgroundColor: svc.color,
                        ...(Platform.OS === 'web' ? { transition: 'all 0.15s ease' } as any : {}),
                      }, hovered && { opacity: 0.85 }]}
                    >
                      {crossLinking === svc.key ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>Link</Text>
                      )}
                    </Pressable>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Text style={[Typography.headline, { color: Colors.text.primary, marginBottom: 4, marginTop: 24 }]}>Service Providers</Text>
      <Text style={{ color: Colors.text.tertiary, fontSize: 13, marginBottom: 20 }}>Connect your accounts to unlock real-time data across the platform</Text>

      {providerConfigs.map((config) => {
        const state = providers[config.key as keyof ProviderState];
        const isConnected = state.status === 'connected';
        const isCardLoading = actionLoading === config.key;
        const isGusto = config.key === 'gusto';

        return (
          <View key={config.key} style={[s.providerCard, premiumCardBase as any, getProviderCardStyle(config.key)]}>
            <View style={s.cardHeader}>
              <View style={[s.providerIcon, { backgroundColor: `${config.brandColor}22` }, Platform.OS === 'web' && { boxShadow: `0 0 24px ${config.brandColor}30` } as any]}>
                <Ionicons name={config.icon} size={24} color={config.brandColor} />
              </View>
              <View style={s.providerMeta}>
                <View style={s.nameRow}>
                  <Text style={s.providerName}>{config.name}</Text>
                  <View style={[s.statusPill, { backgroundColor: isConnected ? 'rgba(52,211,153,0.15)' : 'rgba(161,161,166,0.12)' }]}>
                    <View style={[s.statusDot, { backgroundColor: isConnected ? '#34D399' : Colors.text.muted }]} />
                    <Text style={[s.statusLabel, { color: isConnected ? '#34D399' : Colors.text.muted }]}>
                      {isConnected ? 'Connected' : 'Not connected'}
                    </Text>
                  </View>
                </View>
                <Text style={s.providerSubtitle}>{config.subtitle}</Text>
              </View>
            </View>

            <View style={s.powersRow}>
              {config.powers.map((power) => (
                <View key={power} style={[s.powerChip, isConnected && { backgroundColor: `${config.brandColor}15`, borderColor: `${config.brandColor}30` }]}>
                  <Ionicons
                    name={isConnected ? 'checkmark-circle' : 'lock-closed'}
                    size={12}
                    color={isConnected ? config.brandColor : Colors.text.muted}
                  />
                  <Text style={[s.powerLabel, isConnected && { color: Colors.text.secondary }]}>{power}</Text>
                </View>
              ))}
            </View>

            {Platform.OS === 'web' && linkedAccounts.length > 0 && !crossLinkSuccess[config.key] && (config.key === 'stripe' || config.key === 'gusto') && (
              <div style={{
                marginTop: 12,
                marginBottom: 4,
                borderRadius: 12,
                padding: 14,
                background: CARD_BG,
                border: `1px solid ${CARD_BORDER}`,
                display: 'flex',
                flexDirection: 'row' as const,
                alignItems: 'center',
                gap: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `radial-gradient(circle, ${config.brandColor}30 0%, ${config.brandColor}10 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Ionicons name="link" size={16} color={config.brandColor} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#e0e0e0', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 }}>
                    Use linked bank for {config.key === 'stripe' ? 'ACH payments' : 'payroll funding'}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>
                    {linkedAccounts[0]?.name} {linkedAccounts[0]?.mask ? `••${linkedAccounts[0].mask}` : ''}
                  </div>
                </div>
                <Pressable
                  onPress={() => config.key === 'stripe' ? crossLinkToStripe(linkedAccounts[0].account_id) : crossLinkToGusto(linkedAccounts[0].account_id)}
                  disabled={crossLinking === config.key}
                  style={({ hovered }: any) => [{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 8,
                    backgroundColor: config.brandColor,
                    ...(Platform.OS === 'web' ? { boxShadow: `0 2px 12px ${config.brandColor}50`, transition: 'all 0.2s ease' } as any : {}),
                  }, hovered && { opacity: 0.9, transform: [{ scale: 1.02 }] }]}
                >
                  {crossLinking === config.key ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>Link Account</Text>
                  )}
                </Pressable>
              </div>
            )}
            {Platform.OS === 'web' && crossLinkSuccess[config.key] && (config.key === 'stripe' || config.key === 'gusto') && (
              <div style={{
                marginTop: 12,
                marginBottom: 4,
                borderRadius: 12,
                padding: 14,
                background: CARD_BG,
                border: '1px solid rgba(16,185,129,0.25)',
                display: 'flex',
                flexDirection: 'row' as const,
                alignItems: 'center',
                gap: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'radial-gradient(circle, rgba(16,185,129,0.30) 0%, rgba(16,185,129,0.10) 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#10B981', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 }}>
                    Bank account linked successfully
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>
                    {linkedAccounts[0]?.name} {linkedAccounts[0]?.mask ? `••${linkedAccounts[0].mask}` : ''} is now connected for {config.key === 'stripe' ? 'ACH payments' : 'payroll funding'}
                  </div>
                </div>
              </div>
            )}

            <View style={s.cardFooter}>
              {isGusto ? (
                renderGustoFooter(config, isConnected, isCardLoading, state as ProviderState['gusto'])
              ) : isConnected ? (
                <View style={s.footerConnected}>
                  <View style={s.syncInfo}>
                    <Ionicons name="sync-outline" size={14} color={Colors.text.muted} />
                    <Text style={s.syncText}>Last sync: {state.lastSync}</Text>
                  </View>
                  {config.key === 'plaid' && (
                    <Pressable
                      onPress={connectPlaid}
                      disabled={isCardLoading}
                      style={({ hovered }: any) => [
                        {
                          paddingHorizontal: 14,
                          paddingVertical: 7,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: '#00D09C',
                          backgroundColor: 'transparent',
                          flexDirection: 'row' as const,
                          alignItems: 'center' as const,
                          gap: 6,
                        },
                        hovered && { backgroundColor: 'rgba(0,208,156,0.12)' },
                      ]}
                    >
                      <Ionicons name="add-circle-outline" size={14} color="#00D09C" />
                      <Text style={{ color: '#00D09C', fontSize: 12, fontWeight: '600' }}>Add Bank</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => disconnectProvider(config.key)}
                    style={({ hovered }: any) => [s.disconnectBtn, hovered && { backgroundColor: 'rgba(239,68,68,0.15)' }]}
                    disabled={isCardLoading}
                  >
                    {isCardLoading ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <Text style={s.disconnectText}>Disconnect</Text>
                    )}
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={config.connectAction}
                  disabled={isCardLoading}
                  style={({ hovered }: any) => [
                    s.connectBtn,
                    { backgroundColor: config.brandColor },
                    Platform.OS === 'web' && { boxShadow: `0 4px 16px ${config.brandColor}40` } as any,
                    hovered && { opacity: 0.9, transform: [{ scale: 1.01 }] },
                  ]}
                >
                  {isCardLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <View style={s.connectBtnContent}>
                      <Ionicons name="link-outline" size={16} color="#fff" />
                      <Text style={s.connectBtnText}>Connect {config.name}</Text>
                    </View>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        );
      })}

      <View style={[s.dataHealthSection]}>
        <Text style={[Typography.headline, { color: Colors.text.primary, marginBottom: 4, marginTop: 12 }]}>Data Health</Text>
        <Text style={{ color: Colors.text.tertiary, fontSize: 13, marginBottom: 16 }}>Real-time sync status for all connected services</Text>
        <View style={[s.healthCard, premiumCardBase as any]}>
          {providerConfigs.map((config, i) => {
            const state = providers[config.key as keyof ProviderState];
            const isConnected = state.status === 'connected';
            const dotColor = isConnected ? '#34D399' : state.status === 'error' ? '#EF4444' : Colors.text.muted;
            const statusText = isConnected ? 'Healthy \u00B7 Syncing' : state.status === 'error' ? 'Error \u00B7 Check credentials' : 'Not connected';
            return (
              <View key={config.key} style={[s.healthRow, i < providerConfigs.length - 1 && s.healthDivider]}>
                <View style={[s.healthDot, { backgroundColor: dotColor }, Platform.OS === 'web' && { boxShadow: `0 0 8px ${dotColor}` } as any]} />
                <Text style={s.healthName}>{config.name}</Text>
                <Text style={[s.healthStatus, { color: isConnected ? '#34D399' : state.status === 'error' ? '#EF4444' : Colors.text.muted }]}>{statusText}</Text>
                <Text style={s.healthTime}>{state.lastSync || '\u2014'}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={[s.securityNote, premiumCardBase as any]}>
        <View style={s.securityIcon}>
          <Ionicons name="shield-checkmark" size={20} color="#3B82F6" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.securityTitle}>Enterprise-Grade Security</Text>
          <Text style={s.securityText}>All connections use OAuth 2.0 with encrypted token storage. Read-only by default — write operations require governance approval.</Text>
        </View>
      </View>

      <Modal
        visible={setupModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSetupModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalContainer, premiumCardBase as any]}>
            <View style={s.modalHeader}>
              <View style={s.modalTitleRow}>
                <View style={[s.modalIconWrap, { backgroundColor: 'rgba(244, 93, 72, 0.15)' }]}>
                  <Ionicons name="people-outline" size={20} color="#F45D48" />
                </View>
                <Text style={s.modalTitle}>Set Up Payroll</Text>
              </View>
              <Pressable onPress={() => setSetupModalVisible(false)} style={s.modalClose}>
                <Ionicons name="close" size={20} color={Colors.text.tertiary} />
              </Pressable>
            </View>
            <Text style={s.modalSubtitle}>Create your payroll account to manage employees, run payroll, and handle tax compliance.</Text>

            <View style={s.formGroup}>
              <Text style={s.formLabel}>First Name</Text>
              <TextInput
                style={s.formInput}
                value={setupForm.firstName}
                onChangeText={(v) => setSetupForm(prev => ({ ...prev, firstName: v }))}
                placeholder="Enter first name"
                placeholderTextColor={Colors.text.muted}
                autoCapitalize="words"
              />
            </View>
            <View style={s.formGroup}>
              <Text style={s.formLabel}>Last Name</Text>
              <TextInput
                style={s.formInput}
                value={setupForm.lastName}
                onChangeText={(v) => setSetupForm(prev => ({ ...prev, lastName: v }))}
                placeholder="Enter last name"
                placeholderTextColor={Colors.text.muted}
                autoCapitalize="words"
              />
            </View>
            <View style={s.formGroup}>
              <Text style={s.formLabel}>Email</Text>
              <TextInput
                style={s.formInput}
                value={setupForm.email}
                onChangeText={(v) => setSetupForm(prev => ({ ...prev, email: v }))}
                placeholder="you@company.com"
                placeholderTextColor={Colors.text.muted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={s.formGroup}>
              <Text style={s.formLabel}>Company Name</Text>
              <TextInput
                style={s.formInput}
                value={setupForm.companyName}
                onChangeText={(v) => setSetupForm(prev => ({ ...prev, companyName: v }))}
                placeholder="Your Company, Inc."
                placeholderTextColor={Colors.text.muted}
              />
            </View>

            {setupError && (
              <View style={s.errorBanner}>
                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                <Text style={s.errorText}>{setupError}</Text>
              </View>
            )}

            <Pressable
              onPress={submitSetupPayroll}
              disabled={setupLoading}
              style={({ hovered }: any) => [
                s.modalSubmitBtn,
                hovered && { opacity: 0.9 },
              ]}
            >
              {setupLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.modalSubmitText}>Create Payroll Account</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </FinanceHubShell>
  );
}

const s = StyleSheet.create({
  heroBanner: {
    backgroundColor: 'rgba(28, 28, 30, 0.92)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
    padding: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  heroOrbContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    color: Colors.text.tertiary,
    fontSize: 14,
    marginTop: 2,
  },
  heroRight: {
    alignItems: 'flex-end',
  },
  heroStatBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  heroStatBadgeComplete: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderColor: 'rgba(52, 211, 153, 0.25)',
  },
  heroStatNumber: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  heroStatLabel: {
    color: Colors.text.tertiary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  providerCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.92)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
    padding: 24,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  cardGlassLine: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  orbOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 16,
  },
  providerIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerMeta: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  providerName: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  providerSubtitle: {
    color: Colors.text.tertiary,
    fontSize: 13,
    lineHeight: 18,
  },
  powersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  powerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  powerLabel: {
    color: Colors.text.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 16,
  },
  footerConnected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  syncInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncText: {
    color: Colors.text.muted,
    fontSize: 12,
  },
  disconnectBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'all 0.15s ease' } : {}),
  },
  disconnectText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  connectBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'all 0.2s ease' } : {}),
  },
  connectBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  importLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 4,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  importLinkText: {
    color: Colors.text.tertiary,
    fontSize: 13,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  dataHealthSection: {
    marginTop: 8,
  },
  healthCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.92)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
    padding: 20,
    overflow: 'hidden',
    position: 'relative',
    ...(Platform.OS === 'web' ? {
      background: CARD_BG,
      border: `1px solid ${CARD_BORDER}`,
    } as any : {}),
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  healthDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  healthDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  healthName: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    width: 130,
  },
  healthStatus: {
    fontSize: 13,
    flex: 1,
  },
  healthTime: {
    color: Colors.text.muted,
    fontSize: 12,
    minWidth: 60,
    textAlign: 'right',
  },
  securityNote: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 20,
    marginTop: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  securityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityTitle: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  securityText: {
    color: Colors.text.tertiary,
    fontSize: 13,
    lineHeight: 19,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 10, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    padding: 28,
    width: '100%',
    maxWidth: 440,
    ...(Platform.OS === 'web' ? {
      background: CARD_BG,
      border: `1px solid ${CARD_BORDER}`,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
    } as any : {}),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  modalSubtitle: {
    color: Colors.text.tertiary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 14,
  },
  formLabel: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    flex: 1,
  },
  modalSubmitBtn: {
    backgroundColor: '#F45D48',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 4px 16px rgba(244, 93, 72, 0.3)' } as any : {}),
  },
  modalSubmitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
