/**
 * PhotoLaneCard — single mode-switcher tile in the PropertyImagesGrid row.
 *
 * Layout (per mockup ED488B74):
 *   ┌────────────────────────────┐
 *   │  Interior            ⤴    │  ← label + external chevron
 *   │                            │
 *   │   [thumbnail or icon]      │
 *   │                            │
 *   │  ┌──┐                       │
 *   │  │12│                       │  ← count badge (bottom-left)
 *   │  └──┘                       │
 *   └────────────────────────────┘
 *
 * Active state: amber border + amber tint glow.
 * Hover: lift 2px, brightness +5%.
 */
import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SheenBlock } from './InsightCardBase';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  label: string;
  count?: number;
  thumbnailUrl?: string;
  icon?: IoniconsName;
  onPress: () => void;
  isActive?: boolean;
  loading?: boolean;
  /** Test hook & a11y (e.g. "interior", "exterior"). */
  testID?: string;
}

export function PhotoLaneCard({
  label,
  count,
  thumbnailUrl,
  icon = 'image-outline',
  onPress,
  isActive = false,
  loading = false,
  testID,
}: Props) {
  if (loading) {
    return (
      <View style={[styles.card, styles.cardSkeleton]} testID={testID ? `${testID}-skeleton` : undefined}>
        <SheenBlock width="100%" height={92} radius={8} />
        <View style={{ height: 8 }} />
        <SheenBlock width={70} height={12} radius={4} />
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Switch hero to ${label}${typeof count === 'number' ? `, ${count} photos` : ''}`}
      accessibilityState={{ selected: isActive }}
      testID={testID}
      style={({ hovered, pressed }: any) => [
        styles.card,
        hovered && styles.cardHover,
        pressed && styles.cardPressed,
        isActive && styles.cardActive,
        Platform.OS === 'web' &&
          (({
            transition:
              'transform 150ms ease-out, border-color 150ms ease-out, box-shadow 200ms ease-out, background-color 150ms ease-out',
          } as unknown) as ViewStyle),
      ]}
    >
      <View style={styles.media}>
        {thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.thumb}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            resizeMode="cover"
          />
        ) : (
          <View style={styles.iconWrap}>
            <Ionicons
              name={icon}
              size={28}
              color={isActive ? '#fbbf24' : 'rgba(255,255,255,0.55)'}
            />
          </View>
        )}

        {/* Subtle bottom gradient so the count badge stays legible. */}
        {thumbnailUrl && (
          <View
            pointerEvents="none"
            style={
              ({
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: 60,
                backgroundImage:
                  'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 100%)',
              } as unknown) as ViewStyle
            }
          />
        )}

        {/* External chevron — top-right */}
        <View style={styles.chevron} pointerEvents="none">
          <Ionicons
            name="open-outline"
            size={11}
            color={isActive ? '#fbbf24' : 'rgba(255,255,255,0.55)'}
          />
        </View>

        {/* Count badge — bottom-left */}
        {typeof count === 'number' && (
          <View
            style={[styles.countBadge, isActive && styles.countBadgeActive]}
            pointerEvents="none"
          >
            <Text style={[styles.countText, isActive && styles.countTextActive]}>
              {count}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text
          style={[styles.label, isActive && styles.labelActive]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {isActive && <View style={styles.activeDot} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 180,
    height: 140,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  cardSkeleton: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.015)',
  },
  cardHover: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.10)',
    ...(Platform.OS === 'web'
      ? (({ transform: 'translateY(-2px)' } as unknown) as ViewStyle)
      : {}),
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardActive: {
    borderColor: 'rgba(251,191,36,0.55)',
    backgroundColor: 'rgba(251,191,36,0.06)',
    ...(Platform.OS === 'web'
      ? (({
          boxShadow:
            '0 0 0 1px rgba(251,191,36,0.30), 0 6px 18px rgba(251,191,36,0.10)',
        } as unknown) as ViewStyle)
      : {}),
  },
  media: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  iconWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  countBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    minWidth: 26,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeActive: {
    backgroundColor: 'rgba(251,191,36,0.18)',
    borderColor: 'rgba(251,191,36,0.40)',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.1,
    fontVariant: ['tabular-nums'],
  },
  countTextActive: {
    color: '#fbbf24',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  label: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.1,
  },
  labelActive: {
    color: '#fbbf24',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fbbf24',
  },
});
