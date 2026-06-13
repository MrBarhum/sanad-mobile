import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/button';
import { FormField } from '@/components/form-field';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxFormWidth, Spacing } from '@/constants/theme';

import { supabase } from '../../../lib/supabase';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default function SignUpScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    setNotice(null);

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
    const { data, error: signUpError } = await supabase.auth.signUp(parsed.data);
    setSubmitting(false);

    if (signUpError) {
      setError(t('auth.errors.signUpFailed'));
      return;
    }

    // When email confirmation is required, no session is returned yet.
    if (!data.session) {
      setNotice(t('auth.signUpCheckEmail'));
    }
    // If a session exists, the (auth) guard redirects automatically.
  }

  return (
    <Screen edges={{ top: true }} maxWidth={MaxFormWidth} center keyboardAvoiding gap={Spacing.five}>
      <ThemedView style={styles.header}>
        <ThemedText type="title" accessibilityRole="header">
          {t('auth.signUpTitle')}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{t('auth.signUpSubtitle')}</ThemedText>
      </ThemedView>

      <ThemedView style={styles.form}>
        <FormField
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
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
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder={t('auth.passwordPlaceholder')}
        />

        {error ? (
          <ThemedText
            themeColor="errorFg"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite">
            {error}
          </ThemedText>
        ) : null}
        {notice ? (
          <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">
            {notice}
          </ThemedText>
        ) : null}

        <Button
          label={t('auth.signUpButton')}
          onPress={onSubmit}
          loading={submitting}
          disabled={submitting}
          style={styles.button}
        />
      </ThemedView>

      <ThemedView style={styles.footer}>
        <ThemedText themeColor="textSecondary">{t('auth.haveAccount')}</ThemedText>
        <Link href="/sign-in">
          <ThemedText type="link">{t('auth.signInLink')}</ThemedText>
        </Link>
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  form: { gap: Spacing.three },
  button: { marginTop: Spacing.two },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
