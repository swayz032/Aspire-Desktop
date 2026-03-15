import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { replaceTo } from '@/lib/navigation';

export default function FounderHubIndex() {
  const router = useRouter();

  useEffect(() => {
    replaceTo('/founder-hub/daily-brief');
  }, []);
  
  return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
}
