import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxFormWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';

import { useCreateVisit } from './hooks';
import { VisitFieldset, defaultVisitDraft, prepareVisit, type VisitDraft } from './visit-fields';

const DANGER = '#dc2626';

/**
 * Add-visit form. Managers may record any visitor and optionally link the visit
 * to their own account; caregivers / family members always record their own
 * visit (RLS requires the visit to be linked to their account).
 */
export function VisitForm({ circleId, canManage }: { circleId: string; canManage: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const create = useCreateVisit(circleId);

  const [draft, setDraft] = useState<VisitDraft>(() => defaultVisitDraft());
  const [linkToSelf, setLinkToSelf] = useState(!canManage);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submitting = create.isPending;
  // Collaborators always record their own visit; managers may opt in.
  const visitorUserId = (canManage ? linkToSelf : true) ? (user?.id ?? null) : null;

  function patch(part: Partial<VisitDraft>) {
    setDraft((current) => ({ ...current, ...part }));
  }

  async function onSubmit() {
    const prepared = prepareVisit(draft);
    setErrors(prepared.ok ? {} : prepared.errors);
    if (!prepared.ok) return;

    setSubmitError(null);
    try {
      await create.mutateAsync({ ...prepared.value, visitor_user_id: visitorUserId });
      router.back();
    } catch {
      setSubmitError(t('visits.saveFailed'));
    }
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <ThemedText type="small" themeColor="textSecondary">
            {t('visits.disclaimer')}
          </ThemedText>

          <VisitFieldset draft={draft} onChange={patch} errors={errors} />

          {canManage ? (
            <View style={styles.switchRow}>
              <ThemedText type="smallBold">{t('visits.fields.linkToMe')}</ThemedText>
              <Switch
                value={linkToSelf}
                onValueChange={setLinkToSelf}
                trackColor={{ true: theme.text, false: theme.backgroundSelected }}
                accessibilityLabel={t('visits.fields.linkToMe')}
              />
            </View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              {t('visits.ownVisitNote')}
            </ThemedText>
          )}

          {submitError ? (
            <ThemedText style={styles.submitError} accessibilityRole="alert">
              {submitError}
            </ThemedText>
          ) : null}

          <Button
            label={t('visits.saveVisit')}
            onPress={onSubmit}
            loading={submitting}
            disabled={submitting}
            style={styles.save}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  flex: { flex: 1, width: '100%' },
  content: {
    width: '100%',
    maxWidth: MaxFormWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  submitError: { color: DANGER },
  save: { marginTop: Spacing.two },
});
