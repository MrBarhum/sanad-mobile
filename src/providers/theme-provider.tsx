import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';

import { loadThemePreference, saveThemePreference, type ThemePreference } from './theme-storage';

type ThemePreferenceContextValue = {
  /** The user's choice: `light`, `dark`, or `system` (follow the OS). */
  preference: ThemePreference;
  /** Set + persist the choice; takes effect immediately across the app. */
  setPreference: (preference: ThemePreference) => void;
};

// Default = follow the system, and a no-op setter, so `useTheme()` still resolves
// even if a component somehow renders outside the provider (it never crashes).
const ThemePreferenceContext = createContext<ThemePreferenceContextValue>({
  preference: 'system',
  setPreference: () => {},
});

export function useThemePreference(): ThemePreferenceContextValue {
  return useContext(ThemePreferenceContext);
}

/**
 * Holds the app-wide appearance preference and feeds the SINGLE theme-resolution
 * path (`useTheme` / `useResolvedScheme`) — this is not a second theming mechanism,
 * it only supplies the override the existing resolver already consults. Loads the
 * persisted choice once on mount (default `system` until it resolves), and persists
 * every change. Sits high in the provider tree so both the nav container theme and
 * every screen read the same value.
 */
export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const [preference, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    let alive = true;
    void loadThemePreference().then((stored) => {
      if (alive && stored) setPref(stored);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPref(next);
    void saveThemePreference(next);
  }, []);

  return (
    <ThemePreferenceContext.Provider value={{ preference, setPreference }}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export type { ThemePreference };
