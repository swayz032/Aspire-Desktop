import { Stack } from 'expo-router';

export default function FounderHubLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="daily-brief" />
      <Stack.Screen name="pulse" />
      <Stack.Screen name="library" />
      <Stack.Screen name="studio" />
      <Stack.Screen name="notes" />
      <Stack.Screen name="templates" />
      <Stack.Screen name="masterminds" />
      <Stack.Screen name="saved" />
    </Stack>
  );
}
