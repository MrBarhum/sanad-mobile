// Arabic-first, neutral reminder copy. It contains ONLY family-provided
// scheduling data (names and times the family entered) — never medical
// interpretation, advice, or a diagnosis. Sanad is Arabic-first today; localizing
// per recipient (profiles.locale) is a planned enhancement.

export type Message = { title: string; body: string };

function hm(time: string): string {
  return time.slice(0, 5);
}

export function medicationDueMessage(medicationName: string, time: string): Message {
  return { title: 'حان موعد الدواء', body: `حان موعد دواء ${medicationName} — الساعة ${hm(time)}` };
}

/** Neutral: only states the family-entered dose has not been recorded yet. */
export function medicationMissedMessage(medicationName: string, time: string): Message {
  return {
    title: 'جرعة لم تُسجَّل',
    body: `لم يُسجَّل بعد تناول جرعة ${medicationName} المقررة الساعة ${hm(time)}.`,
  };
}

export function taskDueMessage(taskTitle: string): Message {
  return { title: 'حان موعد المهمة', body: `حان موعد مهمة ${taskTitle}` };
}

export function appointmentMessage(appointmentTitle: string, leadMinutes: number): Message {
  const lead = leadMinutes >= 60 ? `${Math.round(leadMinutes / 60)} ساعة` : `${leadMinutes} دقيقة`;
  return { title: 'موعد قادم', body: `حان موعد ${appointmentTitle} — بعد ${lead}` };
}

/** Neutral: only states the family-entered task is still open past its time. */
export function taskOverdueMessage(taskTitle: string): Message {
  return { title: 'مهمة تجاوزت وقتها', body: `ما زالت مهمة ${taskTitle} مفتوحة.` };
}

export function visitUpcomingMessage(visitorName: string, leadMinutes: number): Message {
  const lead = leadMinutes >= 60 ? `${Math.round(leadMinutes / 60)} ساعة` : `${leadMinutes} دقيقة`;
  return { title: 'زيارة قادمة', body: `حان موعد زيارة ${visitorName} — بعد ${lead}` };
}

/**
 * Robust FALLBACK copy for the remote push payload, used only when the source
 * notification row cannot be read at send time (deleted between claim and send).
 * As of Phase 2F-11A the product deliberately sends the DETAILED title/body stored
 * on the `notifications` row (the copy built above) so the reminder clearly says
 * what it is for; this generic text is no longer the default — it is the safety net.
 */
export function genericPushMessage(): Message {
  return { title: 'سند', body: 'لديك تذكير جديد' };
}
