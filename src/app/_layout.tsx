import '../global.css';

import {
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
  Cairo_900Black,
} from '@expo-google-fonts/cairo';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { IconFonts } from '@/components/icon';
import { Colors, FontFamily } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-theme';
import { PendingJoinLink } from '@/features/invitations/pending-join-link';
import { bootstrapNotifications } from '@/features/notifications/push-registration';
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
  // The brand typeface — Cairo (Arabic + Latin), the single Dar family. Pure asset
  // load from @expo-google-fonts/cairo — no native module, no rebuild; Metro serves
  // the files on the existing Development Build. If loading errors we render anyway
  // and text falls back to the system font. Weights 400/600/700/800/900 map to the
  // FontFamily keys regular/medium/semibold/bold/black.
  const [fontsLoaded, fontsError] = useFonts({
    [FontFamily.regular]: Cairo_400Regular,
    [FontFamily.medium]: Cairo_600SemiBold,
    [FontFamily.semibold]: Cairo_700Bold,
    [FontFamily.bold]: Cairo_800ExtraBold,
    [FontFamily.black]: Cairo_900Black,
    // Vector icon glyph fonts (Ionicons + MaterialCommunityIcons), so icons are
    // ready before first paint — same expo-font path, no native rebuild.
    ...IconFonts,
  });

  // Populate the OS notification channel + action-category store at the earliest
  // bootstrap point — BEFORE the auth gate in (app)/_layout.tsx — so a push that
  // arrives on first launch or while signed out still renders its action buttons.
  // Idempotent and never prompts for permission (preserves the explicit opt-in).
  // Runs unconditionally (before the font gate below) to satisfy rules-of-hooks.
  useEffect(() => {
    void bootstrapNotifications();
  }, []);

  // Keep the native splash up for the (sub-100ms) local font load so the UI
  // never flashes the fallback font.
  if (!fontsLoaded && !fontsError) return null;

  return (
    <AppProviders>
      <ThemedNavigationRoot />
    </AppProviders>
  );
}

/**
 * The navigation container, themed by the RESOLVED scheme (in-app appearance
 * preference over the OS). Lives inside `AppProviders` so it reads the same
 * `ThemePreferenceProvider` every screen reads — one theming mechanism.
 */
function ThemedNavigationRoot() {
  const scheme = useResolvedScheme();
  return (
    <ThemeProvider value={navTheme(scheme)}>
      {/* Headless: replays a WhatsApp join code captured while signed out into
          /join-circle after authentication (survives the auth gate). */}
      <PendingJoinLink />
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
