import { Link } from 'expo-router';
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
import { useTheme } from '@/hooks/use-theme';

import { supabase } from '../../../lib/supabase';

// Supabase receives ONLY email + password — never the confirm field.
const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default function SignUpScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    confirm?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setSubmitError(null);
    setNotice(null);

    const next: { fullName?: string; email?: string; password?: string; confirm?: string } = {};
    const trimmedName = fullName.trim();
    // A real name is required so every member reads with a name across the app
    // (roster, assignment, Care Pulse) instead of a bare "عضو".
    if (trimmedName.length < 1 || trimmedName.length > 120) next.fullName = t('auth.errors.fullName');
    const parsed = credentialsSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'email' && !next.email) next.email = t('auth.errors.email');
        if (issue.path[0] === 'password' && !next.password) next.password = t('auth.errors.password');
      }
    }
    // Confirm password is validated locally and never sent to Supabase.
    if (password !== confirm) next.confirm = t('auth.errors.passwordMismatch');

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});

    setSubmitting(true);
    // full_name rides in user metadata; the `handle_new_user` DB trigger copies it
    // into public.profiles.full_name on account creation. Email/password only reach
    // Supabase auth; the name is never a credential.
    const { data, error: signUpError } = await supabase.auth.signUp({
      ...parsed.data!,
      options: { data: { full_name: trimmedName } },
    });
    setSubmitting(false);

    if (signUpError) {
      setSubmitError(t('auth.errors.signUpFailed'));
      return;
    }

    // When email confirmation is required, no session is returned yet.
    if (!data.session) {
      setNotice(t('auth.signUpCheckEmail'));
    }
    // If a session exists, the (auth) guard redirects automatically.
  }

  return (
    <Screen edges={{ top: true }} maxWidth={MaxFormWidth} keyboardAvoiding gap={Spacing.three}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontFamily: FontFamily.bold }, { color: theme.text }]}>{t('auth.signUpTitle')}</Text>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          {t('auth.signUpSubtitle')}
        </ThemedText>
      </View>

      <Surface padded={false} style={styles.card}>
        <View style={styles.cardContent}>
          <AuthField
            label={t('auth.fullName')}
            value={fullName}
            onChangeText={setFullName}
            error={errors.fullName}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            placeholder={t('auth.fullNamePlaceholder')}
          />

          <AuthField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            error={errors.email}
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
            error={errors.password}
            hint={t('auth.passwordHint')}
            isPassword
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder={t('auth.passwordPlaceholder')}
          />

          <AuthField
            label={t('auth.confirmPassword')}
            value={confirm}
            onChangeText={setConfirm}
            error={errors.confirm}
            isPassword
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder={t('auth.passwordPlaceholder')}
          />

          {submitError ? (
            <ThemedText
              themeColor="errorFg"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite">
              {submitError}
            </ThemedText>
          ) : null}
          {notice ? <InfoBanner tone="info" text={notice} /> : null}

          <FigmaFooterPrimaryButton
            label={t('auth.signUpButton')}
            onPress={onSubmit}
            loading={submitting}
          />
        </View>
      </Surface>

      <ThemedView style={styles.footer}>
        <ThemedText themeColor="textSecondary">
          {t('auth.haveAccount')}
        </ThemedText>
        <Link href="/sign-in">
          <ThemedText type="link" style={{ fontFamily: FontFamily.semibold }}>
            {t('auth.signInLink')}
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
