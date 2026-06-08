import { ActivityIndicator, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Button } from './button';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

/** Full-area centered spinner for a screen/section that is loading. */
export function LoadingState() {
  const theme = useTheme();
  return (
    <ThemedView style={styles.centered}>
      <ActivityIndicator color={theme.text} />
    </ThemedView>
  );
}

/** Full-area centered error message with a retry button. */
export function ErrorState({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <ThemedView style={styles.centered}>
      <ThemedText style={styles.message} accessibilityRole="alert">
        {message}
      </ThemedText>
      <Button label={retryLabel} onPress={onRetry} variant="secondary" />
    </ThemedView>
  );
}

/** Centered empty-state message (e.g. an empty list). */
export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.empty}>
      <ThemedText style={styles.emptyTitle}>{title}</ThemedText>
      {subtitle ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.emptySubtitle}>
          {subtitle}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  message: { textAlign: 'center' },
  empty: {
    borderRadius: Spacing.four,
    padding: Spacing.five,
    gap: Spacing.two,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  emptySubtitle: { textAlign: 'center' },
});
