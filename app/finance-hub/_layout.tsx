import { Stack } from 'expo-router';

export default function FinanceHubLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="cash" />
      <Stack.Screen name="books" />
      <Stack.Screen name="payroll" />
      <Stack.Screen name="invoices" />
      <Stack.Screen name="quotes" />
      <Stack.Screen name="clients" />
      <Stack.Screen name="connections" />
      <Stack.Screen name="receipts" />
      <Stack.Screen name="finn" />
    </Stack>
  );
}
