import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';

import { StickyFormActions } from '@/components/form-actions';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { MaxFormWidth, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useAuth } from '@/providers';

import { useCreateVisit } from './hooks';
import { VisitFieldset, defaultVisitDraft, prepareVisit, type VisitDraft } from './visit-fields';

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
  const [submitted, setSubmitted] = useState(false);

  const { dirty } = useUnsavedChanges({ draft, linkToSelf });
  const submitting = create.isPending;

  useEffect(() => {
    if (submitted) router.back();
  }, [submitted, router]);
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
      setSubmitted(true);
    } catch {
      setSubmitError(t('visits.saveFailed'));
    }
  }

  return (
    <Screen
      maxWidth={MaxFormWidth}
      keyboardAvoiding
      footer={
        <StickyFormActions
          saveLabel={t('visits.add')}
          onSave={onSubmit}
          saving={submitting}
          disabled={!dirty}
          status={submitError ? 'error' : 'idle'}
          errorLabel={submitError ?? undefined}
        />
      }>
      <UnsavedChangesGuard when={dirty && !submitted} />
      <ThemedText type="small" themeColor="textMuted">
        {t('visits.disclaimer')}
      </ThemedText>

      <VisitFieldset draft={draft} onChange={patch} errors={errors} />

      {canManage ? (
        <View style={styles.switchRow}>
          <ThemedText type="smallBold">{t('visits.fields.linkToMe')}</ThemedText>
          <Switch
            value={linkToSelf}
            onValueChange={setLinkToSelf}
            trackColor={{ true: theme.primary, false: theme.backgroundSelected }}
            accessibilityLabel={t('visits.fields.linkToMe')}
          />
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {t('visits.ownVisitNote')}
        </ThemedText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: TouchTarget.min,
  },
});
