import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GlyphChip, type GlyphChipTone } from './glyph-chip';
import { Surface, type SurfaceTone } from './surface';
import { ThemedText } from './themed-text';

type NavCardProps = {
  /** Decorative non-emoji glyph for the leading identity chip (â—‰ âœ“ âœŽ â™¡ â—· âŒ‚ â€¦). */
  glyph: string;
  glyphTone?: GlyphChipTone;
  title: string;
  /** Live summary or description under the title. */
  subtitle?: string;
  onPress: () => void;
  /** Surface tone â€” e.g. 'error' for the emergency card. */
  tone?: SurfaceTone;
  /** Title color override (theme color name), e.g. 'errorFg' on the emergency card. */
  titleColor?: 'text' | 'errorFg';
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/**
 * The dashboard/navigation card: identity chip + title + live subtitle + a
 * trailing chevron. One shared implementation keeps every feature entry point
 * on the home screen visually identical (chip carries identity, text carries
 * meaning, chevron signals navigation â€” RTL-safe, no physical offsets).
 */
export function NavCard({
  glyph,
  glyphTone = 'primary',
  title,
  subtitle,
  onPress,
  tone = 'card',
  titleColor = 'text',
  accessibilityLabel,
  accessibilityHint,
}: NavCardProps) {
  const theme = useTheme();

  return (
    <Surface
      tone={tone}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      style={styles.card}>
      <View style={styles.row}>
        <GlyphChip glyph={glyph} tone={glyphTone} />
        <View style={styles.text}>
          <ThemedText type="cardTitle" themeColor={titleColor}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText
          style={[styles.chevron, { color: tone === 'error' ? theme.errorFg : theme.textMuted }]}
          accessibilityElementsHidden
          importantForAccessibility="no">
          â€º
        </ThemedText>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 88, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  text: { flex: 1, gap: Spacing.half },
  chevron: { fontSize: 26, lineHeight: 30, fontWeight: '600' },
});
