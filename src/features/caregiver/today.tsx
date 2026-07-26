import { useRouter } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { FigmaBottomSheet } from '@/components/figma/figma-bottom-sheet';
import { FigmaListRow } from '@/components/figma/figma-list-row';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { GlyphChip } from '@/components/glyph-chip';
import { isolateLtr } from '@/components/ltr-text';
import { SectionHeader } from '@/components/section-header';
import { SkeletonList } from '@/components/skeleton';
import { EmptyState } from '@/components/states';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Surface } from '@/components/surface';
import { BorderWidth, FontFamily, Radius } from '@/constants/theme';
import type { MedicationLogStatus } from '@/features/medications/api';
import type { DoseItem } from '@/features/medications/today';
import { deactivatePushToken } from '@/features/notifications/api';
import { getRememberedToken } from '@/features/notifications/hooks';
import type { CareTask } from '@/features/tasks/api';
import { useCancelTask, useCompleteTask } from '@/features/tasks/hooks';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers';
import { confirmAction } from '@/utils/confirm';
import { formatHm, formatLongDate, todayYmd } from '@/utils/date';

import { supabase } from '../../../lib/supabase';

import { DoseRecordSheet } from './dose-record';
import { useCaregiverToday } from './hooks';

/** Dose status → the calm status-pill tone. Never color alone — the pill also
 *  carries a tone icon and the Arabic status word. */
const DOSE_TONE: Record<MedicationLogStatus, StatusTone> = {
  given: 'success',
  postponed: 'warning',
  missed: 'error',
};

type TaskAction = 'complete' | 'cancel';
type TaskConfirm = { task: CareTask; kind: TaskAction };

/**
 * «اليوم» — the hired caregiver's ONE screen.
 *
 * It shows only the work in front of her: the doses she is responsible for and
 * the tasks assigned to her, in plain time order, each completable in one tap;
 * the emergency card (she is the person who would have to call); quiet entries
 * to record a wellbeing note or a vital reading; and sign-out, because she has
 * no Account tab.
 *
 * What it deliberately does NOT do is as important: no score, no percentage, no
 * ranking, no streak, no shift or attendance, no location. The screen informs
 * her, it does not measure her.
 */
export function CaregiverToday({
  circleId,
  recipientName,
}: {
  circleId: string;
  recipientName: string | null;
}) {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const date = todayYmd();

  const today = useCaregiverToday(circleId, userId, date);
  const complete = useCompleteTask(circleId);
  const cancel = useCancelTask(circleId);

  const [doseToRecord, setDoseToRecord] = useState<DoseItem | null>(null);
  const [taskConfirm, setTaskConfirm] = useState<TaskConfirm | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const doses = today.doses;
  const tasks = today.tasks;
  const hasWork = doses.length + tasks.length > 0;
  const allDone =
    hasWork &&
    doses.every((dose) => dose.status !== null) &&
    tasks.every((task) => task.status !== 'open');

  async function runTaskAction() {
    if (!taskConfirm) return;
    setTaskError(null);
    try {
      if (taskConfirm.kind === 'complete') await complete.mutateAsync(taskConfirm.task.id);
      else await cancel.mutateAsync(taskConfirm.task.id);
      setTaskConfirm(null);
    } catch {
      // Never revert silently — say what happened and what to do.
      setTaskError(t('caregiver.today.saveError'));
    }
  }

  // Signing out ends the session and stops this device's reminders: guarded by
  // the lightweight confirm, exactly as the family Account screen does.
  function onSignOut() {
    confirmAction(
      {
        title: t('account.confirmSignOutTitle'),
        message: t('account.confirmSignOutMessage'),
        confirm: t('account.signOut'),
        cancel: t('common.cancel'),
      },
      () => {
        void doSignOut();
      },
      { destructive: true },
    );
  }

  async function doSignOut() {
    setSignOutError(null);
    setSigningOut(true);
    const token = getRememberedToken();
    if (token) {
      try {
        await deactivatePushToken(token);
      } catch {
        // Best-effort: a stale token is invalidated server-side on re-register.
      }
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSignOutError(t('account.signOutError'));
      setSigningOut(false);
    }
  }

  // The band: the recipient's name and today's date. Deliberately WITHOUT the
  // family Home band's furniture — no circle switcher, no bell, no gold badge.
  const band = (
    <View style={[styles.band, { backgroundColor: c.band, paddingTop: insets.top + 22 }]}>
      <Text
        style={[styles.bandTitle, { color: c.bandInk }]}
        accessibilityRole="header"
        numberOfLines={1}>
        {recipientName?.trim() || t('caregiver.today.title')}
      </Text>
      <Text style={[styles.bandSubtitle, { color: c.bandInk }]} numberOfLines={1}>
        {formatLongDate(i18n.language)}
      </Text>
    </View>
  );

  return (
    <FigmaScreen band={band} contentGutter={16} gap={16}>
      {/* Emergency — restrained danger tone: an err-bordered card, never alarm
          styling. She is the person who would have to call. */}
      <Surface padded={0} style={{ borderColor: c.errorFg }}>
        <FigmaListRow
          iconName="emergency"
          tone="error"
          title={t('caregiver.today.emergency')}
          onPress={() => router.push('/emergency-card')}
        />
      </Surface>

      {today.isError ? (
        <Surface style={styles.errorCard}>
          <Text style={[styles.errorText, { color: c.text }]} accessibilityRole="alert">
            {t('caregiver.today.loadError')}
          </Text>
          <Button label={t('retry')} variant="secondary" onPress={() => today.refetch()} />
        </Surface>
      ) : today.isLoading ? (
        <SkeletonList count={3} />
      ) : (
        <>
          {!hasWork ? (
            <EmptyState
              iconName="success"
              title={t('caregiver.today.emptyTitle')}
              subtitle={t('caregiver.today.emptySubtitle')}
            />
          ) : allDone ? (
            <EmptyState
              iconName="success"
              title={t('caregiver.today.allDoneTitle')}
              subtitle={t('caregiver.today.allDoneSubtitle')}
            />
          ) : null}

          {taskError ? (
            <Text
              style={[styles.alert, { color: c.errorFg }]}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite">
              {taskError}
            </Text>
          ) : null}

          {doses.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title={t('caregiver.today.dosesTitle')} />
              <Surface padded={0}>
                {doses.map((dose, index) => (
                  <DoseRow
                    key={dose.key}
                    dose={dose}
                    first={index === 0}
                    onRecord={() => setDoseToRecord(dose)}
                  />
                ))}
              </Surface>
            </View>
          ) : null}

          {tasks.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title={t('caregiver.today.tasksTitle')} />
              <Surface padded={0}>
                {tasks.map((task, index) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    first={index === 0}
                    onComplete={() => setTaskConfirm({ task, kind: 'complete' })}
                    onCannotDo={() => setTaskConfirm({ task, kind: 'cancel' })}
                  />
                ))}
              </Surface>
            </View>
          ) : null}
        </>
      )}

      {/* She is the person present, so recording a wellbeing note or a reading
          is hers to do. Quiet entries — never a nag, never a quota. */}
      <Surface padded={0}>
        <FigmaListRow
          iconName="dailyLog"
          tone="primary"
          title={t('caregiver.today.addLog')}
          onPress={() => router.push('/daily-logs/new')}
        />
        <FigmaListRow
          iconName="vital"
          tone="success"
          topDivider
          title={t('caregiver.today.addVital')}
          onPress={() => router.push('/vitals/new')}
        />
      </Surface>

      <View style={styles.signOutBlock}>
        {signOutError ? (
          <Text
            style={[styles.alert, { color: c.errorFg }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite">
            {signOutError}
          </Text>
        ) : null}
        <Button
          variant="danger"
          label={t('account.signOut')}
          iconName="signOut"
          loading={signingOut}
          disabled={signingOut}
          onPress={onSignOut}
        />
      </View>

      <DoseRecordSheet
        circleId={circleId}
        date={date}
        dose={doseToRecord}
        onClose={() => setDoseToRecord(null)}
      />
      <TaskConfirmSheet
        confirm={taskConfirm}
        pending={complete.isPending || cancel.isPending}
        onConfirm={() => void runTaskAction()}
        onClose={() => setTaskConfirm(null)}
      />
    </FigmaScreen>
  );
}

/**
 * One dose. Two states only: due (a full-width primary action that opens the
 * record sheet) and logged (a calm status pill). The action spans the row so the
 * target is unmissable for someone working with one hand.
 */
function DoseRow({
  dose,
  first,
  onRecord,
}: {
  dose: DoseItem;
  first: boolean;
  onRecord: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const detail = [dose.dosage, dose.instructions].filter(Boolean).join('  ·  ');

  return (
    <View
      style={[
        styles.row,
        !first && { borderTopWidth: BorderWidth.standard, borderTopColor: c.border },
      ]}>
      <View style={styles.rowHead}>
        <GlyphChip iconName="medication" tone="primary" size="md" />
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={2}>
            {dose.medicationName}
          </Text>
          {detail ? (
            <Text style={[styles.rowMeta, { color: c.textSecondary }]} numberOfLines={2}>
              {detail}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.rowTime, { color: c.text }]}>
          {isolateLtr(formatHm(dose.scheduledTime))}
        </Text>
      </View>

      {dose.status ? (
        <StatusBadge
          tone={DOSE_TONE[dose.status]}
          label={t(`medications.status.${dose.status}`)}
          style={styles.rowBadge}
        />
      ) : (
        <Button
          label={t('caregiver.today.give')}
          accessibilityLabel={`${t('caregiver.today.give')} — ${dose.medicationName}`}
          iconName="medication"
          onPress={onRecord}
        />
      )}
    </View>
  );
}

/** One task assigned to her: a large checkbox circle, the title, its due time,
 *  and an end-aligned «تعذّر الإنجاز» square. Both actions confirm in a sheet. */
function TaskRow({
  task,
  first,
  onComplete,
  onCannotDo,
}: {
  task: CareTask;
  first: boolean;
  onComplete: () => void;
  onCannotDo: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();

  const isDone = task.status === 'completed';
  const isCancelled = task.status === 'cancelled';
  const isOpen = task.status === 'open';
  const due = task.due_time ? formatHm(task.due_time) : task.due_date;

  const circleStyle = [
    styles.checkCircle,
    {
      borderColor: isDone ? c.successFg : isCancelled ? c.errorFg : c.border,
      backgroundColor: isDone ? c.successBg : isCancelled ? c.errorBg : c.backgroundElement,
    },
  ];
  const mark = isDone ? (
    <Check size={18} color={c.successFg} strokeWidth={2.8} />
  ) : isCancelled ? (
    <X size={18} color={c.errorFg} strokeWidth={2.6} />
  ) : null;

  return (
    <View
      style={[
        styles.taskRow,
        !first && { borderTopWidth: BorderWidth.standard, borderTopColor: c.border },
      ]}>
      {isOpen ? (
        <Pressable
          onPress={onComplete}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: false }}
          accessibilityLabel={t('caregiver.today.markDone')}
          accessibilityHint={task.title}
          android_ripple={{ color: c.backgroundSelected, borderless: true }}
          style={styles.checkTarget}>
          <View style={circleStyle}>{mark}</View>
        </Pressable>
      ) : (
        <View style={styles.checkTarget} pointerEvents="none">
          <View style={circleStyle}>{mark}</View>
        </View>
      )}

      <View style={styles.rowText}>
        <Text
          style={[styles.rowTitle, { color: c.text }, isDone && styles.titleDone]}
          numberOfLines={2}>
          {task.title}
        </Text>
        {isOpen ? (
          due ? (
            <Text style={[styles.rowMeta, { color: c.textSecondary }]}>{isolateLtr(due)}</Text>
          ) : null
        ) : (
          <StatusBadge
            tone={isDone ? 'success' : 'error'}
            label={t(isDone ? 'tasks.status.completed' : 'tasks.status.cancelled')}
            style={styles.rowBadge}
          />
        )}
      </View>

      {isOpen ? (
        <Pressable
          onPress={onCannotDo}
          accessibilityRole="button"
          accessibilityLabel={t('caregiver.today.cannotDo')}
          accessibilityHint={task.title}
          android_ripple={{ color: c.backgroundSelected }}
          style={[styles.cannotSquare, { borderColor: c.border, backgroundColor: c.backgroundElement }]}>
          <X size={18} color={c.errorFg} strokeWidth={2.6} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The sanctioned bottom-sheet confirm for a task's one-tap action. A retained
 *  snapshot keeps the copy correct while the sheet slides out. */
function TaskConfirmSheet({
  confirm,
  pending,
  onConfirm,
  onClose,
}: {
  confirm: TaskConfirm | null;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  // The last non-null confirm is retained so the copy stays correct while the
  // sheet slides out (iOS keeps the modal mounted through the dismiss
  // animation). Adjusted during render — React's documented pattern for
  // deriving state from a prop, and cheaper than a cascading effect.
  const [shown, setShown] = useState<TaskConfirm | null>(confirm);
  if (confirm !== null && confirm !== shown) setShown(confirm);

  const isComplete = shown?.kind === 'complete';

  return (
    <FigmaBottomSheet
      visible={confirm !== null}
      onClose={onClose}
      title={t(isComplete ? 'tasks.confirmCompleteTitle' : 'tasks.confirmUnableTitle')}>
      <Text style={[styles.sheetBody, { color: c.textSecondary }]}>
        {t(isComplete ? 'tasks.confirmCompleteBody' : 'tasks.confirmUnableBody')}
      </Text>
      <View style={[styles.sheetChip, { borderColor: c.border, backgroundColor: c.backgroundSunken }]}>
        <Text style={[styles.sheetChipText, { color: c.text }]} numberOfLines={3}>
          {shown?.task.title ?? ''}
        </Text>
      </View>
      <Button
        label={t(isComplete ? 'caregiver.today.markDone' : 'caregiver.today.cannotDo')}
        variant={isComplete ? 'primary' : 'danger'}
        loading={pending}
        disabled={pending}
        onPress={onConfirm}
      />
      <Button
        label={t('common.cancel')}
        variant="secondary"
        disabled={pending}
        onPress={onClose}
      />
    </FigmaBottomSheet>
  );
}

const styles = StyleSheet.create({
  // Band — the FigmaTabBand spec, composed locally so it can carry the
  // recipient's name as the title and today's date as the subtitle.
  band: { paddingHorizontal: 18, paddingBottom: 16, gap: 3 },
  bandTitle: { fontSize: 24, fontFamily: FontFamily.bold, lineHeight: 34 },
  bandSubtitle: { fontSize: 16, fontFamily: FontFamily.medium, opacity: 0.85 },

  section: { gap: 8 },
  errorCard: { gap: 12, paddingVertical: 20, paddingHorizontal: 16 },
  errorText: { fontSize: 16, fontFamily: FontFamily.bold, textAlign: 'center', lineHeight: 26 },
  alert: { fontSize: 14, fontFamily: FontFamily.semibold, lineHeight: 22 },

  // Dose row
  row: { padding: 14, gap: 12 },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: 16, fontFamily: FontFamily.bold, lineHeight: 26 },
  rowMeta: { fontSize: 14, fontFamily: FontFamily.medium, lineHeight: 22 },
  rowTime: { fontSize: 16, fontFamily: FontFamily.bold, writingDirection: 'ltr', flexShrink: 0 },
  rowBadge: { marginTop: 2 },

  // Task row
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 10, minHeight: 64 },
  checkTarget: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    borderWidth: BorderWidth.standard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleDone: { textDecorationLine: 'line-through' },
  cannotSquare: {
    width: 44,
    height: 44,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  signOutBlock: { gap: 8, marginTop: 4 },

  // Task confirm sheet
  sheetBody: { fontSize: 16, fontFamily: FontFamily.medium, lineHeight: 26, textAlign: 'center' },
  sheetChip: {
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sheetChipText: { fontSize: 16, fontFamily: FontFamily.bold, textAlign: 'center', lineHeight: 26 },
});
