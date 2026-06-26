import type { CalendarExportEvent } from './calendarExportService';

export interface IcsFeedOptions {
  calendarName?: string;
  prodId?: string;
  now?: Date;
}

type CalendarFeedEvent = CalendarExportEvent & {
  uid: string;
  sourceType: string;
  sourceId: string;
};

const CRLF = '\r\n';
const MAX_LINE_OCTETS = 75;
const CONTINUATION_PREFIX = ' ';
const UID_DOMAIN = '@monoexpire';
const DEFAULT_CALENDAR_NAME = 'MonoExpire';
const DEFAULT_PROD_ID = '-//MonoExpire//Calendar Feed//EN';
const encoder = new TextEncoder();

const pad = (value: number): string => String(value).padStart(2, '0');

const utf8Length = (value: string): number => encoder.encode(value).length;

const formatUtcDateTime = (date: Date): string => (
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
  `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
);

const formatLocalDate = (date: Date): string => (
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
);

const escapeText = (value: string): string => value
  .replace(/\\/g, '\\\\')
  .replace(/\r?\n/g, '\\n')
  .replace(/,/g, '\\,')
  .replace(/;/g, '\\;');

const formatTrigger = (minutes: number): string => {
  const absMinutes = Math.abs(minutes);
  const days = Math.floor(absMinutes / (24 * 60));
  const hours = Math.floor((absMinutes % (24 * 60)) / 60);
  const remainingMinutes = absMinutes % 60;
  const sign = minutes < 0 ? '-' : '';

  if (days > 0 && hours === 0 && remainingMinutes === 0) {
    return `${sign}P${days}D`;
  }

  const datePart = days > 0 ? `${days}D` : '';
  const hourPart = hours > 0 ? `${hours}H` : '';
  const minutePart = remainingMinutes > 0 ? `${remainingMinutes}M` : '';
  const timePart = hourPart || minutePart ? `T${hourPart}${minutePart}` : 'T0M';

  return `${sign}P${datePart}${timePart}`;
};

const foldLine = (line: string): string => {
  if (utf8Length(line) <= MAX_LINE_OCTETS) {
    return line;
  }

  const folded: string[] = [];
  let current = '';
  let currentLimit = MAX_LINE_OCTETS;

  for (const character of line) {
    const next = `${current}${character}`;
    if (current && utf8Length(next) > currentLimit) {
      folded.push(current);
      current = character;
      currentLimit = MAX_LINE_OCTETS - utf8Length(CONTINUATION_PREFIX);
    } else {
      current = next;
    }
  }

  if (current) {
    folded.push(current);
  }

  return folded
    .map((chunk, index) => index === 0 ? chunk : `${CONTINUATION_PREFIX}${chunk}`)
    .join(CRLF);
};

const eventLines = (event: CalendarFeedEvent, now: Date): string[] => {
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  const lines = [
    'BEGIN:VEVENT',
    `UID:${escapeText(`${event.uid}${UID_DOMAIN}`)}`,
    `DTSTAMP:${formatUtcDateTime(now)}`,
    event.isAllDay
      ? `DTSTART;VALUE=DATE:${formatLocalDate(startDate)}`
      : `DTSTART:${formatUtcDateTime(startDate)}`,
    event.isAllDay
      ? `DTEND;VALUE=DATE:${formatLocalDate(endDate)}`
      : `DTEND:${formatUtcDateTime(endDate)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `X-MONOEXPIRE-SOURCE-TYPE:${escapeText(event.sourceType)}`,
    `X-MONOEXPIRE-SOURCE-ID:${escapeText(event.sourceId)}`,
  ];

  for (const alert of event.alerts) {
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:${escapeText(event.title)}`);
    lines.push(`TRIGGER:${formatTrigger(alert)}`);
    lines.push('END:VALARM');
  }

  lines.push('END:VEVENT');
  return lines;
};

export const buildIcsFeed = (
  events: CalendarExportEvent[],
  options: IcsFeedOptions = {}
): string => {
  const now = options.now || new Date();
  const calendarName = options.calendarName || DEFAULT_CALENDAR_NAME;
  const prodId = options.prodId || DEFAULT_PROD_ID;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    ...events.flatMap(event => eventLines(event as CalendarFeedEvent, now)),
    'END:VCALENDAR',
  ];

  return `${lines.map(foldLine).join(CRLF)}${CRLF}`;
};
