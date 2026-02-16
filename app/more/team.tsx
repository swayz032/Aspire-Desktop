import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Text, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { PageHeader } from '@/components/PageHeader';
import { supabase } from '@/lib/supabase';
import { TeamMember } from '@/types/team';

function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonAvatar} />
        <View style={styles.skeletonInfo}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonSubtitle} />
        </View>
      </View>
      <View style={styles.skeletonCapabilities} />
    </View>
  );
}

function TeamMemberCard({ member, onToggle, onPress }: { member: TeamMember; onToggle: (enabled: boolean) => void; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, member.type === 'ai' && styles.avatarAI]}>
          <Text style={styles.avatarText}>{member.name.charAt(0)}</Text>
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.cardTitle}>{member.name}</Text>
            {member.type === 'ai' && (
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>AI</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardRole}>{member.role}</Text>
        </View>
        {member.type === 'ai' && (
          <Switch
            value={member.enabled}
            onValueChange={onToggle}
            trackColor={{ false: Colors.background.tertiary, true: Colors.accent.cyanDark }}
            thumbColor={member.enabled ? Colors.accent.cyan : Colors.text.muted}
          />
        )}
      </View>
      <View style={styles.capabilitiesContainer}>
        {member.capabilities.slice(0, 3).map((cap, index) => (
          <View key={index} style={styles.capability}>
            <Ionicons name="checkmark" size={14} color={Colors.accent.cyan} />
            <Text style={styles.capabilityText} numberOfLines={1}>{cap}</Text>
          </View>
        ))}
        {member.capabilities.length > 3 && (
          <Text style={styles.moreCapabilities}>+{member.capabilities.length - 3} more</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function TeamScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 60;

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const { data, error } = await supabase
          .from('suite_members')
          .select('*')
          .order('created_at', { ascending: true });
        if (error) throw error;
        if (data && data.length > 0) {
          setMembers(data.map((m: any) => ({
            id: m.id ?? m.member_id ?? '',
            name: m.display_name ?? m.name ?? '',
            type: m.member_type === 'ai' ? 'ai' : 'human',
            role: m.role ?? '',
            enabled: m.enabled !== false,
            capabilities: Array.isArray(m.capabilities) ? m.capabilities : [],
            createdAt: m.created_at ?? new Date().toISOString(),
            updatedAt: m.updated_at ?? new Date().toISOString(),
          })));
        }
      } catch (e) {
        console.warn('Failed to fetch team members:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, []);

  const handleToggle = (id: string, enabled: boolean) => {
    updateTeamMember(id, { enabled });
    setMembers(getTeamMembers());
  };

  const handlePress = (id: string) => {
    router.push(`/more/team/${id}` as any);
  };

  const humanMembers = members.filter(m => m.type === 'human');
  const aiMembers = members.filter(m => m.type === 'ai');
  const enabledAI = aiMembers.filter(m => m.enabled);

  return (
    <View style={styles.container}>
      <PageHeader title="Team Members" showBackButton />
      
      <ScrollView style={[styles.scrollView, { paddingTop: headerHeight }]} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <>
            <View style={styles.skeletonStatsRow}>
              <View style={styles.skeletonStatCard} />
              <View style={styles.skeletonStatCard} />
            </View>
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </>
        ) : (
        <>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{members.length}</Text>
            <Text style={styles.statLabel}>Total Members</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{enabledAI.length}</Text>
            <Text style={styles.statLabel}>Active AI Staff</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Founder</Text>
        {humanMembers.map((member) => (
          <TeamMemberCard 
            key={member.id} 
            member={member} 
            onToggle={() => {}} 
            onPress={() => handlePress(member.id)} 
          />
        ))}

        <Text style={styles.sectionTitle}>AI Staff</Text>
        {aiMembers.map((member) => (
          <TeamMemberCard 
            key={member.id} 
            member={member} 
            onToggle={(enabled) => handleToggle(member.id, enabled)} 
            onPress={() => handlePress(member.id)} 
          />
        ))}
        </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginRight: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  statNumber: {
    ...Typography.title,
    color: Colors.accent.cyan,
    fontWeight: '700',
  },
  statLabel: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: 4,
  },
  sectionTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
  },
  card: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarAI: {
    backgroundColor: Colors.accent.cyanDark,
  },
  avatarText: {
    ...Typography.headline,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  cardInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
    marginRight: Spacing.sm,
  },
  aiBadge: {
    backgroundColor: Colors.accent.cyanDark,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  aiBadgeText: {
    ...Typography.micro,
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  cardRole: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  capabilitiesContainer: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  capability: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  capabilityText: {
    ...Typography.small,
    color: Colors.text.secondary,
    marginLeft: Spacing.xs,
    flex: 1,
  },
  moreCapabilities: {
    ...Typography.small,
    color: Colors.accent.cyan,
    marginTop: 4,
  },
  skeletonCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background.tertiary,
    marginRight: Spacing.md,
  },
  skeletonInfo: {
    flex: 1,
  },
  skeletonTitle: {
    width: '50%',
    height: 16,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 4,
    marginBottom: Spacing.xs,
  },
  skeletonSubtitle: {
    width: '30%',
    height: 12,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 4,
  },
  skeletonCapabilities: {
    height: 40,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 4,
  },
  skeletonStatsRow: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  skeletonStatCard: {
    flex: 1,
    height: 80,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
});
