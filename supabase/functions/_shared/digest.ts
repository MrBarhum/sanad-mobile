// Arabic-first daily digest composer for remote family members. Like messages.ts
// it contains ONLY family-entered activity counts — never medical interpretation.
// The counts are for the circle-local day; a calm day (no activity) still yields a
// gentle, reassuring message rather than silence.

import type { Message } from './messages.ts';

/** Circle-local counts for one day, used to compose the digest body. */
export type DailyCounts = {
  dosesGiven: number;
  tasksCompleted: number;
  appointments: number;
  visits: number;
  vitals: number;
  logs: number;
};

/** True when nothing was recorded for the day. */
export function isCalmDay(counts: DailyCounts): boolean {
  return (
    counts.dosesGiven === 0 &&
    counts.tasksCompleted === 0 &&
    counts.appointments === 0 &&
    counts.visits === 0 &&
    counts.vitals === 0 &&
    counts.logs === 0
  );
}

/** Arabic pluralization helper for small counts (0/1/2/few/many are simplified). */
function line(count: number, singular: string, plural: string): string | null {
  if (count <= 0) return null;
  return count === 1 ? `${singular}` : `${count} ${plural}`;
}

export function dailySummaryMessage(counts: DailyCounts): Message {
  if (isCalmDay(counts)) {
    return {
      title: 'ملخّص اليوم',
      body: 'يوم هادئ — لا جديد يُذكر اليوم. كل شيء على ما يُرام.',
    };
  }

  const parts = [
    line(counts.dosesGiven, 'جرعة دواء واحدة', 'جرعات دواء'),
    line(counts.tasksCompleted, 'مهمة مكتملة', 'مهام مكتملة'),
    line(counts.appointments, 'موعد', 'مواعيد'),
    line(counts.visits, 'زيارة', 'زيارات'),
    line(counts.vitals, 'قياس', 'قياسات'),
    line(counts.logs, 'سجل يومي', 'سجلات يومية'),
  ].filter((p): p is string => p !== null);

  return {
    title: 'ملخّص اليوم',
    body: `أبرز ما جرى اليوم: ${parts.join('، ')}. اضغط للاطّلاع على نبض اليوم.`,
  };
}
