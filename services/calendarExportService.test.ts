import { describe, expect, it } from 'vitest';
import { buildCalendarExportEvents } from './calendarExportService';
import { Account, Goal, Reminder } from '../types';

const account: Account = {
  id: 'account-1',
  type: 'subscription',
  name: 'Gemini',
  provider: 'Google',
  expirationDate: '2026-08-27',
  notes: 'Annual plan',
};

const reminder: Reminder = {
  id: 'reminder-1',
  type: 'reminder',
  name: 'Drink water',
  times: ['08:30', '20:00'],
  repeatRule: 'none',
  calendarDays: 30,
  notes: 'Hydrate',
};

const goal: Goal = {
  id: 'goal-1',
  type: 'goal',
  name: 'Ship Mac app',
  deadline: '2026-07-10',
  notes: 'Release locally',
};

describe('buildCalendarExportEvents', () => {
  it('builds all-day subscription expiry events with duplicate checks', () => {
    const events = buildCalendarExportEvents('subscription', {
      accounts: [account],
      reminders: [],
      goals: [],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: 'Gemini 订阅到期',
      isAllDay: true,
      description: 'Annual plan',
      alerts: [-(3 * 24 * 60), -(2 * 24 * 60), -(24 * 60), -60],
      dedupe: true,
    });
    expect(new Date(events[0].startDate).toISOString()).toBe('2026-08-27T00:00:00.000Z');
    expect(new Date(events[0].endDate).toISOString()).toBe('2026-08-28T00:00:00.000Z');
  });

  it('builds reminder events from the current day and reminder times', () => {
    const events = buildCalendarExportEvents(
      'reminder',
      {
        accounts: [],
        reminders: [reminder],
        goals: [],
      },
      new Date('2026-06-26T12:00:00')
    );

    expect(events).toHaveLength(2);
    expect(events.map(event => event.title)).toEqual(['Drink water', 'Drink water']);
    expect(events.map(event => new Date(event.startDate).getHours())).toEqual([8, 20]);
    expect(events.map(event => new Date(event.startDate).getMinutes())).toEqual([30, 0]);
    expect(events.every(event => event.dedupe === false)).toBe(true);
  });

  it('skips completed goals and builds active goal deadline events', () => {
    const events = buildCalendarExportEvents('goal', {
      accounts: [],
      reminders: [],
      goals: [
        goal,
        { ...goal, id: 'goal-2', name: 'Done goal', isCompleted: true },
      ],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: '🎯 Ship Mac app 截止',
      isAllDay: true,
      description: 'Release locally',
      alerts: [-(7 * 24 * 60), -(3 * 24 * 60), -(24 * 60)],
      dedupe: true,
    });
  });
});

