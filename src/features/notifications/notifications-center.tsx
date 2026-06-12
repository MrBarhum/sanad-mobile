import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { isolateLtr } from '@/components/ltr-text';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCircleSelection } from '@/features/circle-selection/provider';
import { hmFromInstant, ymdFromInstant } from '@/utils/date';

import { NOTIFICATIONS_PAGE_SIZE, type AppNotification } from './api';
import { notificationMeta } from './catalog';
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
  useOpenNotification,
  usePushRegistration,
} from './hooks';

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
        <Surface tone="info" style={styles.enableBanner}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('notifications.enablePrompt')}
          </ThemedText>
          <Button
            size="sm"
            label={t('notifications.enableAction')}
            onPress={() => router.push('/notification-settings')}
          />
        </Surface>
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
          icon="🔔"
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
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <ThemedView
        type={active ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.chip}>
        <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
          {label}
        </ThemedText>
      </ThemedView>
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
  const theme = useTheme();
  const unread = !n.read_at;
  const meta = notificationMeta(n.type);
  const stamp = `${ymdFromInstant(n.created_at)} ${hmFromInstant(n.created_at)}`.trim();

  return (
    <Surface style={styles.row}>
      <Pressable onPress={onOpen} accessibilityRole="button" style={styles.rowMain}>
        <ThemedText style={styles.icon}>{meta.icon}</ThemedText>
        <View style={styles.rowBody}>
          <View style={styles.rowTitleLine}>
            {unread ? <View style={[styles.dot, { backgroundColor: theme.primary }]} /> : null}
            <ThemedText style={[styles.rowTitle, unread && styles.rowTitleUnread]}>
              {n.title}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {n.body}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
            {t(meta.labelKey)}
            {circleName ? ` · ${circleName}` : ''}
            {stamp ? ` · ${isolateLtr(stamp)}` : ''}
          </ThemedText>
        </View>
      </Pressable>
      <Pressable
        onPress={onToggleRead}
        accessibilityRole="button"
        hitSlop={Spacing.one}
        style={styles.readToggle}>
        <ThemedText type="small" themeColor="textSecondary">
          {unread ? t('notifications.markRead') : t('notifications.markUnread')}
        </ThemedText>
      </Pressable>
    </Surface>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  enableBanner: { gap: Spacing.two },
  chips: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  chip: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  list: { gap: Spacing.three },
  row: { gap: Spacing.two },
  rowMain: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  icon: { fontSize: 22, marginTop: 2 },
  rowBody: { flex: 1, gap: Spacing.half },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowTitle: { fontSize: 16, flexShrink: 1 },
  rowTitleUnread: { fontWeight: '700' },
  meta: { marginTop: Spacing.half },
  readToggle: { alignSelf: 'flex-end', paddingVertical: Spacing.half },
});
