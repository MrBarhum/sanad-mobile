import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/providers';

import {
  clearPendingJoinCode,
  joinCodeFromUrl,
  loadPendingJoinCode,
  stashPendingJoinCode,
} from './pending-join';

/**
 * Headless bridge that preserves a WhatsApp join code across the auth gate (F1).
 * A `sanadmobile://join-circle?code=…` deep link tapped while SIGNED OUT hits the
 * (app) session guard and gets redirected to /sign-in, dropping the `?code`. This
 * mounts ABOVE the guard (root layout): it captures the code from the incoming
 * link — cold start via `getInitialURL`, warm app via `Linking.useURL` — and
 * stashes it; once a session exists it replays it into /join-circle (code
 * pre-filled) and clears the stash so it is used exactly once.
 *
 * A signed-in tap already routes to /join-circle via expo-router; the replay to
 * the same route is idempotent. With no link and no stash nothing happens, so a
 * normal launch never leaks a stale code. Renders nothing.
 */
export function PendingJoinLink() {
  const { session, isLoading } = useAuth();
  const url = Linking.useURL();
  const [pending, setPending] = useState<string | null>(null);
  const processedUrl = useRef<string | null>(null);

  // Restore a code stashed in a previous run (cold start after a force-quit mid
  // sign-up) so it can still be replayed after the user authenticates.
  useEffect(() => {
    let alive = true;
    void loadPendingJoinCode().then((code) => {
      if (alive && code) setPending((current) => current ?? code);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Capture the code from an incoming join-circle deep link (cold + warm start).
  useEffect(() => {
    let alive = true;
    void (async () => {
      const incoming = url ?? (await Linking.getInitialURL());
      if (!incoming || incoming === processedUrl.current) return;
      const code = joinCodeFromUrl(incoming);
      if (code && alive) {
        processedUrl.current = incoming;
        setPending(code);
        await stashPendingJoinCode(code);
      }
    })();
    return () => {
      alive = false;
    };
  }, [url]);

  // Once authenticated with a pending code, replay it into the join screen and
  // clear the stash so it is consumed once.
  useEffect(() => {
    if (isLoading || !session || !pending) return;
    const code = pending;
    setPending(null);
    void clearPendingJoinCode();
    router.replace({ pathname: '/join-circle', params: { code } });
  }, [isLoading, session, pending]);

  return null;
}
