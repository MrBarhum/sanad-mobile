import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createEmergencyContact,
  deleteEmergencyContact,
  emergencyContactKeys,
  fetchEmergencyContacts,
  updateEmergencyContact,
  type EmergencyContactInput,
} from './api';

/** Lists the circle's emergency contacts. */
export function useEmergencyContacts(circleId: string | undefined) {
  return useQuery({
    queryKey: emergencyContactKeys.byCircle(circleId),
    queryFn: () => fetchEmergencyContacts(circleId as string),
    enabled: Boolean(circleId),
  });
}

/** Creates a contact, then refreshes the circle's contacts list. */
export function useCreateEmergencyContact(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EmergencyContactInput) => createEmergencyContact(circleId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: emergencyContactKeys.byCircle(circleId) }),
  });
}

/** Updates a contact, then refreshes the circle's contacts list. */
export function useUpdateEmergencyContact(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: EmergencyContactInput }) =>
      updateEmergencyContact(circleId, id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: emergencyContactKeys.byCircle(circleId) }),
  });
}

/** Deletes a contact, then refreshes the circle's contacts list. */
export function useDeleteEmergencyContact(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEmergencyContact(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: emergencyContactKeys.byCircle(circleId) }),
  });
}
