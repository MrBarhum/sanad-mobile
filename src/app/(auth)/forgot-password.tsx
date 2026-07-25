import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import { FormField } from '@/components/form-field';
import { Screen } from '@/components/screen';
import { Surface } from '@/components/surface';
import { FontFamily, MaxFormWidth, Spacing } from '@/constants/theme';
import { AuthError, AuthHeader } from '@/features/auth/auth-chrome';
import { passwordResetRedirectTo, requestCodeErrorKey } from '@/features/auth/password-reset';
import { useTheme } from '@/hooks/use-theme';

import { supabase } from '../../../lib/supabase';

const emailSchema = z.string().email();

/**
 * "Forgot password?" — step 1 of 2. Asks Supabase to email a 6-digit recovery
 * code, then hands off to the root `/reset-password` screen where the code is
 * typed and the new password set.
 *
 * The handoff crosses a route group on purpose: `verifyOtp` establishes a real
 * session, and this screen sits under the `(auth)` guard, which redirects any
 * authenticated user to `/` (see `(auth)/_layout.tsx`). Completing the reset here
 * would therefore bounce the user out mid-flow. `/reset-password` is a ROOT route
 * outside both guards precisely so it survives that transition.
 *
 * Account existence is never disclosed: a missing address resolves without error
 * and we navigate on regardless, so an enumeration attempt learns nothing. A
 * RATE LIMIT is different — it is about the requester, not the account — so it is
 * surfaced, otherwise the user waits for an email Supabase never sent.
 */
export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    setFormError(null);
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setError(t('auth.errors.email'));
      return;
    }
    setSubmitting(true);
    // `redirectTo` only ever feeds {{ .ConfirmationURL }} / {{ .RedirectTo }}, which
    // the OTP template no longer renders — but it is kept while the Dashboard
    // template transitions, so an email that still carries the link keeps landing
    // in the app instead of falling back to the project Site URL.
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: passwordResetRedirectTo(),
    });
    setSubmitting(false);
    if (sendError) {
      setFormError(t(requestCodeErrorKey(sendError)));
      return;
    }
    router.push({ pathname: '/reset-password', params: { email: parsed.data } });
  }

  return (
    <Screen edges={{ top: true }} maxWidth={MaxFormWidth} keyboardAvoiding gap={Spacing.three}>
      <AuthHeader title={t('auth.forgotTitle')} subtitle={t('auth.forgotSubtitle')} />

      <Surface tone="card" padded={16} gap={14}>
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
        {formError ? <AuthError message={formError} /> : null}
        <FigmaFooterPrimaryButton
          label={t('auth.forgotSend')}
          onPress={onSubmit}
          loading={submitting}
        />
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
