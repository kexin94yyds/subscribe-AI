# ICS Calendar Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a private, subscribable `.ics` calendar feed so MonoExpire data changes can appear on phone and desktop calendars without repeated manual exports.

**Architecture:** Reuse the existing `buildCalendarExportEvents` logic, extend it with stable event identifiers, generate an RFC 5545-compatible read-only iCalendar feed, and publish it to an Appwrite Storage object whose file ID is an unguessable per-user token. Calendar apps subscribe to that URL once; MonoExpire republishes the same feed whenever cloud-synced data changes.

**Tech Stack:** React 19, Vite/Vitest, Appwrite Web SDK `Storage`, existing Appwrite Auth/TablesDB cloud sync, Capacitor Clipboard/Share for iOS sharing, Swift/AppKit macOS shell unchanged except rebuilt assets.

## Global Constraints

- Do not make Calendar clients authenticate. The `.ics` URL must be anonymously readable.
- Treat the feed as read-only projection. Calendar edits do not write back to MonoExpire.
- Keep the existing EventKit/Capacitor manual export path until the ICS feed is verified.
- Do not add a backend Function in the MVP. Use Appwrite Storage plus a private random file ID.
- Store only the feed token in Appwrite account preferences; store the generated `.ics` content in Appwrite Storage.
- The Storage bucket must be configured separately as `VITE_APPWRITE_CALENDAR_FEED_BUCKET_ID`.
- Feed URL privacy depends on token secrecy. Provide a rotate/revoke action.
- All calendar generation must be tested as pure functions before UI/storage integration.

---

## File Structure

- Modify `services/calendarExportService.ts`
  - Add stable metadata to generated calendar events: `uid`, `sourceType`, `sourceId`.
  - Preserve current button behavior by keeping existing fields unchanged.
- Create `services/icsFeedService.ts`
  - Convert `CalendarExportEvent[]` into a full `VCALENDAR` string.
  - Escape text, format all-day and timed dates, and convert alert minutes into `VALARM`.
- Create `services/icsFeedService.test.ts`
  - Validate event UIDs, all-day date output, timed UTC output, escaping, and alarms.
- Modify `services/appwriteClient.ts`
  - Add optional `Storage` client and `calendarFeedBucketId` config.
- Create `services/calendarFeedStorageService.ts`
  - Manage feed token via Appwrite account prefs.
  - Publish/delete the deterministic feed file in Appwrite Storage.
  - Build the subscribe URL.
- Create `services/calendarFeedStorageService.test.ts`
  - Test token creation, URL building, create/delete/create conflict path, and revoke.
- Modify `components/SyncModal.tsx`
  - Add a compact Calendar Feed section when cloud sync is configured.
  - Provide enable, copy/share URL, republish, and rotate actions.
- Modify `components/SyncModal.test.tsx`
  - Cover feed URL display/copy actions and disabled state.
- Modify `App.tsx`
  - Wire feed publishing after successful cloud sync and after feed enable/republish actions.
  - Debounce publishing to avoid one upload per keystroke.
- Modify `appwrite/monoexpire_items.md`
  - Document the new Storage bucket and env var.
- Update `.env.example` if present; otherwise document `VITE_APPWRITE_CALENDAR_FEED_BUCKET_ID` only in `appwrite/monoexpire_items.md`.

---

### Task 1: Add Stable Calendar Event Metadata

**Files:**
- Modify: `services/calendarExportService.ts`
- Test: `services/calendarExportService.test.ts`

**Interfaces:**
- Consumes: existing `Account`, `Reminder`, `Goal`, `PageType`, `MonoExpireData`
- Produces:
  ```ts
  export type CalendarExportSourceType = 'subscription' | 'reminder' | 'goal';

  export interface CalendarExportEvent {
    uid: string;
    sourceType: CalendarExportSourceType;
    sourceId: string;
    title: string;
    startDate: number;
    endDate: number;
    isAllDay: boolean;
    description: string;
    alerts: number[];
    dedupe: boolean;
  }
  ```

- [ ] **Step 1: Write failing tests for stable UIDs**

Add these cases to `services/calendarExportService.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- services/calendarExportService.test.ts
```

Expected: FAIL because `uid`, `sourceType`, and `sourceId` are missing.

- [ ] **Step 3: Implement metadata**

In `services/calendarExportService.ts`, update each event builder:

```ts
const dateStamp = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const timeStamp = (time: string): string => time.replace(':', '').padStart(4, '0');
```

Use these values:

```ts
uid: `monoexpire-subscription-${account.id}`,
sourceType: 'subscription',
sourceId: account.id,
```

```ts
uid: `monoexpire-reminder-${reminder.id}-${dateStamp(eventDate)}-${timeStamp(time)}`,
sourceType: 'reminder',
sourceId: reminder.id,
```

```ts
uid: `monoexpire-goal-${goal.id}`,
sourceType: 'goal',
sourceId: goal.id,
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
npm test -- services/calendarExportService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/calendarExportService.ts services/calendarExportService.test.ts
git commit -m "feat: add stable calendar event metadata"
```

---

### Task 2: Generate RFC 5545 ICS Content

**Files:**
- Create: `services/icsFeedService.ts`
- Create: `services/icsFeedService.test.ts`

**Interfaces:**
- Consumes:
  ```ts
  import { CalendarExportEvent } from './calendarExportService';
  ```
- Produces:
  ```ts
  export interface IcsFeedOptions {
    calendarName?: string;
    prodId?: string;
    now?: Date;
  }

  export const buildIcsFeed = (
    events: CalendarExportEvent[],
    options?: IcsFeedOptions
  ): string;
  ```

- [ ] **Step 1: Write failing ICS tests**

Create `services/icsFeedService.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildIcsFeed } from './icsFeedService';
import { CalendarExportEvent } from './calendarExportService';

const event = (override: Partial<CalendarExportEvent> = {}): CalendarExportEvent => ({
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

describe('buildIcsFeed', () => {
  it('builds a complete calendar with escaped text and all-day dates', () => {
    const ics = buildIcsFeed([event()], {
      calendarName: 'MonoExpire',
      now: new Date('2026-06-26T00:00:00.000Z'),
    });

    expect(ics).toContain('BEGIN:VCALENDAR\\r\\n');
    expect(ics).toContain('VERSION:2.0\\r\\n');
    expect(ics).toContain('PRODID:-//MonoExpire//Calendar Feed//EN\\r\\n');
    expect(ics).toContain('X-WR-CALNAME:MonoExpire\\r\\n');
    expect(ics).toContain('UID:monoexpire-subscription-account-1@monoexpire\\r\\n');
    expect(ics).toContain('DTSTAMP:20260626T000000Z\\r\\n');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260630\\r\\n');
    expect(ics).toContain('DTEND;VALUE=DATE:20260701\\r\\n');
    expect(ics).toContain('SUMMARY:Gemini 订阅到期\\r\\n');
    expect(ics).toContain('DESCRIPTION:服务商: Google\\\\, needs renewal\\r\\n');
    expect(ics).toContain('TRIGGER:-P1D\\r\\n');
    expect(ics).toContain('TRIGGER:-PT1H\\r\\n');
    expect(ics).toContain('END:VCALENDAR\\r\\n');
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

    expect(ics).toContain('DTSTART:20260626T003000Z\\r\\n');
    expect(ics).toContain('DTEND:20260626T010000Z\\r\\n');
    expect(ics).toContain('TRIGGER:-PT5M\\r\\n');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test -- services/icsFeedService.test.ts
```

Expected: FAIL because `services/icsFeedService.ts` does not exist.

- [ ] **Step 3: Implement ICS service**

Create `services/icsFeedService.ts` with these functions:

```ts
import { CalendarExportEvent } from './calendarExportService';

export interface IcsFeedOptions {
  calendarName?: string;
  prodId?: string;
  now?: Date;
}

const CRLF = '\r\n';

const pad = (value: number): string => String(value).padStart(2, '0');

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
  const abs = Math.abs(minutes);
  const days = Math.floor(abs / (24 * 60));
  const hours = Math.floor((abs % (24 * 60)) / 60);
  const remainingMinutes = abs % 60;
  const sign = minutes < 0 ? '-' : '';

  if (days > 0 && hours === 0 && remainingMinutes === 0) return `${sign}P${days}D`;

  const hourPart = hours > 0 ? `${hours}H` : '';
  const minutePart = remainingMinutes > 0 ? `${remainingMinutes}M` : '';
  return `${sign}PT${hourPart}${minutePart || '0M'}`;
};

const foldLine = (line: string): string => {
  const maxLength = 75;
  if (line.length <= maxLength) return line;

  const chunks: string[] = [];
  let remaining = line;
  while (remaining.length > maxLength) {
    chunks.push(remaining.slice(0, maxLength));
    remaining = ` ${remaining.slice(maxLength)}`;
  }
  chunks.push(remaining);
  return chunks.join(CRLF);
};

const eventLines = (event: CalendarExportEvent, now: Date): string[] => {
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.uid}@monoexpire`,
    `DTSTAMP:${formatUtcDateTime(now)}`,
    event.isAllDay
      ? `DTSTART;VALUE=DATE:${formatLocalDate(startDate)}`
      : `DTSTART:${formatUtcDateTime(startDate)}`,
    event.isAllDay
      ? `DTEND;VALUE=DATE:${formatLocalDate(endDate)}`
      : `DTEND:${formatUtcDateTime(endDate)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `X-MONOEXPIRE-SOURCE-TYPE:${event.sourceType}`,
    `X-MONOEXPIRE-SOURCE-ID:${event.sourceId}`,
  ];

  event.alerts.forEach(alert => {
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:${escapeText(event.title)}`);
    lines.push(`TRIGGER:${formatTrigger(alert)}`);
    lines.push('END:VALARM');
  });

  lines.push('END:VEVENT');
  return lines;
};

export const buildIcsFeed = (
  events: CalendarExportEvent[],
  options: IcsFeedOptions = {}
): string => {
  const now = options.now || new Date();
  const calendarName = options.calendarName || 'MonoExpire';
  const prodId = options.prodId || '-//MonoExpire//Calendar Feed//EN';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    ...events.flatMap(event => eventLines(event, now)),
    'END:VCALENDAR',
  ];

  return `${lines.map(foldLine).join(CRLF)}${CRLF}`;
};
```

- [ ] **Step 4: Run tests**

```bash
npm test -- services/icsFeedService.test.ts services/calendarExportService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/icsFeedService.ts services/icsFeedService.test.ts services/calendarExportService.ts services/calendarExportService.test.ts
git commit -m "feat: generate monoexpire ics feed"
```

---

### Task 3: Add Appwrite Storage Feed Publishing

**Files:**
- Modify: `services/appwriteClient.ts`
- Create: `services/calendarFeedStorageService.ts`
- Create: `services/calendarFeedStorageService.test.ts`
- Modify: `appwrite/monoexpire_items.md`

**Interfaces:**
- Consumes:
  ```ts
  import { MonoExpireData } from './syncService';
  ```
- Produces:
  ```ts
  export interface CalendarFeedState {
    enabled: boolean;
    token: string | null;
    url: string | null;
  }

  export const isCalendarFeedConfigured: () => boolean;
  export const getCalendarFeedState: () => Promise<CalendarFeedState>;
  export const enableCalendarFeed: (data: MonoExpireData) => Promise<CalendarFeedState>;
  export const publishCalendarFeed: (data: MonoExpireData) => Promise<CalendarFeedState>;
  export const revokeCalendarFeed: () => Promise<CalendarFeedState>;
  ```

- [ ] **Step 1: Write failing storage tests**

Create `services/calendarFeedStorageService.test.ts` with dependency injection helpers:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCalendarFeedUrl,
  createCalendarFeedService,
} from './calendarFeedStorageService';

describe('buildCalendarFeedUrl', () => {
  it('builds a public Appwrite file view URL', () => {
    expect(buildCalendarFeedUrl({
      endpoint: 'https://cloud.appwrite.io/v1',
      projectId: 'project-1',
      bucketId: 'bucket-1',
      fileId: 'cal_123',
    })).toBe('https://cloud.appwrite.io/v1/storage/buckets/bucket-1/files/cal_123/view?project=project-1');
  });
});

describe('createCalendarFeedService', () => {
  const account = {
    getPrefs: vi.fn(),
    updatePrefs: vi.fn(),
    get: vi.fn(),
  };
  const storage = {
    createFile: vi.fn(),
    deleteFile: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    account.get.mockResolvedValue({ $id: 'user-1' });
    account.getPrefs.mockResolvedValue({});
    account.updatePrefs.mockImplementation(async prefs => prefs);
    storage.createFile.mockResolvedValue({});
    storage.deleteFile.mockResolvedValue({});
  });

  it('creates a token and uploads an ICS file when enabling feed', async () => {
    const service = createCalendarFeedService({
      account,
      storage,
      config: {
        endpoint: 'https://cloud.appwrite.io/v1',
        projectId: 'project-1',
        bucketId: 'bucket-1',
      },
      randomToken: () => 'abcdef1234567890abcdef1234567890',
      buildIcs: () => 'BEGIN:VCALENDAR\\r\\nEND:VCALENDAR\\r\\n',
    });

    const state = await service.enableCalendarFeed({ accounts: [], reminders: [], goals: [] });

    expect(account.updatePrefs).toHaveBeenCalledWith({
      monoexpireCalendarFeedEnabled: true,
      monoexpireCalendarFeedToken: 'abcdef1234567890abcdef1234567890',
    });
    expect(storage.createFile).toHaveBeenCalledTimes(1);
    expect(state.url).toContain('/storage/buckets/bucket-1/files/cal_abcdef1234567890abcdef1234567890/view?project=project-1');
  });

  it('deletes and recreates the file if Appwrite reports a file conflict', async () => {
    storage.createFile
      .mockRejectedValueOnce({ code: 409 })
      .mockResolvedValueOnce({});
    account.getPrefs.mockResolvedValue({
      monoexpireCalendarFeedEnabled: true,
      monoexpireCalendarFeedToken: 'abcdef1234567890abcdef1234567890',
    });

    const service = createCalendarFeedService({
      account,
      storage,
      config: {
        endpoint: 'https://cloud.appwrite.io/v1',
        projectId: 'project-1',
        bucketId: 'bucket-1',
      },
      randomToken: () => 'unused',
      buildIcs: () => 'BEGIN:VCALENDAR\\r\\nEND:VCALENDAR\\r\\n',
    });

    await service.publishCalendarFeed({ accounts: [], reminders: [], goals: [] });

    expect(storage.deleteFile).toHaveBeenCalledTimes(1);
    expect(storage.createFile).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test -- services/calendarFeedStorageService.test.ts
```

Expected: FAIL because `calendarFeedStorageService.ts` does not exist.

- [ ] **Step 3: Modify Appwrite client**

In `services/appwriteClient.ts`, import and export Storage:

```ts
import { Account as AppwriteAccount, AppwriteException, Client, Storage, TablesDB } from 'appwrite';

const appwriteCalendarFeedBucketId = import.meta.env.VITE_APPWRITE_CALENDAR_FEED_BUCKET_ID;

export const appwriteConfig = {
  endpoint: appwriteEndpoint,
  projectId: appwriteProjectId,
  databaseId: appwriteDatabaseId,
  tableId: appwriteTableId,
  calendarFeedBucketId: appwriteCalendarFeedBucketId,
};

export const appwriteStorage = appwriteClient ? new Storage(appwriteClient) : null;
```

Do not make `VITE_APPWRITE_CALENDAR_FEED_BUCKET_ID` required for normal cloud sync. Add a separate calendar feed config check in the new service.

- [ ] **Step 4: Implement storage service**

Create `services/calendarFeedStorageService.ts` with:

```ts
import { ID, Permission, Role } from 'appwrite';
import { buildCalendarExportEvents } from './calendarExportService';
import { buildIcsFeed } from './icsFeedService';
import { appwriteAccount, appwriteConfig, appwriteStorage } from './appwriteClient';
import { MonoExpireData } from './syncService';

const ENABLED_PREF = 'monoexpireCalendarFeedEnabled';
const TOKEN_PREF = 'monoexpireCalendarFeedToken';

export interface CalendarFeedState {
  enabled: boolean;
  token: string | null;
  url: string | null;
}

interface CalendarFeedUrlOptions {
  endpoint: string;
  projectId: string;
  bucketId: string;
  fileId: string;
}

interface CalendarFeedDependencies {
  account: {
    get: () => Promise<{ $id: string }>;
    getPrefs: () => Promise<Record<string, unknown>>;
    updatePrefs: (prefs: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
  storage: {
    createFile: (...args: any[]) => Promise<unknown>;
    deleteFile: (...args: any[]) => Promise<unknown>;
  };
  config: {
    endpoint: string;
    projectId: string;
    bucketId: string;
  };
  randomToken: () => string;
  buildIcs: (data: MonoExpireData) => string;
}

export const isCalendarFeedConfigured = (): boolean => Boolean(
  appwriteAccount &&
  appwriteStorage &&
  appwriteConfig.endpoint &&
  appwriteConfig.projectId &&
  appwriteConfig.calendarFeedBucketId
);

export const feedFileIdForToken = (token: string): string => `cal_${token.slice(0, 32)}`;

export const buildCalendarFeedUrl = (options: CalendarFeedUrlOptions): string => (
  `${options.endpoint}/storage/buckets/${options.bucketId}/files/${options.fileId}/view?project=${options.projectId}`
);

const randomToken = (): string => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, '');
  }

  return ID.unique().replace(/[^a-zA-Z0-9]/g, '').padEnd(32, '0').slice(0, 32);
};

const buildIcs = (data: MonoExpireData): string => buildIcsFeed([
  ...buildCalendarExportEvents('subscription', data),
  ...buildCalendarExportEvents('reminder', data),
  ...buildCalendarExportEvents('goal', data),
]);

export const createCalendarFeedService = (deps: CalendarFeedDependencies) => {
  const stateFromPrefs = (prefs: Record<string, unknown>): CalendarFeedState => {
    const enabled = prefs[ENABLED_PREF] === true;
    const token = typeof prefs[TOKEN_PREF] === 'string' ? prefs[TOKEN_PREF] : null;
    const fileId = token ? feedFileIdForToken(token) : null;
    return {
      enabled,
      token,
      url: token ? buildCalendarFeedUrl({ ...deps.config, fileId: fileId! }) : null,
    };
  };

  const upload = async (token: string, data: MonoExpireData) => {
    const fileId = feedFileIdForToken(token);
    const ics = deps.buildIcs(data);
    const file = new File([ics], `${fileId}.ics`, { type: 'text/calendar;charset=utf-8' });
    const permissions = [Permission.read(Role.any())];

    try {
      await deps.storage.createFile({
        bucketId: deps.config.bucketId,
        fileId,
        file,
        permissions,
      });
    } catch (error: any) {
      if (error?.code !== 409) throw error;
      await deps.storage.deleteFile({ bucketId: deps.config.bucketId, fileId });
      await deps.storage.createFile({
        bucketId: deps.config.bucketId,
        fileId,
        file,
        permissions,
      });
    }
  };

  return {
    getCalendarFeedState: async (): Promise<CalendarFeedState> => {
      const prefs = await deps.account.getPrefs();
      return stateFromPrefs(prefs);
    },
    enableCalendarFeed: async (data: MonoExpireData): Promise<CalendarFeedState> => {
      await deps.account.get();
      const prefs = await deps.account.getPrefs();
      const token = typeof prefs[TOKEN_PREF] === 'string' ? prefs[TOKEN_PREF] : deps.randomToken();
      const nextPrefs = { ...prefs, [ENABLED_PREF]: true, [TOKEN_PREF]: token };
      await deps.account.updatePrefs(nextPrefs);
      await upload(token, data);
      return stateFromPrefs(nextPrefs);
    },
    publishCalendarFeed: async (data: MonoExpireData): Promise<CalendarFeedState> => {
      const prefs = await deps.account.getPrefs();
      const state = stateFromPrefs(prefs);
      if (!state.enabled || !state.token) return state;
      await upload(state.token, data);
      return state;
    },
    revokeCalendarFeed: async (): Promise<CalendarFeedState> => {
      const prefs = await deps.account.getPrefs();
      const state = stateFromPrefs(prefs);
      if (state.token) {
        await deps.storage.deleteFile({
          bucketId: deps.config.bucketId,
          fileId: feedFileIdForToken(state.token),
        }).catch(() => undefined);
      }
      const nextPrefs = { ...prefs, [ENABLED_PREF]: false, [TOKEN_PREF]: deps.randomToken() };
      await deps.account.updatePrefs(nextPrefs);
      return stateFromPrefs(nextPrefs);
    },
  };
};

const runtimeService = () => {
  if (!isCalendarFeedConfigured() || !appwriteAccount || !appwriteStorage || !appwriteConfig.calendarFeedBucketId) {
    throw new Error('Calendar feed is not configured');
  }

  return createCalendarFeedService({
    account: appwriteAccount,
    storage: appwriteStorage,
    config: {
      endpoint: appwriteConfig.endpoint,
      projectId: appwriteConfig.projectId,
      bucketId: appwriteConfig.calendarFeedBucketId,
    },
    randomToken,
    buildIcs,
  });
};

export const getCalendarFeedState = () => runtimeService().getCalendarFeedState();
export const enableCalendarFeed = (data: MonoExpireData) => runtimeService().enableCalendarFeed(data);
export const publishCalendarFeed = (data: MonoExpireData) => runtimeService().publishCalendarFeed(data);
export const revokeCalendarFeed = () => runtimeService().revokeCalendarFeed();
```

- [ ] **Step 5: Update Appwrite docs**

Add to `appwrite/monoexpire_items.md`:

````md
## Calendar Feed Storage

Optional env:

```env
VITE_APPWRITE_CALENDAR_FEED_BUCKET_ID=<BUCKET_ID>
```

Create one Storage bucket for generated `.ics` feeds. Calendar feed files must allow anonymous read access because Apple Calendar, Google Calendar, and other subscribers cannot send Appwrite user sessions.

Security model:
- File IDs are generated from a per-user random token stored in Appwrite account preferences.
- The feed URL is private-by-token, not private-by-auth.
- Rotating the feed deletes the old file and creates a new token/file URL.
````

- [ ] **Step 6: Run tests**

```bash
npm test -- services/calendarFeedStorageService.test.ts services/icsFeedService.test.ts services/calendarExportService.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add services/appwriteClient.ts services/calendarFeedStorageService.ts services/calendarFeedStorageService.test.ts appwrite/monoexpire_items.md
git commit -m "feat: publish private ics feed to appwrite storage"
```

---

### Task 4: Add Calendar Feed UI

**Files:**
- Modify: `components/SyncModal.tsx`
- Modify: `components/SyncModal.test.tsx`
- Modify: `App.tsx`

**Interfaces:**
- Consumes:
  ```ts
  CalendarFeedState
  enableCalendarFeed(data)
  publishCalendarFeed(data)
  revokeCalendarFeed()
  ```
- Produces:
  ```ts
  interface SyncModalProps {
    // existing props
    calendarFeed?: CalendarFeedState;
    isCalendarFeedConfigured?: boolean;
    onEnableCalendarFeed?: () => Promise<void>;
    onRepublishCalendarFeed?: () => Promise<void>;
    onRevokeCalendarFeed?: () => Promise<void>;
  }
  ```

- [ ] **Step 1: Write failing UI tests**

Add to `components/SyncModal.test.tsx`:

```tsx
it('shows calendar feed controls when configured and signed in', () => {
  render(
    <SyncModal
      isOpen
      onClose={() => undefined}
      cloudSyncStatus="synced"
      isCloudConfigured
      syncCounts={{ accounts: 1, reminders: 0, goals: 0, total: 1 }}
      calendarFeed={{
        enabled: true,
        token: 'abcdef1234567890abcdef1234567890',
        url: 'https://cloud.appwrite.io/v1/storage/buckets/bucket/files/cal_abcdef/view?project=project',
      }}
      isCalendarFeedConfigured
      onEnableCalendarFeed={async () => undefined}
      onRepublishCalendarFeed={async () => undefined}
      onRevokeCalendarFeed={async () => undefined}
    />
  );

  expect(screen.getByText('日历订阅')).toBeInTheDocument();
  expect(screen.getByText('复制订阅链接')).toBeInTheDocument();
  expect(screen.getByText('重新发布')).toBeInTheDocument();
  expect(screen.getByText('重置链接')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run UI test to verify failure**

```bash
npm test -- components/SyncModal.test.tsx
```

Expected: FAIL because the props and UI do not exist.

- [ ] **Step 3: Add SyncModal props and UI**

Add props to `components/SyncModal.tsx` and render a small section near cloud sync status:

```tsx
{isCloudConfigured && isCalendarFeedConfigured && (
  <section className="border-t border-gray-200 pt-4">
    <h3 className="text-sm font-semibold text-gray-900">日历订阅</h3>
    {calendarFeed?.enabled && calendarFeed.url ? (
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onCopyCalendarFeedUrl}>复制订阅链接</button>
        <button type="button" onClick={onRepublishCalendarFeed}>重新发布</button>
        <button type="button" onClick={onRevokeCalendarFeed}>重置链接</button>
      </div>
    ) : (
      <button type="button" onClick={onEnableCalendarFeed}>开启日历订阅</button>
    )}
  </section>
)}
```

Use the existing button styling conventions in the file instead of creating a new design language.

- [ ] **Step 4: Wire App state**

In `App.tsx`:

```ts
const [calendarFeed, setCalendarFeed] = useState<CalendarFeedState | undefined>();

const currentMonoExpireData = (): MonoExpireData => ({ accounts, reminders, goals });

const handleEnableCalendarFeed = async () => {
  const state = await enableCalendarFeed(currentMonoExpireData());
  setCalendarFeed(state);
};

const handleRepublishCalendarFeed = async () => {
  const state = await publishCalendarFeed(currentMonoExpireData());
  setCalendarFeed(state);
};

const handleRevokeCalendarFeed = async () => {
  const state = await revokeCalendarFeed();
  setCalendarFeed(state);
};
```

Load feed state after cloud session loads:

```ts
if (isCalendarFeedConfigured() && session) {
  setCalendarFeed(await getCalendarFeedState());
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- components/SyncModal.test.tsx
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add App.tsx components/SyncModal.tsx components/SyncModal.test.tsx
git commit -m "feat: add calendar feed controls"
```

---

### Task 5: Auto-Publish Feed After Data Changes

**Files:**
- Modify: `App.tsx`
- Test: add focused tests only if `App.tsx` has existing practical coverage; otherwise test the debounce helper separately in `services/calendarFeedAutoPublishService.ts`
- Create if needed: `services/calendarFeedAutoPublishService.ts`
- Create if needed: `services/calendarFeedAutoPublishService.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const shouldPublishCalendarFeed = (
    isLoaded: boolean,
    calendarFeed: CalendarFeedState | undefined,
    pendingCloudSync: boolean
  ): boolean;
  ```

- [ ] **Step 1: Write failing helper tests**

Create `services/calendarFeedAutoPublishService.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { shouldPublishCalendarFeed } from './calendarFeedAutoPublishService';

describe('shouldPublishCalendarFeed', () => {
  it('publishes only after data is loaded, feed is enabled, and cloud sync is not pending', () => {
    expect(shouldPublishCalendarFeed(false, { enabled: true, token: 't', url: 'u' }, false)).toBe(false);
    expect(shouldPublishCalendarFeed(true, undefined, false)).toBe(false);
    expect(shouldPublishCalendarFeed(true, { enabled: false, token: 't', url: 'u' }, false)).toBe(false);
    expect(shouldPublishCalendarFeed(true, { enabled: true, token: 't', url: 'u' }, true)).toBe(false);
    expect(shouldPublishCalendarFeed(true, { enabled: true, token: 't', url: 'u' }, false)).toBe(true);
  });
});
```

- [ ] **Step 2: Run helper test to verify failure**

```bash
npm test -- services/calendarFeedAutoPublishService.test.ts
```

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement helper**

Create `services/calendarFeedAutoPublishService.ts`:

```ts
import { CalendarFeedState } from './calendarFeedStorageService';

export const shouldPublishCalendarFeed = (
  isLoaded: boolean,
  calendarFeed: CalendarFeedState | undefined,
  pendingCloudSync: boolean
): boolean => Boolean(
  isLoaded &&
  calendarFeed?.enabled &&
  calendarFeed.token &&
  calendarFeed.url &&
  !pendingCloudSync
);
```

- [ ] **Step 4: Wire debounce in App**

In `App.tsx`, add an effect:

```ts
useEffect(() => {
  if (!shouldPublishCalendarFeed(isLoaded, calendarFeed, pendingCloudSync)) return;

  const timer = window.setTimeout(() => {
    publishCalendarFeed({ accounts, reminders, goals })
      .then(setCalendarFeed)
      .catch(error => console.error('Failed to publish calendar feed', error));
  }, 1500);

  return () => window.clearTimeout(timer);
}, [accounts, reminders, goals, isLoaded, calendarFeed?.enabled, calendarFeed?.token, pendingCloudSync]);
```

This intentionally publishes after local changes and after cloud merge changes. It does not publish while cloud sync is pending.

- [ ] **Step 5: Run tests and typecheck**

```bash
npm test -- services/calendarFeedAutoPublishService.test.ts services/calendarFeedStorageService.test.ts services/icsFeedService.test.ts services/calendarExportService.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add App.tsx services/calendarFeedAutoPublishService.ts services/calendarFeedAutoPublishService.test.ts
git commit -m "feat: auto publish calendar feed after changes"
```

---

### Task 6: Build, Sync, and Manual Subscription Verification

**Files:**
- Modify only if needed: `appwrite/monoexpire_items.md`
- Generated: `dist/`, `ios/App/App/public/`, `release/mac/MonoExpire.app`

**Interfaces:**
- Consumes all earlier tasks.
- Produces a verified feed URL copied from the Sync modal.

- [ ] **Step 1: Configure Appwrite Storage bucket**

In Appwrite Console:

```text
Storage > Create bucket
Bucket ID: monoexpire_calendar_feeds
File security: enabled
Allowed file extensions: ics
Maximum file size: 1 MB
```

Add to `.env.local`:

```env
VITE_APPWRITE_CALENDAR_FEED_BUCKET_ID=monoexpire_calendar_feeds
```

- [ ] **Step 2: Run full verification**

```bash
npm test -- services/calendarExportService.test.ts services/icsFeedService.test.ts services/calendarFeedStorageService.test.ts services/calendarFeedAutoPublishService.test.ts components/SyncModal.test.tsx services/cloudSyncService.test.ts
npx tsc --noEmit
npm run build
npx cap sync ios
swift test --package-path macos
./script/build_and_run.sh --verify
```

Expected:
- All tests pass.
- TypeScript exits 0.
- Vite build exits 0.
- Capacitor sync exits 0.
- Swift tests pass.
- Mac app launches at `http://localhost:41731/`.

- [ ] **Step 3: Verify the ICS URL with curl**

After enabling the feed in the app, copy the subscription URL and run:

```bash
curl -fsSL "<COPIED_FEED_URL>" | sed -n '1,40p'
```

Expected first lines:

```text
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MonoExpire//Calendar Feed//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:MonoExpire
```

- [ ] **Step 4: Verify phone subscription**

Manual iPhone check:

```text
Settings > Calendar > Accounts > Add Account > Other > Add Subscribed Calendar
Paste the copied MonoExpire feed URL
Save
```

Expected:
- Subscription appears as `MonoExpire`.
- Subscription/goal all-day events appear.
- Timed reminder events appear in the next generated window.
- Editing MonoExpire data and reopening the app republishes the feed. Calendar refresh timing is controlled by iOS and may not be immediate.

- [ ] **Step 5: Commit docs/config updates**

```bash
git add appwrite/monoexpire_items.md package.json package-lock.json
git commit -m "docs: document calendar feed setup"
```

---

## Risks and Decisions

- Calendar refresh delay is controlled by Apple/Google/Microsoft. MonoExpire can publish immediately, but subscribers may refresh later.
- The feed is public to anyone who has the URL. Token rotation must delete the old feed file and generate a new URL.
- The MVP is one-way. Calendar edits do not update MonoExpire.
- Storage delete/recreate can create a short 404 window during republish. If this becomes visible, switch to Appwrite Function dynamic rendering in a later plan.
- Existing reminder export expands recurring reminders into a finite window. Keep using the user's `calendarDays` setting.
- If the user wants true two-way sync with Google/Outlook, build a separate OAuth provider integration plan instead of extending this ICS plan.

## Self-Review

- Spec coverage: The plan covers ICS generation, public subscription URL, Appwrite storage publishing, UI controls, automatic republishing, iOS/macOS build sync, and manual phone validation.
- Placeholder scan: The plan contains no unfinished placeholder instructions or vague deferred implementation notes.
- Type consistency: `CalendarFeedState`, `buildIcsFeed`, and storage service method signatures are consistent across tasks.
