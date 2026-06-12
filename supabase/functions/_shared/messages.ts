// Arabic-first, neutral reminder copy. It contains ONLY family-provided
// scheduling data (names and times the family entered) — never medical
// interpretation, advice, or a diagnosis. Sanad is Arabic-first today; localizing
// per recipient (profiles.locale) is a planned enhancement.

export type Message = { title: string; body: string };

function hm(time: string): string {
  return time.slice(0, 5);
}

export function medicationDueMessage(medicationName: string, time: string): Message {
  return { title: 'تذكير بالدواء', body: `${medicationName} — الساعة ${hm(time)}` };
}

/** Neutral: only states the family-entered dose has not been recorded yet. */
export function medicationMissedMessage(medicationName: string, time: string): Message {
  return {
    title: 'جرعة لم تُسجَّل',
    body: `لم يُسجَّل بعد تناول جرعة ${medicationName} المقررة الساعة ${hm(time)}.`,
  };
}

export function taskDueMessage(taskTitle: string): Message {
  return { title: 'تذكير بمهمة', body: taskTitle };
}

export function appointmentMessage(appointmentTitle: string, leadMinutes: number): Message {
  const lead = leadMinutes >= 60 ? `${Math.round(leadMinutes / 60)} ساعة` : `${leadMinutes} دقيقة`;
  return { title: 'موعد قادم', body: `${appointmentTitle} — بعد ${lead}` };
}

/**
 * Privacy-preserving copy for the REMOTE push payload (lock screen / provider).
 * It carries NO health detail — no medication name, dosage, vital, note, or
 * recipient name. The authenticated app fetches the real notification (which may
 * contain detail) from the inbox after the user opens it. The detailed
 * title/body above are stored only in the in-app `notifications` row, never sent
 * through Expo.
 */
export function genericPushMessage(): Message {
  return { title: 'سند', body: 'لديك تذكير جديد' };
}
