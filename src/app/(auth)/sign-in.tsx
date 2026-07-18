import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { z } from 'zod';

import { AuthField } from '@/components/auth-field';
import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import { Screen } from '@/components/screen';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, Gutter, MaxFormWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { supabase } from '../../../lib/supabase';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

/** The Sanad brand care-ring mark (Figma sign-in header icon; blue→teal divider). */
function BrandMark() {
  const theme = useTheme();
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <Circle cx={14} cy={14} r={10} stroke="rgba(255,255,255,0.35)" strokeWidth={2} />
      <Path d="M14 4 A10 10 0 1 1 4 14" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" fill="none" />
      <Rect x={10} y={12} width={8} height={4} rx={2} fill="#FFFFFF" opacity={0.9} />
      <Rect x={14} y={12} width={0.8} height={4} fill={theme.primary} opacity={0.8} />
    </Svg>
  );
}

export default function SignInScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);

    const parsed = credentialsSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      setError(
        field === 'password'
          ? t('auth.errors.password')
          : field === 'email'
            ? t('auth.errors.email')
            : t('auth.errors.generic'),
      );
      return;
    }

    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword(parsed.data);
    setSubmitting(false);

    if (signInError) {
      setError(t('auth.errors.signInFailed'));
    }
    // On success the auth state change propagates and the (auth) guard redirects.
  }

  return (
    <Screen edges={{ top: true }} maxWidth={MaxFormWidth} keyboardAvoiding gap={Spacing.three}>
      <View style={styles.header}>
        <View style={[styles.iconCircle, { backgroundColor: theme.primary }]}>
          <BrandMark />
        </View>
        <Text style={[styles.brandTitle, { fontFamily: FontFamily.bold }, { color: theme.text }]}>{t('auth.brand')}</Text>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          {t('auth.signInSubtitle')}
        </ThemedText>
      </View>

      <Surface padded={false} style={styles.card}>
        <View style={styles.cardContent}>
          <AuthField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            ltr
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            inputMode="email"
            autoComplete="email"
            textContentType="emailAddress"
            placeholder={t('auth.emailPlaceholder')}
          />

          <AuthField
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            isPassword
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            placeholder={t('auth.passwordPlaceholder')}
          />

          <Link href="/forgot-password" style={styles.forgotLink}>
            <ThemedText type="link" style={{ fontFamily: FontFamily.semibold }}>
              {t('auth.forgotPassword')}
            </ThemedText>
          </Link>

          {error ? (
            <ThemedText
              themeColor="errorFg"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite">
              {error}
            </ThemedText>
          ) : null}

          <FigmaFooterPrimaryButton
            label={t('auth.signInButton')}
            onPress={onSubmit}
            loading={submitting}
          />
        </View>
      </Surface>

      <ThemedView style={styles.footer}>
        <ThemedText themeColor="textSecondary">
          {t('auth.noAccount')}
        </ThemedText>
        <Link href="/sign-up">
          <ThemedText type="link" style={{ fontFamily: FontFamily.semibold }}>
            {t('auth.signUpLink')}
          </ThemedText>
        </Link>
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingTop: Spacing.four, paddingBottom: Spacing.two },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  brandTitle: { fontSize: 28, lineHeight: 38, textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center' },
  card: { paddingVertical: Spacing.four, paddingHorizontal: Gutter },
  cardContent: { gap: Gutter },
  forgotLink: { alignSelf: 'flex-end', marginTop: -Spacing.one },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
});
