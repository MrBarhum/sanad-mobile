/**
 * Digit normalization for an Arabic-first app.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 *
 * An Arabic keyboard emits Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩, U+0660–0669) or, on
 * some Persian/Urdu layouts, Extended Arabic-Indic digits (۰۱۲۳۴۵۶۷۸۹,
 * U+06F0–06F9). Neither is matched by `\d` in a JavaScript regular expression,
 * and neither is understood by `Number()`:
 *
 *     Number('١٢٠')                  // NaN
 *     '٠٥٥١٢٣٤٥٦٧'.replace(/[^\d+]/g, '')   // '' — every digit stripped
 *
 * Both bugs shipped. A blood-pressure reading could not be entered on an Arabic
 * keyboard, and the emergency call button built `tel:` with an EMPTY number, so
 * it opened the dialer on nothing — a silent failure on the one control that must
 * never fail silently.
 *
 * Normalizing at the edges (parse input, build a tel: URI) rather than sprinkling
 * locale-aware regexes through the codebase keeps one place to reason about.
 */

/** U+0660–0669 ٠١٢٣٤٥٦٧٨٩ and U+06F0–06F9 ۰۱۲۳۴۵۶۷۸۹, in code-point order. */
const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;

/** Arabic decimal separator ٫ (U+066B) — the comma-looking one, means "point". */
const ARABIC_DECIMAL_SEPARATOR = '٫';
/** Arabic thousands separator ٬ (U+066C) — a grouping mark, carries no value. */
const ARABIC_THOUSANDS_SEPARATOR = '٬';

/**
 * Rewrites Arabic-Indic and Extended Arabic-Indic digits to ASCII 0–9, maps the
 * Arabic decimal separator to '.', and drops the Arabic thousands separator.
 * Everything else is passed through untouched — this normalizes, it does not
 * validate.
 */
export function normalizeDigits(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;

    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
      out += String(code - ARABIC_INDIC_ZERO);
    } else if (code >= EXTENDED_ARABIC_INDIC_ZERO && code <= EXTENDED_ARABIC_INDIC_ZERO + 9) {
      out += String(code - EXTENDED_ARABIC_INDIC_ZERO);
    } else if (char === ARABIC_DECIMAL_SEPARATOR) {
      out += '.';
    } else if (char === ARABIC_THOUSANDS_SEPARATOR) {
      // grouping only — contributes nothing to the value
    } else {
      out += char;
    }
  }
  return out;
}

/**
 * The dialable form of a phone number, or null when nothing dialable remains.
 *
 * Returning null rather than an empty string is the point: `tel:` with no number
 * opens the dialer on a blank field, which reads to the user as "the call button
 * is broken". A null lets the caller say so instead of failing silently.
 *
 * Digits are normalized FIRST, so an Arabic-keyboard number survives; only then
 * is everything except digits and a leading '+' removed. The '+' is kept only in
 * the leading position, where it means "international".
 */
export function toDialableNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const normalized = normalizeDigits(phone).trim();
  const hasPlusPrefix = normalized.startsWith('+');
  const digits = normalized.replace(/\D/g, '');
  if (digits.length === 0) return null;
  return hasPlusPrefix ? `+${digits}` : digits;
}
