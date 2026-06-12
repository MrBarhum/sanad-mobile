import { useTranslation } from 'react-i18next';

import { useNavigationGuard } from '@/hooks/use-navigation-guard';

/**
 * Drop-in guard for forms with unsaved edits. Render it inside any create/edit
 * screen and pass `when={dirty}`; it prompts the user to confirm before leaving
 * (back gesture, header back, hardware back) and otherwise stays out of the way.
 * Renders nothing. Copy is centralized under `common.*` so every form warns the
 * same way.
 */
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  const { t } = useTranslation();

  useNavigationGuard(when, {
    title: t('common.unsavedTitle'),
    message: t('common.unsavedMessage'),
    confirm: t('common.discardChanges'),
    cancel: t('common.keepEditing'),
  });

  return null;
}
