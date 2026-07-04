import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { GlyphChip, type GlyphChipTone } from '@/components/glyph-chip';
import { InfoBanner } from '@/components/info-banner';
import { isolateLtr } from '@/components/ltr-text';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Glyph } from '@/constants/glyphs';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCircleSelection } from '@/features/circle-selection/provider';
import { hmFromInstant, ymdFromInstant } from '@/utils/date';

import { NOTIFICATIONS_PAGE_SIZE, type AppNotification, type NotificationType } from './api';
import { notificationMeta } from './catalog';
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
  useOpenNotification,
  usePushRegistration,
} from './hooks';

/**
 * Per-type non-emoji glyph + tone for the row anchor chip (replaces the
 * catalog's emoji icons in this screen — shape stays decorative, the type
 * label text below always carries the meaning).
 */
const TYPE_GLYPH: Record<NotificationType, { glyph: string; tone: GlyphChipTone }> = {
  medication_due: { glyph: Glyph.medication, tone: 'primary' },
  medication_missed: { glyph: Glyph.medication, tone: 'warning' },
  task_due: { glyph: Glyph.task, tone: 'primary' },
  appointment_upcoming: { glyph: Glyph.appointment, tone: 'primary' },
  visit_update: { glyph: Glyph.members, tone: 'accent' },
  care_update: { glyph: Glyph.dailyLog, tone: 'primary' },
  emergency: { glyph: Glyph.emergency, tone: 'error' },
  system: { glyph: Glyph.system, tone: 'neutral' },
  // Phase 2F responsibility-aware types. Calm tones: item_cancelled is NEUTRAL (not
  // error) — "couldn't be completed" must not alarm; task_overdue is warning.
  item_assigned: { glyph: Glyph.profile, tone: 'primary' },
  task_overdue: { glyph: Glyph.clock, tone: 'warning' },
  visit_upcoming: { glyph: Glyph.visit, tone: 'primary' },
  item_claimed: { glyph: Glyph.members, tone: 'accent' },
  item_completed: { glyph: Glyph.check, tone: 'success' },
  item_cancelled: { glyph: Glyph.cross, tone: 'neutral' },
  claim_digest: { glyph: Glyph.diamond, tone: 'accent' },
};

/** The /notifications screen body: a global, recent-first inbox with an optional
 * per-circle filter, mark-read controls and graceful empty/error states. */
export function NotificationsCenter() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const { circles } = useCircleSelection();
  const { support, permission, hasActiveDeviceToken } = usePushRegistration();

  const [filter, setFilter] = useState<string | null>(null);
  const [limit, setLimit] = useState(NOTIFICATIONS_PAGE_SIZE);

  const list = useNotifications(filter, limit);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();
  const open = useOpenNotification();

  const items = list.data ?? [];
  const hasUnread = items.some((n) => !n.read_at);
  const circleName = useMemo(
    () => new Map(circles.map((c) => [c.circleId, c.circleName])),
    [circles],
  );

  const showEnablePrompt =
    support === 'supported' && !(permission === 'granted' && hasActiveDeviceToken);

  function onOpen(n: AppNotification) {
    if (!n.read_at) markRead.mutate({ id: n.id, read: true });
    open(n);
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={list.isRefetching}
          onRefresh={() => list.refetch()}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }>
      {hasUnread ? (
        <View style={styles.headerRow}>
          <Button
            size="sm"
            variant="secondary"
            label={t('notifications.markAllRead')}
            loading={markAll.isPending}
            onPress={() => markAll.mutate(filter)}
          />
        </View>
      ) : null}

      {showEnablePrompt ? (
        <InfoBanner
          tone="info"
          text={t('notifications.enablePrompt')}
          actionText={t('notifications.enableAction')}
          onPress={() => router.push('/notification-settings')}
        />
      ) : null}

      {circles.length > 1 ? (
        <View style={styles.chips}>
          <FilterChip
            label={t('notifications.filters.all')}
            active={filter === null}
            onPress={() => setFilter(null)}
          />
          {circles.map((c) => (
            <FilterChip
              key={c.circleId}
              label={c.circleName}
              active={filter === c.circleId}
              onPress={() => setFilter(c.circleId)}
            />
          ))}
        </View>
      ) : null}

      {list.isLoading ? (
        <LoadingState />
      ) : list.isError ? (
        <ErrorState
          message={t('notifications.loadError')}
          retryLabel={t('retry')}
          onRetry={() => list.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Glyph.system}
          title={t('notifications.emptyTitle')}
          subtitle={t('notifications.emptySubtitle')}
        />
      ) : (
        <View style={styles.list}>
          {items.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              circleName={n.circle_id ? circleName.get(n.circle_id) ?? null : null}
              onOpen={() => onOpen(n)}
              onToggleRead={() => markRead.mutate({ id: n.id, read: !n.read_at })}
            />
          ))}

          {items.length >= limit ? (
            <Button
              variant="secondary"
              label={t('notifications.loadMore')}
              onPress={() => setLimit((v) => v + NOTIFICATIONS_PAGE_SIZE)}
            />
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        {
          backgroundColor: active ? theme.primaryBg : theme.backgroundSelected,
          borderColor: active ? 'transparent' : theme.border,
        },
      ]}>
      <ThemedText
        type={active ? 'smallBold' : 'small'}
        themeColor={active ? 'primaryText' : 'textSecondary'}>
        {active ? `${Glyph.check} ${label}` : label}
      </ThemedText>
    </Pressable>
  );
}

function NotificationRow({
  n,
  circleName,
  onOpen,
  onToggleRead,
}: {
  n: AppNotification;
  circleName: string | null;
  onOpen: () => void;
  onToggleRead: () => void;
}) {
  const { t } = useTranslation();
  const unread = !n.read_at;
  const meta = notificationMeta(n.type);
  const typeGlyph = TYPE_GLYPH[n.type] ?? TYPE_GLYPH.system;
  const stamp = `${ymdFromInstant(n.created_at)} ${hmFromInstant(n.created_at)}`.trim();

  return (
    <Surface tone={unread ? 'card' : 'sunken'} bordered={unread} style={styles.row}>
      <Pressable onPress={onOpen} accessibilityRole="button" style={styles.rowMain}>
        <GlyphChip glyph={typeGlyph.glyph} tone={typeGlyph.tone} size="sm" />
        <View style={styles.rowBody}>
          <View style={styles.rowTitleLine}>
            {unread ? (
              <ThemedText
                themeColor="primaryText"
                style={styles.unreadDot}
                accessibilityElementsHidden
                importantForAccessibility="no">
                {Glyph.dot}
              </ThemedText>
            ) : null}
            <ThemedText type={unread ? 'cardTitle' : 'default'} style={styles.rowTitle}>
              {n.title}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {n.body}
          </ThemedText>
          <ThemedText type="small" themeColor="textMuted" style={styles.meta}>
            {t(meta.labelKey)}
            {circleName ? ` ${Glyph.middot} ${circleName}` : ''}
            {stamp ? ` ${Glyph.middot} ${isolateLtr(stamp)}` : ''}
          </ThemedText>
        </View>
      </Pressable>
      <Pressable
        onPress={onToggleRead}
        accessibilityRole="button"
        hitSlop={Spacing.one}
        style={styles.readToggle}>
        <ThemedText type="smallBold" themeColor="primaryText">
          {unread ? t('notifications.markRead') : t('notifications.markUnread')}
        </ThemedText>
      </Pressable>
    </Surface>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  chips: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  chip: {
    minHeight: TouchTarget.min,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three + Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: Spacing.three },
  row: { gap: Spacing.two },
  rowMain: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  rowBody: { flex: 1, gap: Spacing.half },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  unreadDot: { fontSize: 10, lineHeight: 16 },
  rowTitle: { flexShrink: 1 },
  meta: { marginTop: Spacing.half },
  readToggle: {
    alignSelf: 'flex-end',
    minHeight: TouchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
});
