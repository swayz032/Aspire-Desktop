/**
 * /demo/messages — dev-only demo hub for the Messages page (Lane E7).
 *
 * Drives a 5-state cycle through the right-pane composition states defined
 * in plan §3.9.4. Each state renders the relevant component(s) with offline
 * fixtures so reviewers can verify visual fidelity without a backend.
 *
 *   (a) Zero State           — `<MessagesZeroState>` (no threads exist)
 *   (b) Suggestions          — `<MessagesSuggestedActions>` w/ MOCK_SUGGESTIONS_3
 *   (c) Thread Selected      — `<MessagesThreadView>` w/ MOCK_MESSAGES_8
 *   (d) New Message Sheet    — page shell + open `<NewMessageSheet>`
 *   (e) Contacts Side Panel  — page shell + open `<ContactsSidePanel>`
 *
 * Pattern matches `app/demo/incoming-call.tsx`:
 *   - Tab strip across the top
 *   - Active state rendered in the body
 *   - Below the active state: a "fixture brief" card naming what's mocked
 *
 * Components fed via overrides bypass the network (Lane E6 hooks). State (d)
 * + (e) sheets float above the page shell and use their own demo overrides
 * where supported (NewMessageSheet via `a2pStatusOverride`, ContactsSidePanel
 * via `dataOverride`).
 */
import React, { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
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
import { MessagesZeroState } from '@/components/messages/MessagesZeroState';
import { MessagesSuggestedActions } from '@/components/messages/MessagesSuggestedActions';
import { MessagesThreadView } from '@/components/messages/MessagesThreadView';
import { NewMessageSheet } from '@/components/messages/NewMessageSheet';
import { ContactsSidePanel } from '@/components/messages/ContactsSidePanel';
import {
  MOCK_THREADS_5,
  MOCK_MESSAGES_8,
  MOCK_SUGGESTIONS_3,
  MOCK_CONTACTS_PANEL,
  computeFilterCounts,
} from '@/components/messages/fixtures';

// ---------------------------------------------------------------------------
// State definitions
// ---------------------------------------------------------------------------

type DemoStateId =
  | 'zero'
  | 'suggestions'
  | 'thread'
  | 'compose'
  | 'contacts';

interface DemoStateMeta {
  id: DemoStateId;
  label: string;
  /** Short description shown in the brief card. */
  description: string;
  /** Human-readable list of mock data this state uses. */
  fixtureNames: string[];
  /** Visual icon next to the tab label. */
  icon: keyof typeof Ionicons.glyphMap;
}

const DEMO_STATES: DemoStateMeta[] = [
  {
    id: 'zero',
    label: 'Zero State',
    description:
      "Right pane state (A) — no threads exist. Two CTAs: start your first message, or browse routing contacts. Lane E4's MessagesZeroState renders the empty universe.",
    fixtureNames: ['(no fixtures — empty universe)'],
    icon: 'sparkles-outline',
  },
  {
    id: 'suggestions',
    label: 'Suggestions',
    description:
      "Right pane state (B) — threads exist but none selected. Ava's recommended follow-ups (3 cards) populate this view via the suggestions endpoint.",
    fixtureNames: ['MOCK_SUGGESTIONS_3 (3 Ava follow-ups)'],
    icon: 'bulb-outline',
  },
  {
    id: 'thread',
    label: 'Thread Selected',
    description:
      "Right pane state (C) — a thread is selected. MessagesThreadView renders the chat-bubble stream + composer + A2P banner.",
    fixtureNames: [
      'MOCK_THREADS_5[0] (selected thread)',
      'MOCK_MESSAGES_8 (8 messages spanning all delivery states)',
    ],
    icon: 'chatbubble-ellipses-outline',
  },
  {
    id: 'compose',
    label: 'New Message Sheet',
    description:
      "Right pane state (D) — NewMessageSheet floats above the page (Suggestions backdrop). Yellow-tier compose surface with autocomplete + template picker + A2P gate.",
    fixtureNames: [
      'MOCK_SUGGESTIONS_3 (background)',
      'a2pStatusOverride=registered (composer enabled)',
    ],
    icon: 'create-outline',
  },
  {
    id: 'contacts',
    label: 'Contacts Side Panel',
    description:
      "Right pane state (E) — ContactsSidePanel slides in from the right (Suggestions backdrop). Five routing / four recent SMS / three recent call rows.",
    fixtureNames: [
      'MOCK_SUGGESTIONS_3 (background)',
      'MOCK_CONTACTS_PANEL (5 routing / 4 SMS / 3 calls)',
    ],
    icon: 'people-outline',
  },
];

// ---------------------------------------------------------------------------
// Hub
// ---------------------------------------------------------------------------

function MessagesDemoHub() {
  const [activeId, setActiveId] = useState<DemoStateId>('zero');
  // Tab state (a) drives MessagesFilterTabs in the compose/contacts states.
  const [filterTab, setFilterTab] = useState<MessagesFilterTab>('all');
  // Sheet visibility — only used in the compose / contacts states. We tie
  // visibility to the active tab so switching tabs cleanly closes any open
  // overlay before re-rendering the next state's tree.
  const [composeOpen, setComposeOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);

  const active = DEMO_STATES.find((s) => s.id === activeId) ?? DEMO_STATES[0];

  const handleSwitch = useCallback((id: DemoStateId) => {
    setActiveId(id);
    // Close any open overlays when switching states so we don't end up with
    // a "Contacts" tab showing the compose sheet from the previous tab.
    setComposeOpen(id === 'compose');
    setContactsOpen(id === 'contacts');
  }, []);

  // Mock counts derived from MOCK_THREADS_5 (used by states that show the
  // page-level filter tabs / hero).
  const counts = computeFilterCounts(MOCK_THREADS_5);
  const totalUnread = MOCK_THREADS_5
    .filter((t) => !t.is_archived)
    .reduce((sum, t) => sum + t.unread_count, 0);

  // Selected thread for state (c).
  const selectedThread = MOCK_THREADS_5[0];

  return (
    <View style={styles.page}>
      {/* Tab strip (matches incoming-call demo pattern) */}
      <View style={styles.tabBar}>
        <View style={styles.tabBarHeader}>
          <Ionicons
            name="chatbubbles-outline"
            size={16}
            color={Colors.accent.cyan as string}
          />
          <Text style={styles.tabBarTitle}>Messages · Demo Hub</Text>
          <Text style={styles.tabBarSub}>dev-only</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {DEMO_STATES.map((s) => {
            const isActive = s.id === activeId;
            return (
              <Pressable
                key={s.id}
                onPress={() => handleSwitch(s.id)}
                style={({ hovered }: { hovered?: boolean }) => [
                  styles.tab,
                  hovered && !isActive && styles.tabHover,
                  isActive && styles.tabActive,
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${s.label} fixture`}
              >
                <Ionicons
                  name={s.icon}
                  size={14}
                  color={
                    isActive
                      ? (Colors.accent.cyan as string)
                      : 'rgba(255,255,255,0.55)'
                  }
                />
                <Text
                  style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                >
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {/* Active state render */}
        <View style={styles.stateContainer}>
          {activeId === 'zero' ? (
            <ZeroStateView />
          ) : activeId === 'suggestions' ? (
            <SuggestionsStateView />
          ) : activeId === 'thread' ? (
            <ThreadStateView selectedThread={selectedThread} />
          ) : activeId === 'compose' ? (
            <ComposeStateView
              counts={counts}
              totalUnread={totalUnread}
              filterTab={filterTab}
              onFilterChange={setFilterTab}
              composeOpen={composeOpen}
              onCloseCompose={() => setComposeOpen(false)}
              onReopenCompose={() => setComposeOpen(true)}
            />
          ) : (
            <ContactsStateView
              counts={counts}
              totalUnread={totalUnread}
              filterTab={filterTab}
              onFilterChange={setFilterTab}
              contactsOpen={contactsOpen}
              onCloseContacts={() => setContactsOpen(false)}
              onReopenContacts={() => setContactsOpen(true)}
            />
          )}
        </View>

        {/* Fixture brief */}
        <FixtureBrief active={active} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// State renderers — each one is a thin wrapper that supplies the right demo
// overrides so the component renders without a backend.
// ---------------------------------------------------------------------------

function ZeroStateView() {
  // MessagesZeroState has its own internal CTAs; we hook them to console
  // logs so reviewers can confirm the click handlers fire.
  return (
    <View style={styles.stateInner}>
      <MessagesZeroState
        onComposeNew={() =>
          console.info('[demo/messages] zero: onComposeNew fired')
        }
        onOpenContacts={() =>
          console.info('[demo/messages] zero: onOpenContacts fired')
        }
      />
    </View>
  );
}

function SuggestionsStateView() {
  return (
    <View style={styles.stateInner}>
      <MessagesSuggestedActions
        onComposeNew={() =>
          console.info('[demo/messages] suggestions: onComposeNew fired')
        }
        onOpenContacts={() =>
          console.info('[demo/messages] suggestions: onOpenContacts fired')
        }
        suggestionsOverride={MOCK_SUGGESTIONS_3}
      />
    </View>
  );
}

interface ThreadStateProps {
  selectedThread: typeof MOCK_THREADS_5[number];
}
function ThreadStateView({ selectedThread }: ThreadStateProps) {
  return (
    <View style={styles.stateInner}>
      <MessagesThreadView
        selectedThread={selectedThread}
        a2pStatusOverride="registered"
        messagesOverride={MOCK_MESSAGES_8}
      />
    </View>
  );
}

interface ComposeStateProps {
  counts: { all: number; unread: number; pinned: number; archived: number };
  totalUnread: number;
  filterTab: MessagesFilterTab;
  onFilterChange: (t: MessagesFilterTab) => void;
  composeOpen: boolean;
  onCloseCompose: () => void;
  onReopenCompose: () => void;
}
function ComposeStateView({
  counts,
  totalUnread,
  filterTab,
  onFilterChange,
  composeOpen,
  onCloseCompose,
  onReopenCompose,
}: ComposeStateProps) {
  return (
    <View style={styles.fullPageScaffold}>
      <View style={styles.heroWrap}>
        <MessagesHero
          threadCount={counts.all}
          unreadCount={totalUnread}
          draftCount={0}
          onContactsPress={() =>
            console.info('[demo/messages] hero contacts pressed')
          }
          onNewMessagePress={onReopenCompose}
        />
      </View>
      <View style={styles.filterTabsWrap}>
        <MessagesFilterTabs
          activeTab={filterTab}
          onChange={onFilterChange}
          counts={counts}
          onMarkAllRead={() =>
            console.info('[demo/messages] mark-all-read pressed')
          }
          onClearArchived={() =>
            console.info('[demo/messages] clear-archived pressed')
          }
        />
      </View>
      {/* Body underneath = Suggestions panel (backdrop). */}
      <View style={styles.scaffoldBody}>
        <MessagesSuggestedActions
          onComposeNew={onReopenCompose}
          onOpenContacts={() =>
            console.info('[demo/messages] suggestions: open contacts')
          }
          suggestionsOverride={MOCK_SUGGESTIONS_3}
        />
      </View>
      {/* Re-launch button so reviewers can re-trigger the open animation. */}
      {!composeOpen && (
        <View style={styles.relaunchPill}>
          <Pressable
            onPress={onReopenCompose}
            accessibilityRole="button"
            accessibilityLabel="Re-launch new message sheet"
            style={({ pressed }: { pressed?: boolean }) => [
              styles.relaunchBtn,
              pressed && styles.relaunchBtnPressed,
            ]}
          >
            <Ionicons name="refresh" size={14} color="#fff" />
            <Text style={styles.relaunchText}>Re-launch sheet</Text>
          </Pressable>
        </View>
      )}
      <NewMessageSheet
        visible={composeOpen}
        onClose={onCloseCompose}
        onSent={(threadId, messageId) => {
          console.info(
            `[demo/messages] sent: thread=${threadId}, message=${messageId}`,
          );
          onCloseCompose();
        }}
        a2pStatusOverride="registered"
      />
    </View>
  );
}

interface ContactsStateProps {
  counts: { all: number; unread: number; pinned: number; archived: number };
  totalUnread: number;
  filterTab: MessagesFilterTab;
  onFilterChange: (t: MessagesFilterTab) => void;
  contactsOpen: boolean;
  onCloseContacts: () => void;
  onReopenContacts: () => void;
}
function ContactsStateView({
  counts,
  totalUnread,
  filterTab,
  onFilterChange,
  contactsOpen,
  onCloseContacts,
  onReopenContacts,
}: ContactsStateProps) {
  return (
    <View style={styles.fullPageScaffold}>
      <View style={styles.heroWrap}>
        <MessagesHero
          threadCount={counts.all}
          unreadCount={totalUnread}
          draftCount={0}
          onContactsPress={onReopenContacts}
          onNewMessagePress={() =>
            console.info('[demo/messages] hero new message pressed')
          }
        />
      </View>
      <View style={styles.filterTabsWrap}>
        <MessagesFilterTabs
          activeTab={filterTab}
          onChange={onFilterChange}
          counts={counts}
          onMarkAllRead={() =>
            console.info('[demo/messages] mark-all-read pressed')
          }
          onClearArchived={() =>
            console.info('[demo/messages] clear-archived pressed')
          }
        />
      </View>
      <View style={styles.scaffoldBody}>
        <MessagesSuggestedActions
          onComposeNew={() =>
            console.info('[demo/messages] suggestions: compose new')
          }
          onOpenContacts={onReopenContacts}
          suggestionsOverride={MOCK_SUGGESTIONS_3}
        />
      </View>
      {!contactsOpen && (
        <View style={styles.relaunchPill}>
          <Pressable
            onPress={onReopenContacts}
            accessibilityRole="button"
            accessibilityLabel="Re-launch contacts panel"
            style={({ pressed }: { pressed?: boolean }) => [
              styles.relaunchBtn,
              pressed && styles.relaunchBtnPressed,
            ]}
          >
            <Ionicons name="refresh" size={14} color="#fff" />
            <Text style={styles.relaunchText}>Re-launch panel</Text>
          </Pressable>
        </View>
      )}
      <ContactsSidePanel
        visible={contactsOpen}
        onClose={onCloseContacts}
        onComposeNew={(c) => {
          console.info(
            `[demo/messages] contacts: compose with ${c.name || c.phone}`,
          );
          onCloseContacts();
        }}
        dataOverride={MOCK_CONTACTS_PANEL}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Fixture brief card (mirrors incoming-call demo)
// ---------------------------------------------------------------------------

function FixtureBrief({ active }: { active: DemoStateMeta }) {
  return (
    <View style={styles.briefCard}>
      <View style={styles.briefHeader}>
        <View style={styles.briefBadge}>
          <Text style={styles.briefBadgeText}>FIXTURE</Text>
        </View>
        <Text style={styles.briefTitle}>{active.label}</Text>
      </View>
      <Text style={styles.briefDescription}>{active.description}</Text>

      <View style={styles.briefDivider} />

      <Text style={styles.briefSectionLabel}>MOCK DATA</Text>
      {active.fixtureNames.map((name) => (
        <View key={name} style={styles.briefRow}>
          <Ionicons
            name="cube-outline"
            size={11}
            color={Colors.accent.cyan as string}
          />
          <Text style={styles.briefRowValue}>{name}</Text>
        </View>
      ))}

      <View style={styles.briefDivider} />

      <Text style={styles.briefHelp}>
        Use the tabs above to cycle through the 5 right-pane states. The
        components themselves render against Lane E6 hooks at /session/messages
        — this hub feeds them fixture overrides so reviewers can audit visual
        states without a backend.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

export default function MessagesDemoPage() {
  return (
    <PageErrorBoundary pageName="messages-demo-hub">
      <DesktopShell fullBleed>
        <MessagesDemoHub />
      </DesktopShell>
    </PageErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// Styles (mirror app/demo/incoming-call.tsx for consistency)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#0a0a0c',
    ...(Platform.OS === 'web'
      ? ({ height: '100%', minHeight: 0 } as object)
      : {}),
  } as any,

  tabBar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle as string,
    backgroundColor: 'rgba(10,10,12,0.8)',
  },
  tabBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tabBarTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text.primary as string,
    letterSpacing: 0.4,
  },
  tabBarSub: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.text.muted as string,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    marginLeft: 4,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 4,
    paddingBottom: 0,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    minHeight: 44,
    ...(Platform.OS === 'web'
      ? ({
          transition: 'border-color 140ms ease-out, color 140ms ease-out',
          cursor: 'pointer',
        } as object)
      : {}),
  } as any,
  tabHover: {
    borderBottomColor: Colors.border.strong as string,
  },
  tabActive: {
    borderBottomColor: Colors.accent.cyan as string,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: Colors.text.primary as string,
    fontWeight: '600' as const,
  },

  body: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
    padding: 24,
    gap: 16,
  },

  stateContainer: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    backgroundColor: '#0d0d0d',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  stateInner: {
    flex: 1,
    minHeight: 0,
  },

  // Full-page scaffold (compose + contacts states need hero/filter rendered)
  fullPageScaffold: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
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
  scaffoldBody: {
    flex: 1,
    minHeight: 0,
  },
  relaunchPill: {
    position: 'absolute',
    top: 24,
    right: 24,
    zIndex: 10,
  },
  relaunchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent.cyan as string,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 1px 2px rgba(0,0,0,0.3), 0 4px 12px rgba(59,130,246,0.28)',
          cursor: 'pointer',
        } as object)
      : {}),
  } as any,
  relaunchBtnPressed: {
    backgroundColor: Colors.accent.cyanDark as string,
    opacity: 0.95,
  },
  relaunchText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#ffffff',
    letterSpacing: 0.1,
  },

  // Brief card
  briefCard: {
    width: 320,
    padding: 18,
    backgroundColor: '#141416',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 10,
    alignSelf: 'flex-start',
  },
  briefHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  briefBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(59,130,246,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.30)',
  },
  briefBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
    color: Colors.accent.cyan as string,
  },
  briefTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text.primary as string,
    letterSpacing: -0.05,
    flex: 1,
  },
  briefDescription: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 17,
  },
  briefDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 4,
  },
  briefSectionLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1.4,
    color: Colors.text.muted as string,
    textTransform: 'uppercase' as const,
    marginBottom: 2,
  },
  briefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  briefRowValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.text.secondary as string,
    fontVariant: ['tabular-nums'] as const,
  },
  briefHelp: {
    fontSize: 11,
    fontWeight: '400' as const,
    color: Colors.text.muted as string,
    lineHeight: 15,
    marginTop: 2,
  },
});
