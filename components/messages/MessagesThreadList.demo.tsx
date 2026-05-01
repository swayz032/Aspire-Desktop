/**
 * MessagesThreadList.demo — visual smoke + interaction check.
 *
 * Drives output-critic's "Would Framer ship this list?" review.
 *
 * Variants:
 *   1. Loaded — 5 threads, click to select, right-click for context menu
 *   2. Loading — pre-data spinner state
 *   3. Empty (all)       — fresh tenant
 *   4. Empty (unread)    — caught up
 *   5. Empty (pinned)    — nothing pinned
 *   6. Empty (archived)  — clean archive
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '@/constants/tokens';
import {
  MessagesThreadList,
  type ThreadContextAction,
} from './MessagesThreadList';
import { MOCK_THREADS_5 } from './fixtures';

export default function MessagesThreadListDemo() {
  const [selectedId, setSelectedId] = useState<string | null>(
    MOCK_THREADS_5[0].thread_id,
  );
  const [actionLog, setActionLog] = useState<string[]>([]);
  const log = (s: string) =>
    setActionLog((prev) => [
      `${new Date().toLocaleTimeString()} ${s}`,
      ...prev.slice(0, 4),
    ]);

  const onCtx = (threadId: string, action: ThreadContextAction) => {
    log(`${action} → ${threadId.slice(-12)}`);
  };

  // Filter out archived for the "all" demo — matches real behavior.
  const activeThreads = MOCK_THREADS_5.filter((t) => !t.is_archived);
  const pinnedThreads = activeThreads.filter((t) => t.is_pinned);
  const unreadThreads = activeThreads.filter((t) => t.unread_count > 0);
  const archivedThreads = MOCK_THREADS_5.filter((t) => t.is_archived);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Variant title="Loaded — 4 threads (right-click for context menu)">
        <ListHost>
          <MessagesThreadList
            threads={activeThreads}
            selectedThreadId={selectedId}
            onThreadSelect={(id) => {
              setSelectedId(id);
              log(`select → ${id.slice(-12)}`);
            }}
            onContextMenu={onCtx}
            isLoading={false}
            filter="all"
          />
        </ListHost>
      </Variant>

      <Variant title="Loading state">
        <ListHost>
          <MessagesThreadList
            threads={[]}
            selectedThreadId={null}
            onThreadSelect={() => {}}
            onContextMenu={() => {}}
            isLoading
            filter="all"
          />
        </ListHost>
      </Variant>

      <Variant title="Empty — all">
        <ListHost>
          <MessagesThreadList
            threads={[]}
            selectedThreadId={null}
            onThreadSelect={() => {}}
            onContextMenu={() => {}}
            isLoading={false}
            filter="all"
          />
        </ListHost>
      </Variant>

      <Variant title="Empty — unread (you're caught up)">
        <ListHost>
          <MessagesThreadList
            threads={[]}
            selectedThreadId={null}
            onThreadSelect={() => {}}
            onContextMenu={() => {}}
            isLoading={false}
            filter="unread"
          />
        </ListHost>
      </Variant>

      <Variant title="Pinned filter (1 result)">
        <ListHost>
          <MessagesThreadList
            threads={pinnedThreads}
            selectedThreadId={selectedId}
            onThreadSelect={setSelectedId}
            onContextMenu={onCtx}
            isLoading={false}
            filter="pinned"
          />
        </ListHost>
      </Variant>

      <Variant title="Unread filter (2 results)">
        <ListHost>
          <MessagesThreadList
            threads={unreadThreads}
            selectedThreadId={selectedId}
            onThreadSelect={setSelectedId}
            onContextMenu={onCtx}
            isLoading={false}
            filter="unread"
          />
        </ListHost>
      </Variant>

      <Variant title="Archived filter (1 result)">
        <ListHost>
          <MessagesThreadList
            threads={archivedThreads}
            selectedThreadId={selectedId}
            onThreadSelect={setSelectedId}
            onContextMenu={onCtx}
            isLoading={false}
            filter="archived"
          />
        </ListHost>
      </Variant>

      <View style={styles.log}>
        <Text style={styles.logTitle}>Action log</Text>
        {actionLog.length === 0 ? (
          <Text style={styles.logEmpty}>
            Click rows or right-click for context menu actions.
          </Text>
        ) : (
          actionLog.map((entry, i) => (
            <Text key={i} style={styles.logEntry}>
              {entry}
            </Text>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function ListHost({ children }: { children: React.ReactNode }) {
  return <View style={styles.listHost}>{children}</View>;
}

function Variant({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.variant}>
      <Text style={styles.variantTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#0a0a0c',
    ...(Platform.OS === 'web' ? ({ height: '100%' } as object) : {}),
  } as any,
  content: {
    padding: 32,
    gap: 32,
  },
  variant: {
    gap: 12,
  },
  variantTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  listHost: {
    width: 380,
    height: 480,
    backgroundColor: '#0d0d0d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  log: {
    padding: 16,
    backgroundColor: '#0d0d0d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 6,
  },
  logTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  logEmpty: {
    fontSize: 12,
    color: Colors.text.muted,
    fontStyle: 'italic',
  },
  logEntry: {
    fontSize: 11,
    color: Colors.text.tertiary,
    fontFamily: Platform.select({ web: 'monospace' }),
  },
});
