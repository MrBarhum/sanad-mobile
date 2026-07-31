import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DoseBeadStrip, type DoseBead, type DoseBeadStatus } from '@/components/dose-bead-strip';
import { FigmaBottomSheet } from '@/components/figma/figma-bottom-sheet';
import { FigmaHeader } from '@/components/figma/figma-header';
import { FigmaScreen } from '@/components/figma/figma-screen';
import { GlyphChip } from '@/components/glyph-chip';
import { isolateLtr } from '@/components/ltr-text';
import { SectionHeader } from '@/components/section-header';
import { SkeletonList } from '@/components/skeleton';
import { EmptyState } from '@/components/states';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Surface } from '@/components/surface';
import { type IconName } from '@/constants/icons';
import { BorderWidth, FontFamily, Radius } from '@/constants/theme';
import { DoseProofImage } from '@/features/caregiver/dose-photo';
import { memberDisplayName, memberDisplayNameParts } from '@/features/circle-members/display-name';
import { useCircleMembers } from '@/features/circle-members/hooks';
import { isManagerRole } from '@/features/circle-members/permissions';
import { useMissedDoseGrace } from '@/features/circle-selection/missed-dose-grace';
import type { ActiveCircle } from '@/features/circle-selection/permissions';
import { WEEKDAY_KEYS } from '@/features/medications/schedule-fields';
import { useTheme } from '@/hooks/use-theme';
import { formatHm, todayYmd } from '@/utils/date';

import {
  activeCaregivers,
  useCaregiverWeek,
  weekBoundsFor,
  type CaregiverWeekDose,
  type DoseOutcome,
} from './week-api';

/**
 * «ملخّص الأسبوع» — the family's weekly record of ONE hired caregiver's doses and
 * completed tasks.
 *
 * ── THIS IS A RECORD, NOT A VERDICT ─────────────────────────────────────────
 * The single hardest constraint on this screen is that it protects the worker as
 * much as it informs the family. So, deliberately and permanently absent: any
 * percentage, ratio, score, grade, rank, trend arrow, chart, progress bar or
 * colour-coded "performance". What is drawn is counts and the individual rows
 * behind them, and the page CLOSES on `caregiver.week.mirrorNote` («هذه سجلّات
 * وأرقام فقط، دون تقييم») so the reader is told that in words, not left to infer
 * it. «متأخّرة» is rendered in the NEUTRAL status tone with a clock — it is a
 * time, not a fault — and the grace it is measured against is spelled out in
 * `caregiver.week.lateNote` so it can never read as an unexplained accusation.
 * There is no shift, attendance, clock-in or location surface anywhere.
 *
 * ── AND IT IS READ-ONLY ─────────────────────────────────────────────────────
 * Nothing here mutates. The dose sheet shows the caregiver's own photo with
 * `caregiver.proof.ownerNote` and deliberately carries NO `ItemActions`, no
 * delete, no replace — the family may look at her record, never edit it.
 */
export function CaregiverWeekSummary({ circle }: { circle: ActiveCircle }) {
  const { t } = useTranslation();
  const c = useTheme();

  const isManager = isManagerRole(circle.role);
  const roster = useCircleMembers(isManager ? circle.circleId : undefined);
  const caregivers = useMemo(() => activeCaregivers(roster.data), [roster.data]);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selected =
    caregivers.find((member) => member.userId === selectedUserId) ?? caregivers[0] ?? null;

  // Anchor "this week" once per mount so the stepper cannot drift under the user
  // if the screen stays open across midnight.
  const anchor = useMemo(() => todayYmd(), []);
  const [offset, setOffset] = useState(0);
  const week = useMemo(() => weekBoundsFor(anchor, offset), [anchor, offset]);

  const grace = useMissedDoseGrace(isManager ? circle.circleId : undefined);
  // NOT `?? DEFAULT_MISSED_DOSE_GRACE`. If the circle's grace could not be read,
  // falling back to a constant would classify doses «متأخّرة» against a threshold
  // this circle may never have chosen — and the note below would then present
  // that invented number to the reader as the circle's own setting. Passing null
  // makes the classifier decline to assert lateness at all.
  const graceMinutes = grace.data ?? null;

  const { summary, isLoading, isError, refetch } = useCaregiverWeek({
    circleId: circle.circleId,
    caregiverUserId: selected?.userId,
    week,
    graceMinutes,
    enabled: isManager,
  });

  const [openDose, setOpenDose] = useState<CaregiverWeekDose | null>(null);

  const title = selected
    ? memberDisplayName(selected, t('circleMembers.unnamed'))
    : t('caregiver.week.title');

  const rangeLabel = isolateLtr(
    t('caregiver.week.range', { from: week.start, to: week.end }),
  );

  // The states BEFORE a caregiver is resolved carry no week: drawing a stepper or
  // a mirror note over "you may not read this" / "nobody was hired" would be noise.
  if (!isManager) {
    return (
      <FigmaScreen gap={16}>
        <FigmaHeader title={t('caregiver.week.title')} />
        <Surface tone="card" style={styles.notice}>
          <GlyphChip iconName="lock" tone="neutral" size="md" />
          <Text style={[styles.noticeText, { color: c.text }]} accessibilityRole="text">
            {t('caregiver.week.managersOnly')}
          </Text>
        </Surface>
      </FigmaScreen>
    );
  }
  if (roster.isLoading) {
    return (
      <FigmaScreen gap={16}>
        <FigmaHeader title={t('caregiver.week.title')} />
        <SkeletonList count={3} />
      </FigmaScreen>
    );
  }
  if (roster.isError) {
    return (
      <FigmaScreen gap={16}>
        <FigmaHeader title={t('caregiver.week.title')} />
        <WeekError message={t('caregiver.week.loadError')} onRetry={() => roster.refetch()} />
      </FigmaScreen>
    );
  }
  if (caregivers.length === 0) {
    return (
      <FigmaScreen gap={16}>
        <FigmaHeader title={t('caregiver.week.title')} />
        <EmptyState iconName="member" title={t('caregiver.week.noCaregivers')} />
      </FigmaScreen>
    );
  }

  function body() {
    if (isLoading) return <SkeletonList count={4} />;
    if (isError) {
      return <WeekError message={t('caregiver.week.loadError')} onRetry={() => refetch()} />;
    }
    if (!summary) return <SkeletonList count={4} />;
    if (summary.isEmpty) {
      return <EmptyState iconName="success" title={t('caregiver.week.empty')} />;
    }

    const extraCounts: DoseOutcome[] = (['postponed', 'missed'] as const).filter(
      (outcome) => summary.counts[outcome] > 0,
    );

    return (
      <>
        <View style={styles.group}>
          <SectionHeader title={t('caregiver.week.dosesTitle')} />
          <Surface tone="card" padded={0}>
            <CountRow label={t('caregiver.week.onTime')} value={summary.counts.onTime} />
            {/* When the circle's grace could not be read, `classify` declines to
                call anything late, so this count is provably 0 — and the note
                that DEFINES «متأخّرة» is suppressed too. A bare «متأخّرة · 0»
                with no definition is exactly the unexplained accusation this
                screen exists to avoid, so the row goes with the note. */}
            {summary.graceMinutes === null ? null : (
              <CountRow label={t('caregiver.week.late')} value={summary.counts.late} topDivider />
            )}
            <CountRow
              label={t('caregiver.week.notRecorded')}
              value={summary.counts.notRecorded}
              topDivider
            />
            {extraCounts.map((outcome) => (
              <CountRow
                key={outcome}
                label={t(OUTCOME[outcome].labelKey)}
                value={summary.counts[outcome]}
                topDivider
              />
            ))}
          </Surface>
          {summary.graceMinutes === null ? null : (
            <Text style={[styles.note, { color: c.textSecondary }]}>
              {t('caregiver.week.lateNote', {
                // «30 دقيقة» is a number + unit inside an Arabic sentence — keep
                // the run intact so the digits never reorder around the word.
                minutes: isolateLtr(
                  t('notificationSettings.missedDoseGrace.minutes', {
                    count: summary.graceMinutes,
                  }),
                ),
              })}
            </Text>
          )}
        </View>

        {/* Day cards are direct children of the screen's 16dp column — they are
            peers of the counts group, not a sub-list inside it. */}
        {summary.days.map((day) => (
          <DayCard
            key={day.date}
            date={day.date}
            weekdayIndex={day.weekdayIndex}
            doses={day.doses}
            onOpenDose={setOpenDose}
          />
        ))}

        <View style={styles.group}>
          <SectionHeader title={t('caregiver.week.tasksTitle')} />
          <Surface tone="card" padded={0}>
            <CountRow label={t('caregiver.week.tasksDone')} value={summary.tasksCompleted} />
          </Surface>
        </View>
      </>
    );
  }

  return (
    <FigmaScreen gap={16}>
      <FigmaHeader title={title} />

      {caregivers.length > 1 ? (
        <View style={styles.group}>
          <SectionHeader title={t('caregiver.week.pickCaregiver')} />
          <View style={styles.pickerRow} accessibilityRole="radiogroup">
            {caregivers.map((member) => {
              const active = member.userId === selected?.userId;
              // Isolate ONLY when the name fell back to the Latin email
              // local-part. An LTR isolate around an Arabic name forces an LTR
              // base direction, which throws its trailing punctuation to the
              // wrong end — «سارة (ممرضة)» would render as «)سارة (ممرضة».
              const parts = memberDisplayNameParts(member, t('circleMembers.unnamed'));
              const label = parts.text;
              return (
                <Pressable
                  key={member.memberId}
                  onPress={() => setSelectedUserId(member.userId)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={label}
                  android_ripple={{ color: c.backgroundSelected }}
                  style={[
                    styles.pickerChip,
                    {
                      backgroundColor: active ? c.primary : c.backgroundElement,
                      borderColor: c.border,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.pickerChipText,
                      {
                        color: active ? c.onPrimary : c.textSecondary,
                        fontFamily: active ? FontFamily.bold : FontFamily.semibold,
                      },
                    ]}
                    numberOfLines={1}>
                    {parts.source === 'email' ? isolateLtr(label) : label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.stepper}>
        <Pressable
          onPress={() => setOffset((value) => value - 1)}
          accessibilityRole="button"
          accessibilityLabel={t('caregiver.week.previous')}
          android_ripple={{ color: c.backgroundSelected }}
          style={[
            styles.stepperSquare,
            { borderColor: c.border, backgroundColor: c.backgroundElement },
          ]}>
          <ChevronRight size={20} color={c.text} strokeWidth={2.4} />
        </Pressable>

        <Text style={[styles.range, { color: c.text }]} numberOfLines={1}>
          {rangeLabel}
        </Text>

        <Pressable
          onPress={() => setOffset((value) => Math.min(0, value + 1))}
          disabled={offset >= 0}
          accessibilityRole="button"
          accessibilityLabel={t('caregiver.week.next')}
          accessibilityState={{ disabled: offset >= 0 }}
          android_ripple={{ color: c.backgroundSelected }}
          style={[
            styles.stepperSquare,
            { borderColor: c.border, backgroundColor: c.backgroundElement },
            offset >= 0 && styles.stepperDisabled,
          ]}>
          <ChevronLeft
            size={20}
            color={offset >= 0 ? c.textSecondary : c.text}
            strokeWidth={2.4}
          />
        </Pressable>
      </View>

      {body()}

      <Surface tone="sunken" style={styles.mirror}>
        <GlyphChip iconName="info" tone="neutral" size="sm" />
        <Text style={[styles.mirrorText, { color: c.textSecondary }]}>
          {t('caregiver.week.mirrorNote')}
        </Text>
      </Surface>

      <DoseSheet dose={openDose} onClose={() => setOpenDose(null)} />
    </FigmaScreen>
  );
}

// ---------------------------------------------------------------------------
// Outcome presentation — status is ALWAYS icon + text, never colour alone.
// «متأخّرة» and «لم تُسجَّل» stay in the NEUTRAL tone on purpose: they are facts
// about a time, and tinting them amber/red would turn the record into a judgement.
// ---------------------------------------------------------------------------

const OUTCOME: Record<DoseOutcome, { tone: StatusTone; iconName: IconName; labelKey: string }> = {
  onTime: { tone: 'success', iconName: 'success', labelKey: 'caregiver.week.onTime' },
  late: { tone: 'neutral', iconName: 'clock', labelKey: 'caregiver.week.late' },
  notRecorded: { tone: 'neutral', iconName: 'dot', labelKey: 'caregiver.week.notRecorded' },
  postponed: { tone: 'warning', iconName: 'clock', labelKey: 'medications.status.postponed' },
  missed: { tone: 'error', iconName: 'error', labelKey: 'medications.status.missed' },
  // A dose whose time has not arrived. Neutral by construction: it is not a
  // status the caregiver earned, it is the clock.
  notDueYet: { tone: 'neutral', iconName: 'clock', labelKey: 'caregiver.week.notDueYet' },
};

const BEAD_STATUS: Record<DoseOutcome, DoseBeadStatus> = {
  onTime: 'given',
  late: 'given',
  notRecorded: null,
  postponed: 'postponed',
  missed: 'missed',
  notDueYet: null,
};

/** DoseBeadStrip is built for ≤5 beads per row; a busy day wraps into more rows. */
const BEADS_PER_ROW = 5;

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** One count line: a plain label and an LTR numeral. No bar, no ratio, no tone. */
function CountRow({
  label,
  value,
  topDivider = false,
}: {
  label: string;
  value: number;
  topDivider?: boolean;
}) {
  const c = useTheme();
  return (
    <View
      style={[
        styles.countRow,
        topDivider && { borderTopWidth: BorderWidth.standard, borderTopColor: c.border },
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label} ${value}`}>
      <Text style={[styles.countLabel, { color: c.text }]}>{label}</Text>
      <Text style={[styles.countValue, { color: c.text }]}>{isolateLtr(String(value))}</Text>
    </View>
  );
}

function DayCard({
  date,
  weekdayIndex,
  doses,
  onOpenDose,
}: {
  date: string;
  weekdayIndex: number;
  doses: CaregiverWeekDose[];
  onOpenDose: (dose: CaregiverWeekDose) => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();

  const beads: DoseBead[] = doses.map((dose) => ({
    key: dose.key,
    status: BEAD_STATUS[dose.outcome],
    time: formatHm(dose.scheduledTime),
  }));

  const weekdayLabel = t(`medications.weekdays.${WEEKDAY_KEYS[weekdayIndex]}`);

  // One spoken summary for the whole strip (its a11y contract): the day, then each
  // outcome that actually occurred with its count. Assembled from translated labels
  // and bare numerals — no fabricated sentence, no bidi marks in a spoken string.
  const spoken = [
    weekdayLabel,
    ...(Object.keys(OUTCOME) as DoseOutcome[])
      .map((outcome) => ({
        outcome,
        n: doses.filter((dose) => dose.outcome === outcome).length,
      }))
      .filter((entry) => entry.n > 0)
      .map((entry) => `${t(OUTCOME[entry.outcome].labelKey)} ${entry.n}`),
  ].join(' · ');

  return (
    <Surface tone="card" gap={10}>
      <View style={styles.dayHeader}>
        <Text style={[styles.dayName, { color: c.text }]} numberOfLines={1}>
          {weekdayLabel}
        </Text>
        <Text style={[styles.dayDate, { color: c.textSecondary }]}>{isolateLtr(date)}</Text>
      </View>

      {/* The strip's a11y contract is ONE spoken summary, so only the first row
          speaks it; a busy day's overflow rows are muted rather than repeating it.
          A single-dose day draws no strip at all: one bead stacked directly over
          the row it summarises is pure duplication, and the frame's sparse day
          shows header + row only. From two doses up the strip earns its place. */}
      {doses.length > 1
        ? chunk(beads, BEADS_PER_ROW).map((row, index) =>
            index === 0 ? (
              <DoseBeadStrip key={row[0]?.key ?? index} beads={row} accessibilityLabel={spoken} />
            ) : (
              <View
                key={row[0]?.key ?? index}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants">
                <DoseBeadStrip beads={row} accessibilityLabel={spoken} />
              </View>
            ),
          )
        : null}

      <View style={styles.doseList}>
        {doses.map((dose) => (
          <DoseRow key={dose.key} dose={dose} onOpen={onOpenDose} />
        ))}
      </View>
    </Surface>
  );
}

function DoseRow({
  dose,
  onOpen,
}: {
  dose: CaregiverWeekDose;
  onOpen: (dose: CaregiverWeekDose) => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const outcome = OUTCOME[dose.outcome];
  const openable = dose.logId != null;

  const content = (
    <>
      <Text style={[styles.doseTime, { color: c.text }]}>{isolateLtr(formatHm(dose.scheduledTime))}</Text>
      <Text style={[styles.doseName, { color: c.text }]} numberOfLines={1}>
        {dose.medicationName}
      </Text>
      <StatusBadge tone={outcome.tone} iconName={outcome.iconName} label={t(outcome.labelKey)} />
    </>
  );

  const rowStyle = [styles.doseRow, { borderColor: c.border, backgroundColor: c.backgroundSunken }];

  if (!openable) {
    return <View style={rowStyle}>{content}</View>;
  }
  return (
    <Pressable
      onPress={() => onOpen(dose)}
      accessibilityRole="button"
      accessibilityLabel={`${dose.medicationName} ${formatHm(dose.scheduledTime)}`}
      accessibilityHint={t('common.details')}
      android_ripple={{ color: c.backgroundSelected }}
      style={rowStyle}>
      {content}
    </Pressable>
  );
}

/**
 * The one recorded dose, read-only. Shows the scheduled time, the time it was
 * recorded, the caregiver's optional note, and her photo — with the ownership note
 * that only she may replace it. There is no destructive affordance here BY DESIGN:
 * no ItemActions, no delete, no replace.
 */
function DoseSheet({
  dose,
  onClose,
}: {
  dose: CaregiverWeekDose | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  if (!dose) return null;
  const outcome = OUTCOME[dose.outcome];

  return (
    <FigmaBottomSheet visible onClose={onClose} title={t('common.details')}>
      <View style={styles.sheetBlock}>
        <Text style={[styles.sheetName, { color: c.text }]}>{dose.medicationName}</Text>
        {dose.dosage ? (
          <Text style={[styles.sheetMeta, { color: c.textSecondary }]}>{dose.dosage}</Text>
        ) : null}
      </View>

      <StatusBadge tone={outcome.tone} iconName={outcome.iconName} label={t(outcome.labelKey)} />

      <View style={styles.sheetBlock}>
        <SheetLine
          label={t('caregiver.week.scheduledAt')}
          value={`${dose.date} ${formatHm(dose.scheduledTime)}`}
        />
        {/* The RECORD's own date, never the dose's: a 23:30 dose written at
            00:12 belongs to one day and was recorded on the next, and gluing the
            two together prints a moment that never happened — on the very line a
            family reads to judge lateness. */}
        {dose.recordedDate && dose.recordedTime ? (
          <SheetLine
            label={t('caregiver.week.recordedAt')}
            value={`${dose.recordedDate} ${dose.recordedTime}`}
          />
        ) : null}
      </View>

      {dose.note ? (
        <Text style={[styles.sheetNote, { color: c.text }]}>{dose.note}</Text>
      ) : null}

      {/* The photo, read-only. `DoseProofImage` owns the absent / loading / failed
          states AND draws `caregiver.proof.ownerNote` under a loaded image, so the
          note is not repeated here. Nothing in this block mutates: the family may
          look at her record, never replace or delete it — hence no ItemActions. */}
      <View style={styles.sheetBlock}>
        <Text style={[styles.sheetPhotoLabel, { color: c.textSecondary }]}>
          {t('caregiver.proof.photoLabel')}
        </Text>
        <DoseProofImage objectPath={dose.proofObjectPath} />
      </View>
    </FigmaBottomSheet>
  );
}

function SheetLine({ label, value }: { label: string; value: string }) {
  const c = useTheme();
  return (
    <View style={styles.sheetLine}>
      <Text style={[styles.sheetLabel, { color: c.textSecondary }]}>{label}</Text>
      <Text style={[styles.sheetValue, { color: c.text }]}>{isolateLtr(value)}</Text>
    </View>
  );
}

/** The Dar bordered error card + retry pill (matches the Pulse / list screens). */
function WeekError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  const c = useTheme();
  return (
    <View style={[styles.errorCard, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
      <Text style={[styles.errorText, { color: c.errorFg }]} accessibilityRole="alert">
        {message}
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        android_ripple={{ color: c.primaryPressed }}
        style={[styles.retry, { backgroundColor: c.primary }]}>
        <Text style={[styles.retryText, { color: c.onPrimary }]}>{t('retry')}</Text>
      </Pressable>
    </View>
  );
}

const STEPPER_SIZE = 44;

const styles = StyleSheet.create({
  group: { gap: 8 },

  notice: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  noticeText: { flex: 1, fontSize: 16, fontFamily: FontFamily.medium, lineHeight: 26 },

  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerChip: {
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: Radius.card,
    borderWidth: BorderWidth.standard,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  pickerChipText: { fontSize: 15 },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperSquare: {
    width: STEPPER_SIZE,
    height: STEPPER_SIZE,
    borderRadius: Radius.card,
    borderWidth: BorderWidth.standard,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepperDisabled: { opacity: 0.45 },
  range: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: FontFamily.semibold,
    writingDirection: 'ltr',
  },

  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
  },
  countLabel: { flex: 1, fontSize: 16, fontFamily: FontFamily.semibold },
  countValue: { fontSize: 22, fontFamily: FontFamily.black, writingDirection: 'ltr' },

  note: { fontSize: 16, fontFamily: FontFamily.medium, lineHeight: 26 },

  // Baseline, not center: the 16/800 weekday and the 14/600 date share a text
  // baseline in the frame, so the smaller date does not float high against it.
  dayHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  dayName: { flexShrink: 1, fontSize: 16, fontFamily: FontFamily.bold },
  dayDate: { fontSize: 14, fontFamily: FontFamily.medium, writingDirection: 'ltr' },

  doseList: { gap: 6 },
  doseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    borderRadius: Radius.control,
    borderWidth: BorderWidth.standard,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  doseTime: { fontSize: 16, fontFamily: FontFamily.semibold, writingDirection: 'ltr' },
  doseName: { flex: 1, fontSize: 16, fontFamily: FontFamily.medium },

  mirror: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mirrorText: { flex: 1, fontSize: 16, fontFamily: FontFamily.medium, lineHeight: 26 },

  sheetBlock: { gap: 6 },
  sheetName: { fontSize: 18, fontFamily: FontFamily.bold, lineHeight: 28 },
  sheetMeta: { fontSize: 16, fontFamily: FontFamily.medium, lineHeight: 26 },
  sheetLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sheetLabel: { fontSize: 16, fontFamily: FontFamily.medium },
  // The photo caption is a short meta label, not a fact line — 14 at ≥600.
  sheetPhotoLabel: { fontSize: 14, fontFamily: FontFamily.medium, lineHeight: 22 },
  sheetValue: { fontSize: 16, fontFamily: FontFamily.semibold, writingDirection: 'ltr' },
  sheetNote: { fontSize: 16, fontFamily: FontFamily.regular, lineHeight: 26 },

  errorCard: { borderWidth: BorderWidth.standard, borderRadius: Radius.card, padding: 20 },
  errorText: { fontSize: 16, fontFamily: FontFamily.semibold, textAlign: 'center', lineHeight: 26 },
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
});
