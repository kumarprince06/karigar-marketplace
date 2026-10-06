import { Link } from 'react-router';
import { paths } from '@/config/route-paths';
import { formatShortId } from '@/lib/formatters';
import type { PaymentSubject } from '../types';

/** "job …e81c27", "req …3c88d5" or "worker Rinku Paul", linked to where that record lives. */
export function PaymentSubjectLink({ subject }: { subject: PaymentSubject }) {
  const linkClassName = 'text-fg-muted hover:text-primary whitespace-nowrap underline';
  if (subject.kind === 'worker')
    return (
      <Link to={paths.worker(subject.id)} className={linkClassName}>
        worker {subject.name}
      </Link>
    );
  return (
    <Link
      to={subject.kind === 'booking' ? paths.booking(subject.id) : paths.requests}
      className={`${linkClassName} font-mono text-xs`}
    >
      {subject.kind === 'booking' ? 'job' : 'req'} {formatShortId(subject.id)}
    </Link>
  );
}
