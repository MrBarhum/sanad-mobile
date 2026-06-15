import '../global.css';

import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { IconFonts } from '@/components/icon';
import { Colors, FontFamily } from '@/constants/theme';
import { AppProviders } from '@/providers';

// Match the navigation container to the Sanad canvas so headers, transitions
// and the root background never flash the default react-navigation colors.
function navTheme(scheme: 'light' | 'dark') {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = Colors[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
    },
  };
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // The brand typeface (Arabic + Latin). Pure asset load — no native module, no
  // rebuild; Metro serves the files on the existing Development Build. If
  // loading errors we render anyway and text falls back to the system font.
  const [fontsLoaded, fontsError] = useFonts({
    [FontFamily.regular]: require('@/assets/fonts/IBMPlexSansArabic-Regular.ttf'),
    [FontFamily.medium]: require('@/assets/fonts/IBMPlexSansArabic-Medium.ttf'),
    [FontFamily.semibold]: require('@/assets/fonts/IBMPlexSansArabic-SemiBold.ttf'),
    [FontFamily.bold]: require('@/assets/fonts/IBMPlexSansArabic-Bold.ttf'),
    // Vector icon glyph fonts (Ionicons + MaterialCommunityIcons), so icons are
    // ready before first paint — same expo-font path, no native rebuild.
    ...IconFonts,
  });

  // Keep the native splash up for the (sub-100ms) local font load so the UI
  // never flashes the fallback font.
  if (!fontsLoaded && !fontsError) return null;

  return (
    <AppProviders>
      <ThemeProvider value={navTheme(colorScheme === 'dark' ? 'dark' : 'light')}>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </AppProviders>
  );
}
