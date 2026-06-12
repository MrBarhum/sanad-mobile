import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { DateField } from '@/components/date-field';
import { FormActions } from '@/components/form-actions';
import { FormField } from '@/components/form-field';
import { Screen } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/states';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { MaxFormWidth } from '@/constants/theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { fieldErrors } from '@/utils/form';

import type { Recipient } from './api';
import { useRecipient, useUpdateRecipient } from './hooks';
import { recipientProfileSchema } from './schema';

const nullify = (value: string) => (value.trim() === '' ? null : value.trim());

/** Loads the recipient, then renders the edit form (or read-only view). */
export function RecipientProfileForm({
  circleId,
  canManage,
}: {
  circleId: string;
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const recipient = useRecipient(circleId);

  if (recipient.isLoading) return <LoadingState />;
  if (recipient.isError) {
    return (
      <ErrorState
        message={t('recipientProfile.loadError')}
        retryLabel={t('retry')}
        onRetry={() => recipient.refetch()}
      />
    );
  }
  if (!recipient.data) {
    return (
      <Screen scroll={false} center maxWidth={MaxFormWidth}>
        <ThemedText style={styles.centeredText}>{t('recipientProfile.empty')}</ThemedText>
      </Screen>
    );
  }

  return (
    <RecipientFields
      key={recipient.data.id}
      circleId={circleId}
      canManage={canManage}
      initial={recipient.data}
    />
  );
}

function RecipientFields({
  circleId,
  canManage,
  initial,
}: {
  circleId: string;
  canManage: boolean;
  initial: Recipient;
}) {
  const { t } = useTranslation();
  const update = useUpdateRecipient(circleId);

  const [fullName, setFullName] = useState(initial.full_name ?? '');
  const [birthDate, setBirthDate] = useState(initial.birth_date ?? '');
  const [dialect, setDialect] = useState(initial.dialect ?? '');
  const [bloodType, setBloodType] = useState(initial.blood_type ?? '');
  const [allergies, setAllergies] = useState(initial.allergies ?? '');
  const [chronic, setChronic] = useState(initial.chronic_conditions ?? '');
  const [notes, setNotes] = useState(initial.emergency_notes ?? '');
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const { dirty, markSaved } = useUnsavedChanges({
    fullName,
    birthDate,
    dialect,
    bloodType,
    allergies,
    chronic,
    notes,
  });
  const submitting = update.isPending;

  function bind(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      if (status !== 'idle') setStatus('idle');
    };
  }

  function fieldError(code?: string): string | undefined {
    switch (code) {
      case undefined:
        return undefined;
      case 'full_name':
        return t('recipientProfile.errors.fullName');
      case 'birth_date':
        return t('recipientProfile.errors.birthDate');
      case 'tooLong':
        return t('validation.tooLong');
      default:
        return t('validation.generic');
    }
  }

  async function onSubmit() {
    const parsed = recipientProfileSchema.safeParse({
      full_name: fullName,
      birth_date: birthDate,
      dialect,
      blood_type: bloodType,
      allergies,
      chronic_conditions: chronic,
      emergency_notes: notes,
    });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setStatus('idle');
      return;
    }

    setErrors({});
    try {
      await update.mutateAsync({
        full_name: parsed.data.full_name,
        birth_date: parsed.data.birth_date === '' ? null : parsed.data.birth_date,
        dialect: nullify(parsed.data.dialect),
        blood_type: nullify(parsed.data.blood_type),
        allergies: nullify(parsed.data.allergies),
        chronic_conditions: nullify(parsed.data.chronic_conditions),
        emergency_notes: nullify(parsed.data.emergency_notes),
      });
      markSaved();
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <Screen maxWidth={MaxFormWidth} keyboardAvoiding>
      <UnsavedChangesGuard when={canManage && dirty} />
      {!canManage ? (
        <Surface>
          <ThemedText type="small" themeColor="textSecondary">
            {t('recipientProfile.readOnly')}
          </ThemedText>
        </Surface>
      ) : null}

      <FormField
        label={t('recipientProfile.fields.fullName')}
        value={fullName}
        onChangeText={bind(setFullName)}
        editable={canManage}
        error={fieldError(errors.full_name)}
      />
      <DateField
        label={t('recipientProfile.fields.birthDate')}
        value={birthDate}
        onChange={bind(setBirthDate)}
        disabled={!canManage}
        clearable
        error={fieldError(errors.birth_date)}
      />
      <FormField
        label={t('recipientProfile.fields.dialect')}
        value={dialect}
        onChangeText={bind(setDialect)}
        editable={canManage}
        placeholder={t('recipientProfile.placeholders.dialect')}
        error={fieldError(errors.dialect)}
      />
      <FormField
        label={t('recipientProfile.fields.bloodType')}
        value={bloodType}
        onChangeText={bind(setBloodType)}
        editable={canManage}
        placeholder={t('recipientProfile.placeholders.bloodType')}
        autoCapitalize="characters"
        error={fieldError(errors.blood_type)}
      />
      <FormField
        label={t('recipientProfile.fields.allergies')}
        value={allergies}
        onChangeText={bind(setAllergies)}
        editable={canManage}
        placeholder={t('recipientProfile.placeholders.allergies')}
        multiline
        error={fieldError(errors.allergies)}
      />
      <FormField
        label={t('recipientProfile.fields.chronicConditions')}
        value={chronic}
        onChangeText={bind(setChronic)}
        editable={canManage}
        placeholder={t('recipientProfile.placeholders.chronicConditions')}
        multiline
        error={fieldError(errors.chronic_conditions)}
      />
      <FormField
        label={t('recipientProfile.fields.emergencyNotes')}
        value={notes}
        onChangeText={bind(setNotes)}
        editable={canManage}
        placeholder={t('recipientProfile.placeholders.emergencyNotes')}
        multiline
        error={fieldError(errors.emergency_notes)}
      />

      {canManage ? (
        <FormActions
          saveLabel={t('recipientProfile.save')}
          onSave={onSubmit}
          saving={submitting}
          disabled={!dirty}
          status={status}
          savedLabel={t('recipientProfile.saved')}
          errorLabel={t('recipientProfile.saveFailed')}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centeredText: { textAlign: 'center' },
});
