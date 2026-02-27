/**
 * Notification Settings section.
 * Toggle groups for email, push, and in-app notifications by category.
 * TODO: Wire to notification preferences API when available.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SectionHeader, ToggleField, Divider } from '../SettingsField';

interface NotifGroup {
  title: string;
  subtitle: string;
  toggles: { key: string; label: string; description: string }[];
}

const NOTIF_GROUPS: NotifGroup[] = [
  {
    title: 'Communication',
    subtitle: 'Messages, calls, and email activity',
    toggles: [
      { key: 'newMessage', label: 'New Messages', description: 'When a new SMS or chat message arrives' },
      { key: 'missedCall', label: 'Missed Calls', description: 'When Sarah misses or fails to handle a call' },
      { key: 'voicemail', label: 'Voicemail Received', description: 'When a new voicemail is left for your business' },
      { key: 'emailDigest', label: 'Email Digest', description: 'Daily summary of email activity from Eli' },
    ],
  },
  {
    title: 'Financial',
    subtitle: 'Invoices, payments, and Finn alerts',
    toggles: [
      { key: 'paymentReceived', label: 'Payment Received', description: 'When a client pays an invoice' },
      { key: 'invoiceOverdue', label: 'Invoice Overdue', description: 'When an invoice passes its due date' },
      { key: 'finnAlert', label: 'Finn Financial Alerts', description: 'Cash flow warnings and financial insights' },
      { key: 'expenseApproval', label: 'Expense Approvals', description: 'When an expense requires your approval' },
    ],
  },
  {
    title: 'Documents & Legal',
    subtitle: 'Contracts, signatures, and Clara activity',
    toggles: [
      { key: 'signatureRequired', label: 'Signature Required', description: 'When a document needs your signature' },
      { key: 'documentSigned', label: 'Document Signed', description: 'When a client signs a contract you sent' },
      { key: 'claraUpdate', label: 'Clara Updates', description: 'Document review completions and legal alerts' },
    ],
  },
  {
    title: 'System & Governance',
    subtitle: 'Receipts, approvals, and platform updates',
    toggles: [
      { key: 'approvalRequired', label: 'Approval Required', description: 'When a YELLOW or RED tier action needs your confirmation' },
      { key: 'weeklyReport', label: 'Weekly Report', description: 'Summary of all governance activity and receipts' },
      { key: 'systemUpdate', label: 'System Updates', description: 'New features, maintenance windows, and changelog' },
    ],
  },
];

type NotifState = Record<string, boolean>;

const DEFAULT_STATE: NotifState = {
  newMessage: true,
  missedCall: true,
  voicemail: true,
  emailDigest: true,
  paymentReceived: true,
  invoiceOverdue: true,
  finnAlert: true,
  expenseApproval: true,
  signatureRequired: true,
  documentSigned: true,
  claraUpdate: false,
  approvalRequired: true,
  weeklyReport: true,
  systemUpdate: false,
};

export default function NotificationsSection() {
  const [notifState, setNotifState] = useState<NotifState>(DEFAULT_STATE);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [quietHours, setQuietHours] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const updateNotif = (key: string, value: boolean) => {
    setNotifState(prev => ({ ...prev, [key]: value }));
  };

  return (
    <View>
      <SectionHeader
        title="Notification Settings"
        subtitle="Control how and when you receive notifications"
        icon="notifications-outline"
      />

      {/* Delivery Channels */}
      <Text style={styles.groupTitle}>Delivery Channels</Text>
      <ToggleField
        label="Email Notifications"
        description="Receive notification emails at your registered address"
        value={emailEnabled}
        onValueChange={setEmailEnabled}
      />
      <ToggleField
        label="Push Notifications"
        description="Browser and device push notifications"
        value={pushEnabled}
        onValueChange={setPushEnabled}
      />
      <ToggleField
        label="In-App Notifications"
        description="Show notification badges and banners within Aspire"
        value={inAppEnabled}
        onValueChange={setInAppEnabled}
      />

      <Divider />

      {/* Quiet Hours */}
      <Text style={styles.groupTitle}>Do Not Disturb</Text>
      <ToggleField
        label="Quiet Hours"
        description="Silence all non-critical notifications from 10 PM to 7 AM in your timezone"
        value={quietHours}
        onValueChange={setQuietHours}
      />
      <ToggleField
        label="Notification Sound"
        description="Play a sound for new notifications"
        value={soundEnabled}
        onValueChange={setSoundEnabled}
      />

      <Divider />

      {/* Category Toggles */}
      {NOTIF_GROUPS.map((group, i) => (
        <View key={group.title}>
          <View style={styles.categoryHeader}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <Text style={styles.categorySubtitle}>{group.subtitle}</Text>
          </View>
          {group.toggles.map(t => (
            <ToggleField
              key={t.key}
              label={t.label}
              description={t.description}
              value={notifState[t.key] ?? false}
              onValueChange={(v) => updateNotif(t.key, v)}
            />
          ))}
          {i < NOTIF_GROUPS.length - 1 && <Divider />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  groupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d1d1d6',
    marginBottom: 4,
    letterSpacing: -0.1,
  },
  categoryHeader: {
    marginBottom: 12,
  },
  categorySubtitle: {
    fontSize: 12,
    color: '#6e6e73',
    marginTop: 2,
  },
});
