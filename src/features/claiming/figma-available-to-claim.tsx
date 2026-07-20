import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SkeletonList } from '@/components/skeleton';

import { FigmaBottomSheet } from '@/components/figma/figma-bottom-sheet';
import { Button } from '@/components/button';
import { GlyphChip, type GlyphChipTone } from '@/components/glyph-chip';
import { Icon } from '@/components/icon';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
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

/** Fixed section order, matching the feed's item types (frame 9d groups by kind). */
const SECTIONS: { type: ClaimItemType; labelKey: string }[] = [
  { type: 'task', labelKey: 'claiming.sections.tasks' },
  { type: 'medication', labelKey: 'claiming.sections.medications' },
  { type: 'appointment', labelKey: 'claiming.sections.appointments' },
  { type: 'visit', labelKey: 'claiming.sections.visits' },
];

/**
 * The Dar "متاح للتكفّل" / available-to-claim feed (frame 9d). A single unified feed
 * of unowned care items a claim-capable member can take responsibility for, grouped
 * by kind (tasks → medications → appointments → visits) each with a plain
 * label + count header. Each bordered card is title + an LTR date / subtitle + a
 * compact «أنا متكفّل» claim pill. Claiming is immediate: one tap fills the
 * responsibility column server-side, the item leaves this feed and appears on the
 * owner's own screen. Claim feedback shows in a bottom-anchored sheet (visible at
 * any scroll position). remote_member / elder never reach this surface. Cairo,
 * Dar tokens, both themes, RTL.
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
              style={[styles.retry, { backgroundColor: c.primary, borderColor: c.border }]}>
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
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionLabel, { color: c.text }]}>{t(section.labelKey)}</Text>
                  <Text style={[styles.sectionCount, { color: c.textSecondary }]}>
                    {isolateLtr(String(section.items.length))}
                  </Text>
                </View>
                <View style={styles.cards}>
                  {section.items.map((item) => (
                    <ClaimCard
                      key={item.item_id}
                      item={item}
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
 * confirmation is visible whatever the scroll position — the old top-of-content
 * notice scrolled out of view. Status is icon + text + tone (never tone-only),
 * announced as an alert, dismissed with a large "حسنًا / OK" button.
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

  return (
    <FigmaBottomSheet visible={feedback !== null} onClose={onClose} title={feedback?.title ?? ''}>
      <View style={styles.feedbackRow} accessibilityRole="alert" accessibilityLiveRegion="assertive">
        <GlyphChip iconName={FEEDBACK_ICON[tone]} tone={tone as GlyphChipTone} size="md" shape="circle" />
        {feedback?.body ? (
          <Text style={[styles.feedbackBody, { color: c.textSecondary }]}>{feedback.body}</Text>
        ) : null}
      </View>
      <Button
        label={t('common.ok')}
        variant={tone === 'success' ? 'primary' : 'secondary'}
        onPress={onClose}
      />
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
  pending,
  onClaim,
}: {
  item: AvailableClaimItem;
  pending: boolean;
  onClaim: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const when = whenText(item);

  return (
    <View style={[styles.card, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
      <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={2}>
        {item.title}
      </Text>
      {when ? <Text style={[styles.cardWhen, { color: c.text }]}>{when}</Text> : null}
      {item.subtitle ? (
        <Text style={[styles.cardSub, { color: c.textSecondary }]} numberOfLines={1}>
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
        style={({ pressed }) => [styles.claimPill, { backgroundColor: c.primary }, pressed && styles.pressed]}>
        {pending ? (
          <ActivityIndicator size="small" color={c.onPrimary} />
        ) : (
          <>
            <Icon name="claim" size={15} color="onPrimary" />
            <Text style={[styles.claimText, { color: c.onPrimary }]}>{t('claiming.cta')}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  errorCard: { borderWidth: BorderWidth.standard, borderRadius: Radius.card, padding: 20 },
  errorText: { fontSize: 16, fontFamily: FontFamily.semibold, textAlign: 'center' },
  retry: {
    marginTop: 12,
    alignSelf: 'center',
    borderRadius: Radius.card,
    borderWidth: BorderWidth.standard,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { fontSize: 15, fontFamily: FontFamily.bold },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  feedbackBody: { flex: 1, fontSize: 15, lineHeight: 24, fontFamily: FontFamily.medium },
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionLabel: { fontSize: 16, fontFamily: FontFamily.bold, flex: 1 },
  sectionCount: { fontSize: 14, fontFamily: FontFamily.semibold, writingDirection: 'ltr' },
  cards: { gap: 8 },
  card: {
    borderWidth: BorderWidth.standard,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardTitle: { fontSize: 16, fontFamily: FontFamily.bold, lineHeight: 24 },
  cardWhen: { fontSize: 14, fontFamily: FontFamily.semibold, marginTop: 4, writingDirection: 'ltr' },
  cardSub: { fontSize: 14, fontFamily: FontFamily.medium, marginTop: 4 },
  claimPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 44,
    borderRadius: Radius.control,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 12,
  },
  claimText: { fontSize: 15, fontFamily: FontFamily.bold },
  pressed: { opacity: 0.75 },
});
