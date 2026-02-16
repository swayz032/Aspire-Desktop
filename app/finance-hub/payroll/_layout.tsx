import { Stack } from 'expo-router';

export default function PayrollLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="people" />
      <Stack.Screen name="contractors" />
      <Stack.Screen name="time-off" />
      <Stack.Screen name="tax-compliance" />
      <Stack.Screen name="pay-history" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
