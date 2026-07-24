import { useFocusEffect, useRouter } from 'expo-router';
import {
  Calendar,
  Check,
  ClipboardList,
  Heart,
  Pill,
  Share2,
  User,
  Users,
  X,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { isolateLtr } from '@/components/ltr-text';
import { SkeletonList } from '@/components/skeleton';
import { EmptyState } from '@/components/states';
import { BorderWidth, FontFamily, Radius, type ThemeColor } from '@/constants/theme';
import { type IconName } from '@/constants/icons';
import { useTheme } from '@/hooks/use-theme';
import { hmInTimeZone, todayYmdInTimeZone, ymdInTimeZone } from '@/utils/date';

import { useCareActivity } from './hooks';
import {
  composePulseShareText,
  isMissingPulseRpc,
  pulseDescription,
  pulseEventVisual,
  pulseRouteFor,
  sharePulseSummary,
  usePulseActorLabel,
} from './present';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** Event icon → lucide glyph + Dar tint pair (per the 9f frame: care actions =
 *  accent, completions = success, people events = amber). */
type Visual = { Icon: IconCmp; fg: ThemeColor; tint: ThemeColor };
const FALLBACK: Visual = { Icon: Check, fg: 'primaryText', tint: 'primaryBg' };
const VISUAL: Partial<Record<IconName, Visual>> = {
  medication: { Icon: Pill, fg: 'primaryText', tint: 'primaryBg' },
  appointment: { Icon: Calendar, fg: 'primaryText', tint: 'primaryBg' },
  dailyLog: { Icon: ClipboardList, fg: 'primaryText', tint: 'primaryBg' },
  success: { Icon: Check, fg: 'successFg', tint: 'successBg' },
  vital: { Icon: Heart, fg: 'successFg', tint: 'successBg' },
  close: { Icon: X, fg: 'warningFg', tint: 'warningBg' },
  visit: { Icon: User, fg: 'warningFg', tint: 'warningBg' },
  member: { Icon: Users, fg: 'warningFg', tint: 'warningBg' },
};

const PAGE = 20;

/**
 * Care activity log («سجل النشاط», frame 9f) — a read-only, member-gated feed on
 * the `list_care_activity` RPC. A share pill, then per-event cards (a tinted icon
 * square + actor·masdar description + LTR time), then load-more. Handles loading /
 * generic error / RPC-not-enabled / empty. Dar tokens, Cairo, RTL.
 */
export function FigmaPulse({ circleId, timezone }: { circleId: string; timezone: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useTheme();
  const actorLabel = usePulseActorLabel(circleId);

  const [limit, setLimit] = useState(PAGE);
  const activity = useCareActivity(circleId, limit);

  const refetch = activity.refetch;
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const events = activity.data ?? [];
  const canLoadMore = events.length >= limit;

  function whenLabel(occurredAt: string): string {
    const ymd = ymdInTimeZone(occurredAt, timezone);
    const hm = hmInTimeZone(occurredAt, timezone);
    if (ymd === todayYmdInTimeZone(timezone)) return isolateLtr(hm);
    return `${isolateLtr(ymd)} · ${isolateLtr(hm)}`;
  }

  async function onShare() {
    await sharePulseSummary(composePulseShareText(events, t, actorLabel, timezone));
  }

  return (
    <FigmaScreen gap={16}>
      <FigmaHeader title={t('pulse.title')} />
      <View style={styles.subtitleRow}>
        <Text style={[styles.subtitle, { color: c.textSecondary }]}>{t('pulse.subtitle')}</Text>
        {events.length > 0 ? (
          <Pressable
            onPress={onShare}
            accessibilityRole="button"
            accessibilityLabel={t('pulse.share')}
            style={[styles.shareBtn, { borderColor: c.border, backgroundColor: c.backgroundElement }]}>
            <Share2 size={14} color={c.primaryText} strokeWidth={2} />
            <Text style={[styles.shareText, { color: c.primaryText }]}>{t('pulse.share')}</Text>
          </Pressable>
        ) : null}
      </View>

      {activity.isLoading ? (
        <SkeletonList />
      ) : activity.isError ? (
        <View style={[styles.errorCard, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
          <Text style={[styles.errorText, { color: c.errorFg }]}>
            {isMissingPulseRpc(activity.error) ? t('pulse.notEnabled') : t('pulse.loadError')}
          </Text>
          {!isMissingPulseRpc(activity.error) ? (
            <Pressable
              onPress={() => activity.refetch()}
              accessibilityRole="button"
              style={[styles.retry, { backgroundColor: c.primary }]}>
              <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : events.length === 0 ? (
        <EmptyState iconName="activity" title={t('pulse.empty')} />
      ) : (
        <View style={styles.list}>
          {events.map((event) => {
            const { iconName } = pulseEventVisual(event);
            const visual = VISUAL[iconName] ?? FALLBACK;
            const EventIcon = visual.Icon;
            return (
              <Pressable
                key={`${event.event_type}:${event.event_id}`}
                onPress={() => router.push(pulseRouteFor(event.item_type, event.item_id))}
                accessibilityRole="button"
                accessibilityHint={t('common.details')}
                android_ripple={{ color: c.backgroundSelected }}
                style={[
                  styles.row,
                  { backgroundColor: c.backgroundElement, borderColor: c.border },
                ]}>
                <View style={[styles.icon, { backgroundColor: c[visual.tint], borderColor: c.border }]}>
                  <EventIcon size={17} color={c[visual.fg]} strokeWidth={2.2} />
                </View>
                <Text style={[styles.desc, { color: c.text }]} numberOfLines={2}>
                  {pulseDescription(event, t, actorLabel)}
                </Text>
                <Text style={[styles.time, { color: c.textSecondary }]}>{whenLabel(event.occurred_at)}</Text>
              </Pressable>
            );
          })}

          {canLoadMore ? (
            <Pressable
              onPress={() => setLimit((n) => n + PAGE)}
              accessibilityRole="button"
              style={[styles.loadMore, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
              {activity.isFetching ? (
                <ActivityIndicator size="small" color={c.primaryText} />
              ) : (
                <Text style={[styles.loadMoreText, { color: c.primaryText }]}>{t('pulse.loadMore')}</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      )}
    </FigmaScreen>
  );
}

const styles = StyleSheet.create({
  subtitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: -8 },
  subtitle: { fontSize: 15, fontFamily: FontFamily.medium, flexShrink: 1 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: BorderWidth.standard,
  },
  shareText: { fontSize: 14, fontFamily: FontFamily.bold },
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
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: Radius.card,
    borderWidth: BorderWidth.standard,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  icon: {
    width: 40,
    height: 40,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  desc: { flex: 1, fontSize: 15, fontFamily: FontFamily.semibold, lineHeight: 23 },
  time: { fontSize: 14, fontFamily: FontFamily.medium, writingDirection: 'ltr' },
  loadMore: {
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: { fontSize: 16, fontFamily: FontFamily.bold },
});
