export type NotificationItem = {
  id: string
  message: string
  createdAt: string
  read: boolean
}

const NOTIFICATIONS_KEY = 'drms-notifications'
export const NOTIFICATIONS_CHANGED_EVENT = 'drms-notifications-changed'

function emitNotificationsChanged(): void {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT))
}

function readNotifications(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as NotificationItem[]
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
  } catch {
    return []
  }
}

function writeNotifications(notifications: NotificationItem[]): void {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications))
  emitNotificationsChanged()
}

export function getNotifications(): NotificationItem[] {
  return readNotifications()
}

export function addNotification(message: string): void {
  const notifications = readNotifications()
  const next: NotificationItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    createdAt: new Date().toISOString(),
    read: false,
  }

  const updated = [next, ...notifications].slice(0, 25)
  writeNotifications(updated)
}

export function markAllNotificationsRead(): void {
  const notifications = readNotifications()
  const hasUnread = notifications.some((item) => !item.read)

  if (!hasUnread) {
    return
  }

  writeNotifications(notifications.map((item) => ({ ...item, read: true })))
}
