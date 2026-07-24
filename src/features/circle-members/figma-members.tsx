import { useRouter } from 'expo-router';
import { Crown, Edit3, Eye, MoreHorizontal, Users } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { isolateLtr } from '@/components/ltr-text';
import { SectionHeader } from '@/components/section-header';
import { SkeletonList } from '@/components/skeleton';
import { Surface } from '@/components/surface';
import { BorderWidth, FontFamily, Radius, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { CircleMember, CircleRole } from './api';
import { memberDisplayName } from './display-name';
import { MemberActionsSheet, memberHasActions } from './figma-member-actions';
import { useCircleMembers } from './hooks';
import { isManagerRole } from './permissions';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

type RoleVisual = { Icon: IconCmp; fg: ThemeColor; tint: ThemeColor };

/**
 * Per-role visual identity for the Dar roster (frame 9a): an icon + a foreground
 * tone + the matching avatar tint — status is always icon + text + tone, never
 * color-only. The three glyphs mirror the frame over Sanad's real role set:
 * managers (admin / primary_caregiver) read as Crown on the green accent (`acc`
 * text, `tacc` tint); contributors (family_member / caregiver) as a pencil on the
 * amber caution tone (`warn` / `twarn`); view-only (remote_member / elder) as an
 * eye on the neutral muted tone (`mut` / `sunken`). Role labels still come from
 * `circleMembers.roles.*` verbatim.
 */
function roleVisual(role: CircleRole): RoleVisual {
  if (role === 'admin' || role === 'primary_caregiver') {
    return { Icon: Crown, fg: 'primaryText', tint: 'primaryBg' };
  }
  if (role === 'family_member' || role === 'caregiver') {
    return { Icon: Edit3, fg: 'warningFg', tint: 'warningBg' };
  }
  return { Icon: Eye, fg: 'textSecondary', tint: 'backgroundSunken' };
}

/** Plain-language role legend rows — tone-matched to the roster role glyphs. */
const LEGEND: readonly { fg: ThemeColor; role: string; desc: string }[] = [
  { fg: 'primaryText', role: 'manager', desc: 'managerDesc' },
  { fg: 'warningFg', role: 'editor', desc: 'editorDesc' },
  { fg: 'textSecondary', role: 'viewer', desc: 'viewerDesc' },
];

/** First grapheme of a display name, for the letter avatar. */
function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

/**
 * The Dar «دائرة الرعاية» members roster (frame 9a): a deep-green sub-screen band
 * (back + title + manager-only invite), a tinted circle-summary pill, a bordered
 * «إدارة الدعوات» entry (managers), letter-avatar member rows (name + «أنت» badge +
 * role icon/label + email meta + a per-member actions affordance), a dimmed
 * inactive section (managers, for reactivation), and a plain-language role legend.
 *
 * Every membership action lives in {@link MemberActionsSheet} (change role,
 * reactivate, remove, transfer ownership, leave). The membership RPCs stay
 * authoritative; the gates here (`memberHasActions`, `isManagerRole`) only decide
 * what to surface. Cairo + Dar tokens, both themes, RTL. Behaviour/data/routing
 * unchanged — only the layout/styling was rebuilt to match the frame.
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
    const dim = member.status !== 'active';
    const visual = roleVisual(member.role);
    // Inactive rows are neutralized (the whole row dims + the avatar goes muted);
    // the role glyph/label keeps its own tone so the member's role still reads.
    const avatarFg: ThemeColor = dim ? 'textSecondary' : visual.fg;
    const avatarTint: ThemeColor = dim ? 'backgroundSunken' : visual.tint;
    const actionable = memberHasActions(member, all, actorRole);
    // Only show the email line when it adds info beyond the name.
    const emailLine = member.email && member.fullName ? member.email : null;

    const content = (
      <>
        <View style={[styles.avatar, { backgroundColor: c[avatarTint], borderColor: c.border }]}>
          <Text style={[styles.avatarText, { color: c[avatarFg] }]}>{initialOf(displayName)}</Text>
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            {member.isSelf ? (
              <View style={[styles.youBadge, { borderColor: c.primaryText }]}>
                <Text style={[styles.youText, { color: c.primaryText }]}>{t('circleMembers.you')}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.metaRow}>
            <visual.Icon size={12} color={c[visual.fg]} strokeWidth={2.2} />
            <Text style={[styles.roleText, { color: c[visual.fg] }]}>
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

        {actionable ? <MoreHorizontal size={18} color={c.textSecondary} strokeWidth={2.4} /> : null}
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
        android_ripple={{ color: c.backgroundSelected }}
        style={rowStyle}>
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
        <Surface tone="card" radius={Radius.card} padded={20}>
          <Text style={[styles.errorText, { color: c.errorFg }]}>{t('circleMembers.loadError')}</Text>
          <Pressable
            onPress={() => members.refetch()}
            accessibilityRole="button"
            style={[styles.retry, { backgroundColor: c.primary, borderColor: c.border }]}>
            <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
          </Pressable>
        </Surface>
      ) : (
        <>
          {/* Circle summary pill — real recipient name + active member count. */}
          <View style={[styles.summary, { backgroundColor: c.primaryBg, borderColor: c.border }]}>
            <Users size={18} color={c.primaryText} strokeWidth={2} />
            <Text style={[styles.summaryText, { color: c.primaryText }]} numberOfLines={2}>
              {summary}
            </Text>
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
              <SectionHeader title={t('circleMembers.inactiveTitle')} style={styles.inactiveHeader} />
              <View style={styles.list}>{inactive.map(renderRow)}</View>
            </>
          ) : null}

          {/* Role legend (plain-language) */}
          <Surface tone="card" radius={Radius.card} padded={14}>
            <Text style={[styles.legendTitle, { color: c.text }]}>{t('figma.members.rolesTitle')}</Text>
            {LEGEND.map((r) => (
              <View key={r.role} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: c[r.fg] }]} />
                <Text style={[styles.legendText, { color: c.textSecondary }]}>
                  <Text style={[styles.legendRole, { color: c.text }]}>
                    {t(`figma.members.legend.${r.role}`)}
                    {t('figma.members.legendSeparator')}
                  </Text>{' '}
                  {t(`figma.members.legend.${r.desc}`)}
                </Text>
              </View>
            ))}
          </Surface>
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
  errorText: { fontSize: 16, fontFamily: FontFamily.bold, textAlign: 'center', lineHeight: 24 },
  retry: {
    marginTop: 12,
    alignSelf: 'center',
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.control,
    paddingHorizontal: 18,
    paddingVertical: 9,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { fontSize: 15, fontFamily: FontFamily.bold },
  // Summary pill
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  summaryText: { flex: 1, fontSize: 15, fontFamily: FontFamily.bold, lineHeight: 22 },
  inactiveHeader: { marginTop: 4 },
  // Member rows
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minHeight: 56,
  },
  rowDim: { opacity: 0.6 },
  avatar: {
    width: 44,
    height: 44,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 18, fontFamily: FontFamily.black },
  info: { flex: 1, gap: 3, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontFamily: FontFamily.bold, flexShrink: 1 },
  youBadge: {
    borderWidth: BorderWidth.thin,
    borderRadius: Radius.tiny,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  youText: { fontSize: 14, fontFamily: FontFamily.bold },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  roleText: { fontSize: 14, fontFamily: FontFamily.bold },
  metaDot: { fontSize: 14, fontFamily: FontFamily.regular },
  statusText: { fontSize: 14, fontFamily: FontFamily.semibold },
  email: { fontSize: 14, fontFamily: FontFamily.medium, flexShrink: 1 },
  // Role legend
  legendTitle: { fontSize: 16, fontFamily: FontFamily.bold, marginBottom: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 7 },
  legendDot: { width: 9, height: 9, borderRadius: Radius.pill, marginTop: 8 },
  legendText: { flex: 1, fontSize: 15, fontFamily: FontFamily.medium, lineHeight: 24 },
  legendRole: { fontFamily: FontFamily.bold },
});
