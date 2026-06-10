import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/providers';

import type { DailyCareLog } from './api';
import { describeDailyLog, describeDailyLogNotes } from './describe';
import { useDeleteDailyLog, useDailyLog, useUpdateDailyLog } from './hooks';
import {
  DailyLogFieldset,
  dailyLogDraftFromRow,
  prepareDailyLog,
  type DailyLogDraft,
} from './log-fields';

const SUCCESS = '#16a34a';
const DANGER = '#dc2626';

/** Loads a daily log, then renders the view/edit screen with a delete action. */
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
      <ErrorState
        message={t('dailyLogs.loadError')}
        retryLabel={t('retry')}
        onRetry={() => log.refetch()}
      />
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
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {canEdit ? (
          <DailyLogEditFields key={log.data.id} circleId={circleId} initial={log.data} />
        ) : (
          <ReadOnlyLog log={log.data} />
        )}

        {canEdit ? <DeleteLogRow circleId={circleId} id={log.data.id} /> : null}
      </ScrollView>
    </ThemedView>
  );
}

function DailyLogEditFields({ circleId, initial }: { circleId: string; initial: DailyCareLog }) {
  const { t } = useTranslation();
  const update = useUpdateDailyLog(circleId);

  const [draft, setDraft] = useState<DailyLogDraft>(() => dailyLogDraftFromRow(initial));
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

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
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <View style={styles.fields}>
      <DailyLogFieldset draft={draft} onChange={patch} errors={errors} />

      {status === 'saved' ? (
        <ThemedText style={[styles.statusText, { color: SUCCESS }]} accessibilityRole="alert">
          {t('dailyLogs.saved')}
        </ThemedText>
      ) : null}
      {status === 'error' ? (
        <ThemedText style={[styles.statusText, { color: DANGER }]} accessibilityRole="alert">
          {t('dailyLogs.saveFailed')}
        </ThemedText>
      ) : null}

      <Button
        label={t('dailyLogs.saveLog')}
        onPress={onSubmit}
        loading={submitting}
        disabled={submitting}
      />
    </View>
  );
}

function ReadOnlyLog({ log }: { log: DailyCareLog }) {
  const { t } = useTranslation();
  const details = describeDailyLog(log, t);
  const notes = describeDailyLogNotes(log, t);

  return (
    <View style={styles.fields}>
      <ThemedView type="backgroundElement" style={styles.notice}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('dailyLogs.readOnly')}
        </ThemedText>
      </ThemedView>
      <ThemedText style={styles.readName}>{log.log_date}</ThemedText>
      {details.map((detail) => (
        <InfoRow key={detail.key} label={detail.label} value={detail.value} />
      ))}
      {notes.map((detail) => (
        <InfoRow key={detail.key} label={detail.label} value={detail.value} />
      ))}
      {details.length === 0 && notes.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('dailyLogs.notesOnly')}
        </ThemedText>
      ) : null}
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

function DeleteLogRow({ circleId, id }: { circleId: string; id: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const del = useDeleteDailyLog(circleId);
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
    <Button variant="danger" label={t('dailyLogs.deleteLog')} onPress={() => setConfirming(true)} />
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
  statusText: { fontSize: 14, fontWeight: '600' },
  confirmRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
});
