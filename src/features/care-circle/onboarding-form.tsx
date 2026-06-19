import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Button } from '@/components/button';
import { DateField } from '@/components/date-field';
import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import { FigmaFormField } from '@/components/figma/figma-form-screen';
import { Cairo } from '@/components/figma/form-typography';
import { InfoBanner } from '@/components/info-banner';
import { Screen } from '@/components/screen';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Gutter, MaxFormWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useCreateCareCircle } from './hooks';
import { createCircleSchema } from './schema';

/**
 * First-run onboarding: create the care circle and its care recipient — an exact
 * rebuild of the Figma CreateCircle screen (brand mark + title + amber invite
 * banner + one grouped card [circle name · divider · "معلومات المسنّ" · recipient
 * name* · birth date] + filled teal CTA + outlined join button). Figma blue →
 * Sanad teal. The create-circle mutation/schema/data flow are unchanged.
 */
export function CareCircleOnboarding({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
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
    <Screen maxWidth={MaxFormWidth} edges={{ top: true }} keyboardAvoiding gap={Spacing.three}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={[styles.brandCircle, { backgroundColor: theme.primary }]}>
            <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
              <Circle cx={10} cy={10} r={7} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
              <Path d="M10 3 A7 7 0 1 1 3 10" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" fill="none" />
              <Rect x={7} y={9} width={6} height={3} rx={1.5} fill="#FFFFFF" opacity={0.9} />
            </Svg>
          </View>
          <Text style={[styles.brandName, Cairo.bold, { color: theme.text }]}>{t('auth.brand')}</Text>
        </View>
        <Text style={[styles.title, Cairo.bold, { color: theme.text }]}>
          {t('careCircle.onboarding.title')}
        </Text>
        <ThemedText themeColor="textSecondary" style={Cairo.regular}>
          {t('careCircle.onboarding.subtitle')}
        </ThemedText>
      </View>

      <InfoBanner tone="accent" text={t('careCircle.onboarding.inviteHint')} />

      <Surface>
        <View style={styles.cardFields}>
          <FigmaFormField
            label={t('careCircle.onboarding.circleNameLabel')}
            value={circleName}
            onChangeText={setCircleName}
            placeholder={t('careCircle.onboarding.circleNamePlaceholder')}
            error={errors.circleName}
          />

          <View style={[styles.divider, { backgroundColor: theme.divider }]} />

          <ThemedText type="smallBold" themeColor="textMuted" style={Cairo.semibold}>
            {t('careCircle.onboarding.recipientSection')}
          </ThemedText>

          <FigmaFormField
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
        </View>
      </Surface>

      {submitError ? (
        <ThemedText
          style={[{ color: theme.errorFg }, Cairo.regular]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {submitError}
        </ThemedText>
      ) : null}

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
  header: { gap: Spacing.two },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.two },
  brandCircle: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontSize: 18 },
  title: { fontSize: 24, lineHeight: 34 },
  cardFields: { gap: Gutter },
  divider: { height: StyleSheet.hairlineWidth },
});
