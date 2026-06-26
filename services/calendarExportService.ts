import { Account, Goal, PageType, Reminder } from '../types';
import { MonoExpireData } from './syncService';

export interface CalendarExportEvent {
  title: string;
  startDate: number;
  endDate: number;
  isAllDay: boolean;
  description: string;
  alerts: number[];
  dedupe: boolean;
}

const dateAtLocalMidnight = (dateValue: string): Date => {
  const [year, month, day] = dateValue.split('-').map(Number);
  if (year && month && day) {
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  const fallback = new Date(dateValue);
  fallback.setHours(0, 0, 0, 0);
  return fallback;
};

const addDays = (date: Date, days: number): Date => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const subscriptionEvent = (account: Account): CalendarExportEvent => {
  const startDate = dateAtLocalMidnight(account.expirationDate);
  const endDate = addDays(startDate, 1);

  return {
    title: `${account.name} 订阅到期`,
    startDate: startDate.getTime(),
    endDate: endDate.getTime(),
    isAllDay: true,
    description: account.notes || (account.provider ? `服务商: ${account.provider}` : ''),
    alerts: [-(3 * 24 * 60), -(2 * 24 * 60), -(24 * 60), -60],
    dedupe: true,
  };
};

const shouldExportReminderOnDay = (reminder: Reminder, dayOffset: number, dayOfWeek: number): boolean => {
  if (reminder.repeatRule === 'none' && dayOffset === 0) {
    return true;
  }
  if (reminder.repeatRule === 'daily') {
    return true;
  }
  if (reminder.repeatRule === 'weekdays') {
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }
  if ((reminder.repeatRule === 'weekly' || reminder.repeatRule === 'custom') && reminder.customDays?.length) {
    return reminder.customDays.includes(dayOfWeek);
  }
  return false;
};

const reminderEvents = (reminder: Reminder, baseDate: Date): CalendarExportEvent[] => {
  const events: CalendarExportEvent[] = [];
  const times = reminder.times || ['08:00'];
  const daysToCreate = reminder.calendarDays || 30;

  for (let dayOffset = 0; dayOffset < daysToCreate; dayOffset++) {
    const eventDate = addDays(baseDate, dayOffset);
    const dayOfWeek = eventDate.getDay();

    if (!shouldExportReminderOnDay(reminder, dayOffset, dayOfWeek)) {
      continue;
    }

    for (const time of times) {
      const [hours, minutes] = time.split(':').map(Number);
      const startTime = new Date(eventDate);
      startTime.setHours(hours || 0, minutes || 0, 0, 0);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 30);

      events.push({
        title: reminder.name,
        startDate: startTime.getTime(),
        endDate: endTime.getTime(),
        isAllDay: false,
        description: reminder.notes || '',
        alerts: [-5],
        dedupe: false,
      });
    }
  }

  return events;
};

const goalEvent = (goal: Goal): CalendarExportEvent | null => {
  if (goal.isCompleted) {
    return null;
  }

  const startDate = dateAtLocalMidnight(goal.deadline);
  const endDate = addDays(startDate, 1);

  return {
    title: `🎯 ${goal.name} 截止`,
    startDate: startDate.getTime(),
    endDate: endDate.getTime(),
    isAllDay: true,
    description: goal.notes || '',
    alerts: [-(7 * 24 * 60), -(3 * 24 * 60), -(24 * 60)],
    dedupe: true,
  };
};

export const buildCalendarExportEvents = (
  pageType: PageType,
  data: MonoExpireData,
  baseDate = new Date()
): CalendarExportEvent[] => {
  if (pageType === 'subscription') {
    return data.accounts.map(subscriptionEvent);
  }

  if (pageType === 'reminder') {
    return data.reminders.flatMap(reminder => reminderEvents(reminder, baseDate));
  }

  return data.goals.flatMap(goal => {
    const event = goalEvent(goal);
    return event ? [event] : [];
  });
};

export const calendarExportTypeLabel = (pageType: PageType): string => {
  if (pageType === 'subscription') return '订阅';
  if (pageType === 'reminder') return '提醒';
  return '目标';
};

