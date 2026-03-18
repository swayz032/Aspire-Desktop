import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { playClickSound, playApproveSound } from '@/lib/sounds';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface Party {
  name: string;
  role: string;
  signed: boolean;
  signed_at?: string | null;
}

interface Contract {
  id: string;
  contract_number: string;
  title: string;
  type_tag: string;
  sender_name: string;
  sender_email: string;
  client_name: string;
  client_email: string;
  status: string;
  signature_status: string;
  deadline: string;
  parties: Party[];
}

interface ContractWidgetProps {
  suiteId: string;
  officeId: string;
  contractId?: string;
  onViewClick?: (contractId: string) => void;
  onSendReminderClick?: (contractId: string) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444'];
function avatarColor(name: string): string {
  const h = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function progressFromStatus(status: string): number {
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'signed') return 1;
  if (s === 'partially_signed') return 0.5;
  if (s === 'sent') return 0.25;
  return 0.1;
}

const DEMO_CONTRACT: Contract = {
  id: 'demo-1',
  contract_number: 'CT-2026-018',
  title: 'Software Services Agreement',
  type_tag: 'SaaS',
  sender_name: 'Aspire Inc.',
  sender_email: 'legal@aspire.com',
  client_name: 'Jennifer Walsh',
  client_email: 'jwalsh@acme.com',
  status: 'sent',
  signature_status: 'awaiting_signature',
  deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
  parties: [
    { name: 'Aspire Inc.', role: 'Provider', signed: true, signed_at: new Date().toISOString() },
    { name: 'Jennifer Walsh', role: 'Client', signed: false, signed_at: null },
  ],
};

const KEY_DATES = [
  { label: 'Contract Date', value: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
  { label: 'Effective Date', value: new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
  { label: 'Term Length', value: '12 months' },
  { label: 'Renewal', value: 'Auto-renews annually' },
];

function ContractWidgetInner({ suiteId, officeId, contractId, onViewClick, onSendReminderClick }: ContractWidgetProps) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [reminderSent, setReminderSent] = useState(false);

  const fetchContract = useCallback(async () => {
    try {
      setLoading(true);
      const query = supabase.from('contracts').select('*').eq('suite_id', suiteId).eq('office_id', officeId);
      const finalQuery = contractId
        ? query.eq('id', contractId).single()
        : query.order('created_at', { ascending: false }).limit(1).single();
      const { data, error } = await finalQuery;
      if (error) throw error;
      setContract({
        id: data.id,
        contract_number: data.contract_number || `CT-${data.id.slice(0, 6).toUpperCase()}`,
        title: data.title || 'Service Agreement',
        type_tag: data.type_tag || 'Contract',
        sender_name: data.sender_name || 'Your Company',
        sender_email: data.sender_email || '',
        client_name: data.client_name || 'Client',
        client_email: data.client_email || '',
        status: data.status || 'draft',
        signature_status: data.signature_status || 'pending',
        deadline: data.deadline || new Date(Date.now() + 7 * 86400000).toISOString(),
        parties: (data.parties ?? [
          { name: data.sender_name || 'Provider', role: 'Provider', signed: true },
          { name: data.client_name || 'Client', role: 'Client', signed: false },
        ]) as Party[],
      });
    } catch {
      setContract(DEMO_CONTRACT);
    } finally {
      setLoading(false);
    }
  }, [suiteId, officeId, contractId]);

  useEffect(() => { fetchContract(); }, [fetchContract]);

  if (loading || !contract) {
    return (
      <View style={[s.root, s.center]}>
        <Text style={s.mutedText}>Loading…</Text>
      </View>
    );
  }

  const progress = progressFromStatus(contract.signature_status);
  const deadlineDate = new Date(contract.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const allSigned = contract.parties.every(p => p.signed);

  return (
    <View style={s.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        {/* Contract number + title */}
        <View style={s.titleSection}>
          <Text style={s.contractNumber}>{contract.contract_number}</Text>
          <View style={s.typePill}>
            <Text style={s.typePillText}>{contract.type_tag}</Text>
          </View>
        </View>
        <Text style={s.contractTitle}>{contract.title}</Text>

        {/* THE UNFORGETTABLE ELEMENT — two party circles connected by a line */}
        <View style={s.partiesContainer}>
          {contract.parties.map((party, idx) => {
            const color = avatarColor(party.name);
            return (
              <React.Fragment key={idx}>
                <View style={s.partyCol}>
                  <View style={[s.partyCircle, { backgroundColor: color }]}>
                    <Text style={s.partyInitials}>{getInitials(party.name)}</Text>
                    {party.signed && (
                      <View style={s.signedBadge}>
                        <Ionicons name="checkmark" size={10} color="#FFF" />
                      </View>
                    )}
                  </View>
                  <Text style={s.partyName} numberOfLines={1}>{party.name}</Text>
                  <Text style={s.partyRole}>{party.role}</Text>
                  <View style={[s.signChip, { backgroundColor: party.signed ? '#16A34A' : '#DC2626' }]}>
                    <Text style={s.signChipText}>{party.signed ? 'Signed' : 'Pending'}</Text>
                  </View>
                </View>
                {idx < contract.parties.length - 1 && (
                  <View style={s.connectorWrap}>
                    <View style={s.connectorLine} />
                    <View style={[s.connectorDot, { backgroundColor: allSigned ? '#10B981' : '#F59E0B' }]} />
                  </View>
                )}
              </React.Fragment>
            );
          })}
        </View>

        {/* Progress */}
        <View style={s.progressSection}>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, {
              width: `${progress * 100}%` as any,
              backgroundColor: allSigned ? '#10B981' : '#3B82F6',
            }]} />
          </View>
          <Text style={s.progressLabel}>
            {allSigned ? 'Fully Executed' : `${contract.parties.filter(p => p.signed).length} of ${contract.parties.length} signed`}
          </Text>
        </View>

        {/* Key dates */}
        <View style={s.datesSection}>
          <Text style={s.sectionLabel}>KEY DATES</Text>
          {KEY_DATES.map((d, i) => (
            <View key={i} style={s.dateRow}>
              <Text style={s.dateLabel}>{d.label}</Text>
              <Text style={s.dateValue}>{d.value}</Text>
            </View>
          ))}
          <View style={s.dateRow}>
            <Text style={s.dateLabel}>Signature Deadline</Text>
            <Text style={[s.dateValue, { color: '#F59E0B' }]}>{deadlineDate}</Text>
          </View>
        </View>
      </ScrollView>

      {/* CTAs */}
      <View style={s.ctaRow}>
        {!allSigned && (
          <Pressable
            style={s.reminderBtn}
            onPress={() => {
              if (reminderSent) return;
              playClickSound();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setReminderSent(true);
              onSendReminderClick?.(contract.id);
            }}
          >
            <Text style={s.reminderBtnText}>{reminderSent ? 'Reminder Sent ✓' : 'Send Reminder'}</Text>
          </Pressable>
        )}
        <Pressable
          style={s.viewBtn}
          onPress={() => {
            playClickSound();
            onViewClick?.(contract.id);
          }}
        >
          <Text style={s.viewBtnText}>View Contract</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#060A10',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  mutedText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 14,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 8,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  contractNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1,
  } as any,
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.4)',
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3B82F6',
    letterSpacing: 0.5,
  } as any,
  contractTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    lineHeight: 26,
    marginBottom: 28,
    letterSpacing: -0.4,
  } as any,
  partiesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  partyCol: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  partyCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  partyInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  } as any,
  signedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#060A10',
  },
  partyName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    maxWidth: 100,
  } as any,
  partyRole: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },
  signChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  signChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  } as any,
  connectorWrap: {
    flex: 0.4,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingBottom: 54,
  },
  connectorLine: {
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  connectorDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressSection: {
    gap: 8,
    marginBottom: 20,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  datesSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    paddingTop: 16,
    gap: 2,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: 1.5,
    marginBottom: 8,
  } as any,
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  dateLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  dateValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  } as any,
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  reminderBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  reminderBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  } as any,
  viewBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  viewBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  } as any,
});

export function ContractWidget(props: any) {
  return (
    <PageErrorBoundary pageName="contract-widget">
      <ContractWidgetInner {...props} />
    </PageErrorBoundary>
  );
}
