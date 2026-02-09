import { Stack } from 'expo-router';
import { Colors } from '@/constants/tokens';

export default function SessionLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background.primary },
      }}
    />
  );
}
