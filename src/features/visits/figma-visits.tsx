import { useRouter } from 'expo-router';
import { ChevronLeft, Clock, Home, User, Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { FigmaSegmentedTabs } from '@/components/figma/figma-segmented-tabs';
import { isolateLtr } from '@/components/ltr-text';
import { SkeletonList } from '@/components/skeleton';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { EmptyState } from '@/components/states';
import { Surface } from '@/components/surface';
import { BorderWidth, FontFamily, Radius, type ThemeColor } from '@/constants/theme';
import { useMemberLookup } from '@/features/circle-members/member-assignment';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';
import { formatHm, todayYmd } from '@/utils/date';

import type { FamilyVisit, VisitStatus } from './api';
import { useVisits } from './hooks';

type VisitTab = 'upcoming' | 'recent';

/**
 * Per-visit identity-square tint, cycled by index (the frame varies the person-icon
 * square between amber / green / green tints — decorative hue only; the person glyph
 * + «زيارة عائلية» label carry the meaning, never the tint). Matches the frame's
 * twarn → tacc → tok order.
 */
type CardTone = { fg: ThemeColor; tint: ThemeColor };
const CARD_TONES: CardTone[] = [
  { fg: 'warningFg', tint: 'warningBg' },
  { fg: 'primaryText', tint: 'primaryBg' },
  { fg: 'successFg', tint: 'successBg' },
];

/**
 * Non-planned visit statuses → a status-pill tone. Status is never color-only: the
 * `StatusBadge` carries its own shape icon + label. Mirrors the `VisitsCenter`
 * STATUS_TONE mapping (completed = success/green, cancelled = error/red). Planned
 * visits carry no pill (the frame shows pills only on closed visits).
 */
const VISIT_STATUS: Record<Exclude<VisitStatus, 'planned'>, { tone: StatusTone }> = {
  completed: { tone: 'success' },
  cancelled: { tone: 'error' },
};

/** `${date} ${start}` sort key, matching the center's `startSortKey`. */
function startSortKey(visit: FamilyVisit): string {
  return `${visit.visit_date} ${visit.start_time ?? '99:99:99'}`;
}

/**
 * The Dar family-visits list (frame 8f): a deep-green sub-screen band (back + title +
 * add), a القادمة/السابقة segmented control, and a list of bordered cards — each a
 * tinted person-icon square, the visitor name as the title, a «زيارة عائلية» label,
 * a Clock(date, time) meta with LTR values, an optional «زيارتك» / «مرتبطة بـ …»
 * accent tag, and a forward chevron. Closed visits add a planned/completed/cancelled
 * status pill. Tapping a card opens the existing detail route. Reuses `useVisits`
 * and its date/status field access + locale keys verbatim. Cairo + Dar tokens, RTL.
 * Behaviour / data / routing / scoping unchanged.
 */
export function FigmaVisits({
  circleId,
  canManage,
  canCollaborate,
}: {
  circleId: string;
  canManage: boolean;
  canCollaborate: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const lookup = useMemberLookup(circleId);

  const visitsQuery = useVisits(circleId);
  const [tab, setTab] = useState<VisitTab>('upcoming');

  const canAdd = canManage || canCollaborate;

  // Family members (non-managers who can collaborate) see only visits linked to
  // them; managers see all; read-only members see all (no action affordances). UI
  // scoping only — RLS is unchanged. Then split today+future vs. past, matching the
  // center's buckets (the Figma has two tabs, so today + upcoming collapse).
  const scopeToMine = !canManage && canCollaborate;
  const { upcoming, recent } = useMemo(() => {
    const all = visitsQuery.data ?? [];
    const visits = scopeToMine ? all.filter((visit) => visit.visitor_user_id === userId) : all;
    const today = todayYmd();
    const upcomingList = visits
      .filter((visit) => visit.visit_date >= today)
      .sort((a, b) => startSortKey(a).localeCompare(startSortKey(b)));
    const recentList = visits
      .filter((visit) => visit.visit_date < today)
      .sort((a, b) => startSortKey(b).localeCompare(startSortKey(a)));
    return { upcoming: upcomingList, recent: recentList };
  }, [visitsQuery.data, scopeToMine, userId]);

  const filtered = tab === 'upcoming' ? upcoming : recent;

  const tabs: { key: VisitTab; label: string }[] = [
    { key: 'upcoming', label: t('figma.visits.tabs.upcoming') },
    { key: 'recent', label: t('figma.visits.tabs.recent') },
  ];

  const c = useTheme();

  return (
    <FigmaScreen gap={16}>
      <FigmaHeader
        title={t('figma.visits.title')}
        onAdd={canAdd ? () => router.push('/visits/new') : undefined}
        addAccessibilityLabel={t('visits.add')}
      />

      <FigmaSegmentedTabs tabs={tabs} activeKey={tab} onChange={(key) => setTab(key as VisitTab)} />

      {visitsQuery.isLoading ? (
        <SkeletonList />
      ) : visitsQuery.isError ? (
        <View style={[styles.errorCard, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
          <Text style={[styles.errorText, { color: c.errorFg }]}>{t('visits.loadError')}</Text>
          <Pressable
            onPress={() => visitsQuery.refetch()}
            accessibilityRole="button"
            style={[styles.retry, { backgroundColor: c.primary }]}>
            <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          iconName="visit"
          title={tab === 'upcoming' ? t('figma.visits.emptyUpcoming') : t('figma.visits.emptyRecent')}
        />
      ) : (
        <View style={styles.list}>
          {filtered.map((visit, index) => (
            <VisitCard
              key={visit.id}
              visit={visit}
              mine={visit.visitor_user_id !== null && visit.visitor_user_id === userId}
              linkedName={
                visit.visitor_user_id && visit.visitor_user_id !== userId
                  ? (lookup(visit.visitor_user_id)?.label ?? null)
                  : null
              }
              tone={CARD_TONES[index % CARD_TONES.length]}
              onOpen={() => router.push(`/visits/${visit.id}`)}
            />
          ))}
        </View>
      )}
    </FigmaScreen>
  );
}

function VisitCard({
  visit,
  mine,
  linkedName,
  tone,
  onOpen,
}: {
  visit: FamilyVisit;
  mine: boolean;
  linkedName: string | null;
  tone: CardTone;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();

  // Date + time meta, LTR-isolated (the visit date/time is the scannable anchor).
  const timeParts: string[] = [];
  if (visit.start_time) timeParts.push(isolateLtr(formatHm(visit.start_time)));
  if (visit.end_time) timeParts.push(isolateLtr(formatHm(visit.end_time)));
  const whenText =
    timeParts.length > 0
      ? `${isolateLtr(visit.visit_date)}، ${timeParts.join(' – ')}`
      : isolateLtr(visit.visit_date);

  const statusConfig = visit.status !== 'planned' ? VISIT_STATUS[visit.status] : null;

  return (
    <Surface
      tone="card"
      padded={false}
      onPress={onOpen}
      accessibilityLabel={visit.visitor_name}
      accessibilityHint={t('common.details')}
      style={styles.card}>
      <View style={styles.cardRow}>
        <View style={[styles.iconSquare, { backgroundColor: c[tone.tint], borderColor: c.border }]}>
          <User size={18} color={c[tone.fg]} strokeWidth={2} />
        </View>

        <View style={styles.info}>
          <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
            {visit.visitor_name}
          </Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]} numberOfLines={1}>
            {t('figma.visits.visitorLabel')}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaGroup}>
              <Clock size={12} color={c.textSecondary} strokeWidth={2.2} />
              <Text style={[styles.whenText, { color: c.textSecondary }]}>{whenText}</Text>
            </View>

            {mine ? (
              <View style={styles.metaGroup}>
                <Home size={12} color={c.primaryText} strokeWidth={2.2} />
                <Text style={[styles.tagText, { color: c.primaryText }]}>{t('visits.mineLabel')}</Text>
              </View>
            ) : linkedName ? (
              <View style={styles.metaGroup}>
                <Users size={12} color={c.primaryText} strokeWidth={2} />
                <Text style={[styles.tagText, { color: c.primaryText }]} numberOfLines={1}>
                  {`${t('visits.linkedToLabel')} ${linkedName}`}
                </Text>
              </View>
            ) : null}

            {statusConfig ? (
              <StatusBadge tone={statusConfig.tone} label={t(`visits.status.${visit.status}`)} />
            ) : null}
          </View>
        </View>

        <View style={styles.chevron}>
          <ChevronLeft size={17} color={c.textSecondary} strokeWidth={2.2} />
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  // Error card (shared Dar system-state treatment)
  errorCard: { borderWidth: BorderWidth.standard, borderRadius: Radius.card, padding: 20 },
  errorText: { fontSize: 16, fontFamily: FontFamily.semibold, textAlign: 'center' },
  retry: {
    marginTop: 12,
    alignSelf: 'center',
    borderRadius: Radius.control,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { fontSize: 15, fontFamily: FontFamily.bold },
  // Visit card
  card: { paddingVertical: 12, paddingHorizontal: 14 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconSquare: {
    width: 40,
    height: 40,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontFamily: FontFamily.bold, lineHeight: 24 },
  subtitle: { fontSize: 14, fontFamily: FontFamily.medium },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  metaGroup: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  whenText: { fontSize: 14, fontFamily: FontFamily.semibold, writingDirection: 'ltr' },
  tagText: { fontSize: 14, fontFamily: FontFamily.bold, flexShrink: 1 },
  chevron: { marginTop: 4, flexShrink: 0 },
});
