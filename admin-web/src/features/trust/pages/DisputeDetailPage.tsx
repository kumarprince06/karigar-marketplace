import { useParams } from 'react-router';
import { OpenDisputeInvestigation } from '../components/OpenDisputeInvestigation';
import { ResolvedDisputeOverview } from '../components/ResolvedDisputeOverview';
import { findDispute } from '../mock-data';

/** A-04e for open cases, A-04f once RESOLVED. Unknown ids fall back to the open demo case. */
export function DisputeDetailPage() {
  const { id } = useParams();
  const dispute = findDispute(id);
  return dispute.status === 'RESOLVED' ? (
    <ResolvedDisputeOverview dispute={dispute} />
  ) : (
    <OpenDisputeInvestigation dispute={dispute} />
  );
}
