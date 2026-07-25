import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import { FormField } from '@/components/form-field';
import { InfoBanner } from '@/components/info-banner';
import { LtrText, isolateLtr } from '@/components/ltr-text';
import { Screen } from '@/components/screen';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Fonts, MaxFormWidth, Radius, Spacing } from '@/constants/theme';
import { AuthError, AuthHeader } from '@/features/auth/auth-chrome';
import {
  MAX_CODE_ATTEMPTS,
  OTP_LENGTH,
  RESEND_COOLDOWN_SECONDS,
  hasRecoveryPayload,
  normalizeOtpCode,
  parseRecoveryParams,
  passwordResetRedirectTo,
  requestCodeErrorKey,
  updatePasswordErrorKey,
  verifyCodeErrorKey,
} from '@/features/auth/password-reset';
import { useTheme } from '@/hooks/use-theme';

import { supabase } from '../../lib/supabase';

type Phase = 'code' | 'checking' | 'ready' | 'invalid' | 'done';

/**
 * Password recovery — the single screen for BOTH recovery paths.
 *
 * It lives at the ROOT (outside the (auth)/(app) guards) because either path
 * establishes a real session partway through: `(auth)/_layout.tsx` redirects an
 * authenticated user to `/`, so finishing a reset inside that group would bounce
 * the user out mid-flow with the token already spent.
 *
 * PATH 1 — 6-digit code (primary, Milestone 7). `/forgot-password` sends the code
 * and pushes here with `?email=`; the user types the code, `verifyOtp` creates the
 * session, then `updateUser` sets the password. No URL is involved, so email
 * scanners cannot consume anything (see `password-reset.ts` for the full why).
 *
 * PATH 2 — recovery link (legacy, kept for emails already in flight). Resolves the
 * incoming deep link, then joins Path 1 at the "set a new password" step.
 *
 * Three bugs the Milestone-7 rewrite fixes:
 *  1. `Linking.useURL()` returns null on the FIRST render unconditionally, so the
 *     old `linkingUrl ?? getInitialURL()` always fell through to `getInitialURL()`
 *     — which on Android reads the launch intent and is never refreshed by
 *     `onNewIntent`. A link tapped while the app was already open therefore always
 *     reported "invalid". `useLinkingURL()` returns the URL synchronously on first
 *     render AND updates on a warm-start intent.
 *  2. The effect ran once behind a boolean latch, so the correct URL arriving a
 *     moment later was discarded forever. It now keys on the URL string, the same
 *     way `PendingJoinLink` already does.
 *  3. The old no-token fallback accepted ANY existing session as "ready", so a
 *     signed-in user landing here could silently change the CURRENT account's
 *     password. A recovery payload is now required.
 */
export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  // Present only on the OTP path (pushed by /forgot-password). Its presence is
  // what selects the path — the link path never carries it.
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';

  const linkingUrl = Linking.useLinkingURL();
  const [phase, setPhase] = useState<Phase>(email ? 'code' : 'checking');
  const processedUrlRef = useRef<string | null>(null);

  // Code step
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  // Password step
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [invalidKey, setInvalidKey] = useState('auth.resetInvalid');

  // ── Path 2: resolve the recovery link ──────────────────────────────────────
  // Re-runs whenever the incoming URL changes (warm start), and de-dupes on the
  // URL STRING so the same link is never exchanged twice — the recovery token is
  // single-use, and a second exchange would fail and read as "expired".
  useEffect(() => {
    if (email) return; // OTP path — there is no URL to resolve.
    if (phase === 'ready' || phase === 'done') return;
    let alive = true;

    void (async () => {
      let url = linkingUrl ?? (await Linking.getInitialURL());
      if (!url && Platform.OS === 'web' && typeof window !== 'undefined') {
        url = window.location.href;
      }
      if (!alive) return;
      if (url && url === processedUrlRef.current) return;
      processedUrlRef.current = url ?? null;

      const recovery = parseRecoveryParams(url);
      if (recovery.error) {
        // A consumed link reads differently from a malformed one: `otp_expired`
        // is what an email scanner's prefetch leaves behind.
        setInvalidKey(recovery.errorCode === 'otp_expired' ? 'auth.resetLinkExpired' : 'auth.resetInvalid');
        setPhase('invalid');
        return;
      }
      if (!hasRecoveryPayload(recovery)) {
        setPhase('invalid');
        return;
      }
      try {
        if (recovery.accessToken && recovery.refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: recovery.accessToken,
            refresh_token: recovery.refreshToken,
          });
          if (sessionError) throw sessionError;
        } else if (recovery.code) {
          const { error: codeExchangeError } = await supabase.auth.exchangeCodeForSession(recovery.code);
          if (codeExchangeError) throw codeExchangeError;
        }
        if (alive) setPhase('ready');
      } catch {
        if (alive) setPhase('invalid');
      }
    })();

    return () => {
      alive = false;
    };
  }, [linkingUrl, email, phase]);

  // Resend cooldown — one interval for the whole code step.
  useEffect(() => {
    if (phase !== 'code') return;
    const id = setInterval(() => setCooldown((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  async function onVerifyCode() {
    setCodeError(null);
    setNotice(null);
    const token = normalizeOtpCode(code);
    if (token.length !== OTP_LENGTH) {
      setCodeError(t('auth.errors.codeLength'));
      return;
    }
    if (attempts >= MAX_CODE_ATTEMPTS) {
      setCodeError(t('auth.errors.tooManyAttempts'));
      return;
    }
    setVerifying(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
    setVerifying(false);
    if (verifyError) {
      setAttempts((value) => value + 1);
      setCodeError(t(verifyCodeErrorKey(verifyError)));
      return;
    }
    // verifyOtp persists the session and emits PASSWORD_RECOVERY; the password
    // step below is now authenticated as the recovering user.
    setCode('');
    setPhase('ready');
  }

  async function onResend() {
    if (cooldown > 0 || resending) return;
    setCodeError(null);
    setNotice(null);
    setResending(true);
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: passwordResetRedirectTo(),
    });
    setResending(false);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setAttempts(0);
    if (sendError) {
      setCodeError(t(requestCodeErrorKey(sendError)));
      return;
    }
    setNotice(t('auth.codeResent'));
  }

  async function onSave() {
    setError(null);
    if (password.length < 6) {
      setError(t('auth.errors.password'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.errors.passwordMismatch'));
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(t(updatePasswordErrorKey(updateError)));
      return;
    }
    setDone();
  }

  function setDone() {
    setPassword('');
    setConfirm('');
    setPhase('done');
  }

  return (
    <Screen edges={{ top: true }} maxWidth={MaxFormWidth} keyboardAvoiding gap={Spacing.four}>
      <AuthHeader
        title={t('auth.resetTitle')}
        subtitle={phase === 'code' ? t('auth.codeSubtitle') : t('auth.resetSubtitle')}
      />

      <Surface tone="card" radius={Radius.card} padded={20} gap={16}>
        {phase === 'checking' ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.primary} />
            <ThemedText themeColor="textSecondary">{t('auth.resetChecking')}</ThemedText>
          </View>
        ) : phase === 'invalid' ? (
          <>
            <InfoBanner tone="warning" text={t(invalidKey)} />
            <FigmaFooterPrimaryButton
              label={t('auth.requestNewLink')}
              onPress={() => router.replace('/forgot-password')}
            />
          </>
        ) : phase === 'done' ? (
          <>
            <InfoBanner tone="info" text={t('auth.resetSuccess')} />
            <FigmaFooterPrimaryButton label={t('auth.continue')} onPress={() => router.replace('/')} />
          </>
        ) : phase === 'code' ? (
          <>
            <ThemedText themeColor="textSecondary">
              {t('auth.codeSentTo')} <LtrText>{email}</LtrText>
            </ThemedText>
            <FormField
              label={t('auth.codeLabel')}
              value={code}
              onChangeText={(value) => setCode(normalizeOtpCode(value))}
              error={codeError}
              hint={t('auth.codeHint')}
              style={styles.codeInput}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={OTP_LENGTH}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              autoCorrect={false}
              placeholder={t('auth.codePlaceholder')}
            />
            {notice ? <InfoBanner tone="info" text={notice} /> : null}
            <FigmaFooterPrimaryButton
              label={t('auth.codeSubmit')}
              onPress={onVerifyCode}
              loading={verifying}
            />
            <Button
              variant="plain"
              size="sm"
              loading={resending}
              disabled={cooldown > 0}
              label={
                cooldown > 0
                  ? t('auth.resendIn', { seconds: isolateLtr(String(cooldown)) })
                  : t('auth.resendCode')
              }
              onPress={onResend}
            />
          </>
        ) : (
          <>
            <FormField
              label={t('auth.newPassword')}
              value={password}
              onChangeText={setPassword}
              secureToggle
              revealLabel={t('auth.showPassword')}
              hideLabel={t('auth.hidePassword')}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder={t('auth.passwordPlaceholder')}
            />
            <FormField
              label={t('auth.confirmNewPassword')}
              value={confirm}
              onChangeText={setConfirm}
              secureToggle
              revealLabel={t('auth.showPassword')}
              hideLabel={t('auth.hidePassword')}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder={t('auth.passwordPlaceholder')}
            />
            {error ? <AuthError message={error} /> : null}
            <FigmaFooterPrimaryButton label={t('auth.resetSubmit')} onPress={onSave} loading={saving} />
          </>
        )}
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
  // The code is numeric — render it LTR and letter-spaced so it reads as digits
  // regardless of the app's RTL layout (same treatment as the invite code).
  codeInput: {
    fontFamily: Fonts?.mono,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
    writingDirection: 'ltr',
  },
});
