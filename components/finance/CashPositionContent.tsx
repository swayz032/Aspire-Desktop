import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { Ionicons } from '@expo/vector-icons';
import { CARD_BG, CARD_BORDER, svgPatterns } from '@/constants/cardPatterns';

let usePlaidLinkHook: any = null;
if (Platform.OS === 'web') {
  try {
    const mod = require('react-plaid-link');
    usePlaidLinkHook = mod.usePlaidLink;
  } catch (e) {
  }
}

const formatCurrency = (amount: number) => {
  const absAmount = Math.abs(amount);
  return `${amount < 0 ? '-' : ''}$${absAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

function PlaidLinkButtonInner({ linkToken, onLinkSuccess, label, compact }: { linkToken: string; onLinkSuccess: () => void; label?: string; compact?: boolean }) {
  const onPlaidSuccess = useCallback(async (publicToken: string) => {
    try {
      const res = await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token: publicToken }),
      });
      if (res.ok) {
        onLinkSuccess();
      }
    } catch (e) {
      console.error('Token exchange failed:', e);
    }
  }, [onLinkSuccess]);

  const plaidConfig = usePlaidLinkHook
    ? usePlaidLinkHook({
        token: linkToken,
        onSuccess: (public_token: string) => onPlaidSuccess(public_token),
      })
    : { open: () => {}, ready: false };

  return (
    <TouchableOpacity
      style={[compact ? styles.addBankBtn : styles.connectBankBtn, !plaidConfig.ready && { opacity: 0.5 }]}
      onPress={() => plaidConfig.open()}
      disabled={!plaidConfig.ready}
    >
      <Ionicons name={compact ? "add-outline" : "link-outline"} size={compact ? 16 : 18} color="#fff" />
      <Text style={compact ? styles.addBankText : styles.connectBankText}>{label || 'Connect Bank Account'}</Text>
    </TouchableOpacity>
  );
}

function PlaidLinkButton({ onSuccess: onLinkSuccess, label, compact }: { onSuccess: () => void; label?: string; compact?: boolean }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/plaid/create-link-token', { method: 'POST' });
        const data = await res.json();
        if (data.link_token) setLinkToken(data.link_token);
      } catch (e) {
        console.error('Failed to create link token:', e);
      }
    })();
  }, []);

  if (!linkToken || !usePlaidLinkHook) {
    return (
      <TouchableOpacity style={[compact ? styles.addBankBtn : styles.connectBankBtn, { opacity: 0.5 }]} disabled>
        <Ionicons name={compact ? "add-outline" : "link-outline"} size={compact ? 16 : 18} color="#fff" />
        <Text style={compact ? styles.addBankText : styles.connectBankText}>{label || 'Connect Bank Account'}</Text>
      </TouchableOpacity>
    );
  }

  return <PlaidLinkButtonInner linkToken={linkToken} onLinkSuccess={onLinkSuccess} label={label} compact={compact} />;
}

export function CashPositionContent() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const [plaidConnected, setPlaidConnected] = useState(false);
  const [plaidAccounts, setPlaidAccounts] = useState<any[]>([]);
  const [plaidTransactions, setPlaidTransactions] = useState<any[]>([]);
  const [plaidLoading, setPlaidLoading] = useState(true);

  const fetchPlaidData = useCallback(async () => {
    try {
      const statusRes = await fetch('/api/plaid/status');
      const status = await statusRes.json();
      setPlaidConnected(status.connected);
      if (status.connected) {
        const [balRes, txRes] = await Promise.all([
          fetch('/api/plaid/balances'),
          fetch('/api/plaid/transactions'),
        ]);
        const balData = await balRes.json();
        const txData = await txRes.json();
        if (balData.accounts) setPlaidAccounts(balData.accounts);
        if (txData.transactions) setPlaidTransactions(txData.transactions);
        setLastSynced(new Date());
      }
    } catch (e) {
      console.error('Plaid fetch error:', e);
    } finally {
      setPlaidLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlaidData();
  }, [fetchPlaidData]);

  const handlePlaidLinkSuccess = useCallback(() => {
    setPlaidLoading(true);
    fetchPlaidData();
  }, [fetchPlaidData]);

  const totalBalance = plaidConnected && plaidAccounts.length > 0
    ? plaidAccounts.reduce((sum: number, acc: any) => sum + (acc.balances?.current || 0), 0)
    : 0;

  const totalAvailable = plaidConnected && plaidAccounts.length > 0
    ? plaidAccounts.reduce((sum: number, acc: any) => sum + (acc.balances?.available || 0), 0)
    : 0;

  const totalLimit = plaidConnected && plaidAccounts.length > 0
    ? plaidAccounts.reduce((sum: number, acc: any) => sum + (acc.balances?.limit || 0), 0)
    : 0;

  if (plaidLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent.cyan} />
        <Text style={styles.loadingText}>Loading cash position…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.card, Platform.OS === 'web' ? { background: `radial-gradient(ellipse at top right, rgba(16,185,129,0.08) 0%, transparent 50%), ${CARD_BG}` } as any : {}]}>
        <View style={styles.heroHeader}>
          <View style={styles.heroStatus}>
            <View style={[styles.statusDot, { backgroundColor: plaidConnected ? Colors.semantic.success : Colors.text.muted }]} />
            <Text style={styles.statusText}>
              {plaidConnected ? 'Plaid Connected' : 'Not Connected'}
            </Text>
          </View>
          {plaidConnected && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <PlaidLinkButton onSuccess={handlePlaidLinkSuccess} label="Add Bank" compact />
              <TouchableOpacity style={styles.syncButton} onPress={() => { setPlaidLoading(true); fetchPlaidData(); }}>
                <Ionicons name="sync-outline" size={16} color={Colors.accent.cyan} />
                <Text style={styles.syncText}>Sync</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.heroBalanceContainer}>
          <Text style={styles.heroLabel}>Cash Position</Text>
          <Text style={styles.heroBalance}>{formatCurrency(totalBalance)}</Text>
        </View>

        {plaidConnected && lastSynced && (
          <View style={styles.heroMeta}>
            <Ionicons name="time-outline" size={14} color={Colors.text.muted} />
            <Text style={styles.heroMetaText}>
              Last synced {lastSynced.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
        )}

        {!plaidConnected && (
          <View style={styles.emptyHero}>
            <Text style={styles.emptyMessage}>
              Connect your bank account to see real-time balances and transactions
            </Text>
            <PlaidLinkButton onSuccess={handlePlaidLinkSuccess} />
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons name="wallet-outline" size={18} color={Colors.text.secondary} />
          <Text style={styles.sectionTitle}>Connected Accounts</Text>
        </View>

        {plaidConnected && plaidAccounts.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.accountsScroll}
          >
            {plaidAccounts.map((account: any) => (
              <PlaidAccountCard key={account.account_id} account={account} />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptySection}>
            <Ionicons name="card-outline" size={32} color={Colors.text.muted} />
            <Text style={styles.emptyText}>No accounts connected</Text>
          </View>
        )}
      </View>

      {plaidConnected && plaidAccounts.length > 0 && (
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="stats-chart-outline" size={18} color={Colors.text.secondary} />
            <Text style={styles.sectionTitle}>Account Balances</Text>
          </View>
          <View style={styles.balanceSummary}>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Total Current</Text>
              <Text style={styles.balanceValue}>{formatCurrency(totalBalance)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Total Available</Text>
              <Text style={styles.balanceValue}>{formatCurrency(totalAvailable)}</Text>
            </View>
            {totalLimit > 0 && (
              <>
                <View style={styles.divider} />
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>Total Credit Limit</Text>
                  <Text style={styles.balanceValue}>{formatCurrency(totalLimit)}</Text>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      <View style={[styles.card, Platform.OS === 'web' ? { backgroundImage: svgPatterns.trendLine('rgba(255,255,255,0.03)', 'rgba(16,185,129,0.05)'), backgroundRepeat: 'no-repeat', backgroundPosition: 'right center', backgroundSize: '45% auto' } as any : {}]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="receipt-outline" size={18} color={Colors.text.secondary} />
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {plaidConnected && plaidTransactions.length > 0 && (
            <Text style={styles.sectionBadge}>{plaidTransactions.length}</Text>
          )}
        </View>

        {plaidConnected && plaidTransactions.length > 0 ? (
          <View style={styles.transactionsList}>
            {plaidTransactions.slice(0, 15).map((tx: any, index: number) => {
              const isDebit = tx.amount > 0;
              return (
                <View key={tx.transaction_id || index} style={[styles.txRow, index < Math.min(plaidTransactions.length, 15) - 1 && styles.txRowBorder]}>
                  <View style={styles.txLeft}>
                    <View style={[styles.txIcon, { backgroundColor: isDebit ? Colors.semantic.errorLight : Colors.semantic.successLight }]}>
                      <Ionicons
                        name={isDebit ? 'arrow-up-outline' : 'arrow-down-outline'}
                        size={14}
                        color={isDebit ? Colors.semantic.error : Colors.semantic.success}
                      />
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={styles.txName} numberOfLines={1}>{tx.merchant_name || tx.name || 'Transaction'}</Text>
                      <Text style={styles.txMeta}>{tx.category?.[0] || 'Uncategorized'} · {tx.date}</Text>
                    </View>
                  </View>
                  <Text style={[styles.txAmount, { color: isDebit ? Colors.semantic.error : Colors.semantic.success }]}>
                    {isDebit ? '-' : '+'}{formatCurrency(Math.abs(tx.amount))}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptySection}>
            <Ionicons name="document-text-outline" size={32} color={Colors.text.muted} />
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function PlaidAccountCard({ account }: { account: any }) {
  const getPlaidIcon = (subtype: string): keyof typeof Ionicons.glyphMap => {
    switch (subtype) {
      case 'checking': return 'card-outline';
      case 'savings': return 'wallet-outline';
      case 'credit card': return 'card-outline';
      case 'money market': return 'cash-outline';
      default: return 'cash-outline';
    }
  };

  const current = account.balances?.current || 0;
  const available = account.balances?.available;
  const displayName = account.official_name || account.name || 'Account';

  return (
    <View style={styles.accountCard}>
      <View style={styles.accountHeader}>
        <View style={styles.accountIconWrap}>
          <Ionicons name={getPlaidIcon(account.subtype)} size={18} color={Colors.accent.cyan} />
        </View>
        <View style={styles.accountTypeBadge}>
          <Text style={styles.accountTypeText}>{account.subtype || account.type || 'Account'}</Text>
        </View>
      </View>
      <Text style={styles.accountName} numberOfLines={1}>{displayName}</Text>
      <Text style={styles.accountMask}>•••• {account.mask || '----'}</Text>
      <View style={styles.accountBalanceWrap}>
        <Text style={styles.accountBalance}>{formatCurrency(current)}</Text>
        {available != null && available !== current && (
          <Text style={styles.accountAvailable}>{formatCurrency(available)} available</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: 100,
  },
  loadingText: {
    ...Typography.caption,
    color: Colors.text.muted,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: Spacing.lg,
    ...(Platform.OS === 'web' ? {
      background: CARD_BG,
      border: `1px solid ${CARD_BORDER}`,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    } as any : {}),
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  heroStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
  },
  syncText: {
    ...Typography.caption,
    color: Colors.accent.cyan,
  },
  heroBalanceContainer: {
    gap: Spacing.xs,
  },
  heroLabel: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  heroBalance: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.text.primary,
    lineHeight: 44,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  heroMetaText: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  emptyHero: {
    marginTop: Spacing.lg,
    gap: Spacing.lg,
  },
  emptyMessage: {
    ...Typography.body,
    color: Colors.text.tertiary,
    lineHeight: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
    flex: 1,
  },
  sectionBadge: {
    ...Typography.smallMedium,
    color: Colors.accent.cyan,
    backgroundColor: Colors.accent.cyanLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  accountsScroll: {
    gap: Spacing.md,
  },
  accountCard: {
    backgroundColor: CARD_BG,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: Spacing.lg,
    width: 220,
    gap: Spacing.xs,
    ...(Platform.OS === 'web' ? {
      background: CARD_BG,
      border: `1px solid ${CARD_BORDER}`,
      backgroundImage: svgPatterns.currency('rgba(255,255,255,0.02)'),
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right center',
      backgroundSize: '20% auto',
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    } as any : {}),
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  accountIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent.cyanLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountTypeBadge: {
    backgroundColor: Colors.background.elevated,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  accountTypeText: {
    ...Typography.micro,
    color: Colors.text.tertiary,
    textTransform: 'capitalize',
  },
  accountName: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
  },
  accountMask: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  accountBalanceWrap: {
    marginTop: Spacing.sm,
    gap: 2,
  },
  accountBalance: {
    ...Typography.headline,
    color: Colors.text.primary,
  },
  accountAvailable: {
    ...Typography.small,
    color: Colors.text.tertiary,
  },
  emptySection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyText: {
    ...Typography.caption,
    color: Colors.text.muted,
  },
  balanceSummary: {
    gap: 0,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  balanceLabel: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  balanceValue: {
    ...Typography.bodyMedium,
    color: Colors.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surface.cardBorder,
  },
  transactionsList: {
    gap: 0,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  txRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface.cardBorder,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
    marginRight: Spacing.md,
  },
  txIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txInfo: {
    flex: 1,
    gap: 2,
  },
  txName: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
  },
  txMeta: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  txAmount: {
    ...Typography.captionMedium,
  },
  connectBankBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent.cyan,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  connectBankText: {
    ...Typography.captionMedium,
    color: '#ffffff',
  },
  addBankBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(59,130,246,0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  addBankText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
});
