import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { type IconName } from '@/constants/icons';
import { BorderWidth, Radius, withAlpha, type ThemeColor } from '@/constants/theme';
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
  neutral: 'backgroundSunken',
  success: 'successBg',
  warning: 'warningBg',
  error: 'errorBg',
  info: 'infoBg',
};

export type GlyphChipSize = 'xs' | 'sm' | 'md' | 'lg';

const DIAMETER: Record<GlyphChipSize, number> = { xs: 28, sm: 34, md: 40, lg: 64 };
const GLYPH_SIZE: Record<GlyphChipSize, number> = { xs: 14, sm: 16, md: 20, lg: 28 };

type GlyphChipProps = {
  iconName?: IconName;
  /** A short text mark — an initial letter (member/contact avatars) or a glyph. */
  glyph?: string;
  tone?: GlyphChipTone;
  /** A per-feature identity color; OVERRIDES tone (mark on a soft tint of it). */
  color?: ThemeColor;
  size?: GlyphChipSize;
  /** Dar shape: `square` (radius 6, the icon-square default) or `circle` (avatars,
   *  empty-state icons). Both carry a 2px `line` border + a tint fill. */
  shape?: 'square' | 'circle';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * The Dar identity anchor: a 2px-bordered tinted tile (radius 6) — or a circle for
 * avatars / empty-state icons — holding a vector icon or a letterform. Gives cards,
 * rows and empties one consistent visual language (shape carries identity; tint
 * stays within the calm palette; never the sole carrier of meaning).
 */
export function GlyphChip({
  iconName,
  glyph,
  tone = 'primary',
  color,
  size = 'md',
  shape = 'square',
  accessibilityLabel,
  style,
}: GlyphChipProps) {
  const c = useTheme();
  const diameter = DIAMETER[size];
  const fg: ThemeColor = color ?? FG_BY_TONE[tone];
  const bg = color ? withAlpha(c[color], 0.14) : c[BG_BY_TONE[tone]];
  const radius = shape === 'circle' ? Radius.pill : Radius.control;

  return (
    <View
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.chip,
        { width: diameter, height: diameter, backgroundColor: bg, borderColor: c.border, borderRadius: radius },
        style,
      ]}>
      {iconName ? (
        <Icon name={iconName} size={GLYPH_SIZE[size]} color={fg} />
      ) : glyph ? (
        <ThemedText
          themeColor={fg}
          style={[styles.glyph, { fontSize: GLYPH_SIZE[size] + 2, lineHeight: GLYPH_SIZE[size] + 10 }]}>
          {glyph}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: BorderWidth.standard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontWeight: '900', textAlign: 'center' },
});
