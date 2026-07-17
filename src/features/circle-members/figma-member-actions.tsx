import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { FigmaBottomSheet } from '@/components/figma/figma-bottom-sheet';
import { Button } from '@/components/button';
import { OptionSelect } from '@/components/option-select';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { memberErrorKey, type CircleMember, type CircleRole } from './api';
import {
  useLeaveCircle,
  useTransferOwnership,
  useUpdateMemberRole,
  useUpdateMemberStatus,
} from './hooks';
import { assignableRolesFor, canChangeStatus, isLastActiveAdmin } from './permissions';
import { roleChangeDirection } from './role-capabilities';

type ConfirmKind = 'remove' | 'leave' | 'owner';
type Mode = 'menu' | 'role' | ConfirmKind;

/**
 * Whether the actor has at least one action available on this member — the roster
 * uses it to decide which rows are tappable (open the actions sheet) and which are
 * static. Kept next to the sheet so both derive the same gates from the same
 * helpers.
 */
export function memberHasActions(
  member: CircleMember,
  all: CircleMember[],
  actorRole: CircleRole,
): boolean {
  const lastAdmin = isLastActiveAdmin(member, all);
  const viewerIsOwner = all.some((m) => m.isSelf && m.isOwner);
  const canStatus = canChangeStatus(actorRole, member);
  const canEditRole =
    assignableRolesFor(actorRole, member).length > 0 && !lastAdmin && !member.isOwner;
  const showRemove =
    !member.isSelf && canStatus && member.status === 'active' && !lastAdmin && !member.isOwner;
  const showReactivate = canStatus && member.status !== 'active';
  const showLeave = member.isSelf && member.status === 'active' && !lastAdmin && !member.isOwner;
  const canMakeOwner =
    viewerIsOwner && !member.isOwner && !member.isSelf && member.status === 'active';
  return canEditRole || showRemove || showReactivate || showLeave || canMakeOwner;
}

/**
 * The per-member management sheet: the single reachable home for change-role,
 * reactivate, remove, leave, and transfer-ownership — all of which existed only
 * in the unrouted legacy MembersManager before. Built entirely on Figma
 * primitives so it matches the live roster, and wired to the same authoritative
 * hooks/permission gates (`assignableRolesFor`, `canChangeStatus`,
 * `isLastActiveAdmin`; the RPCs stay authoritative).
 *
 * Every destructive/irreversible action (remove, leave, transfer) is a two-step
 * confirm with a plain-language warning. Role change is reversible, so it lands
 * on one explicit "save" with a live effect note. A retained `shown` snapshot
 * keeps the content painted during the sheet's slide-out.
 */
export function MemberActionsSheet({
  member,
  all,
  actorRole,
  circleId,
  onClose,
  onLeft,
}: {
  member: CircleMember | null;
  all: CircleMember[];
  actorRole: CircleRole;
  circleId: string;
  onClose: () => void;
  /** Called after a successful self-leave so the parent can navigate home. */
  onLeft: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();

  const updateRole = useUpdateMemberRole(circleId);
  const updateStatus = useUpdateMemberStatus(circleId);
  const leave = useLeaveCircle();
  const transfer = useTransferOwnership(circleId);

  const [shown, setShown] = useState<CircleMember | null>(member);
  const [mode, setMode] = useState<Mode>('menu');
  const [selectedRole, setSelectedRole] = useState<CircleRole>('family_member');
  const [error, setError] = useState<string | null>(null);

  // A fresh open always starts on the menu with a clean role selection + no error.
  useEffect(() => {
    if (member) {
      setShown(member);
      setMode('menu');
      setSelectedRole(member.role);
      setError(null);
    }
  }, [member]);

  const busy =
    updateRole.isPending || updateStatus.isPending || leave.isPending || transfer.isPending;

  if (!shown) {
    return (
      <FigmaBottomSheet visible={false} onClose={onClose} title="">
        {null}
      </FigmaBottomSheet>
    );
  }

  const displayName = shown.fullName?.trim() || shown.email || t('circleMembers.unnamed');
  const lastAdmin = isLastActiveAdmin(shown, all);
  const viewerIsOwner = all.some((m) => m.isSelf && m.isOwner);
  const canStatus = canChangeStatus(actorRole, shown);
  const roleOptions = assignableRolesFor(actorRole, shown);

  const canEditRole = roleOptions.length > 0 && !lastAdmin && !shown.isOwner;
  const showRemove =
    !shown.isSelf && canStatus && shown.status === 'active' && !lastAdmin && !shown.isOwner;
  const showReactivate = canStatus && shown.status !== 'active';
  const showLeave = shown.isSelf && shown.status === 'active' && !lastAdmin && !shown.isOwner;
  const canMakeOwner =
    viewerIsOwner && !shown.isOwner && !shown.isSelf && shown.status === 'active';

  const roleChanged = selectedRole !== shown.role;
  const direction = roleChangeDirection(shown.role, selectedRole);

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setError(null);
    try {
      await action();
      (after ?? onClose)();
    } catch (e) {
      setError(t(memberErrorKey(e)));
    }
  }

  const confirm: Record<ConfirmKind, { body: string; btn: string; danger: boolean; go: () => void }> =
    {
      remove: {
        body: t('circleMembers.removeConfirmBody', { name: displayName }),
        btn: t('circleMembers.confirmRemove'),
        danger: true,
        go: () =>
          run(() => updateStatus.mutateAsync({ memberId: shown.memberId, status: 'removed' })),
      },
      leave: {
        body: t('circleMembers.leaveConfirmBody'),
        btn: t('circleMembers.confirmLeave'),
        danger: true,
        go: () => run(() => leave.mutateAsync(circleId), onLeft),
      },
      owner: {
        body: t('circleMembers.makeOwnerConfirmBody', { name: displayName }),
        btn: t('circleMembers.confirmMakeOwner'),
        danger: false,
        go: () => run(() => transfer.mutateAsync(shown.userId)),
      },
    };

  const title =
    mode === 'role'
      ? t('circleMembers.changeRoleTitle')
      : mode === 'leave'
        ? t('circleMembers.leaveConfirmTitle')
        : mode === 'remove'
          ? t('circleMembers.remove')
          : mode === 'owner'
            ? t('circleMembers.makeOwner')
            : displayName;

  const errorNode = error ? (
    <Text
      style={[styles.error, { color: c.errorFg }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite">
      {error}
    </Text>
  ) : null;

  return (
    <FigmaBottomSheet visible={member !== null} onClose={onClose} title={title}>
      {mode === 'menu' ? (
        <>
          <Text style={[styles.role, { color: c.textSecondary }]}>
            {t(`circleMembers.roles.${shown.role}`)}
            {shown.isOwner ? ` · ${t('circleMembers.owner')}` : ''}
          </Text>
          {shown.isOwner ? (
            <Text style={[styles.note, { color: c.textSecondary }]}>{t('circleMembers.ownerNote')}</Text>
          ) : lastAdmin ? (
            <Text style={[styles.note, { color: c.textSecondary }]}>{t('circleMembers.lastAdminNote')}</Text>
          ) : null}

          {canEditRole ? (
            <Button
              variant="secondary"
              label={t('circleMembers.changeRole')}
              onPress={() => {
                setSelectedRole(shown.role);
                setError(null);
                setMode('role');
              }}
            />
          ) : null}
          {canMakeOwner ? (
            <Button
              variant="secondary"
              label={t('circleMembers.makeOwner')}
              onPress={() => {
                setError(null);
                setMode('owner');
              }}
            />
          ) : null}
          {showReactivate ? (
            <Button
              variant="secondary"
              label={t('circleMembers.reactivate')}
              loading={busy}
              onPress={() =>
                run(() =>
                  updateStatus.mutateAsync({ memberId: shown.memberId, status: 'active' }),
                )
              }
            />
          ) : null}
          {showRemove ? (
            <Button
              variant="danger"
              label={t('circleMembers.remove')}
              onPress={() => {
                setError(null);
                setMode('remove');
              }}
            />
          ) : null}
          {showLeave ? (
            <Button
              variant="danger"
              label={t('circleMembers.leave')}
              onPress={() => {
                setError(null);
                setMode('leave');
              }}
            />
          ) : null}
          {errorNode}
        </>
      ) : mode === 'role' ? (
        <>
          <Text style={[styles.note, { color: c.textSecondary }]}>{t('circleMembers.changeRoleHint')}</Text>
          <OptionSelect
            variant="card"
            value={selectedRole}
            onChange={setSelectedRole}
            options={roleOptions.map((r) => ({
              value: r,
              label: t(`circleMembers.roles.${r}`),
              description: t(`circleMembers.roleDescriptions.${r}`),
            }))}
          />
          {roleChanged ? (
            <Text style={[styles.note, { color: c.textSecondary }]}>
              {t(`circleMembers.direction.${direction}`)}
            </Text>
          ) : null}
          {errorNode}
          <Button
            label={t('circleMembers.saveRole')}
            loading={busy}
            onPress={() => {
              if (!roleChanged) {
                setMode('menu');
                return;
              }
              run(() => updateRole.mutateAsync({ memberId: shown.memberId, role: selectedRole }));
            }}
          />
          <Button
            variant="secondary"
            label={t('common.cancel')}
            disabled={busy}
            onPress={() => setMode('menu')}
          />
        </>
      ) : (
        <>
          <Text style={[styles.body, { color: c.text }]}>{confirm[mode].body}</Text>
          {errorNode}
          <Button
            variant={confirm[mode].danger ? 'danger' : 'primary'}
            label={confirm[mode].btn}
            loading={busy}
            onPress={confirm[mode].go}
          />
          <Button
            variant="secondary"
            label={t('common.cancel')}
            disabled={busy}
            onPress={() => setMode('menu')}
          />
        </>
      )}
    </FigmaBottomSheet>
  );
}

const styles = StyleSheet.create({
  role: { fontSize: 14, fontFamily: FontFamily.medium },
  note: { fontSize: 14, fontFamily: FontFamily.regular, lineHeight: 21 },
  body: { fontSize: 15, fontFamily: FontFamily.regular, lineHeight: 23 },
  error: { fontSize: 14, fontFamily: FontFamily.medium },
});
