import React from 'react';
import { ServiceHubShell } from '@/components/service-hub/ServiceHubShell';
import { ComingSoonStub } from '@/components/service-hub/ComingSoonStub';

export default function ResearchLab() {
  return (
    <ServiceHubShell>
      <ComingSoonStub
        title="Research Lab"
        subtitle="Local market, supplier, code, and competitor research. Coming soon."
        icon="search-outline"
      />
    </ServiceHubShell>
  );
}
