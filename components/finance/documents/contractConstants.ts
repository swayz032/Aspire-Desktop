/**
 * Contract status visual constants used across all document library components.
 * Colors follow Aspire dark premium palette from @/constants/tokens.
 */

export type ContractStatus = 'draft' | 'reviewed' | 'sent' | 'signed' | 'archived' | 'expired';

export const CONTRACT_STATUS: Record<ContractStatus, { color: string; bg: string; label: string }> = {
  draft: { color: '#6e6e73', bg: 'rgba(110,110,115,0.15)', label: 'Draft' },
  reviewed: { color: '#0891B2', bg: 'rgba(8,145,178,0.15)', label: 'Reviewed' },
  sent: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'Sent' },
  signed: { color: '#34c759', bg: 'rgba(52,199,89,0.15)', label: 'Signed' },
  archived: { color: '#8e8e93', bg: 'rgba(142,142,147,0.15)', label: 'Archived' },
  expired: { color: '#ff3b30', bg: 'rgba(255,59,48,0.15)', label: 'Expired' },
};

/** Ordered list of all 6 states in the contract lifecycle. */
export const CONTRACT_LIFECYCLE: ContractStatus[] = [
  'draft', 'reviewed', 'sent', 'signed', 'archived', 'expired',
];

/** Template lane metadata for the 4 Clara Legal lanes. */
export type TemplateLane = 'trades' | 'accounting' | 'landlord' | 'general';

export const LANE_META: Record<TemplateLane, { label: string; icon: string; color: string }> = {
  trades: { label: 'Trades', icon: 'construct-outline', color: '#f59e0b' },
  accounting: { label: 'Accounting', icon: 'calculator-outline', color: '#3B82F6' },
  landlord: { label: 'Landlord', icon: 'home-outline', color: '#8B5CF6' },
  general: { label: 'General', icon: 'document-text-outline', color: '#0891B2' },
};
