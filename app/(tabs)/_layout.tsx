import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';

import { HapticTab } from '@/components/HapticTab';
import { MicTabIcon } from '@/components/MicTabIcon';

export default function TabLayout() {
  // Desktop-only mode: Always hide the tab bar
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.semantic.warning,
        tabBarInactiveTintColor: Colors.text.primary,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: { display: 'none' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Ionicons name="home-sharp" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color }) => (
            <View>
              <Ionicons name="mail-sharp" size={24} color={color} />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>5</Text>
              </View>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="mic"
        options={{
          title: '',
          tabBarButton: (props) => <HapticTab {...props} isMicTab={true} />,
          tabBarIcon: () => <MicTabIcon />,
        }}
      />
      <Tabs.Screen
        name="receipts"
        options={{
          title: 'Receipts',
          tabBarIcon: ({ color }) => <Ionicons name="document-text-sharp" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <Ionicons name="ellipsis-horizontal" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -6,
    top: -2,
    backgroundColor: Colors.accent.cyan,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    color: Colors.background.primary,
    fontSize: 10,
    fontWeight: 'bold',
  },
});
