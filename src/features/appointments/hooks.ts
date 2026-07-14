import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { countAppointmentsToday } from '@/features/care-activity/today';
import { setAssignedAppointmentOutcome } from '@/features/claiming/api';
import { useAuth } from '@/providers';
import { todayYmd } from '@/utils/date';

import {
  appointmentKeys,
  createAppointment,
  deleteAppointment,
  fetchAppointment,
  fetchCompletedAppointments,
  fetchUpcomingAppointments,
  setAppointmentStatus,
  updateAppointment,
  type AppointmentInput,
  type AppointmentStatus,
} from './api';

/** Invalidate every appointment query (upcoming, detail) after a mutation. */
function invalidateAll(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useUpcomingAppointments(circleId: string | undefined) {
  return useQuery({
    queryKey: appointmentKeys.upcoming(circleId),
    queryFn: () => fetchUpcomingAppointments(circleId as string),
    enabled: Boolean(circleId),
  });
}

export function useAppointment(id: string | undefined) {
  return useQuery({
    queryKey: appointmentKeys.detail(id),
    queryFn: () => fetchAppointment(id as string),
    enabled: Boolean(id),
  });
}

/**
 * Completed appointments (all dates, newest first). Backs the "completed" tab so
 * it can show past history — the upcoming query is future-only. Lazily enabled so
 * we only fetch it once the user actually opens that tab.
 */
export function useCompletedAppointments(circleId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: appointmentKeys.completed(circleId),
    queryFn: () => fetchCompletedAppointments(circleId as string),
    enabled: Boolean(circleId) && enabled,
  });
}

/** Today's appointment count for the Home dashboard card. */
export function useTodayAppointmentSummary(circleId: string | undefined) {
  const appointments = useUpcomingAppointments(circleId);
  const count = useMemo(
    () => countAppointmentsToday(appointments.data ?? [], todayYmd()),
    [appointments.data],
  );
  return { count, isLoading: appointments.isLoading, isError: appointments.isError };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateAppointment(circleId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: AppointmentInput) =>
      createAppointment(circleId, { ...input, created_by: user?.id ?? null }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUpdateAppointment(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: AppointmentInput }) =>
      updateAppointment(vars.id, vars.patch),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useSetAppointmentStatus(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; status: AppointmentStatus }) =>
      setAppointmentStatus(vars.id, vars.status),
    onSuccess: () => invalidateAll(queryClient),
  });
}

/**
 * Records a scheduled appointment's outcome (completed / cancelled) through the
 * `set_assigned_appointment_outcome` RPC. Server-side this allows a manager OR the
 * assigned member and writes only the status — so an assigned family member can
 * mark the outcome without permission to edit appointment details. Reopening
 * (back to scheduled) stays on the manager-only direct update above.
 */
export function useSetAppointmentOutcome(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; status: 'completed' | 'cancelled' }) =>
      setAssignedAppointmentOutcome(vars.id, vars.status),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDeleteAppointment(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAppointment(id),
    onSuccess: () => invalidateAll(queryClient),
  });
}
