/**
 * Cairo typography fragments for the reskinned shared form & picker primitives
 * (MS-0). The committed Figma visual language renders in **Cairo** (registered in
 * the root layout via `@expo-google-fonts/cairo`); the legacy form primitives
 * still rendered in IBM Plex Sans Arabic.
 *
 * These primitives keep Sanad's accessibility-tuned sizes + line-heights AND the
 * legacy theme colors — which were already re-pointed to the Figma teal / warm
 * graphite palette in Phase A (see `src/constants/theme.ts`). The ONLY visual
 * change MS-0 makes to text is the typeface: applied here as a `fontFamily`
 * style override layered on top of the existing `ThemedText` / `TextInput`
 * styles, so size, weight, color and accessibility behavior stay exactly as
 * before. Centralized so the IBM-Plex→Cairo mapping is not duplicated per file.
 *
 * Pair each fragment with the matching numeric weight already on the element
 * (Cairo ships one family per weight) — e.g. a `smallBold` (600) label takes
 * `Cairo.semibold`, a `sectionTitle` (700) heading takes `Cairo.bold`.
 */
import type { TextStyle } from 'react-native';

import { FigmaFont } from './figma-tokens';

type CairoWeight = 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';

export const Cairo: Record<CairoWeight, TextStyle> = {
  regular: { fontFamily: FigmaFont.regular },
  medium: { fontFamily: FigmaFont.medium },
  semibold: { fontFamily: FigmaFont.semibold },
  bold: { fontFamily: FigmaFont.bold },
  extrabold: { fontFamily: FigmaFont.extrabold },
};
