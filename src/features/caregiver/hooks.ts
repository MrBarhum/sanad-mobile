import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { medicationKeys } from '@/features/medications/api';
import { useTodayDoses } from '@/features/medications/hooks';
import type { DoseItem } from '@/features/medications/today';
import type { CareTask } from '@/features/tasks/api';
import { useTasks } from '@/features/tasks/hooks';
import { useAuth } from '@/providers';
import { ymdFromInstant } from '@/utils/date';

import {
  caregiverKeys,
  createDoseProofSignedUrl,
  decodeBase64,
  doseProofObjectPath,
  extensionForMime,
  recordDose,
  setDoseProofPath,
  uploadDoseProof,
  type DosePhoto,
  type MedicationLogStatus,
} from './api';

/** Sort key for a task's own clock: due time first, undated/untimed last. */
function taskTimeKey(task: CareTask): string {
  return `${task.due_date ?? '9999-99-99'} ${task.due_time ?? '99:99:99'}`;
}

/**
 * The work in front of the hired caregiver right now: the doses she is
 * responsible for today, and the tasks assigned to her.
 *
 * Her RLS already returns ONLY her responsible medications + schedules + logs,
 * so the dose list needs no client-side responsibility filter. Tasks are
 * different: her read policy also admits rows she merely COMPLETED earlier, so
 * they are filtered to `assigned_to === userId` here — otherwise yesterday's
 * finished work would reappear as today's.
 *
 * Both lists come back in plain time order (see `computeDoseItems` for doses).
 */
export function useCaregiverToday(
  circleId: string | undefined,
  userId: string | null,
  date: string,
) {
  const doses = useTodayDoses(circleId, date);
  const tasksQuery = useTasks(circleId);

  const tasks = useMemo<CareTask[]>(() => {
    const all = tasksQuery.data ?? [];
    return all
      .filter((task) => {
        // Hard filter: only work actually assigned to her.
        if (!userId || task.assigned_to !== userId) return false;
        if (task.status === 'open') {
          // Today's, anything already overdue, and undated work she still owns.
          return task.due_date === null || task.due_date <= date;
        }
        // Finished work stays visible for the day she finished it, so the screen
        // can say "everything is done" instead of looking empty.
        const endedAt = task.completed_at ?? task.cancelled_at;
        return Boolean(endedAt) && ymdFromInstant(endedAt as string) === date;
      })
      .sort((a, b) => {
        const byTime = taskTimeKey(a).localeCompare(taskTimeKey(b));
        return byTime !== 0 ? byTime : a.title.localeCompare(b.title);
      });
  }, [tasksQuery.data, userId, date]);

  return {
    doses: doses.doses,
    tasks,
    isLoading: doses.isLoading || tasksQuery.isLoading,
    isError: doses.isError || tasksQuery.isError,
    refetch: () => {
      doses.refetch();
      void tasksQuery.refetch();
    },
  };
}

/**
 * Records one dose and resolves with the new log id — which the photo step then
 * needs, because the proof object path must contain that exact id.
 */
export function useRecordDose(circleId: string, date: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (vars: { dose: DoseItem; status: MedicationLogStatus }) =>
      recordDose({
        circleId,
        medicationId: vars.dose.medicationId,
        scheduleId: vars.dose.scheduleId,
        doseDate: date,
        scheduledTime: vars.dose.scheduledTime,
        status: vars.status,
        recordedBy: user?.id ?? null,
        existingLogId: vars.dose.logId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: medicationKeys.logs(circleId, date) });
    },
  });
}

/**
 * Attaches an already-captured photo to an ALREADY-SAVED dose log: upload the
 * object, then point the row at it. Deliberately a second, separate mutation —
 * the dose must never be lost because a photo failed to send.
 */
export function useAttachDoseProof(circleId: string, date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { logId: string; medicationId: string; photo: DosePhoto }) => {
      const objectPath = doseProofObjectPath({
        circleId,
        medicationId: vars.medicationId,
        logId: vars.logId,
        extension: extensionForMime(vars.photo.mimeType),
      });
      await uploadDoseProof({
        objectPath,
        bytes: decodeBase64(vars.photo.base64),
        contentType: vars.photo.mimeType,
      });
      await setDoseProofPath(vars.logId, objectPath);
      return objectPath;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: medicationKeys.logs(circleId, date) });
    },
  });
}

/** A short-lived signed URL for a stored dose proof (private bucket). */
export function useDoseProofUrl(objectPath: string | null) {
  return useQuery({
    queryKey: caregiverKeys.doseProof(objectPath),
    queryFn: () => createDoseProofSignedUrl(objectPath as string),
    enabled: Boolean(objectPath),
    // Comfortably inside the URL's own lifetime, so a re-render never refetches
    // and a stale URL is never handed to the image.
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
