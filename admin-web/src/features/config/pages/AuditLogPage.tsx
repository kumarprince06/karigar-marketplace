import { Calendar, Fingerprint } from 'lucide-react';
import { Fragment, useState } from 'react';
import { CopyId, Input, Select } from '@/components/ui';
import { formatDateTime } from '@/lib/formatters';
import { mergeClassNames } from '@/lib/merge-class-names';
import { JsonPayloadBlock } from '../components/JsonPayloadBlock';
import { AUDIT_EVENTS } from '../operations-mock-data';
import { STAFF_MEMBERS } from '../staff-and-settings-mock-data';

const ENTITY_TYPES = ['WORKER', 'WORKER_VERIFICATION', 'USER', 'BOOKING', 'PAYMENT'];
const ACTIONS = [...new Set(AUDIT_EVENTS.map((event) => event.action))];
const COLUMN_HEADERS = ['When', 'Actor', 'Action', 'Entity', 'Reason', 'Note', 'Request'];

const headerCellClassName =
  'border-border bg-muted text-fg-muted border-b px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap';
const bodyCellClassName = 'px-3 py-2.5 align-middle';

/**
 * A-06f audit log (LLD-020). Append-only. Each row expands to show its metadata.
 * Hand-built table because DataTable has no expandable detail rows.
 */
export function AuditLogPage() {
  const [expandedEventId, setExpandedEventId] = useState<string | null>(AUDIT_EVENTS[0]?.id ?? null);
  const [entityTypeFilter, setEntityTypeFilter] = useState('WORKER');
  const [entityIdFilter, setEntityIdFilter] = useState('…8c03d2');
  const [actorFilter, setActorFilter] = useState('ANY');
  const [actionFilter, setActionFilter] = useState('ANY');
  const [dateRangeFilter, setDateRangeFilter] = useState('7 Sep – 6 Oct');

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Entity type"
          className="w-full sm:w-[190px]"
          value={entityTypeFilter}
          onChange={(event) => setEntityTypeFilter(event.target.value)}
        >
          {ENTITY_TYPES.map((entityType) => (
            <option key={entityType} value={entityType}>
              Entity: {entityType}
            </option>
          ))}
        </Select>
        <Input
          leading={<Fingerprint aria-hidden className="size-4" />}
          aria-label="Entity id"
          className="w-full sm:w-[200px]"
          value={entityIdFilter}
          onChange={(event) => setEntityIdFilter(event.target.value)}
        />
        <Select
          aria-label="Actor"
          className="w-full sm:w-[200px]"
          value={actorFilter}
          onChange={(event) => setActorFilter(event.target.value)}
        >
          <option value="ANY">Actor: any staff</option>
          {STAFF_MEMBERS.map((staffMember) => (
            <option key={staffMember.id} value={staffMember.id}>
              Actor: {staffMember.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Action"
          className="w-full sm:w-[220px]"
          value={actionFilter}
          onChange={(event) => setActionFilter(event.target.value)}
        >
          <option value="ANY">Action: any</option>
          {ACTIONS.map((action) => (
            <option key={action} value={action}>
              Action: {action}
            </option>
          ))}
        </Select>
        <Input
          leading={<Calendar aria-hidden className="size-4" />}
          aria-label="Date range (at most 31 days)"
          className="w-full sm:w-[220px]"
          value={dateRangeFilter}
          onChange={(event) => setDateRangeFilter(event.target.value)}
          trailing={<span className="text-fg-muted text-xs whitespace-nowrap">≤ 31 days</span>}
        />
      </div>

      <div
        role="region"
        aria-label="Audit events"
        // A scrollable region must be reachable by keyboard (axe scrollable-region-focusable).
        tabIndex={0}
        className="border-border bg-surface overflow-x-auto rounded-lg border"
      >
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Audit events, newest first</caption>
          <thead>
            <tr>
              {COLUMN_HEADERS.map((header) => (
                <th key={header} scope="col" className={headerCellClassName}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AUDIT_EVENTS.map((auditEvent) => {
              const isExpanded = auditEvent.id === expandedEventId;
              return (
                <Fragment key={auditEvent.id}>
                  <tr
                    className={mergeClassNames(
                      'border-border border-b last:border-b-0',
                      isExpanded && 'bg-primary-subtle border-b-0',
                    )}
                  >
                    <td className={bodyCellClassName}>
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedEventId(isExpanded ? null : auditEvent.id)}
                        className="hover:text-primary cursor-pointer text-left whitespace-nowrap"
                      >
                        {formatDateTime(auditEvent.occurredAt)}
                        <span className="sr-only"> — {isExpanded ? 'hide' : 'show'} metadata</span>
                      </button>
                    </td>
                    <td className={bodyCellClassName}>{auditEvent.actorName}</td>
                    <td className={mergeClassNames(bodyCellClassName, 'font-mono text-[13px]')}>
                      {auditEvent.action}
                    </td>
                    <td className={mergeClassNames(bodyCellClassName, 'whitespace-nowrap')}>
                      {auditEvent.entityType} <CopyId id={auditEvent.entityId} />
                    </td>
                    <td className={bodyCellClassName}>{auditEvent.reasonCode ?? '—'}</td>
                    <td className={bodyCellClassName}>{auditEvent.note ?? '—'}</td>
                    <td className={bodyCellClassName}>
                      {auditEvent.requestId ? (
                        <CopyId id={auditEvent.requestId} />
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-border border-b last:border-b-0">
                      <td colSpan={COLUMN_HEADERS.length} className="px-3 pb-3">
                        <JsonPayloadBlock
                          value={auditEvent.metadata}
                          label={`Metadata for ${auditEvent.action}`}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-fg-muted flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
        <span>50 per page · newest first · append-only (no edit, no delete) · no export</span>
        <span>Metadata holds ids and masked values only</span>
      </div>
    </>
  );
}
