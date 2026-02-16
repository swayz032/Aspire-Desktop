import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { useAvaDock } from '@/providers';
import { useSession } from '@/providers';

export function AvaMiniPlayer() {
  const { dockState, closeDock, sessionMode, minimizeDock, expandDock } = useAvaDock();
  const { session, endSession, isActive } = useSession();

  useEffect(() => {
    if (isActive && dockState === 'closed') {
      expandDock();
    }
  }, [isActive, dockState, expandDock]);

  if (!isActive || dockState === 'closed') {
    return null;
  }

  const isMinimized = dockState === 'minimized';

  const getModeIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (sessionMode) {
      case 'video': return 'videocam';
      case 'conference': return 'people';
      default: return 'mic';
    }
  };

  const getStateLabel = () => {
    if (!session) return 'Starting...';
    switch (session.state) {
      case 'connecting': return 'Connecting...';
      case 'listening': return 'Ava is listening';
      case 'processing': return 'Processing...';
      case 'responding': return 'Ava is speaking';
      case 'awaiting_approval': return 'Approval needed';
      case 'executing': return 'Executing...';
      default: return 'Ready';
    }
  };

  const handleEndSession = () => {
    endSession();
    closeDock();
  };

  const handleToggleMinimize = () => {
    if (isMinimized) {
      expandDock();
    } else {
      minimizeDock();
    }
  };

  if (isMinimized) {
    return (
      <TouchableOpacity 
        style={styles.minimizedContainer} 
        onPress={handleToggleMinimize}
        activeOpacity={0.8}
      >
        <View style={styles.minimizedPulse}>
          <Ionicons name={getModeIcon()} size={20} color={Colors.text.primary} />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity onPress={handleToggleMinimize} style={styles.pulseRing}>
          <Ionicons name={getModeIcon()} size={18} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.info}>
          <Text style={styles.title}>Ava</Text>
          <Text style={styles.status}>{getStateLabel()}</Text>
        </View>
        <TouchableOpacity onPress={handleEndSession} style={styles.endButton}>
          <Ionicons name="close" size={18} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.accent.cyan,
    shadowColor: Colors.accent.cyan,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  minimizedContainer: {
    position: 'absolute',
    bottom: 100,
    right: Spacing.lg,
    shadowColor: Colors.accent.cyan,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  minimizedPulse: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.background.secondary,
    borderWidth: 2,
    borderColor: Colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  pulseRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.tertiary,
    borderWidth: 2,
    borderColor: Colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: Typography.bodyMedium.fontWeight,
    color: Colors.text.primary,
  },
  status: {
    fontSize: Typography.small.fontSize,
    color: Colors.accent.cyan,
  },
  endButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.semantic.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
