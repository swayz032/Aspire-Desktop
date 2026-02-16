import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius } from '@/constants/tokens';
import { CARD_BG, CARD_BORDER } from '@/constants/cardPatterns';

interface PayrollSubTabProps {
  gustoCompany: any;
  gustoEmployees: any[];
  gustoConnected: boolean;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '—';
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PayrollPayHistory({ gustoCompany, gustoEmployees, gustoConnected }: PayrollSubTabProps) {
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    async function fetchPayrolls() {
      try {
        setLoading(true);
        const res = await fetch('/api/gusto/payrolls');
        if (!res.ok) throw new Error('Failed to fetch payrolls');
        const data = await res.json();
        setPayrolls(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setError(e.message || 'Failed to load payrolls');
      } finally {
        setLoading(false);
      }
    }
    if (gustoConnected) {
      fetchPayrolls();
    } else {
      setLoading(false);
    }
  }, [gustoConnected]);

  const handleRefreshPayrolls = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const res = await fetch('/api/gusto/payrolls');
      if (!res.ok) throw new Error('Failed to fetch payrolls');
      const data = await res.json();
      setPayrolls(Array.isArray(data) ? data : []);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (e: any) {
      setError(e.message || 'Failed to refresh payrolls');
    } finally {
      setRefreshing(false);
    }
  };

  if (!gustoConnected) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="cloud-offline-outline" size={32} color="#6e6e73" />
        </View>
        <Text style={styles.emptyTitle}>Payroll Not Connected</Text>
        <Text style={styles.emptySubtitle}>Set up payroll in Connections to view payroll history.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading payroll history...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="alert-circle-outline" size={32} color="#ef4444" />
        </View>
        <Text style={styles.emptyTitle}>Error Loading Payrolls</Text>
        <Text style={styles.emptySubtitle}>{error}</Text>
      </View>
    );
  }

  if (payrolls.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="document-text-outline" size={32} color="#6e6e73" />
        </View>
        <Text style={styles.emptyTitle}>No Payroll History</Text>
        <Text style={styles.emptySubtitle}>No payroll records found. Payrolls will appear here after processing.</Text>
        <Pressable
          style={[styles.retrieveButton, refreshing && { opacity: 0.7 }]}
          onPress={handleRefreshPayrolls}
          disabled={refreshing}
          {...(Platform.OS === 'web' ? { style: [styles.retrieveButton, refreshing && { opacity: 0.7 }, { cursor: 'pointer' }] } as any : {})}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
          ) : (
            <Ionicons name="refresh" size={16} color="#ffffff" style={{ marginRight: 8 }} />
          )}
          <Text style={styles.retrieveButtonText}>
            {refreshing ? 'Retrieving...' : 'Retrieve Payrolls'}
          </Text>
        </Pressable>
      </View>
    );
  }

  const processed = payrolls.filter(p => p.processed).length;
  const unprocessed = payrolls.length - processed;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {showSuccess && (
        <View style={styles.successMessage}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginRight: 8 }} />
          <Text style={styles.successText}>Payroll history updated</Text>
        </View>
      )}
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Payroll History</Text>
        <View style={styles.headerControls}>
          <View style={styles.statsRow}>
            <View style={[styles.statBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }, Platform.OS === 'web' ? { boxShadow: '0 0 6px #10B98125' } as any : {}]}>
              <Text style={[styles.statText, { color: '#10B981' }]}>{processed} Processed</Text>
            </View>
            {unprocessed > 0 && (
              <View style={[styles.statBadge, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }, Platform.OS === 'web' ? { boxShadow: '0 0 6px #f59e0b25' } as any : {}]}>
                <Text style={[styles.statText, { color: '#f59e0b' }]}>{unprocessed} Pending</Text>
              </View>
            )}
          </View>
          <Pressable
            style={[styles.refreshButton, refreshing && { opacity: 0.7 }]}
            onPress={handleRefreshPayrolls}
            disabled={refreshing}
            {...(Platform.OS === 'web' ? { onMouseEnter: () => {}, onMouseLeave: () => {} } as any : {})}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="refresh" size={16} color="#ffffff" />
            )}
          </Pressable>
        </View>
      </View>

      {payrolls.map((payroll: any, idx: number) => {
        const id = payroll.payroll_uuid || payroll.uuid || payroll.id || Math.random().toString();
        const isExpanded = expandedId === id;
        const isHovered = hoveredId === id;
        const isProcessed = payroll.processed === true;
        const period = payroll.pay_period || {};

        return (
          <Pressable
            key={id}
            style={[
              styles.card,
              idx % 2 === 0 && styles.cardEvenRow,
              isExpanded && styles.cardExpanded,
              isHovered && !isExpanded && styles.cardHovered,
            ]}
            onPress={() => setExpandedId(isExpanded ? null : id)}
            {...(Platform.OS === 'web' ? {
              onMouseEnter: () => setHoveredId(id),
              onMouseLeave: () => setHoveredId(null),
            } as any : {})}
          >
            <View style={styles.cardTop}>
              <View style={[styles.statusDot, { backgroundColor: isProcessed ? '#10B981' : '#f59e0b' }]} />
              <View style={styles.cardInfo}>
                <Text style={styles.periodText}>
                  {formatDate(period.start_date)} — {formatDate(period.end_date)}
                </Text>
                <Text style={styles.checkDateText}>Check Date: {formatDate(payroll.check_date)}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: isProcessed ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)' }, Platform.OS === 'web' ? { boxShadow: isProcessed ? '0 0 6px #10B98125' : '0 0 6px #f59e0b25' } as any : {}]}>
                <Text style={[styles.statusText, { color: isProcessed ? '#10B981' : '#f59e0b' }]}>
                  {isProcessed ? 'Processed' : 'Unprocessed'}
                </Text>
              </View>
              <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-forward'} size={16} color="#6e6e73" />
            </View>

            {isExpanded && (
              <View style={styles.expandedContent}>
                <View style={styles.detailGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Payroll UUID</Text>
                    <Text style={styles.detailValue}>{id}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Pay Period Start</Text>
                    <Text style={styles.detailValue}>{formatDate(period.start_date)}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Pay Period End</Text>
                    <Text style={styles.detailValue}>{formatDate(period.end_date)}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Check Date</Text>
                    <Text style={styles.detailValue}>{formatDate(payroll.check_date)}</Text>
                  </View>
                  {payroll.processed_date && (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Processed Date</Text>
                      <Text style={styles.detailValue}>{formatDate(payroll.processed_date)}</Text>
                    </View>
                  )}
                  {payroll.payroll_deadline && (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Deadline</Text>
                      <Text style={styles.detailValue}>{formatDate(payroll.payroll_deadline)}</Text>
                    </View>
                  )}
                  {payroll.totals && (
                    <>
                      {payroll.totals.gross_pay && (
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Gross Pay</Text>
                          <Text style={[styles.detailValue, { color: '#ffffff' }]}>{formatCurrency(payroll.totals.gross_pay)}</Text>
                        </View>
                      )}
                      {payroll.totals.net_pay && (
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Net Pay</Text>
                          <Text style={[styles.detailValue, { color: '#10B981' }]}>{formatCurrency(payroll.totals.net_pay)}</Text>
                        </View>
                      )}
                    </>
                  )}
                </View>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    ...(Platform.OS === 'web' ? { boxShadow: '0 0 6px #10B98125' } as any : {}),
  },
  successText: {
    color: '#10B981',
    ...Typography.small,
    fontWeight: '500',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  sectionTitle: {
    color: '#ffffff',
    ...Typography.headline,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  refreshButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    } as any : {}),
  },
  statBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statText: {
    ...Typography.smallMedium,
  },
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    padding: 18,
    marginBottom: 8,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      background: CARD_BG as any,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)' as any,
    } as any : {}),
  },
  cardEvenRow: {
    backgroundColor: 'rgba(28,28,30,0.7)',
  },
  cardExpanded: {
    borderColor: 'rgba(255,255,255,0.10)',
  },
  cardHovered: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardInfo: {
    flex: 1,
  },
  periodText: {
    color: '#ffffff',
    ...Typography.captionMedium,
  },
  checkDateText: {
    color: '#6e6e73',
    ...Typography.small,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    ...Typography.small,
    fontWeight: '500',
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  detailItem: {
    minWidth: 150,
  },
  detailLabel: {
    color: '#6e6e73',
    ...Typography.small,
    marginBottom: 4,
  },
  detailValue: {
    color: '#d1d1d6',
    ...Typography.captionMedium,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#ffffff',
    ...Typography.headline,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#6e6e73',
    ...Typography.caption,
    textAlign: 'center',
  },
  loadingText: {
    color: '#6e6e73',
    ...Typography.caption,
    marginTop: 12,
  },
  retrieveButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    } as any : {}),
  },
  retrieveButtonText: {
    color: '#ffffff',
    ...Typography.smallMedium,
    fontWeight: '500',
  },
});
