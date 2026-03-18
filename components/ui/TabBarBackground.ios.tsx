import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

function BlurTabBarBackgroundInner() {
  return (
    <BlurView
      // System chrome material automatically adapts to the system's theme
      // and matches the native tab bar appearance on iOS.
      tint="systemChromeMaterial"
      intensity={100}
      style={StyleSheet.absoluteFill}
    />
  );
}

export function useBottomTabOverflow() {
  return useBottomTabBarHeight();
}

export default function BlurTabBarBackground(props: any) {
  return (
    <PageErrorBoundary pageName="tab-bar-background.ios">
      <BlurTabBarBackgroundInner {...props} />
    </PageErrorBoundary>
  );
}
