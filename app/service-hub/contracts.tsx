import React from 'react';
import { ServiceHubShell } from '@/components/service-hub/ServiceHubShell';
import { ComingSoonStub } from '@/components/service-hub/ComingSoonStub';

export default function Contracts() {
  return (
    <ServiceHubShell>
      <ComingSoonStub
        title="Contracts"
        subtitle="Templates, drafts, signed contracts, and archive. Coming soon."
        icon="document-text-outline"
      />
    </ServiceHubShell>
  );
}
