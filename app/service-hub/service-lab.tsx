import React from 'react';
import { ServiceHubShell } from '@/components/service-hub/ServiceHubShell';
import { ComingSoonStub } from '@/components/service-hub/ComingSoonStub';

export default function ServiceLab() {
  return (
    <ServiceHubShell>
      <ComingSoonStub
        title="Service Lab"
        subtitle="Project planning, delivery strategy, and 90-day plans. Coming soon."
        icon="flask-outline"
      />
    </ServiceHubShell>
  );
}
