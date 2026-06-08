import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createDoctor,
  deleteDoctor,
  doctorKeys,
  fetchDoctors,
  updateDoctor,
  type DoctorInput,
} from './api';

/** Lists the circle's doctors. */
export function useDoctors(circleId: string | undefined) {
  return useQuery({
    queryKey: doctorKeys.byCircle(circleId),
    queryFn: () => fetchDoctors(circleId as string),
    enabled: Boolean(circleId),
  });
}

/** Creates a doctor, then refreshes the circle's doctors list. */
export function useCreateDoctor(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DoctorInput) => createDoctor(circleId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: doctorKeys.byCircle(circleId) }),
  });
}

/** Updates a doctor, then refreshes the circle's doctors list. */
export function useUpdateDoctor(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DoctorInput }) => updateDoctor(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: doctorKeys.byCircle(circleId) }),
  });
}

/** Deletes a doctor, then refreshes the circle's doctors list. */
export function useDeleteDoctor(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDoctor(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: doctorKeys.byCircle(circleId) }),
  });
}
