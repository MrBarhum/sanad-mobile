import { I18nManager } from 'react-native';

/**
 * The app is Arabic-first, so the native layout direction should be RTL.
 * See {@link ./rtl.web.ts} for the web implementation (resolved by Metro on web).
 */
const SHOULD_BE_RTL = true;

/**
 * Apply the RTL layout direction on native in a guarded, loop-safe way.
 *
 * We deliberately do NOT call `Updates.reloadAsync()`:
 *   - it risks a reload loop, and
 *   - it is disruptive on startup.
 *
 * Consequently `forceRTL` here takes effect on the NEXT app launch. The guard
 * (`isRTL !== SHOULD_BE_RTL`) makes this a one-shot: once the app relaunches in
 * RTL, `isRTL` already matches and we skip — so there is no loop and no reload.
 *
 * Caveat: on a device whose system language is LTR (e.g. English), the first
 * session renders with an LTR *layout* (Arabic text still displays correctly);
 * a manual app restart switches the layout to RTL. Note that Expo Go resets RTL
 * preferences between launches, so verify in a dev client or a build.
 */
export function applyRTL(): void {
  if (I18nManager.isRTL !== SHOULD_BE_RTL) {
    I18nManager.allowRTL(SHOULD_BE_RTL);
    I18nManager.forceRTL(SHOULD_BE_RTL);
  }
}
