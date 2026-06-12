import { useCallback, useRef } from 'react';

/**
 * Tracks whether a form's values differ from their last saved baseline.
 *
 * Pass the current form values each render; the hook serializes them (JSON) and
 * compares against the baseline captured on first render. `dirty` is true while
 * the form has unsaved edits. Call `markSaved()` after a successful save so the
 * current values become the new baseline (the form is no longer dirty), and
 * `reset()` to drop edits back to the original baseline.
 *
 * Values must be JSON-serializable (strings, numbers, booleans, arrays, plain
 * objects) — which every form draft in this app is.
 */
export function useUnsavedChanges<T>(values: T): {
  dirty: boolean;
  markSaved: () => void;
  reset: () => void;
} {
  const serialized = JSON.stringify(values);
  const baseline = useRef(serialized);
  const original = useRef(serialized);
  const latest = useRef(serialized);
  latest.current = serialized;

  const markSaved = useCallback(() => {
    baseline.current = latest.current;
  }, []);

  const reset = useCallback(() => {
    baseline.current = original.current;
  }, []);

  return { dirty: serialized !== baseline.current, markSaved, reset };
}
