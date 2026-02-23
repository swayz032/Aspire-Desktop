import React from 'react';
import { StyleSheet, View, ScrollView, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { PageHeader } from '@/components/PageHeader';
import { useDesktop } from '@/lib/useDesktop';
import { DesktopPageWrapper } from '@/components/desktop/DesktopPageWrapper';
import { useTenant } from '@/providers';

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  badge?: number;
  isHighlighted?: boolean;
}

function MenuItem({ icon, title, subtitle, onPress, badge, isHighlighted }: MenuItemProps) {
  return (
    <Pressable 
      style={[styles.menuItem, isHighlighted && styles.menuItemHighlighted]} 
      onPress={onPress}
    >
      <View style={[styles.menuIcon, isHighlighted && styles.menuIconHighlighted]}>
        <Ionicons 
          name={icon} 
          size={22} 
          color={isHighlighted ? Colors.accent.cyan : Colors.text.secondary} 
        />
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuTitle, isHighlighted && styles.menuTitleHighlighted]}>
          {title}
        </Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      {badge !== undefined && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color={Colors.text.muted} />
    </Pressable>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <View style={styles.sectionDivider}>
      <Text style={styles.sectionDividerText}>{title}</Text>
    </View>
  );
}

export default function MoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDesktop = useDesktop();
  const { tenant } = useTenant();
  const headerHeight = isDesktop ? 0 : insets.top + 60;

  const content = (
    <View style={styles.container}>
      {!isDesktop && <PageHeader title="More" />}
      
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageSubtitle}>
          Manage your virtual office, staff, and settings.
        </Text>

        <View style={styles.menuSection}>
          <MenuItem
            icon="storefront"
            title="Office Store"
            subtitle="Browse and enable AI staff members"
            onPress={() => router.push('/office-store')}
            isHighlighted={true}
          />
        </View>

        <SectionDivider title="Office Management" />

        <View style={styles.menuSection}>
          <MenuItem
            icon="business"
            title="Office Identity"
            subtitle={tenant ? `${tenant.businessName} • Suite ${tenant.suiteId?.slice(0, 8) || ''}` : 'Your Business • Suite'}
            onPress={() => router.push('/more/office-identity')}
          />
          <MenuItem
            icon="people"
            title="Team Members"
            subtitle="Manage your team"
            onPress={() => router.push('/more/team')}
          />
          <MenuItem
            icon="link"
            title="Integrations"
            subtitle="Manage connected services"
            onPress={() => router.push('/more/integrations')}
          />
        </View>

        <SectionDivider title="Preferences" />

        <View style={styles.menuSection}>
          <MenuItem
            icon="notifications"
            title="Notifications"
            subtitle="Configure alerts and reminders"
            onPress={() => router.push('/more/notifications')}
          />
          <MenuItem
            icon="shield-checkmark"
            title="Security & Privacy"
            subtitle="Manage permissions and data"
            onPress={() => router.push('/more/security')}
          />
          <MenuItem
            icon="color-palette"
            title="Appearance"
            subtitle="Theme and display settings"
            onPress={() => router.push('/more/appearance')}
          />
        </View>

        <SectionDivider title="Support" />

        <View style={styles.menuSection}>
          <MenuItem
            icon="help-circle"
            title="Help Center"
            subtitle="12 articles available"
            onPress={() => router.push('/more/help')}
          />
          <MenuItem
            icon="chatbubble"
            title="Contact Support"
            subtitle="Get help from our team"
            onPress={() => router.push('/more/contact-support')}
          />
          <MenuItem
            icon="document-text"
            title="Terms & Policies"
            onPress={() => router.push('/more/policies')}
          />
        </View>

        <View style={styles.versionInfo}>
          <Text style={styles.versionText}>Aspire Founder Console</Text>
          <Text style={styles.versionNumber}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );

  if (isDesktop) {
    return (
      <DesktopPageWrapper scrollable={false}>
        {content}
      </DesktopPageWrapper>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 120,
  },
  pageSubtitle: {
    color: Colors.text.tertiary,
    fontSize: Typography.caption.fontSize,
    marginBottom: Spacing.xxl,
  },
  menuSection: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  menuItemHighlighted: {
    backgroundColor: 'rgba(79, 172, 254, 0.05)',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  menuIconHighlighted: {
    backgroundColor: 'rgba(79, 172, 254, 0.15)',
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    color: Colors.text.primary,
    fontSize: Typography.body.fontSize,
    fontWeight: '500',
  },
  menuTitleHighlighted: {
    color: Colors.accent.cyan,
  },
  menuSubtitle: {
    color: Colors.text.tertiary,
    fontSize: Typography.small.fontSize,
    marginTop: 2,
  },
  badge: {
    backgroundColor: Colors.semantic.error,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  badgeText: {
    color: '#fff',
    fontSize: Typography.micro.fontSize,
    fontWeight: '600',
  },
  sectionDivider: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  sectionDividerText: {
    color: Colors.text.muted,
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  versionInfo: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  versionText: {
    color: Colors.text.muted,
    fontSize: Typography.small.fontSize,
  },
  versionNumber: {
    color: Colors.text.disabled,
    fontSize: Typography.micro.fontSize,
    marginTop: 4,
  },
});
