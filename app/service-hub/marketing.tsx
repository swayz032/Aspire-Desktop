import React from 'react';
import { ServiceHubShell } from '@/components/service-hub/ServiceHubShell';
import { ComingSoonStub } from '@/components/service-hub/ComingSoonStub';

export default function Marketing() {
  return (
    <ServiceHubShell>
      <ComingSoonStub
        title="Marketing"
        subtitle="Local Ads, Instant Site, and demand generation. Coming soon."
        icon="megaphone-outline"
      />
    </ServiceHubShell>
  );
}
