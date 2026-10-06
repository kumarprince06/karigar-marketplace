import { useState } from 'react';
import {
  Button,
  CopyId,
  DataTable,
  Field,
  ModalDialog,
  PermTag,
  StatusChip,
  Textarea,
  type Column,
} from '@/components/ui';
import { RequirePermission } from '@/features/auth';
import { useUrlDialog } from '@/hooks/useUrlDialog';
import { formatMoney, formatShortId } from '@/lib/formatters';
import { DISPUTE_ACTION_STATUS_CHIP } from '../status-chip-presentation';
import type { ResolvedDispute, ResolvedDisputeAction } from '../types';

/**
 * A-04f. Actions run after the case closes; a failed one goes to the ops queue and never reopens the case.
 * Retry reuses the same idempotency key; Cancel needs a note.
 */
export function ResolvedDisputeActions({ dispute }: { dispute: ResolvedDispute }) {
  const cancelDialog = useUrlDialog('cancel-action');
  const [cancelNote, setCancelNote] = useState('');

  const columns: readonly Column<ResolvedDisputeAction>[] = [
    { id: 'number', header: '#', cell: (action) => dispute.actions.indexOf(action) + 1 },
    { id: 'action', header: 'Action', cell: (action) => <b>{action.type}</b> },
    {
      id: 'detail',
      header: 'Detail',
      cell: (action) => (
        <>
          {action.amountPaise !== undefined && `${formatMoney(action.amountPaise)} `}
          {action.description} <CopyId id={action.referenceId} />
        </>
      ),
    },
    {
      id: 'key',
      header: 'Key',
      cell: (action) => (
        <span className="font-mono text-xs">
          DISPUTE:{formatShortId(dispute.id)}:{dispute.actions.indexOf(action) + 1}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (action) => (
        <StatusChip tone={DISPUTE_ACTION_STATUS_CHIP[action.status].tone}>
          {DISPUTE_ACTION_STATUS_CHIP[action.status].label}
        </StatusChip>
      ),
    },
    { id: 'attempts', header: 'Attempts', cell: (action) => action.attempts },
    {
      id: 'lastError',
      header: 'Last error',
      cell: (action) => action.lastError ?? (action.nextAttemptAt ? `next try ${action.nextAttemptAt}` : '—'),
    },
    {
      id: 'controls',
      header: <span className="sr-only">Actions</span>,
      cell: (action) =>
        action.status === 'FAILED' && (
          <RequirePermission permission="dispute.resolve">
            <div className="flex gap-1">
              <Button size="sm">Retry (same key)</Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => cancelDialog.openDialog({ action: action.id })}
              >
                Cancel…
              </Button>
            </div>
          </RequirePermission>
        ),
    },
  ];

  return (
    <>
      <DataTable
        caption="Dispute actions"
        columns={columns}
        rows={dispute.actions}
        rowKey={(action) => action.id}
      />
      <ModalDialog
        open={cancelDialog.isOpen}
        onClose={cancelDialog.closeDialog}
        title="Cancel this action?"
        aside={<PermTag>dispute.resolve</PermTag>}
        description="The action stops for good and the case stays closed. Ops sees your note."
        footer={
          <>
            <Button variant="secondary" onClick={cancelDialog.closeDialog}>
              Keep action
            </Button>
            <Button variant="danger" disabled={cancelNote.trim() === ''} onClick={cancelDialog.closeDialog}>
              Cancel action
            </Button>
          </>
        }
      >
        <Field label="Note" hint="(required)">
          {({ id }) => (
            <Textarea id={id} value={cancelNote} onChange={(event) => setCancelNote(event.target.value)} />
          )}
        </Field>
      </ModalDialog>
    </>
  );
}
