import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { replaceTo } from '@/lib/navigation';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function FounderHubIndex() {
  const router = useRouter();

  useEffect(() => {
    replaceTo('/founder-hub/daily-brief');
  }, []);
  
  return (<ErrorBoundary routeName="FounderHubIndex"><View style={{ flex: 1, backgroundColor: '#000000' }} /></ErrorBoundary>);
}
