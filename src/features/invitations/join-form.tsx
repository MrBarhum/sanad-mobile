import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { FormField } from '@/components/form-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxFormWidth, Spacing } from '@/constants/theme';
import { useCircleSelection } from '@/features/circle-selection/provider';

import { acceptErrorKey } from './api';
import { useAcceptInvitation } from './hooks';

const DANGER = '#dc2626';

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
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {done ? (
              <>
                <ThemedText type="subtitle" style={styles.title} accessibilityRole="header">
                  {t('joinCircle.successTitle')}
                </ThemedText>
                <ThemedText themeColor="textSecondary">{t('joinCircle.successSubtitle')}</ThemedText>
                <Button label={t('joinCircle.continue')} onPress={() => router.replace('/')} />
              </>
            ) : (
              <>
                <ThemedText type="subtitle" style={styles.title} accessibilityRole="header">
                  {t('joinCircle.title')}
                </ThemedText>
                <ThemedText themeColor="textSecondary">{t('joinCircle.subtitle')}</ThemedText>

                <FormField
                  label={t('joinCircle.codeLabel')}
                  value={code}
                  onChangeText={setCode}
                  placeholder={t('joinCircle.codePlaceholder')}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  error={error}
                />

                <ThemedView type="backgroundElement" style={styles.warning}>
                  <ThemedText type="small">{t('joinCircle.warning')}</ThemedText>
                </ThemedView>

                <Button
                  label={t('joinCircle.submit')}
                  onPress={onSubmit}
                  loading={accept.isPending}
                  disabled={accept.isPending}
                />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  flex: { flex: 1, width: '100%' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxFormWidth, alignSelf: 'center' },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  title: { fontSize: 24, lineHeight: 32 },
  warning: { borderRadius: Spacing.three, padding: Spacing.three },
});
