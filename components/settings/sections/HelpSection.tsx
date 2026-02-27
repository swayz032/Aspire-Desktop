/**
 * Help & Support section.
 * FAQ quick links, documentation, and contact support.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ViewStyle, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SectionHeader, Divider } from '../SettingsField';
import { SettingsColors, TRANSITION_SMOOTH } from '../settingsConstants';

interface HelpLink {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  url: string;
  color: string;
  bgColor: string;
}

const HELP_LINKS: HelpLink[] = [
  {
    icon: 'book-outline',
    title: 'Documentation',
    subtitle: 'Guides, tutorials, and API references',
    url: 'https://docs.aspireos.app',
    color: SettingsColors.accent,
    bgColor: SettingsColors.accentBg,
  },
  {
    icon: 'school-outline',
    title: 'Getting Started',
    subtitle: 'Step-by-step onboarding walkthrough',
    url: 'https://docs.aspireos.app/getting-started',
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.10)',
  },
  {
    icon: 'videocam-outline',
    title: 'Video Tutorials',
    subtitle: 'Watch how to use Aspire features',
    url: 'https://aspireos.app/tutorials',
    color: '#8B5CF6',
    bgColor: 'rgba(139, 92, 246, 0.10)',
  },
  {
    icon: 'newspaper-outline',
    title: 'Changelog',
    subtitle: 'See what is new in the latest release',
    url: 'https://aspireos.app/changelog',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.10)',
  },
];

const FAQ_ITEMS = [
  {
    question: 'How do I add team members?',
    answer: 'Navigate to Team Workspace from the sidebar, then click "Invite Member" to send invitations.',
  },
  {
    question: 'How does AI governance work?',
    answer: 'All AI actions go through risk-tiered approval. Green actions run automatically, Yellow requires your confirmation, and Red requires explicit authority.',
  },
  {
    question: 'Can I export my receipts?',
    answer: 'Yes. Visit the Receipts section from the sidebar to view, filter, and export your governance receipts as CSV or PDF.',
  },
  {
    question: 'How do I connect my bank account?',
    answer: 'Go to Finance Hub, then Connections. Aspire uses Plaid for secure bank linking with read-only access.',
  },
];

export default function HelpSection() {
  const handleOpenLink = (url: string) => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(url).catch(() => { /* silent */ });
    }
  };

  return (
    <View>
      <SectionHeader
        title="Help & Support"
        subtitle="Find answers and get assistance"
        icon="help-circle-outline"
      />

      {/* Quick Links */}
      <Text style={styles.groupTitle}>Resources</Text>
      <View style={styles.linksGrid}>
        {HELP_LINKS.map((link) => (
          <Pressable
            key={link.title}
            onPress={() => handleOpenLink(link.url)}
            style={({ hovered }: { hovered?: boolean }) => [
              styles.linkCard,
              hovered && styles.linkCardHover,
            ] as ViewStyle[]}
          >
            <View style={[styles.linkIcon, { backgroundColor: link.bgColor }]}>
              <Ionicons name={link.icon} size={20} color={link.color} />
            </View>
            <View style={styles.linkInfo}>
              <Text style={styles.linkTitle}>{link.title}</Text>
              <Text style={styles.linkSubtitle}>{link.subtitle}</Text>
            </View>
            <Ionicons name="open-outline" size={14} color="#48484a" />
          </Pressable>
        ))}
      </View>

      <Divider />

      {/* FAQ */}
      <Text style={styles.groupTitle}>Frequently Asked Questions</Text>
      {FAQ_ITEMS.map((faq, i) => (
        <View key={i} style={styles.faqItem}>
          <View style={styles.faqQuestion}>
            <Ionicons name="help-circle" size={16} color="#6e6e73" />
            <Text style={styles.faqQuestionText}>{faq.question}</Text>
          </View>
          <Text style={styles.faqAnswer}>{faq.answer}</Text>
        </View>
      ))}

      <Divider />

      {/* Contact Support */}
      <Text style={styles.groupTitle}>Need More Help?</Text>
      <View style={styles.contactCard}>
        <View style={styles.contactIcon}>
          <Ionicons name="headset-outline" size={24} color={SettingsColors.accent} />
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactTitle}>Contact Support</Text>
          <Text style={styles.contactSubtitle}>Our team typically responds within 2 hours during business hours</Text>
        </View>
        <Pressable
          onPress={() => handleOpenLink('mailto:support@aspireos.app')}
          style={({ hovered }: { hovered?: boolean }) => [
            styles.contactBtn,
            hovered && styles.contactBtnHover,
          ] as ViewStyle[]}
        >
          <Ionicons name="mail-outline" size={14} color={SettingsColors.accent} />
          <Text style={styles.contactBtnText}>Email Support</Text>
        </Pressable>
      </View>

      <View style={styles.versionRow}>
        <Text style={styles.versionText}>Aspire Desktop v1.0.0</Text>
        <View style={styles.versionDot} />
        <Text style={styles.versionText}>Build 2026.02.27</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  groupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d1d1d6',
    marginBottom: 16,
    letterSpacing: -0.1,
  },
  linksGrid: {
    gap: 8,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#111113',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    gap: 14,
    ...(Platform.OS === 'web' ? { transition: TRANSITION_SMOOTH, cursor: 'pointer' } : {}),
  } as ViewStyle,
  linkCardHover: {
    backgroundColor: '#151517',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkInfo: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f2f2f2',
  },
  linkSubtitle: {
    fontSize: 12,
    color: '#6e6e73',
    marginTop: 2,
  },
  faqItem: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#111113',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    marginBottom: 8,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  faqQuestionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f2f2f2',
    flex: 1,
  },
  faqAnswer: {
    fontSize: 13,
    color: '#a1a1a6',
    lineHeight: 19,
    paddingLeft: 24,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 14,
    backgroundColor: '#111113',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.12)',
    gap: 16,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: SettingsColors.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f2f2f2',
  },
  contactSubtitle: {
    fontSize: 12,
    color: '#6e6e73',
    marginTop: 3,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: SettingsColors.accentBg,
    borderWidth: 1,
    borderColor: SettingsColors.accentBorder,
    ...(Platform.OS === 'web' ? { transition: TRANSITION_SMOOTH, cursor: 'pointer' } : {}),
  } as ViewStyle,
  contactBtnHover: {
    backgroundColor: 'rgba(59,130,246,0.18)',
  },
  contactBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: SettingsColors.accent,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    paddingBottom: 8,
  },
  versionText: {
    fontSize: 11,
    color: '#48484a',
  },
  versionDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#2C2C2E',
  },
});
