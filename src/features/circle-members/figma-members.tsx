import { useRouter } from 'expo-router';
import { Crown, Edit3, Eye, MoreHorizontal } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SkeletonList } from '@/components/skeleton';

import { Button } from '@/components/button';
import { FigmaCard } from '@/components/figma/figma-card';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { isolateLtr } from '@/components/ltr-text';
import { FontFamily, Radius, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { CircleMember, CircleRole } from './api';
import { memberDisplayName } from './display-name';
import { MemberActionsSheet, memberHasActions } from './figma-member-actions';
import { useCircleMembers } from './hooks';
import { isManagerRole } from './permissions';

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
  gold: string,
  purple: string,
): { Icon: IconCmp; color: string } {
  if (role === 'admin' || role === 'primary_caregiver') {
    return { Icon: Crown, color: primary };
  }
  if (role === 'family_member' || role === 'caregiver') {
    return { Icon: Edit3, color: gold };
  }
  return { Icon: Eye, color: purple };
}

/** First grapheme of a display name, for the letter avatar. */
function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

/**
 * The Figma Make Members screen (`MembersScreen.tsx`), recreated as literally as
 * possible in React Native and wired to real Sanad data. Mirrors the export:
 * a back/title/teal-invite header, a circle summary line, letter-avatar member
 * rows (name + you-badge + role icon/label + email), and a plain-language role
 * legend card.
 *
 * Beyond the export, every membership action that previously lived only in the
 * unrouted legacy MembersManager is now reachable here: tapping a member the
 * viewer can act on opens {@link MemberActionsSheet} (change role, reactivate,
 * remove, transfer ownership); a member's own row opens the same sheet to leave
 * the circle; and managers get a link into the invitations list. Removed members
 * are shown to managers so they can be reactivated. The membership RPCs stay
 * authoritative; the gates here (`memberHasActions`, `isManagerRole`) only decide
 * what to surface.
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
  const c = useTheme();

  const members = useCircleMembers(circleId);

  const [selected, setSelected] = useState<CircleMember | null>(null);

  const canManage = isManagerRole(actorRole);

  const all = members.data ?? [];
  const active = all.filter((m) => m.status === 'active');
  // Managers can reactivate removed members, so they see the inactive list too.
  const inactive = canManage ? all.filter((m) => m.status !== 'active') : [];

  const summaryName = recipientName?.trim() || circleName;
  const summary = t('figma.members.summary', { name: summaryName, count: active.length });

  function renderRow(member: CircleMember) {
    const displayName = memberDisplayName(member, t('circleMembers.unnamed'));
    const visual = roleVisual(member.role, c.primary, c.categoryGold, c.categoryPurple);
    const actionable = memberHasActions(member, all, actorRole);
    // Only show the email line when it adds info beyond the name.
    const emailLine = member.email && member.fullName ? member.email : null;
    const dim = member.status !== 'active';

    const content = (
      <>
        <View style={[styles.avatar, { backgroundColor: withAlpha(visual.color, 0.15) }]}>
          <Text style={[styles.avatarText, { color: visual.color }]}>{initialOf(displayName)}</Text>
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            {member.isSelf ? (
              <View style={[styles.youBadge, { backgroundColor: c.backgroundSunken }]}>
                <Text style={[styles.youText, { color: c.textSecondary }]}>{t('circleMembers.you')}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.metaRow}>
            <visual.Icon size={11} color={visual.color} />
            <Text style={[styles.roleText, { color: visual.color }]}>
              {t(`circleMembers.roles.${member.role}`)}
            </Text>
            {dim ? (
              <>
                <Text style={[styles.metaDot, { color: c.textSecondary }]}>·</Text>
                <Text style={[styles.statusText, { color: c.textSecondary }]}>
                  {t(`circleMembers.status.${member.status}`)}
                </Text>
              </>
            ) : null}
            {emailLine ? (
              <>
                <Text style={[styles.metaDot, { color: c.textSecondary }]}>·</Text>
                <Text style={[styles.email, { color: c.textSecondary }]} numberOfLines={1} selectable>
                  {isolateLtr(emailLine)}
                </Text>
              </>
            ) : null}
          </View>
        </View>

        {actionable ? <MoreHorizontal size={20} color={c.textSecondary} /> : null}
      </>
    );

    const rowStyle = [
      styles.row,
      { backgroundColor: c.backgroundElement, borderColor: c.border },
      dim && styles.rowDim,
    ];

    if (!actionable) {
      return (
        <View key={member.memberId} style={rowStyle}>
          {content}
        </View>
      );
    }

    return (
      <Pressable
        key={member.memberId}
        onPress={() => setSelected(member)}
        accessibilityRole="button"
        accessibilityLabel={displayName}
        accessibilityHint={t('circleMembers.manage')}
        style={({ pressed }) => [...rowStyle, pressed && styles.rowPressed]}>
        {content}
      </Pressable>
    );
  }

  return (
    <FigmaScreen>
      <FigmaHeader
        title={t('figma.members.title')}
        onAdd={canManage ? () => router.push('/circle-members/invite') : undefined}
        addAccessibilityLabel={t('invitations.invite')}
      />

      {members.isLoading ? (
        <SkeletonList />
      ) : members.isError ? (
        <FigmaCard tone="card" radius={Radius.lg}>
          <Text style={[styles.errorText, { color: c.errorFg }]}>{t('circleMembers.loadError')}</Text>
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
            <Text style={[styles.summaryText, { color: c.textSecondary }]}>{summary}</Text>
          </View>

          {canManage ? (
            <Button
              variant="secondary"
              label={t('circleMembers.manageInvitations')}
              onPress={() => router.push('/circle-members/invitations')}
            />
          ) : null}

          {/* Active member rows */}
          <View style={styles.list}>{active.map(renderRow)}</View>

          {/* Removed members (managers only) — reachable so they can be reactivated. */}
          {inactive.length > 0 ? (
            <>
              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>
                {t('circleMembers.inactiveTitle')}
              </Text>
              <View style={styles.list}>{inactive.map(renderRow)}</View>
            </>
          ) : null}

          {/* Role legend (plain-language) */}
          <FigmaCard tone="card" radius={Radius.xl} padding={16}>
            <Text style={[styles.legendTitle, { color: c.text }]}>{t('figma.members.rolesTitle')}</Text>
            {(
              [
                { color: c.primary, role: 'manager', desc: 'managerDesc' },
                { color: c.categoryGold, role: 'editor', desc: 'editorDesc' },
                { color: c.categoryPurple, role: 'viewer', desc: 'viewerDesc' },
              ] as const
            ).map((r) => (
              <View key={r.role} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: r.color }]} />
                <Text style={[styles.legendText, { color: c.textSecondary }]}>
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

      <MemberActionsSheet
        member={selected}
        all={all}
        actorRole={actorRole}
        circleId={circleId}
        onClose={() => setSelected(null)}
        onLeft={() => {
          setSelected(null);
          router.replace('/');
        }}
      />
    </FigmaScreen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 14, fontFamily: FontFamily.medium, textAlign: 'center' },
  retry: {
    marginTop: 12,
    alignSelf: 'center',
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { fontSize: 14, fontFamily: FontFamily.semibold },
  // Summary line
  summary: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  summaryText: { fontSize: 14, fontFamily: FontFamily.regular, lineHeight: 21 },
  sectionLabel: { fontSize: 14, fontFamily: FontFamily.semibold, marginTop: 4 },
  // Member rows
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  rowDim: { opacity: 0.65 },
  rowPressed: { opacity: 0.7 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontFamily: FontFamily.bold },
  info: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontFamily: FontFamily.semibold, flexShrink: 1 },
  youBadge: { borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  youText: { fontSize: 14, fontFamily: FontFamily.medium },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  roleText: { fontSize: 14, fontFamily: FontFamily.medium },
  metaDot: { fontSize: 14, fontFamily: FontFamily.regular },
  statusText: { fontSize: 14, fontFamily: FontFamily.regular },
  email: { fontSize: 14, fontFamily: FontFamily.regular, flexShrink: 1 },
  // Role legend
  legendTitle: { fontSize: 14, fontFamily: FontFamily.bold, marginBottom: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  legendDot: { width: 8, height: 8, borderRadius: Radius.pill, marginTop: 6 },
  legendText: { flex: 1, fontSize: 14, fontFamily: FontFamily.regular, lineHeight: 21 },
  legendRole: { fontFamily: FontFamily.semibold },
});
