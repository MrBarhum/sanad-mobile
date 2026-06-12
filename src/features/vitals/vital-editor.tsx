import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FormActions } from '@/components/form-actions';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useAuth } from '@/providers';
import { hmFromInstant, ymdFromInstant } from '@/utils/date';

import type { VitalReading } from './api';
import { formatVitalValue } from './describe';
import { useDeleteVital, useUpdateVital, useVital } from './hooks';
import { VitalFieldset, prepareVital, vitalDraftFromRow, type VitalDraft } from './vital-fields';

/** Loads a reading, then renders the view/edit screen with a delete action. */
export function VitalEditor({
  circleId,
  canManage,
  canCollaborate,
  vitalId,
}: {
  circleId: string;
  canManage: boolean;
  canCollaborate: boolean;
  vitalId: string;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const vital = useVital(vitalId);

  if (vital.isLoading) return <LoadingState />;
  if (vital.isError) {
    return (
      <ErrorState
        message={t('vitals.loadError')}
        retryLabel={t('retry')}
        onRetry={() => vital.refetch()}
      />
    );
  }
  if (!vital.data) {
    return (
      <ThemedView style={styles.centered}>
        <EmptyState title={t('vitals.notFound')} />
      </ThemedView>
    );
  }

  const isOwner = vital.data.recorded_by !== null && vital.data.recorded_by === userId;
  const canEdit = canManage || (canCollaborate && isOwner);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {canEdit ? (
          <VitalEditFields key={vital.data.id} circleId={circleId} initial={vital.data} />
        ) : (
          <ReadOnlyVital reading={vital.data} />
        )}

        {canEdit ? <DeleteVitalRow circleId={circleId} id={vital.data.id} /> : null}
      </ScrollView>
    </ThemedView>
  );
}

function VitalEditFields({ circleId, initial }: { circleId: string; initial: VitalReading }) {
  const { t } = useTranslation();
  const update = useUpdateVital(circleId);

  const [draft, setDraft] = useState<VitalDraft>(() => vitalDraftFromRow(initial));
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const { dirty, markSaved } = useUnsavedChanges(draft);
  const submitting = update.isPending;

  function patch(part: Partial<VitalDraft>) {
    setDraft((current) => ({ ...current, ...part }));
    if (status !== 'idle') setStatus('idle');
  }

  async function onSubmit() {
    const prepared = prepareVital(draft);
    setErrors(prepared.ok ? {} : prepared.errors);
    if (!prepared.ok) {
      setStatus('idle');
      return;
    }
    try {
      await update.mutateAsync({ id: initial.id, patch: prepared.input });
      markSaved();
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <View style={styles.fields}>
      <UnsavedChangesGuard when={dirty} />
      <VitalFieldset draft={draft} onChange={patch} errors={errors} />

      <FormActions
        saveLabel={t('common.saveChanges')}
        onSave={onSubmit}
        saving={submitting}
        disabled={!dirty}
        status={status}
        savedLabel={t('vitals.saved')}
        errorLabel={t('vitals.saveFailed')}
      />
    </View>
  );
}

function ReadOnlyVital({ reading }: { reading: VitalReading }) {
  const { t } = useTranslation();
  const value = formatVitalValue(reading);
  const when = `${ymdFromInstant(reading.reading_at)} ${hmFromInstant(reading.reading_at)}`;

  return (
    <View style={styles.fields}>
      <ThemedView type="backgroundElement" style={styles.notice}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('vitals.readOnly')}
        </ThemedText>
      </ThemedView>
      <ThemedText style={styles.readName}>{t(`vitals.type.${reading.reading_type}`)}</ThemedText>
      <InfoRow label={t('vitals.fields.readingAt')} value={when} />
      {value ? <InfoRow label={t('vitals.valueLabel')} value={value} /> : null}
      {reading.notes ? <InfoRow label={t('vitals.fields.notes')} value={reading.notes} /> : null}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.infoValue}>{value}</ThemedText>
    </View>
  );
}

function DeleteVitalRow({ circleId, id }: { circleId: string; id: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const del = useDeleteVital(circleId);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function onDelete() {
    setPending(true);
    try {
      await del.mutateAsync(id);
      router.back();
    } catch {
      setPending(false);
    }
  }

  if (confirming) {
    return (
      <View style={styles.confirmRow}>
        <Button
          variant="danger"
          label={t('common.confirmDelete')}
          loading={pending}
          onPress={onDelete}
        />
        <Button
          variant="secondary"
          label={t('common.cancel')}
          disabled={pending}
          onPress={() => setConfirming(false)}
        />
      </View>
    );
  }

  return (
    <Button variant="danger" label={t('vitals.deleteReading')} onPress={() => setConfirming(true)} />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  centered: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  fields: { gap: Spacing.three },
  notice: { borderRadius: Spacing.two, padding: Spacing.three },
  readName: { fontSize: 22, fontWeight: '700' },
  infoRow: { gap: Spacing.half },
  infoValue: { fontSize: 16, lineHeight: 24 },
  confirmRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
});
