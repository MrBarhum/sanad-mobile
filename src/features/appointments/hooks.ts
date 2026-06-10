import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { countAppointmentsToday } from '@/features/care-activity/today';
import { useAuth } from '@/providers';
import { todayYmd } from '@/utils/date';

import {
  appointmentKeys,
  createAppointment,
  deleteAppointment,
  fetchAppointment,
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

export function useDeleteAppointment(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAppointment(id),
    onSuccess: () => invalidateAll(queryClient),
  });
}
