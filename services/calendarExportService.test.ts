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
    const start = new Date(events[0].startDate);
    const end = new Date(events[0].endDate);
    expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours()]).toEqual([2026, 7, 27, 0]);
    expect([end.getFullYear(), end.getMonth(), end.getDate(), end.getHours()]).toEqual([2026, 7, 28, 0]);
  });

  it('adds stable metadata to subscription events', () => {
    const events = buildCalendarExportEvents('subscription', {
      accounts: [account],
      reminders: [],
      goals: [],
    });

    expect(events[0]).toMatchObject({
      uid: `monoexpire-subscription-${account.id}`,
      sourceType: 'subscription',
      sourceId: account.id,
    });
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

  it('adds date and time to recurring reminder event UIDs', () => {
    const events = buildCalendarExportEvents(
      'reminder',
      { accounts: [], reminders: [reminder], goals: [] },
      new Date('2026-06-26T12:00:00')
    );

    expect(events.map(event => event.uid)).toEqual([
      'monoexpire-reminder-reminder-1-20260626-0830',
      'monoexpire-reminder-reminder-1-20260626-2000',
    ]);
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

  it('adds stable metadata to active goal events', () => {
    const goal: Goal = {
      id: 'goal-1',
      type: 'goal',
      name: 'Ship Mac app',
      deadline: '2026-07-01',
      notes: '',
      isCompleted: false,
      createdAt: '2026-06-26T00:00:00.000Z',
      updatedAt: '2026-06-26T00:00:00.000Z',
    };

    const events = buildCalendarExportEvents('goal', {
      accounts: [],
      reminders: [],
      goals: [goal],
    });

    expect(events[0]).toMatchObject({
      uid: 'monoexpire-goal-goal-1',
      sourceType: 'goal',
      sourceId: 'goal-1',
    });
  });
});
