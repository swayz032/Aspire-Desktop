import { View, type ViewProps } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

function ThemedViewInner({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}

export function ThemedView(props: any) {
  return (
    <PageErrorBoundary pageName="themed-view">
      <ThemedViewInner {...props} />
    </PageErrorBoundary>
  );
}
