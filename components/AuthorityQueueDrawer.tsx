/**
 * AuthorityQueueDrawer — Premium right-edge slide-out for the Authority Queue.
 *
 * Hidden by default. A vertical "Authority" tab sticks out on the right edge of
 * the viewport (Aspire grey). Clicking it opens a slide-out panel containing
 * the existing Authority Queue cards. Closing returns it to the tab-only state.
 *
 * Web-first (position:fixed). On native it falls back to absolute positioning
 * inside its parent.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '@/constants/tokens';
import { AuthorityQueueCard } from '@/components/AuthorityQueueCard';
import { useDynamicAuthorityQueue, removeAuthorityItem } from '@/lib/authorityQueueStore';
import { useSupabase } from '@/providers';
import { DocumentPreviewModal } from '@/components/DocumentPreviewModal';

const PANEL_WIDTH = 460;

function labelForType(t: string): string {
  switch (t) {
    case 'invoice': return 'invoice';
    case 'quote': return 'quote';
    case 'contract': return 'contract';
    default: return 'request';
  }
}

export function AuthorityQueueDrawer() {
  const router = useRouter();
  const { session } = useSupabase();
  const items = useDynamicAuthorityQueue();
  const [open, setOpen] = useState(false);
  const [reviewPreview, setReviewPreview] = useState<{
    visible: boolean;
    type: 'invoice' | 'quote' | 'contract' | 'report' | 'email' | 'document' | 'recording';
    documentName?: string;
    pandadocDocumentId?: string;
    draftSummary?: string;
    amount?: number;
    customerName?: string;
    currency?: string;
    livePreviewUrl?: string;
  }>({ visible: false, type: 'document' });

  const toggle = useCallback(() => setOpen(o => !o), []);
  const close = useCallback(() => setOpen(false), []);

  // Per-item in-flight set so the user can't double-fire approve/deny while
  // the orchestrator is resuming. Also drives the inline toast feedback row
  // so the user actually sees whether approve/deny landed.
  const [inFlight, setInFlight] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<null | { kind: 'success' | 'error'; message: string }>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const flashToast = useCallback((kind: 'success' | 'error', message: string) => {
    setToast({ kind, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), kind === 'success' ? 2400 : 4000);
  }, []);

  const callDecision = useCallback(async (
    endpoint: 'approve' | 'deny',
    item: any,
  ): Promise<{ ok: boolean; status: number; body?: any; message?: string }> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    try {
      const res = await fetch(`/api/authority-queue/${item.id}/${endpoint}`, {
        method: 'POST',
        headers,
        body: endpoint === 'deny' ? JSON.stringify({ reason: 'user_denied' }) : JSON.stringify({}),
      });
      const text = await res.text();
      let body: any = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      if (!res.ok) {
        const message = (body && (body.message || body.error)) || `HTTP ${res.status}`;
        return { ok: false, status: res.status, body, message };
      }
      return { ok: true, status: res.status, body };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        message: err instanceof Error ? err.message : 'Network error',
      };
    }
  }, [session?.access_token]);

  const handleAction = useCallback(async (item: any, action: string) => {
    if (action === 'join') {
      router.push('/session/conference-live' as any);
      return;
    }

    if (action === 'approve' || action === 'deny') {
      if (inFlight.has(item.id)) return;
      setInFlight(prev => { const next = new Set(prev); next.add(item.id); return next; });

      const result = await callDecision(action, item);

      setInFlight(prev => { const next = new Set(prev); next.delete(item.id); return next; });

      if (result.ok) {
        if (action === 'approve') {
          // Backend already called orchestrator /v1/resume which dispatches
          // the real invoice.send (or whatever the queued tool is). Surface
          // whether the downstream execution actually ran so the user knows
          // the invoice was sent and not just marked approved.
          const sent = result.body?.executed === true;
          flashToast(
            sent ? 'success' : 'error',
            sent
              ? `Approved — ${labelForType(item.type)} sent`
              : `Approved, but send failed${result.body?.error ? `: ${result.body.error}` : ''}. Will retry.`
          );
        } else {
          flashToast('success', `Denied — ${labelForType(item.type)} voided`);
        }
        removeAuthorityItem(item.id);
      } else {
        flashToast('error', `${action === 'approve' ? 'Approve' : 'Deny'} failed: ${result.message}`);
      }
      return;
    }

    if (action === 'review') {
      const docType: any = item.type === 'invoice' ? 'invoice'
        : item.type === 'quote' ? 'quote'
        : item.type === 'contract' ? 'contract'
        : 'document';
      const meta = item.documentPreview?.metadata;
      // Render the live invoice/quote document inline (Stripe hosted URL) inside
      // the preview modal instead of bouncing the user out to a new browser tab.
      // The modal exposes an "Open in new tab" action when external access is
      // needed (e.g. paying the invoice on Stripe).
      setReviewPreview({
        visible: true,
        type: docType,
        documentName: item.title,
        pandadocDocumentId: item.pandadocDocumentId,
        draftSummary: item.draftSummary,
        amount: meta?.amount ? parseFloat(String(meta.amount).replace(/[^0-9.-]/g, '')) : undefined,
        customerName: meta?.counterparty,
        currency: 'USD',
        // Prefer raw PDF URL for inline iframe preview; fall back to the
        // Stripe hosted webpage if no PDF URL was captured.
        livePreviewUrl: item.invoicePdfUrl || item.hostedInvoiceUrl,
      });
    }
  }, [router, session?.access_token, inFlight, callDecision, flashToast]);

  const count = items.length;

  return (
    <>
      {/* Backdrop — clicking it closes the panel */}
      {open && (
        <Pressable
          style={s.backdrop}
          onPress={close}
          testID="authority-drawer-backdrop"
        />
      )}

      {/* Slide-out panel */}
      <View
        style={[
          s.panel,
          { transform: [{ translateX: open ? 0 : PANEL_WIDTH + 40 }] },
        ]}
        pointerEvents={open ? 'auto' : 'none'}
        testID="authority-drawer-panel"
      >
        <View style={s.panelHeader}>
          <View style={s.panelHeaderLeft}>
            <Ionicons name="shield-checkmark" size={18} color="#3B82F6" />
            <Text style={s.panelTitle}>Authority Queue</Text>
            {count > 0 && (
              <View style={s.panelCountBadge}>
                <Text style={s.panelCountText}>{count}</Text>
              </View>
            )}
          </View>
          <Pressable onPress={close} style={s.panelClose} testID="authority-drawer-close">
            <Ionicons name="close" size={18} color={Colors.text.secondary} />
          </Pressable>
        </View>

        {/* Inline action feedback — surfaces approve/deny results so the user
            actually sees whether the invoice got sent off, vs the prior
            silent-swallow behavior. */}
        {toast && (
          <View
            style={[
              s.toast,
              toast.kind === 'success' ? s.toastSuccess : s.toastError,
            ]}
            testID="authority-drawer-toast"
          >
            <Ionicons
              name={toast.kind === 'success' ? 'checkmark-circle' : 'alert-circle'}
              size={14}
              color={toast.kind === 'success' ? '#34c759' : '#ff3b30'}
            />
            <Text style={s.toastText} numberOfLines={2}>{toast.message}</Text>
          </View>
        )}

        <ScrollView
          style={s.panelBody}
          contentContainerStyle={s.panelBodyContent}
          showsVerticalScrollIndicator={false}
        >
          {count > 0 ? (
            items.map((item) => {
              const busy = inFlight.has(item.id);
              return (
                <View
                  key={item.id}
                  style={[s.cardWrap, busy && s.cardWrapBusy]}
                  pointerEvents={busy ? 'none' : 'auto'}
                >
                  <AuthorityQueueCard
                    item={item}
                    onAction={(action) => handleAction(item, action)}
                  />
                  {busy && (
                    <View style={s.cardBusyOverlay} pointerEvents="none">
                      <Text style={s.cardBusyText}>Sending…</Text>
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <View style={s.empty}>
              <Ionicons name="shield-checkmark-outline" size={28} color={Colors.accent.cyan} />
              <Text style={s.emptyHeadline}>Your approval queue is clear</Text>
              <Text style={s.emptyBody}>
                When agents need your sign-off — invoices over $500, contracts, payments — they land here. Every action leaves a receipt.
              </Text>
            </View>
          )}
        </ScrollView>

        <Pressable
          onPress={() => { close(); router.push('/inbox' as any); }}
          style={s.panelFooter}
          testID="authority-drawer-view-all"
        >
          <Text style={s.panelFooterText}>View all</Text>
          <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </View>

      {/* Right-edge tab — visible only when panel closed */}
      <Pressable
        onPress={toggle}
        style={[s.tab, open && s.tabHidden]}
        testID="authority-drawer-tab"
        accessibilityRole="button"
        accessibilityLabel="Open Authority Queue"
      >
        <View style={s.tabInner}>
          <Ionicons name="shield-checkmark" size={14} color="#ffffff" />
          <Text style={s.tabLabel}>AUTHORITY</Text>
          {count > 0 && (
            <View style={s.tabBadge}>
              <Text style={s.tabBadgeText}>{count}</Text>
            </View>
          )}
        </View>
      </Pressable>

      <DocumentPreviewModal
        visible={reviewPreview.visible}
        onClose={() => setReviewPreview(p => ({ ...p, visible: false }))}
        type={reviewPreview.type}
        documentName={reviewPreview.documentName}
        pandadocDocumentId={reviewPreview.pandadocDocumentId}
        draftSummary={reviewPreview.draftSummary}
        amount={reviewPreview.amount}
        customerName={reviewPreview.customerName}
        currency={reviewPreview.currency}
        livePreviewUrl={reviewPreview.livePreviewUrl}
      />
    </>
  );
}

const fixedPos: any = Platform.OS === 'web' ? { position: 'fixed' } : { position: 'absolute' };

const s = StyleSheet.create({
  backdrop: {
    ...fixedPos,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Founder lock 2026-05-13: heavier tint + blur so the homepage
    // recedes and full attention lands on the Authority Queue drawer.
    // 0.62 alpha + 6px blur is the same "modal-modal" treatment used on
    // DocumentPreviewModal — feels like a focused overlay, not just a
    // tinted scrim.
    backgroundColor: 'rgba(0,0,0,0.62)',
    zIndex: 90,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      transition: 'opacity 180ms ease-out',
    } : {}),
  } as any,

  // ── Right-edge tab ────────────────────────────────────────────────
  tab: {
    ...fixedPos,
    top: '50%',
    right: 0,
    transform: [{ translateY: -60 }],
    width: 36,
    height: 140,
    backgroundColor: '#2C2C2E', // Aspire grey
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 80,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  } as any,
  tabHidden: {
    transform: [{ translateY: -60 }, { translateX: 60 }],
    opacity: 0,
  } as any,
  tabInner: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: '100%',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1.5,
    // Rotate text vertically (web only — RN doesn't support multi-line rotated reliably)
    ...(Platform.OS === 'web' ? ({
      writingMode: 'vertical-rl',
      textOrientation: 'mixed',
    } as any) : {}),
  } as any,
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  } as any,

  // ── Slide-out panel ───────────────────────────────────────────────
  panel: {
    ...fixedPos,
    top: 0,
    right: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    backgroundColor: Colors.surface.card,
    borderLeftWidth: 1,
    borderLeftColor: Colors.surface.cardBorder,
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    ...(Platform.OS === 'web' ? ({
      transition: 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1)',
    } as any) : {}),
  } as any,
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface.cardBorder,
  },
  panelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.2,
  } as any,
  panelCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.35)',
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#60A5FA',
  } as any,
  panelClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  } as any,
  panelBody: {
    flex: 1,
  },
  panelBodyContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardWrap: {
    width: '100%',
    position: 'relative',
  },
  cardWrapBusy: {
    opacity: 0.55,
  },
  cardBusyOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(59,130,246,0.85)',
    borderBottomLeftRadius: 10,
    borderTopRightRadius: 12,
  },
  cardBusyText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  } as any,
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  toastSuccess: {
    backgroundColor: 'rgba(52, 199, 89, 0.10)',
    borderColor: 'rgba(52, 199, 89, 0.35)',
  },
  toastError: {
    backgroundColor: 'rgba(255, 59, 48, 0.10)',
    borderColor: 'rgba(255, 59, 48, 0.35)',
  },
  toastText: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  } as any,
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xxl,
    gap: 8,
  },
  emptyHeadline: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
  } as any,
  emptyBody: {
    color: Colors.text.tertiary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 360,
  },
  panelFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.surface.cardBorder,
    backgroundColor: Colors.background.elevated,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  } as any,
  panelFooterText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    letterSpacing: 0.2,
  } as any,
});
