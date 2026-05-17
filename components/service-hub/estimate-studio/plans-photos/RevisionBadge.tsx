/**
 * RevisionBadge — Wave 6A.
 *
 * Small colored chip for a sheet's revision state.
 *
 * Wave 6A: Drew CLASSIFY returns a `revisions` count but no per-sheet
 * revision chain (that's Wave 6.5 once the GET /sheets endpoint lands).
 * For now we render "REV {n}" when n > 0 OR a plain "REV" pill. The
 * tooltip+hover chain UI ships in Wave 6.5.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  revision?: number | null;
  superseded?: boolean;
  testID?: string;
}

export function RevisionBadge({ revision, superseded, testID }: Props): React.ReactElement | null {
  if (!superseded && (revision == null || revision === 0)) return null;

  const label = superseded ? 'SUPERSEDED' : `REV ${revision}`;
  return (
    <View
      style={[styles.badge, superseded ? styles.badgeSuperseded : styles.badgeActive]}
      testID={testID ?? 'revision-badge'}
      accessibilityLabel={superseded ? 'Sheet superseded by newer revision' : `Revision ${revision}`}
    >
      <Text style={[styles.text, superseded ? styles.textSuperseded : styles.textActive]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeActive: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderColor: 'rgba(251,191,36,0.40)',
  },
  badgeSuperseded: {
    backgroundColor: 'rgba(148,163,184,0.06)',
    borderColor: 'rgba(148,163,184,0.30)',
  },
  text: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  textActive: {
    color: '#fbbf24',
  },
  textSuperseded: {
    color: 'rgba(148,163,184,0.95)',
    textDecorationLine: 'line-through',
  },
});
