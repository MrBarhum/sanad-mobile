import { StyleSheet, View } from 'react-native';

import { type IconName } from '@/constants/icons';
import { Spacing } from '@/constants/theme';

import { GlyphChip, type GlyphChipTone } from './glyph-chip';
import { Icon } from './icon';
import { Surface, type SurfaceTone } from './surface';
import { ThemedText } from './themed-text';

type NavCardProps = {
  /** Semantic icon for the leading identity chip (preferred). */
  iconName?: IconName;
  /** Legacy decorative glyph for the leading chip. Prefer `iconName`. */
  glyph?: string;
  glyphTone?: GlyphChipTone;
  title: string;
  /** Live summary or description under the title. */
  subtitle?: string;
  onPress: () => void;
  /** Surface tone — e.g. 'error' for the emergency card. */
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
 * meaning, chevron signals navigation — the chevron mirrors in RTL via <Icon>).
 */
export function NavCard({
  iconName,
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
  return (
    <Surface
      tone={tone}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      style={styles.card}>
      <View style={styles.row}>
        <GlyphChip iconName={iconName} glyph={glyph} tone={glyphTone} />
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
        <Icon name="chevron" size={26} color={tone === 'error' ? 'errorFg' : 'textMuted'} />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 88, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  text: { flex: 1, gap: Spacing.half },
});
