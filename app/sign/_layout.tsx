/**
 * Sign Layout — Public signing route (NO auth required).
 * External signers access PandaDoc documents through this minimal dark layout.
 * No sidebar, no navigation chrome, no Aspire account needed.
 */
import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';

export default function SignLayout() {
  return (
    <View style={styles.container}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0a' } }}>
        <Stack.Screen name="[token]" />
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
