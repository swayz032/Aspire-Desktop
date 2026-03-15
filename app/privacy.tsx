import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import PrivacyPolicyScreen from './more/privacy-policy';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function PrivacyRedirect() {
  return (<ErrorBoundary routeName="PrivacyRedirect"><PrivacyPolicyScreen /></ErrorBoundary>);
}
