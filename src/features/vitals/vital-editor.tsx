import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import { FigmaFormCard, FigmaFormScreen, FigmaMutedNote } from '@/components/figma/figma-form-screen';
import { isolateLtr } from '@/components/ltr-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ThemedView } from '@/components/themed-view';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useAuth } from '@/providers';
import { hmFromInstant, ymdFromInstant } from '@/utils/date';

import type { VitalReading } from './api';
import { formatVitalValue } from './describe';
import { FigmaVitalFields } from './figma-vital-fields';
import { useDeleteVital, useUpdateVital, useVital } from './hooks';
import { prepareVital, vitalDraftFromRow, type VitalDraft } from './vital-fields';

/**
 * View / edit a single vital reading — rebuilt in the Figma language (header +
 * gold non-diagnostic banner + grouped cards). Editors get the same fields as
 * /vitals/new plus a two-step delete kept separate from save; viewers get a
 * read-only card layout. Real hooks, validation, permissions, the non-diagnostic
 * rule (no normal/abnormal labels, no health-color coding), and the unsaved guard
 * are all preserved.
 */
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
      <ErrorState message={t('vitals.loadError')} retryLabel={t('retry')} onRetry={() => vital.refetch()} />
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
    <>
      {/* The Figma editor draws its own header; hide the native one. */}
      <Stack.Screen options={{ headerShown: false }} />
      {canEdit ? (
        <VitalEditScreen key={vital.data.id} circleId={circleId} initial={vital.data} />
      ) : (
        <VitalViewScreen reading={vital.data} />
      )}
    </>
  );
}

function VitalEditScreen({ circleId, initial }: { circleId: string; initial: VitalReading }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const update = useUpdateVital(circleId);
  const del = useDeleteVital(circleId);

  const [draft, setDraft] = useState<VitalDraft>(() => vitalDraftFromRow(initial));
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  async function onDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await del.mutateAsync(initial.id);
      router.back();
    } catch {
      // Surface the failure instead of silently resetting the confirm (A4).
      setDeleteError(t('vitals.deleteFailed'));
      setDeleting(false);
    }
  }

  return (
    <FigmaFormScreen
      title={t('vitals.detailTitle')}
      onBack={() => router.back()}
      disclaimer={t('vitals.disclaimer')}>
      <UnsavedChangesGuard when={dirty} />
      <FigmaVitalFields draft={draft} onChange={patch} errors={errors} />

      {/* Delete — destructive, kept separate from save, two-step confirm. */}
      <FigmaFormCard>
        {deleteError ? (
          <Text style={[styles.statusText, { color: theme.errorFg }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {deleteError}
          </Text>
        ) : null}
        {confirming ? (
          <View style={styles.confirmRow}>
            <View style={styles.confirmCol}>
              <Button
                label={t('common.confirmDelete')}
                variant="danger"
                loading={deleting}
                onPress={onDelete}
              />
            </View>
            <View style={styles.confirmCol}>
              <Button
                label={t('common.cancel')}
                variant="secondary"
                onPress={() => setConfirming(false)}
              />
            </View>
          </View>
        ) : (
          <Button
            label={t('vitals.deleteReading')}
            variant="danger"
            onPress={() => setConfirming(true)}
          />
        )}
      </FigmaFormCard>

      {/* Save CTA — rendered in the body (not the footer prop, which did not render
          on Android). Final child, below the destructive delete, matching the prior
          bottom placement. */}
      <View style={styles.footer}>
        {status === 'saved' ? (
          <Text style={[styles.statusText, { color: theme.successFg }]} accessibilityLiveRegion="polite">
            {t('vitals.saved')}
          </Text>
        ) : null}
        {status === 'error' ? (
          <Text style={[styles.statusText, { color: theme.errorFg }]} accessibilityRole="alert">
            {t('vitals.saveFailed')}
          </Text>
        ) : null}
        <FigmaFooterPrimaryButton label={t('common.saveChanges')} onPress={onSubmit} loading={submitting} />
      </View>
    </FigmaFormScreen>
  );
}

function VitalViewScreen({ reading }: { reading: VitalReading }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const value = formatVitalValue(reading);
  const when = isolateLtr(`${ymdFromInstant(reading.reading_at)} ${hmFromInstant(reading.reading_at)}`);

  return (
    <FigmaFormScreen
      title={t('vitals.detailTitle')}
      onBack={() => router.back()}
      disclaimer={t('vitals.disclaimer')}>
      <FigmaMutedNote>{t('vitals.readOnly')}</FigmaMutedNote>

      <FigmaFormCard label={t('vitals.fields.type')}>
        <Text style={[styles.value, { color: theme.text }]}>{t(`vitals.type.${reading.reading_type}`)}</Text>
      </FigmaFormCard>

      {value ? (
        <FigmaFormCard label={t('vitals.valueLabel')}>
          <Text style={[styles.value, { color: theme.text }]}>{value}</Text>
        </FigmaFormCard>
      ) : null}

      <FigmaFormCard label={t('vitals.fields.readingAt')}>
        <Text style={[styles.value, { color: theme.text }]}>{when}</Text>
      </FigmaFormCard>

      {reading.notes ? (
        <FigmaFormCard label={t('vitals.fields.notes')}>
          <Text style={[styles.value, { color: theme.text }]}>{reading.notes}</Text>
        </FigmaFormCard>
      ) : null}
    </FigmaFormScreen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  footer: { gap: Spacing.two },
  statusText: { fontSize: 13, fontFamily: FontFamily.semibold, textAlign: 'center' },
  confirmRow: { flexDirection: 'row', gap: Spacing.two },
  confirmCol: { flex: 1 },
  value: { fontSize: 16, fontFamily: FontFamily.regular },
});
