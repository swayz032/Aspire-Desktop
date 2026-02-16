import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Pressable, 
  Modal, 
  Animated,
  Dimensions,
  PanResponder
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '@/constants/tokens';
import { useAvaDock } from '@/providers';
import { useSession } from '@/providers';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MINIMIZED_HEIGHT = 80;
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.75;

export function AvaDock() {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const { dockState, sessionMode, closeDock, minimizeDock, expandDock } = useAvaDock();
  const { session, startSession, endSession, isActive } = useSession();

  useEffect(() => {
    if (dockState === 'expanded') {
      Animated.spring(translateY, {
        toValue: SCREEN_HEIGHT - EXPANDED_HEIGHT,
        useNativeDriver: false,
        tension: 65,
        friction: 11,
      }).start();
      if (!isActive && sessionMode) {
        startSession(sessionMode);
      }
    } else if (dockState === 'minimized') {
      Animated.spring(translateY, {
        toValue: SCREEN_HEIGHT - MINIMIZED_HEIGHT,
        useNativeDriver: false,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.spring(translateY, {
        toValue: SCREEN_HEIGHT,
        useNativeDriver: false,
        tension: 65,
        friction: 11,
      }).start();
    }
  }, [dockState, sessionMode, isActive, startSession, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const newY = dockState === 'expanded' 
          ? SCREEN_HEIGHT - EXPANDED_HEIGHT + gestureState.dy
          : SCREEN_HEIGHT - MINIMIZED_HEIGHT + gestureState.dy;
        if (newY > SCREEN_HEIGHT - EXPANDED_HEIGHT) {
          translateY.setValue(newY);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          if (dockState === 'expanded') {
            minimizeDock();
          } else {
            closeDock();
          }
        } else if (gestureState.dy < -50) {
          expandDock();
        } else {
          if (dockState === 'expanded') {
            Animated.spring(translateY, {
              toValue: SCREEN_HEIGHT - EXPANDED_HEIGHT,
              useNativeDriver: false,
            }).start();
          } else {
            Animated.spring(translateY, {
              toValue: SCREEN_HEIGHT - MINIMIZED_HEIGHT,
              useNativeDriver: false,
            }).start();
          }
        }
      },
    })
  ).current;

  const handleEndSession = () => {
    endSession();
    closeDock();
  };

  const getModeIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (sessionMode) {
      case 'video': return 'videocam';
      case 'conference': return 'people';
      default: return 'mic';
    }
  };

  const getModeLabel = () => {
    switch (sessionMode) {
      case 'video': return 'Video with Ava';
      case 'conference': return 'Conference Room';
      default: return 'Voice with Ava';
    }
  };

  const getStateLabel = () => {
    if (!session) return 'Starting...';
    switch (session.state) {
      case 'connecting': return 'Connecting...';
      case 'listening': return 'Listening';
      case 'processing': return 'Processing...';
      case 'responding': return 'Ava is speaking';
      case 'awaiting_approval': return 'Approval needed';
      case 'executing': return 'Executing...';
      case 'ended': return 'Session ended';
      default: return 'Ready';
    }
  };

  if (dockState === 'closed') {
    return null;
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        { transform: [{ translateY }] }
      ]}
    >
      <View style={styles.handleContainer} {...panResponder.panHandlers}>
        <View style={styles.handle} />
      </View>

      {dockState === 'minimized' ? (
        <Pressable style={styles.minimizedContainer} onPress={expandDock}>
          <View style={styles.minimizedLeft}>
            <View style={styles.pulseRing}>
              <Ionicons name={getModeIcon()} size={20} color={Colors.text.primary} />
            </View>
            <View style={styles.minimizedInfo}>
              <Text style={styles.minimizedTitle}>{getModeLabel()}</Text>
              <Text style={styles.minimizedStatus}>{getStateLabel()}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleEndSession} style={styles.minimizedEndButton}>
            <View style={styles.stopSquare} />
          </TouchableOpacity>
        </Pressable>
      ) : (
        <View style={styles.expandedContainer}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.statusDot} />
              <Text style={styles.headerTitle}>{getModeLabel()}</Text>
            </View>
            <TouchableOpacity onPress={minimizeDock} style={styles.minimizeButton}>
              <Ionicons name="chevron-down" size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.visualizer}>
            <View style={styles.outerRing}>
              <View style={styles.innerRing}>
                <Ionicons name={getModeIcon()} size={40} color={Colors.accent.cyan} />
              </View>
            </View>
            <Text style={styles.stateLabel}>{getStateLabel()}</Text>
          </View>

          <View style={styles.proofSteps}>
            <View style={styles.stepItem}>
              <View style={[styles.stepIcon, styles.stepComplete]}>
                <Ionicons name="checkmark" size={12} color={Colors.background.primary} />
              </View>
              <Text style={styles.stepText}>Intent captured</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={[styles.stepIcon, styles.stepComplete]}>
                <Ionicons name="checkmark" size={12} color={Colors.background.primary} />
              </View>
              <Text style={styles.stepText}>Plan drafted</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={[styles.stepIcon, session?.state === 'processing' ? styles.stepActive : styles.stepPending]}>
                {session?.state === 'processing' ? (
                  <View style={styles.stepDot} />
                ) : (
                  <Text style={styles.stepNumber}>3</Text>
                )}
              </View>
              <Text style={styles.stepText}>Evidence assembled</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={[styles.stepIcon, styles.stepPending]}>
                <Text style={styles.stepNumber}>4</Text>
              </View>
              <Text style={styles.stepText}>Policy checked</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={[styles.stepIcon, styles.stepPending]}>
                <Text style={styles.stepNumber}>5</Text>
              </View>
              <Text style={styles.stepText}>Approval required</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.endButton} onPress={handleEndSession}>
            <View style={styles.stopSquare} />
            <Text style={styles.endButtonText}>End Session</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: EXPANDED_HEIGHT,
    backgroundColor: Colors.background.secondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border.default,
  },
  minimizedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  minimizedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background.tertiary,
    borderWidth: 2,
    borderColor: Colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimizedInfo: {
    marginLeft: Spacing.md,
  },
  minimizedTitle: {
    fontSize: 16,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  minimizedStatus: {
    fontSize: 12,
    color: Colors.accent.cyan,
  },
  minimizedEndButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopSquare: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: Colors.semantic.error,
  },
  expandedContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.semantic.success,
    marginRight: Spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  minimizeButton: {
    padding: Spacing.sm,
  },
  visualizer: {
    alignItems: 'center',
    marginVertical: Spacing.xxl,
  },
  outerRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: Colors.accent.cyan,
    opacity: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: Colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.tertiary,
  },
  stateLabel: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: Spacing.lg,
  },
  proofSteps: {
    marginBottom: Spacing.xxl,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  stepIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  stepComplete: {
    backgroundColor: Colors.semantic.success,
  },
  stepActive: {
    backgroundColor: Colors.accent.cyan,
  },
  stepPending: {
    backgroundColor: Colors.background.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.text.primary,
  },
  stepNumber: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text.muted,
  },
  stepText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  endButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    paddingVertical: Spacing.lg,
    borderRadius: 12,
  },
  endButtonText: {
    fontSize: 16,
    color: Colors.text.primary,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
});
