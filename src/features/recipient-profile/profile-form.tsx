import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { FormActions } from '@/components/form-actions';
import { FormField } from '@/components/form-field';
import { Icon } from '@/components/icon';
import { InfoBanner } from '@/components/info-banner';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { Glyph } from '@/constants/glyphs';
import { FontFamily, MaxFormWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
        <EmptyState icon={Glyph.profile} title={t('recipientProfile.empty')} />
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

/** A hairline divider between fields inside a card (Figma recipient cards). */
function CardDivider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.divider }]} />;
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
  const theme = useTheme();
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

  const initialLetter = fullName.trim().charAt(0);

  return (
    <Screen maxWidth={MaxFormWidth} keyboardAvoiding>
      <UnsavedChangesGuard when={canManage && dirty} />
      {!canManage ? <InfoBanner tone="neutral" text={t('recipientProfile.readOnly')} /> : null}

      {/* Avatar + name summary card (Figma: 56×56 rounded-square, teal border). */}
      <Surface>
        <View style={styles.summary}>
          <View style={[styles.avatar, { backgroundColor: theme.primaryBg, borderColor: theme.primary }]}>
            {initialLetter ? (
              <Text style={[styles.avatarText, { fontFamily: FontFamily.bold, color: theme.primaryText }]}>{initialLetter}</Text>
            ) : (
              <Icon name="profile" size={28} color="primaryText" />
            )}
          </View>
          <View style={styles.summaryText}>
            {fullName.trim() ? (
              <Text style={[styles.summaryName, { fontFamily: FontFamily.bold, color: theme.text }]}>{fullName}</Text>
            ) : null}
            {birthDate ? (
              <ThemedText type="small" themeColor="textSecondary">
                {birthDate}
              </ThemedText>
            ) : null}
          </View>
        </View>
      </Surface>

      {/* Personal info card */}
      <Surface radius={Radius.lg}>
        <View style={styles.cardFields}>
          <ThemedText type="smallBold" themeColor="textMuted">
            {t('recipientProfile.sections.personal')}
          </ThemedText>
          <FormField
            label={t('recipientProfile.fields.fullName')}
            value={fullName}
            onChangeText={bind(setFullName)}
            editable={canManage}
            error={fieldError(errors.full_name)}
          />
          <CardDivider />
          <DateField
            label={t('recipientProfile.fields.birthDate')}
            value={birthDate}
            onChange={bind(setBirthDate)}
            disabled={!canManage}
            clearable
            error={fieldError(errors.birth_date)}
          />
          <CardDivider />
          <FormField
            label={t('recipientProfile.fields.dialect')}
            value={dialect}
            onChangeText={bind(setDialect)}
            editable={canManage}
            placeholder={t('recipientProfile.placeholders.dialect')}
            error={fieldError(errors.dialect)}
          />
        </View>
      </Surface>

      {/* Medical / emergency info card */}
      <Surface radius={Radius.lg}>
        <View style={styles.cardFields}>
          <ThemedText type="smallBold" themeColor="textMuted">
            {t('recipientProfile.sections.medical')}
          </ThemedText>
          <FormField
            label={t('recipientProfile.fields.bloodType')}
            value={bloodType}
            onChangeText={bind(setBloodType)}
            editable={canManage}
            placeholder={t('recipientProfile.placeholders.bloodType')}
            autoCapitalize="characters"
            error={fieldError(errors.blood_type)}
          />
          <CardDivider />
          <FormField
            label={t('recipientProfile.fields.allergies')}
            value={allergies}
            onChangeText={bind(setAllergies)}
            editable={canManage}
            placeholder={t('recipientProfile.placeholders.allergies')}
            multiline
            error={fieldError(errors.allergies)}
          />
          <CardDivider />
          <FormField
            label={t('recipientProfile.fields.chronicConditions')}
            value={chronic}
            onChangeText={bind(setChronic)}
            editable={canManage}
            placeholder={t('recipientProfile.placeholders.chronicConditions')}
            multiline
            error={fieldError(errors.chronic_conditions)}
          />
          <CardDivider />
          <FormField
            label={t('recipientProfile.fields.emergencyNotes')}
            value={notes}
            onChangeText={bind(setNotes)}
            editable={canManage}
            placeholder={t('recipientProfile.placeholders.emergencyNotes')}
            multiline
            error={fieldError(errors.emergency_notes)}
          />
        </View>
      </Surface>

      {canManage ? (
        <FormActions
          saveLabel={t('recipientProfile.save')}
          onSave={onSubmit}
          saving={submitting}
          status={status}
          savedLabel={t('recipientProfile.saved')}
          errorLabel={t('recipientProfile.saveFailed')}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22 },
  summaryText: { flex: 1, gap: Spacing.half },
  summaryName: { fontSize: 18, lineHeight: 26 },
  cardFields: { gap: Spacing.three },
  divider: { height: StyleSheet.hairlineWidth },
});
