import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { type IconName } from '@/constants/icons';
import { Radius, withAlpha, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon } from './icon';
import { ThemedText } from './themed-text';

export type GlyphChipTone =
  | 'primary'
  | 'accent'
  | 'neutral'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

const FG_BY_TONE: Record<GlyphChipTone, ThemeColor> = {
  primary: 'primaryText',
  accent: 'accentFg',
  neutral: 'textSecondary',
  success: 'successFg',
  warning: 'warningFg',
  error: 'errorFg',
  info: 'infoFg',
};

const BG_BY_TONE: Record<GlyphChipTone, ThemeColor> = {
  primary: 'primaryBg',
  accent: 'accentBg',
  neutral: 'backgroundSelected',
  success: 'successBg',
  warning: 'warningBg',
  error: 'errorBg',
  info: 'infoBg',
};

export type GlyphChipSize = 'xs' | 'sm' | 'md' | 'lg';

const DIAMETER: Record<GlyphChipSize, number> = { xs: 28, sm: 36, md: 44, lg: 64 };
const GLYPH_SIZE: Record<GlyphChipSize, number> = { xs: 14, sm: 16, md: 20, lg: 28 };

type GlyphChipProps = {
  /**
   * A semantic vector icon — the preferred way to give a chip its identity
   * (`<GlyphChip iconName="medication" />`).
   */
  iconName?: IconName;
  /**
   * A short text mark: an initial letter (contact / member avatars) or a
   * non-emoji glyph. Use this for letterform avatars — which a vector icon set
   * cannot render — or as a fallback; prefer `iconName` for iconography.
   */
  glyph?: string;
  tone?: GlyphChipTone;
  /**
   * A per-feature identity color from the theme ramp (e.g. `'categoryTeal'`). When
   * set it OVERRIDES `tone`: the mark takes this color on a soft tint of it — the
   * way per-feature/category chips read across the app (the old `IconChip`).
   */
  color?: ThemeColor;
  size?: GlyphChipSize;
  /**
   * Chips are decorative anchors by default (the adjacent text carries the
   * meaning). Pass a label only when the chip stands alone.
   */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Sanad's identity anchor: a soft tinted circle holding a vector icon or a
 * letterform. Gives cards, empty states and rows one consistent, themable visual
 * language (shape carries identity; tint stays within the calm palette; never
 * the sole carrier of meaning).
 */
export function GlyphChip({
  iconName,
  glyph,
  tone = 'primary',
  color,
  size = 'md',
  accessibilityLabel,
  style,
}: GlyphChipProps) {
  const theme = useTheme();
  const diameter = DIAMETER[size];
  // A per-feature `color` overrides the semantic tone: the mark takes that color on
  // a soft tint of it; otherwise the tone drives both fg + bg from the palette.
  const fg: ThemeColor = color ?? FG_BY_TONE[tone];
  const bg = color ? withAlpha(theme[color], 0.14) : theme[BG_BY_TONE[tone]];

  return (
    <View
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      accessibilityLabel={accessibilityLabel}
      style={[styles.chip, { width: diameter, height: diameter, backgroundColor: bg }, style]}>
      {iconName ? (
        <Icon name={iconName} size={GLYPH_SIZE[size]} color={fg} />
      ) : glyph ? (
        <ThemedText
          themeColor={fg}
          style={[styles.glyph, { fontSize: GLYPH_SIZE[size], lineHeight: GLYPH_SIZE[size] + 8 }]}>
          {glyph}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontWeight: '700', textAlign: 'center' },
});
