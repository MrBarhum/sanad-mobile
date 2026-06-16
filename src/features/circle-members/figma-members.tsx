import { useRouter } from 'expo-router';
import { Crown, Edit3, Eye, UserMinus } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { FigmaCard } from '@/components/figma/figma-card';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import {
  FigmaCategory,
  FigmaColors,
  FigmaFont,
  FigmaRadius,
  withAlpha,
  type FigmaScheme,
} from '@/components/figma/figma-tokens';
import { isolateLtr } from '@/components/ltr-text';

import { memberErrorKey, type CircleMember, type CircleRole } from './api';
import { useCircleMembers, useUpdateMemberStatus } from './hooks';
import { canChangeStatus, isLastActiveAdmin, isManagerRole } from './permissions';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/**
 * Per-role visual identity for the Figma roster: an icon + a color (status is
 * always icon + text + color, never color-only). Mirrors the Figma export's
 * three role glyphs (Crown / Edit3 / Eye) extended over Sanad's real role set —
 * managers (admin / primary_caregiver) read as Crown+teal, contributors
 * (family_member / caregiver) as Edit3+gold, view-only (remote_member / elder)
 * as Eye+purple. Labels still come from `circleMembers.roles.*` verbatim.
 */
function roleVisual(
  role: CircleRole,
  primary: string,
): { Icon: IconCmp; color: string } {
  if (role === 'admin' || role === 'primary_caregiver') {
    return { Icon: Crown, color: primary };
  }
  if (role === 'family_member' || role === 'caregiver') {
    return { Icon: Edit3, color: FigmaCategory.gold };
  }
  return { Icon: Eye, color: FigmaCategory.purple };
}

/** First grapheme of a display name, for the letter avatar. */
function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

/**
 * The Figma Make Members screen (`MembersScreen.tsx`), recreated as literally as
 * possible in React Native and wired to real Sanad data. Mirrors the export:
 * a back/title/teal-invite header, a circle summary line, letter-avatar member
 * rows (name + you-badge + role icon/label + email, with a UserMinus remove for
 * non-self members when permitted), and a plain-language role legend card.
 *
 * Reuses `MembersManager`'s hooks and permission gating verbatim
 * (`useCircleMembers`, `useUpdateMemberStatus`, `isManagerRole`,
 * `canChangeStatus`, `isLastActiveAdmin`); the RPCs stay authoritative. The
 * invite "+" routes to the existing `/circle-members/invite` flow — no form is
 * rebuilt here. Cairo + Figma tokens, RTL. No old Sanad
 * Screen/Surface/Section/GlyphChip/StatusBadge/Button.
 */
export function FigmaMembers({
  circleId,
  actorRole,
  circleName,
  recipientName,
}: {
  circleId: string;
  actorRole: CircleRole;
  circleName: string;
  recipientName: string | null;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const scheme: FigmaScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = FigmaColors[scheme];

  const members = useCircleMembers(circleId);
  const updateStatus = useUpdateMemberStatus(circleId);

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = isManagerRole(actorRole);

  async function removeMember(member: CircleMember) {
    setActionError(null);
    setPendingId(member.memberId);
    try {
      await updateStatus.mutateAsync({ memberId: member.memberId, status: 'removed' });
    } catch (error) {
      setActionError(t(memberErrorKey(error)));
    } finally {
      setPendingId(null);
    }
  }

  const all = members.data ?? [];
  // The Figma roster shows the active care team; the summary count matches it.
  const active = all.filter((m) => m.status === 'active');

  const summaryName = recipientName?.trim() || circleName;
  const summary = t('figma.members.summary', {
    name: summaryName,
    count: active.length,
  });

  return (
    <FigmaScreen>
      <FigmaHeader
        title={t('figma.members.title')}
        onAdd={canManage ? () => router.push('/circle-members/invite') : undefined}
        addAccessibilityLabel={t('invitations.invite')}
      />

      {members.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : members.isError ? (
        <FigmaCard tone="card" radius={FigmaRadius.r16}>
          <Text style={[styles.errorText, { color: c.error }]}>{t('circleMembers.loadError')}</Text>
          <Pressable
            onPress={() => members.refetch()}
            accessibilityRole="button"
            style={[styles.retry, { backgroundColor: c.primary }]}>
            <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
          </Pressable>
        </FigmaCard>
      ) : (
        <>
          {/* Circle summary line (real recipient name + active member count). */}
          <View
            style={[
              styles.summary,
              { backgroundColor: withAlpha(c.primary, 0.08), borderColor: withAlpha(c.primary, 0.15) },
            ]}>
            <Text style={[styles.summaryText, { color: c.muted }]}>{summary}</Text>
          </View>

          {actionError ? (
            <Text
              style={[styles.actionError, { color: c.error }]}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite">
              {actionError}
            </Text>
          ) : null}

          {/* Member rows */}
          <View style={styles.list}>
            {active.map((member) => {
              const displayName =
                member.fullName?.trim() || member.email || t('circleMembers.unnamed');
              const visual = roleVisual(member.role, c.primary);
              const lastAdmin = isLastActiveAdmin(member, all);
              // Remove gating mirrors MembersManager.MemberCard's `showRemove`.
              const showRemove =
                !member.isSelf &&
                canChangeStatus(actorRole, member) &&
                member.status === 'active' &&
                !lastAdmin &&
                !member.isOwner;
              const busy = pendingId === member.memberId;
              // Only show the email line when it adds info beyond the name.
              const emailLine = member.email && member.fullName ? member.email : null;

              return (
                <View
                  key={member.memberId}
                  style={[styles.row, { backgroundColor: c.card, borderColor: c.border }]}>
                  <View style={[styles.avatar, { backgroundColor: withAlpha(visual.color, 0.15) }]}>
                    <Text style={[styles.avatarText, { color: visual.color }]}>
                      {initialOf(displayName)}
                    </Text>
                  </View>

                  <View style={styles.info}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
                        {displayName}
                      </Text>
                      {member.isSelf ? (
                        <View style={[styles.youBadge, { backgroundColor: c.mutedSurface }]}>
                          <Text style={[styles.youText, { color: c.muted }]}>
                            {t('circleMembers.you')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.metaRow}>
                      <visual.Icon size={11} color={visual.color} />
                      <Text style={[styles.roleText, { color: visual.color }]}>
                        {t(`circleMembers.roles.${member.role}`)}
                      </Text>
                      {emailLine ? (
                        <>
                          <Text style={[styles.metaDot, { color: c.muted }]}>·</Text>
                          <Text style={[styles.email, { color: c.muted }]} numberOfLines={1} selectable>
                            {isolateLtr(emailLine)}
                          </Text>
                        </>
                      ) : null}
                    </View>
                  </View>

                  {showRemove ? (
                    <Pressable
                      onPress={() => removeMember(member)}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('circleMembers.remove')} ${displayName}`}
                      style={[styles.removeBtn, busy && styles.dim]}>
                      {busy ? (
                        <ActivityIndicator size="small" color={c.muted} />
                      ) : (
                        <UserMinus size={18} color={c.muted} />
                      )}
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>

          {/* Role legend (plain-language) */}
          <FigmaCard tone="card" radius={FigmaRadius.r24} padding={16}>
            <Text style={[styles.legendTitle, { color: c.text }]}>{t('figma.members.rolesTitle')}</Text>
            {(
              [
                { color: c.primary, role: 'manager', desc: 'managerDesc' },
                { color: FigmaCategory.gold, role: 'editor', desc: 'editorDesc' },
                { color: FigmaCategory.purple, role: 'viewer', desc: 'viewerDesc' },
              ] as const
            ).map((r) => (
              <View key={r.role} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: r.color }]} />
                <Text style={[styles.legendText, { color: c.muted }]}>
                  <Text style={[styles.legendRole, { color: c.text }]}>
                    {t(`figma.members.legend.${r.role}`)}
                    {t('figma.members.legendSeparator')}
                  </Text>{' '}
                  {t(`figma.members.legend.${r.desc}`)}
                </Text>
              </View>
            ))}
          </FigmaCard>
        </>
      )}
    </FigmaScreen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 14, fontFamily: FigmaFont.medium, textAlign: 'center' },
  retry: {
    marginTop: 12,
    alignSelf: 'center',
    borderRadius: FigmaRadius.r12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { fontSize: 13, fontFamily: FigmaFont.semibold },
  // Summary line
  summary: {
    borderRadius: FigmaRadius.r16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  summaryText: { fontSize: 13, fontFamily: FigmaFont.regular },
  actionError: { fontSize: 13, fontFamily: FigmaFont.medium },
  // Member rows
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: FigmaRadius.r16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: FigmaRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontFamily: FigmaFont.bold },
  info: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontFamily: FigmaFont.semibold, flexShrink: 1 },
  youBadge: { borderRadius: FigmaRadius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  youText: { fontSize: 10, fontFamily: FigmaFont.medium },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  roleText: { fontSize: 12, fontFamily: FigmaFont.medium },
  metaDot: { fontSize: 11, fontFamily: FigmaFont.regular },
  email: { fontSize: 11, fontFamily: FigmaFont.regular, flexShrink: 1 },
  removeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.5 },
  // Role legend
  legendTitle: { fontSize: 13, fontFamily: FigmaFont.bold, marginBottom: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  legendDot: { width: 8, height: 8, borderRadius: FigmaRadius.pill, marginTop: 6 },
  legendText: { flex: 1, fontSize: 13, fontFamily: FigmaFont.regular, lineHeight: 20 },
  legendRole: { fontFamily: FigmaFont.semibold },
});
