import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FigmaChipSelect } from '@/components/figma/figma-form-screen';
import { FigmaFont } from '@/components/figma/figma-tokens';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';

import type { CircleMember, CircleRole } from './api';
import { memberDisplayName } from './display-name';
import { useCircleMembers } from './hooks';

/**
 * Shared assignment / responsibility UI (Phase 2B). Turns the existing
 * `useCircleMembers` roster into a reusable assignee picker (`MemberSelect`) and a
 * userId → display-name resolver (`useMemberLookup`), so tasks, appointments,
 * medications, and visits all show / pick a responsible person consistently.
 *
 * Only ACTIVE "doer" roles are offered as assignees — admin, primary_caregiver,
 * family_member. remote_member / elder / caregiver are intentionally excluded
 * (remote_member is follow-up only and never receives operational reminders;
 * caregiver / elder are server-unassignable today). This mirrors the app's role
 * model; the RLS policies remain authoritative.
 */

/** Roles a person can be made responsible for care work today. */
const DOER_ROLES: ReadonlySet<CircleRole> = new Set<CircleRole>([
  'admin',
  'primary_caregiver',
  'family_member',
]);

/** A non-empty user id is "real"; '' is the no-assignment sentinel for the chips. */
export const NO_ASSIGNEE = '';

type Option = { value: string; label: string };

function isAssignableDoer(member: CircleMember): boolean {
  return (
    member.status === 'active' &&
    DOER_ROLES.has(member.role) &&
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
): Option[] {
  const options: Option[] = [{ value: NO_ASSIGNEE, label: t('assignment.none') }];

  const doers = members.filter(isAssignableDoer);
  const self = doers.find((m) => m.isSelf || m.userId === selfId);
  if (self) options.push({ value: self.userId, label: t('assignment.me') });
  for (const member of doers) {
    if (member.isSelf || member.userId === selfId) continue;
    options.push({
      value: member.userId,
      label: memberDisplayName(member, t('assignment.unknownMember')),
    });
  }

  if (current !== NO_ASSIGNEE && !options.some((o) => o.value === current)) {
    const existing = members.find((m) => m.userId === current);
    const base = existing?.isSelf
      ? t('assignment.me')
      : existing
        ? memberDisplayName(existing, t('assignment.unknownMember'))
        : t('assignment.unknownMember');
    const label =
      existing && existing.status !== 'active'
        ? `${base} (${t('assignment.inactiveMember')})`
        : base;
    options.push({ value: current, label });
  }

  return options;
}

/**
 * A single-choice assignee picker over the circle roster. `value` is the assigned
 * user id, or `NO_ASSIGNEE` ('') for unassigned. Wrap it in a `FigmaFormCard` at
 * the call site; it renders a muted group label + the teal chip group, RTL-safe.
 */
export function MemberSelect({
  circleId,
  value,
  onChange,
  label,
}: {
  circleId: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { user } = useAuth();
  const membersQuery = useCircleMembers(circleId);

  const options = useMemo(
    () => buildOptions(membersQuery.data ?? [], user?.id ?? null, value, t),
    [membersQuery.data, user?.id, value, t],
  );

  return (
    <View style={styles.group}>
      <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>
        {label ?? t('assignment.label')}
      </Text>
      <FigmaChipSelect value={value} options={options} onChange={onChange} />
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
  groupLabel: { fontSize: 14, fontFamily: FigmaFont.semibold },
});
