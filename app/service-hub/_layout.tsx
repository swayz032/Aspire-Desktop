import { Stack } from 'expo-router';

export default function ServiceHubLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="service-lab" />
      <Stack.Screen name="research-lab" />
      <Stack.Screen name="estimate-studio" />
      <Stack.Screen name="marketing" />
      <Stack.Screen name="jobs" />
      <Stack.Screen name="scheduling" />
      <Stack.Screen name="contracts" />
      <Stack.Screen name="documents" />
      <Stack.Screen name="memory" />
    </Stack>
  );
}
