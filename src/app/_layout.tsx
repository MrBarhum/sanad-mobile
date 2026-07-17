import '../global.css';

import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
} from '@expo-google-fonts/cairo';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { IconFonts } from '@/components/icon';
import { Colors, FontFamily } from '@/constants/theme';
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
    // Cairo — the Figma exact-copy typeface. Figma-faithful screens/primitives
    // (src/components/figma/*) render in Cairo; legacy Sanad screens keep IBM
    // Plex Sans Arabic until they are migrated. Loaded here so Cairo is ready
    // before first paint (pure asset load via expo-font; no native rebuild).
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
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
      <ThemeProvider value={navTheme(colorScheme === 'dark' ? 'dark' : 'light')}>
        {/* Headless: replays a WhatsApp join code captured while signed out into
            /join-circle after authentication (survives the auth gate). */}
        <PendingJoinLink />
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </AppProviders>
  );
}
