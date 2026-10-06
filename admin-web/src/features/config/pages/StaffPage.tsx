import { Check } from 'lucide-react';
import { useState } from 'react';
import { Button, DataTable, Masked, StatusChip, type Column } from '@/components/ui';
import { RequirePermission, useSession } from '@/features/auth';
import { useUrlDialog } from '@/hooks/useUrlDialog';
import { StaffAndRolesTabs } from '../components/StaffAndRolesTabs';
import { StaffMemberPanel } from '../components/StaffMemberPanel';
import { StepUpCodeDialog } from '../components/StepUpCodeDialog';
import { STAFF_MEMBERS } from '../staff-and-settings-mock-data';
import { STAFF_MFA_STATE_CHIP, STAFF_STATUS_CHIP } from '../status-chip-styles';
import type { StaffMember } from '../types';

const DEFAULT_SELECTED_STAFF_ID = STAFF_MEMBERS.find((staffMember) => staffMember.name === 'Kabir Ali')!.id;

/** A-06g staff (admin users). Every change asks for a fresh authenticator code (?dialog=step-up&action=…). */
export function StaffPage() {
  const { session } = useSession();
  const stepUpDialog = useUrlDialog('step-up');
  const [selectedStaffId, setSelectedStaffId] = useState(DEFAULT_SELECTED_STAFF_ID);
  const selectedStaffMember =
    STAFF_MEMBERS.find((staffMember) => staffMember.id === selectedStaffId) ?? STAFF_MEMBERS[0]!;

  const staffColumns: Column<StaffMember>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (staffMember) => (
        <>
          <button
            type="button"
            aria-current={staffMember.id === selectedStaffMember.id ? 'true' : undefined}
            onClick={() => setSelectedStaffId(staffMember.id)}
            className="hover:text-primary cursor-pointer text-left font-bold"
          >
            {staffMember.name}
          </button>
          {staffMember.name === session.name && <span className="text-fg-subtle"> (you)</span>}
        </>
      ),
    },
    { id: 'email', header: 'Email', cell: (staffMember) => <Masked>{staffMember.maskedEmail}</Masked> },
    {
      id: 'roles',
      header: 'Roles',
      cell: (staffMember) =>
        staffMember.grants.length === 0 ? (
          <span className="text-fg-subtle">grants revoked</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {staffMember.grants.map((grant) => (
              <StatusChip
                key={grant.role}
                tone={
                  staffMember.status !== 'ACTIVE'
                    ? 'neutral'
                    : grant.role === 'SUPER_ADMIN'
                      ? 'accent'
                      : 'brand'
                }
              >
                {grant.role}
              </StatusChip>
            ))}
          </span>
        ),
    },
    {
      id: 'mfa',
      header: '2-step login',
      cell: (staffMember) =>
        staffMember.mfaState === 'WIPED' ? (
          <span className="text-fg-subtle">secret wiped</span>
        ) : (
          <StatusChip tone={STAFF_MFA_STATE_CHIP[staffMember.mfaState].tone}>
            {staffMember.mfaState === 'ENROLLED' && <Check aria-hidden className="size-3.5" />}
            {STAFF_MFA_STATE_CHIP[staffMember.mfaState].label}
          </StatusChip>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (staffMember) => (
        <span className="whitespace-nowrap">
          <StatusChip tone={STAFF_STATUS_CHIP[staffMember.status].tone}>
            {STAFF_STATUS_CHIP[staffMember.status].label}
          </StatusChip>
          {!staffMember.passwordSet && <span className="text-fg-subtle text-sm"> password not set</span>}
        </span>
      ),
    },
  ];

  return (
    <>
      <StaffAndRolesTabs
        aside={
          <RequirePermission permission="staff.manage">
            <Button size="sm">+ Add staff member</Button>
          </RequirePermission>
        }
      />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <DataTable
          caption="Staff members"
          className="min-w-0 xl:flex-1"
          columns={staffColumns}
          rows={STAFF_MEMBERS}
          rowKey={(staffMember) => staffMember.id}
          rowClassName={(staffMember) =>
            staffMember.id === selectedStaffMember.id ? 'bg-primary-subtle' : undefined
          }
        />
        <aside className="flex flex-col gap-3 xl:w-[360px] xl:shrink-0">
          <RequirePermission permission="staff.manage">
            <StaffMemberPanel
              key={selectedStaffMember.id}
              staffMember={selectedStaffMember}
              onRequestStepUp={(actionLabel) => stepUpDialog.openDialog({ action: actionLabel })}
            />
          </RequirePermission>
        </aside>
      </div>
      <StepUpCodeDialog
        open={stepUpDialog.isOpen}
        onClose={stepUpDialog.closeDialog}
        actionLabel={stepUpDialog.params.get('action') ?? 'revoke SUPPORT_AGENT'}
      />
    </>
  );
}
