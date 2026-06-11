import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FormModal } from '@/components/form-modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

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

const DANGER = '#dc2626';

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
  const router = useRouter();
  const members = useCircleMembers(circleId);
  const updateRole = useUpdateMemberRole(circleId);
  const updateStatus = useUpdateMemberStatus(circleId);
  const leave = useLeaveCircle();
  const transfer = useTransferOwnership(circleId);

  const [editingRole, setEditingRole] = useState<CircleMember | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = isManagerRole(actorRole);

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
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
          <ThemedText style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {actionError}
          </ThemedText>
        ) : null}

        <ThemedText type="smallBold">{t('circleMembers.activeTitle')}</ThemedText>
        <View style={styles.list}>
          {active.map((member) => (
            <MemberCard
              key={member.memberId}
              member={member}
              members={all}
              actorRole={actorRole}
              viewerIsOwner={viewerIsOwner}
              busy={busy}
              onEditRole={() => setEditingRole(member)}
              onRemove={() => changeStatus(member, 'removed')}
              onReactivate={() => changeStatus(member, 'active')}
              onLeave={onLeave}
              onMakeOwner={() => onMakeOwner(member)}
            />
          ))}
        </View>

        {inactive.length > 0 ? (
          <>
            <ThemedText type="smallBold" style={styles.inactiveHeading}>
              {t('circleMembers.inactiveTitle')}
            </ThemedText>
            <View style={styles.list}>
              {inactive.map((member) => (
                <MemberCard
                  key={member.memberId}
                  member={member}
                  members={all}
                  actorRole={actorRole}
                  viewerIsOwner={viewerIsOwner}
                  busy={busy}
                  onEditRole={() => setEditingRole(member)}
                  onRemove={() => changeStatus(member, 'removed')}
                  onReactivate={() => changeStatus(member, 'active')}
                  onLeave={onLeave}
                  onMakeOwner={() => onMakeOwner(member)}
                />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      {editingRole ? (
        <RoleModal
          key={editingRole.memberId}
          member={editingRole}
          actorRole={actorRole}
          submitting={updateRole.isPending}
          onClose={() => setEditingRole(null)}
          onSelect={async (role) => {
            setActionError(null);
            try {
              await updateRole.mutateAsync({ memberId: editingRole.memberId, role });
              setEditingRole(null);
            } catch (error) {
              setActionError(t(memberErrorKey(error)));
              setEditingRole(null);
            }
          }}
        />
      ) : null}
    </ThemedView>
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

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.cardName}>{displayName}</ThemedText>
        <View style={styles.badges}>
          {member.isOwner ? (
            <ThemedView type="backgroundSelected" style={styles.badge}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('circleMembers.owner')}
              </ThemedText>
            </ThemedView>
          ) : null}
          {member.isSelf ? (
            <ThemedView type="backgroundSelected" style={styles.badge}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('circleMembers.you')}
              </ThemedText>
            </ThemedView>
          ) : null}
        </View>
      </View>

      {member.email && member.fullName ? (
        <ThemedText type="small" themeColor="textSecondary" selectable>
          {member.email}
        </ThemedText>
      ) : null}

      <View style={styles.metaRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {t(`circleMembers.roles.${member.role}`)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          •
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

      <View style={styles.cardActions}>
        {canEditRole ? (
          <Button
            size="sm"
            variant="secondary"
            label={t('circleMembers.changeRole')}
            disabled={busy}
            onPress={onEditRole}
          />
        ) : null}

        {member.isSelf && member.status === 'active' && !lastAdmin && !member.isOwner ? (
          <Button size="sm" variant="danger" label={t('circleMembers.leave')} disabled={busy} onPress={onLeave} />
        ) : null}

        {!member.isSelf && canStatus && member.status === 'active' && !lastAdmin && !member.isOwner ? (
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

        {canStatus && member.status !== 'active' ? (
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
    </ThemedView>
  );
}

function RoleModal({
  member,
  actorRole,
  submitting,
  onClose,
  onSelect,
}: {
  member: CircleMember;
  actorRole: CircleRole;
  submitting: boolean;
  onClose: () => void;
  onSelect: (role: CircleRole) => void;
}) {
  const { t } = useTranslation();
  const roles = assignableRolesFor(actorRole, member);

  return (
    <FormModal
      visible
      title={t('circleMembers.changeRoleTitle')}
      submitLabel={t('common.close')}
      cancelLabel={t('common.cancel')}
      closeLabel={t('common.close')}
      submitting={submitting}
      onSubmit={onClose}
      onClose={onClose}>
      <ThemedText type="small" themeColor="textSecondary">
        {t('circleMembers.changeRoleHint')}
      </ThemedText>
      <View style={styles.roleOptions}>
        {roles.map((role) => {
          const current = role === member.role;
          return (
            <Pressable
              key={role}
              onPress={() => !submitting && onSelect(role)}
              accessibilityRole="button"
              accessibilityState={{ selected: current, disabled: submitting }}
              style={({ pressed }) => [pressed && styles.pressed]}>
              <ThemedView
                type={current ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.roleOption}>
                <ThemedText style={styles.roleLabel}>{t(`circleMembers.roles.${role}`)}</ThemedText>
                {current ? <ThemedText type="small">✓</ThemedText> : null}
              </ThemedView>
            </Pressable>
          );
        })}
      </View>
    </FormModal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  actionsRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  list: { gap: Spacing.three },
  inactiveHeading: { marginTop: Spacing.three },
  card: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.two },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardName: { fontSize: 18, fontWeight: '600', flexShrink: 1 },
  badges: { flexDirection: 'row', gap: Spacing.one, flexShrink: 0 },
  badge: { borderRadius: Spacing.five, paddingVertical: Spacing.half, paddingHorizontal: Spacing.two },
  metaRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', flexWrap: 'wrap' },
  note: { fontStyle: 'italic' },
  cardActions: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap', marginTop: Spacing.one },
  roleOptions: { gap: Spacing.two },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.three,
    padding: Spacing.three,
    minHeight: 52,
  },
  roleLabel: { fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  error: { color: DANGER },
});
