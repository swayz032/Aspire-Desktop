import React from 'react';
import TermsScreen from './more/terms';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

function TermsRedirectContent() {
  return <TermsScreen />;
}

export default function TermsRedirect() {
  return (
    <PageErrorBoundary pageName="terms">
      <TermsRedirectContent />
    </PageErrorBoundary>
  );
}
