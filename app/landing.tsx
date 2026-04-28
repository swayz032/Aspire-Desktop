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
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

function LandingContent() {
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
    scrollStyle.id = 'landing-layout-fixes';
    scrollStyle.textContent = `
      ::-webkit-scrollbar{display:none}
      html,body{-ms-overflow-style:none;scrollbar-width:none}
      [data-testid="smoke-landing-root"]>section:first-of-type>div{
        box-sizing:border-box!important;
        padding-left:clamp(20px,4vw,48px)!important;
        padding-right:clamp(20px,4vw,48px)!important;
      }
      [data-testid="smoke-landing-root"]>section:first-of-type>div>div:nth-of-type(4){
        max-width:1080px!important;
        margin-left:auto!important;
        margin-right:auto!important;
        display:flex!important;
        justify-content:center!important;
        box-sizing:border-box!important;
      }
      [data-testid="smoke-landing-root"]>section:first-of-type>div>div:nth-of-type(4)>div:nth-child(2){
        display:flex!important;
        justify-content:center!important;
      }
      [data-testid="smoke-landing-root"]>section:first-of-type>div>div:nth-of-type(4)>div:nth-child(2)>div{
        width:100%!important;
      }
      [data-testid="smoke-landing-root"]>section:first-of-type>div>div:nth-of-type(4)>div:nth-child(2)>div>div{
        max-width:100%!important;
        box-sizing:border-box!important;
      }
      [data-testid="smoke-landing-root"]>section:first-of-type>div>div:nth-of-type(4)>div:nth-child(2)>div>div>div:nth-child(2){
        width:100%!important;
        height:clamp(420px,52vw,620px)!important;
      }
      [data-testid="smoke-landing-root"]>section:first-of-type>div>div:nth-of-type(4)>div:nth-child(2)>div>div>div:nth-child(2)>div:first-child{
        left:clamp(-430px,calc((1440px - 100vw) * 0.38),0px)!important;
      }
      #product{
        padding:clamp(72px,8vw,120px) clamp(20px,5vw,80px)!important;
      }
      #product>div{
        width:100%!important;
        box-sizing:border-box!important;
      }
      #product>div>div:last-child{
        grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))!important;
        gap:28px 24px!important;
        align-items:stretch!important;
      }
      #product>div>div:last-child>div{
        display:flex!important;
        min-width:0!important;
      }
      #product>div>div:last-child>div>div{
        width:100%!important;
        height:auto!important;
        min-height:382px!important;
        box-sizing:border-box!important;
        display:flex!important;
        flex-direction:column!important;
      }
      #product>div>div:last-child>div>div>a{
        margin-top:auto!important;
      }
    `;
    document.head.appendChild(scrollStyle);
    return () => {
      document.getElementById('landing-layout-fixes')?.remove();
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


export default function LandingPage() {
  return (
    <PageErrorBoundary pageName="landing">
      <LandingContent />
    </PageErrorBoundary>
  );
}
