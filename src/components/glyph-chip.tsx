import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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

export type GlyphChipSize = 'sm' | 'md' | 'lg';

const DIAMETER: Record<GlyphChipSize, number> = { sm: 36, md: 44, lg: 64 };
const GLYPH_SIZE: Record<GlyphChipSize, number> = { sm: 16, md: 20, lg: 28 };

type GlyphChipProps = {
  /**
   * A short mark: a non-emoji Unicode glyph (✚ ◉ ♡ ✎ ✓ ◷ ⌂ ❖ ✦ …) or an
   * initial letter (contact avatars). Emojis are deliberately avoided — they
   * render as inconsistent multicolor OEM artwork and break the calm palette.
   */
  glyph: string;
  tone?: GlyphChipTone;
  size?: GlyphChipSize;
  /**
   * Chips are decorative anchors by default (the adjacent text carries the
   * meaning). Pass a label only when the chip stands alone.
   */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Sanad's identity anchor: a soft tinted circle holding a bold glyph or
 * letterform. Replaces ad-hoc emoji icons on cards, empty states and rows with
 * one consistent, themable visual language (shape carries identity; tint stays
 * within the calm palette; never the sole carrier of meaning).
 */
export function GlyphChip({
  glyph,
  tone = 'primary',
  size = 'md',
  accessibilityLabel,
  style,
}: GlyphChipProps) {
  const theme = useTheme();
  const diameter = DIAMETER[size];

  return (
    <View
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.chip,
        {
          width: diameter,
          height: diameter,
          backgroundColor: theme[BG_BY_TONE[tone]],
        },
        style,
      ]}>
      <ThemedText
        themeColor={FG_BY_TONE[tone]}
        style={[styles.glyph, { fontSize: GLYPH_SIZE[size], lineHeight: GLYPH_SIZE[size] + 8 }]}>
        {glyph}
      </ThemedText>
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
