import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import { FormField } from '@/components/form-field';
import { InfoBanner } from '@/components/info-banner';
import { Screen } from '@/components/screen';
import { Surface } from '@/components/surface';
import { FontFamily, MaxFormWidth, Spacing } from '@/constants/theme';
import { AuthHeader } from '@/features/auth/auth-chrome';
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
  const c = useTheme();
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
      <AuthHeader title={t('auth.forgotTitle')} subtitle={t('auth.forgotSubtitle')} />

      <Surface tone="card" padded={16} gap={14}>
        {sent ? (
          <>
            <InfoBanner tone="info" text={t('auth.forgotSent')} />
            <FigmaFooterPrimaryButton label={t('auth.backToSignIn')} onPress={() => router.replace('/sign-in')} />
          </>
        ) : (
          <>
            <FormField
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              error={error}
              style={styles.ltr}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              inputMode="email"
              autoComplete="email"
              textContentType="emailAddress"
              placeholder={t('auth.emailPlaceholder')}
            />
            <FigmaFooterPrimaryButton label={t('auth.forgotSend')} onPress={onSubmit} loading={submitting} />
          </>
        )}
      </Surface>

      <View style={styles.footer}>
        <Link href="/sign-in">
          <Text style={[styles.footerLink, { color: c.primaryText }]}>{t('auth.backToSignIn')}</Text>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ltr: { writingDirection: 'ltr', textAlign: 'left' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  footerLink: { fontSize: 16, fontFamily: FontFamily.bold, textDecorationLine: 'underline' },
});
