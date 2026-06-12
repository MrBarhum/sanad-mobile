import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/**
 * Small tappable hint that explains reminders come from notification settings and
 * links there. Used on the medications / tasks / appointments centers. Preferences
 * are user/circle-level (not per row), so this is informational, not a per-item
 * toggle. `messageKey` lets each screen phrase the context.
 */
export function ReminderNotice({ messageKey }: { messageKey: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/notification-settings')}
      accessibilityRole="button"
      accessibilityLabel={t('notifications.manageLink')}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="small" themeColor="textSecondary">
          🔔 {t(messageKey)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.link}>
          {t('notifications.manageLink')}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.half },
  link: { fontWeight: '600' },
});
