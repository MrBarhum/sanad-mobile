import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FormActions } from '@/components/form-actions';
import { isolateLtr } from '@/components/ltr-text';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { Glyph } from '@/constants/glyphs';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useAuth } from '@/providers';
import { formatHm } from '@/utils/date';

import type { FamilyVisit, VisitStatus } from './api';
import { useDeleteVisit, useSetVisitStatus, useUpdateVisit, useVisit } from './hooks';
import { VisitFieldset, prepareVisit, visitDraftFromRow, type VisitDraft } from './visit-fields';

const STATUS_TONE: Record<VisitStatus, StatusTone> = {
  planned: 'info',
  completed: 'success',
  cancelled: 'error',
};

/** Visit status → badge glyph (planned reads as "upcoming"). */
const STATUS_GLYPH: Record<VisitStatus, string> = {
  planned: Glyph.clock,
  completed: Glyph.check,
  cancelled: Glyph.cross,
};

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
      <Screen scroll={false} center>
        <EmptyState icon={Glyph.visit} title={t('visits.notFound')} />
      </Screen>
    );
  }

  const isOwner = visit.data.visitor_user_id !== null && visit.data.visitor_user_id === userId;
  const canEdit = canManage || (canCollaborate && isOwner);

  return (
    <Screen>
      {canEdit ? (
        <VisitEditFields key={visit.data.id} circleId={circleId} initial={visit.data} />
      ) : (
        <ReadOnlyVisit visit={visit.data} />
      )}

      <StatusSection circleId={circleId} visit={visit.data} canAct={canEdit} />

      {canEdit ? <DeleteVisitRow circleId={circleId} id={visit.data.id} /> : null}
    </Screen>
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
  if (visit.start_time) timeParts.push(isolateLtr(formatHm(visit.start_time)));
  if (visit.end_time) timeParts.push(isolateLtr(formatHm(visit.end_time)));
  const when =
    timeParts.length > 0 ? `${visit.visit_date} ${timeParts.join(' – ')}` : visit.visit_date;

  return (
    <View style={styles.fields}>
      <Surface tone="sunken">
        <ThemedText type="small" themeColor="textSecondary">
          {t('visits.readOnly')}
        </ThemedText>
      </Surface>
      <ThemedText type="sectionTitle">{visit.visitor_name}</ThemedText>
      <View style={styles.infoGroup}>
        <InfoRow label={t('visits.whenLabel')} value={when} />
        {visit.notes ? <InfoRow label={t('visits.fields.notes')} value={visit.notes} /> : null}
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="default">{value}</ThemedText>
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
  const theme = useTheme();
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
    <Surface style={styles.statusCard}>
      <View style={styles.statusRow}>
        <ThemedText type="smallBold">{t('visits.fields.status')}</ThemedText>
        <StatusBadge
          tone={STATUS_TONE[visit.status]}
          glyph={STATUS_GLYPH[visit.status]}
          label={t(`visits.status.${visit.status}`)}
        />
      </View>

      {canAct ? (
        <View style={[styles.actions, { borderTopColor: theme.divider }]}>
          {visit.status === 'planned' ? (
            <>
              <Button
                size="sm"
                glyph={Glyph.check}
                label={t('visits.markCompleted')}
                loading={pending}
                disabled={pending}
                onPress={() => run('completed')}
                style={styles.action}
              />
              <Button
                size="sm"
                variant="secondary"
                glyph={Glyph.cross}
                label={t('visits.markCancelled')}
                disabled={pending}
                onPress={() => run('cancelled')}
                style={styles.action}
              />
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              glyph={Glyph.clock}
              label={t('visits.reopen')}
              loading={pending}
              disabled={pending}
              onPress={() => run('planned')}
              style={styles.action}
            />
          )}
        </View>
      ) : null}
    </Surface>
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
  fields: { gap: Spacing.three },
  infoGroup: { gap: Spacing.two },
  infoRow: { gap: Spacing.half },
  statusCard: { gap: Spacing.two },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
  action: { flexGrow: 1, flexBasis: 96 },
  confirmRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
});
