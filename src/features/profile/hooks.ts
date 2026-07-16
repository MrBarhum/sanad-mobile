import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getMyProfile, updateMyName } from './api';

export const profileKeys = {
  all: ['profile'] as const,
  me: (userId: string | undefined) => ['profile', 'me', userId] as const,
};

/** The signed-in user's own profile (name). */
export function useMyProfile(userId: string | undefined) {
  return useQuery({
    queryKey: profileKeys.me(userId),
    queryFn: () => getMyProfile(userId as string),
    enabled: Boolean(userId),
  });
}

/**
 * Updates the current user's display name. On success we refetch the profile AND
 * the circle-members roster, so the new name replaces the old one everywhere the
 * user appears (roster, assignment pickers, Care Pulse).
 */
export function useUpdateMyName(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fullName: string) => updateMyName(userId as string, fullName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.me(userId) });
      queryClient.invalidateQueries({ queryKey: ['circle-members'] });
    },
  });
}
