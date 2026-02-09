import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { PageHeader } from '@/components/PageHeader';
import { Ionicons } from '@expo/vector-icons';
import { useDesktop } from '@/lib/useDesktop';
import { DesktopPageWrapper } from '@/components/desktop/DesktopPageWrapper';
import { CashPositionContent } from '@/components/finance/CashPositionContent';

export default function CashPositionScreen() {
  const insets = useSafeAreaInsets();
  const isDesktop = useDesktop();

  const content = (
    <>
      {!isDesktop && <PageHeader title="Cash Position" showBackButton />}
      <CashPositionContent />
      {!isDesktop && (
        <View style={[styles.floatingActions, { paddingBottom: insets.bottom + Spacing.md }]}>
          <TouchableOpacity style={styles.primaryButton}>
            <Ionicons name="swap-horizontal" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Transfer Funds</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton}>
            <Ionicons name="sync" size={18} color={Colors.accent.cyan} />
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  if (isDesktop) {
    return (
      <DesktopPageWrapper scrollable={false}>
        <View style={styles.container}>
          {content}
        </View>
      </DesktopPageWrapper>
    );
  }

  return (
    <View style={styles.container}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  floatingActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    backgroundColor: Colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.accent.cyan,
    borderRadius: BorderRadius.lg,
  },
  primaryButtonText: {
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
});
