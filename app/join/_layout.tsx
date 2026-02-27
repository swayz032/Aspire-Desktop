/**
 * Join Layout — Public guest join route (NO auth required).
 * External guests access LiveKit conference rooms through this minimal dark layout.
 * No sidebar, no navigation chrome, no Aspire account needed.
 * The join code itself is the auth gate (short-lived, single-room scoped).
 */
import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';

export default function JoinLayout() {
  return (
    <View style={styles.container}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0a' } }}>
        <Stack.Screen name="[code]" />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
});
