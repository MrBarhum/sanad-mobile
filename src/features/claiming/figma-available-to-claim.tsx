import { useFocusEffect } from 'expo-router';
import { Clock, HandHelping } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SkeletonList } from '@/components/skeleton';

import { FigmaBottomSheet } from '@/components/figma/figma-bottom-sheet';
import { GlyphChip, type GlyphChipTone } from '@/components/glyph-chip';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { SectionHeader } from '@/components/section-header';
import { EmptyState } from '@/components/states';
import { isolateLtr } from '@/components/ltr-text';
import { type IconName } from '@/constants/icons';
import { BorderWidth, FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/utils/confirm';
import { formatHm, hmFromInstant, ymdFromInstant } from '@/utils/date';

import { useAvailableToClaim, useClaimItem } from './hooks';
import type { AvailableClaimItem, ClaimItemType } from './types';

type FeedbackTone = 'success' | 'warning' | 'error';
/** A claim result shown in the bottom-anchored sheet (visible at any scroll pos). */
type Feedback = { tone: FeedbackTone; title: string; body: string | null };

/** Fixed section order + each type's identity chip (icon + Dar tone), matching the
 *  Explore rows so the feed reads in the same visual language as the rest of the app. */
const SECTIONS: { type: ClaimItemType; labelKey: string; iconName: IconName; tone: GlyphChipTone }[] = [
  { type: 'task', labelKey: 'claiming.sections.tasks', iconName: 'task', tone: 'success' },
  { type: 'medication', labelKey: 'claiming.sections.medications', iconName: 'medication', tone: 'primary' },
  { type: 'appointment', labelKey: 'claiming.sections.appointments', iconName: 'appointment', tone: 'primary' },
  { type: 'visit', labelKey: 'claiming.sections.visits', iconName: 'visit', tone: 'warning' },
];

/**
 * "متاح للتكفّل" / available-to-claim: a unified feed of unowned care items a
 * claim-capable member can take responsibility for, grouped by kind (tasks →
 * medications → appointments → visits). Each group is a Dar `SectionHeader` (10×10
 * square + label + count) over bordered cards — a toned type-icon square + title +
 * an LTR date / subtitle + the green «أنا متكفّل» claim pill (the same pill the
 * tasks rows use). Claiming is immediate; feedback shows in a bottom-anchored sheet
 * so it's visible at any scroll position. remote_member / elder never reach this
 * surface. Cairo + Dar tokens, both themes, RTL.
 */
export function FigmaAvailableToClaim({
  circleId,
  canClaim,
}: {
  circleId: string;
  canClaim: boolean;
}) {
  const { t } = useTranslation();
  const c = useTheme();

  const feed = useAvailableToClaim(canClaim ? circleId : undefined);
  const claim = useClaimItem();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const refetch = feed.refetch;
  // Refresh on focus so a just-claimed / just-freed item reconciles when the user
  // returns to this screen (FigmaScreen is a plain ScrollView — no pull-to-refresh).
  useFocusEffect(
    useCallback(() => {
      if (canClaim) refetch();
    }, [canClaim, refetch]),
  );

  // Dev-only visibility into a load failure (the error state itself is shown to
  // the user). No secrets / env are logged — only the query error.
  useEffect(() => {
    if (__DEV__ && feed.isError) {
      console.error('[available-to-claim] load failed', feed.error);
    }
  }, [feed.isError, feed.error]);

  const items = useMemo(() => feed.data ?? [], [feed.data]);
  const grouped = useMemo(
    () => SECTIONS.map((s) => ({ ...s, items: items.filter((i) => i.item_type === s.type) })),
    [items],
  );

  function onClaim(item: AvailableClaimItem) {
    if (pendingId) return;
    // Claiming assigns the item to me immediately — confirm the commitment first (A4).
    confirmAction(
      {
        title: t('claiming.confirmTitle'),
        message: t('claiming.confirmMessage', { title: item.title }),
        confirm: t('claiming.cta'),
        cancel: t('common.cancel'),
      },
      () => {
        void runClaim(item);
      },
    );
  }

  async function runClaim(item: AvailableClaimItem) {
    setPendingId(item.item_id);
    setFeedback(null);
    try {
      await claim.mutateAsync(item);
      // Invalidation refetches the feed; the claimed item drops out on its own.
      setFeedback({
        tone: 'success',
        title: t('claiming.claimSuccess'),
        body: t('claiming.claimSuccessBody'),
      });
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === '23505') {
        refetch();
        setFeedback({
          tone: 'warning',
          title: t('claiming.alreadyClaimed'),
          body: t('claiming.alreadyClaimedBody'),
        });
      } else {
        setFeedback({ tone: 'error', title: t('claiming.claimFailed'), body: null });
      }
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <FigmaScreen>
        <FigmaHeader title={t('claiming.title')} />

        {!canClaim ? (
          <EmptyState iconName="claim" title={t('claiming.notAllowed')} />
        ) : feed.isLoading ? (
          <SkeletonList />
        ) : feed.isError ? (
          <View style={[styles.errorCard, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
            <Text style={[styles.errorText, { color: c.errorFg }]}>{t('claiming.loadError')}</Text>
            <Pressable
              onPress={() => refetch()}
              accessibilityRole="button"
              style={[styles.retry, { backgroundColor: c.primary }]}>
              <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <EmptyState iconName="claim" title={t('claiming.empty')} />
        ) : (
          grouped
            .filter((section) => section.items.length > 0)
            .map((section) => (
              <View key={section.type} style={styles.section}>
                <SectionHeader
                  title={t(section.labelKey)}
                  trailing={
                    <Text style={[styles.count, { color: c.textSecondary }]}>
                      {isolateLtr(String(section.items.length))}
                    </Text>
                  }
                />
                <View style={styles.cards}>
                  {section.items.map((item) => (
                    <ClaimCard
                      key={item.item_id}
                      item={item}
                      iconName={section.iconName}
                      tone={section.tone}
                      pending={pendingId === item.item_id}
                      onClaim={() => onClaim(item)}
                    />
                  ))}
                </View>
              </View>
            ))
        )}
      </FigmaScreen>

      <ClaimFeedbackSheet feedback={feedback} onClose={() => setFeedback(null)} />
    </>
  );
}

/** tone → the semantic status icon on the feedback chip. */
const FEEDBACK_ICON: Record<FeedbackTone, IconName> = {
  success: 'success',
  warning: 'warning',
  error: 'error',
};

/**
 * Bottom-anchored claim result. A `FigmaBottomSheet` (Modal over a scrim) so the
 * confirmation is visible whatever the scroll position. Status is icon + text +
 * tone (never tone-only), announced as an alert, dismissed with a large OK button.
 */
function ClaimFeedbackSheet({
  feedback,
  onClose,
}: {
  feedback: Feedback | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();

  const tone: FeedbackTone = feedback?.tone ?? 'success';
  const success = tone === 'success';

  return (
    <FigmaBottomSheet visible={feedback !== null} onClose={onClose} title={feedback?.title ?? ''}>
      <View style={styles.feedbackRow} accessibilityRole="alert" accessibilityLiveRegion="assertive">
        <GlyphChip iconName={FEEDBACK_ICON[tone]} tone={tone as GlyphChipTone} size="md" shape="circle" />
        {feedback?.body ? (
          <Text style={[styles.feedbackBody, { color: c.textSecondary }]}>{feedback.body}</Text>
        ) : null}
      </View>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.ok')}
        style={[
          styles.okBtn,
          {
            backgroundColor: success ? c.primary : c.backgroundElement,
            borderColor: c.border,
          },
        ]}>
        <Text style={[styles.okText, { color: success ? c.onPrimary : c.text }]}>{t('common.ok')}</Text>
      </Pressable>
    </FigmaBottomSheet>
  );
}

/** Builds the LTR-isolated date/time meta for an item, or null when it has none. */
function whenText(item: AvailableClaimItem): string | null {
  if (item.scheduled_at) {
    return `${isolateLtr(ymdFromInstant(item.scheduled_at))}، ${isolateLtr(hmFromInstant(item.scheduled_at))}`;
  }
  if (item.date_value) {
    return item.time_value
      ? `${isolateLtr(item.date_value)}، ${isolateLtr(formatHm(item.time_value))}`
      : isolateLtr(item.date_value);
  }
  return null;
}

function ClaimCard({
  item,
  iconName,
  tone,
  pending,
  onClaim,
}: {
  item: AvailableClaimItem;
  iconName: IconName;
  tone: GlyphChipTone;
  pending: boolean;
  onClaim: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const when = whenText(item);

  return (
    <View style={[styles.card, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
      <GlyphChip iconName={iconName} tone={tone} size="md" />
      <View style={styles.info}>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        {when ? (
          <View style={styles.metaRow}>
            <Clock size={12} color={c.textSecondary} strokeWidth={2.2} />
            <Text style={[styles.metaText, { color: c.textSecondary }]}>{when}</Text>
          </View>
        ) : null}
        {item.subtitle ? (
          <Text style={[styles.subtitle, { color: c.textSecondary }]} numberOfLines={1}>
            {item.subtitle}
          </Text>
        ) : null}

        <Pressable
          onPress={onClaim}
          disabled={pending}
          accessibilityRole="button"
          accessibilityLabel={t('claiming.cta')}
          accessibilityHint={t('claiming.ctaHint')}
          accessibilityState={{ busy: pending }}
          style={[styles.claimBtn, { backgroundColor: c.primary }]}>
          {pending ? (
            <ActivityIndicator size="small" color={c.onPrimary} />
          ) : (
            <>
              <HandHelping size={15} color={c.onPrimary} strokeWidth={2} />
              <Text style={[styles.claimText, { color: c.onPrimary }]}>{t('claiming.cta')}</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  errorCard: { borderWidth: BorderWidth.standard, borderRadius: Radius.card, padding: 20 },
  errorText: { fontSize: 16, fontFamily: FontFamily.semibold, textAlign: 'center' },
  retry: {
    marginTop: 12,
    alignSelf: 'center',
    borderRadius: Radius.control,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { fontSize: 15, fontFamily: FontFamily.bold },
  section: { gap: 10 },
  count: { fontSize: 14, fontFamily: FontFamily.bold, writingDirection: 'ltr' },
  cards: { gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  info: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontFamily: FontFamily.bold, lineHeight: 24 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  metaText: { fontSize: 14, fontFamily: FontFamily.semibold, writingDirection: 'ltr' },
  subtitle: { fontSize: 14, fontFamily: FontFamily.medium, marginTop: 4 },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    marginTop: 10,
    minHeight: 34,
    paddingHorizontal: 16,
    borderRadius: Radius.control,
  },
  claimText: { fontSize: 15, fontFamily: FontFamily.bold },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  feedbackBody: { flex: 1, fontSize: 15, lineHeight: 24, fontFamily: FontFamily.medium },
  okBtn: {
    marginTop: 12,
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  okText: { fontSize: 17, fontFamily: FontFamily.bold },
});
