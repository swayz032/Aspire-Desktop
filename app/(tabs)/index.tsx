import React from 'react';
import { DesktopHome } from '@/components/desktop/DesktopHome';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

function HomeContent() {
  return <DesktopHome />;
}


export default function HomeScreen() {
  return (
    <PageErrorBoundary pageName="home">
      <HomeContent />
    </PageErrorBoundary>
  );
}
