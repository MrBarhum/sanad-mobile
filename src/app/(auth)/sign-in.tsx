import { Link } from 'expo-router';
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
import { useTheme } from '@/hooks/use-theme';

import { supabase } from '../../../lib/supabase';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default function SignInScreen() {
  const { t } = useTranslation();
  const c = useTheme();
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
      <AuthHeader title={t('auth.brand')} subtitle={t('auth.signInSubtitle')} />

      <Surface tone="card" padded={16} gap={14}>
        <FormField
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          style={styles.ltr}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          inputMode="email"
          autoComplete="email"
          textContentType="emailAddress"
          placeholder={t('auth.emailPlaceholder')}
        />

        <FormField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureToggle
          revealLabel={t('auth.showPassword')}
          hideLabel={t('auth.hidePassword')}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          placeholder={t('auth.passwordPlaceholder')}
        />

        <Link href="/forgot-password" style={styles.forgotLink}>
          <Text style={[styles.link, { color: c.primaryText }]}>{t('auth.forgotPassword')}</Text>
        </Link>

        {error ? <AuthError message={error} /> : null}

        <FigmaFooterPrimaryButton label={t('auth.signInButton')} onPress={onSubmit} loading={submitting} />
      </Surface>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: c.textSecondary }]}>{t('auth.noAccount')}</Text>
        <Link href="/sign-up">
          <Text style={[styles.footerLink, { color: c.primaryText }]}>{t('auth.signUpLink')}</Text>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ltr: { writingDirection: 'ltr', textAlign: 'left' },
  forgotLink: { alignSelf: 'flex-end' },
  link: { fontSize: 15, fontFamily: FontFamily.semibold, textDecorationLine: 'underline' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  footerText: { fontSize: 16, fontFamily: FontFamily.medium },
  footerLink: { fontSize: 16, fontFamily: FontFamily.bold, textDecorationLine: 'underline' },
});
