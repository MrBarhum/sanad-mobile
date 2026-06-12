import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Button } from './button';
import { Surface } from './surface';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

/** Full-area centered spinner for a screen/section that is loading. */
export function LoadingState({ label }: { label?: string }) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.centered}>
      <ActivityIndicator color={theme.primary} size="large" />
      {label ? (
        <ThemedText themeColor="textSecondary" accessibilityRole="text">
          {label}
        </ThemedText>
      ) : null}
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
  const theme = useTheme();
  return (
    <ThemedView style={styles.centered}>
      <View style={[styles.iconCircle, { borderColor: theme.errorFg }]}>
        <ThemedText style={[styles.iconGlyph, { color: theme.errorFg }]}>!</ThemedText>
      </View>
      <ThemedText style={styles.message} accessibilityRole="alert">
        {message}
      </ThemedText>
      <Button label={retryLabel} onPress={onRetry} variant="secondary" />
    </ThemedView>
  );
}

/** Centered empty-state card (e.g. an empty list). */
export function EmptyState({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  /** Optional decorative glyph above the title. */
  icon?: string;
}) {
  return (
    <Surface tone="card" style={styles.empty}>
      {icon ? <ThemedText style={styles.emptyIcon}>{icon}</ThemedText> : null}
      <ThemedText type="cardTitle" style={styles.centerText}>
        {title}
      </ThemedText>
      {subtitle ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          {subtitle}
        </ThemedText>
      ) : null}
    </Surface>
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
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    alignItems: 'center',
  },
  emptyIcon: { fontSize: 40, lineHeight: 48 },
  centerText: { textAlign: 'center' },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { fontSize: 28, fontWeight: '800' },
});
