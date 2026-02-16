import { Stack } from 'expo-router';

export default function OfficeStoreLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'card',
      }}
    />
  );
}
