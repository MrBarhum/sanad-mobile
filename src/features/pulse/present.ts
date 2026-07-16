import type { Href } from 'expo-router';
import {
  Activity,
  Calendar,
  Check,
  FileText,
  Pill,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Share } from 'react-native';

import { FigmaCategory } from '@/components/figma/figma-tokens';
import { memberDisplayName } from '@/features/circle-members/display-name';
import { useCircleMembers } from '@/features/circle-members/hooks';
import { useAuth } from '@/providers';
import { todayYmd, ymdFromInstant } from '@/utils/date';

import type { PulseEvent, PulseItemType } from './types';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** Per-event icon + accent (status is icon + text + color, never color alone). */
export function pulseEventVisual(event: PulseEvent): { Icon: IconCmp; color: string } {
  switch (event.event_type) {
    case 'dose_logged':
      return { Icon: Pill, color: FigmaCategory.teal };
    case 'task_completed':
      return { Icon: Check, color: FigmaCategory.green };
    case 'task_cancelled':
      return { Icon: X, color: FigmaCategory.gold };
    case 'appointment_outcome':
      return { Icon: Calendar, color: FigmaCategory.purple };
    case 'visit_completed':
      return { Icon: Users, color: FigmaCategory.green };
    case 'vital_recorded':
      return { Icon: Activity, color: FigmaCategory.blue };
    case 'daily_log_added':
      return { Icon: FileText, color: FigmaCategory.green };
    case 'member_joined':
      return { Icon: UserPlus, color: FigmaCategory.gold };
  }
}

/** Deep link a pulse row opens on tap. */
export function pulseRouteFor(itemType: PulseItemType, itemId: string): Href {
  switch (itemType) {
    case 'medication':
      return `/medications/${itemId}` as Href;
    case 'task':
      return `/tasks/${itemId}` as Href;
    case 'appointment':
      return `/appointments/${itemId}` as Href;
    case 'visit':
      return `/visits/${itemId}` as Href;
    case 'vital':
      return `/vitals/${itemId}` as Href;
    case 'daily_log':
      return `/daily-logs/${itemId}` as Href;
    case 'member':
      return '/circle-members' as Href;
  }
}

type Translate = (key: string, opts?: Record<string, unknown>) => string;
type ActorLabel = (id: string | null, storedName: string | null) => string;

/** Localized "{actor} {action}" line for an event. */
export function pulseDescription(event: PulseEvent, t: Translate, actorLabel: ActorLabel): string {
  const actor = actorLabel(event.actor_user_id, event.actor_name);
  const title = event.title ?? '';
  switch (event.event_type) {
    case 'dose_logged':
      return t('pulse.events.doseLogged', { actor, title });
    case 'task_completed':
      return t('pulse.events.taskCompleted', { actor, title });
    case 'task_cancelled':
      return t('pulse.events.taskCancelled', { actor, title });
    case 'appointment_outcome':
      return t(
        event.status === 'cancelled'
          ? 'pulse.events.appointmentCancelled'
          : 'pulse.events.appointmentCompleted',
        { actor, title },
      );
    case 'visit_completed':
      return t('pulse.events.visitCompleted', { actor, title });
    case 'vital_recorded':
      return t('pulse.events.vitalRecorded', { actor });
    case 'daily_log_added':
      return t('pulse.events.dailyLogAdded', { actor });
    case 'member_joined':
      return t('pulse.events.memberJoined', { actor });
  }
}

/**
 * Resolver that turns an actor id into a display name using the SAME rules as the
 * rest of the app: self → "أنا", an active member → their `memberDisplayName`, a
 * since-removed member → the stored actor_name, else a neutral fallback.
 */
export function usePulseActorLabel(circleId: string): ActorLabel {
  const { t } = useTranslation();
  const { user } = useAuth();
  const members = useCircleMembers(circleId).data;
  const selfId = user?.id ?? null;

  return useCallback(
    (id: string | null, storedName: string | null) => {
      if (!id) return t('pulse.someone');
      if (id === selfId) return t('assignment.me');
      const member = members?.find((m) => m.userId === id);
      const fallback = storedName?.trim() || t('assignment.unknownMember');
      return member ? memberDisplayName(member, fallback) : fallback;
    },
    [members, selfId, t],
  );
}

/**
 * Composes a plain-text "today's summary" for the OS share sheet from the loaded
 * pulse events — client-side, so no extra fetch. Lists today's events (circle-
 * local) as bullet lines under a dated header; a calm day yields a gentle note.
 */
export function composePulseShareText(
  events: PulseEvent[],
  t: Translate,
  actorLabel: ActorLabel,
): string {
  const today = todayYmd();
  const todays = events.filter((e) => ymdFromInstant(e.occurred_at) === today);
  const header = t('pulse.shareHeader', { date: today });
  if (todays.length === 0) {
    return `${header}\n${t('pulse.shareEmpty')}`;
  }
  const lines = todays.map((e) => `• ${pulseDescription(e, t, actorLabel)}`).join('\n');
  return `${header}\n${lines}`;
}

/** Shares text via the OS share sheet (native) or Web Share / clipboard (web). */
export async function sharePulseSummary(text: string): Promise<void> {
  if (Platform.OS === 'web') {
    const nav = globalThis.navigator as
      | (Navigator & { share?: (d: { text?: string }) => Promise<void> })
      | undefined;
    if (nav?.share) {
      await nav.share({ text });
      return;
    }
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return;
    }
    return;
  }
  await Share.share({ message: text });
}

/** True when the query error means the RPC itself is missing (migration not applied). */
export function isMissingPulseRpc(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  const code = e?.code ?? '';
  const message = (e?.message ?? '').toLowerCase();
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    message.includes('does not exist') ||
    message.includes('could not find the function')
  );
}
