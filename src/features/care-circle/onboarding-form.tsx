import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxFormWidth, Spacing, TopTabInset } from '@/constants/theme';
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
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
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

              <ThemedView style={styles.field}>
                <ThemedText type="smallBold">{t('careCircle.onboarding.birthDateLabel')}</ThemedText>
                <TextInput
                  value={birthDate}
                  onChangeText={setBirthDate}
                  placeholder={t('careCircle.onboarding.birthDatePlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  accessibilityLabel={t('careCircle.onboarding.birthDateLabel')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={inputStyle}
                />
              </ThemedView>

              {error ? (
                <ThemedText
                  style={styles.error}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite">
                  {error}
                </ThemedText>
              ) : null}

              <Pressable
                onPress={onSubmit}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityState={{ disabled: submitting, busy: submitting }}
                style={[styles.button, { backgroundColor: theme.text, opacity: submitting ? 0.6 : 1 }]}>
                {submitting ? (
                  <ActivityIndicator color={theme.background} />
                ) : (
                  <ThemedText style={[styles.buttonLabel, { color: theme.background }]}>
                    {t('careCircle.onboarding.submit')}
                  </ThemedText>
                )}
              </Pressable>
            </ThemedView>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  flex: { flex: 1, width: '100%' },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxFormWidth,
    alignSelf: 'center',
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: TopTabInset + Spacing.five,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.five,
  },
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
  error: { color: '#dc2626' },
  button: {
    marginTop: Spacing.two,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});
