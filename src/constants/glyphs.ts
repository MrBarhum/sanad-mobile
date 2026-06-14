/**
 * Centralized decorative glyphs for the Sanad UI.
 *
 * WHY THIS FILE EXISTS: inlining multi-byte Unicode glyph literals (✓ › ◉ …)
 * directly in `.tsx` source is fragile — a single tool that re-saves a file with
 * the wrong encoding turns every glyph into mojibake (e.g. `›` → `›`). Every
 * value here is therefore built from a numeric code point via
 * `String.fromCodePoint`, so the SOURCE of this module is pure ASCII and can
 * never be corrupted by an encoding round-trip. (Same technique the bidi
 * isolates in `ltr-text.tsx` already use.) Import `Glyph` instead of writing a
 * glyph literal anywhere it is rendered.
 *
 * These are deliberately NON-emoji marks: they inherit the app's text color and
 * brand font, stay calm/monochrome, and never carry meaning alone (a text label
 * always accompanies them — see GlyphChip / StatusBadge / NavCard).
 */
const cp = (code: number) => String.fromCodePoint(code);

export const Glyph = {
  // Structure & navigation
  chevron: cp(0x203a), // ›  trailing "go" affordance on nav rows
  bullet: cp(0x2022), // •  inline separator / avatar fallback
  middot: cp(0x00b7), // ·  metadata separator
  dot: cp(0x25cf), // ●  unread indicator

  // Status / action marks
  check: cp(0x2713), // ✓  done / selected
  cross: cp(0x2715), // ✕  cancelled / close / missed
  clock: cp(0x25f7), // ◷  pending / upcoming / postponed
  plus: cp(0xff0b), // ＋ add (fullwidth, balances Arabic weight)
  info: 'i', //     informational (already ASCII-safe)
  warn: '!', //     warning (already ASCII-safe)

  // Feature identities (dashboard cards, list rows, notification types)
  medication: cp(0x25c9), // ◉
  task: cp(0x2713), //      ✓
  appointment: cp(0x25f7), // ◷
  visit: cp(0x2302), //     ⌂
  dailyLog: cp(0x270e), //  ✎
  vital: cp(0x2661), //     ♡
  members: cp(0x2756), //   ❖
  profile: cp(0x2726), //   ✦
  doctor: cp(0x271c), //    ✜
  contact: cp(0x2706), //   ✆
  emergency: cp(0x271a), // ✚
  system: cp(0x2299), //    ⊙

  // Explore placeholders
  diamond: cp(0x25c8), //   ◈
  bullseye: cp(0x25ce), //  ◎
} as const;

/**
 * A clean single-character avatar mark derived from a (possibly Arabic, possibly
 * empty) display name — the first grapheme, or a neutral bullet when the name is
 * blank. Used by ContactCard / member rows / circle switcher so avatars never
 * depend on a fragile inline glyph literal.
 */
export function initialFor(name: string | null | undefined): string {
  const first = [...(name ?? '').trim()][0];
  return first ?? Glyph.bullet;
}
