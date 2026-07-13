import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';

import { useCircleSelection } from '@/features/circle-selection/provider';
import { useAuth } from '@/providers';

import { completeForNotification, doneMessage, type PushActionData } from './actions';

import {
  deactivatePushToken,
  fetchDeviceToken,
  fetchNotifications,
  fetchPreferences,
  fetchUnreadCount,
  markAllNotificationsRead,
  notificationKeys,
  preferencesToInput,
  registerPushToken,
  setNotificationRead,
  upsertPreferences,
  type AppNotification,
  type NotificationPreferencesInput,
} from './api';
import { notificationData, notificationRoute } from './catalog';
import { getDeviceTimezone, getOrCreateDeviceId } from './device';
import {
  ProjectIdMissingError,
  SANAD_NOTIFICATION_ACTION,
  acquireExpoPushToken,
  bootstrapNotifications,
  deviceRegistrationInfo,
  ensureAndroidChannel,
  getPermission,
  pushSupport,
  requestPermission,
  scheduleSnoozeNotification,
  type PushPermission,
  type PushSupport,
} from './push-registration';

// The device's current Expo token, remembered after a successful registration so
// logout/disable can deactivate it server-side. Module-scoped (not the raw token
// in any log).
let rememberedToken: string | null = null;
export function getRememberedToken(): string | null {
  return rememberedToken;
}

// ---------------------------------------------------------------------------
// Inbox queries
// ---------------------------------------------------------------------------

/** Recent notifications (optionally filtered to one circle). */
export function useNotifications(circleId: string | null, limit: number) {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: [...notificationKeys.list(userId, circleId), limit] as const,
    queryFn: () => fetchNotifications(userId as string, { circleId, limit }),
    enabled: Boolean(userId),
  });
}

/** Unread count for the bell badge; refetches when the app regains focus. */
export function useUnreadCount() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: notificationKeys.unread(userId),
    queryFn: () => fetchUnreadCount(userId as string),
    enabled: Boolean(userId),
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; read: boolean }) => setNotificationRead(vars.id, vars.read),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (circleId: string | null) => markAllNotificationsRead(circleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export function useNotificationPreferences(circleId: string | null) {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: notificationKeys.preferences(userId, circleId),
    queryFn: () => fetchPreferences(userId as string, circleId),
    enabled: Boolean(userId),
  });
}

export function useUpsertPreferences(circleId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  return useMutation({
    mutationFn: (input: NotificationPreferencesInput) => upsertPreferences(circleId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: notificationKeys.preferences(userId, circleId) }),
  });
}

// ---------------------------------------------------------------------------
// Push registration lifecycle
// ---------------------------------------------------------------------------

export type EnableResult =
  | 'enabled'
  | 'denied'
  | 'unsupported'
  | 'no-device'
  | 'project-id-missing'
  | 'error';

/**
 * Owns the device's push permission + token. `enable()` is the only path that
 * prompts for permission (call it from an explicit user action). `refresh()`
 * re-registers quietly when permission is already granted (launch/resume).
 * `disable()` deactivates this device's server token.
 */
export function usePushRegistration() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  const support: PushSupport = pushSupport();
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [projectIdMissing, setProjectIdMissing] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (support === 'web-unsupported') {
      setPermission('denied');
      return;
    }
    void getPermission().then((p) => {
      if (mounted) setPermission(p);
    });
    return () => {
      mounted = false;
    };
  }, [support]);

  const deviceTokenQuery = useQuery({
    queryKey: notificationKeys.device(userId),
    queryFn: async () => fetchDeviceToken(userId as string, await getOrCreateDeviceId()),
    enabled: Boolean(userId) && support === 'supported',
  });

  // Best-effort: store the device timezone on the user's global preferences so
  // reminders/quiet hours use the right local time. Never clobbers other toggles.
  const ensureTimezone = useCallback(async () => {
    if (!userId) return;
    try {
      const tz = getDeviceTimezone();
      const row = await fetchPreferences(userId, null);
      const input = preferencesToInput(row);
      if (input.timezone !== tz) {
        await upsertPreferences(null, { ...input, timezone: tz });
        queryClient.invalidateQueries({ queryKey: notificationKeys.preferences(userId, null) });
      }
    } catch {
      // ignore — timezone capture is non-critical
    }
  }, [userId, queryClient]);

  const registerNow = useCallback(async (): Promise<EnableResult> => {
    try {
      const token = await acquireExpoPushToken();
      if (!token) return 'unsupported';
      const info = await deviceRegistrationInfo();
      await registerPushToken({
        token,
        platform: info.platform,
        deviceId: info.deviceId,
        appVersion: info.appVersion,
      });
      rememberedToken = token;
      setProjectIdMissing(false);
      await ensureTimezone();
      queryClient.invalidateQueries({ queryKey: notificationKeys.device(userId) });
      return 'enabled';
    } catch (e) {
      if (e instanceof ProjectIdMissingError) {
        setProjectIdMissing(true);
        return 'project-id-missing';
      }
      return 'error';
    }
  }, [userId, ensureTimezone, queryClient]);

  /** Explicit, user-initiated enable: prompt → register. */
  const enable = useCallback(async (): Promise<EnableResult> => {
    if (support === 'web-unsupported') return 'unsupported';
    if (support === 'no-device') return 'no-device';
    setIsWorking(true);
    try {
      await ensureAndroidChannel();
      const perm = await requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return 'denied';
      return await registerNow();
    } finally {
      setIsWorking(false);
    }
  }, [support, registerNow]);

  /** Quiet re-registration when permission is already granted. */
  const refresh = useCallback(async () => {
    if (support !== 'supported') return;
    const perm = await getPermission();
    setPermission(perm);
    if (perm === 'granted') await registerNow();
  }, [support, registerNow]);

  const disable = useCallback(async () => {
    setIsWorking(true);
    try {
      if (rememberedToken) {
        await deactivatePushToken(rememberedToken);
      }
      queryClient.invalidateQueries({ queryKey: notificationKeys.device(userId) });
    } catch {
      // ignore
    } finally {
      setIsWorking(false);
    }
  }, [userId, queryClient]);

  return {
    support,
    permission,
    projectIdMissing,
    isWorking,
    hasActiveDeviceToken: Boolean(deviceTokenQuery.data?.is_active),
    enable,
    refresh,
    disable,
  };
}

// ---------------------------------------------------------------------------
// Opening a notification (deep link + circle-switch safety)
// ---------------------------------------------------------------------------

/**
 * Resolves where a notification should take the user and switches the active
 * circle first — but ONLY when they are still an active member of that circle.
 * If membership was removed, it routes to the inbox instead of exposing a circle
 * the user no longer belongs to.
 */
export function useOpenNotification() {
  const router = useRouter();
  const { circles, activeCircleId, setActiveCircle } = useCircleSelection();

  return useCallback(
    (target: { type: AppNotification['type']; deep_link?: string | null; data?: unknown }) => {
      const data = notificationData({ data: (target.data ?? {}) as AppNotification['data'] });
      const circleId = data.circleId;
      const route = notificationRoute({
        type: target.type,
        deep_link: target.deep_link ?? null,
        data: (target.data ?? {}) as AppNotification['data'],
      });

      if (circleId && circleId !== activeCircleId) {
        const stillMember = circles.some((c) => c.circleId === circleId);
        if (!stillMember) {
          router.push('/notifications');
          return;
        }
        setActiveCircle(circleId);
      }

      router.push((route ?? '/notifications') as Href);
    },
    [router, circles, activeCircleId, setActiveCircle],
  );
}

// ---------------------------------------------------------------------------
// App-shell observers (handler, listeners, auto re-register, tap routing)
// ---------------------------------------------------------------------------

/**
 * Installs the foreground handler, registers received/response listeners with
 * cleanup, re-registers the token on launch/resume when permission is already
 * granted (never prompting), and routes notification taps. Mount once near the
 * app root (see <NotificationObserver/>).
 */
export function useNotificationObservers() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  const { refresh } = usePushRegistration();
  const open = useOpenNotification();
  const openRef = useRef(open);
  openRef.current = open;
  // Latest user id for the action handlers (which live in a stable listener closure).
  // Synced in an effect so the ref is not written during render.
  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // One-time native configuration. Also run at the root layout before the auth gate
  // (src/app/_layout.tsx); this signed-in mount re-ensures it idempotently as a
  // defense-in-depth backstop. Registers the foreground handler, Android channel and
  // the "تم" / "ذكرني بعد 5 دقائق" action categories. Never prompts for permission,
  // so the explicit opt-in flow is preserved.
  useEffect(() => {
    void bootstrapNotifications();
  }, []);

  // Re-register the token on launch and whenever the app returns to foreground,
  // but only when permission is already granted (no prompt here).
  useEffect(() => {
    if (!userId) return;
    void refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [userId, refresh]);

  // Live-update the inbox when a notification arrives in the foreground, and
  // route taps (foreground/background via the listener, cold start via the last
  // response). A handled-id set prevents routing the same tap twice.
  useEffect(() => {
    const handled = new Set<string>();

    const asString = (value: unknown): string | undefined =>
      typeof value === 'string' && value.length > 0 ? value : undefined;

    // "تم": run the safe type-specific completion; on anything but success, open the
    // detail screen so the user can finish. Brief alert as feedback.
    const runComplete = async (data: PushActionData) => {
      const type = (data.type ?? 'system') as AppNotification['type'];
      const outcome = await completeForNotification(type, data, userIdRef.current ?? null);
      if (outcome === 'completed') {
        queryClient.invalidateQueries();
        Alert.alert('تم', doneMessage(type));
        return;
      }
      openRef.current({ type, deep_link: data.deepLink ?? null, data });
    };

    // "ذكرني بعد 5 دقائق": reschedule the same reminder locally, 5 minutes out.
    const runSnooze = async (content: Notifications.NotificationContent, data: PushActionData) => {
      try {
        await scheduleSnoozeNotification({
          key: asString(data.notificationId) ?? asString(data.itemId) ?? 'reminder',
          title: content.title ?? 'سند',
          body: content.body ?? 'حان موعد تذكير جديد',
          data,
          categoryIdentifier: asString(data.categoryId),
          minutes: 5,
        });
        Alert.alert('تم', 'سيصلك تذكير بعد 5 دقائق');
      } catch {
        // best-effort; a failed local schedule must not crash the handler
      }
    };

    const route = (response: Notifications.NotificationResponse) => {
      const content = response.notification.request.content;
      const action = response.actionIdentifier;
      // Dedupe per (notification, action, delivery time) so the cold-start replay and
      // the live listener don't double-process the SAME interaction, while separate
      // deliveries of a reused local id (e.g. re-snoozing, which reuses
      // `sanad_snooze_<id>`) are still processed — they carry a fresh `date`.
      const key = `${response.notification.request.identifier}:${action}:${response.notification.date}`;
      if (handled.has(key)) return;
      handled.add(key);

      const data = (content.data ?? {}) as PushActionData;
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });

      if (action === SANAD_NOTIFICATION_ACTION.snooze5) {
        void runSnooze(content, data);
        return;
      }
      if (action === SANAD_NOTIFICATION_ACTION.complete) {
        void runComplete(data);
        return;
      }
      // Default body tap (or any unknown action): existing deep-link behavior.
      openRef.current({ type: data.type ?? 'system', deep_link: data.deepLink ?? null, data });
    };

    const received = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    });
    const responded = Notifications.addNotificationResponseReceivedListener(route);

    // Cold start: the app was launched by tapping a notification (or its action).
    // Clear the native last-response after routing so it is consumed once and does
    // NOT replay (re-navigate / re-run "تم") on a later observer remount
    // (logout → login in the same process) or a JS reload.
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) route(response);
      })
      .catch(() => {})
      .finally(() => {
        Notifications.clearLastNotificationResponseAsync().catch(() => {});
      });

    return () => {
      received.remove();
      responded.remove();
    };
  }, [queryClient]);
}
