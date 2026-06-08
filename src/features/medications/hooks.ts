import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '@/providers';
import { todayYmd } from '@/utils/date';

import {
  createMedicationWithSchedule,
  createSchedule,
  deleteMedication,
  deleteSchedule,
  fetchActiveMedications,
  fetchActiveSchedules,
  fetchLogsForDate,
  fetchMedication,
  fetchSchedulesByMedication,
  insertLog,
  medicationKeys,
  setMedicationActive,
  setScheduleActive,
  updateLogStatus,
  updateMedication,
  updateSchedule,
  type MedicationInput,
  type MedicationLogStatus,
  type ScheduleInput,
} from './api';
import { computeDoseItems, summarizeDoses, type DoseItem } from './today';

/** Invalidate every medication-related query (list, schedules, logs, detail). */
function invalidateAll(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: medicationKeys.all });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useActiveMedications(circleId: string | undefined) {
  return useQuery({
    queryKey: medicationKeys.list(circleId),
    queryFn: () => fetchActiveMedications(circleId as string),
    enabled: Boolean(circleId),
  });
}

export function useMedication(id: string | undefined) {
  return useQuery({
    queryKey: medicationKeys.detail(id),
    queryFn: () => fetchMedication(id as string),
    enabled: Boolean(id),
  });
}

export function useActiveSchedules(circleId: string | undefined) {
  return useQuery({
    queryKey: medicationKeys.activeSchedules(circleId),
    queryFn: () => fetchActiveSchedules(circleId as string),
    enabled: Boolean(circleId),
  });
}

export function useSchedulesByMedication(medicationId: string | undefined) {
  return useQuery({
    queryKey: medicationKeys.schedulesByMed(medicationId),
    queryFn: () => fetchSchedulesByMedication(medicationId as string),
    enabled: Boolean(medicationId),
  });
}

export function useLogsForDate(circleId: string | undefined, date: string) {
  return useQuery({
    queryKey: medicationKeys.logs(circleId, date),
    queryFn: () => fetchLogsForDate(circleId as string, date),
    enabled: Boolean(circleId),
  });
}

// ---------------------------------------------------------------------------
// Today's doses (composed, client-side)
// ---------------------------------------------------------------------------

/** Combines active meds + active schedules + logs into the dose list for a date. */
export function useTodayDoses(circleId: string | undefined, date: string) {
  const medications = useActiveMedications(circleId);
  const schedules = useActiveSchedules(circleId);
  const logs = useLogsForDate(circleId, date);

  const doses = useMemo<DoseItem[]>(
    () =>
      computeDoseItems({
        date,
        medications: medications.data ?? [],
        schedules: schedules.data ?? [],
        logs: logs.data ?? [],
      }),
    [date, medications.data, schedules.data, logs.data],
  );

  return {
    doses,
    isLoading: medications.isLoading || schedules.isLoading || logs.isLoading,
    isError: medications.isError || schedules.isError || logs.isError,
    refetch: () => {
      medications.refetch();
      schedules.refetch();
      logs.refetch();
    },
  };
}

/** Today's dose counts for the Home dashboard summary. */
export function useTodayDoseSummary(circleId: string | undefined) {
  const date = todayYmd();
  const { doses, isLoading, isError } = useTodayDoses(circleId, date);
  return { summary: summarizeDoses(doses), isLoading, isError };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateMedication(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { medication: MedicationInput; schedule: ScheduleInput }) =>
      createMedicationWithSchedule(circleId, vars.medication, vars.schedule),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUpdateMedication(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: MedicationInput }) =>
      updateMedication(vars.id, vars.patch),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useSetMedicationActive(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; isActive: boolean }) =>
      setMedicationActive(vars.id, vars.isActive),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDeleteMedication(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMedication(id),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useCreateSchedule(circleId: string, medicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (schedule: ScheduleInput) => createSchedule(circleId, medicationId, schedule),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUpdateSchedule(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; schedule: ScheduleInput }) =>
      updateSchedule(vars.id, vars.schedule),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useSetScheduleActive(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; isActive: boolean }) =>
      setScheduleActive(vars.id, vars.isActive),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDeleteSchedule(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: () => invalidateAll(queryClient),
  });
}

/**
 * Records or changes the outcome of a single dose. Inserts a new log when the
 * dose has none yet, otherwise updates the existing log (avoiding the partial
 * unique index on schedule_id+dose_date+scheduled_time). Only the date's logs
 * query is invalidated, so the today list refreshes without refetching meds.
 */
export function useLogDose(circleId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (vars: { dose: DoseItem; status: MedicationLogStatus; date: string }) => {
      const recordedBy = user?.id ?? null;
      if (vars.dose.logId) {
        await updateLogStatus(vars.dose.logId, vars.status, recordedBy, new Date().toISOString());
      } else {
        await insertLog({
          circleId,
          medicationId: vars.dose.medicationId,
          scheduleId: vars.dose.scheduleId,
          doseDate: vars.date,
          scheduledTime: vars.dose.scheduledTime,
          status: vars.status,
          recordedBy,
        });
      }
    },
    onSuccess: (_data, vars) =>
      queryClient.invalidateQueries({ queryKey: medicationKeys.logs(circleId, vars.date) }),
  });
}
