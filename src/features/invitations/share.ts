import { Platform, Share } from 'react-native';

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
