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

import type { ThemeColor } from '@/constants/theme';
import { memberDisplayName } from '@/features/circle-members/display-name';
import { useCircleMembers } from '@/features/circle-members/hooks';
import { todayYmdInTimeZone, ymdInTimeZone } from '@/utils/date';

import type { PulseEvent, PulseItemType } from './types';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** Per-event icon + accent (status is icon + text + color, never color alone). */
export function pulseEventVisual(event: PulseEvent): { Icon: IconCmp; colorKey: ThemeColor } {
  switch (event.event_type) {
    case 'dose_logged':
      return { Icon: Pill, colorKey: 'categoryTeal' };
    case 'task_completed':
      return { Icon: Check, colorKey: 'categoryGreen' };
    case 'task_cancelled':
      return { Icon: X, colorKey: 'categoryGold' };
    case 'appointment_outcome':
      return { Icon: Calendar, colorKey: 'categoryPurple' };
    case 'visit_completed':
      return { Icon: Users, colorKey: 'categoryGreen' };
    case 'vital_recorded':
      return { Icon: Activity, colorKey: 'categoryBlue' };
    case 'daily_log_added':
      return { Icon: FileText, colorKey: 'categoryGreen' };
    case 'member_joined':
      return { Icon: UserPlus, colorKey: 'categoryGold' };
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

/**
 * Localized "{actor} · {phrase}" line for an event. Every phrase is a gender-
 * neutral verbal noun (masdar) with the actor's resolved name first, which removes
 * both the old first-person «أنا» reading and any verb gender-agreement problem
 * (D3). The same helper feeds the feed rows and the WhatsApp share.
 */
export function pulseDescription(event: PulseEvent, t: Translate, actorLabel: ActorLabel): string {
  const actor = actorLabel(event.actor_user_id, event.actor_name);
  const title = event.title ?? '';
  switch (event.event_type) {
    case 'dose_logged':
      // The dose status (given / postponed / missed) shifts the noun, still nominal.
      return t(
        event.status === 'missed'
          ? 'pulse.events.doseMissed'
          : event.status === 'postponed'
            ? 'pulse.events.dosePostponed'
            : 'pulse.events.doseGiven',
        { actor, title },
      );
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
    case 'visit_completed': {
      // The visitor IS the subject. When they have no linked account the RPC still
      // supplies their name via `title` (visitor_name), so prefer it over the
      // generic «أحد الأعضاء» fallback; a linked visitor keeps their roster name.
      const visitor = event.actor_user_id ? actor : title || actor;
      return t('pulse.events.visitCompleted', { actor: visitor });
    }
    case 'vital_recorded':
      // The RPC puts the reading_type in `title`; localize it via the shared
      // vitals labels (falling back to the raw type for an unknown value).
      return t('pulse.events.vitalRecorded', {
        actor,
        vital: event.title ? t(`vitals.type.${event.title}`, { defaultValue: event.title }) : '',
      });
    case 'daily_log_added':
      return t('pulse.events.dailyLogAdded', { actor });
    case 'member_joined':
      return t('pulse.events.memberJoined', { actor });
  }
}

/**
 * Resolver that turns an actor id into a display NAME, reusing the same roster the
 * pickers use and the shared `memberDisplayName()` (full name → email local-part →
 * neutral). Unlike assignment pickers it never returns «أنا» — even the current
 * user reads by their real name, so the masdar headlines are gender- and
 * person-neutral (D3). Never a bare «عضو»: a since-removed actor falls back to
 * their stored name, else the neutral «عضو سابق».
 */
export function usePulseActorLabel(circleId: string): ActorLabel {
  const { t } = useTranslation();
  const members = useCircleMembers(circleId).data;

  return useCallback(
    (id: string | null, storedName: string | null) => {
      if (!id) return t('pulse.someone');
      const member = members?.find((m) => m.userId === id);
      if (member) return memberDisplayName(member, t('pulse.someone'));
      // Actor no longer in the roster (e.g. a removed member): prefer their stored
      // real name, else a neutral «عضو سابق» — never a bare «عضو».
      return storedName?.trim() || t('assignment.inactiveMember');
    },
    [members, t],
  );
}

/**
 * Composes a plain-text "today's summary" for the OS / WhatsApp share sheet from
 * the loaded pulse events — client-side, so no extra fetch. Lists today's events
 * (the circle's local day, matching the Home strip's scope) as bullet lines under
 * a dated header; a calm day yields a gentle note. Uses the corrected masdar+name
 * headlines via `pulseDescription`, so the shared text is named and gender-neutral.
 */
export function composePulseShareText(
  events: PulseEvent[],
  t: Translate,
  actorLabel: ActorLabel,
  timezone: string,
): string {
  const today = todayYmdInTimeZone(timezone);
  const todays = events.filter((e) => ymdInTimeZone(e.occurred_at, timezone) === today);
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
