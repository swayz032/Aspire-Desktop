import { FinanceHubShell } from '@/components/finance/FinanceHubShell';
import { CashPositionContent } from '@/components/finance/CashPositionContent';
import { CARD_BG, CARD_BORDER, svgPatterns } from '@/constants/cardPatterns';

export default function CashScreen() {
  return (
    <FinanceHubShell>
      <CashPositionContent />
    </FinanceHubShell>
  );
}
