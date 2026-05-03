// components/call-room/ContactsPanel.tsx
//
// Contacts directory — second route to "Add Call by saved contact",
// reachable from KeypadPanel's Contacts chip. Displays recent callers
// (chronological) and saved contacts (alphabetical), each tappable to
// add as a 3rd party on the line. Mock data for now; will wire to a real
// contacts subsystem when that ships.
//
// Locked to 280 height + scroll affordance (visible scrollbar + bottom
// fade) so the section size never shifts when toggled.
import React, { useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const isWeb = Platform.OS === 'web';

export interface ContactsPanelProps {
  /** Return to the Keypad panel (parent of this flow). */
  onBack: () => void;
  /** Add the picked contact as a 3rd party on the line. */
  onAddCall: (contactId: string) => void;
}

interface Contact {
  id: string;
  name: string;
  phoneE164: string;
  role?: string;
  /** Optional uploaded photo URL. When absent, renders the default icon. */
  photoUrl?: string;
  /** ISO timestamp of last call; undefined for saved-only contacts. */
  lastCalledAt?: string;
}

// Mock roster — recent callers + saved business contacts.
const CONTACTS: Contact[] = [
  {
    id: 'c_marcus',
    name: 'Marcus Johnson',
    phoneE164: '+15558675309',
    role: 'Roof leak inquiry',
    lastCalledAt: '2026-05-03T14:21:00Z',
  },
  {
    id: 'c_anita',
    name: 'Anita Lawson',
    phoneE164: '+19495550199',
    role: 'Drywall repair',
    lastCalledAt: '2026-05-02T16:45:00Z',
  },
  {
    id: 'c_carl',
    name: 'Carl Diaz',
    phoneE164: '+13105550101',
    role: 'Painting quote',
    lastCalledAt: '2026-05-01T09:12:00Z',
  },
  { id: 'c_acme', name: 'Acme Roofing', phoneE164: '+18005551001', role: 'Vendor' },
  { id: 'c_glow', name: 'GlowPro Supply', phoneE164: '+18005552002', role: 'Vendor' },
  { id: 'c_inspect', name: 'Statewide Inspections', phoneE164: '+18005553003', role: 'Inspector' },
  { id: 'c_legal', name: 'Wright & Co Legal', phoneE164: '+18005554004', role: 'Legal' },
];

export function ContactsPanel({ onBack, onAddCall }: ContactsPanelProps): React.ReactElement {
  const [query, setQuery] = useState<string>('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CONTACTS;
    return CONTACTS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phoneE164.includes(q) ||
        (c.role?.toLowerCase().includes(q) ?? false),
    );
  }, [query]);

  const recents = filtered.filter((c) => c.lastCalledAt);
  const saved = filtered.filter((c) => !c.lastCalledAt);

  return (
    <View style={styles.panel} testID="contacts-panel">
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>CONTACTS</Text>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to Keypad"
          style={({ hovered }: { hovered?: boolean }) => [
            styles.backLink,
            hovered && styles.backLinkHover,
          ]}
        >
          <Ionicons name="arrow-back" size={12} color="rgba(255,255,255,0.65)" />
          <Text style={styles.backLinkText}>Keypad</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={13} color="rgba(255,255,255,0.5)" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search name or number"
          placeholderTextColor="rgba(255,255,255,0.4)"
          style={styles.searchInput}
          testID="contacts-search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <Pressable
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            style={({ hovered }: { hovered?: boolean }) => [
              styles.searchClear,
              hovered && styles.searchClearHover,
            ]}
          >
            <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.5)" />
          </Pressable>
        )}
      </View>

      <View style={styles.listWrap}>
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={true}
        >
          {recents.length > 0 && (
            <>
              <Text style={styles.groupLabel}>Recent</Text>
              {recents.map((c) => (
                <ContactRow key={c.id} c={c} onPress={() => onAddCall(c.id)} />
              ))}
            </>
          )}

          {saved.length > 0 && (
            <>
              <Text style={[styles.groupLabel, recents.length > 0 && styles.groupLabelGap]}>
                Saved
              </Text>
              {saved.map((c) => (
                <ContactRow key={c.id} c={c} onPress={() => onAddCall(c.id)} />
              ))}
            </>
          )}

          {filtered.length === 0 && (
            <Text style={styles.empty}>No contacts match "{query}".</Text>
          )}
        </ScrollView>

        {/* Bottom fade — same affordance as TransferPanel: signals "more below". */}
        {isWeb && <View pointerEvents="none" style={styles.fadeBottom} />}
      </View>
    </View>
  );
}

function ContactRow({ c, onPress }: { c: Contact; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Add ${c.name} to the call`}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.row,
        hovered && styles.rowHover,
        pressed && styles.rowPressed,
      ]}
    >
      {/* Production avatar — 2 modes only: photo or default vector icon. */}
      <View style={styles.avatar}>
        {c.photoUrl ? (
          <Image
            source={{ uri: c.photoUrl }}
            style={styles.avatarPhoto}
            resizeMode="cover"
          />
        ) : (
          <Ionicons name="person-outline" size={14} color="rgba(225,235,245,0.7)" />
        )}
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {c.name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {formatPhone(c.phoneE164)}
          {c.role ? ` · ${c.role}` : ''}
        </Text>
      </View>
      <View style={styles.addCallBadge}>
        <Ionicons name="call" size={12} color="rgba(150,255,170,0.9)" />
      </View>
    </Pressable>
  );
}

function formatPhone(e164: string): string {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (!m) return e164;
  return `(${m[1]}) ${m[2]}-${m[3]}`;
}

const styles = StyleSheet.create({
  panel: {
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    width: '100%',
    height: 280,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    ...(isWeb ? ({ transition: 'background-color 140ms ease-out' } as object) : {}),
  },
  backLinkHover: { backgroundColor: 'rgba(255,255,255,0.06)' },
  backLinkText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginLeft: 2 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
    ...(isWeb
      ? ({ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' } as object)
      : {}),
  },
  searchInput: {
    flex: 1,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    paddingVertical: 2,
    ...(isWeb ? ({ outlineStyle: 'none' } as object) : {}),
  },
  searchClear: {
    paddingHorizontal: 2,
    paddingVertical: 2,
    borderRadius: 4,
    ...(isWeb ? ({ transition: 'background-color 140ms ease-out' } as object) : {}),
  },
  searchClearHover: { backgroundColor: 'rgba(255,255,255,0.05)' },

  listWrap: { flex: 1, position: 'relative' },
  listScroll: {
    flex: 1,
    ...(isWeb
      ? ({
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(120,170,220,0.35) transparent',
        } as object)
      : {}),
  },
  list: { gap: 4, paddingBottom: 14 },

  groupLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  groupLabelGap: { marginTop: 8 },

  // Tight contact row — keeps the list scannable in a 280-tall panel
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 8,
    ...(isWeb
      ? ({
          transition:
            'transform 140ms ease-out, background-color 140ms ease-out, box-shadow 140ms ease-out',
        } as object)
      : {}),
  },
  rowHover: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(120,170,220,0.3)',
    ...(isWeb
      ? ({
          boxShadow: '0 3px 8px rgba(0,0,0,0.3)',
          transform: 'translateY(-1px)',
        } as object)
      : {}),
  },
  rowPressed: {
    backgroundColor: 'rgba(120,170,220,0.16)',
    borderColor: 'rgba(120,170,220,0.45)',
    ...(isWeb ? ({ transform: 'translateY(0px) scale(0.99)' } as object) : {}),
  },

  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(120,170,220,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(120,170,220,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPhoto: { width: '100%', height: '100%' },

  rowText: { flex: 1, minWidth: 0 },
  rowName: { color: '#fff', fontSize: 12, fontWeight: '600', letterSpacing: 0.1 },
  rowMeta: { color: 'rgba(255,255,255,0.55)', fontSize: 10, marginTop: 1 },

  // Subtle "add to call" indicator — green phone in a circle
  addCallBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.32)',
  },

  empty: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 12,
    textAlign: 'center',
  },

  fadeBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 22,
    ...(isWeb
      ? ({
          background:
            'linear-gradient(to bottom, rgba(15,18,24,0) 0%, rgba(15,18,24,0.85) 100%)',
        } as object)
      : {}),
  },
});
