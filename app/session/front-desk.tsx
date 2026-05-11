import React from 'react';
import { FrontDeskShell } from '@/components/front-desk/FrontDeskShell';
import { FrontDeskHubSkeleton } from '@/components/front-desk/FrontDeskHubSkeleton';

export default function FrontDeskRoute() {
  return (
    <FrontDeskShell>
      <FrontDeskHubSkeleton />
    </FrontDeskShell>
  );
}
