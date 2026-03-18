import { FinanceHubShell } from '@/components/finance/FinanceHubShell';
import { CashPositionContent } from '@/components/finance/CashPositionContent';
import { CARD_BG, CARD_BORDER, svgPatterns } from '@/constants/cardPatterns';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

function CashContent() {
  return (
    <FinanceHubShell>
      <CashPositionContent />
    </FinanceHubShell>
  );
}


export default function CashScreen() {
  return (
    <PageErrorBoundary pageName="finance-cash">
      <CashContent />
    </PageErrorBoundary>
  );
}
