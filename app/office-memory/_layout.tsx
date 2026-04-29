import { Stack } from 'expo-router';

export default function OfficeMemoryLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'card',
      }}
    />
  );
}
