/**
 * Web RTL: the app is Arabic-first, so set the document direction and language
 * on the root `<html>` element.
 *
 * This is applied imperatively (not through a React-rendered element), so it
 * does not participate in hydration and cannot cause a hydration mismatch with
 * the statically rendered HTML. The `typeof document` guard keeps it safe during
 * static rendering / SSR where `document` is undefined.
 */
export function applyRTL(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dir = 'rtl';
  document.documentElement.lang = 'ar';
}
