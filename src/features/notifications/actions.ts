import { setAssignedAppointmentOutcome } from '@/features/claiming/api';
import { fetchScheduledDoseStatus, insertLog } from '@/features/medications/api';
import { completeTask } from '@/features/tasks/api';
import { setVisitStatus } from '@/features/visits/api';

import type { AppNotification } from './api';

/**
 * Notification "تم" (complete) handling for actionable push notifications
 * (Phase 2F-11A). This module maps a notification type to the SAFE, EXISTING domain
 * mutation and NEVER invents new DB writes: if a type has no safe path (or the
 * payload lacks the context to act correctly), it returns 'needs-confirm' so the
 * caller opens the detail screen instead.
 */

/** The shape read out of an actionable push notification's `data`. All fields are
 * optional/untrusted — the server attaches the occurrence context, but a legacy or
 * hand-built notification may omit them. */
export type PushActionData = {
  type?: AppNotification['type'];
  deepLink?: string;
  notificationId?: string;
  circleId?: string;
  categoryId?: string;
  entity?: string;
  itemId?: string;
  medicationId?: string;
  scheduleId?: string;
  doseDate?: string;
  scheduledTime?: string;
  taskId?: string;
  appointmentId?: string;
  [key: string]: unknown;
};

/** Outcome of a "تم" action, so the caller can confirm or navigate. */
export type CompleteOutcome =
  | 'completed' // domain state recorded (or already recorded)
  | 'needs-confirm' // no safe auto path / missing context → open the detail screen
  | 'unauthenticated' // no session → open the detail screen
  | 'error'; // mutation failed → open the detail screen as a fallback

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** PostgREST unique-violation → the scheduled dose was already recorded. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
  );
}

/**
 * Runs the safe existing domain mutation for a "تم" action, chosen by notification
 * type. Idempotent where the domain allows it: completing an already-complete task /
 * visit is a no-op re-set; a medication dose already logged is treated as done (the
 * unique index on schedule/date/time) and never overwritten. For anything other than
 * 'completed', the caller should open the relevant detail screen so the user finishes
 * manually.
 */
export async function completeForNotification(
  type: AppNotification['type'],
  data: PushActionData,
  userId: string | null,
): Promise<CompleteOutcome> {
  if (!userId) return 'unauthenticated';
  try {
    switch (type) {
      case 'task_due':
      case 'task_overdue': {
        const id = str(data.taskId) ?? str(data.itemId);
        if (!id) return 'needs-confirm';
        await completeTask(id, userId, new Date().toISOString());
        return 'completed';
      }
      case 'visit_upcoming':
      case 'visit_update': {
        const id = str(data.itemId);
        if (!id) return 'needs-confirm';
        await setVisitStatus(id, 'completed');
        return 'completed';
      }
      case 'appointment_upcoming': {
        const id = str(data.appointmentId) ?? str(data.itemId);
        if (!id) return 'needs-confirm';
        await setAssignedAppointmentOutcome(id, 'completed');
        return 'completed';
      }
      case 'medication_due':
      case 'medication_missed': {
        const circleId = str(data.circleId);
        const medicationId = str(data.medicationId) ?? str(data.itemId);
        const scheduleId = str(data.scheduleId);
        const doseDate = str(data.doseDate);
        const scheduledTime = str(data.scheduledTime);
        // A dose log needs the full schedule occurrence; without it we cannot record
        // safely, so open the detail screen instead of guessing.
        if (!circleId || !medicationId || !scheduleId || !doseDate || !scheduledTime) {
          return 'needs-confirm';
        }
        try {
          await insertLog({
            circleId,
            medicationId,
            scheduleId,
            doseDate,
            scheduledTime,
            status: 'given',
            recordedBy: userId,
          });
          return 'completed';
        } catch (error) {
          // Already recorded (unique schedule/date/time): never overwrite a prior
          // explicit outcome. Only report success if it was already 'given'; if it is
          // 'missed' / 'postponed', open the detail screen so the caregiver reconciles
          // it consciously rather than being told the dose was recorded.
          if (isUniqueViolation(error)) {
            try {
              const existing = await fetchScheduledDoseStatus(scheduleId, doseDate, scheduledTime);
              return existing && existing !== 'given' ? 'needs-confirm' : 'completed';
            } catch {
              return 'completed';
            }
          }
          throw error;
        }
      }
      default:
        return 'needs-confirm';
    }
  } catch {
    return 'error';
  }
}

/** Short Arabic confirmation shown after a successful "تم" action. */
export function doneMessage(type: AppNotification['type']): string {
  switch (type) {
    case 'task_due':
    case 'task_overdue':
      return 'تم إكمال المهمة';
    case 'medication_due':
    case 'medication_missed':
      return 'تم تسجيل الجرعة';
    case 'visit_upcoming':
    case 'visit_update':
      return 'تم تسجيل الزيارة';
    case 'appointment_upcoming':
      return 'تم تسجيل الموعد';
    default:
      return 'تم';
  }
}
