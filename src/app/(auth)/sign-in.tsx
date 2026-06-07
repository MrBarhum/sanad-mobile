import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
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
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.header}>
            <ThemedText type="subtitle">{t('auth.signInTitle')}</ThemedText>
            <ThemedText themeColor="textSecondary">{t('auth.signInSubtitle')}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.form}>
            <ThemedText type="smallBold">{t('auth.email')}</ThemedText>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              inputMode="email"
              autoComplete="email"
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel={t('auth.email')}
              style={inputStyle}
            />

            <ThemedText type="smallBold">{t('auth.password')}</ThemedText>
            <TextInput
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              autoComplete="current-password"
              placeholder={t('auth.passwordPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel={t('auth.password')}
              style={inputStyle}
            />

            {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

            <Pressable
              onPress={onSubmit}
              disabled={submitting}
              accessibilityRole="button"
              style={[styles.button, { backgroundColor: theme.text, opacity: submitting ? 0.6 : 1 }]}>
              {submitting ? (
                <ActivityIndicator color={theme.background} />
              ) : (
                <ThemedText style={[styles.buttonLabel, { color: theme.background }]}>
                  {t('auth.signInButton')}
                </ThemedText>
              )}
            </Pressable>
          </ThemedView>

          <ThemedView style={styles.footer}>
            <ThemedText themeColor="textSecondary">{t('auth.noAccount')}</ThemedText>
            <Link href="/sign-up">
              <ThemedText type="link">{t('auth.signUpLink')}</ThemedText>
            </Link>
          </ThemedView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
    gap: Spacing.five,
  },
  header: { gap: Spacing.two },
  form: { gap: Spacing.two },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    minHeight: 52,
  },
  error: { color: '#dc2626' },
  button: {
    marginTop: Spacing.two,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
