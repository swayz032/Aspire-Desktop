import React, { useEffect } from 'react';
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
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function Index() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const body = document.body;
    const html = document.documentElement;
    const root = document.getElementById('root');
    const prev = {
      bodyOverflow: body.style.overflow,
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      bodyHeight: body.style.height,
      rootOverflow: root?.style.overflow ?? '',
      rootHeight: root?.style.height ?? '',
      rootDisplay: root?.style.display ?? '',
    };
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
    return (
    ) => {
      document.getElementById('hide-scrollbar')?.remove();
      body.style.overflow = prev.bodyOverflow;
      body.style.height = prev.bodyHeight;
      html.style.overflow = prev.htmlOverflow;
      html.style.height = prev.htmlHeight;
      if (root) {
        root.style.overflow = prev.rootOverflow;
        root.style.height = prev.rootHeight;
        root.style.display = prev.rootDisplay;
      }
    };
  }, []);

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <ErrorBoundary routeName="Index">
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <div style={{
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
      </ErrorBoundary>
  );
}
