import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface ComingSoonStubProps {
  title: string;
  subtitle?: string;
  icon?: IoniconsName;
}

function ComingSoonStubInner({ title, subtitle, icon = 'construct-outline' }: ComingSoonStubProps) {
  return (
    <View style={styles.container} testID={`service-hub-coming-soon-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <View style={styles.iconWrapper}>
        <Ionicons name={icon} size={28} color="rgba(255,255,255,0.4)" />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle || 'Coming soon. Tim will operate this page.'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    maxWidth: 360,
    lineHeight: 19,
  },
});

export function ComingSoonStub(props: ComingSoonStubProps) {
  return (
    <PageErrorBoundary pageName={`service-hub-coming-soon-${props.title}`}>
      <ComingSoonStubInner {...props} />
    </PageErrorBoundary>
  );
}
