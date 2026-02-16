let counters: Record<string, number> = {};

export function generateId(prefix: string): string {
  if (!counters[prefix]) {
    counters[prefix] = 0;
  }
  counters[prefix]++;
  return `${prefix}_${String(counters[prefix]).padStart(4, '0')}`;
}

export function resetCounters(): void {
  counters = {};
}

export const ID_PREFIXES = {
  INBOX: 'INB',
  OFFICE: 'OFF',
  CALL: 'CALL',
  MAIL: 'MAIL',
  CONTACT: 'CON',
  RECEIPT: 'RCP',
  INTEGRATION: 'INT',
  TEAM: 'TEAM',
  FAQ: 'FAQ',
  TICKET: 'TKT',
  POLICY: 'POL',
  DEVICE: 'DEV',
  EVENT: 'EVT',
  MESSAGE: 'MSG',
  STEP: 'STEP',
  EVIDENCE: 'EVI',
  ACTIVITY: 'ACT',
} as const;

export function officeId(n: number): string {
  return `OFF_${String(n).padStart(4, '0')}`;
}

export function callId(n: number): string {
  return `CALL_${String(n).padStart(4, '0')}`;
}

export function mailId(n: number): string {
  return `MAIL_${String(n).padStart(4, '0')}`;
}

export function contactId(n: number): string {
  return `CON_${String(n).padStart(4, '0')}`;
}

export function receiptId(n: number): string {
  return `RCP_${String(n).padStart(4, '0')}`;
}

export function integrationId(n: number): string {
  return `INT_${String(n).padStart(4, '0')}`;
}

export function teamId(n: number): string {
  return `TEAM_${String(n).padStart(4, '0')}`;
}

export function faqId(n: number): string {
  return `FAQ_${String(n).padStart(4, '0')}`;
}

export function ticketId(n: number): string {
  return `TKT_${String(n).padStart(4, '0')}`;
}
