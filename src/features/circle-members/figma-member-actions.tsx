import { AlertTriangle, ArrowDown, ArrowLeftRight, ArrowUp } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FigmaBottomSheet } from '@/components/figma/figma-bottom-sheet';
import { Button } from '@/components/button';
import { isolateLtr } from '@/components/ltr-text';
import { OptionSelect } from '@/components/option-select';
import { BorderWidth, FontFamily, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { CaregiverDisclosure } from '@/features/caregiver/caregiver-disclosure';
import { useTheme } from '@/hooks/use-theme';

import { memberErrorKey, type CircleMember, type CircleRole } from './api';
import { emailLocalPart, memberDisplayName } from './display-name';
import {
  useLeaveCircle,
  useTransferOwnership,
  useUpdateMemberRole,
  useUpdateMemberStatus,
} from './hooks';
import { assignableRolesFor, canChangeStatus, isLastActiveAdmin } from './permissions';
import { roleChangeDirection, type RoleChangeDirection } from './role-capabilities';

type ConfirmKind = 'remove' | 'leave' | 'owner';
type Mode = 'menu' | 'role' | ConfirmKind;

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/**
 * The live role-change effect note (frame 9b): a bordered tinted callout whose tone
 * signals whether the change lowers (amber caution, down arrow), raises (green
 * accent, up arrow) or laterally shifts (neutral, side arrows) the member's access.
 * The frame depicts the downgrade case; the other two reuse the same chrome.
 */
const DIRECTION_VISUAL: Record<RoleChangeDirection, { fg: ThemeColor; tint: ThemeColor; Icon: IconCmp }> = {
  increase: { fg: 'primaryText', tint: 'primaryBg', Icon: ArrowUp },
  decrease: { fg: 'warningFg', tint: 'warningBg', Icon: ArrowDown },
  lateral: { fg: 'textSecondary', tint: 'backgroundSunken', Icon: ArrowLeftRight },
};

/**
 * Whether a pending role change crosses INTO or OUT OF the hired-caregiver role.
 * That change does something no privilege direction can express: it swaps which app
 * shell the person opens, and only on their next app launch. `caregiver` ranks
 * laterally with `remote_member` on purpose (see `role-capabilities.ts`), so the
 * increase/decrease/lateral note alone would leave the consequential part unsaid.
 */
function crossesCaregiverShell(from: CircleRole, to: CircleRole): boolean {
  return from !== to && (from === 'caregiver' || to === 'caregiver');
}

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

  // The SAME name the roster row above shows — `memberDisplayName` exists so a
  // full email address is never rendered inline (only its local-part). This sheet
  // used to bypass it, so the same member read as «nour» in the list and
  // «nour@example.com» in the sheet title, and that raw address then propagated
  // into the remove and make-owner confirm bodies.
  const displayName = memberDisplayName(shown, t('circleMembers.unnamed'));
  // Isolate ONLY when the name fell back to the Latin local-part. LRI…PDI sets an
  // LTR base direction, which would reverse the word order of an Arabic name.
  const isLocalPart = !shown.fullName?.trim() && Boolean(emailLocalPart(shown.email));
  const titleName = isLocalPart ? isolateLtr(displayName) : displayName;
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
  const dirVisual = DIRECTION_VISUAL[direction];
  const DirectionIcon = dirVisual.Icon;
  const shellChanges = crossesCaregiverShell(shown.role, selectedRole);
  // Both notes amber → one callout with an internal rule; different tones → two.
  const mergeNotes = shellChanges && dirVisual.fg === 'warningFg';
  const promoteToCaregiver = selectedRole === 'caregiver' && shown.role !== 'caregiver';

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
            : titleName;

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
          <Text style={[styles.hint, { color: c.textSecondary }]}>{t('circleMembers.changeRoleHint')}</Text>
          <OptionSelect
            variant="card"
            value={selectedRole}
            onChange={setSelectedRole}
            options={roleOptions.map((r) => ({
              value: r,
              label: t(`circleMembers.roles.${r}`),
              description: t(`circleMembers.roleDescriptions.${r}`),
              // The card the member is on today says so, so «حفظ» is never a
              // guess about what is actually changing.
              titleSuffix: r === shown.role ? t('circleMembers.currentRoleSuffix') : undefined,
            }))}
          />

          {/*
            Promoting someone INTO the caregiver role grants exactly the scope the
            invite screen discloses in three cards — so it discloses it here too.
            Without this, a manager could hand out the whole scope by role change
            having read one sentence. Leaving the role needs no scope disclosure,
            only the shell warning below.
          */}
          {promoteToCaregiver ? <CaregiverDisclosure /> : null}

          {/*
            The effect notes. Crossing into or out of the hired caregiver role
            swaps which app view the person opens, and only on their next launch —
            a consequence no privilege direction can express, since `caregiver`
            ranks laterally with `remote_member` on purpose.

            When BOTH notes are amber (the decrease case) they merge into ONE
            callout with an internal rule: two identical amber boxes stacked read
            as the same warning repeated, which teaches the reader to skip the
            second. When the tones differ they stay two boxes, because then the
            colour is carrying real information.
          */}
          {roleChanged ? (
            mergeNotes ? (
              <View
                style={[styles.mergedNote, { borderColor: c.warningFg, backgroundColor: c.warningBg }]}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite">
                <View style={styles.noteRow}>
                  <DirectionIcon size={15} color={c.warningFg} strokeWidth={2.4} />
                  <Text style={[styles.directionText, { color: c.warningFg }]}>
                    {t(`circleMembers.direction.${direction}`)}
                  </Text>
                </View>
                <View style={[styles.noteRule, { backgroundColor: c.warningFg }]} />
                <View style={styles.noteRowTop}>
                  <AlertTriangle size={17} color={c.warningFg} strokeWidth={2.4} style={styles.shellIcon} />
                  <Text style={[styles.shellText, { color: c.warningFg }]}>
                    {t('caregiver.roster.shellChangeWarning')}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.tightStack}>
                <View
                  style={[styles.directionNote, { borderColor: c[dirVisual.fg], backgroundColor: c[dirVisual.tint] }]}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite">
                  <DirectionIcon size={15} color={c[dirVisual.fg]} strokeWidth={2.4} />
                  <Text style={[styles.directionText, { color: c[dirVisual.fg] }]}>
                    {t(`circleMembers.direction.${direction}`)}
                  </Text>
                </View>
                {shellChanges ? (
                  <View
                    style={[styles.directionNote, { borderColor: c.warningFg, backgroundColor: c.warningBg }]}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite">
                    <AlertTriangle size={17} color={c.warningFg} strokeWidth={2.4} style={styles.shellIcon} />
                    <Text style={[styles.shellText, { color: c.warningFg }]}>
                      {t('caregiver.roster.shellChangeWarning')}
                    </Text>
                  </View>
                ) : null}
              </View>
            )
          ) : null}
          {errorNode}
          <View style={styles.tightStack}>
            {/* Save is inert until something actually changed. It used to be a
                full-strength CTA that, on tap with no change, quietly closed the
                pane having saved nothing — «إلغاء» is right below and is the
                honest way out. */}
            <Button
              label={t('circleMembers.saveRole')}
              loading={busy}
              disabled={!roleChanged}
              style={!roleChanged && styles.idlePrimary}
              onPress={() =>
                run(() => updateRole.mutateAsync({ memberId: shown.memberId, role: selectedRole }))
              }
            />
            <Button
              variant="secondary"
              label={t('common.cancel')}
              disabled={busy}
              onPress={() => setMode('menu')}
            />
          </View>
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
  hint: { fontSize: 15, fontFamily: FontFamily.medium, lineHeight: 23, textAlign: 'center' },
  body: { fontSize: 15, fontFamily: FontFamily.regular, lineHeight: 23 },
  directionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  directionText: { flex: 1, fontSize: 14, fontFamily: FontFamily.semibold, lineHeight: 22 },
  // The merged (both-amber) callout: same chrome as directionNote, but a column
  // holding the two rows either side of a hairline rule.
  mergedNote: {
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteRowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noteRule: { height: BorderWidth.thin, opacity: 0.35, marginVertical: 9 },
  // The sheet body gaps every child at 16; these pairs are one unit at 8.
  tightStack: { gap: Spacing.two },
  idlePrimary: { opacity: 0.45 },
  // The shell-change warning is a running sentence, not a meta label, so it sits at
  // the 16px body floor with a top-aligned icon (the note wraps to 2–3 lines).
  shellIcon: { alignSelf: 'flex-start', marginTop: 3 },
  shellText: { flex: 1, fontSize: 16, fontFamily: FontFamily.semibold, lineHeight: 25 },
  error: { fontSize: 14, fontFamily: FontFamily.medium },
});
