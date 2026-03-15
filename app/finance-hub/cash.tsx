import { FinanceHubShell } from '@/components/finance/FinanceHubShell';
import { CashPositionContent } from '@/components/finance/CashPositionContent';
import { CARD_BG, CARD_BORDER, svgPatterns } from '@/constants/cardPatterns';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function CashScreen() {
  return (
    <ErrorBoundary routeName="CashScreen">
    <FinanceHubShell>
      <CashPositionContent />
    </FinanceHubShell>
      </ErrorBoundary>
  );
}
