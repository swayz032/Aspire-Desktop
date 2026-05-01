/**
 * /_dev/call-room — admin-gated preview route for the Call Room demo.
 *
 * Gated by the platform admin check (email match against the founder account
 * per CLAUDE.md MEMORY). Non-admins are redirected to the home route.
 *
 * Auth pattern discovered: `useSupabase()` from `@/providers/SupabaseProvider`
 * returns `{ session, isLoading, suiteId, signOut }`. The repo has no
 * dedicated admin hook yet; we match the email directly here.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';

import { useSupabase } from '@/providers/SupabaseProvider';
import CallRoomDemo from '@/components/call-room/CallRoom.demo';

// Founder login for the Aspire desktop frontend. (The admin-portal uses tonioswayz32@gmail.com — different surface.)
const PLATFORM_ADMIN_EMAIL = 'tonioscott58@yahoo.com';

export default function CallRoomDevRoute(): React.ReactElement {
  const { session, isLoading } = useSupabase();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#fff" />
      </View>
    );
  }

  const email = session?.user?.email ?? null;
  const isPlatformAdmin = email === PLATFORM_ADMIN_EMAIL;

  if (!session || !isPlatformAdmin) {
    return <Redirect href="/" />;
  }

  return (
    <>
      {/* Hide the route header — Call Room is pure immersive (office + floating card only) */}
      <Stack.Screen options={{ headerShown: false, title: '' }} />
      <CallRoomDemo />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
