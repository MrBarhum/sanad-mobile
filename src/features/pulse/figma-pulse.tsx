import { useFocusEffect, useRouter } from 'expo-router';
import { Activity, Share2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SkeletonList } from '@/components/skeleton';

import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { IconChip } from '@/components/figma/icon-chip';
import { isolateLtr } from '@/components/ltr-text';
import { Surface } from '@/components/surface';
import { FontFamily, Radius, withAlpha } from '@/constants/theme';
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

const PAGE = 20;

/**
 * Care Pulse («نبض اليوم») — a read-only, member-gated activity feed built on the
 * `list_care_activity` RPC. Each row: a per-type icon, the actor's resolved name,
 * a localized description, and a bidi-isolated time; tapping deep-links to the
 * source item. Handles loading / generic error / RPC-not-yet-enabled / empty /
 * load-more. RTL, IBM Plex, theme tokens.
 */
export function FigmaPulse({ circleId, timezone }: { circleId: string; timezone: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useTheme();
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
        <Text style={[styles.subtitle, { color: c.textSecondary }]}>{t('pulse.subtitle')}</Text>
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
        <SkeletonList />
      ) : activity.isError ? (
        <Surface tone="card" radius={Radius.lg} padded={20}>
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
        </Surface>
      ) : events.length === 0 ? (
        <View style={styles.empty}>
          <Activity size={40} color={c.textSecondary} strokeWidth={1} />
          <Text style={[styles.emptyText, { color: c.textSecondary }]}>{t('pulse.empty')}</Text>
        </View>
      ) : (
        <>
          <View style={styles.list}>
            {events.map((event) => {
              const { Icon, colorKey } = pulseEventVisual(event);
              const color = c[colorKey];
              return (
                <Pressable
                  key={`${event.event_type}:${event.event_id}`}
                  onPress={() => router.push(pulseRouteFor(event.item_type, event.item_id))}
                  accessibilityRole="button"
                  accessibilityHint={t('common.details')}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: c.backgroundElement, borderColor: c.border },
                    pressed && styles.rowPressed,
                  ]}>
                  <IconChip
                    Icon={Icon}
                    color={color}
                    size={44}
                    radius={Radius.lg}
                    iconSize={20}
                    tintOpacity={0.12}
                  />
                  <View style={styles.info}>
                    <Text style={[styles.desc, { color: c.text }]} numberOfLines={2}>
                      {pulseDescription(event, t, actorLabel)}
                    </Text>
                    <Text style={[styles.time, { color: c.textSecondary }]}>{whenLabel(event.occurred_at)}</Text>
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
  subtitle: { fontSize: 14, fontFamily: FontFamily.regular, flexShrink: 1 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  shareText: { fontSize: 14, fontFamily: FontFamily.semibold },
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
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: FontFamily.medium, textAlign: 'center' },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  rowPressed: { opacity: 0.7 },
  info: { flex: 1, gap: 3 },
  desc: { fontSize: 14, fontFamily: FontFamily.semibold, lineHeight: 20 },
  time: { fontSize: 14, fontFamily: FontFamily.regular },
  loadMore: {
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
    paddingHorizontal: 20,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: { fontSize: 14, fontFamily: FontFamily.semibold },
});
