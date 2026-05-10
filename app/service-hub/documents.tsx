import React from 'react';
import { ServiceHubShell } from '@/components/service-hub/ServiceHubShell';
import { ComingSoonStub } from '@/components/service-hub/ComingSoonStub';

export default function Documents() {
  return (
    <ServiceHubShell>
      <ComingSoonStub
        title="Documents"
        subtitle="Plans, PDFs, photos, contracts, proposals, receipts, exports. Coming soon."
        icon="folder-outline"
      />
    </ServiceHubShell>
  );
}
