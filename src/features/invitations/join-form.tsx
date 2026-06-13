import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { FormField } from '@/components/form-field';
import { InfoBanner } from '@/components/info-banner';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { MaxFormWidth } from '@/constants/theme';
import { useCircleSelection } from '@/features/circle-selection/provider';

import { acceptErrorKey } from './api';
import { useAcceptInvitation } from './hooks';

/**
 * Join a circle by invitation code. Normalizes spacing/case is handled
 * server-side; on success we set the joined circle as the preferred active
 * circle (honored once the refreshed membership list arrives) and return home.
 */
export function JoinCircleForm() {
  const { t } = useTranslation();
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
    <Screen maxWidth={MaxFormWidth} keyboardAvoiding>
      {done ? (
        <>
          <ThemedText type="sectionTitle" accessibilityRole="header">
            {t('joinCircle.successTitle')}
          </ThemedText>
          <ThemedText themeColor="textSecondary">{t('joinCircle.successSubtitle')}</ThemedText>
          <Button label={t('joinCircle.continue')} onPress={() => router.replace('/')} />
        </>
      ) : (
        <>
          <ThemedText type="sectionTitle" accessibilityRole="header">
            {t('joinCircle.title')}
          </ThemedText>
          <ThemedText type="small" themeColor="textMuted">
            {t('joinCircle.subtitle')}
          </ThemedText>

          <FormField
            label={t('joinCircle.codeLabel')}
            value={code}
            onChangeText={setCode}
            placeholder={t('joinCircle.codePlaceholder')}
            autoCapitalize="characters"
            autoCorrect={false}
            error={error}
          />

          <InfoBanner tone="warning" text={t('joinCircle.warning')} />

          <Button
            label={t('joinCircle.submit')}
            onPress={onSubmit}
            loading={accept.isPending}
            disabled={accept.isPending}
          />
        </>
      )}
    </Screen>
  );
}
