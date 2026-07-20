import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import { FigmaFormScreen } from '@/components/figma/figma-form-screen';
import { FormField } from '@/components/form-field';
import { GlyphChip } from '@/components/glyph-chip';
import { InfoBanner } from '@/components/info-banner';
import { Surface } from '@/components/surface';
import { Fonts, FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCircleSelection } from '@/features/circle-selection/provider';

import { acceptErrorKey } from './api';
import { useAcceptInvitation } from './hooks';

/**
 * Join a circle by invitation code — rebuilt to the Dar "6b" form frame: a deep-green
 * band header (back + title + subtitle), an amber trust-warning banner first, the code
 * in its own bordered card (centered monospace LTR so SANAD-XXXXX reads cleanly
 * regardless of app RTL), and a full-width green join CTA in the footer. On success the
 * card flips to a quiet green success moment with a Continue CTA. The accept-invitation
 * flow, deep-link prefill and preferred-circle update are unchanged — only the shell
 * moved off the native header onto the Dar band.
 */
export function JoinCircleForm() {
  const { t } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const accept = useAcceptInvitation();
  const { setPreferredCircleId } = useCircleSelection();
  // A WhatsApp invite deep link (sanadmobile://join-circle?code=…) pre-fills the code.
  const params = useLocalSearchParams<{ code?: string }>();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // Seed the code from the deep link ONCE, without clobbering anything the user types.
  useEffect(() => {
    const linkCode = typeof params.code === 'string' ? params.code : '';
    if (!prefilled && linkCode && code === '') {
      setCode(linkCode);
      setPrefilled(true);
    }
  }, [params.code, prefilled, code]);

  async function onSubmit() {
    setError(null);
    if (code.trim() === '') {
      setError(t('joinCircle.errors.required'));
      return;
    }
    try {
      const result = await accept.mutateAsync(code);
      setPreferredCircleId(result.circleId);
      setDone(true);
    } catch (err) {
      setError(t(acceptErrorKey(err)));
    }
  }

  return (
    <FigmaFormScreen
      title={t('joinCircle.title')}
      subtitle={done ? undefined : t('joinCircle.subtitle')}
      onBack={() => router.back()}
      footer={
        done ? (
          <FigmaFooterPrimaryButton label={t('joinCircle.continue')} onPress={() => router.replace('/')} />
        ) : (
          <FigmaFooterPrimaryButton
            label={t('joinCircle.submit')}
            onPress={onSubmit}
            loading={accept.isPending}
          />
        )
      }>
      {done ? (
        <Surface tone="card" padded={24} style={styles.successCard}>
          <GlyphChip iconName="success" tone="success" size="lg" shape="circle" />
          <Text accessibilityRole="header" style={[styles.successTitle, { color: c.text }]}>
            {t('joinCircle.successTitle')}
          </Text>
          <Text style={[styles.successSubtitle, { color: c.textSecondary }]}>
            {t('joinCircle.successSubtitle')}
          </Text>
        </Surface>
      ) : (
        <>
          {/* Trust/safety note sits BEFORE the code field (Dar order). */}
          <InfoBanner tone="warning" text={t('joinCircle.warning')} />

          {/* Code in its own bordered card; centered monospace LTR. */}
          <Surface tone="card" padded={14}>
            <FormField
              label={t('joinCircle.codeLabel')}
              value={code}
              onChangeText={setCode}
              placeholder={t('joinCircle.codePlaceholder')}
              autoCapitalize="characters"
              autoCorrect={false}
              error={error}
              style={styles.codeInput}
            />
          </Surface>
        </>
      )}
    </FigmaFormScreen>
  );
}

const styles = StyleSheet.create({
  successCard: { alignItems: 'center', gap: 12 },
  successTitle: { textAlign: 'center', fontSize: 20, fontFamily: FontFamily.bold, lineHeight: 30, marginTop: 4 },
  successSubtitle: { textAlign: 'center', fontSize: 16, fontFamily: FontFamily.medium, lineHeight: 27 },
  codeInput: {
    fontFamily: Fonts.mono,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 3,
    textAlign: 'center',
    writingDirection: 'ltr',
  },
});
