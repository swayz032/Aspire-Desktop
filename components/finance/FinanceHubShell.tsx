import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { DesktopHeader } from '@/components/desktop/DesktopHeader';
import { FinanceSidebar } from './FinanceSidebar';
import { Colors } from '@/constants/tokens';

type Props = {
  children: React.ReactNode;
};

export function FinanceHubShell({ children }: Props) {
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 64,
  },
});
