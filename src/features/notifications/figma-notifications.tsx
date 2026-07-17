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
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FigmaCard } from '@/components/figma/figma-card';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { IconChip } from '@/components/figma/icon-chip';
import { isolateLtr } from '@/components/ltr-text';
import { FontFamily, Radius, withAlpha, type ThemeColor } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
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
const TYPE_ICON: Record<NotificationType, { Icon: IconCmp; colorKey: ThemeColor }> = {
  medication_due: { Icon: Pill, colorKey: 'categoryTeal' },
  medication_missed: { Icon: Pill, colorKey: 'errorFg' },
  task_due: { Icon: Check, colorKey: 'categoryGold' },
  appointment_upcoming: { Icon: Calendar, colorKey: 'categoryBlue' },
  visit_update: { Icon: Stethoscope, colorKey: 'categoryGreen' },
  care_update: { Icon: FileText, colorKey: 'categoryPurple' },
  emergency: { Icon: Siren, colorKey: 'errorFg' },
  system: { Icon: Bell, colorKey: 'categoryBlue' },
  // Phase 2F responsibility-aware types. Decorative icon + calm category/status tint;
  // item_cancelled uses a muted purple (NOT error red) so "not completed" doesn't alarm.
  item_assigned: { Icon: UserCheck, colorKey: 'categoryBlue' },
  task_overdue: { Icon: Clock, colorKey: 'warningFg' },
  visit_upcoming: { Icon: Calendar, colorKey: 'categoryGreen' },
  item_claimed: { Icon: Hand, colorKey: 'categoryTeal' },
  item_completed: { Icon: Check, colorKey: 'successFg' },
  item_cancelled: { Icon: XCircle, colorKey: 'categoryPurple' },
  claim_digest: { Icon: Sparkles, colorKey: 'categoryGold' },
};

/**
 * The Figma Make NotificationsScreen, recreated as literally as possible in
 * React Native and wired to real Sanad data. Mirrors `NotificationsScreen.tsx`:
 * a back + centered title header with a "mark all read" text action (only when
 * there are unread items), an unread-count banner, and a recent-first list of
 * rows — each a per-type icon chip + title + body + time + unread dot, with
 * unread rows tinted and read rows plain. IBM Plex + theme tokens, dark-first, RTL.
 *
 * Reuses the NotificationsCenter hooks/data VERBATIM (useNotifications /
 * useMarkAllRead / useMarkNotificationRead / useOpenNotification), keeping the
 * same read/unread + open behavior. Opt-in/push registration is untouched (it
 * lives behind the separate /notification-settings route).
 */
export function FigmaNotifications() {
  const { t } = useTranslation();
  const scheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = useTheme();

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

  const muted = { color: c.textSecondary, fontFamily: FontFamily.regular };

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
        <FigmaCard radius={Radius.card} padding={20}>
          <View style={styles.stateBody}>
            <IconChip Icon={AlertCircle} color={c.errorFg} size={44} radius={Radius.lg} iconSize={22} />
            <Text style={[styles.stateTitle, { color: c.text }]}>{t('figma.notifications.loadError')}</Text>
            <Pressable onPress={() => list.refetch()} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.markAllText, { color: c.primary }]}>{t('figma.notifications.retry')}</Text>
            </Pressable>
          </View>
        </FigmaCard>
      ) : items.length === 0 ? (
        <FigmaCard radius={Radius.card} padding={24}>
          <View style={styles.stateBody}>
            <IconChip Icon={Bell} color={c.textSecondary} size={48} radius={Radius.lg} iconSize={24} />
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
              style={[styles.loadMore, { borderColor: c.border, backgroundColor: c.backgroundElement }]}>
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
  scheme: 'light' | 'dark';
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
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
          backgroundColor: unread ? withAlpha(c.primary, scheme === 'dark' ? 0.08 : 0.06) : c.backgroundElement,
          borderColor: unread ? withAlpha(c.primary, 0.15) : c.border,
        },
      ]}>
      <IconChip Icon={cfg.Icon} color={c[cfg.colorKey]} size={36} radius={Radius.md} iconSize={16} style={styles.chip} />
      <View style={styles.body}>
        <View style={styles.titleLine}>
          <Text
            style={[styles.title, { color: c.text, fontFamily: unread ? FontFamily.bold : FontFamily.medium }]}
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

function muted(c: ReturnType<typeof useTheme>) {
  return { color: c.textSecondary, fontFamily: FontFamily.regular };
}

const styles = StyleSheet.create({
  markAll: { paddingVertical: 4, justifyContent: 'center' },
  markAllText: { fontSize: 14, fontFamily: FontFamily.medium },
  banner: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bannerText: { fontSize: 14, fontFamily: FontFamily.semibold },
  center: { paddingVertical: 48, alignItems: 'center' },
  stateBody: { alignItems: 'center', gap: 8 },
  stateTitle: { fontSize: 15, fontFamily: FontFamily.semibold, textAlign: 'center' },
  stateSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  list: { gap: 8, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  chip: { marginTop: 2 },
  body: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 14, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: Radius.pill, marginTop: 5, flexShrink: 0 },
  bodyText: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  time: { fontSize: 14, marginTop: 4 },
  loadMore: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  loadMoreText: { fontSize: 14, fontFamily: FontFamily.semibold },
});
