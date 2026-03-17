import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

export default function WrappedFounderHubIndex() {
  return (
    <PageErrorBoundary pageName="founder-hub">
      <FounderHubIndex />
    </PageErrorBoundary>
  );
}

function FounderHubIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/founder-hub/daily-brief' as any);
  }, []);

  return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
}
