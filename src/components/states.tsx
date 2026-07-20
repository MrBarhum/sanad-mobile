import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { type IconName } from '@/constants/icons';
import { FontFamily } from '@/constants/theme';
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

/** Full-area centered error message with a retry button (Dar: an err icon square). */
export function ErrorState({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  const c = useTheme();
  return (
    <ThemedView style={styles.centered}>
      <GlyphChip iconName="warning" tone="error" size="lg" />
      <Text style={[styles.message, { color: c.text }]} accessibilityRole="alert">
        {message}
      </Text>
      <Button label={retryLabel} onPress={onRetry} variant="secondary" />
    </ThemedView>
  );
}

/** The Dar quiet empty-state card: a tinted circle icon + a 20/800 title + a
 *  16/600 reassuring line. Calm, never an error. */
export function EmptyState({
  title,
  subtitle,
  icon,
  iconName,
}: {
  title: string;
  subtitle?: string;
  /** Optional decorative glyph above the title — legacy text mark. Prefer `iconName`. */
  icon?: string;
  /** Optional semantic icon above the title (preferred). */
  iconName?: IconName;
}) {
  const c = useTheme();
  return (
    <Surface tone="card" style={styles.empty}>
      {iconName ? (
        <GlyphChip iconName={iconName} tone="success" size="lg" shape="circle" />
      ) : icon ? (
        <GlyphChip glyph={icon} tone="success" size="lg" shape="circle" />
      ) : null}
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: c.textSecondary }]}>{subtitle}</Text> : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, paddingHorizontal: 24 },
  message: { textAlign: 'center', fontSize: 16, fontFamily: FontFamily.semibold, lineHeight: 26 },
  empty: { paddingVertical: 32, paddingHorizontal: 24, gap: 16, alignItems: 'center' },
  title: { textAlign: 'center', fontSize: 20, fontFamily: FontFamily.bold, lineHeight: 30 },
  subtitle: { textAlign: 'center', fontSize: 16, fontFamily: FontFamily.medium, lineHeight: 27 },
});
