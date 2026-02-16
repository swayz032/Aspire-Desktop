import { Stack } from 'expo-router';

export default function TeamWorkspaceLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'card',
      }}
    />
  );
}
