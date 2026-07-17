import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { AuthField } from '@/components/auth-field';
import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import { InfoBanner } from '@/components/info-banner';
import { Screen } from '@/components/screen';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, Gutter, MaxFormWidth, Spacing } from '@/constants/theme';
import { passwordResetRedirectTo } from '@/features/auth/password-reset';
import { useTheme } from '@/hooks/use-theme';

import { supabase } from '../../../lib/supabase';

const emailSchema = z.string().email();

/**
 * "Forgot password?" — asks Supabase to email a recovery link that deep-links back
 * into `/reset-password`. We show the SAME confirmation whether or not the email
 * exists (never reveal account existence). Reachable only when signed out (the
 * (auth) guard bounces an authed user to `/`).
 */
export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit() {
    setError(null);
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setError(t('auth.errors.email'));
      return;
    }
    setSubmitting(true);
    // We intentionally ignore the result: a missing account still resolves without
    // error, and we never disclose whether the address is registered.
    await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: passwordResetRedirectTo(),
    });
    setSubmitting(false);
    setSent(true);
  }

  return (
    <Screen edges={{ top: true }} maxWidth={MaxFormWidth} keyboardAvoiding gap={Spacing.three}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontFamily: FontFamily.bold }, { color: theme.text }]}>
          {t('auth.forgotTitle')}
        </Text>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          {t('auth.forgotSubtitle')}
        </ThemedText>
      </View>

      <Surface padded={false} style={styles.card}>
        <View style={styles.cardContent}>
          {sent ? (
            <InfoBanner tone="info" text={t('auth.forgotSent')} />
          ) : (
            <>
              <AuthField
                label={t('auth.email')}
                value={email}
                onChangeText={setEmail}
                error={error}
                ltr
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                inputMode="email"
                autoComplete="email"
                textContentType="emailAddress"
                placeholder={t('auth.emailPlaceholder')}
              />
              <FigmaFooterPrimaryButton
                label={t('auth.forgotSend')}
                onPress={onSubmit}
                loading={submitting}
              />
            </>
          )}
          {sent ? (
            <FigmaFooterPrimaryButton
              label={t('auth.backToSignIn')}
              onPress={() => router.replace('/sign-in')}
            />
          ) : null}
        </View>
      </Surface>

      <ThemedView style={styles.footer}>
        <Link href="/sign-in">
          <ThemedText type="link">
            {t('auth.backToSignIn')}
          </ThemedText>
        </Link>
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingTop: Spacing.four, paddingBottom: Spacing.two },
  title: { fontSize: 26, lineHeight: 36, textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center' },
  card: { paddingVertical: Spacing.four, paddingHorizontal: Gutter },
  cardContent: { gap: Gutter },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
});
