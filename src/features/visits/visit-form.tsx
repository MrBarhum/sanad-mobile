import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FigmaFooterPrimaryButton } from '@/components/figma/figma-footer-primary-button';
import {
  FigmaFormCard,
  FigmaFormScreen,
  FigmaMutedNote,
  FigmaToggleRow,
} from '@/components/figma/figma-form-screen';
import { FigmaFont } from '@/components/figma/figma-tokens';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useAuth } from '@/providers';

import { FigmaVisitFields } from './figma-visit-fields';
import { useCreateVisit } from './hooks';
import { defaultVisitDraft, prepareVisit, type VisitDraft } from './visit-fields';

/**
 * Add-visit form — an exact-copy rebuild of the Figma `AddVisitScreen` wired to
 * Sanad's real create flow + schema. The export's blue/IBM-Plex become teal/Cairo
 * and its native inputs become the protected wheel pickers. Crucially, the
 * export's "link to my account" toggle is shown to EVERYONE — Sanad's RLS instead
 * shows it ONLY to managers (collaborators always record their own visit), and
 * that real behavior is preserved here.
 */
export function VisitForm({ circleId, canManage }: { circleId: string; canManage: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const create = useCreateVisit(circleId);

  const [draft, setDraft] = useState<VisitDraft>(() => defaultVisitDraft());
  const [linkToSelf, setLinkToSelf] = useState(!canManage);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const { dirty } = useUnsavedChanges({ draft, linkToSelf });
  const submitting = create.isPending;

  useEffect(() => {
    if (submitted) router.back();
  }, [submitted, router]);
  // Collaborators always record their own visit; managers may opt in.
  const visitorUserId = (canManage ? linkToSelf : true) ? (user?.id ?? null) : null;

  function patch(part: Partial<VisitDraft>) {
    setDraft((current) => ({ ...current, ...part }));
  }

  async function onSubmit() {
    const prepared = prepareVisit(draft);
    setErrors(prepared.ok ? {} : prepared.errors);
    if (!prepared.ok) return;

    setSubmitError(null);
    try {
      await create.mutateAsync({ ...prepared.value, visitor_user_id: visitorUserId });
      setSubmitted(true);
    } catch {
      setSubmitError(t('visits.saveFailed'));
    }
  }

  return (
    <FigmaFormScreen title={t('visits.addTitle')} onBack={() => router.back()}>
      <UnsavedChangesGuard when={dirty && !submitted} />
      <FigmaMutedNote>{t('visits.disclaimer')}</FigmaMutedNote>

      <FigmaFormCard>
        <FigmaVisitFields draft={draft} onChange={patch} errors={errors} />

        {canManage ? (
          <FigmaToggleRow
            topDivider
            label={t('visits.fields.linkToMe')}
            hint={t('visits.ownVisitNote')}
            value={linkToSelf}
            onValueChange={setLinkToSelf}
          />
        ) : (
          <View>
            <View style={[styles.divider, { backgroundColor: theme.divider }]} />
            <FigmaMutedNote>{t('visits.ownVisitNote')}</FigmaMutedNote>
          </View>
        )}
      </FigmaFormCard>

      {/* Primary CTA — rendered directly in the body (not the footer prop, which
          did not render on Android). Always a filled teal button; an invalid press
          runs validation and shows inline errors. */}
      <View style={styles.footer}>
        {submitError ? (
          <Text
            style={[styles.footerError, { color: theme.errorFg }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite">
            {submitError}
          </Text>
        ) : null}
        <FigmaFooterPrimaryButton label={t('visits.add')} onPress={onSubmit} loading={submitting} />
      </View>
    </FigmaFormScreen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: Spacing.two },
  footerError: { fontSize: 13, fontFamily: FigmaFont.regular, textAlign: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: Spacing.three },
});
