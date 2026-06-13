import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { GlyphChip } from '@/components/glyph-chip';
import { LtrText } from '@/components/ltr-text';
import { Screen } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { Section, Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { memberErrorKey, type CircleMember, type CircleRole } from './api';
import {
  useCircleMembers,
  useLeaveCircle,
  useTransferOwnership,
  useUpdateMemberRole,
  useUpdateMemberStatus,
} from './hooks';
import {
  assignableRolesFor,
  canChangeStatus,
  isLastActiveAdmin,
  isManagerRole,
} from './permissions';
import { RoleModal } from './role-modal';

/**
 * Circle roster with manager controls. Any active member sees the list; only
 * managers see role/status actions, and the UI hides controls the RPC would
 * reject (and explains the last-admin lock). The RPCs remain authoritative.
 */
export function MembersManager({
  circleId,
  actorRole,
}: {
  circleId: string;
  actorRole: CircleRole;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const members = useCircleMembers(circleId);
  const updateRole = useUpdateMemberRole(circleId);
  const updateStatus = useUpdateMemberStatus(circleId);
  const leave = useLeaveCircle();
  const transfer = useTransferOwnership(circleId);

  const [editingRole, setEditingRole] = useState<CircleMember | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // The role modal surfaces its own error so it can stay open for a retry.
  const [roleError, setRoleError] = useState<string | null>(null);

  const canManage = isManagerRole(actorRole);

  function openRoleEditor(member: CircleMember) {
    setRoleError(null);
    setEditingRole(member);
  }

  async function changeStatus(member: CircleMember, next: 'active' | 'removed') {
    setActionError(null);
    try {
      await updateStatus.mutateAsync({ memberId: member.memberId, status: next });
    } catch (error) {
      setActionError(t(memberErrorKey(error)));
    }
  }

  async function onLeave() {
    setActionError(null);
    try {
      await leave.mutateAsync(circleId);
      router.replace('/');
    } catch (error) {
      setActionError(t(memberErrorKey(error)));
    }
  }

  async function onMakeOwner(member: CircleMember) {
    setActionError(null);
    try {
      await transfer.mutateAsync(member.userId);
    } catch (error) {
      setActionError(t(memberErrorKey(error)));
    }
  }

  if (members.isLoading) return <LoadingState />;
  if (members.isError) {
    return (
      <ErrorState
        message={t('circleMembers.loadError')}
        retryLabel={t('retry')}
        onRetry={() => members.refetch()}
      />
    );
  }

  const all = members.data ?? [];
  const active = all.filter((m) => m.status === 'active');
  const inactive = all.filter((m) => m.status !== 'active');
  const viewerIsOwner = all.some((m) => m.isSelf && m.isOwner);
  const busy = updateStatus.isPending || leave.isPending || transfer.isPending;

  return (
    <>
      <Screen>
        {canManage ? (
          <View style={styles.actionsRow}>
            <Button label={t('invitations.invite')} onPress={() => router.push('/circle-members/invite')} />
            <Button
              label={t('invitations.manageTitle')}
              variant="secondary"
              onPress={() => router.push('/circle-members/invitations')}
            />
          </View>
        ) : null}

        {actionError ? (
          <ThemedText
            style={{ color: theme.errorFg }}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite">
            {actionError}
          </ThemedText>
        ) : null}

        <Section title={t('circleMembers.activeTitle')}>
          <View style={styles.list}>
            {active.map((member) => (
              <MemberCard
                key={member.memberId}
                member={member}
                members={all}
                actorRole={actorRole}
                viewerIsOwner={viewerIsOwner}
                busy={busy}
                onEditRole={() => openRoleEditor(member)}
                onRemove={() => changeStatus(member, 'removed')}
                onReactivate={() => changeStatus(member, 'active')}
                onLeave={onLeave}
                onMakeOwner={() => onMakeOwner(member)}
              />
            ))}
          </View>
        </Section>

        {inactive.length > 0 ? (
          <Section title={t('circleMembers.inactiveTitle')}>
            <View style={styles.list}>
              {inactive.map((member) => (
                <MemberCard
                  key={member.memberId}
                  member={member}
                  members={all}
                  actorRole={actorRole}
                  viewerIsOwner={viewerIsOwner}
                  busy={busy}
                  onEditRole={() => openRoleEditor(member)}
                  onRemove={() => changeStatus(member, 'removed')}
                  onReactivate={() => changeStatus(member, 'active')}
                  onLeave={onLeave}
                  onMakeOwner={() => onMakeOwner(member)}
                />
              ))}
            </View>
          </Section>
        ) : null}
      </Screen>

      {editingRole ? (
        <RoleModal
          key={editingRole.memberId}
          member={editingRole}
          actorRole={actorRole}
          submitting={updateRole.isPending}
          error={roleError}
          onClose={() => {
            setEditingRole(null);
            setRoleError(null);
          }}
          onSave={async (role) => {
            setRoleError(null);
            try {
              await updateRole.mutateAsync({ memberId: editingRole.memberId, role });
              setEditingRole(null);
            } catch (error) {
              // Keep the modal open so the manager can adjust and retry.
              setRoleError(t(memberErrorKey(error)));
            }
          }}
        />
      ) : null}
    </>
  );
}

function MemberCard({
  member,
  members,
  actorRole,
  viewerIsOwner,
  busy,
  onEditRole,
  onRemove,
  onReactivate,
  onLeave,
  onMakeOwner,
}: {
  member: CircleMember;
  members: CircleMember[];
  actorRole: CircleRole;
  viewerIsOwner: boolean;
  busy: boolean;
  onEditRole: () => void;
  onRemove: () => void;
  onReactivate: () => void;
  onLeave: () => void;
  onMakeOwner: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [confirmingOwner, setConfirmingOwner] = useState(false);

  const lastAdmin = isLastActiveAdmin(member, members);
  // The owner can't be demoted/removed/leave until ownership is transferred.
  const canEditRole =
    assignableRolesFor(actorRole, member).length > 0 && !lastAdmin && !member.isOwner;
  const canStatus = canChangeStatus(actorRole, member);
  const displayName = member.fullName?.trim() || member.email || t('circleMembers.unnamed');
  // Only the current owner may hand ownership to another active member.
  const canMakeOwner =
    viewerIsOwner && !member.isOwner && !member.isSelf && member.status === 'active';

  // Purely presentational: the divider-separated action row renders only when at
  // least one action is visible (same conditions as the buttons below).
  const showLeave = member.isSelf && member.status === 'active' && !lastAdmin && !member.isOwner;
  const showRemove =
    !member.isSelf && canStatus && member.status === 'active' && !lastAdmin && !member.isOwner;
  const showReactivate = canStatus && member.status !== 'active';
  const hasActions = canEditRole || showLeave || showRemove || showReactivate || canMakeOwner;

  return (
    <Surface style={styles.card}>
      <View style={styles.cardHeader}>
        <GlyphChip glyph={[...displayName.trim()][0] ?? 'â€¢'} tone="primary" size="sm" />
        <ThemedText type="cardTitle" style={styles.cardName}>
          {displayName}
        </ThemedText>
        <View style={styles.badges}>
          {member.isOwner ? (
            <StatusBadge tone="info" label={t('circleMembers.owner')} />
          ) : null}
          {member.isSelf ? (
            <StatusBadge tone="neutral" label={t('circleMembers.you')} />
          ) : null}
        </View>
      </View>

      {member.email && member.fullName ? (
        <LtrText type="small" themeColor="textSecondary" selectable>
          {member.email}
        </LtrText>
      ) : null}

      <View style={styles.metaRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {t(`circleMembers.roles.${member.role}`)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          â€¢
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t(`circleMembers.status.${member.status}`)}
        </ThemedText>
      </View>

      {member.isOwner ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          {t('circleMembers.ownerNote')}
        </ThemedText>
      ) : lastAdmin ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          {t('circleMembers.lastAdminNote')}
        </ThemedText>
      ) : null}

      {hasActions ? (
        <View style={[styles.cardActions, { borderTopColor: theme.divider }]}>
          {canEditRole ? (
            <Button
              size="sm"
              variant="secondary"
              label={t('circleMembers.changeRole')}
              disabled={busy}
              onPress={onEditRole}
            />
          ) : null}

          {showLeave ? (
            <Button size="sm" variant="danger" label={t('circleMembers.leave')} disabled={busy} onPress={onLeave} />
          ) : null}

          {showRemove ? (
            confirmingRemove ? (
              <>
                <Button
                  size="sm"
                  variant="danger"
                  label={t('circleMembers.confirmRemove')}
                  loading={busy}
                  onPress={onRemove}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  label={t('common.cancel')}
                  disabled={busy}
                  onPress={() => setConfirmingRemove(false)}
                />
              </>
            ) : (
              <Button
                size="sm"
                variant="danger"
                label={t('circleMembers.remove')}
                disabled={busy}
                onPress={() => setConfirmingRemove(true)}
              />
            )
          ) : null}

          {showReactivate ? (
            <Button
              size="sm"
              variant="secondary"
              label={t('circleMembers.reactivate')}
              disabled={busy}
              onPress={onReactivate}
            />
          ) : null}

          {canMakeOwner ? (
            confirmingOwner ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  label={t('circleMembers.confirmMakeOwner')}
                  loading={busy}
                  onPress={onMakeOwner}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  label={t('common.cancel')}
                  disabled={busy}
                  onPress={() => setConfirmingOwner(false)}
                />
              </>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                label={t('circleMembers.makeOwner')}
                disabled={busy}
                onPress={() => setConfirmingOwner(true)}
              />
            )
          ) : null}
        </View>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  actionsRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  list: { gap: Spacing.three },
  card: { gap: Spacing.two },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  cardName: { flex: 1 },
  badges: { flexDirection: 'row', gap: Spacing.one, flexShrink: 0 },
  metaRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', flexWrap: 'wrap' },
  note: { fontStyle: 'italic' },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
    marginTop: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
});
