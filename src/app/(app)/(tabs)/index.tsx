import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { CareCircleDashboard } from '@/features/care-circle/circle-dashboard';
import { useCircleSummary } from '@/features/care-circle/hooks';
import { CareCircleOnboarding } from '@/features/care-circle/onboarding-form';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';

/**
 * Home decides what the authenticated user sees:
 *   - loading  → spinner
 *   - error    → message + retry
 *   - no circle → onboarding (create the first care circle)
 *   - has circle → dashboard
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { user } = useAuth();
  const summary = useCircleSummary(user?.id);

  // Home is behind the (app) auth guard, but keep the types honest.
  if (!user) return null;

  if (summary.isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.text} />
      </ThemedView>
    );
  }

  if (summary.isError) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centeredSafe} edges={['top', 'left', 'right']}>
          <ThemedText style={styles.errorText} accessibilityRole="alert">
            {t('careCircle.loadError')}
          </ThemedText>
          <Pressable
            onPress={() => summary.refetch()}
            accessibilityRole="button"
            style={[styles.retry, { backgroundColor: theme.text }]}>
            <ThemedText style={[styles.retryLabel, { color: theme.background }]}>
              {t('retry')}
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return summary.data ? (
    <CareCircleDashboard summary={summary.data} />
  ) : (
    <CareCircleOnboarding userId={user.id} />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centeredSafe: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  errorText: { textAlign: 'center' },
  retry: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLabel: { fontSize: 16, fontWeight: '600' },
});
