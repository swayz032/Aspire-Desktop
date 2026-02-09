import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HubPageShell } from '@/components/founder-hub/HubPageShell';
import { templates } from '@/data/founderHub/palletMock';
import { getHubImage } from '@/data/founderHub/imageHelper';

const THEME = {
  bg: '#000000',
  surface: '#0a0a0a',
  surfaceHover: '#111111',
  border: 'rgba(255,255,255,0.06)',
  accent: '#3B82F6',
  accentMuted: 'rgba(59, 130, 246, 0.12)',
  text: {
    primary: '#ffffff',
    secondary: 'rgba(255,255,255,0.70)',
    muted: 'rgba(255,255,255,0.45)',
  },
};

const templateCategories = [
  { id: 'all', label: 'All Templates', count: 12 },
  { id: 'sales', label: 'Sales & Outreach', count: 4 },
  { id: 'pricing', label: 'Pricing', count: 3 },
  { id: 'operations', label: 'Operations', count: 3 },
  { id: 'finance', label: 'Finance', count: 2 },
];

const allTemplates = [
  ...templates,
  {
    id: '3',
    type: 'Pricing',
    title: 'Grade Pricing Calculator',
    description: 'Spreadsheet template to calculate optimal pricing for A/B/C grade pallets with margin targets.',
    imageKey: 'pallet-stacks',
  },
  {
    id: '4',
    type: 'Operations',
    title: 'Weekly Capacity Planner',
    description: 'Plan your weekly production capacity, repair queue, and delivery schedule.',
    imageKey: 'warehouse-dock',
  },
  {
    id: '5',
    type: 'Finance',
    title: 'Cash Flow Forecast',
    description: '90-day cash flow projection template with receivables tracking and expense planning.',
    imageKey: 'lumber-yard',
  },
  {
    id: '6',
    type: 'Sales',
    title: 'Follow-up Email Sequence',
    description: '5-email sequence for nurturing cold leads into warm prospects over 2 weeks.',
    imageKey: 'delivery-truck',
  },
];

export default function TemplatesScreen() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'Email': '#3B82F6',
      'Proposal': '#a78bfa',
      'Pricing': '#60a5fa',
      'Operations': '#34d399',
      'Finance': '#fbbf24',
      'Sales': '#f472b6',
    };
    return colors[type] || THEME.accent;
  };

  const rightRail = (
    <View style={styles.railContent}>
      <Text style={styles.railTitle}>Categories</Text>
      <View style={styles.categoryList}>
        {templateCategories.map((cat) => (
          <Pressable
            key={cat.id}
            style={[
              styles.categoryItem,
              activeCategory === cat.id && styles.categoryItemActive,
            ]}
            onPress={() => setActiveCategory(cat.id)}
          >
            <Text style={[
              styles.categoryLabel,
              activeCategory === cat.id && styles.categoryLabelActive,
            ]}>
              {cat.label}
            </Text>
            <Text style={styles.categoryCount}>{cat.count}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.railDivider} />

      <Text style={styles.railTitle}>Recently Used</Text>
      <View style={styles.recentList}>
        <Pressable
          style={[styles.recentItem, hoveredItem === 'recent-1' && styles.recentItemHover]}
          onHoverIn={() => setHoveredItem('recent-1')}
          onHoverOut={() => setHoveredItem(null)}
        >
          <Ionicons name="document-text-outline" size={16} color={THEME.text.muted} />
          <Text style={styles.recentText}>Cold Outreach Email</Text>
        </Pressable>
        <Pressable
          style={[styles.recentItem, hoveredItem === 'recent-2' && styles.recentItemHover]}
          onHoverIn={() => setHoveredItem('recent-2')}
          onHoverOut={() => setHoveredItem(null)}
        >
          <Ionicons name="document-text-outline" size={16} color={THEME.text.muted} />
          <Text style={styles.recentText}>Grade Pricing Calculator</Text>
        </Pressable>
      </View>

      <View style={styles.railDivider} />

      <View style={styles.customCard}>
        <Ionicons name="add-circle-outline" size={24} color={THEME.accent} />
        <Text style={styles.customTitle}>Create Custom Template</Text>
        <Text style={styles.customDesc}>Work with Ava to create templates tailored to your business</Text>
        <Pressable
          style={[styles.customBtn, hoveredItem === 'custom' && styles.customBtnHover]}
          onHoverIn={() => setHoveredItem('custom')}
          onHoverOut={() => setHoveredItem(null)}
        >
          <Text style={styles.customBtnText}>Start with Ava</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <HubPageShell rightRail={rightRail}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Templates</Text>
        <Text style={styles.pageSubtitle}>Strategic templates with AI customization</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={THEME.text.muted} />
        <Text style={styles.searchPlaceholder}>Search templates...</Text>
      </View>

      <View style={styles.templatesGrid}>
        {allTemplates.map((template) => (
          <Pressable
            key={template.id}
            style={[
              styles.templateCard,
              hoveredItem === `template-${template.id}` && styles.templateCardHover,
            ]}
            onHoverIn={() => setHoveredItem(`template-${template.id}`)}
            onHoverOut={() => setHoveredItem(null)}
          >
            <View style={styles.templateImage}>
              <Image
                source={getHubImage(template.imageKey)}
                style={styles.templateThumb}
              />
              <View style={[styles.typeBadge, { backgroundColor: getTypeColor(template.type) + '20' }]}>
                <Text style={[styles.typeBadgeText, { color: getTypeColor(template.type) }]}>
                  {template.type}
                </Text>
              </View>
            </View>
            <View style={styles.templateContent}>
              <Text style={styles.templateTitle}>{template.title}</Text>
              <Text style={styles.templateDesc} numberOfLines={2}>{template.description}</Text>
              <View style={styles.templateActions}>
                <Pressable style={styles.actionBtnPrimary}>
                  <Ionicons name="color-wand-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.actionBtnPrimaryText}>Customize</Text>
                </Pressable>
                <Pressable style={styles.actionBtnSecondary}>
                  <Ionicons name="arrow-forward-outline" size={14} color={THEME.accent} />
                  <Text style={styles.actionBtnSecondaryText}>Send to Operate</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </HubPageShell>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME.text.primary,
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 15,
    color: THEME.text.muted,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 24,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: THEME.text.muted,
  },
  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  templateCard: {
    width: 'calc(50% - 10px)' as any,
    minWidth: 280,
    backgroundColor: THEME.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.border,
  },
  templateCardHover: {
    borderColor: 'rgba(255,255,255,0.12)',
    transform: [{ scale: 1.01 }],
  },
  templateImage: {
    height: 120,
    position: 'relative',
  },
  templateThumb: {
    width: '100%',
    height: '100%',
  },
  typeBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  templateContent: {
    padding: 16,
    gap: 10,
  },
  templateTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.text.primary,
  },
  templateDesc: {
    fontSize: 13,
    color: THEME.text.muted,
    lineHeight: 18,
  },
  templateActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  actionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  actionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.accent,
  },
  railContent: {
    gap: 24,
  },
  railTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  categoryList: {
    gap: 4,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  categoryItemActive: {
    backgroundColor: THEME.accentMuted,
  },
  categoryLabel: {
    fontSize: 13,
    color: THEME.text.secondary,
  },
  categoryLabelActive: {
    color: THEME.accent,
    fontWeight: '600',
  },
  categoryCount: {
    fontSize: 12,
    color: THEME.text.muted,
  },
  railDivider: {
    height: 1,
    backgroundColor: THEME.border,
  },
  recentList: {
    gap: 6,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  recentItemHover: {
    backgroundColor: THEME.surface,
  },
  recentText: {
    fontSize: 13,
    color: THEME.text.secondary,
  },
  customCard: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    gap: 10,
  },
  customTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text.primary,
  },
  customDesc: {
    fontSize: 12,
    color: THEME.text.muted,
    textAlign: 'center',
    lineHeight: 16,
  },
  customBtn: {
    backgroundColor: THEME.accentMuted,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  customBtnHover: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  customBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.accent,
  },
});
