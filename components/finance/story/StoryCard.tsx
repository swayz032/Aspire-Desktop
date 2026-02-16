import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CARD_BG, CARD_BORDER } from '@/constants/cardPatterns';

interface StoryCardProps {
  title: string;
  subtitle?: string;
  value?: string;
  valueColor?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  trend?: number[];
  trendColor?: string;
  onPress?: () => void;
  children?: React.ReactNode;
  badge?: string;
  badgeColor?: string;
}

function MiniSparkline({ data, color, width = 60, height = 24 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  if (Platform.OS !== 'web') return null;

  return (
    <View style={{ width, height }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </View>
  );
}

export function StoryCard({ title, subtitle, value, valueColor, icon, iconColor, iconBg, trend, trendColor, onPress, children, badge, badgeColor }: StoryCardProps) {
  const content = (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <View style={styles.headerText}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.title}>{title}</Text>
            {badge && (
              <View style={[styles.badge, { backgroundColor: (badgeColor || '#3B82F6') + '20' }]}>
                <Text style={[styles.badgeText, { color: badgeColor || '#3B82F6' }]}>{badge}</Text>
              </View>
            )}
          </View>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {value && <Text style={[styles.value, valueColor ? { color: valueColor } : {}]}>{value}</Text>}
          {trend && trendColor && <MiniSparkline data={trend} color={trendColor} />}
        </View>
      </View>
      {children && <View style={styles.body}>{children}</View>}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}}>
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#f2f2f2',
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    color: '#8e8e93',
    fontSize: 12,
  },
  value: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  body: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
  },
});
