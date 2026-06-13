import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Button } from './button';
import { GlyphChip } from './glyph-chip';
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
  return (
    <ThemedView style={styles.centered}>
      <GlyphChip glyph="!" tone="error" size="lg" />
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
  /** Optional decorative glyph above the title â€” a non-emoji mark (â—‰ âœ“ âœŽ â™¡ â€¦). */
  icon?: string;
}) {
  return (
    <Surface tone="card" style={styles.empty}>
      {icon ? <GlyphChip glyph={icon} tone="neutral" size="lg" /> : null}
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
    gap: Spacing.three,
    alignItems: 'center',
  },
  centerText: { textAlign: 'center' },
});
