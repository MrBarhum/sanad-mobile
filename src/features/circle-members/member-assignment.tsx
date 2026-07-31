import { AlertTriangle, HandHelping } from 'lucide-react-native';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FigmaMutedNote } from '@/components/figma/figma-form-screen';
import { isolateLtr } from '@/components/ltr-text';
import { OptionSelect } from '@/components/option-select';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';

import type { CircleMember, CircleRole } from './api';
import { memberDisplayName, memberDisplayNameParts } from './display-name';
import { useCircleMembers } from './hooks';

/**
 * Shared assignment / responsibility UI (Phase 2B). Turns the existing
 * `useCircleMembers` roster into a reusable assignee picker (`MemberSelect`) and a
 * userId → display-name resolver (`useMemberLookup`), so tasks, appointments,
 * medications, and visits all show / pick a responsible person consistently.
 *
 * Only ACTIVE "doer" roles are offered as assignees — admin, primary_caregiver,
 * family_member. remote_member and elder are intentionally excluded
 * (remote_member is follow-up only and never receives operational reminders;
 * elder is server-unassignable). This mirrors the app's role model; the RLS
 * policies remain authoritative.
 *
 * `caregiver` — the hired caregiver added in Milestone 8 — is a SCOPED doer, not
 * a general one, which is why it is a separate set and an opt-in prop rather
 * than another entry above. Her permission model gives her exactly two kinds of
 * work: a medication she is responsible for, and a task assigned to her. She has
 * no remit over appointments or family visits, and the database now enforces
 * that — a restrictive policy hides both tables from her entirely, and
 * `set_assigned_appointment_outcome` refuses her.
 *
 * So offering her in the appointment or visit picker would let a manager create
 * an assignment that is invisible and unusable to the assignee: silently broken
 * rather than merely useless. Callers opt in with `includeCaregiver`, and only
 * the task and medication forms do. Defaulting to false also keeps the promise
 * that a circle which never hires a caregiver behaves exactly as it did before.
 */

/** Roles a person can be made responsible for care work today. */
const DOER_ROLES: ReadonlySet<CircleRole> = new Set<CircleRole>([
  'admin',
  'primary_caregiver',
  'family_member',
]);

/** Additionally offerable where the work is a dose or a task. */
const SCOPED_DOER_ROLES: ReadonlySet<CircleRole> = new Set<CircleRole>(['caregiver']);

/** A non-empty user id is "real"; '' is the no-assignment sentinel for the chips. */
export const NO_ASSIGNEE = '';

export type AssigneeOption = {
  value: string;
  label: string;
  /** The hired caregiver's chip carries her role glyph at the RTL end. */
  trailingIcon?: typeof HandHelping;
  /** …and says the role out loud, so the glyph is never the only carrier. */
  accessibilityLabel?: string;
  /**
   * True for the ONE case where a stored caregiver assignment survives on a
   * surface that no longer offers her (an appointment or a visit). Drives the
   * amber caution — see {@link MemberSelect}.
   */
  isOrphanCaregiver?: boolean;
};
type Option = AssigneeOption;

/**
 * The two marks that say "this one is the hired caregiver": her role glyph at the
 * RTL end of the chip, and the same fact in the spoken label — because which of
 * these names is the worker rather than family is the single distinction this
 * picker exists to make, and a glyph alone would carry it for sighted users only.
 * Returns empty for everyone else, so every other chip is untouched.
 */
function caregiverMarks(
  isCaregiver: boolean,
  label: string,
  t: (key: string, options?: Record<string, string>) => string,
): Pick<Option, 'trailingIcon' | 'accessibilityLabel'> {
  if (!isCaregiver) return {};
  return {
    trailingIcon: HandHelping,
    accessibilityLabel: t('assignment.nameWithRole', {
      name: label,
      role: t('circleMembers.roles.caregiver'),
    }),
  };
}

function isAssignableDoer(member: CircleMember, includeCaregiver: boolean): boolean {
  const roleAllowed =
    DOER_ROLES.has(member.role) || (includeCaregiver && SCOPED_DOER_ROLES.has(member.role));
  return (
    member.status === 'active' &&
    roleAllowed &&
    Boolean(member.isSelf || member.fullName || member.email)
  );
}

/**
 * Builds the chip options: no-assignment first, then "me" (only when the current
 * user is an active doer), then every other active doer by real name (email only
 * as a last resort, matching the existing task picker). If the current value is a
 * member who is no longer an active doer (e.g. role changed / left), it is still
 * appended so the stored assignment stays visible and is never silently dropped.
 */
function buildOptions(
  members: CircleMember[],
  selfId: string | null,
  current: string,
  t: (key: string) => string,
  includeCaregiver: boolean,
): Option[] {
  const options: Option[] = [{ value: NO_ASSIGNEE, label: t('assignment.none') }];

  const doers = members.filter((m) => isAssignableDoer(m, includeCaregiver));
  const self = doers.find((m) => m.isSelf || m.userId === selfId);
  if (self) options.push({ value: self.userId, label: t('assignment.me') });
  for (const member of doers) {
    if (member.isSelf || member.userId === selfId) continue;
    const label = memberDisplayName(member, t('assignment.unknownMember'));
    options.push({
      value: member.userId,
      label,
      ...caregiverMarks(member.role === 'caregiver', label, t),
    });
  }

  if (current !== NO_ASSIGNEE && !options.some((o) => o.value === current)) {
    const existing = members.find((m) => m.userId === current);
    const parts = existing
      ? memberDisplayNameParts(existing, t('assignment.unknownMember'))
      : { text: t('assignment.unknownMember'), source: 'fallback' as const };
    const inactive = Boolean(existing && existing.status !== 'active');
    // A Latin local-part concatenated with an Arabic suffix reorders on device —
    // isolate the name run, but only when it IS a Latin run (isolating an Arabic
    // full name would reverse its words).
    const base = existing?.isSelf
      ? t('assignment.me')
      : parts.source === 'email'
        ? isolateLtr(parts.text)
        : parts.text;
    const label =
      inactive && parts.source === 'fallback' && !existing?.isSelf
        ? // «عضو (عضو سابق)» reads as a doubled generic — the suffix says it all.
          t('assignment.inactiveMember')
        : inactive
          ? `${base} (${t('assignment.inactiveMember')})`
          : base;
    // A still-ACTIVE caregiver holding an assignment on a surface that no longer
    // offers her: the value survives, but it is invisible to her and cannot be
    // reselected once the manager picks anyone else.
    const isOrphanCaregiver = Boolean(
      existing && existing.role === 'caregiver' && existing.status === 'active' && !includeCaregiver,
    );
    options.push({
      value: current,
      label,
      isOrphanCaregiver,
      // She keeps her glyph and her spoken role here too — this is precisely the
      // chip the amber caution below is ABOUT, so it must be identifiable.
      ...caregiverMarks(isOrphanCaregiver, label, t),
    });
  }

  return options;
}

/**
 * The assignee chip options for a circle (no-assignment · me · other active
 * doers · the stored value if it's since inactive). Exposed so a screen can
 * render the chips in its own visual language while reusing this exact,
 * email-safe option logic (`MemberSelect` renders the shared default chips).
 */
export function useMemberOptions(
  circleId: string,
  value: string,
  includeCaregiver = false,
): AssigneeOption[] {
  const { t } = useTranslation();
  const { user } = useAuth();
  const membersQuery = useCircleMembers(circleId);
  return useMemo(
    () => buildOptions(membersQuery.data ?? [], user?.id ?? null, value, t, includeCaregiver),
    [membersQuery.data, user?.id, value, t, includeCaregiver],
  );
}

/**
 * A single-choice assignee picker over the circle roster. `value` is the assigned
 * user id, or `NO_ASSIGNEE` ('') for unassigned. Wrap it in a `Surface` card at
 * the call site; it renders a muted group label + the teal chip group, RTL-safe.
 */
export function MemberSelect({
  circleId,
  value,
  onChange,
  label,
  includeCaregiver = false,
}: {
  circleId: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  /**
   * Offer an active hired caregiver as an assignee. Pass it ONLY where the work
   * is a dose or a task — the two things her role can actually act on. Default
   * false, so appointments and visits are untouched.
   */
  includeCaregiver?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const options = useMemberOptions(circleId, value, includeCaregiver);
  // Shares react-query's cache with `useMemberOptions` above — same key, no
  // second round-trip.
  const members = useCircleMembers(circleId).data ?? [];

  const orphanCaregiver = options.some((option) => option.isOrphanCaregiver);
  // Only say "the caregiver isn't listed here" when this circle actually HAS one.
  // A family that never hired anyone must see the picker it has always seen.
  const hasActiveCaregiver = members.some(
    (member) => member.role === 'caregiver' && member.status === 'active',
  );

  return (
    <View style={styles.group}>
      <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>
        {label ?? t('assignment.label')}
      </Text>
      <OptionSelect value={value} options={options} onChange={onChange} />

      {/*
        The two mutually exclusive explanations for the caregiver's absence.

        The amber one wins when a legacy assignment is still selected: saying
        «لا يظهر مقدّم الرعاية هنا» directly above her own visible chip would
        contradict itself. It is standing disclosure, not a failure, so it is
        deliberately NOT an accessibilityRole="alert" — and it is a bare row,
        not the bordered callout the role sheet uses.
      */}
      {orphanCaregiver ? (
        <View style={styles.cautionRow}>
          <AlertTriangle
            size={14}
            color={theme.warningFg}
            strokeWidth={2.4}
            style={styles.cautionIcon}
          />
          <Text style={[styles.cautionText, { color: theme.warningFg }]}>
            {t('assignment.caregiverLegacyAssignment')}
          </Text>
        </View>
      ) : !includeCaregiver && hasActiveCaregiver ? (
        <FigmaMutedNote>{t('assignment.caregiverNotHere')}</FigmaMutedNote>
      ) : null}
    </View>
  );
}

export type ResolvedMember = {
  /** Display name: "أنا" for self, the member's full name, else a neutral "عضو". */
  label: string;
  isSelf: boolean;
  /** True when the member is no longer an active member of the circle. */
  isInactive: boolean;
  /** The member's circle role, when known (null for self / unknown ids). */
  role: CircleRole | null;
  /** Localized role name (circleMembers.roles.*); null when the role is unknown. */
  roleLabel: string | null;
};

/**
 * Returns a resolver that maps a stored user id to a safe display name for
 * lists / detail / read-only views: self → "أنا", an active member → full name,
 * an unknown / since-removed id → a neutral "عضو" (never an email, to avoid
 * leaking it in broadcast surfaces). Returns null for a null id (unassigned).
 */
export function useMemberLookup(circleId: string): (userId: string | null) => ResolvedMember | null {
  const { t } = useTranslation();
  const { user } = useAuth();
  const membersQuery = useCircleMembers(circleId);
  const members = membersQuery.data;
  const selfId = user?.id ?? null;

  return useCallback(
    (userId: string | null): ResolvedMember | null => {
      if (!userId) return null;
      if (selfId && userId === selfId) {
        return { label: t('assignment.me'), isSelf: true, isInactive: false, role: null, roleLabel: null };
      }
      const member = members?.find((m) => m.userId === userId);
      if (!member) {
        return { label: t('assignment.unknownMember'), isSelf: false, isInactive: false, role: null, roleLabel: null };
      }
      return {
        label: memberDisplayName(member, t('assignment.unknownMember')),
        isSelf: member.isSelf,
        isInactive: member.status !== 'active',
        role: member.role,
        roleLabel: t(`circleMembers.roles.${member.role}`),
      };
    },
    [members, selfId, t],
  );
}

/**
 * Returns a resolver that maps a stored `responsible_user_id` (or any assignee
 * id) to a single localized line for read-only display on manager surfaces:
 *   - unassigned (null id) → "غير مسند"
 *   - the current user      → "المسؤول: أنا"
 *   - another active member → "المسؤول: <name> - <role>"  (never an email)
 * Built on top of `useMemberLookup`, so it inherits the same email-safe naming.
 * Callers decide whether to render it (e.g. managers only); this only formats.
 */
export function useResponsibleLabel(circleId: string): (userId: string | null) => string {
  const { t } = useTranslation();
  const lookup = useMemberLookup(circleId);

  return useCallback(
    (userId: string | null): string => {
      const resolved = lookup(userId);
      if (!resolved) return t('assignment.unassigned');
      const value =
        resolved.isSelf || !resolved.roleLabel
          ? resolved.label
          : t('assignment.nameWithRole', { name: resolved.label, role: resolved.roleLabel });
      return t('assignment.responsibleValue', { value });
    },
    [lookup, t],
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  groupLabel: { fontSize: 14, fontFamily: FontFamily.semibold },
  cautionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  cautionIcon: { flexShrink: 0, marginTop: 4 },
  // A running two-sentence explanation, not a meta label — so it sits at the 16
  // body floor, matching the shell-change warning in the role sheet.
  cautionText: { flex: 1, fontSize: 16, fontFamily: FontFamily.semibold, lineHeight: 26 },
});
