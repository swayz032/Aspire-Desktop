import { Stack } from 'expo-router';

export default function ServiceMemoryLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'card',
      }}
    />
  );
}
