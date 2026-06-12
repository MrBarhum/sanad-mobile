import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Small tappable hint that explains reminders come from notification settings and
 * links there. Used on the medications / tasks / appointments centers. Preferences
 * are user/circle-level (not per row), so this is informational, not a per-item
 * toggle. `messageKey` lets each screen phrase the context.
 */
export function ReminderNotice({ messageKey }: { messageKey: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  return (
    <Surface
      tone="info"
      onPress={() => router.push('/notification-settings')}
      accessibilityLabel={t('notifications.manageLink')}
      style={styles.card}>
      <View style={styles.row}>
        <ThemedText style={styles.bell} accessibilityElementsHidden>
          🔔
        </ThemedText>
        <View style={styles.text}>
          <ThemedText type="small" themeColor="infoFg">
            {t(messageKey)}
          </ThemedText>
          <ThemedText type="smallBold" style={{ color: theme.infoFg }}>
            {t('notifications.manageLink')} ›
          </ThemedText>
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  bell: { fontSize: 18, lineHeight: 22 },
  text: { flex: 1, gap: Spacing.half },
});
