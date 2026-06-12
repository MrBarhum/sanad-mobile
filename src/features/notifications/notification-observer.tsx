import { useNotificationObservers } from './hooks';

/**
 * Headless component that wires up the notification foreground handler, received/
 * response listeners, launch/resume token refresh, and tap routing. Mount once
 * inside the authenticated app shell (it has no UI).
 */
export function NotificationObserver() {
  useNotificationObservers();
  return null;
}
