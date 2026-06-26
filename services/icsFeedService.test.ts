import { describe, expect, it } from 'vitest';
import { buildIcsFeed } from './icsFeedService';
import type { CalendarExportEvent } from './calendarExportService';

type CalendarFeedEvent = CalendarExportEvent & {
  uid: string;
  sourceType: 'subscription' | 'reminder' | 'goal';
  sourceId: string;
};

const event = (override: Partial<CalendarFeedEvent> = {}): CalendarFeedEvent => ({
  uid: 'monoexpire-subscription-account-1',
  sourceType: 'subscription',
  sourceId: 'account-1',
  title: 'Gemini 订阅到期',
  startDate: new Date(2026, 5, 30).getTime(),
  endDate: new Date(2026, 6, 1).getTime(),
  isAllDay: true,
  description: '服务商: Google, needs renewal',
  alerts: [-(24 * 60), -60],
  dedupe: true,
  ...override,
});

const unfold = (ics: string): string => ics.replace(/\r\n[ \t]/g, '');

describe('buildIcsFeed', () => {
  it('builds a complete calendar with escaped text and all-day dates', () => {
    const ics = buildIcsFeed([event()], {
      calendarName: 'MonoExpire',
      now: new Date('2026-06-26T00:00:00.000Z'),
    });

    expect(ics).toContain('BEGIN:VCALENDAR\r\n');
    expect(ics).toContain('VERSION:2.0\r\n');
    expect(ics).toContain('PRODID:-//MonoExpire//Calendar Feed//EN\r\n');
    expect(ics).toContain('X-WR-CALNAME:MonoExpire\r\n');
    expect(ics).toContain('UID:monoexpire-subscription-account-1@monoexpire\r\n');
    expect(ics).toContain('DTSTAMP:20260626T000000Z\r\n');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260630\r\n');
    expect(ics).toContain('DTEND;VALUE=DATE:20260701\r\n');
    expect(ics).toContain('SUMMARY:Gemini 订阅到期\r\n');
    expect(ics).toContain('DESCRIPTION:服务商: Google\\, needs renewal\r\n');
    expect(ics).toContain('X-MONOEXPIRE-SOURCE-TYPE:subscription\r\n');
    expect(ics).toContain('X-MONOEXPIRE-SOURCE-ID:account-1\r\n');
    expect(ics).toContain('TRIGGER:-P1D\r\n');
    expect(ics).toContain('TRIGGER:-PT1H\r\n');
    expect(ics).toContain('END:VCALENDAR\r\n');
  });

  it('formats timed events in UTC', () => {
    const ics = buildIcsFeed([
      event({
        uid: 'monoexpire-reminder-r1-20260626-0830',
        sourceType: 'reminder',
        sourceId: 'r1',
        title: 'Morning check',
        startDate: Date.UTC(2026, 5, 26, 0, 30),
        endDate: Date.UTC(2026, 5, 26, 1, 0),
        isAllDay: false,
        alerts: [-5],
      }),
    ], { now: new Date('2026-06-26T00:00:00.000Z') });

    expect(ics).toContain('DTSTART:20260626T003000Z\r\n');
    expect(ics).toContain('DTEND:20260626T010000Z\r\n');
    expect(ics).toContain('TRIGGER:-PT5M\r\n');
  });

  it('escapes reserved text characters and folds long lines by UTF-8 octets', () => {
    const longDescription = [
      'Renew annual plan',
      'Owner: Finance; Priority: high',
      'Notes: '.repeat(12),
    ].join('\n');

    const ics = buildIcsFeed([event({
      title: 'Long, complex; title \\ with newline\nnext',
      description: longDescription,
      alerts: [],
    })], { now: new Date('2026-06-26T00:00:00.000Z') });

    expect(unfold(ics)).toContain('SUMMARY:Long\\, complex\\; title \\\\ with newline\\nnext\r\n');
    expect(unfold(ics)).toContain('DESCRIPTION:Renew annual plan\\nOwner: Finance\\; Priority: high\\nNotes: ');
    expect(ics).toContain('\r\n ');
    for (const line of ics.split('\r\n').filter(Boolean)) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    }
  });
});
