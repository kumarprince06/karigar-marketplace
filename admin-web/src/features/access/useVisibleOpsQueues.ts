import { useSession } from '@/features/auth';
import { OPS_QUEUE_SUMMARIES } from './mock-data';

/** Queues the caller holds the view permission for (LLD-020 §3.3). Hidden queues are not rendered at all. */
export function useVisibleOpsQueues() {
  const { session } = useSession();
  return OPS_QUEUE_SUMMARIES.filter((queue) => session.permissions.has(queue.viewPermission));
}
