import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { z } from 'zod';

import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import { Cairo } from '@/components/figma/form-typography';
import { Icon } from '@/components/icon';
import { InfoBanner } from '@/components/info-banner';
import { Screen } from '@/components/screen';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Gutter, MaxFormWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { supabase } from '../../../lib/supabase';

// Supabase receives ONLY email + password — never the confirm field.
const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

/**
 * Figma `FieldInput` parity: label above a raised input with a 1.5px border,
 * radius 12, teal focus border, and an eye show/hide toggle for password fields.
 * Email is forced LTR. Inline error / hint below.
 */
function AuthField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  isPassword,
  ltr,
  ...rest
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  isPassword?: boolean;
  ltr?: boolean;
} & TextInputProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);
  const borderColor = error ? theme.errorFg : focused ? theme.primary : theme.border;

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" style={Cairo.semibold}>
        {label}
      </ThemedText>
      <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSunken, borderColor }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          secureTextEntry={isPassword && !show}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          style={[styles.input, Cairo.regular, { color: theme.text }, ltr ? styles.ltr : null]}
          {...rest}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setShow((value) => !value)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t(show ? 'auth.hidePassword' : 'auth.showPassword')}
            style={styles.eyeButton}>
            <Icon name={show ? 'viewOff' : 'view'} size={18} color="textMuted" />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <ThemedText
          type="small"
          style={[{ color: theme.errorFg }, Cairo.regular]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="small" themeColor="textMuted" style={Cairo.regular}>
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

export default function SignUpScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirm?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setSubmitError(null);
    setNotice(null);

    const next: { email?: string; password?: string; confirm?: string } = {};
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
    const { data, error: signUpError } = await supabase.auth.signUp(parsed.data!);
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
        <Text style={[styles.title, Cairo.bold, { color: theme.text }]}>{t('auth.signUpTitle')}</Text>
        <ThemedText themeColor="textSecondary" style={[styles.subtitle, Cairo.regular]}>
          {t('auth.signUpSubtitle')}
        </ThemedText>
      </View>

      <Surface padded={false} style={styles.card}>
        <View style={styles.cardContent}>
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
              style={Cairo.regular}
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
        <ThemedText themeColor="textSecondary" style={Cairo.regular}>
          {t('auth.haveAccount')}
        </ThemedText>
        <Link href="/sign-in">
          <ThemedText type="link" style={Cairo.semibold}>
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
  field: { gap: Spacing.one },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 16 },
  ltr: { writingDirection: 'ltr', textAlign: 'left' },
  eyeButton: { paddingStart: 8, paddingVertical: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
});
