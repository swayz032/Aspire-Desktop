import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { useMicState } from '@/providers';

interface HapticTabProps extends BottomTabBarButtonProps {
  isMicTab?: boolean;
}

export function HapticTab(props: HapticTabProps) {
  const { isMicTab, ...restProps } = props;
  const { toggleListening } = useMicState();

  return (
    <PlatformPressable
      {...restProps}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
      onPress={(ev) => {
        if (isMicTab) {
          if (process.env.EXPO_OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          toggleListening();
        } else {
          props.onPress?.(ev);
        }
      }}
    />
  );
}
