import { useRouter } from 'expo-router';
import { Crown, Edit3, Eye, HandHelping, MoreHorizontal, Users } from 'lucide-react-native';
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

type RoleVisual = { Icon: IconCmp; fg: ThemeColor; tint: ThemeColor; sw: number };

/**
 * Per-role visual identity for the Dar roster (frame 9a): an icon + a foreground
 * tone + the matching avatar tint — status is always icon + text + tone, never
 * color-only. Four glyphs over Sanad's real role set: managers (admin /
 * primary_caregiver) read as Crown on the green accent (`acc` text, `tacc` tint);
 * a **hired caregiver** reads as HandHelping on that same accent — she is a paid
 * worker in her own narrow lane, not a family editor, so she never shares the
 * editor's pencil; family editors (family_member) read as a pencil on the amber
 * caution tone (`warn` / `twarn`); view-only (remote_member / elder) as an eye on
 * the neutral muted tone (`mut` / `sunken`). Crown, HandHelping, Edit3 and Eye all
 * read apart at 12px. Role labels still come from `circleMembers.roles.*` verbatim,
 * so the glyph never carries the meaning alone.
 */
function roleVisual(role: CircleRole): RoleVisual {
  if (role === 'admin' || role === 'primary_caregiver') {
    return { Icon: Crown, fg: 'primaryText', tint: 'primaryBg', sw: 2.2 };
  }
  if (role === 'caregiver') {
    return { Icon: HandHelping, fg: 'primaryText', tint: 'primaryBg', sw: 2 };
  }
  if (role === 'family_member') {
    return { Icon: Edit3, fg: 'warningFg', tint: 'warningBg', sw: 2 };
  }
  return { Icon: Eye, fg: 'textSecondary', tint: 'backgroundSunken', sw: 2 };
}

type LegendRow = { role: CircleRole; descKey: string };

/**
 * The role legend — keyed on REAL `CircleRole` values (frame 11f's drawn fix).
 *
 * It used to invent its own vocabulary: three coloured 9×9 dots labelled «مسؤول» /
 * «محرر» / «مشاهد», none of which was a role any row above it could ever show
 * (rows read `circleMembers.roles.*` → «مشرف» / «فرد من العائلة» / «عضو عن بُعد»),
 * against a second, staler copy of the role descriptions that had already drifted
 * from the real one. And the key was colour-only — with a caregiver present, the
 * manager dot and the caregiver dot were the same green.
 *
 * So the legend now derives everything from the role itself: the glyph comes from
 * the same {@link roleVisual} the rows use, the label from `circleMembers.roles.*`
 * and the body from `circleMembers.roleDescriptions.*`. Legend and roster cannot
 * drift again, and the mark is a distinct shape rather than a tone.
 *
 * Note the coupling this creates: editing a `roleDescriptions` value now also
 * rewrites this legend (that is the point — one source).
 *
 * CORRECTION (2026-08-07): frame 11f left `primary_caregiver` out on the reasoning
 * that it shares a Crown with `admin`, so the «مشرف» row would explain it too. It
 * does not — it misexplains it. A row reading «مقدّم الرعاية الأساسي» appeared with
 * no matching line, and the only Crown line says «صلاحية كاملة — يدير الدائرة
 * والأعضاء وكل بيانات الرعاية», which is false for a primary caregiver: she may not
 * grant a manager role and may not modify a manager peer (permissions.ts:30-32). On
 * a surface whose entire job is explaining permissions, that is a wrong answer
 * rather than a gap, so the role now gets its own line.
 *
 * The two Crown rows are distinguished by their labels, not their glyph, which
 * still satisfies the never-mark-alone rule (the label is text). Giving
 * `primary_caregiver` a glyph of its own would also restyle every such member ROW,
 * since {@link roleVisual} is shared — a visual-identity change, deliberately not
 * made here.
 */
const BASE_LEGEND: readonly LegendRow[] = [
  { role: 'admin', descKey: 'circleMembers.roleDescriptions.admin' },
  { role: 'primary_caregiver', descKey: 'circleMembers.roleDescriptions.primary_caregiver' },
  { role: 'family_member', descKey: 'circleMembers.roleDescriptions.family_member' },
  { role: 'remote_member', descKey: 'circleMembers.roleDescriptions.remote_member' },
];

/**
 * Roles explained ONLY when the roster actually shows one, so a circle that never
 * appointed a primary caregiver or hired a caregiver keeps exactly the three rows it
 * has always had. Every other role is always explained.
 */
const PRESENCE_GATED_ROLES: readonly CircleRole[] = ['primary_caregiver', 'caregiver'];

/**
 * The hired-caregiver legend row — shown ONLY when this roster actually renders a
 * `caregiver` member (see {@link PRESENCE_GATED_ROLES}). The role is optional and
 * must stay completely invisible in a circle that never hired one.
 *
 * It keeps the SHORT `figma.members.legend.caregiverDesc` rather than the long
 * `roleDescriptions.caregiver`: that one is the three-sentence disclosure the
 * invite card and the role-change sheet are required to show in full, and a legend
 * line is not the place to restate it.
 */
const CAREGIVER_LEGEND: LegendRow = {
  role: 'caregiver',
  descKey: 'figma.members.legend.caregiverDesc',
};

/** Every legend row the screen can show, in privilege order. */
const LEGEND_ORDER: readonly LegendRow[] = [...BASE_LEGEND, CAREGIVER_LEGEND];

/**
 * The legend for this roster: every row except the presence-gated ones, plus those
 * whose role is actually on screen (active or, for a manager, the inactive list).
 * Derived from the roster already loaded — never an extra query.
 */
function legendFor(members: readonly CircleMember[]): LegendRow[] {
  const present = new Set(members.map((m) => m.role));
  return LEGEND_ORDER.filter(
    (row) => !PRESENCE_GATED_ROLES.includes(row.role) || present.has(row.role),
  );
}

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
 *
 * The optional hired-caregiver role adds exactly two things, and both are gated on
 * the roster this screen already has in hand (no extra query): a fourth legend row
 * and a «واجهة مقدّم الرعاية» chip on the caregiver's own row. A circle that never
 * hired one renders byte-for-byte what it rendered before.
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

  // Every role on screen gets a line — `active` plus the manager-only `inactive`
  // list, which is exactly the set of rows this screen renders.
  const legend = legendFor([...active, ...inactive]);

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
              <View style={[styles.metaBadge, { borderColor: c.primaryText }]}>
                <Text style={[styles.metaBadgeText, { color: c.primaryText }]}>
                  {t('circleMembers.you')}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.metaRow}>
            <visual.Icon size={12} color={c[visual.fg]} strokeWidth={visual.sw} />
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
            {/*
              A hired caregiver opens the simplified caregiver view, not the family
              app — a plain fact a manager should see at a glance. Same bordered
              accent chip as the «أنت» badge above; never the gold badge (gold is
              reserved for claim surfaces and one-time secrets). Appended after the
              meta chain so the «role · status · email» dots stay unbroken, and only
              on active rows, where the statement is still true.
            */}
            {member.role === 'caregiver' && !dim ? (
              <View style={[styles.metaBadge, styles.caregiverBadge, { borderColor: c.primaryText }]}>
                <Text style={[styles.metaBadgeText, { color: c.primaryText }]}>
                  {t('caregiver.roster.appBadge')}
                </Text>
              </View>
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
              <SectionHeader
                title={t('circleMembers.inactiveTitle')}
                muted
                style={styles.inactiveHeader}
              />
              <View style={styles.list}>{inactive.map(renderRow)}</View>
            </>
          ) : null}

          {/* Role legend — the rows' own glyphs + their real role labels. */}
          <Surface tone="card" radius={Radius.card} padded={14}>
            <Text style={[styles.legendTitle, { color: c.text }]}>{t('figma.members.rolesTitle')}</Text>
            <View style={styles.legendRows}>
              {legend.map((r) => {
                const visual = roleVisual(r.role);
                return (
                  <View key={r.role} style={styles.legendRow}>
                    {/* The glyph is a SIBLING of the text, never nested inside it —
                        RN mis-baselines an inline view within a <Text>. */}
                    <View style={styles.legendGlyph}>
                      <visual.Icon size={14} color={c[visual.fg]} strokeWidth={visual.sw} />
                    </View>
                    <Text style={[styles.legendText, { color: c.textSecondary }]}>
                      <Text style={[styles.legendRole, { color: c.text }]}>
                        {t(`circleMembers.roles.${r.role}`)}
                        {t('figma.members.legendSeparator')}
                      </Text>{' '}
                      {t(r.descKey)}
                    </Text>
                  </View>
                );
              })}
            </View>
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
  // One bordered chip, two users: the «أنت» self badge and the caregiver-view chip.
  metaBadge: {
    borderWidth: BorderWidth.thin,
    borderRadius: Radius.tiny,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  metaBadgeText: { fontSize: 14, fontFamily: FontFamily.bold },
  // Only the caregiver chip: it wraps onto its own meta line, so it needs the
  // 2dp nudge the inline «أنت» badge must not get.
  caregiverBadge: { marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  roleText: { fontSize: 14, fontFamily: FontFamily.bold },
  metaDot: { fontSize: 14, fontFamily: FontFamily.regular },
  statusText: { fontSize: 14, fontFamily: FontFamily.semibold },
  email: { fontSize: 14, fontFamily: FontFamily.medium, flexShrink: 1 },
  // Role legend
  legendTitle: { fontSize: 16, fontFamily: FontFamily.bold, marginBottom: 8 },
  // A real column gap, so no stray space is left under the last row.
  legendRows: { gap: 7 },
  legendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  // A 16×24 box centres the 14px glyph optically on the first (24px) text line,
  // however far the description wraps.
  legendGlyph: { width: 16, height: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  legendText: { flex: 1, fontSize: 15, fontFamily: FontFamily.medium, lineHeight: 24 },
  legendRole: { fontFamily: FontFamily.semibold },
});
