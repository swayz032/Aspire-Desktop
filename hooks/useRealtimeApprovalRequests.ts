/**
 * useRealtimeApprovalRequests
 *
 * Dual-path notification system for authority queue items:
 * 1. Supabase Realtime (primary) — instant push via postgres_changes on approval_requests
 * 2. Polling fallback (secondary) — catches missed events every 30 seconds
 *
 * Writes to authorityQueueStore, consumed by:
 * - DesktopHome (master queue — all items)
 * - DesktopHeader (bell notification count)
 * - Finance Hub (finance-domain items)
 * - Conference Lobby (docs/PDFs + video invites)
 *
 * Mount this hook once at the app layout level (_layout.tsx).
 *
 * Law #6: Tenant Isolation — filters by tenant_id via RLS + explicit filter.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabase } from '@/providers';
import { isLocalSyntheticAuthBypass } from '@/lib/supabaseRuntime';
import { devLog, devWarn, devError } from '@/lib/devLog';
import {
  addAuthorityItem,
  removeAuthorityItem,
  setAuthorityItems,
} from '@/lib/authorityQueueStore';
import { getAuthorityQueue } from '@/lib/api';
import type { AuthorityItem } from '@/types';

const LOG_PREFIX = '[ApprovalRequests]';
const POLL_INTERVAL_MS = 30_000;

/** Format a numeric amount as locale-aware currency string */
function formatCurrency(amount: number | string | undefined | null, currency = 'usd'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (num == null || isNaN(num)) return '';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(num);
  } catch {
    return `$${num.toFixed(2)}`;
  }
}

/** Compute "Due in X days" label from a date string */
function daysUntilLabel(dateStr: string | undefined | null): string {
  if (!dateStr) return 'Due now';
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  if (diff <= 0) return 'Due now';
  if (diff === 1) return 'Due in 1 day';
  return `Due in ${diff} days`;
}

/** Detect item type from tool/operation fields */
function detectItemType(tool: string, _operation: string): AuthorityItem['type'] {
  const t = tool.toLowerCase();
  if (t === 'invoice' || t.startsWith('invoice')) return 'invoice';
  if (t === 'quote' || t.startsWith('quote')) return 'quote';
  if (t === 'contract' || t === 'nda') return 'contract';
  return 'approval';
}

/** Build a documentPreview for invoice/quote/contract items */
function buildDocumentPreview(
  itemType: AuthorityItem['type'],
  fields: {
    amount?: string; currency?: string; customerName?: string;
    invoiceNumber?: string; dueDate?: string; description?: string;
    assignedAgent?: string; draftSummary?: string;
  },
): AuthorityItem['documentPreview'] | undefined {
  if (itemType === 'invoice' || itemType === 'quote') {
    const amountStr = formatCurrency(fields.amount, fields.currency);
    const typeLabel = itemType === 'quote' ? 'QUOTE' : 'INVOICE';
    const lines = [
      fields.invoiceNumber ? `${typeLabel} #${fields.invoiceNumber}` : typeLabel,
      '',
      fields.customerName ? `To: ${fields.customerName}` : null,
      '',
      fields.description || fields.draftSummary || 'Services Rendered:',
      '',
      amountStr ? `TOTAL DUE: ${amountStr}` : null,
    ].filter((l): l is string => l !== null).join('\n');

    return {
      type: itemType === 'quote' ? 'quote' : 'invoice',
      content: lines,
      metadata: {
        amount: amountStr || undefined,
        dueDate: fields.dueDate
          ? new Date(fields.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : undefined,
        counterparty: fields.customerName || undefined,
        preparedBy: fields.assignedAgent || undefined,
      },
    };
  }

  if (itemType === 'contract') {
    return {
      type: 'contract',
      content: fields.draftSummary || fields.description || 'Contract document',
      metadata: {
        counterparty: fields.customerName || undefined,
        preparedBy: fields.assignedAgent || undefined,
      },
    };
  }

  return undefined;
}

/** Map a Supabase approval_requests row to an AuthorityItem for the store */
function rowToAuthorityItem(row: Record<string, unknown>): AuthorityItem {
  const riskTier = (row.risk_tier as string) || 'yellow';
  const tool = (row.tool as string) || '';
  const operation = (row.operation as string) || '';
  const typeLabel = tool && operation ? `${tool}.${operation}` : tool || operation || 'approval';

  // Extract fields from payload_redacted / execution_payload
  const payloadRedacted = row.payload_redacted as Record<string, unknown> | undefined;
  const execPayload = row.execution_payload as Record<string, unknown> | undefined;
  const hostedInvoiceUrl = (payloadRedacted?.hosted_invoice_url as string) || undefined;

  const itemType = detectItemType(tool, operation);
  const customerName = (execPayload?.customer_name as string) || undefined;
  const amount = (execPayload?.amount_cents != null)
    ? String(Number(execPayload.amount_cents) / 100)
    : (payloadRedacted?.amount as string) || undefined;
  const currency = (execPayload?.currency as string) || (payloadRedacted?.currency as string) || 'usd';
  const dueDate = (execPayload?.due_date as string) || undefined;
  const invoiceNumber = (execPayload?.invoice_number as string) || undefined;
  const description = (execPayload?.description as string) || undefined;
  const assignedAgent = (row.assigned_agent as string) || '';
  const draftSummary = (row.draft_summary as string) || undefined;

  const documentPreview = buildDocumentPreview(itemType, {
    amount, currency, customerName, invoiceNumber, dueDate, description, assignedAgent, draftSummary,
  });

  const subtitle = itemType === 'invoice' || itemType === 'quote'
    ? `Accounts Payable • ${daysUntilLabel(dueDate)}`
    : itemType === 'contract'
      ? `Draft ready • Approval required`
      : assignedAgent ? `Agent: ${assignedAgent}` : typeLabel;

  return {
    id: (row.approval_id as string) || (row.id as string) || '',
    title: draftSummary || typeLabel || 'Approval Request',
    subtitle,
    type: itemType,
    status: 'pending' as const,
    priority: riskTier === 'red' ? 'high' as const : riskTier === 'yellow' ? 'medium' as const : 'low' as const,
    timestamp: (row.created_at as string) || new Date().toISOString(),
    dueDate: dueDate || undefined,
    actions: ['review', 'approve', 'deny'],
    riskTier: riskTier as 'green' | 'yellow' | 'red',
    assignedAgent,
    staffRole: assignedAgent,
    draftSummary,
    pandadocDocumentId: (row.pandadoc_document_id as string) || undefined,
    hostedInvoiceUrl,
    documentPreview,
  };
}

/** Map API response item to AuthorityItem */
function apiRowToAuthorityItem(r: Record<string, unknown>): AuthorityItem {
  const risk = (r.risk as string) || 'yellow';
  const typeStr = (r.type as string) || '';
  const tool = (r.tool as string) || typeStr.split('.')[0] || '';
  const operation = (r.operation as string) || typeStr.split('.')[1] || '';
  const assignedAgent = (r.assignedAgent as string) || '';
  const draftSummary = (r.draftSummary as string) || undefined;
  const customerName = (r.customerName as string) || undefined;
  const amount = r.amount != null ? String(r.amount) : undefined;
  const currency = (r.currency as string) || 'usd';
  const dueDate = (r.dueDate as string) || undefined;
  const invoiceNumber = (r.invoiceNumber as string) || undefined;
  const description = (r.invoiceDescription as string) || undefined;

  const itemType = detectItemType(tool, operation);

  const documentPreview = buildDocumentPreview(itemType, {
    amount, currency, customerName, invoiceNumber, dueDate, description, assignedAgent, draftSummary,
  });

  const subtitle = itemType === 'invoice' || itemType === 'quote'
    ? `Accounts Payable • ${daysUntilLabel(dueDate)}`
    : itemType === 'contract'
      ? `Draft ready • Approval required`
      : assignedAgent ? `Agent: ${assignedAgent}` : (typeStr || 'Approval');

  return {
    id: (r.id as string) ?? '',
    title: draftSummary || (r.title as string) || typeStr || 'Approval Request',
    subtitle,
    type: itemType,
    status: 'pending' as const,
    priority: risk === 'red' ? 'high' as const : risk === 'yellow' ? 'medium' as const : 'low' as const,
    timestamp: (r.createdAt as string) ?? new Date().toISOString(),
    dueDate: dueDate || undefined,
    actions: ['review', 'approve', 'deny'],
    riskTier: risk as 'green' | 'yellow' | 'red',
    assignedAgent,
    staffRole: assignedAgent,
    draftSummary,
    pandadocDocumentId: (r.pandadocDocumentId as string) || undefined,
    hostedInvoiceUrl: (r.hostedInvoiceUrl as string) || undefined,
    documentPreview,
  };
}

export function useRealtimeApprovalRequests(): void {
  const { session, suiteId } = useSupabase();
  const realtimeConnected = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const MAX_RETRIES = 3;
  const RETRY_BASE_MS = 3000;

  useEffect(() => {
    if (isLocalSyntheticAuthBypass()) return;
    if (!session?.user?.id) return;
    // Law #6: Tenant isolation — require suiteId before subscribing
    if (!suiteId) return;

    const userId = session.user.id;
    const accessToken = session.access_token;
    let disposed = false;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    devLog(`${LOG_PREFIX} Initializing for user ${userId.slice(0, 8)}...`);

    // ── 1. Supabase Realtime subscription (primary — instant) ──────────

    const createSubscription = () => {
      if (disposed) return;

      // Filter by tenant_id (RLS also enforces this)
      const filter = `tenant_id=eq.${suiteId}`;
      const channelName = `approval-requests-${userId.slice(0, 8)}-${Date.now()}`;

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'approval_requests',
            filter,
          },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            devLog(`${LOG_PREFIX} Realtime INSERT:`, { id: row.approval_id || row.id, risk_tier: row.risk_tier, status: row.status });
            if (row.status === 'pending') {
              addAuthorityItem(rowToAuthorityItem(row));
            }
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'approval_requests',
            filter,
          },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            devLog(`${LOG_PREFIX} Realtime UPDATE:`, { id: row.approval_id || row.id, status: row.status });
            const id = (row.approval_id as string) || (row.id as string);
            if (id && row.status !== 'pending') {
              removeAuthorityItem(id);
            }
          },
        )
        .subscribe((status, err) => {
          devLog(`${LOG_PREFIX} Subscription status: ${status}`, err || '');
          if (status === 'SUBSCRIBED') {
            realtimeConnected.current = true;
            retryCountRef.current = 0;
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            realtimeConnected.current = false;
            if (retryCountRef.current < MAX_RETRIES) {
              const delay = RETRY_BASE_MS * Math.pow(2, retryCountRef.current);
              retryCountRef.current++;
              devWarn(`${LOG_PREFIX} Retry ${retryCountRef.current}/${MAX_RETRIES} in ${delay}ms...`);
              retryTimerRef.current = setTimeout(() => {
                supabase.removeChannel(channel);
                createSubscription();
              }, delay);
            } else {
              devError(`${LOG_PREFIX} Max retries (${MAX_RETRIES}) reached. Falling back to polling only.`);
            }
          }
        });

      channels.push(channel);
    };

    createSubscription();

    // ── 2. Polling fallback (secondary — catches missed events) ────────
    // Runs every 30s. If Realtime is working, polling typically finds nothing new.
    // If Realtime is down, polling is the safety net.

    const hydrateFromApi = async () => {
      try {
        const rows = await getAuthorityQueue(accessToken, suiteId ?? undefined);
        if (disposed) return;

        const items: AuthorityItem[] = rows.map((r: Record<string, unknown>) => apiRowToAuthorityItem(r));
        setAuthorityItems(items);
      } catch (err) {
        devWarn(`${LOG_PREFIX} Poll error:`, err);
      }
    };

    // Initial hydration + periodic polling
    hydrateFromApi();
    const pollTimer = setInterval(hydrateFromApi, POLL_INTERVAL_MS);

    // ── Cleanup ────────────────────────────────────────────────────────

    return () => {
      devLog(`${LOG_PREFIX} Cleaning up subscriptions`);
      disposed = true;
      realtimeConnected.current = false;
      channels.forEach(ch => supabase.removeChannel(ch));
      clearInterval(pollTimer);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [session?.user?.id, suiteId]);
}
