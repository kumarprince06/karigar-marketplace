import { useNavigate, useSearchParams } from 'react-router';
import { paths } from '@/config/route-paths';
import { readSafeRedirectPath, useSession, withRedirectParam } from '@/features/auth';

/** Moves between sign-in steps, keeping ?redirectTo= and never following an unsafe redirect. */
export function useSignInNavigation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeSignIn, signOut } = useSession();

  const goToMfaStep = () => navigate(withRedirectParam(paths.mfaVerify, searchParams));

  const finishSignIn = () => {
    completeSignIn();
    navigate(readSafeRedirectPath(searchParams), { replace: true });
  };

  const logOut = () => {
    signOut();
    navigate(paths.login);
  };

  return { goToMfaStep, finishSignIn, logOut };
}
