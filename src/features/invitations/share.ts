import { Linking, Platform, Share } from 'react-native';

/**
 * Best-effort "share" of an invitation code/message. Native uses the OS share
 * sheet; web uses the Web Share API when available, falling back to the
 * clipboard. We deliberately avoid adding a clipboard dependency. Never logs the
 * raw code.
 */
export async function shareInviteMessage(message: string): Promise<void> {
  if (Platform.OS === 'web') {
    const nav = globalThis.navigator as
      | (Navigator & { share?: (data: { text?: string }) => Promise<void> })
      | undefined;
    if (nav?.share) {
      await nav.share({ text: message });
      return;
    }
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(message);
      return;
    }
    return;
  }
  await Share.share({ message });
}

/**
 * Shares a message via WhatsApp, falling back to the generic share sheet when
 * WhatsApp isn't installed / reachable. Native uses the `whatsapp://send` scheme;
 * web opens wa.me in a new tab. Never logs the message (it carries the raw code).
 */
export async function shareViaWhatsApp(message: string): Promise<void> {
  const text = encodeURIComponent(message);
  if (Platform.OS === 'web') {
    const opener = (globalThis as { open?: (url: string, target?: string) => unknown }).open;
    if (opener) {
      opener(`https://wa.me/?text=${text}`, '_blank');
      return;
    }
    await shareInviteMessage(message);
    return;
  }
  try {
    await Linking.openURL(`whatsapp://send?text=${text}`);
  } catch {
    // WhatsApp not installed / scheme unhandled — fall back to the OS share sheet.
    await shareInviteMessage(message);
  }
}

/**
 * Copy a code to the clipboard where possible. Web uses the Clipboard API and
 * reports success; native (no clipboard dep installed) falls back to the share
 * sheet, which lets the user copy/paste it wherever they like.
 */
export async function copyInviteCode(code: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    const nav = globalThis.navigator as
      | (Navigator & { clipboard?: { writeText: (t: string) => Promise<void> } })
      | undefined;
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(code);
      return true;
    }
    return false;
  }
  await Share.share({ message: code });
  return true;
}
