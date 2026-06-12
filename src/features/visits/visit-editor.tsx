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
import { formatHm } from '@/utils/date';

import type { FamilyVisit, VisitStatus } from './api';
import { useDeleteVisit, useSetVisitStatus, useUpdateVisit, useVisit } from './hooks';
import { VisitFieldset, prepareVisit, visitDraftFromRow, type VisitDraft } from './visit-fields';

/** Loads a visit, then renders the view/edit screen with status + delete. */
export function VisitEditor({
  circleId,
  canManage,
  canCollaborate,
  visitId,
}: {
  circleId: string;
  canManage: boolean;
  canCollaborate: boolean;
  visitId: string;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const visit = useVisit(visitId);

  if (visit.isLoading) return <LoadingState />;
  if (visit.isError) {
    return (
      <ErrorState
        message={t('visits.loadError')}
        retryLabel={t('retry')}
        onRetry={() => visit.refetch()}
      />
    );
  }
  if (!visit.data) {
    return (
      <ThemedView style={styles.centered}>
        <EmptyState title={t('visits.notFound')} />
      </ThemedView>
    );
  }

  const isOwner = visit.data.visitor_user_id !== null && visit.data.visitor_user_id === userId;
  const canEdit = canManage || (canCollaborate && isOwner);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {canEdit ? (
          <VisitEditFields key={visit.data.id} circleId={circleId} initial={visit.data} />
        ) : (
          <ReadOnlyVisit visit={visit.data} />
        )}

        <StatusSection circleId={circleId} visit={visit.data} canAct={canEdit} />

        {canEdit ? <DeleteVisitRow circleId={circleId} id={visit.data.id} /> : null}
      </ScrollView>
    </ThemedView>
  );
}

function VisitEditFields({ circleId, initial }: { circleId: string; initial: FamilyVisit }) {
  const { t } = useTranslation();
  const update = useUpdateVisit(circleId);

  const [draft, setDraft] = useState<VisitDraft>(() => visitDraftFromRow(initial));
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const { dirty, markSaved } = useUnsavedChanges(draft);
  const submitting = update.isPending;

  function patch(part: Partial<VisitDraft>) {
    setDraft((current) => ({ ...current, ...part }));
    if (status !== 'idle') setStatus('idle');
  }

  async function onSubmit() {
    const prepared = prepareVisit(draft);
    setErrors(prepared.ok ? {} : prepared.errors);
    if (!prepared.ok) {
      setStatus('idle');
      return;
    }
    try {
      // Preserve the visitor account link so RLS (own-visit / manager) still holds.
      await update.mutateAsync({
        id: initial.id,
        patch: { ...prepared.value, visitor_user_id: initial.visitor_user_id },
      });
      markSaved();
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <View style={styles.fields}>
      <UnsavedChangesGuard when={dirty} />
      <VisitFieldset draft={draft} onChange={patch} errors={errors} />

      <FormActions
        saveLabel={t('common.saveChanges')}
        onSave={onSubmit}
        saving={submitting}
        disabled={!dirty}
        status={status}
        savedLabel={t('visits.saved')}
        errorLabel={t('visits.saveFailed')}
      />
    </View>
  );
}

function ReadOnlyVisit({ visit }: { visit: FamilyVisit }) {
  const { t } = useTranslation();
  const timeParts = [];
  if (visit.start_time) timeParts.push(formatHm(visit.start_time));
  if (visit.end_time) timeParts.push(formatHm(visit.end_time));
  const when =
    timeParts.length > 0 ? `${visit.visit_date} ${timeParts.join(' – ')}` : visit.visit_date;

  return (
    <View style={styles.fields}>
      <ThemedView type="backgroundElement" style={styles.notice}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('visits.readOnly')}
        </ThemedText>
      </ThemedView>
      <ThemedText style={styles.readName}>{visit.visitor_name}</ThemedText>
      <InfoRow label={t('visits.whenLabel')} value={when} />
      {visit.notes ? <InfoRow label={t('visits.fields.notes')} value={visit.notes} /> : null}
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

function StatusSection({
  circleId,
  visit,
  canAct,
}: {
  circleId: string;
  visit: FamilyVisit;
  canAct: boolean;
}) {
  const { t } = useTranslation();
  const setStatus = useSetVisitStatus(circleId);
  const [pending, setPending] = useState(false);

  async function run(status: VisitStatus) {
    setPending(true);
    try {
      await setStatus.mutateAsync({ id: visit.id, status });
    } finally {
      setPending(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.statusCard}>
      <ThemedText type="smallBold">
        {t('visits.fields.status')}: {t(`visits.status.${visit.status}`)}
      </ThemedText>

      {canAct ? (
        <View style={styles.actions}>
          {visit.status === 'planned' ? (
            <>
              <Button
                size="sm"
                label={t('visits.markCompleted')}
                loading={pending}
                disabled={pending}
                onPress={() => run('completed')}
              />
              <Button
                size="sm"
                variant="secondary"
                label={t('visits.markCancelled')}
                disabled={pending}
                onPress={() => run('cancelled')}
              />
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              label={t('visits.reopen')}
              loading={pending}
              disabled={pending}
              onPress={() => run('planned')}
            />
          )}
        </View>
      ) : null}
    </ThemedView>
  );
}

function DeleteVisitRow({ circleId, id }: { circleId: string; id: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const del = useDeleteVisit(circleId);
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
    <Button variant="danger" label={t('visits.deleteVisit')} onPress={() => setConfirming(true)} />
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
  statusCard: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.two },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  confirmRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
});
