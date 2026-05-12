import React from 'react';
import { ServiceHubShell } from '@/components/service-hub/ServiceHubShell';
import { ComingSoonStub } from '@/components/service-hub/ComingSoonStub';

export default function Memory() {
  return (
    <ServiceHubShell>
      <ComingSoonStub
        title="Memory"
        subtitle="Curated office, project, and Tim memory. Coming soon."
        icon="library-outline"
      />
    </ServiceHubShell>
  );
}
