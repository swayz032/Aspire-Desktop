import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';

export type StaffState = 'active' | 'available' | 'coming_soon';

export interface OfficeStoreStaff {
  id: string;
  name: string;
  role: string;
  state: StaffState;
  headline: string;
  description: string;
  bullets: string[];
  avatarImage: any;
  introVideoUrl?: string;
}

interface OfficeStoreCardProps {
  staff: OfficeStoreStaff;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
}

const getStatusConfig = (state: StaffState) => {
  switch (state) {
    case 'active':
      return {
        label: 'Active',
        dotColor: Colors.semantic.success,
        pillBg: 'rgba(52, 199, 89, 0.15)',
        pillText: Colors.semantic.success,
        primaryLabel: 'View Profile',
        secondaryLabel: 'Manage',
      };
    case 'available':
      return {
        label: 'Available',
        dotColor: Colors.accent.cyan,
        pillBg: 'rgba(79, 172, 254, 0.15)',
        pillText: Colors.accent.cyan,
        primaryLabel: 'Enable Staff',
        secondaryLabel: 'View Details',
      };
    case 'coming_soon':
      return {
        label: 'Coming Soon',
        dotColor: Colors.text.muted,
        pillBg: 'rgba(142, 142, 147, 0.15)',
        pillText: Colors.text.muted,
        primaryLabel: 'Notify Me',
        secondaryLabel: 'View Preview',
      };
  }
};

export function OfficeStoreCard({ staff, onPrimaryAction, onSecondaryAction }: OfficeStoreCardProps) {
  const statusConfig = getStatusConfig(staff.state);

  return (
    <View style={styles.cardWrapper}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatarRing}>
          <Image source={staff.avatarImage} style={styles.avatarImage} />
        </View>
      </View>

      <BlurView intensity={20} tint="dark" style={styles.card}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.02)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        
        <View style={styles.cardContent}>
          <View style={styles.header}>
            <View style={styles.nameSection}>
              <View style={styles.nameRow}>
                <View style={[styles.statusDot, { backgroundColor: statusConfig.dotColor }]} />
                <Text style={styles.name}>{staff.name}</Text>
              </View>
              <Text style={styles.role}>{staff.role}</Text>
            </View>
            
            <View style={[styles.statusPill, { backgroundColor: statusConfig.pillBg }]}>
              <Text style={[styles.statusText, { color: statusConfig.pillText }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          <Text style={styles.headline}>{staff.headline}</Text>
          
          <Text style={styles.description}>{staff.description}</Text>

          <View style={styles.bulletList}>
            {staff.bullets.map((bullet, index) => (
              <View key={index} style={styles.bulletItem}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
          </View>

          <View style={styles.ctaRow}>
            <Pressable 
              style={styles.primaryButton} 
              onPress={onPrimaryAction}
            >
              <Text style={styles.primaryButtonText}>{statusConfig.primaryLabel}</Text>
            </Pressable>
            
            <Pressable 
              style={styles.secondaryButton} 
              onPress={onSecondaryAction}
            >
              <Text style={styles.secondaryButtonText}>{statusConfig.secondaryLabel}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.text.secondary} />
            </Pressable>
          </View>
        </View>
      </BlurView>
    </View>
  );
}

const AVATAR_SIZE = 80;
const AVATAR_OFFSET = 40;

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: Spacing.xxl,
    paddingLeft: AVATAR_OFFSET,
  },
  avatarContainer: {
    position: 'absolute',
    left: 0,
    top: 12,
    zIndex: 10,
  },
  avatarRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#1a2a3a',
    borderWidth: 3,
    borderColor: 'rgba(79, 172, 254, 0.3)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: AVATAR_SIZE - 6,
    height: AVATAR_SIZE - 6,
    borderRadius: (AVATAR_SIZE - 6) / 2,
  },
  card: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardContent: {
    padding: Spacing.lg,
    paddingLeft: AVATAR_OFFSET + Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  nameSection: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  name: {
    color: Colors.text.primary,
    fontSize: Typography.headline.fontSize,
    fontWeight: '600',
  },
  role: {
    color: Colors.accent.cyan,
    fontSize: Typography.caption.fontSize,
    marginLeft: Spacing.lg + Spacing.xs,
  },
  statusPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
  },
  headline: {
    color: Colors.text.primary,
    fontSize: Typography.body.fontSize,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  description: {
    color: Colors.text.tertiary,
    fontSize: Typography.caption.fontSize,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  bulletList: {
    marginBottom: Spacing.lg,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.cyan,
    marginTop: 6,
    marginRight: Spacing.sm,
  },
  bulletText: {
    color: Colors.text.secondary,
    fontSize: Typography.caption.fontSize,
    lineHeight: 18,
    flex: 1,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: 'rgba(79, 172, 254, 0.15)',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.3)',
  },
  primaryButtonText: {
    color: Colors.accent.cyan,
    fontSize: Typography.captionMedium.fontSize,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: '#1C1C1E',
  },
  secondaryButtonText: {
    color: Colors.text.secondary,
    fontSize: Typography.captionMedium.fontSize,
    fontWeight: '500',
  },
});

export default OfficeStoreCard;
