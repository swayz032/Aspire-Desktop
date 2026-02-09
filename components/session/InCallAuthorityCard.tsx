import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Colors, Spacing, BorderRadius } from '@/constants/tokens';

export interface AuthorityItem {
  id: string;
  title: string;
  description: string;
  type: 'send_material' | 'share_private' | 'execute_action';
  sensitivity: 'room_safe' | 'internal_sensitive' | 'restricted';
  requestedBy: string;
  recipients?: string[];
  timestamp: Date;
}

interface InCallAuthorityCardProps {
  item: AuthorityItem;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
  compact?: boolean;
}

const SENSITIVITY_CONFIG = {
  room_safe: {
    color: Colors.semantic.success,
    label: 'Room Safe',
    icon: 'shield-checkmark' as const,
  },
  internal_sensitive: {
    color: Colors.semantic.warning,
    label: 'Internal',
    icon: 'shield-half' as const,
  },
  restricted: {
    color: Colors.semantic.error,
    label: 'Restricted',
    icon: 'shield' as const,
  },
};

const TYPE_CONFIG = {
  send_material: {
    icon: 'paper-plane' as const,
    label: 'Send Material',
  },
  share_private: {
    icon: 'lock-open' as const,
    label: 'Share Private',
  },
  execute_action: {
    icon: 'flash' as const,
    label: 'Execute Action',
  },
};

export function InCallAuthorityCard({
  item,
  onApprove,
  onDeny,
  compact = false,
}: InCallAuthorityCardProps) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const sensitivityConfig = SENSITIVITY_CONFIG[item.sensitivity];
  const typeConfig = TYPE_CONFIG[item.type];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 20,
        stiffness: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleApprove = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onApprove(item.id));
  };

  const handleDeny = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDeny(item.id));
  };

  if (compact) {
    return (
      <Animated.View
        style={[
          styles.compactContainer,
          {
            transform: [{ translateY: slideAnim }, { scale: pulseAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <BlurView intensity={60} tint="dark" style={styles.compactBlur}>
          <LinearGradient
            colors={['rgba(18, 20, 23, 0.9)', 'rgba(26, 29, 34, 0.9)']}
            style={styles.compactGradient}
          >
            <View style={styles.compactContent}>
              <View style={[styles.compactIcon, { backgroundColor: `${sensitivityConfig.color}20` }]}>
                <Ionicons name={typeConfig.icon} size={14} color={sensitivityConfig.color} />
              </View>
              <View style={styles.compactInfo}>
                <Text style={styles.compactTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.compactMeta}>{item.requestedBy}</Text>
              </View>
              <View style={styles.compactActions}>
                <Pressable style={styles.compactDeny} onPress={handleDeny}>
                  <Ionicons name="close" size={16} color={Colors.semantic.error} />
                </Pressable>
                <Pressable style={styles.compactApprove} onPress={handleApprove}>
                  <Ionicons name="checkmark" size={16} color={Colors.semantic.success} />
                </Pressable>
              </View>
            </View>
          </LinearGradient>
        </BlurView>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: slideAnim }, { scale: pulseAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
        <LinearGradient
          colors={['rgba(18, 20, 23, 0.95)', 'rgba(26, 29, 34, 0.95)']}
          style={styles.gradient}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.typeIcon, { backgroundColor: `${sensitivityConfig.color}15` }]}>
                <Ionicons name={typeConfig.icon} size={18} color={sensitivityConfig.color} />
              </View>
              <View>
                <Text style={styles.typeLabel}>{typeConfig.label}</Text>
                <View style={styles.sensitivityRow}>
                  <Ionicons name={sensitivityConfig.icon} size={10} color={sensitivityConfig.color} />
                  <Text style={[styles.sensitivityLabel, { color: sensitivityConfig.color }]}>
                    {sensitivityConfig.label}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.pendingBadge}>
              <View style={styles.pendingDot} />
              <Text style={styles.pendingText}>Pending</Text>
            </View>
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
            
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="person" size={12} color={Colors.text.muted} />
                <Text style={styles.metaText}>Requested by {item.requestedBy}</Text>
              </View>
              {item.recipients && item.recipients.length > 0 && (
                <View style={styles.metaItem}>
                  <Ionicons name="people" size={12} color={Colors.text.muted} />
                  <Text style={styles.metaText}>
                    To: {item.recipients.slice(0, 2).join(', ')}
                    {item.recipients.length > 2 && ` +${item.recipients.length - 2}`}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable 
              style={({ pressed }) => [styles.denyButton, pressed && styles.buttonPressed]}
              onPress={handleDeny}
            >
              <LinearGradient
                colors={['rgba(255, 59, 48, 0.15)', 'rgba(255, 59, 48, 0.05)']}
                style={styles.buttonGradient}
              >
                <Ionicons name="close" size={18} color={Colors.semantic.error} />
                <Text style={styles.denyText}>Deny</Text>
              </LinearGradient>
            </Pressable>
            
            <Pressable 
              style={({ pressed }) => [styles.approveButton, pressed && styles.buttonPressed]}
              onPress={handleApprove}
            >
              <LinearGradient
                colors={['rgba(52, 199, 89, 0.2)', 'rgba(52, 199, 89, 0.1)']}
                style={styles.buttonGradient}
              >
                <Ionicons name="checkmark" size={18} color={Colors.semantic.success} />
                <Text style={styles.approveText}>Approve</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </LinearGradient>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  blurContainer: {
    overflow: 'hidden',
    borderRadius: BorderRadius.lg,
  },
  gradient: {
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  sensitivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  sensitivityLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212, 160, 23, 0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.semantic.warning,
  },
  pendingText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.semantic.warning,
  },
  content: {
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  metaRow: {
    gap: Spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 11,
    color: Colors.text.muted,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  denyButton: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  approveButton: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  denyText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.semantic.error,
  },
  approveText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.semantic.success,
  },
  compactContainer: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  compactBlur: {
    overflow: 'hidden',
    borderRadius: BorderRadius.md,
  },
  compactGradient: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  compactIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactInfo: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  compactMeta: {
    fontSize: 10,
    color: Colors.text.muted,
  },
  compactActions: {
    flexDirection: 'row',
    gap: 6,
  },
  compactDeny: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactApprove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
