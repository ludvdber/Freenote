import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { getCurrentUser } from '@/api/endpoints';

/**
 * On app mount, hydrate the auth store from the HttpOnly JWT cookie.
 *
 * Two trigger paths — we only hit the API when there's a real reason to believe a session
 * exists, so anonymous visitors on the public home page never generate a noisy 401:
 *  1. A persisted sentinel `token` in localStorage (returning visitor) → re-verify the cookie.
 *  2. A fresh OAuth redirect carrying `?login=success` → OAuth2LoginSuccessHandler just set the
 *     cookie but localStorage is still empty on a first sign-in, so we MUST fetch regardless of
 *     the stored token. Without this the cookie login is invisible to the SPA and the user is
 *     stuck clicking "Se connecter" forever (the param is stripped right after, so a refresh or
 *     shared URL doesn't re-trigger it).
 */
export function useAuthInit() {
  const { token, loginFromUser, logout } = useAuthStore();
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const params = new URLSearchParams(window.location.search);
    const justLoggedIn = params.get('login') === 'success';

    if (justLoggedIn) {
      params.delete('login');
      const qs = params.toString();
      window.history.replaceState(
        {},
        '',
        window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash
      );
    }

    if (!token && !justLoggedIn) return;

    getCurrentUser()
      .then((u) => loginFromUser(u))
      .catch(() => {
        // Cookie expired/invalid — clear stale store
        logout();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
