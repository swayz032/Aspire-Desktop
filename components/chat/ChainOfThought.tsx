/**
 * ChainOfThought -- Collapsible AI reasoning step visualization.
 *
 * Displays the orchestrator's internal reasoning steps during processing.
 * Auto-expands during streaming, collapses when complete.
 * Each step shows: icon, label, status, optional timing.
 *
 * Features:
 *   - Collapsible accordion with smooth height animation
 *   - Agent-colored accent theming
 *   - Step status indicators (complete, active, pending)
 *   - Search result badges
 *   - Image support with captions
 *   - Auto-expand during streaming, auto-collapse on completion
 *   - Accessible with keyboard navigation
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Animated,
  Platform,
  type ViewStyle,
  type ImageSourcePropType,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/tokens';
import type { AgentId } from './types';
import { AGENT_COLORS } from './types';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ChainOfThoughtContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  agentColor: string;
}

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue>({
  isOpen: false,
  setIsOpen: () => {},
  agentColor: Colors.accent.cyan,
});

function useChainOfThought(): ChainOfThoughtContextValue {
  return useContext(ChainOfThoughtContext);
}

// ---------------------------------------------------------------------------
// Step Status Type
// ---------------------------------------------------------------------------

export type StepStatus = 'complete' | 'active' | 'pending';

// ---------------------------------------------------------------------------
// Root: <ChainOfThought />
// ---------------------------------------------------------------------------

interface ChainOfThoughtProps {
  /** Controlled open state. */
  open?: boolean;
  /** Default open state (uncontrolled). */
  defaultOpen?: boolean;
  /** Callback when open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Agent identity for accent theming. */
  agent?: AgentId;
  /** Whether reasoning is actively streaming (auto-opens panel). */
  isStreaming?: boolean;
  /** Additional container style. */
  style?: ViewStyle;
  children?: React.ReactNode;
}

export const ChainOfThought = React.memo(function ChainOfThought({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  agent,
  isStreaming = false,
  style,
  children,
}: ChainOfThoughtProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const agentColor = agent ? AGENT_COLORS[agent] : Colors.accent.cyan;

  const setIsOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  // Auto-open when streaming starts, auto-collapse when streaming ends
  const prevStreaming = useRef(isStreaming);
  useEffect(() => {
    if (isStreaming && !prevStreaming.current) {
      setIsOpen(true);
    } else if (!isStreaming && prevStreaming.current) {
      setIsOpen(false);
    }
    prevStreaming.current = isStreaming;
  }, [isStreaming, setIsOpen]);

  const contextValue = useMemo(
    () => ({ isOpen, setIsOpen, agentColor }),
    [isOpen, setIsOpen, agentColor],
  );

  return (
    <ChainOfThoughtContext.Provider value={contextValue}>
      <View
        style={[s.root, style]}
        accessibilityRole="none"
        accessibilityLabel="Chain of thought reasoning"
      >
        {children}
      </View>
    </ChainOfThoughtContext.Provider>
  );
});

// ---------------------------------------------------------------------------
// <ChainOfThoughtHeader />
// ---------------------------------------------------------------------------

interface ChainOfThoughtHeaderProps {
  children?: React.ReactNode;
  /** Optional step count badge. */
  stepCount?: number;
  style?: ViewStyle;
}

export const ChainOfThoughtHeader = React.memo(function ChainOfThoughtHeader({
  children,
  stepCount,
  style,
}: ChainOfThoughtHeaderProps) {
  const { isOpen, setIsOpen, agentColor } = useChainOfThought();

  return (
    <Pressable
      onPress={() => setIsOpen(!isOpen)}
      style={[s.header, style]}
      accessibilityRole="button"
      accessibilityLabel={
        isOpen ? 'Collapse chain of thought' : 'Expand chain of thought'
      }
      accessibilityState={{ expanded: isOpen }}
    >
      <View style={s.headerLeft}>
        <Ionicons
          name="sparkles"
          size={14}
          color={agentColor}
          style={s.headerIcon}
        />
        <Text style={[s.headerText, { color: agentColor }]}>
          {children ?? 'Chain of Thought'}
        </Text>
        {stepCount != null && stepCount > 0 && (
          <View style={[s.stepCountBadge, { backgroundColor: `${agentColor}1F` }]}>
            <Text style={[s.stepCountText, { color: agentColor }]}>
              {stepCount}
            </Text>
          </View>
        )}
      </View>
      <Ionicons
        name={isOpen ? 'chevron-up' : 'chevron-down'}
        size={14}
        color={Colors.text.muted}
      />
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// <ChainOfThoughtContent />
// ---------------------------------------------------------------------------

interface ChainOfThoughtContentProps {
  children?: React.ReactNode;
  style?: ViewStyle;
}

export const ChainOfThoughtContent = React.memo(
  function ChainOfThoughtContent({ children, style }: ChainOfThoughtContentProps) {
    const { isOpen } = useChainOfThought();
    const heightAnim = useRef(new Animated.Value(isOpen ? 1 : 0)).current;

    useEffect(() => {
      Animated.timing(heightAnim, {
        toValue: isOpen ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }, [isOpen, heightAnim]);

    // On web, use CSS max-height for smoother animation
    if (Platform.OS === 'web') {
      return (
        <View
          style={[
            s.contentWrapper,
            {
              maxHeight: isOpen ? 2000 : 0,
              overflow: 'hidden',
              opacity: isOpen ? 1 : 0,
              transition: 'max-height 200ms ease-out, opacity 150ms ease-out',
            } as unknown as ViewStyle,
            style,
          ]}
        >
          <View style={s.contentInner}>{children}</View>
        </View>
      );
    }

    // Native: animated opacity + conditional render
    if (!isOpen) return null;

    return (
      <Animated.View style={[s.contentWrapper, { opacity: heightAnim }, style]}>
        <View style={s.contentInner}>{children}</View>
      </Animated.View>
    );
  },
);

// ---------------------------------------------------------------------------
// <ChainOfThoughtStep />
// ---------------------------------------------------------------------------

interface ChainOfThoughtStepProps {
  /** Ionicons icon name for the step. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Main text label. */
  label: string;
  /** Optional description shown below the label. */
  description?: string;
  /** Step status. */
  status?: StepStatus;
  /** Duration string (e.g. "1.2s"). */
  duration?: string;
  /** Whether this is the last step (hides connector). */
  isLast?: boolean;
  style?: ViewStyle;
}

export const ChainOfThoughtStep = React.memo(function ChainOfThoughtStep({
  icon,
  label,
  description,
  status = 'complete',
  duration,
  isLast = false,
  style,
}: ChainOfThoughtStepProps) {
  const { agentColor } = useChainOfThought();

  // Status-based styling
  const isComplete = status === 'complete';
  const isActive = status === 'active';
  const isPending = status === 'pending';

  let iconColor: string = Colors.text.muted;
  let iconBg: string = '#1E1E20';
  let iconName: keyof typeof Ionicons.glyphMap = icon ?? 'ellipse';

  if (isComplete) {
    iconColor = Colors.semantic.success as string;
    iconBg = 'rgba(52,199,89,0.12)';
    if (!icon) iconName = 'checkmark-circle';
  } else if (isActive) {
    iconColor = agentColor;
    iconBg = `${agentColor}1F`;
    if (!icon) iconName = 'sparkles';
  } else if (isPending) {
    iconColor = Colors.text.disabled as string;
    iconBg = '#1A1A1C';
    if (!icon) iconName = 'ellipse';
  }

  return (
    <View
      style={[s.stepRow, style]}
      accessibilityRole="none"
      accessibilityLabel={`${label}, ${status}`}
    >
      {/* Icon + Connector */}
      <View style={s.stepConnectorCol}>
        <View style={[s.stepIconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={iconName} size={12} color={iconColor} />
        </View>
        {!isLast && (
          <View
            style={[
              s.stepConnectorLine,
              {
                backgroundColor: isComplete
                  ? Colors.semantic.success
                  : Colors.border.subtle,
              },
            ]}
          />
        )}
      </View>

      {/* Label + Description */}
      <View style={s.stepTextCol}>
        <View style={s.stepLabelRow}>
          <Text
            style={[
              s.stepLabel,
              isComplete && s.stepLabelComplete,
              isActive && { color: Colors.text.secondary, fontWeight: '500' as const },
              isPending && { color: Colors.text.disabled },
            ]}
            numberOfLines={2}
          >
            {label}
          </Text>
          {/* Active spinner */}
          {isActive && <StepSpinner color={agentColor} />}
          {/* Duration */}
          {duration && (
            <Text style={s.stepDuration}>{duration}</Text>
          )}
        </View>
        {description && (
          <Text style={s.stepDescription} numberOfLines={3}>
            {description}
          </Text>
        )}
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// <ChainOfThoughtSearchResults />
// ---------------------------------------------------------------------------

interface ChainOfThoughtSearchResultsProps {
  children?: React.ReactNode;
  style?: ViewStyle;
}

export const ChainOfThoughtSearchResults = React.memo(
  function ChainOfThoughtSearchResults({
    children,
    style,
  }: ChainOfThoughtSearchResultsProps) {
    return (
      <View style={[s.searchResults, style]} accessibilityRole="none">
        {children}
      </View>
    );
  },
);

// ---------------------------------------------------------------------------
// <ChainOfThoughtSearchResult />
// ---------------------------------------------------------------------------

interface ChainOfThoughtSearchResultProps {
  /** Search result text. */
  children: React.ReactNode;
  /** Optional URL for the result. */
  url?: string;
  style?: ViewStyle;
}

export const ChainOfThoughtSearchResult = React.memo(
  function ChainOfThoughtSearchResult({
    children,
    url,
    style,
  }: ChainOfThoughtSearchResultProps) {
    const { agentColor } = useChainOfThought();

    return (
      <View
        style={[
          s.searchBadge,
          { borderColor: `${agentColor}33` },
          style,
        ]}
        accessibilityRole="link"
        accessibilityLabel={typeof children === 'string' ? children : 'Search result'}
      >
        <Ionicons
          name="search"
          size={10}
          color={agentColor}
          style={s.searchBadgeIcon}
        />
        <Text style={s.searchBadgeText} numberOfLines={1}>
          {children}
        </Text>
      </View>
    );
  },
);

// ---------------------------------------------------------------------------
// <ChainOfThoughtImage />
// ---------------------------------------------------------------------------

interface ChainOfThoughtImageProps {
  /** Image source. */
  source: ImageSourcePropType | { uri: string };
  /** Optional caption. */
  caption?: string;
  style?: ViewStyle;
}

export const ChainOfThoughtImage = React.memo(function ChainOfThoughtImage({
  source,
  caption,
  style,
}: ChainOfThoughtImageProps) {
  return (
    <View style={[s.imageContainer, style]}>
      <Image
        source={source}
        style={s.image}
        resizeMode="cover"
        accessibilityLabel={caption ?? 'Chain of thought image'}
      />
      {caption && <Text style={s.imageCaption}>{caption}</Text>}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Internal: Step Spinner
// ---------------------------------------------------------------------------

function StepSpinner({ color }: { color: string }) {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: false,
      }),
    ).start();
  }, [spinAnim]);

  const rotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        s.spinner,
        { borderTopColor: color, transform: [{ rotate }] },
      ]}
      accessibilityLabel="Processing"
    />
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const webTransition =
  Platform.OS === 'web'
    ? ({ transition: 'all 200ms ease-out' } as unknown as ViewStyle)
    : {};

const webCursor =
  Platform.OS === 'web'
    ? ({ cursor: 'pointer' } as unknown as ViewStyle)
    : {};

const s = StyleSheet.create({
  // Root
  root: {
    borderRadius: BorderRadius.lg,
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: '#232325',
    overflow: 'hidden',
    ...webTransition,
  },

  // Header (trigger)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md + 2,
    minHeight: 44,
    ...webCursor,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.sm,
  },
  headerIcon: {
    marginRight: 2,
  },
  headerText: {
    ...Typography.smallMedium,
    letterSpacing: 0.3,
  },
  stepCountBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
    minWidth: 20,
    alignItems: 'center',
  },
  stepCountText: {
    ...Typography.micro,
  },

  // Content
  contentWrapper: {},
  contentInner: {
    paddingHorizontal: Spacing.md + 2,
    paddingBottom: Spacing.md,
    gap: 2,
  },

  // Step
  stepRow: {
    flexDirection: 'row',
    gap: Spacing.sm + 2,
    paddingVertical: 3,
  },
  stepConnectorCol: {
    alignItems: 'center',
    width: 22,
  },
  stepIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepConnectorLine: {
    width: 1,
    height: 10,
    marginTop: 2,
  },
  stepTextCol: {
    flex: 1,
    paddingTop: 2,
  },
  stepLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stepLabel: {
    ...Typography.small,
    color: Colors.text.tertiary,
    flex: 1,
  },
  stepLabelComplete: {
    color: Colors.text.tertiary,
  },
  stepDescription: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: 2,
  },
  stepDuration: {
    ...Typography.micro,
    color: Colors.text.muted,
  },

  // Search results
  searchResults: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md + 2,
  },
  searchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  searchBadgeIcon: {
    marginRight: 1,
  },
  searchBadgeText: {
    ...Typography.micro,
    color: Colors.text.tertiary,
    maxWidth: 160,
  },

  // Image
  imageContainer: {
    marginVertical: Spacing.sm,
    marginHorizontal: Spacing.md + 2,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#1A1A1C',
  },
  image: {
    width: '100%' as unknown as number,
    height: 160,
    borderRadius: BorderRadius.md,
  },
  imageCaption: {
    ...Typography.small,
    color: Colors.text.muted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontStyle: 'italic',
  },

  // Spinner
  spinner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#2C2C2E',
    borderTopWidth: 2,
  },
});
