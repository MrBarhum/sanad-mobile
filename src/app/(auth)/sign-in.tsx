import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxFormWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { supabase } from '../../../lib/supabase';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

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

  const inputStyle = [
    styles.input,
    {
      color: theme.text,
      backgroundColor: theme.backgroundElement,
      borderColor: theme.backgroundSelected,
    },
  ];

  return (
    <Screen edges={{ top: true }} maxWidth={MaxFormWidth} center keyboardAvoiding gap={Spacing.five}>
      <ThemedView style={styles.header}>
        <ThemedText type="sectionTitle" accessibilityRole="header">
          {t('auth.signInTitle')}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{t('auth.signInSubtitle')}</ThemedText>
      </ThemedView>

      <ThemedView style={styles.form}>
        <ThemedView style={styles.field}>
          <ThemedText type="smallBold">{t('auth.email')}</ThemedText>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            inputMode="email"
            autoComplete="email"
            textContentType="emailAddress"
            placeholder={t('auth.emailPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={t('auth.email')}
            style={inputStyle}
          />
        </ThemedView>

        <ThemedView style={styles.field}>
          <ThemedText type="smallBold">{t('auth.password')}</ThemedText>
          <TextInput
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            placeholder={t('auth.passwordPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={t('auth.password')}
            style={inputStyle}
          />
        </ThemedView>

        {error ? (
          <ThemedText
            style={{ color: theme.errorFg }}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite">
            {error}
          </ThemedText>
        ) : null}

        <Button
          label={t('auth.signInButton')}
          onPress={onSubmit}
          loading={submitting}
          disabled={submitting}
          style={styles.button}
        />
      </ThemedView>

      <ThemedView style={styles.footer}>
        <ThemedText themeColor="textSecondary">{t('auth.noAccount')}</ThemedText>
        <Link href="/sign-up">
          <ThemedText type="link">{t('auth.signUpLink')}</ThemedText>
        </Link>
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  form: { gap: Spacing.three },
  field: { gap: Spacing.one },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    minHeight: 52,
  },
  button: { marginTop: Spacing.two },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
