// components/call-room/TransferPanel.tsx
//
// Transfer destination picker — replaces AI Assist when the Transfer
// control is active. Routes by DEPARTMENT (Sales, Support, Billing,
// Service, Owner). Each department shows the on-shift team member,
// their role, and a live availability indicator.
//
// Two transfer modes (industry-standard):
//   • Warm — host stays on, consults the destination, then connects
//   • Cold — blind transfer, host drops immediately
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const isWeb = Platform.OS === 'web';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Mode = 'warm' | 'cold';
type Availability = 'available' | 'busy' | 'offline';

export interface TransferPanelProps {
  onBack: () => void;
  /** Called after a transfer is initiated; default closes the panel. */
  onTransferred: (departmentId: string, mode: Mode) => void;
}

interface Department {
  id: string;
  name: string;
  icon: IconName;
  member: string;
  role: string;
  availability: Availability;
}

// Mock roster — wire to real assignments later.
const DEPARTMENTS: Department[] = [
  {
    id: 'sales',
    name: 'Sales',
    icon: 'trending-up-outline',
    member: 'Maya Chen',
    role: 'Sales Lead',
    availability: 'available',
  },
  {
    id: 'support',
    name: 'Support',
    icon: 'help-buoy-outline',
    member: 'David Park',
    role: 'Support Specialist',
    availability: 'available',
  },
  {
    id: 'billing',
    name: 'Billing',
    icon: 'card-outline',
    member: 'Sarah Johnson',
    role: 'Billing Manager',
    availability: 'busy',
  },
  {
    id: 'service',
    name: 'Service',
    icon: 'construct-outline',
    member: 'Mike Torres',
    role: 'Service Coordinator',
    availability: 'available',
  },
  {
    id: 'owner',
    name: 'Owner',
    icon: 'ribbon-outline',
    member: 'Tony Williams',
    role: 'Owner',
    availability: 'offline',
  },
];

export function TransferPanel({ onBack, onTransferred }: TransferPanelProps): React.ReactElement {
  const [mode, setMode] = useState<Mode>('warm');

  return (
    <View style={styles.panel} testID="transfer-panel">
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>TRANSFER CALL</Text>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to AI Assist"
          style={({ hovered }: { hovered?: boolean }) => [
            styles.backLink,
            hovered && styles.backLinkHover,
          ]}
        >
          <Ionicons name="arrow-back" size={13} color="rgba(255,255,255,0.65)" />
          <Text style={styles.backLinkText}>AI Assist</Text>
        </Pressable>
      </View>

      <View style={styles.modeToggle}>
        <ModeBtn
          label="Warm"
          hint="Consult first"
          active={mode === 'warm'}
          onPress={() => setMode('warm')}
        />
        <ModeBtn
          label="Cold"
          hint="Blind transfer"
          active={mode === 'cold'}
          onPress={() => setMode('cold')}
        />
      </View>

      <View style={styles.listWrap}>
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={true}
        >
          {DEPARTMENTS.map((d) => (
            <DepartmentRow
              key={d.id}
              dept={d}
              disabled={d.availability === 'offline'}
              onPress={() => onTransferred(d.id, mode)}
            />
          ))}
        </ScrollView>

        {/* Bottom fade — soft gradient hint that more rows exist below the
            visible cutoff. Sits above the ScrollView, ignores pointer
            events so scrolling/click-through still works. Web-only because
            native gradient needs expo-linear-gradient. */}
        {isWeb && (
          <View
            pointerEvents="none"
            style={styles.fadeBottom}
          />
        )}
      </View>
    </View>
  );
}

function ModeBtn({
  label,
  hint,
  active,
  onPress,
}: {
  label: string;
  hint: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} — ${hint}`}
      style={({ hovered }: { hovered?: boolean }) => [
        styles.modeBtn,
        active && styles.modeBtnActive,
        !active && hovered && styles.modeBtnHover,
      ]}
    >
      <Text style={[styles.modeBtnLabel, active && styles.modeBtnLabelActive]}>{label}</Text>
      <Text style={[styles.modeBtnHint, active && styles.modeBtnHintActive]}>{hint}</Text>
    </Pressable>
  );
}

function DepartmentRow({
  dept,
  disabled,
  onPress,
}: {
  dept: Department;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Transfer to ${dept.name}, ${dept.member}, ${dept.availability}`}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.row,
        hovered && !disabled && styles.rowHover,
        pressed && !disabled && styles.rowPressed,
        disabled && styles.rowDisabled,
      ]}
    >
      <View style={styles.rowIconWrap}>
        <Ionicons name={dept.icon} size={16} color="rgba(150,195,235,0.95)" />
      </View>
      <View style={styles.rowText}>
        <View style={styles.rowTopLine}>
          <Text style={styles.rowDept}>{dept.name}</Text>
          <AvailabilityDot status={dept.availability} />
        </View>
        <Text style={styles.rowMember} numberOfLines={1}>
          {dept.member} · <Text style={styles.rowRole}>{dept.role}</Text>
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.35)" />
    </Pressable>
  );
}

function AvailabilityDot({ status }: { status: Availability }) {
  const color =
    status === 'available'
      ? '#22c55e'
      : status === 'busy'
        ? '#eab308'
        : 'rgba(255,255,255,0.25)';
  const ringColor =
    status === 'available'
      ? 'rgba(34,197,94,0.35)'
      : status === 'busy'
        ? 'rgba(234,179,8,0.35)'
        : 'transparent';
  return (
    <View style={[styles.dotRing, { backgroundColor: ringColor }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Locked to 280 to match AI Assist's default render — section size never
  // shifts when toggling between AI Assist / Keypad / Transfer.
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
    ...(isWeb
      ? ({ transition: 'background-color 140ms ease-out' } as object)
      : {}),
  },
  backLinkHover: { backgroundColor: 'rgba(255,255,255,0.06)' },
  backLinkText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginLeft: 2 },

  // Segmented warm/cold toggle — compact to leave room for the list
  modeToggle: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 999,
    padding: 3,
    marginBottom: 8,
    ...(isWeb
      ? ({
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)',
        } as object)
      : {}),
  },
  modeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    ...(isWeb
      ? ({ transition: 'background-color 140ms ease-out' } as object)
      : {}),
  },
  modeBtnHover: { backgroundColor: 'rgba(255,255,255,0.05)' },
  modeBtnActive: {
    backgroundColor: 'rgba(120,170,220,0.18)',
    ...(isWeb
      ? ({
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.15), 0 0 10px rgba(120,170,220,0.25)',
        } as object)
      : {}),
  },
  modeBtnLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600' },
  modeBtnLabelActive: { color: 'rgba(180,210,240,1)' },
  modeBtnHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    marginTop: 1,
    letterSpacing: 0.3,
  },
  modeBtnHintActive: { color: 'rgba(150,195,235,0.85)' },

  listWrap: { flex: 1, position: 'relative' },
  listScroll: {
    flex: 1,
    ...(isWeb
      ? ({
          // Subtle web scrollbar so the affordance is always visible, not
          // just on hover. Color matches the panel's translucent palette.
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(120,170,220,0.35) transparent',
        } as object)
      : {}),
  },
  list: { gap: 5, paddingBottom: 14 },

  // Soft fade at the bottom edge — visual "there's more below" hint.
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

  // Department row — clickable, lifts on hover, compresses on press
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 10,
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
          boxShadow: '0 3px 8px rgba(0,0,0,0.35)',
          transform: 'translateY(-1px)',
        } as object)
      : {}),
  },
  rowPressed: {
    backgroundColor: 'rgba(120,170,220,0.18)',
    borderColor: 'rgba(120,170,220,0.5)',
    ...(isWeb ? ({ transform: 'translateY(0px) scale(0.99)' } as object) : {}),
  },
  rowDisabled: { opacity: 0.45 },
  rowIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(120,170,220,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(120,170,220,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTopLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowDept: { color: '#fff', fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  rowMember: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 1,
  },
  rowRole: { color: 'rgba(255,255,255,0.45)' },

  dotRing: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
