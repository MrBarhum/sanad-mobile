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

import type { DailyCareLog } from './api';
import { describeDailyLog, describeDailyLogNotes } from './describe';
import { FigmaDailyLogFields } from './figma-daily-log-fields';
import { useDailyLog, useDeleteDailyLog, useUpdateDailyLog } from './hooks';
import { dailyLogDraftFromRow, prepareDailyLog, type DailyLogDraft } from './log-fields';

/**
 * View / edit a daily log — rebuilt in the Figma language (header + grouped
 * cards). Editing shows the gold observational banner + the same fields as
 * /daily-logs/new (with "غير محدّد" unset + the distinct "بدون" pain state) plus a
 * two-step delete kept separate from save; viewing shows a calm observational
 * note + a card-based read-only layout. Real hooks/permissions/validation and the
 * observational (non-diagnostic) framing are preserved.
 */
export function DailyLogEditor({
  circleId,
  canManage,
  canCollaborate,
  logId,
}: {
  circleId: string;
  canManage: boolean;
  canCollaborate: boolean;
  logId: string;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const log = useDailyLog(logId);

  if (log.isLoading) return <LoadingState />;
  if (log.isError) {
    return (
      <ErrorState message={t('dailyLogs.loadError')} retryLabel={t('retry')} onRetry={() => log.refetch()} />
    );
  }
  if (!log.data) {
    return (
      <ThemedView style={styles.centered}>
        <EmptyState title={t('dailyLogs.notFound')} />
      </ThemedView>
    );
  }

  const isOwner = log.data.recorded_by !== null && log.data.recorded_by === userId;
  const canEdit = canManage || (canCollaborate && isOwner);

  return (
    <>
      {/* The Figma editor draws its own header; hide the native one. */}
      <Stack.Screen options={{ headerShown: false }} />
      {canEdit ? (
        <DailyLogEditScreen key={log.data.id} circleId={circleId} initial={log.data} />
      ) : (
        <DailyLogViewScreen log={log.data} />
      )}
    </>
  );
}

function DailyLogEditScreen({ circleId, initial }: { circleId: string; initial: DailyCareLog }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const update = useUpdateDailyLog(circleId);
  const del = useDeleteDailyLog(circleId);

  const [draft, setDraft] = useState<DailyLogDraft>(() => dailyLogDraftFromRow(initial));
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { dirty, markSaved } = useUnsavedChanges(draft);
  const submitting = update.isPending;

  function patch(part: Partial<DailyLogDraft>) {
    setDraft((current) => ({ ...current, ...part }));
    if (status !== 'idle') setStatus('idle');
  }

  async function onSubmit() {
    const prepared = prepareDailyLog(draft);
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
      setDeleteError(t('dailyLogs.deleteFailed'));
      setDeleting(false);
    }
  }

  return (
    <FigmaFormScreen
      title={t('dailyLogs.detailTitle')}
      onBack={() => router.back()}
      disclaimer={t('dailyLogs.disclaimer')}>
      <UnsavedChangesGuard when={dirty} />
      <FigmaDailyLogFields draft={draft} onChange={patch} errors={errors} />

      {/* Delete — destructive, separate from save, two-step confirm. */}
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
            label={t('dailyLogs.deleteLog')}
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
            {t('dailyLogs.saved')}
          </Text>
        ) : null}
        {status === 'error' ? (
          <Text style={[styles.statusText, { color: theme.errorFg }]} accessibilityRole="alert">
            {t('dailyLogs.saveFailed')}
          </Text>
        ) : null}
        <FigmaFooterPrimaryButton label={t('common.saveChanges')} onPress={onSubmit} loading={submitting} />
      </View>
    </FigmaFormScreen>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function DailyLogViewScreen({ log }: { log: DailyCareLog }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const details = describeDailyLog(log, t);
  const notes = describeDailyLogNotes(log, t);

  return (
    <FigmaFormScreen title={t('dailyLogs.detailTitle')} onBack={() => router.back()}>
      {/* Calm observational note (no gold banner while viewing) + read-only note. */}
      <FigmaMutedNote>{t('dailyLogs.disclaimer')}</FigmaMutedNote>
      <FigmaMutedNote>{t('dailyLogs.readOnly')}</FigmaMutedNote>

      <FigmaFormCard label={t('dailyLogs.fields.logDate')}>
        <Text style={[styles.rowValue, { color: theme.text }]}>{isolateLtr(log.log_date)}</Text>
      </FigmaFormCard>

      {details.length > 0 ? (
        <FigmaFormCard label={t('dailyLogs.dailyTitle')}>
          {details.map((detail) => (
            <ReadOnlyRow key={detail.key} label={detail.label} value={detail.value} />
          ))}
        </FigmaFormCard>
      ) : null}

      {notes.length > 0 ? (
        <FigmaFormCard>
          {notes.map((detail) => (
            <ReadOnlyRow key={detail.key} label={detail.label} value={detail.value} />
          ))}
        </FigmaFormCard>
      ) : null}

      {details.length === 0 && notes.length === 0 ? (
        <FigmaMutedNote>{t('dailyLogs.notesOnly')}</FigmaMutedNote>
      ) : null}
    </FigmaFormScreen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  footer: { gap: Spacing.two },
  statusText: { fontSize: 14, fontFamily: FontFamily.semibold, textAlign: 'center' },
  confirmRow: { flexDirection: 'row', gap: Spacing.two },
  confirmCol: { flex: 1 },
  row: { gap: 2 },
  rowLabel: { fontSize: 14, fontFamily: FontFamily.semibold },
  rowValue: { fontSize: 16, fontFamily: FontFamily.regular },
});
