import React from 'react';
import { ServiceHubShell } from '@/components/service-hub/ServiceHubShell';
import { ComingSoonStub } from '@/components/service-hub/ComingSoonStub';

export default function Scheduling() {
  return (
    <ServiceHubShell>
      <ComingSoonStub
        title="Scheduling"
        subtitle="Calendar, crews, routes, time and resource allocation. Coming soon."
        icon="calendar-outline"
      />
    </ServiceHubShell>
  );
}
