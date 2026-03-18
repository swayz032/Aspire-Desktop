import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import PrivacyPolicyScreen from './more/privacy-policy';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

function PrivacyRedirectContent() {
  return <PrivacyPolicyScreen />;
}

export default function PrivacyRedirect() {
  return (
    <PageErrorBoundary pageName="privacy">
      <PrivacyRedirectContent />
    </PageErrorBoundary>
  );
}
