import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { I18nManager, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { ICONS, type IconEntry, type IconName } from '@/constants/icons';
import { IconSize, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Font map for the bundled icon families, spread into the root layout's
 * `useFonts` so the glyph fonts are ready before first paint (no missing-icon
 * flash). Pure asset load through the already-present `expo-font` — no native
 * rebuild.
 */
export const IconFonts = { ...Ionicons.font, ...MaterialCommunityIcons.font };

export type IconSizeToken = keyof typeof IconSize;

type IconProps = {
  /** Semantic icon name (see `src/constants/icons.ts`) — never a raw family glyph. */
  name: IconName;
  /** A size token (`sm | md | lg | xl`) or an explicit pixel size. Default `md`. */
  size?: IconSizeToken | number;
  /** Theme color token, resolved for the active light/dark scheme. Default `text`. */
  color?: ThemeColor;
  /**
   * When provided, the icon is meaningful and announced with this label.
   * Omitted (the default) ⇒ the icon is decorative and hidden from screen
   * readers (its adjacent text carries the meaning).
   */
  accessibilityLabel?: string;
  style?: StyleProp<TextStyle>;
};

/**
 * The one centralized icon. The single file allowed to import the vector
 * families directly — everything else references semantic names so size, color,
 * accessibility and RTL mirroring are enforced in exactly one place.
 *
 * - Color flows through `useTheme()`, so icons follow light/dark automatically.
 * - Directional icons (e.g. the nav chevron) mirror in RTL via the family's
 *   start/end glyph pair, or a horizontal flip when no paired glyph exists.
 * - Decorative by default; pass `accessibilityLabel` only for a standalone icon.
 */
export function Icon({ name, size = 'md', color = 'text', accessibilityLabel, style }: IconProps) {
  const theme = useTheme();
  const entry: IconEntry = ICONS[name];
  const px = typeof size === 'number' ? size : IconSize[size];
  const tint = theme[color];
  const isRTL = I18nManager.isRTL;

  const glyphName = entry.directional && isRTL && entry.rtlName ? entry.rtlName : entry.name;
  const flip = !!entry.directional && isRTL && !entry.rtlName;
  const decorative = !accessibilityLabel;

  const shared = {
    size: px,
    color: tint,
    style: [flip ? styles.flip : null, style] as StyleProp<TextStyle>,
    accessibilityElementsHidden: decorative,
    importantForAccessibility: (decorative ? 'no-hide-descendants' : 'yes') as
      | 'no-hide-descendants'
      | 'yes',
    accessibilityRole: decorative ? undefined : ('image' as const),
    accessibilityLabel,
  };

  if (entry.family === 'material-community') {
    return (
      <MaterialCommunityIcons
        name={glyphName as ComponentProps<typeof MaterialCommunityIcons>['name']}
        {...shared}
      />
    );
  }
  return <Ionicons name={glyphName as ComponentProps<typeof Ionicons>['name']} {...shared} />;
}

const styles = StyleSheet.create({
  flip: { transform: [{ scaleX: -1 }] },
});
