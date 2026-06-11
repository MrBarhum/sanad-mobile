import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

// Import the hook directly (not via the providers barrel) to avoid a provider
// import cycle, since this provider is itself composed in the barrel.
import { useAuth } from '@/providers/auth-provider';

import { circleSelectionKeys, fetchUserCircles, type CircleSummary } from './api';
import { toActiveCircle, type ActiveCircle } from './permissions';
import { loadSelectedCircleId, saveSelectedCircleId } from './storage';

type CircleSelectionContextValue = {
  /** Every circle the user is an active member of. */
  circles: CircleSummary[];
  /** The selected circle resolved to its role-aware view, or null. */
  activeCircle: ActiveCircle | null;
  activeCircleId: string | null;
  /** Switch the active circle (validated, persisted, refetches scoped data). */
  setActiveCircle: (circleId: string) => void;
  /**
   * Persist a preferred circle id WITHOUT requiring it to be in the current
   * list yet — used right after joining, before the membership list has
   * refetched. It is honored automatically once the circle appears.
   */
  setPreferredCircleId: (circleId: string) => void;
  /** True only once loaded and the user belongs to zero circles. */
  hasNoCircles: boolean;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

const CircleSelectionContext = createContext<CircleSelectionContextValue | undefined>(undefined);

/**
 * Owns the multi-circle selection layer: loads every active membership for the
 * signed-in user, resolves which one is active (persisted choice if still valid,
 * otherwise the first), persists changes, and refetches circle-scoped data on a
 * switch. Sits inside AuthProvider + QueryProvider.
 */
export function CircleSelectionProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: circleSelectionKeys.list(userId),
    queryFn: () => fetchUserCircles(userId as string),
    enabled: Boolean(userId),
  });

  const circles = useMemo(() => query.data ?? [], [query.data]);

  const [persistedId, setPersistedId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Load the persisted selection once per signed-in user.
  useEffect(() => {
    let mounted = true;
    if (!userId) {
      setPersistedId(null);
      setHydrated(true);
      return;
    }
    setHydrated(false);
    void loadSelectedCircleId(userId).then((id) => {
      if (mounted) {
        setPersistedId(id);
        setHydrated(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, [userId]);

  // Resolve the active circle: the preferred (persisted) choice when it is still
  // an active membership, otherwise the oldest membership, otherwise none. The
  // fallback is purely derived — a stale stored id is ignored, never rewritten,
  // so a just-joined circle preference is honored as soon as it appears in the
  // list (no clobbering). circles[0] is deterministic (ordered by join date),
  // so the default is stable across sessions without persisting it.
  const activeCircleId = useMemo(() => {
    if (circles.length === 0) return null;
    if (persistedId && circles.some((c) => c.circleId === persistedId)) return persistedId;
    return circles[0].circleId;
  }, [circles, persistedId]);

  const setPreferredCircleId = useCallback(
    (circleId: string) => {
      setPersistedId(circleId);
      if (userId) void saveSelectedCircleId(userId, circleId);
    },
    [userId],
  );

  const setActiveCircle = useCallback(
    (circleId: string) => {
      if (circleId === activeCircleId) return;
      if (!circles.some((c) => c.circleId === circleId)) return;
      setPreferredCircleId(circleId);
      // Drop circle-scoped cache so the newly selected circle loads its own
      // data and nothing bleeds across circles. Every circle-scoped query key
      // already includes circle_id, so a broad invalidate is safe and exact.
      void queryClient.invalidateQueries();
    },
    [circles, activeCircleId, setPreferredCircleId, queryClient],
  );

  const activeCircle = useMemo(() => {
    const summary = circles.find((c) => c.circleId === activeCircleId);
    return summary ? toActiveCircle(summary) : null;
  }, [circles, activeCircleId]);

  const value = useMemo<CircleSelectionContextValue>(
    () => ({
      circles,
      activeCircle,
      activeCircleId,
      setActiveCircle,
      setPreferredCircleId,
      hasNoCircles: !query.isLoading && hydrated && circles.length === 0,
      isLoading: (Boolean(userId) && !hydrated) || query.isLoading,
      isError: query.isError,
      refetch: () => {
        void query.refetch();
      },
    }),
    [
      circles,
      activeCircle,
      activeCircleId,
      setActiveCircle,
      setPreferredCircleId,
      query.isLoading,
      query.isError,
      query,
      hydrated,
      userId,
    ],
  );

  return (
    <CircleSelectionContext.Provider value={value}>{children}</CircleSelectionContext.Provider>
  );
}

export function useCircleSelection() {
  const context = useContext(CircleSelectionContext);
  if (context === undefined) {
    throw new Error('useCircleSelection must be used within a CircleSelectionProvider');
  }
  return context;
}
