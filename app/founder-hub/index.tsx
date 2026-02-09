import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

export default function FounderHubIndex() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/founder-hub/daily-brief' as any);
  }, []);
  
  return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
}
