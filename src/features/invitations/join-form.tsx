import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import { FormField } from '@/components/form-field';
import { Icon } from '@/components/icon';
import { InfoBanner } from '@/components/info-banner';
import { Screen } from '@/components/screen';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Fonts, MaxFormWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCircleSelection } from '@/features/circle-selection/provider';

import { acceptErrorKey } from './api';
import { useAcceptInvitation } from './hooks';

/**
 * Join a circle by invitation code — an exact rebuild of the Figma JoinCircle
 * screen: a trust warning banner first, the code in its own bordered card
 * (centered monospace LTR), the filled teal join CTA, and a centered success step
 * with an 80×80 success badge. Figma blue → Sanad teal. The accept-invitation flow
 * and preferred-circle update are unchanged.
 */
export function JoinCircleForm() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const accept = useAcceptInvitation();
  const { setPreferredCircleId } = useCircleSelection();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
    <Screen maxWidth={MaxFormWidth} keyboardAvoiding gap={Spacing.three}>
      {done ? (
        <>
          <View style={styles.successTop}>
            <View style={[styles.successBadge, { backgroundColor: theme.successBg, borderColor: theme.successFg }]}>
              <Icon name="success" size={36} color="successFg" />
            </View>
            <ThemedText type="sectionTitle" accessibilityRole="header" style={styles.center}>
              {t('joinCircle.successTitle')}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              {t('joinCircle.successSubtitle')}
            </ThemedText>
          </View>
          <FigmaFooterPrimaryButton label={t('joinCircle.continue')} onPress={() => router.replace('/')} />
        </>
      ) : (
        <>
          {/* Trust/safety note sits BEFORE the code field (Figma order). */}
          <InfoBanner tone="warning" text={t('joinCircle.warning')} />

          {/* Code in its own bordered card; centered monospace LTR so SANAD-XXXXX
              reads cleanly regardless of app RTL. */}
          <Surface radius={Radius.lg}>
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

          <FigmaFooterPrimaryButton
            label={t('joinCircle.submit')}
            onPress={onSubmit}
            loading={accept.isPending}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  successTop: { alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.four },
  successBadge: {
    width: 80,
    height: 80,
    borderRadius: Radius.xl,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  center: { textAlign: 'center' },
  codeInput: {
    fontFamily: Fonts.mono,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 3,
    textAlign: 'center',
    writingDirection: 'ltr',
  },
});
