// components/call-room/AIAssistPanel.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function AIAssistPanel(): React.ReactElement {
  return (
    <View style={styles.panel} testID="ai-assist">
      <View style={styles.headerRow}>
        <Text style={styles.icon}>✨</Text>
        <Text style={styles.sectionLabel}>AI ASSIST</Text>
      </View>

      <Text style={styles.smallLabel}>Suggested question</Text>
      <View style={styles.suggestion}>
        <Text style={styles.suggestionText}>Is water entering the attic or ceiling?</Text>
      </View>

      <Text style={[styles.smallLabel, { marginTop: 18 }]}>Next actions</Text>
      <ActionRow icon="📅" label="Schedule Inspection" />
      <ActionRow icon="💬" label="Draft SMS" />
    </View>
  );
}

function ActionRow({ icon, label }: { icon: string; label: string }) {
  return (
    <Pressable style={styles.actionRow} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionChevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    width: '100%',
    // Fill column's vertical space so left + right panels match in height.
    flex: 1,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 6 },
  icon: { fontSize: 14, color: 'rgba(120,170,220,0.85)' },
  sectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  smallLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 6 },
  // Restrained suggestion — thin border, low-saturation tint, NOT a loud filled box
  suggestion: {
    borderWidth: 1,
    borderColor: 'rgba(120, 170, 220, 0.55)',
    backgroundColor: 'rgba(120, 170, 220, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  suggestionText: { color: 'rgba(255,255,255,0.92)', fontSize: 13, lineHeight: 18 },
  // Subtle action rows — dark glass, low contrast, no saturated fills
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginVertical: 4,
  },
  actionIcon: { fontSize: 14, marginRight: 8 },
  actionLabel: { flex: 1, color: 'rgba(255,255,255,0.88)', fontSize: 13 },
  actionChevron: { color: 'rgba(255,255,255,0.4)', fontSize: 18 },
  moreActions: { marginTop: 8, paddingHorizontal: 4, paddingVertical: 6 },
  moreActionsText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
});
