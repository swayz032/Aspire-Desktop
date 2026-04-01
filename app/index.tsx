import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import LandingNav from '@/components/landing/LandingNav';
import HeroSection from '@/components/landing/HeroSection';
import HowItWorks from '@/components/landing/HowItWorks';
import FeatureSection from '@/components/landing/FeatureSection';
import FeaturesGrid from '@/components/landing/FeaturesGrid';
import MeetTheTeam from '@/components/landing/MeetTheTeam';
import PricingCTA from '@/components/landing/PricingCTA';
import LandingFooter from '@/components/landing/LandingFooter';
import { features } from '@/components/landing/FeaturesData';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

function IndexContent() {
  // If user has a session, skip landing and go to homepage
  const { useSupabase } = require('@/providers');
  const { session, isLoading } = useSupabase();
  const router = require('expo-router').useRouter();
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (session) {
      router.replace('/(tabs)');
    } else {
      setShowLanding(true);
    }
  }, [session, isLoading]);

  // Only modify DOM styles when we're actually showing the landing page
  // NOT when redirecting to /(tabs) — that causes the homepage to stretch
  useEffect(() => {
    if (Platform.OS !== 'web' || !showLanding) return;
    const body = document.body;
    const html = document.documentElement;
    const root = document.getElementById('root');
    body.style.overflow = 'auto';
    body.style.height = 'auto';
    html.style.overflow = 'auto';
    html.style.height = 'auto';
    if (root) {
      root.style.overflow = 'visible';
      root.style.height = 'auto';
      root.style.minHeight = '100vh';
      root.style.display = 'block';
    }
    const scrollStyle = document.createElement('style');
    scrollStyle.id = 'hide-scrollbar';
    scrollStyle.textContent = `::-webkit-scrollbar{display:none}html,body{-ms-overflow-style:none;scrollbar-width:none}`;
    document.head.appendChild(scrollStyle);
    return () => {
      document.getElementById('hide-scrollbar')?.remove();
      // Reset to neutral — don't set app-mode styles here.
      // DesktopHome's useEffect handles setting overflow:hidden + height:100%.
      // Setting them here causes a race condition where this cleanup
      // fires AFTER DesktopHome mounts, overriding its styles.
      body.style.overflow = '';
      body.style.height = '';
      html.style.overflow = '';
      html.style.height = '';
      if (root) {
        root.style.overflow = '';
        root.style.height = '';
        root.style.minHeight = '';
        root.style.display = '';
      }
    };
  }, [showLanding]);

  if (Platform.OS !== 'web' || !showLanding) {
    return null;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <div data-testid="smoke-landing-root" style={{
        minHeight: '100vh',
        background: '#050508',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
        overflowX: 'hidden',
      }}>
        <LandingNav />
        <HeroSection />
        <HowItWorks />
        {features.map((feature, i) => (
          <FeatureSection key={feature.id} feature={feature} index={i} />
        ))}
        <FeaturesGrid />
        <MeetTheTeam />
        <PricingCTA />
        <LandingFooter />
      </div>
    </>
  );
}

export default function Index() {
  return (
    <PageErrorBoundary pageName="root-index">
      <IndexContent />
    </PageErrorBoundary>
  );
}
