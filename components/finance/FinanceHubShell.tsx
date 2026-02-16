import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { DesktopHeader } from '@/components/desktop/DesktopHeader';
import { FinanceSidebar } from './FinanceSidebar';
import { Colors } from '@/constants/tokens';

type Props = {
  children: React.ReactNode;
  rightRail?: React.ReactNode;
};

export function FinanceHubShell({ children, rightRail }: Props) {
  return (
    <View style={styles.container}>
      <FinanceSidebar />
      <View style={styles.rightSection}>
        <DesktopHeader />
        <View style={styles.content}>
          <View style={styles.mainArea}>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </View>
          {rightRail && (
            <View style={styles.rightRail}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {rightRail}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background.primary,
  },
  rightSection: {
    flex: 1,
    flexDirection: 'column',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background.primary,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  mainArea: {
    flex: 1,
  },
  rightRail: {
    width: 300,
    borderLeftWidth: 1,
    borderLeftColor: Colors.background.tertiary,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 64,
  },
});
