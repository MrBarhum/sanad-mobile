/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemePreference } from '@/providers/theme-provider';

/**
 * The concrete scheme in effect: the in-app appearance preference wins over the OS
 * (`light`/`dark`), and `system` follows `useColorScheme()`. THE single resolution
 * point — both `useTheme()` and the root navigation theme read it, so there is only
 * one theming mechanism.
 */
export function useResolvedScheme(): 'light' | 'dark' {
  const { preference } = useThemePreference();
  const system = useColorScheme();
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  return Colors[useResolvedScheme()];
}
