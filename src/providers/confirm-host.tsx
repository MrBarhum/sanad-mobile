import { createContext, useContext, useEffect, useId, type ReactNode } from 'react';

/**
 * The outlet registry behind the confirmation sheet.
 *
 * This lives apart from `confirm-provider.tsx` on purpose: `FigmaBottomSheet` and
 * `FormModal` both render a {@link ConfirmOutlet}, and the provider renders the
 * sheet using `FigmaBottomSheet`. Keeping the registry here breaks what would
 * otherwise be an import cycle between the provider and the primitives it uses.
 */

export type ConfirmHost = {
  register: (id: string) => () => void;
  topId: string | null;
  sheet: ReactNode;
};

export const ConfirmHostContext = createContext<ConfirmHost | null>(null);

/** True inside the confirm sheet's own subtree — stops an outlet hosting itself. */
export const InsideConfirmContext = createContext(false);

/**
 * Where the confirmation sheet is allowed to render. The provider mounts one at the
 * root; every component that opens a `Modal` of its own mounts another as its last
 * child. Only the most recently registered outlet renders, so the sheet always
 * mounts INSIDE whichever modal is currently on top.
 *
 * That placement is load-bearing on two platforms:
 *
 * - **iOS** presents a Modal from its nearest view controller. A root-mounted sheet
 *   would ask a controller that is already presenting a form; UIKit refuses, and the
 *   confirmation silently never appears. For `dose-record`, whose own comment calls
 *   its confirm "the ONE exit", that would leave the sheet with no way out.
 * - **Web** appends the modal's portal div to `document.body` at mount and gives it
 *   no `z-index`, so stacking is DOM order. A root-mounted sheet is appended at app
 *   boot and therefore renders *underneath* every form it is meant to interrupt.
 *
 * Android stacks dialog windows correctly either way. Nesting the sheet inside the
 * topmost modal is the single arrangement all three platforms handle.
 */
export function ConfirmOutlet() {
  const host = useContext(ConfirmHostContext);
  const insideConfirm = useContext(InsideConfirmContext);
  const id = useId();
  const register = host?.register;

  useEffect(() => {
    // The sheet is itself a FigmaBottomSheet and so contains an outlet. Without this
    // guard it would register as topmost and try to host itself — an endless loop.
    if (!register || insideConfirm) return;
    return register(id);
  }, [register, id, insideConfirm]);

  if (!host || insideConfirm) return null;
  return host.topId === id ? host.sheet : null;
}
