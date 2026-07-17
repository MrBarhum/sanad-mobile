import { useFocusEffect, useRouter } from 'expo-router';
import { Activity, Share2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { FigmaCard } from '@/components/figma/figma-card';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { IconChip } from '@/components/figma/icon-chip';
import {
  FigmaColors,
  FigmaFont,
  FigmaRadius,
  withAlpha,
  type FigmaScheme,
} from '@/components/figma/figma-tokens';
import { isolateLtr } from '@/components/ltr-text';
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

const PAGE = 20;

/**
 * Care Pulse («نبض اليوم») — a read-only, member-gated activity feed built on the
 * `list_care_activity` RPC. Each row: a per-type icon, the actor's resolved name,
 * a localized description, and a bidi-isolated time; tapping deep-links to the
 * source item. Handles loading / generic error / RPC-not-yet-enabled / empty /
 * load-more. RTL, Cairo, Figma tokens.
 */
export function FigmaPulse({ circleId, timezone }: { circleId: string; timezone: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const scheme: FigmaScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = FigmaColors[scheme];
  const actorLabel = usePulseActorLabel(circleId);

  const [limit, setLimit] = useState(PAGE);
  const activity = useCareActivity(circleId, limit);

  // Refetch on focus so returning to the log after acting elsewhere reconciles the
  // feed (matches the available-to-claim convention; FigmaScreen has no pull-to-
  // refresh). Mutations also invalidate the pulse key, so an in-place action shows
  // up immediately (D1).
  const refetch = activity.refetch;
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const events = activity.data ?? [];
  const canLoadMore = events.length >= limit;

  function whenLabel(occurredAt: string): string {
    // Circle-local frame so a row's date + time match the feed's day grouping.
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
        <Text style={[styles.subtitle, { color: c.muted }]}>{t('pulse.subtitle')}</Text>
        {events.length > 0 ? (
          <Pressable
            onPress={onShare}
            accessibilityRole="button"
            accessibilityLabel={t('pulse.share')}
            style={[styles.shareBtn, { borderColor: withAlpha(c.primary, 0.4) }]}>
            <Share2 size={14} color={c.primary} />
            <Text style={[styles.shareText, { color: c.primary }]}>{t('pulse.share')}</Text>
          </Pressable>
        ) : null}
      </View>

      {activity.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : activity.isError ? (
        <FigmaCard tone="card" radius={FigmaRadius.r16}>
          <Text style={[styles.errorText, { color: c.error }]}>
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
        </FigmaCard>
      ) : events.length === 0 ? (
        <View style={styles.empty}>
          <Activity size={40} color={c.muted} strokeWidth={1} />
          <Text style={[styles.emptyText, { color: c.muted }]}>{t('pulse.empty')}</Text>
        </View>
      ) : (
        <>
          <View style={styles.list}>
            {events.map((event) => {
              const visual = pulseEventVisual(event);
              return (
                <Pressable
                  key={`${event.event_type}:${event.event_id}`}
                  onPress={() => router.push(pulseRouteFor(event.item_type, event.item_id))}
                  accessibilityRole="button"
                  accessibilityHint={t('common.details')}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: c.card, borderColor: c.border },
                    pressed && styles.rowPressed,
                  ]}>
                  <IconChip
                    Icon={visual.Icon}
                    color={visual.color}
                    size={44}
                    radius={FigmaRadius.r16}
                    iconSize={20}
                    tintOpacity={0.12}
                  />
                  <View style={styles.info}>
                    <Text style={[styles.desc, { color: c.text }]} numberOfLines={2}>
                      {pulseDescription(event, t, actorLabel)}
                    </Text>
                    <Text style={[styles.time, { color: c.muted }]}>{whenLabel(event.occurred_at)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {canLoadMore ? (
            <Pressable
              onPress={() => setLimit((n) => n + PAGE)}
              accessibilityRole="button"
              style={[styles.loadMore, { borderColor: c.border }]}>
              {activity.isFetching ? (
                <ActivityIndicator size="small" color={c.primary} />
              ) : (
                <Text style={[styles.loadMoreText, { color: c.primary }]}>{t('pulse.loadMore')}</Text>
              )}
            </Pressable>
          ) : null}
        </>
      )}
    </FigmaScreen>
  );
}

const styles = StyleSheet.create({
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: -8,
  },
  subtitle: { fontSize: 14, fontFamily: FigmaFont.regular, flexShrink: 1 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: FigmaRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  shareText: { fontSize: 13, fontFamily: FigmaFont.semibold },
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
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: FigmaFont.medium, textAlign: 'center' },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: FigmaRadius.r16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  rowPressed: { opacity: 0.7 },
  info: { flex: 1, gap: 3 },
  desc: { fontSize: 14, fontFamily: FigmaFont.semibold, lineHeight: 20 },
  time: { fontSize: 12, fontFamily: FigmaFont.regular },
  loadMore: {
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: FigmaRadius.pill,
    paddingHorizontal: 20,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: { fontSize: 14, fontFamily: FigmaFont.semibold },
});
