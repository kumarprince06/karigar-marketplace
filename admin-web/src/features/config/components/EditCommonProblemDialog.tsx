import { ModalDialog, PermTag } from '@/components/ui';
import type { CommonProblem, TradeDetail } from '../types';
import { EditCommonProblemForm } from './EditCommonProblemForm';

interface EditCommonProblemDialogProps {
  open: boolean;
  onClose: () => void;
  tradeName: string;
  trade: TradeDetail;
  problem: CommonProblem;
}

/** A-06b. The form mounts on open, so its state starts from the problem every time. */
export function EditCommonProblemDialog({
  open,
  onClose,
  tradeName,
  trade,
  problem,
}: EditCommonProblemDialogProps) {
  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      size="xl"
      title={`${tradeName} › ${problem.titles.en ?? problem.code}`}
      aside={<PermTag>catalog.manage</PermTag>}
      description="Changes reach the apps within 5 minutes (catalog cache TTL)."
    >
      <EditCommonProblemForm trade={trade} problem={problem} onClose={onClose} />
    </ModalDialog>
  );
}
