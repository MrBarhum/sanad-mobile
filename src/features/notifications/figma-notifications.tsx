import { Bell } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SkeletonList } from '@/components/skeleton';
import { useTranslation } from 'react-i18next';

import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { GlyphChip, type GlyphChipTone } from '@/components/glyph-chip';
import { EmptyState } from '@/components/states';
import { isolateLtr } from '@/components/ltr-text';
import { Surface } from '@/components/surface';
import { type IconName } from '@/constants/icons';
import { BorderWidth, FontFamily, Radius } from '@/constants/theme';
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

/**
 * Per-type Dar anchor: a lucide icon (kept from the prior map) + a semantic
 * GlyphChip `tone` that paints the row's 38dp icon square with the matching
 * Dar tint pair (frame 7c). The chip is decorative; the type label text below
 * always carries the meaning. Tint→tone follows the frame: tok/ok = `success`
 * (medication, completions), twarn/warn = `warning` (overdue), tacc/acc =
 * `primary` (reminders/updates/info), terr/err = `error` (missed dose /
 * emergency), and the SANCTIONED gold pair (goldFill/goldInk) = `accent`,
 * reserved for the «متاح للتكفّل» claim digest only (Dar gold law).
 */
const TYPE_ICON: Record<NotificationType, { iconName: IconName; tone: GlyphChipTone }> = {
  medication_due: { iconName: 'medication', tone: 'success' },
  medication_missed: { iconName: 'medication', tone: 'error' },
  task_due: { iconName: 'success', tone: 'primary' },
  appointment_upcoming: { iconName: 'appointment', tone: 'primary' },
  visit_update: { iconName: 'doctor', tone: 'success' },
  care_update: { iconName: 'dailyLog', tone: 'primary' },
  emergency: { iconName: 'emergency', tone: 'error' },
  system: { iconName: 'notification', tone: 'primary' },
  // Phase 2F responsibility-aware types. item_cancelled stays a calm `primary`
  // (NOT error) so "not completed" doesn't alarm; claim_digest is the one
  // sanctioned gold surface (available-to-claim).
  item_assigned: { iconName: 'member', tone: 'primary' },
  task_overdue: { iconName: 'clock', tone: 'warning' },
  visit_upcoming: { iconName: 'appointment', tone: 'primary' },
  item_claimed: { iconName: 'claim', tone: 'success' },
  item_completed: { iconName: 'success', tone: 'success' },
  item_cancelled: { iconName: 'error', tone: 'primary' },
  claim_digest: { iconName: 'sparkle', tone: 'accent' },
};

/**
 * The Dar notifications feed (frame 7c), wired to real Sanad data. A green band
 * header with a centered title + an underlined "mark all read" action (only when
 * there are unread items), an unread-count banner (bell + count), and a
 * recent-first list of rows — each a per-type tinted icon square + title + body
 * + type-label·time meta + an unread dot. Unread rows carry a `tacc` fill; read
 * rows a plain `card` fill; both share the 2px `line` border. Cairo, RTL, both
 * themes.
 *
 * Reuses the NotificationsCenter hooks/data VERBATIM (useNotifications /
 * useMarkAllRead / useMarkNotificationRead / useOpenNotification), keeping the
 * same read/unread + open behavior. Opt-in/push registration is untouched (it
 * lives behind the separate /notification-settings route).
 */
export function FigmaNotifications() {
  const { t } = useTranslation();
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

  return (
    <FigmaScreen gap={12}>
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
              <Text
                style={[styles.markAllText, { color: c.bandInk, opacity: markAll.isPending ? 0.5 : 1 }]}>
                {t('figma.notifications.markAllRead')}
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      {unreadCount > 0 ? (
        <View style={[styles.banner, { backgroundColor: c.primaryBg, borderColor: c.border }]}>
          <Bell size={17} color={c.primaryText} strokeWidth={2.2} />
          <Text style={[styles.bannerText, { color: c.primaryText }]}>
            {t('figma.notifications.unreadBanner', { count: unreadCount })}
          </Text>
        </View>
      ) : null}

      {list.isLoading ? (
        <SkeletonList />
      ) : list.isError ? (
        <Surface radius={Radius.card} padded={20}>
          <View style={styles.stateBody}>
            <GlyphChip iconName="error" tone="error" size="md" />
            <Text style={[styles.stateTitle, { color: c.text }]}>{t('figma.notifications.loadError')}</Text>
            <Pressable onPress={() => list.refetch()} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.retryText, { color: c.primaryText }]}>{t('figma.notifications.retry')}</Text>
            </Pressable>
          </View>
        </Surface>
      ) : items.length === 0 ? (
        <EmptyState
          iconName="notification"
          title={t('figma.notifications.emptyTitle')}
          subtitle={t('figma.notifications.emptySubtitle')}
        />
      ) : (
        <View style={styles.list}>
          {items.map((n) => (
            <NotificationRow key={n.id} n={n} onOpen={() => onOpen(n)} />
          ))}

          {items.length >= limit ? (
            <Pressable
              onPress={() => setLimit((v) => v + NOTIFICATIONS_PAGE_SIZE)}
              accessibilityRole="button"
              style={[styles.loadMore, { borderColor: c.border, backgroundColor: c.backgroundElement }]}>
              <Text style={[styles.loadMoreText, { color: c.primaryText }]}>{t('figma.notifications.loadMore')}</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </FigmaScreen>
  );
}

function NotificationRow({ n, onOpen }: { n: AppNotification; onOpen: () => void }) {
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
        { backgroundColor: unread ? c.primaryBg : c.backgroundElement, borderColor: c.border },
      ]}>
      <GlyphChip iconName={cfg.iconName} tone={cfg.tone} size="sm" style={styles.chip} />
      <View style={styles.body}>
        <View style={styles.titleLine}>
          <Text
            style={[styles.title, { color: c.text, fontFamily: unread ? FontFamily.bold : FontFamily.semibold }]}
            numberOfLines={2}>
            {n.title}
          </Text>
          {unread ? <View style={[styles.dot, { backgroundColor: c.primaryText }]} /> : null}
        </View>
        {n.body ? <Text style={[styles.bodyText, { color: c.textSecondary }]}>{n.body}</Text> : null}
        <Text style={[styles.time, { color: c.textSecondary }]}>
          {stamp ? `${t(meta.labelKey)}  ·  ${isolateLtr(stamp)}` : t(meta.labelKey)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  markAll: { paddingVertical: 4, justifyContent: 'center' },
  markAllText: { fontSize: 15, fontFamily: FontFamily.bold, textDecorationLine: 'underline' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: Radius.card,
    borderWidth: BorderWidth.standard,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bannerText: { fontSize: 15, fontFamily: FontFamily.bold },
  stateBody: { alignItems: 'center', gap: 8 },
  stateTitle: { fontSize: 16, fontFamily: FontFamily.semibold, textAlign: 'center' },
  retryText: { fontSize: 15, fontFamily: FontFamily.bold },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: Radius.card,
    borderWidth: BorderWidth.standard,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chip: { width: 38, height: 38 },
  body: { flex: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 16, lineHeight: 24 },
  dot: { width: 9, height: 9, borderRadius: Radius.pill, flexShrink: 0 },
  bodyText: { fontSize: 15, lineHeight: 24, marginTop: 2, fontFamily: FontFamily.medium },
  time: { fontSize: 14, lineHeight: 20, marginTop: 3, fontFamily: FontFamily.semibold },
  loadMore: {
    borderRadius: Radius.card,
    borderWidth: BorderWidth.standard,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadMoreText: { fontSize: 16, fontFamily: FontFamily.bold },
});
