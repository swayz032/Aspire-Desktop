/**
 * PageErrorBoundary — per-page error boundary with incident reporting.
 *
 * Catches render errors in a specific page and reports them to the
 * backend incident table via errorReporter. Shows a retry UI instead
 * of a white screen.
 *
 * Law #2: Receipt for All — page crashes produce incident reports.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { reportError } from '@/lib/errorReporter';
import { Colors } from '@/constants/tokens';

interface PageErrorBoundaryProps {
  pageName: string;
  children: React.ReactNode;
}

interface PageErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends React.Component<
  PageErrorBoundaryProps,
  PageErrorBoundaryState
> {
  state: PageErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): Partial<PageErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    reportError({
      title: `Page crash: ${this.props.pageName}`,
      severity: 'sev2',
      component: this.props.pageName,
      stackTrace: (info.componentStack || error.stack || '').substring(0, 4000),
      errorCode: 'PAGE_CRASH',
      message: error.message,
      fingerprint: `desktop:page_crash:${this.props.pageName}:${error.message?.substring(0, 50)}`,
    });
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container} accessibilityRole="alert">
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <Pressable
            style={styles.retryButton}
            onPress={this.handleRetry}
            accessibilityLabel="Try again"
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Colors.background.primary,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E53E3E',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: Colors.text.muted,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 400,
  },
  retryButton: {
    backgroundColor: Colors.surface.card,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: Colors.text.primary,
    fontWeight: '600',
  },
});
