import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, SectionLabel, Select, StatusChip } from '@/components/ui';
import { ROLES, type Role } from '@/features/auth';
import { formatDayMonth } from '@/lib/formatters';
import { STAFF_STATUS_CHIP } from '../status-chip-styles';
import type { StaffMember } from '../types';

interface StaffMemberPanelProps {
  staffMember: StaffMember;
  /** Every staff change goes through the step-up code dialog first. */
  onRequestStepUp: (actionLabel: string) => void;
}

/** Right rail of A-06g: one person's role grants and account actions. Mount with key={staffMember.id}. */
export function StaffMemberPanel({ staffMember, onRequestStepUp }: StaffMemberPanelProps) {
  const grantableRoles = ROLES.filter((role) => !staffMember.grants.some((grant) => grant.role === role));
  const [roleToGrant, setRoleToGrant] = useState<Role | ''>('');
  const statusChip = STAFF_STATUS_CHIP[staffMember.status];

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-h4 font-semibold">{staffMember.name}</h3>
        <StatusChip tone={statusChip.tone}>{statusChip.label}</StatusChip>
      </div>
      <SectionLabel>Role grants (all zones)</SectionLabel>
      {staffMember.grants.length === 0 && <p className="text-fg-subtle text-sm">No active grants.</p>}
      <ul className="flex flex-col gap-1.5">
        {staffMember.grants.map((grant) => (
          <li key={grant.role} className="flex items-center justify-between gap-2 text-sm">
            <StatusChip tone="brand">{grant.role}</StatusChip>
            <span className="text-fg-subtle">
              by {grant.grantedBy} · {formatDayMonth(grant.grantedAt)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-error hover:bg-error-subtle"
              onClick={() => onRequestStepUp(`revoke ${grant.role}`)}
            >
              Revoke<span className="sr-only"> {grant.role}</span>
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Select
          aria-label="Role to grant"
          className="min-h-9 flex-1 text-[13px]"
          value={roleToGrant}
          onChange={(event) => setRoleToGrant(event.target.value as Role | '')}
        >
          <option value="">Add role</option>
          {grantableRoles.map((role) => (
            <option key={role}>{role}</option>
          ))}
        </Select>
        <Button
          variant="secondary"
          size="sm"
          disabled={!roleToGrant}
          onClick={() => onRequestStepUp(`grant ${roleToGrant}`)}
        >
          Grant
        </Button>
      </div>
      <hr className="border-border" />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => onRequestStepUp('reset 2-step login')}>
          <KeyRound aria-hidden className="size-4" /> Reset 2-step login
        </Button>
        <Button variant="dangerOutline" size="sm" onClick={() => onRequestStepUp('suspend')}>
          Suspend
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onRequestStepUp('mark as left')}>
          Mark as left
        </Button>
      </div>
      <p className="text-fg-muted text-[13px] leading-[18px]">
        You can&apos;t act on yourself. The last active SUPER_ADMIN can&apos;t be revoked, suspended or marked
        left.
      </p>
    </Card>
  );
}
