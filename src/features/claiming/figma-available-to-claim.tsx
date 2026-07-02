import { useFocusEffect } from 'expo-router';
import { AlertCircle, Calendar, Check, Clock, HandHelping, ListChecks, Pill, Users } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { FigmaBottomSheet } from '@/components/figma/figma-bottom-sheet';
import { FigmaButton } from '@/components/figma/figma-button';
import { FigmaCard } from '@/components/figma/figma-card';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { IconChip } from '@/components/figma/icon-chip';
import {
  FigmaCategory,
  FigmaColors,
  FigmaFont,
  FigmaRadius,
  withAlpha,
  type FigmaScheme,
} from '@/components/figma/figma-tokens';
import { isolateLtr } from '@/components/ltr-text';
import { formatHm, hmFromInstant, ymdFromInstant } from '@/utils/date';

import { useAvailableToClaim, useClaimItem } from './hooks';
import type { AvailableClaimItem, ClaimItemType } from './types';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
type FeedbackTone = 'success' | 'warning' | 'error';
/** A claim result shown in the bottom-anchored sheet (visible at any scroll pos). */
type Feedback = { tone: FeedbackTone; title: string; body: string | null };

/** Fixed section order + its icon/color, matching the feed's item types. */
const SECTIONS: { type: ClaimItemType; labelKey: string; Icon: IconCmp; color: string }[] = [
  { type: 'task', labelKey: 'claiming.sections.tasks', Icon: ListChecks, color: FigmaCategory.blue },
  { type: 'medication', labelKey: 'claiming.sections.medications', Icon: Pill, color: FigmaCategory.teal },
  { type: 'appointment', labelKey: 'claiming.sections.appointments', Icon: Calendar, color: FigmaCategory.purple },
  { type: 'visit', labelKey: 'claiming.sections.visits', Icon: Users, color: FigmaCategory.green },
];

/**
 * "متاح للتكفّل" / Available-to-claim. A single unified feed of unowned care items
 * a claim-capable member can take responsibility for (open unassigned tasks,
 * active meds with no responsible person, scheduled unassigned appointments,
 * planned unlinked visits). Claiming is immediate: one tap on "أنا متكفّل" fills
 * the responsibility column server-side, the item leaves this feed and appears in
 * the owner's own screen. Claim feedback is shown in a bottom-anchored sheet so it
 * is visible regardless of scroll position. remote_member / elder never reach this
 * surface (the Home entry is hidden for them and the RPC rejects them). RTL, Cairo.
 */
export function FigmaAvailableToClaim({
  circleId,
  canClaim,
}: {
  circleId: string;
  canClaim: boolean;
}) {
  const { t } = useTranslation();
  const scheme: FigmaScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = FigmaColors[scheme];

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

  async function onClaim(item: AvailableClaimItem) {
    if (pendingId) return;
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
          <View style={styles.empty}>
            <HandHelping size={40} color={c.muted} strokeWidth={1} />
            <Text style={[styles.emptyText, { color: c.muted }]}>{t('claiming.notAllowed')}</Text>
          </View>
        ) : feed.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : feed.isError ? (
          <FigmaCard tone="card" radius={FigmaRadius.r16}>
            <Text style={[styles.errorText, { color: c.error }]}>{t('claiming.loadError')}</Text>
            <Pressable
              onPress={() => refetch()}
              accessibilityRole="button"
              style={[styles.retry, { backgroundColor: c.primary }]}>
              <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
            </Pressable>
          </FigmaCard>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <HandHelping size={40} color={c.muted} strokeWidth={1} />
            <Text style={[styles.emptyText, { color: c.muted }]}>{t('claiming.empty')}</Text>
          </View>
        ) : (
          grouped
            .filter((section) => section.items.length > 0)
            .map((section) => (
              <View key={section.type} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <section.Icon size={16} color={section.color} />
                  <Text style={[styles.sectionLabel, { color: c.text }]}>{t(section.labelKey)}</Text>
                  <Text style={[styles.sectionCount, { color: c.muted }]}>
                    {isolateLtr(String(section.items.length))}
                  </Text>
                </View>
                {section.items.map((item) => (
                  <ClaimCard
                    key={item.item_id}
                    item={item}
                    color={section.color}
                    Icon={section.Icon}
                    scheme={scheme}
                    pending={pendingId === item.item_id}
                    onClaim={() => onClaim(item)}
                  />
                ))}
              </View>
            ))
        )}
      </FigmaScreen>

      <ClaimFeedbackSheet feedback={feedback} scheme={scheme} onClose={() => setFeedback(null)} />
    </>
  );
}

/**
 * Bottom-anchored claim result. A `FigmaBottomSheet` (Modal over a scrim) so the
 * confirmation is visible whatever the scroll position — the old top-of-content
 * notice scrolled out of view. Status is icon + text + color (never color-only),
 * announced as an alert, dismissed with a large "حسنًا / OK" button.
 */
function ClaimFeedbackSheet({
  feedback,
  scheme,
  onClose,
}: {
  feedback: Feedback | null;
  scheme: FigmaScheme;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const c = FigmaColors[scheme];

  const tone: FeedbackTone = feedback?.tone ?? 'success';
  const color = tone === 'success' ? c.success : tone === 'warning' ? c.accent : c.error;
  const Icon = tone === 'success' ? Check : AlertCircle;

  return (
    <FigmaBottomSheet visible={feedback !== null} onClose={onClose} title={feedback?.title ?? ''}>
      <View
        style={styles.feedbackRow}
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive">
        <View style={[styles.feedbackChip, { backgroundColor: withAlpha(color, 0.12) }]}>
          <Icon size={22} color={color} />
        </View>
        {feedback?.body ? (
          <Text style={[styles.feedbackBody, { color: c.muted }]}>{feedback.body}</Text>
        ) : null}
      </View>
      <FigmaButton
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
  color,
  Icon,
  scheme,
  pending,
  onClaim,
}: {
  item: AvailableClaimItem;
  color: string;
  Icon: IconCmp;
  scheme: FigmaScheme;
  pending: boolean;
  onClaim: () => void;
}) {
  const { t } = useTranslation();
  const c = FigmaColors[scheme];
  const when = whenText(item);

  return (
    <FigmaCard tone="card" radius={FigmaRadius.r24} padding={16}>
      <View style={styles.cardTop}>
        <IconChip Icon={Icon} color={color} size={48} radius={FigmaRadius.r16} iconSize={22} />
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          {when ? (
            <View style={styles.metaRow}>
              <Clock size={13} color={c.muted} />
              <Text style={[styles.metaText, { color: c.muted }]}>{when}</Text>
            </View>
          ) : null}
          {item.subtitle ? (
            <Text style={[styles.metaText, { color: c.muted }]} numberOfLines={1}>
              {item.subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <FigmaButton
        label={t('claiming.cta')}
        Icon={HandHelping}
        loading={pending}
        onPress={onClaim}
        accessibilityHint={t('claiming.ctaHint')}
        style={styles.cta}
      />
    </FigmaCard>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 14, fontFamily: FigmaFont.medium, textAlign: 'center' },
  retry: {
    marginTop: 12,
    alignSelf: 'center',
    borderRadius: FigmaRadius.r12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { fontSize: 13, fontFamily: FigmaFont.semibold },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: FigmaFont.medium, textAlign: 'center' },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  feedbackChip: {
    width: 44,
    height: 44,
    borderRadius: FigmaRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackBody: { flex: 1, fontSize: 14, lineHeight: 21, fontFamily: FigmaFont.regular },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionLabel: { fontSize: 15, fontFamily: FigmaFont.bold, flex: 1 },
  sectionCount: { fontSize: 13, fontFamily: FigmaFont.medium },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardInfo: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 16, fontFamily: FigmaFont.bold },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, fontFamily: FigmaFont.regular },
  cta: { marginTop: 14 },
});
