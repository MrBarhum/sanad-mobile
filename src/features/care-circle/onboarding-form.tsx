import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { DateField } from '@/components/date-field';
import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import { FormField } from '@/components/form-field';
import { InfoBanner } from '@/components/info-banner';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { Surface } from '@/components/surface';
import { MaxFormWidth, Radius, Spacing } from '@/constants/theme';
import { AuthError, AuthHeader } from '@/features/auth/auth-chrome';

import { useCreateCareCircle } from './hooks';
import { createCircleSchema } from './schema';

/**
 * First-run onboarding: create the care circle and its care recipient. The Dar
 * lockup (shared AuthHeader brand square + title + subtitle), a green info invite
 * hint, a circle-name card, a «معلومات المسنّ» section card (recipient name* +
 * birth date), the filled create CTA, and an outlined join-with-code button.
 * Cairo + Dar tokens, both themes, RTL. The create-circle mutation / schema / data
 * flow are unchanged.
 */
export function CareCircleOnboarding({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const createCircle = useCreateCareCircle(userId);

  const [circleName, setCircleName] = useState(() => t('careCircle.onboarding.circleNameDefault'));
  const [recipientName, setRecipientName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [errors, setErrors] = useState<{ circleName?: string; recipientName?: string; birthDate?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submitting = createCircle.isPending;

  async function onSubmit() {
    setSubmitError(null);

    const parsed = createCircleSchema.safeParse({ circleName, recipientName, birthDate });
    if (!parsed.success) {
      const next: { circleName?: string; recipientName?: string; birthDate?: string } = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'circleName' && !next.circleName)
          next.circleName = t('careCircle.onboarding.errors.circleName');
        if (issue.path[0] === 'recipientName' && !next.recipientName)
          next.recipientName = t('careCircle.onboarding.errors.recipientName');
        if (issue.path[0] === 'birthDate' && !next.birthDate)
          next.birthDate = t('careCircle.onboarding.errors.birthDate');
      }
      setErrors(next);
      return;
    }
    setErrors({});

    try {
      await createCircle.mutateAsync({
        circleName: parsed.data.circleName,
        recipientName: parsed.data.recipientName,
        birthDate: parsed.data.birthDate === '' ? null : parsed.data.birthDate,
      });
      // On success the summary query is invalidated and Home swaps to the dashboard.
    } catch {
      setSubmitError(t('careCircle.onboarding.errors.submitFailed'));
    }
  }

  return (
    <Screen maxWidth={MaxFormWidth} edges={{ top: true }} keyboardAvoiding gap={Spacing.four}>
      <AuthHeader
        title={t('careCircle.onboarding.title')}
        subtitle={t('careCircle.onboarding.subtitle')}
      />

      <InfoBanner tone="info" text={t('careCircle.onboarding.inviteHint')} />

      <Surface tone="card" radius={Radius.card} padded={16}>
        <FormField
          label={t('careCircle.onboarding.circleNameLabel')}
          value={circleName}
          onChangeText={setCircleName}
          placeholder={t('careCircle.onboarding.circleNamePlaceholder')}
          error={errors.circleName}
        />
      </Surface>

      <View style={styles.group}>
        <SectionHeader title={t('careCircle.onboarding.recipientSection')} />
        <Surface tone="card" radius={Radius.card} padded={16} gap={16}>
          <FormField
            label={t('careCircle.onboarding.recipientNameLabel')}
            value={recipientName}
            onChangeText={setRecipientName}
            placeholder={t('careCircle.onboarding.recipientNamePlaceholder')}
            required
            error={errors.recipientName}
          />
          <DateField
            label={t('careCircle.onboarding.birthDateLabel')}
            value={birthDate}
            onChange={setBirthDate}
            clearable
            error={errors.birthDate}
          />
        </Surface>
      </View>

      {submitError ? <AuthError message={submitError} /> : null}

      <FigmaFooterPrimaryButton
        label={t('careCircle.onboarding.submit')}
        onPress={onSubmit}
        loading={submitting}
      />

      <Button
        label={t('careCircle.onboarding.joinWithCode')}
        onPress={() => router.push('/join-circle')}
        variant="secondary"
        disabled={submitting}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
});
