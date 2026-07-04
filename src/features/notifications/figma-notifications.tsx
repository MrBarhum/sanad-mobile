import {
  AlertCircle,
  Bell,
  Calendar,
  Check,
  Clock,
  FileText,
  Hand,
  Pill,
  Siren,
  Sparkles,
  Stethoscope,
  UserCheck,
  XCircle,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FigmaCard } from '@/components/figma/figma-card';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { IconChip } from '@/components/figma/icon-chip';
import {
  FigmaCategory,
  FigmaColors,
  FigmaFont,
  FigmaRadius,
  FigmaStatus,
  withAlpha,
  type FigmaScheme,
} from '@/components/figma/figma-tokens';
import { isolateLtr } from '@/components/ltr-text';
import { hmFromInstant, ymdFromInstant } from '@/utils/date';

import { NOTIFICATIONS_PAGE_SIZE, type AppNotification, type NotificationType } from './api';
import { notificationMeta } from './catalog';
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
  useOpenNotification,
} from './hooks';
import { useState } from 'react';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/**
 * Per-type Figma anchor: a lucide icon + accent color for the row's icon chip.
 * The chip is decorative; the type label text below always carries the meaning.
 * Colors come from the Figma category/status ramps (constant across modes, as in
 * the export's `notifs` array — medication=teal, appointment=blue, task=gold).
 */
const TYPE_ICON: Record<NotificationType, { Icon: IconCmp; color: string }> = {
  medication_due: { Icon: Pill, color: FigmaCategory.teal },
  medication_missed: { Icon: Pill, color: FigmaStatus.missed },
  task_due: { Icon: Check, color: FigmaCategory.gold },
  appointment_upcoming: { Icon: Calendar, color: FigmaCategory.blue },
  visit_update: { Icon: Stethoscope, color: FigmaCategory.green },
  care_update: { Icon: FileText, color: FigmaCategory.purple },
  emergency: { Icon: Siren, color: FigmaStatus.error },
  system: { Icon: Bell, color: FigmaCategory.blue },
  // Phase 2F responsibility-aware types. Decorative icon + calm category/status tint;
  // item_cancelled uses a muted purple (NOT error red) so "not completed" doesn't alarm.
  item_assigned: { Icon: UserCheck, color: FigmaCategory.blue },
  task_overdue: { Icon: Clock, color: FigmaStatus.warning },
  visit_upcoming: { Icon: Calendar, color: FigmaCategory.green },
  item_claimed: { Icon: Hand, color: FigmaCategory.teal },
  item_completed: { Icon: Check, color: FigmaStatus.success },
  item_cancelled: { Icon: XCircle, color: FigmaCategory.purple },
  claim_digest: { Icon: Sparkles, color: FigmaCategory.gold },
};

/**
 * The Figma Make NotificationsScreen, recreated as literally as possible in
 * React Native and wired to real Sanad data. Mirrors `NotificationsScreen.tsx`:
 * a back + centered title header with a "mark all read" text action (only when
 * there are unread items), an unread-count banner, and a recent-first list of
 * rows — each a per-type icon chip + title + body + time + unread dot, with
 * unread rows tinted and read rows plain. Cairo + Figma tokens, dark-first, RTL.
 *
 * Reuses the NotificationsCenter hooks/data VERBATIM (useNotifications /
 * useMarkAllRead / useMarkNotificationRead / useOpenNotification), keeping the
 * same read/unread + open behavior. Opt-in/push registration is untouched (it
 * lives behind the separate /notification-settings route).
 */
export function FigmaNotifications() {
  const { t } = useTranslation();
  const scheme: FigmaScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = FigmaColors[scheme];

  // The global inbox is recent-first across circles (filter stays null here —
  // the per-circle filter chips are not part of the Figma notifications screen).
  const [limit, setLimit] = useState(NOTIFICATIONS_PAGE_SIZE);
  const list = useNotifications(null, limit);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();
  const open = useOpenNotification();

  const items = list.data ?? [];
  const unreadCount = items.filter((n) => !n.read_at).length;

  function onOpen(n: AppNotification) {
    if (!n.read_at) markRead.mutate({ id: n.id, read: true });
    open(n);
  }

  const muted = { color: c.muted, fontFamily: FigmaFont.regular };

  return (
    <FigmaScreen gap={8}>
      <FigmaHeader
        title={t('figma.notifications.title')}
        trailing={
          unreadCount > 0 ? (
            <Pressable
              onPress={() => markAll.mutate(null)}
              disabled={markAll.isPending}
              accessibilityRole="button"
              hitSlop={8}
              style={styles.markAll}>
              <Text style={[styles.markAllText, { color: c.primary, opacity: markAll.isPending ? 0.5 : 1 }]}>
                {t('figma.notifications.markAllRead')}
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      {unreadCount > 0 ? (
        <View
          style={[
            styles.banner,
            { backgroundColor: withAlpha(c.primary, 0.1), borderColor: withAlpha(c.primary, 0.15) },
          ]}>
          <Text style={[styles.bannerText, { color: c.primary }]}>
            {t('figma.notifications.unreadBanner', { count: unreadCount })}
          </Text>
        </View>
      ) : null}

      {list.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : list.isError ? (
        <FigmaCard radius={FigmaRadius.r20} padding={20}>
          <View style={styles.stateBody}>
            <IconChip Icon={AlertCircle} color={c.error} size={44} radius={FigmaRadius.r16} iconSize={22} />
            <Text style={[styles.stateTitle, { color: c.text }]}>{t('figma.notifications.loadError')}</Text>
            <Pressable onPress={() => list.refetch()} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.markAllText, { color: c.primary }]}>{t('figma.notifications.retry')}</Text>
            </Pressable>
          </View>
        </FigmaCard>
      ) : items.length === 0 ? (
        <FigmaCard radius={FigmaRadius.r20} padding={24}>
          <View style={styles.stateBody}>
            <IconChip Icon={Bell} color={c.muted} size={48} radius={FigmaRadius.r16} iconSize={24} />
            <Text style={[styles.stateTitle, { color: c.text }]}>{t('figma.notifications.emptyTitle')}</Text>
            <Text style={[styles.stateSubtitle, muted]}>{t('figma.notifications.emptySubtitle')}</Text>
          </View>
        </FigmaCard>
      ) : (
        <View style={styles.list}>
          {items.map((n) => (
            <NotificationRow key={n.id} n={n} scheme={scheme} onOpen={() => onOpen(n)} />
          ))}

          {items.length >= limit ? (
            <Pressable
              onPress={() => setLimit((v) => v + NOTIFICATIONS_PAGE_SIZE)}
              accessibilityRole="button"
              style={[styles.loadMore, { borderColor: c.border, backgroundColor: c.card }]}>
              <Text style={[styles.loadMoreText, { color: c.primary }]}>{t('figma.notifications.loadMore')}</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </FigmaScreen>
  );
}

function NotificationRow({
  n,
  scheme,
  onOpen,
}: {
  n: AppNotification;
  scheme: FigmaScheme;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const c = FigmaColors[scheme];
  const unread = !n.read_at;
  const meta = notificationMeta(n.type);
  const cfg = TYPE_ICON[n.type] ?? TYPE_ICON.system;
  const stamp = `${ymdFromInstant(n.created_at)} ${hmFromInstant(n.created_at)}`.trim();

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      style={[
        styles.row,
        {
          backgroundColor: unread ? withAlpha(c.primary, scheme === 'dark' ? 0.08 : 0.06) : c.card,
          borderColor: unread ? withAlpha(c.primary, 0.15) : c.border,
        },
      ]}>
      <IconChip Icon={cfg.Icon} color={cfg.color} size={36} radius={FigmaRadius.r12} iconSize={16} style={styles.chip} />
      <View style={styles.body}>
        <View style={styles.titleLine}>
          <Text
            style={[styles.title, { color: c.text, fontFamily: unread ? FigmaFont.bold : FigmaFont.medium }]}
            numberOfLines={2}>
            {n.title}
          </Text>
          {unread ? <View style={[styles.dot, { backgroundColor: c.primary }]} /> : null}
        </View>
        <Text style={[styles.bodyText, muted(c)]}>{n.body}</Text>
        <Text style={[styles.time, muted(c)]}>
          {t(meta.labelKey)}
          {stamp ? `  ${isolateLtr(stamp)}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

function muted(c: (typeof FigmaColors)[FigmaScheme]) {
  return { color: c.muted, fontFamily: FigmaFont.regular };
}

const styles = StyleSheet.create({
  markAll: { paddingVertical: 4, justifyContent: 'center' },
  markAllText: { fontSize: 13, fontFamily: FigmaFont.medium },
  banner: {
    borderRadius: FigmaRadius.r16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bannerText: { fontSize: 12, fontFamily: FigmaFont.semibold },
  center: { paddingVertical: 48, alignItems: 'center' },
  stateBody: { alignItems: 'center', gap: 8 },
  stateTitle: { fontSize: 15, fontFamily: FigmaFont.semibold, textAlign: 'center' },
  stateSubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  list: { gap: 8, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: FigmaRadius.r16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  chip: { marginTop: 2 },
  body: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 14, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: FigmaRadius.pill, marginTop: 5, flexShrink: 0 },
  bodyText: { fontSize: 13, lineHeight: 20, marginTop: 2 },
  time: { fontSize: 11, marginTop: 4 },
  loadMore: {
    borderRadius: FigmaRadius.r16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  loadMoreText: { fontSize: 14, fontFamily: FigmaFont.semibold },
});
