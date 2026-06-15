import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useUnreadCount } from './hooks';

// A fixed, saturated badge red used as a small overlay fill (not a theme surface)
// so the white count stays high-contrast in BOTH light and dark themes — the
// theme's errorFg is intentionally lighter in dark mode and would weaken on white.
const BADGE_FILL = '#D92D20';

/**
 * Labeled notifications pill with an unread-count badge that opens the
 * notification center. Used in the app shell (dashboard header, account).
 * Deliberately a LABELED affordance (not an icon-only bell): clearer for older
 * users, and the unread count rides inside the pill so nothing overlaps.
 */
export function NotificationBell() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const { data } = useUnreadCount();
  const unread = data ?? 0;

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      accessibilityRole="button"
      accessibilityLabel={
        unread > 0
          ? t('notifications.openCenterWithCount', { count: unread })
          : t('notifications.openCenter')
      }
      hitSlop={Spacing.two}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: theme.border,
        },
      ]}>
      <Icon name="notification" size={18} color="primaryText" />
      <ThemedText style={[styles.label, { color: theme.primaryText }]}>
        {t('notifications.title')}
      </ThemedText>
      {unread > 0 ? (
        <View style={[styles.badge, { backgroundColor: BADGE_FILL }]}>
          <ThemedText style={styles.badgeText}>
            {unread > 99 ? '99+' : String(unread)}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: TouchTarget.min,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  label: { fontFamily: FontFamily.semibold, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: Radius.pill,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '700' },
});
