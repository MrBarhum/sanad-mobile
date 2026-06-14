import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { InfoBanner } from '@/components/info-banner';
import { Glyph } from '@/constants/glyphs';

/**
 * Small tappable hint that explains reminders come from notification settings and
 * links there. Used on the medications / tasks / appointments centers. Preferences
 * are user/circle-level (not per row), so this is informational, not a per-item
 * toggle. `messageKey` lets each screen phrase the context.
 */
export function ReminderNotice({ messageKey }: { messageKey: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <InfoBanner
      tone="info"
      text={t(messageKey)}
      actionText={`${t('notifications.manageLink')} ${Glyph.chevron}`}
      onPress={() => router.push('/notification-settings')}
      accessibilityLabel={t('notifications.manageLink')}
    />
  );
}
