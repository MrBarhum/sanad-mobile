import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { AuthField } from '@/components/auth-field';
import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import { InfoBanner } from '@/components/info-banner';
import { Screen } from '@/components/screen';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Gutter, MaxFormWidth, Spacing } from '@/constants/theme';
import { parseRecoveryParams } from '@/features/auth/password-reset';
import { useTheme } from '@/hooks/use-theme';

import { supabase } from '../../lib/supabase';

type Phase = 'checking' | 'ready' | 'invalid';

/**
 * Set-a-new-password screen, opened by the recovery deep link. It lives at the
 * ROOT (outside the (auth)/(app) guards) so it stays reachable even after the
 * recovery token establishes a session — otherwise the auth guard would bounce the
 * user off this screen mid-reset. It resolves the incoming URL once, exchanges the
 * recovery token for a session, then lets the user set a new password via
 * `updateUser`. End-to-end this needs on-device QA (deep-link delivery + the
 * Supabase redirect-URL allow-list) — see the milestone-4 runbook.
 */
export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const linkingUrl = Linking.useURL();
  const [phase, setPhase] = useState<Phase>('checking');
  const processedRef = useRef(false);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Resolve the recovery token exactly once (cold-start launch URL first, then any
  // reactive URL, then the web location).
  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;
    void (async () => {
      let url = linkingUrl ?? (await Linking.getInitialURL());
      if (!url && Platform.OS === 'web' && typeof window !== 'undefined') {
        url = window.location.href;
      }
      await establishSession(url);
    })();
    // Intentionally run once on mount; linkingUrl is read inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function establishSession(url: string | null) {
    const params = parseRecoveryParams(url);
    if (params.error) {
      setPhase('invalid');
      return;
    }
    try {
      if (params.accessToken && params.refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: params.accessToken,
          refresh_token: params.refreshToken,
        });
        if (sessionError) throw sessionError;
        setPhase('ready');
        return;
      }
      if (params.code) {
        const { error: codeError } = await supabase.auth.exchangeCodeForSession(params.code);
        if (codeError) throw codeError;
        setPhase('ready');
        return;
      }
      // No token in the URL — accept an already-established recovery session
      // (e.g. web auto-detected it) or treat the link as invalid.
      const { data } = await supabase.auth.getSession();
      setPhase(data.session ? 'ready' : 'invalid');
    } catch {
      setPhase('invalid');
    }
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
      setError(t('auth.resetFailed'));
      return;
    }
    setDone(true);
  }

  return (
    <Screen edges={{ top: true }} maxWidth={MaxFormWidth} keyboardAvoiding gap={Spacing.three}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontFamily: FontFamily.bold }, { color: theme.text }]}>{t('auth.resetTitle')}</Text>
        <ThemedText themeColor="textSecondary" style={[styles.subtitle]}>
          {t('auth.resetSubtitle')}
        </ThemedText>
      </View>

      <Surface padded={false} style={styles.card}>
        <View style={styles.cardContent}>
          {phase === 'checking' ? (
            <View style={styles.centered}>
              <ActivityIndicator color={theme.primary} />
              <ThemedText themeColor="textSecondary">
                {t('auth.resetChecking')}
              </ThemedText>
            </View>
          ) : phase === 'invalid' ? (
            <>
              <InfoBanner tone="warning" text={t('auth.resetInvalid')} />
              <FigmaFooterPrimaryButton
                label={t('auth.requestNewLink')}
                onPress={() => router.replace('/forgot-password')}
              />
            </>
          ) : done ? (
            <>
              <InfoBanner tone="info" text={t('auth.resetSuccess')} />
              <FigmaFooterPrimaryButton
                label={t('auth.continue')}
                onPress={() => router.replace('/')}
              />
            </>
          ) : (
            <>
              <AuthField
                label={t('auth.newPassword')}
                value={password}
                onChangeText={setPassword}
                isPassword
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                placeholder={t('auth.passwordPlaceholder')}
              />
              <AuthField
                label={t('auth.confirmNewPassword')}
                value={confirm}
                onChangeText={setConfirm}
                isPassword
                error={error}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                placeholder={t('auth.passwordPlaceholder')}
              />
              <FigmaFooterPrimaryButton
                label={t('auth.resetSubmit')}
                onPress={onSave}
                loading={saving}
              />
            </>
          )}
        </View>
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingTop: Spacing.four, paddingBottom: Spacing.two },
  title: { fontSize: 26, lineHeight: 36, textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center' },
  card: { paddingVertical: Spacing.four, paddingHorizontal: Gutter },
  cardContent: { gap: Gutter },
  centered: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
});
