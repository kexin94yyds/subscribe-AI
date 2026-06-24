import { Capacitor } from '@capacitor/core';
import { LocalNotifications, LocalNotificationSchema } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { Account } from '../types';

export type NotificationPermissionState =
  | 'unsupported'
  | 'prompt'
  | 'prompt-with-rationale'
  | 'granted'
  | 'denied';

export interface NotificationSyncResult {
  permission: NotificationPermissionState;
  scheduledCount: number;
  skippedCount: number;
}

const SCHEDULED_NOTIFICATION_IDS_KEY = 'monoexpire_subscription_notification_ids';
const SUBSCRIPTION_NOTIFICATION_CHANNEL_ID = 'subscription-expiry';
const ALERT_DAYS_BEFORE = [7, 3, 1, 0] as const;
const NOTIFICATION_HOUR = 9;
const NOTIFICATION_MINUTE = 0;
const MAX_PENDING_NOTIFICATIONS = 60;

export const isSubscriptionNotificationSupported = (): boolean => {
  return Capacitor.isNativePlatform();
};

export const checkSubscriptionNotificationPermission = async (): Promise<NotificationPermissionState> => {
  if (!isSubscriptionNotificationSupported()) {
    return 'unsupported';
  }

  try {
    const status = await LocalNotifications.checkPermissions();
    return status.display as NotificationPermissionState;
  } catch (error) {
    console.error('Failed to check notification permissions', error);
    return 'denied';
  }
};

export const enableSubscriptionExpiryNotifications = async (
  accounts: Account[]
): Promise<NotificationSyncResult> => {
  if (!isSubscriptionNotificationSupported()) {
    return { permission: 'unsupported', scheduledCount: 0, skippedCount: accounts.length };
  }

  let permission = await checkSubscriptionNotificationPermission();
  if (permission !== 'granted') {
    const requested = await LocalNotifications.requestPermissions();
    permission = requested.display as NotificationPermissionState;
  }

  if (permission !== 'granted') {
    await cancelScheduledSubscriptionNotifications();
    return { permission, scheduledCount: 0, skippedCount: accounts.length };
  }

  return syncSubscriptionExpiryNotifications(accounts);
};

export const syncSubscriptionExpiryNotifications = async (
  accounts: Account[]
): Promise<NotificationSyncResult> => {
  if (!isSubscriptionNotificationSupported()) {
    return { permission: 'unsupported', scheduledCount: 0, skippedCount: accounts.length };
  }

  const permission = await checkSubscriptionNotificationPermission();
  await cancelScheduledSubscriptionNotifications();

  if (permission !== 'granted') {
    return { permission, scheduledCount: 0, skippedCount: accounts.length };
  }

  await ensureAndroidNotificationChannel();

  const notifications = buildSubscriptionExpiryNotifications(accounts);
  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
  }

  await saveScheduledNotificationIds(notifications.map(notification => notification.id));

  return {
    permission,
    scheduledCount: notifications.length,
    skippedCount: accounts.length * ALERT_DAYS_BEFORE.length - notifications.length
  };
};

const ensureAndroidNotificationChannel = async (): Promise<void> => {
  if (Capacitor.getPlatform() !== 'android') return;

  await LocalNotifications.createChannel({
    id: SUBSCRIPTION_NOTIFICATION_CHANNEL_ID,
    name: '订阅到期提醒',
    description: '订阅到期前的系统提醒',
    importance: 4,
    visibility: 1,
    vibration: true
  });
};

const buildSubscriptionExpiryNotifications = (accounts: Account[]): LocalNotificationSchema[] => {
  const now = new Date();

  return accounts
    .flatMap(account => {
      const expiryDate = parseDateOnly(account.expirationDate);
      if (!expiryDate) return [];

      return ALERT_DAYS_BEFORE.map<LocalNotificationSchema | null>(daysBefore => {
        const triggerAt = new Date(expiryDate);
        triggerAt.setDate(triggerAt.getDate() - daysBefore);
        triggerAt.setHours(NOTIFICATION_HOUR, NOTIFICATION_MINUTE, 0, 0);

        if (triggerAt <= now) return null;

        const provider = account.provider ? `（${account.provider}）` : '';
        const body = daysBefore === 0
          ? `${account.name}${provider} 今天到期。`
          : `${account.name}${provider} 还有 ${daysBefore} 天到期。`;

        return {
          id: notificationIdFor(account.id, daysBefore),
          title: 'MonoExpire 订阅到期提醒',
          body,
          schedule: {
            at: triggerAt,
            allowWhileIdle: true
          },
          channelId: SUBSCRIPTION_NOTIFICATION_CHANNEL_ID,
          threadIdentifier: 'monoexpire-subscription-expiry',
          summaryArgument: account.name,
          extra: {
            accountId: account.id,
            accountName: account.name,
            expirationDate: account.expirationDate,
            daysBefore
          }
        };
      }).filter((notification): notification is LocalNotificationSchema => notification !== null);
    })
    .sort((a, b) => {
      const aTime = a.schedule?.at?.getTime() ?? 0;
      const bTime = b.schedule?.at?.getTime() ?? 0;
      return aTime - bTime;
    })
    .slice(0, MAX_PENDING_NOTIFICATIONS);
};

const cancelScheduledSubscriptionNotifications = async (): Promise<void> => {
  const ids = await getScheduledNotificationIds();
  if (ids.length === 0) return;

  try {
    await LocalNotifications.cancel({
      notifications: ids.map(id => ({ id }))
    });
  } catch (error) {
    console.error('Failed to cancel subscription notifications', error);
  } finally {
    await saveScheduledNotificationIds([]);
  }
};

const getScheduledNotificationIds = async (): Promise<number[]> => {
  const { value } = await Preferences.get({ key: SCHEDULED_NOTIFICATION_IDS_KEY });
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is number => Number.isInteger(id))
      : [];
  } catch {
    return [];
  }
};

const saveScheduledNotificationIds = async (ids: number[]): Promise<void> => {
  await Preferences.set({
    key: SCHEDULED_NOTIFICATION_IDS_KEY,
    value: JSON.stringify(ids)
  });
};

const parseDateOnly = (value: string): Date | null => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

const notificationIdFor = (accountId: string, daysBefore: number): number => {
  const hashInput = `${accountId}:${daysBefore}`;
  let hash = 0;

  for (let index = 0; index < hashInput.length; index++) {
    hash = ((hash << 5) - hash + hashInput.charCodeAt(index)) | 0;
  }

  return (hash & 0x7fffffff) || 1;
};
