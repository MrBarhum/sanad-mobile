import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput } from 'react-native';

import { Button } from '@/components/button';
import { DateField } from '@/components/date-field';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxFormWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useCreateCareCircle } from './hooks';
import { createCircleSchema } from './schema';

/**
 * First-run onboarding: create the care circle and its care recipient. Rendered
 * by Home when the user is not yet an active member of any circle.
 */
export function CareCircleOnboarding({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const createCircle = useCreateCareCircle(userId);

  const [circleName, setCircleName] = useState(() => t('careCircle.onboarding.circleNameDefault'));
  const [recipientName, setRecipientName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submitting = createCircle.isPending;

  async function onSubmit() {
    setError(null);

    const parsed = createCircleSchema.safeParse({ circleName, recipientName, birthDate });
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      setError(
        field === 'recipientName'
          ? t('careCircle.onboarding.errors.recipientName')
          : field === 'birthDate'
            ? t('careCircle.onboarding.errors.birthDate')
            : t('careCircle.onboarding.errors.circleName'),
      );
      return;
    }

    try {
      await createCircle.mutateAsync({
        circleName: parsed.data.circleName,
        recipientName: parsed.data.recipientName,
        birthDate: parsed.data.birthDate === '' ? null : parsed.data.birthDate,
      });
      // On success the summary query is invalidated and Home swaps to the dashboard.
    } catch {
      setError(t('careCircle.onboarding.errors.submitFailed'));
    }
  }

  const inputStyle = [
    styles.input,
    {
      color: theme.text,
      backgroundColor: theme.backgroundElement,
      borderColor: theme.backgroundSelected,
    },
  ];

  return (
    <Screen maxWidth={MaxFormWidth} edges={{ top: true }} keyboardAvoiding>
      <ThemedView style={styles.header}>
        <ThemedText type="title" accessibilityRole="header">
          {t('careCircle.onboarding.title')}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          {t('careCircle.onboarding.subtitle')}
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.form}>
        <ThemedView style={styles.field}>
          <ThemedText type="smallBold">{t('careCircle.onboarding.circleNameLabel')}</ThemedText>
          <TextInput
            value={circleName}
            onChangeText={setCircleName}
            placeholder={t('careCircle.onboarding.circleNamePlaceholder')}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={t('careCircle.onboarding.circleNameLabel')}
            style={inputStyle}
          />
        </ThemedView>

        <ThemedView style={styles.field}>
          <ThemedText type="smallBold">
            {t('careCircle.onboarding.recipientNameLabel')}
          </ThemedText>
          <TextInput
            value={recipientName}
            onChangeText={setRecipientName}
            placeholder={t('careCircle.onboarding.recipientNamePlaceholder')}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={t('careCircle.onboarding.recipientNameLabel')}
            style={inputStyle}
          />
        </ThemedView>

        <DateField
          label={t('careCircle.onboarding.birthDateLabel')}
          value={birthDate}
          onChange={setBirthDate}
          clearable
        />

        {error ? (
          <ThemedText
            style={{ color: theme.errorFg }}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite">
            {error}
          </ThemedText>
        ) : null}

        <Button
          label={t('careCircle.onboarding.submit')}
          onPress={onSubmit}
          loading={submitting}
          disabled={submitting}
          style={styles.submit}
        />

        <Button
          label={t('careCircle.onboarding.joinWithCode')}
          onPress={() => router.push('/join-circle')}
          variant="plain"
          disabled={submitting}
        />
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  subtitle: { fontSize: 18, lineHeight: 28 },
  form: { gap: Spacing.three },
  field: { gap: Spacing.one },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    minHeight: 52,
  },
  submit: { marginTop: Spacing.two },
});
