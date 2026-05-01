/**
 * /session/messages — full-page rewrite (plan §3.9, Lane E2 + E3 shell).
 *
 * Composition (per §3.9):
 *
 *   ┌────────────────────── DesktopShell ──────────────────────┐
 *   │  ┌──────────── MessagesHero (full width) ─────────────┐  │
 *   │  │  💬 TEXT MESSAGES                Contacts  + New   │  │
 *   │  │     N conv · M unread · L drafts                   │  │
 *   │  └────────────────────────────────────────────────────┘  │
 *   │  ┌──────────── MessagesFilterTabs ───────────────────┐  │
 *   │  │  All N    Unread M    Pinned P    Archived A   ⋮  │  │
 *   │  └────────────────────────────────────────────────────┘  │
 *   │  ┌─────────┬──────────────────────────────────────────┐ │
 *   │  │ 380px   │  flex: 1                                  │ │
 *   │  │ Thread  │  MessagesRightPane (Lane E4)              │ │
 *   │  │ List    │  — falls back to placeholder branch when  │ │
 *   │  │         │    Lane E4 has not landed yet             │ │
 *   │  └─────────┴──────────────────────────────────────────┘ │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Lane scope (E2 + E3 only):
 *   - Page shell + state plumbing
 *   - Renders MessagesHero, MessagesFilterTabs, MessagesThreadList
 *   - Active filter state + selected-thread state lives here
 *   - Bulk-action handlers (mark-all-read, clear-archived) are stubbed —
 *     Lane E6 wires them to the gateway PATCH routes
 *   - Right pane: optimistic dynamic import of `MessagesRightPane` from
 *     `@/components/messages/MessagesRightPane` (Lane E4). When that file
 *     does not exist yet, we render a fallback panel that mirrors the
 *     prior plan §3.9.4 state branching (zero / suggestions / thread / compose)
 *     well enough for E2+E3 to be visually coherent on its own.
 *
 * Data source:
 *   Lane E6 wired `useMessageThreads(filter)` from `lib/messages/`. The page
 *   reads two slices in parallel — the active filter for the list, and 'all'
 *   for the universe-wide hero/counts. The hook caches by filter so tab
 *   swaps are free.
 *
 * Header:
 *   `app/session/_layout.tsx` already sets `headerShown: false`, so no
 *   route-name banner appears at the top of this page.
 */

import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

import { MessagesHero } from '@/components/messages/MessagesHero';
import {
  MessagesFilterTabs,
  type MessagesFilterTab,
} from '@/components/messages/MessagesFilterTabs';
import {
  MessagesThreadList,
  type ThreadContextAction,
} from '@/components/messages/MessagesThreadList';
import {
  computeFilterCounts,
  filterThreadsByTab,
  type MessageThreadSummary,
} from '@/components/messages/fixtures';
import { useMessageThreads } from '@/lib/messages/useMessageThreads';

// Lane E5 — full-overlay sheets mounted at page level
import {
  NewMessageSheet,
  type NewMessagePrefill,
} from '@/components/messages/NewMessageSheet';
import { ContactsSidePanel } from '@/components/messages/ContactsSidePanel';

// ---------------------------------------------------------------------------
// Lane-E4 right pane: optimistic require with safe fallback.
//
// We try to load `MessagesRightPane` at module-load time. Metro evaluates
// require() synchronously at bundle build, so the safest cross-platform
// approach is: wrap the import in a try/catch within a function executed
// once at module load. If the module is absent, the catch path leaves
// `LaneE4Pane` as null — the page then renders our fallback shell.
//
// When Lane E4 ships, no edit is required here: Metro picks up the new
// module, the try succeeds, and the right pane swaps in automatically.
// ---------------------------------------------------------------------------

type RightPaneProps = {
  selectedThread: MessageThreadSummary | null;
  threadCount: number;
  onComposeNew: () => void;
  onOpenContacts: () => void;
};

let LaneE4Pane: React.ComponentType<RightPaneProps> | null = null;
try {
  // Metro static-analyzes require(). When `MessagesRightPane.tsx` is absent
  // the bundler warns loudly but does not crash — we recover via try/catch.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@/components/messages/MessagesRightPane');
  LaneE4Pane =
    (mod?.MessagesRightPane as React.ComponentType<RightPaneProps>) ||
    (mod?.default as React.ComponentType<RightPaneProps>) ||
    null;
} catch {
  LaneE4Pane = null;
}

// ---------------------------------------------------------------------------
// Inner page
// ---------------------------------------------------------------------------

function MessagesPageInner() {
  // ── Filter + selection state (page-level per plan §3.9) ──────────────
  const [activeTab, setActiveTab] = useState<MessagesFilterTab>('all');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────
  // We fetch both:
  //   - the active-tab slice (drives the thread list)
  //   - the 'all' slice (drives counts/totalUnread, computed against the
  //     unfiltered universe per plan §3.9.2)
  // The hook caches by filter so a tab swap doesn't re-fetch what we have.
  const universe = useMessageThreads('all');
  const activeSlice = useMessageThreads(activeTab);
  // Universe is the union of all/archived (archived isn't in 'all'):
  const allKnownThreads = useMemo(() => {
    if (activeTab === 'archived') {
      return [...universe.threads, ...activeSlice.threads];
    }
    return universe.threads;
  }, [universe.threads, activeSlice.threads, activeTab]);

  const isLoading = activeTab === 'all' ? universe.isLoading : activeSlice.isLoading;

  // Counts reflect the universe (not the filtered slice) — matches §3.9.2.
  // For archived count we trust the local universe view since unread/pinned
  // counts already exclude archived; we lift archived from the activeSlice
  // when the user has clicked into the Archived tab (otherwise we don't know).
  const counts = useMemo(
    () => computeFilterCounts(allKnownThreads),
    [allKnownThreads],
  );

  // The thread list shows the active slice. When the active tab is 'all',
  // we want the same data the universe already loaded; otherwise we filter
  // the active slice locally (it's already the right scope, but we double-
  // filter against archived to be safe — the server may not yet enforce).
  const filteredThreads = useMemo(() => {
    if (activeTab === 'all') {
      return filterThreadsByTab(universe.threads, 'all');
    }
    return filterThreadsByTab(activeSlice.threads, activeTab);
  }, [universe.threads, activeSlice.threads, activeTab]);

  // Drive the hero subtitle off the universe — "42 conversations" stays
  // truthful even when you click into the Pinned tab.
  const totalUnread = useMemo(
    () =>
      universe.threads
        .filter((t) => !t.is_archived)
        .reduce((sum, t) => sum + t.unread_count, 0),
    [universe.threads],
  );

  // Selected thread object (or null) — passed to right pane.
  const selectedThread = useMemo(() => {
    if (!selectedThreadId) return null;
    return (
      allKnownThreads.find((t) => t.thread_id === selectedThreadId) ?? null
    );
  }, [selectedThreadId, allKnownThreads]);

  // Mutations from the active slice — pin/archive/markRead. Both
  // hook instances share the cache, so calling either yields the same effect.
  const togglePin = activeTab === 'all' ? universe.togglePin : activeSlice.togglePin;
  const toggleArchive =
    activeTab === 'all' ? universe.toggleArchive : activeSlice.toggleArchive;
  const markRead = activeTab === 'all' ? universe.markRead : activeSlice.markRead;

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleThreadSelect = useCallback((threadId: string) => {
    setSelectedThreadId(threadId);
  }, []);

  /**
   * Context-menu actions — wired to real PATCH routes via useMessageThreads.
   * Failures are logged but not surfaced as toasts in V1 (the optimistic
   * update rolls back automatically if the server denies; the row reverts
   * via cache notification).
   *
   * `mark-unread` and `delete` are V1.1 — V1 backend has no inverse-mark or
   * destructive endpoint, so we no-op (Law #3 fail closed).
   */
  const handleContextMenu = useCallback(
    (threadId: string, action: ThreadContextAction) => {
      const promise = (async () => {
        switch (action) {
          case 'pin':
          case 'unpin':
            // Backend toggles based on current state — single endpoint.
            return togglePin(threadId);
          case 'archive':
          case 'unarchive':
            return toggleArchive(threadId);
          case 'mark-unread':
          case 'delete':
            // V1.1: backend has no inverse-mark / destructive route yet.
            // Fail closed — log & no-op rather than guess at a contract.
            if (Platform.OS === 'web' && typeof console !== 'undefined') {
              console.info(
                `[messages] action '${action}' is V1.1 — no backend route in V1`,
              );
            }
            return;
          default:
            return;
        }
      })();
      promise.catch((err) => {
        if (Platform.OS === 'web' && typeof console !== 'undefined') {
          console.warn(
            `[messages] context action ${action} failed on ${threadId}:`,
            err,
          );
        }
      });
    },
    [togglePin, toggleArchive],
  );

  /** Marks every unread thread read in parallel. Each call carries its own
   *  optimistic update + rollback so a single failure doesn't block siblings. */
  const handleMarkAllRead = useCallback(() => {
    const unreadIds = universe.threads
      .filter((t) => !t.is_archived && t.unread_count > 0)
      .map((t) => t.thread_id);
    if (unreadIds.length === 0) return;
    Promise.allSettled(unreadIds.map((id) => markRead(id))).then((results) => {
      if (Platform.OS === 'web' && typeof console !== 'undefined') {
        const failures = results.filter((r) => r.status === 'rejected').length;
        if (failures > 0) {
          console.warn(
            `[messages] mark-all-read: ${failures}/${results.length} requests failed`,
          );
        }
      }
    });
  }, [universe.threads, markRead]);

  /** "Clear archived" — toggles archive off for every archived row, moving
   *  them back into the active tabs. Real bulk-delete is V1.1. */
  const handleClearArchived = useCallback(() => {
    const archivedIds = activeSlice.threads
      .filter((t) => t.is_archived)
      .map((t) => t.thread_id);
    if (archivedIds.length === 0) return;
    Promise.allSettled(archivedIds.map((id) => toggleArchive(id))).then(
      (results) => {
        if (Platform.OS === 'web' && typeof console !== 'undefined') {
          const failures = results.filter((r) => r.status === 'rejected').length;
          if (failures > 0) {
            console.warn(
              `[messages] clear-archived: ${failures}/${results.length} requests failed`,
            );
          }
        }
      },
    );
  }, [activeSlice.threads, toggleArchive]);

  // Compose / Contacts — Lane E5 mounts the real sheets below the page JSX.
  // `composePrefill` flows in from contact-panel picks (and, later, suggestion
  // cards via Lane E6). It clears whenever the sheet closes so the next
  // open-from-hero starts cleanly.
  const [composeOpen, setComposeOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [composePrefill, setComposePrefill] = useState<NewMessagePrefill | undefined>(
    undefined,
  );

  const handleNewMessage = useCallback(() => {
    setComposePrefill(undefined);
    setComposeOpen(true);
  }, []);

  const handleOpenContacts = useCallback(() => {
    setContactsOpen(true);
  }, []);

  const handleCloseCompose = useCallback(() => {
    setComposeOpen(false);
    setComposePrefill(undefined);
  }, []);

  const handleCloseContacts = useCallback(() => {
    setContactsOpen(false);
  }, []);

  // Contacts panel → compose: panel closes itself first, then we stash the
  // contact as a prefill and open the sheet so the To: chip is pre-filled.
  const handleContactsCompose = useCallback(
    (contact: NewMessagePrefill['contact']) => {
      setContactsOpen(false);
      setComposePrefill({ contact });
      setComposeOpen(true);
    },
    [],
  );

  // After a confirmed Yellow-tier send, close the sheet and select the
  // resulting thread so the user lands on it. The thread id is the
  // canonical id returned by `POST /api/messages/send` (via `useSendMessage`
  // inside NewMessageSheet) — the thread cache is invalidated server-side
  // and the universe slice will reflect the new thread on its next read.
  const handleSent = useCallback((threadId: string) => {
    setComposeOpen(false);
    setComposePrefill(undefined);
    setSelectedThreadId(threadId);
    // Force the universe slice to refetch immediately so the new thread row
    // appears in the list without waiting for the 30s stale window.
    void universe.refetch();
  }, [universe]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Outer scroll container — only the right pane scrolls in nested cases.
          The hero + filter tabs sit at the top; the 2-col grid takes flex:1. */}
      <View style={styles.heroWrap}>
        <MessagesHero
          threadCount={counts.all}
          unreadCount={totalUnread}
          draftCount={0}
          onContactsPress={handleOpenContacts}
          onNewMessagePress={handleNewMessage}
        />
      </View>

      <View style={styles.filterTabsWrap}>
        <MessagesFilterTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          counts={counts}
          onMarkAllRead={handleMarkAllRead}
          onClearArchived={handleClearArchived}
        />
      </View>

      {/* 2-column grid — fixed 380 left, flex right */}
      <View style={styles.grid}>
        <View style={styles.leftCol}>
          <MessagesThreadList
            threads={filteredThreads}
            selectedThreadId={selectedThreadId}
            onThreadSelect={handleThreadSelect}
            onContextMenu={handleContextMenu}
            isLoading={isLoading}
            filter={activeTab}
          />
        </View>

        <View style={styles.rightCol}>
          {LaneE4Pane ? (
            <LaneE4Pane
              selectedThread={selectedThread}
              threadCount={counts.all}
              onComposeNew={handleNewMessage}
              onOpenContacts={handleOpenContacts}
            />
          ) : (
            <RightPaneFallback
              selectedThread={selectedThread}
              threadCount={counts.all}
              onComposeNew={handleNewMessage}
              onOpenContacts={handleOpenContacts}
              composeOpen={composeOpen}
              contactsOpen={contactsOpen}
              onCloseCompose={handleCloseCompose}
              onCloseContacts={handleCloseContacts}
            />
          )}
        </View>
      </View>

      {/* Lane E5: full-overlay sheets — mounted at page level so they float
          above the right pane regardless of E4's internal state. The sheets
          own their own zIndex 9999 + presentationStyle="overFullScreen"
          modals; nothing else needs to know about them. */}
      <NewMessageSheet
        visible={composeOpen}
        onClose={handleCloseCompose}
        onSent={handleSent}
        prefill={composePrefill}
      />
      <ContactsSidePanel
        visible={contactsOpen}
        onClose={handleCloseContacts}
        onComposeNew={handleContactsCompose}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Right-pane fallback — used when Lane E4's MessagesRightPane has not yet
// shipped. Mirrors §3.9.4 state branching at a coarse level so the page is
// visually coherent during the parallel-lane window.
//
// When Lane E4 lands, this fallback drops out automatically (the import at
// the top of the file succeeds and `LaneE4Pane` becomes non-null).
// ---------------------------------------------------------------------------

interface RightPaneFallbackProps {
  selectedThread: MessageThreadSummary | null;
  threadCount: number;
  onComposeNew: () => void;
  onOpenContacts: () => void;
  /** Held for backwards compatibility — Lane E5 sheets render at page level. */
  composeOpen?: boolean;
  contactsOpen?: boolean;
  onCloseCompose?: () => void;
  onCloseContacts?: () => void;
}

function RightPaneFallback({
  selectedThread,
  threadCount,
  onComposeNew,
  onOpenContacts,
}: RightPaneFallbackProps) {
  // Compose-active and contacts-active states are now handled by Lane E5's
  // real overlay sheets mounted at page level (NewMessageSheet +
  // ContactsSidePanel) — those float above this pane with zIndex 9999, so
  // we no longer render placeholder branches here.

  // Thread-selected branch — Lane E4 owns the chat-bubble + composer view.
  if (selectedThread) {
    return (
      <FallbackPanel
        icon="chatbubble-ellipses-outline"
        title={`Thread with ${selectedThread.contact_name || selectedThread.contact_phone}`}
        body="Lane E4 mounts the chat-bubble stream + composer + delivery status here. Lane E2 has wired the thread-list selection plumbing — you're seeing it work."
        meta={selectedThread.last_message_preview}
      />
    );
  }

  // None-selected branches: zero state vs suggestions, depending on whether
  // ANY threads exist. Lane E4's component will replace this with a richer
  // panel including Ava-suggested follow-ups (plan §3.9.4 (B)).
  if (threadCount === 0) {
    return (
      <FallbackPanel
        icon="sparkles-outline"
        title="No conversations yet"
        body="Send your first message to start a thread. Lane E4 replaces this with a premium getting-started panel: illustration, two CTAs, and three Ava-suggested actions."
        ctaLabel="Start your first message"
        ctaIcon="add"
        onCta={onComposeNew}
        secondaryCtaLabel="View routing contacts"
        secondaryCtaIcon="people-outline"
        onSecondaryCta={onOpenContacts}
      />
    );
  }

  return (
    <FallbackPanel
      icon="arrow-back-outline"
      title="Choose a thread from the left"
      body="Lane E4 replaces this with a 'Suggested actions' panel — Ava's recommended follow-ups based on recent activity."
    />
  );
}

// ---------------------------------------------------------------------------
// Fallback panel — small reusable layout matching the page's visual chrome.
// ---------------------------------------------------------------------------

interface FallbackPanelProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  meta?: string;
  ctaLabel?: string;
  ctaIcon?: keyof typeof Ionicons.glyphMap;
  onCta?: () => void;
  secondaryCtaLabel?: string;
  secondaryCtaIcon?: keyof typeof Ionicons.glyphMap;
  onSecondaryCta?: () => void;
}

function FallbackPanel({
  icon,
  title,
  body,
  meta,
  ctaLabel,
  ctaIcon,
  onCta,
  secondaryCtaLabel,
  secondaryCtaIcon,
  onSecondaryCta,
}: FallbackPanelProps) {
  return (
    <ScrollView
      contentContainerStyle={fallbackStyles.scrollContent}
      style={fallbackStyles.scroll}
    >
      <View style={fallbackStyles.card}>
        <View style={fallbackStyles.iconHalo}>
          <Ionicons name={icon} size={36} color={Colors.accent.cyan} />
        </View>
        <Text style={fallbackStyles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={fallbackStyles.body}>{body}</Text>
        {meta ? (
          <View style={fallbackStyles.metaPill}>
            <Text style={fallbackStyles.metaText} numberOfLines={2}>
              {`“${meta}”`}
            </Text>
          </View>
        ) : null}
        {(ctaLabel || secondaryCtaLabel) && (
          <View style={fallbackStyles.ctaRow}>
            {ctaLabel && onCta && (
              <Pressable
                onPress={onCta}
                accessibilityRole="button"
                accessibilityLabel={ctaLabel}
                style={({ pressed }) => [
                  fallbackStyles.cta,
                  fallbackStyles.ctaPrimary,
                  pressed && fallbackStyles.ctaPrimaryPressed,
                ]}
              >
                {ctaIcon && <Ionicons name={ctaIcon} size={16} color="#ffffff" />}
                <Text style={fallbackStyles.ctaPrimaryText}>{ctaLabel}</Text>
              </Pressable>
            )}
            {secondaryCtaLabel && onSecondaryCta && (
              <Pressable
                onPress={onSecondaryCta}
                accessibilityRole="button"
                accessibilityLabel={secondaryCtaLabel}
                style={({ pressed }) => [
                  fallbackStyles.cta,
                  fallbackStyles.ctaGhost,
                  pressed && fallbackStyles.ctaGhostPressed,
                ]}
              >
                {secondaryCtaIcon && (
                  <Ionicons
                    name={secondaryCtaIcon}
                    size={16}
                    color={Colors.text.secondary}
                  />
                )}
                <Text style={fallbackStyles.ctaGhostText}>
                  {secondaryCtaLabel}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const fallbackStyles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    maxWidth: 460,
    alignItems: 'center',
    gap: 16,
  },
  iconHalo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 32px rgba(59,130,246,0.18)' } as object)
      : {}),
  } as any,
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 380,
  },
  metaPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#161618',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    maxWidth: 380,
  },
  metaText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: Colors.text.secondary,
    lineHeight: 19,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: BorderRadius.md,
    minHeight: 44,
  },
  ctaPrimary: {
    backgroundColor: Colors.accent.cyan,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 2px rgba(0,0,0,0.3), 0 6px 16px rgba(59,130,246,0.28)',
        } as object)
      : {
          shadowColor: Colors.accent.cyan,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 10,
        }),
  } as any,
  ctaPrimaryPressed: {
    backgroundColor: Colors.accent.cyanDark,
    opacity: 0.95,
  },
  ctaPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.1,
  },
  ctaGhost: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  ctaGhostPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    opacity: 0.95,
  },
  ctaGhostText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
});

// ---------------------------------------------------------------------------
// Page styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  heroWrap: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  filterTabsWrap: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 4,
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 16,
    minHeight: 0, // critical for nested flex+scroll on web
  },
  leftCol: {
    width: 380,
    backgroundColor: '#0d0d0d',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    minHeight: 0,
  },
  rightCol: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    minWidth: 0,
    minHeight: 0,
  },
});

// ---------------------------------------------------------------------------
// Public export with shell + error boundary
// ---------------------------------------------------------------------------

export default function MessagesPage() {
  return (
    <DesktopShell>
      <PageErrorBoundary pageName="messages">
        <MessagesPageInner />
      </PageErrorBoundary>
    </DesktopShell>
  );
}
