import { paths } from '@/config/route-paths';

const REDIRECT_PARAM = 'redirectTo';

/** Login URL that remembers where the staff member was going, e.g. /login?redirectTo=%2Fbookings. */
export function buildLoginPathWithRedirect(requestedPath: string): string {
  if (requestedPath === '/' || requestedPath === paths.ops) return paths.login;
  return `${paths.login}?${new URLSearchParams({ [REDIRECT_PARAM]: requestedPath })}`;
}

/**
 * Where to go after sign-in. Only same-app paths are accepted ("/x", never "//evil.com" or "https://…"),
 * so the parameter cannot be used as an open redirect.
 */
export function readSafeRedirectPath(searchParams: URLSearchParams): string {
  const requested = searchParams.get(REDIRECT_PARAM);
  if (requested === null) return paths.ops;
  const isSameAppPath = requested.startsWith('/') && !requested.startsWith('//') && !requested.includes('\\');
  return isSameAppPath ? requested : paths.ops;
}

/** Carries the redirect from one sign-in step to the next (login → MFA). */
export function withRedirectParam(nextPath: string, searchParams: URLSearchParams): string {
  const requested = searchParams.get(REDIRECT_PARAM);
  return requested ? `${nextPath}?${new URLSearchParams({ [REDIRECT_PARAM]: requested })}` : nextPath;
}
