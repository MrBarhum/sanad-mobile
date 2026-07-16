/**
 * Single source of truth for turning a member's stored identity into a display
 * name. The chain is: real full name → email local-part (the part before "@") →
 * a neutral fallback the caller supplies. We never show a bare generic word when
 * there is *any* usable identity, and we never render a full email inline (only
 * its local-part), so broadcast surfaces don't leak addresses.
 *
 * Email visibility is already gated server-side — `list_circle_members` masks the
 * email column for non-managers/non-self — so when `email` is non-null the viewer
 * is allowed to see it, and its local-part is safe to show here. Reused by the
 * roster, the assignment pickers, and the Care Pulse feed so one member reads with
 * the same name everywhere.
 */

export function emailLocalPart(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf('@');
  const local = at > 0 ? email.slice(0, at) : email;
  return local.trim() || null;
}

/**
 * Best display name for a member: full name, else email local-part, else the
 * caller's neutral fallback (e.g. "عضو" / "Member"). Now that sign-up requires a
 * name the fallback is rarely reached, but legacy accounts may still lack one.
 */
export function memberDisplayName(
  member: { fullName: string | null | undefined; email: string | null | undefined },
  fallback: string,
): string {
  return member.fullName?.trim() || emailLocalPart(member.email) || fallback;
}
