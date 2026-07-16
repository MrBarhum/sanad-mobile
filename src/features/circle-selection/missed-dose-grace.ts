import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../../../lib/supabase';

/**
 * Per-circle missed-dose grace (minutes) — the wait after a scheduled dose time
 * before the tier-2 "not recorded" alert; the tier-3 manager escalation fires at
 * 2× this. The column + the `set_missed_dose_grace_minutes` RPC ship in the
 * milestone-4 migration and are intentionally NOT in the generated types this
 * phase, so the casts are localized to this file (like the claim flow).
 */

export const DEFAULT_MISSED_DOSE_GRACE = 30;
export const MISSED_DOSE_GRACE_MIN = 5;
export const MISSED_DOSE_GRACE_MAX = 240;
export const MISSED_DOSE_GRACE_STEP = 5;

export const missedDoseGraceKeys = {
  byCircle: (circleId: string | undefined) => ['missed-dose-grace', circleId] as const,
};

/** Reads the circle's current grace (any active member may read care_circles). */
export async function fetchMissedDoseGrace(circleId: string): Promise<number> {
  const { data, error } = await supabase
    .from('care_circles')
    .select('missed_dose_grace_minutes')
    .eq('id', circleId)
    .single();
  if (error) throw error;
  const value = (data as { missed_dose_grace_minutes?: number | null }).missed_dose_grace_minutes;
  return value ?? DEFAULT_MISSED_DOSE_GRACE;
}

/** Sets the circle's grace via the manager-only RPC; returns the clamped value. */
export async function setMissedDoseGrace(circleId: string, minutes: number): Promise<number> {
  const client = supabase as unknown as {
    rpc: (
      name: string,
      params?: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await client.rpc('set_missed_dose_grace_minutes', {
    p_circle_id: circleId,
    p_minutes: minutes,
  });
  if (error) throw error;
  return (data as number | null) ?? minutes;
}

export function useMissedDoseGrace(circleId: string | undefined) {
  return useQuery({
    queryKey: missedDoseGraceKeys.byCircle(circleId),
    queryFn: () => fetchMissedDoseGrace(circleId as string),
    enabled: Boolean(circleId),
  });
}

export function useSetMissedDoseGrace(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (minutes: number) => setMissedDoseGrace(circleId, minutes),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: missedDoseGraceKeys.byCircle(circleId) }),
  });
}
