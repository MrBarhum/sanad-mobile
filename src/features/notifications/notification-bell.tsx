import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { useUnreadCount } from './hooks';

const BADGE = '#dc2626';

/**
 * Bell with an unread badge that opens the notification center. Used in the app
 * shell (dashboard header, account). Keeps a large touch target and an accessible
 * label that announces the unread count.
 */
export function NotificationBell() {
  const { t } = useTranslation();
  const router = useRouter();
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
      style={styles.wrap}>
      <ThemedText style={styles.bell}>🔔</ThemedText>
      {unread > 0 ? (
        <View style={styles.badge}>
          <ThemedText style={styles.badgeText}>{unread > 99 ? '99+' : String(unread)}</ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bell: { fontSize: 24 },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: BADGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
});
