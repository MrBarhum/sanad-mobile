import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { z } from 'zod';

import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import { Cairo } from '@/components/figma/form-typography';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Gutter, MaxFormWidth, Radius, Spacing } from '@/constants/theme';
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

/**
 * Figma `FieldInput` parity: label above a raised (sunken-tone) input with a 1.5px
 * border, radius 12, teal focus border, and an eye show/hide toggle for password
 * fields. Email is forced LTR. Inline error / hint below.
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
        <Text style={[styles.brandTitle, Cairo.bold, { color: theme.text }]}>{t('auth.brand')}</Text>
        <ThemedText themeColor="textSecondary" style={[styles.subtitle, Cairo.regular]}>
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

          {error ? (
            <ThemedText
              themeColor="errorFg"
              style={Cairo.regular}
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
        <ThemedText themeColor="textSecondary" style={Cairo.regular}>
          {t('auth.noAccount')}
        </ThemedText>
        <Link href="/sign-up">
          <ThemedText type="link" style={Cairo.semibold}>
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
