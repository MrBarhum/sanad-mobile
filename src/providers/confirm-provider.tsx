import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FigmaBottomSheet } from '@/components/figma/figma-bottom-sheet';
import { isolateLtr } from '@/components/ltr-text';
import { ThemedText } from '@/components/themed-text';
import { BorderWidth, FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import {
  ConfirmHostContext,
  ConfirmOutlet,
  InsideConfirmContext,
  type ConfirmHost,
} from './confirm-host';

/**
 * The copy a confirmation shows. Every string is an i18n value supplied by the
 * caller — this module never holds user-facing text of its own.
 */
export type ConfirmCopy = {
  title: string;
  message: string;
  confirm: string;
  cancel: string;
  /**
   * Optional subject — the task title, the member's name — rendered in a sunken
   * bordered chip so the user can see exactly what they are acting on. Passed
   * through `isolateLtr`, so a Latin name inside Arabic copy stays readable.
   */
  detail?: string;
  /**
   * Shown as an `accessibilityRole="alert"` if an async `onConfirm` rejects. The
   * sheet stays open so the user can retry. Required by the standing rule that
   * every mutation surfaces its failure rather than reverting silently.
   */
  failureMessage?: string;
};

export type ConfirmFn = (
  copy: ConfirmCopy,
  onConfirm: () => void | Promise<void>,
  opts?: { destructive?: boolean },
) => void;

type ConfirmRequest = {
  copy: ConfirmCopy;
  run: () => void | Promise<void>;
  destructive: boolean;
};

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * The one way to ask the user "are you sure?".
 *
 * Returns a function with the same shape the old imperative `confirmAction` had —
 * copy in, continuation in, nothing out — so a call site reads exactly as it did
 * before. The continuation is captured when the user taps, inside the handler, over
 * the values they actually saw, so there is no stale-closure exposure. The returned
 * identity is stable for the life of the app and is safe in `useEffect` deps.
 */
export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error('useConfirm must be used inside <ConfirmProvider>');
  }
  return confirm;
}

/** «تجاهل التغييرات؟» — a {@link useConfirm} pre-set to the destructive tone. */
export function useConfirmDiscard(): (copy: ConfirmCopy, onConfirm: () => void) => void {
  const confirm = useConfirm();
  return useCallback(
    (copy: ConfirmCopy, onConfirm: () => void) => confirm(copy, onConfirm, { destructive: true }),
    [confirm],
  );
}

/**
 * Hosts the app's single confirmation sheet.
 *
 * Sanad shows confirmations in its own Dar bottom sheet, never in an OS dialog. A
 * platform dialog breaks the identity at the one moment the user is most anxious —
 * system font instead of Cairo, no 2px border, no control over button order under
 * RTL, no calm-danger tone — and on react-native-web `window.confirm` blocks the JS
 * thread outright, which makes an unattended browser QA pass impossible.
 *
 * This is a state module, not a second sheet primitive: the chrome is
 * {@link FigmaBottomSheet} and the actions are {@link Button}, both unchanged.
 */
export function ConfirmProvider({ children }: PropsWithChildren) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [outlets, setOutlets] = useState<readonly string[]>([]);
  const pendingRef = useRef(false);

  const confirm = useCallback<ConfirmFn>((copy, onConfirm, opts) => {
    // A second request while one is resolving is dropped rather than queued: the
    // first is mid-mutation and replacing it would strand that work.
    if (pendingRef.current) return;
    setFailure(null);
    // NOTE: the request MUST be stored as an object. Passing the continuation
    // straight to setState would be read as a functional update and React would
    // call it immediately — firing the action without asking.
    setRequest({ copy, run: onConfirm, destructive: opts?.destructive ?? false });
  }, []);

  const register = useCallback((id: string) => {
    setOutlets((prev) => (prev.includes(id) ? prev : [...prev, id]));
    return () => setOutlets((prev) => prev.filter((entry) => entry !== id));
  }, []);

  const close = useCallback(() => {
    // Backdrop and hardware back are inert while the action is running, so a stray
    // tap cannot dismiss the sheet and leave the mutation to finish invisibly.
    if (pendingRef.current) return;
    setRequest(null);
    setFailure(null);
  }, []);

  const accept = useCallback(async () => {
    if (!request || pendingRef.current) return;
    const result = request.run();
    if (!(result instanceof Promise)) {
      setRequest(null);
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setFailure(null);
    try {
      await result;
      setRequest(null);
    } catch {
      setFailure(request.copy.failureMessage ?? null);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, [request]);

  // Mounted conditionally rather than toggled with `visible`. On web an RN Modal
  // appends its portal div to document.body when it MOUNTS and positions it with no
  // z-index, so stacking is DOM order — a permanently-mounted sheet would claim the
  // bottom-most slot for the life of the app and render underneath every form it is
  // meant to interrupt. The cost is the slide-out animation on close.
  const sheet = request ? (
    <InsideConfirmContext.Provider value>
      <ConfirmSheet
        request={request}
        pending={pending}
        failure={failure}
        onClose={close}
        onAccept={accept}
      />
    </InsideConfirmContext.Provider>
  ) : null;

  const host = useMemo<ConfirmHost>(
    () => ({ register, topId: outlets.length > 0 ? outlets[outlets.length - 1] : null, sheet }),
    [register, outlets, sheet],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      <ConfirmHostContext.Provider value={host}>
        {children}
        <ConfirmOutlet />
      </ConfirmHostContext.Provider>
    </ConfirmContext.Provider>
  );
}

function ConfirmSheet({
  request,
  pending,
  failure,
  onClose,
  onAccept,
}: {
  request: ConfirmRequest;
  pending: boolean;
  failure: string | null;
  onClose: () => void;
  onAccept: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const { copy, destructive } = request;

  return (
    <FigmaBottomSheet
      visible
      onClose={onClose}
      title={copy.title}
      dismissLabel={copy.cancel}
      titleAlign="center">
      <ThemedText style={styles.message}>{copy.message}</ThemedText>

      {copy.detail ? (
        <View style={[styles.detail, { backgroundColor: c.backgroundSunken, borderColor: c.border }]}>
          <ThemedText style={styles.detailText} numberOfLines={3}>
            {isolateLtr(copy.detail)}
          </ThemedText>
        </View>
      ) : null}

      {failure ? (
        <ThemedText
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[styles.failure, { color: c.errorFg }]}>
          {failure}
        </ThemedText>
      ) : null}

      {/* Vertical stack, action above cancel. A horizontal row would flip its
          start/end under forceRTL and make the reading order ambiguous; stacked
          reads top-to-bottom identically in both directions. */}
      <View style={styles.actions}>
        <Button
          label={copy.confirm}
          onPress={onAccept}
          variant={destructive ? 'danger' : 'primary'}
          iconName={destructive ? 'warning' : undefined}
          loading={pending}
        />
        <Button
          label={copy.cancel}
          onPress={onClose}
          variant="secondary"
          disabled={pending}
          accessibilityHint={t('common.close')}
        />
      </View>
    </FigmaBottomSheet>
  );
}

const styles = StyleSheet.create({
  message: { fontSize: 16, fontFamily: FontFamily.medium, lineHeight: 27, textAlign: 'center' },
  detail: {
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  detailText: { fontSize: 16, fontFamily: FontFamily.bold, textAlign: 'center' },
  failure: { fontSize: 16, fontFamily: FontFamily.semibold, lineHeight: 26, textAlign: 'center' },
  actions: { gap: Spacing.two },
});
