import { ThemedText, type ThemedTextProps } from './themed-text';

// U+2066 LEFT-TO-RIGHT ISOLATE … U+2069 POP DIRECTIONAL ISOLATE — built from
// code points so no invisible characters live in source.
const LRI = String.fromCodePoint(0x2066);
const PDI = String.fromCodePoint(0x2069);

/**
 * Wrap a left-to-right value (phone number, email, ID, invitation code, time,
 * English medication name) so it renders correctly inside the Arabic-first RTL
 * UI. The text run is forced LTR via `writingDirection` and bidi-isolated, so the
 * value's internal order is preserved and it never flips the surrounding layout.
 * Alignment is left to inherit (start = right in RTL), so the value still sits at
 * the start of its container — no hardcoded left/right.
 */
export function LtrText({ children, style, ...rest }: ThemedTextProps) {
  return (
    <ThemedText {...rest} style={[{ writingDirection: 'ltr' }, style]}>
      {typeof children === 'string' ? isolateLtr(children) : children}
    </ThemedText>
  );
}

/**
 * Bidi-isolate a string as LTR using Unicode LRI…PDI markers, so it can be safely
 * concatenated inside Arabic text without reordering its neighbors. Use when
 * embedding a value inline within a larger translated string.
 */
export function isolateLtr(value: string): string {
  return `${LRI}${value}${PDI}`;
}
