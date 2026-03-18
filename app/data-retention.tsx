import React from 'react';
import DataRetentionScreen from './more/data-retention';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

function DataRetentionRedirectContent() {
  return <DataRetentionScreen />;
}

export default function DataRetentionRedirect() {
  return (
    <PageErrorBoundary pageName="data-retention">
      <DataRetentionRedirectContent />
    </PageErrorBoundary>
  );
}
