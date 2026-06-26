import { Permission, Role } from 'appwrite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCalendarFeedIcs,
  buildCalendarFeedUrl,
  createCalendarFeedService,
  feedFileIdForToken,
} from './calendarFeedStorageService';
import type { MonoExpireData } from './syncService';

const emptyData: MonoExpireData = {
  accounts: [],
  reminders: [],
  goals: [],
};

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

describe('feedFileIdForToken', () => {
  it('uses a deterministic Appwrite-safe file ID capped at 36 characters', () => {
    const fileId = feedFileIdForToken('abcdef1234567890abcdef1234567890extra');

    expect(fileId).toBe('cal_abcdef1234567890abcdef1234567890');
    expect(fileId).toHaveLength(36);
  });
});

describe('buildCalendarFeedIcs', () => {
  it('includes subscription, reminder, and goal export events', () => {
    const ics = buildCalendarFeedIcs({
      accounts: [{
        id: 'account-1',
        type: 'subscription',
        name: 'Gemini',
        expirationDate: '2026-08-27',
      }],
      reminders: [{
        id: 'reminder-1',
        type: 'reminder',
        name: 'Drink water',
        times: ['08:30'],
        repeatRule: 'none',
      }],
      goals: [{
        id: 'goal-1',
        type: 'goal',
        name: 'Ship Mac app',
        deadline: '2026-07-10',
      }],
    }, new Date('2026-06-26T12:00:00'));

    expect(ics).toContain('X-MONOEXPIRE-SOURCE-TYPE:subscription');
    expect(ics).toContain('X-MONOEXPIRE-SOURCE-TYPE:reminder');
    expect(ics).toContain('X-MONOEXPIRE-SOURCE-TYPE:goal');
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

  it('creates a token and uploads an anonymous-readable ICS file when enabling feed', async () => {
    const service = createCalendarFeedService({
      account,
      storage,
      config: {
        endpoint: 'https://cloud.appwrite.io/v1',
        projectId: 'project-1',
        bucketId: 'bucket-1',
      },
      randomToken: () => 'abcdef1234567890abcdef1234567890',
      buildIcs: () => 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n',
    });

    const state = await service.enableCalendarFeed(emptyData);

    expect(account.updatePrefs).toHaveBeenCalledWith({
      monoexpireCalendarFeedEnabled: true,
      monoexpireCalendarFeedToken: 'abcdef1234567890abcdef1234567890',
    });
    expect(storage.createFile).toHaveBeenCalledTimes(1);
    expect(storage.createFile).toHaveBeenCalledWith({
      bucketId: 'bucket-1',
      fileId: 'cal_abcdef1234567890abcdef1234567890',
      file: expect.any(File),
      permissions: [Permission.read(Role.any())],
    });
    const createArg = storage.createFile.mock.calls[0][0];
    await expect(createArg.file.text()).resolves.toBe('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');
    expect(createArg.file.name).toBe('cal_abcdef1234567890abcdef1234567890.ics');
    expect(createArg.file.type).toBe('text/calendar;charset=utf-8');
    expect(state).toEqual({
      enabled: true,
      token: 'abcdef1234567890abcdef1234567890',
      url: 'https://cloud.appwrite.io/v1/storage/buckets/bucket-1/files/cal_abcdef1234567890abcdef1234567890/view?project=project-1',
    });
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
      buildIcs: () => 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n',
    });

    await service.publishCalendarFeed(emptyData);

    expect(storage.deleteFile).toHaveBeenCalledWith({
      bucketId: 'bucket-1',
      fileId: 'cal_abcdef1234567890abcdef1234567890',
    });
    expect(storage.createFile).toHaveBeenCalledTimes(2);
  });

  it('does not upload when publishing a disabled feed', async () => {
    account.getPrefs.mockResolvedValue({
      monoexpireCalendarFeedEnabled: false,
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
      buildIcs: () => 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n',
    });

    const state = await service.publishCalendarFeed(emptyData);

    expect(storage.createFile).not.toHaveBeenCalled();
    expect(state.enabled).toBe(false);
  });

  it('deletes the old file and rotates to a new disabled token when revoking feed', async () => {
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
      randomToken: () => 'fedcba0987654321fedcba0987654321',
      buildIcs: () => 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n',
    });

    const state = await service.revokeCalendarFeed();

    expect(storage.deleteFile).toHaveBeenCalledWith({
      bucketId: 'bucket-1',
      fileId: 'cal_abcdef1234567890abcdef1234567890',
    });
    expect(account.updatePrefs).toHaveBeenCalledWith({
      monoexpireCalendarFeedEnabled: false,
      monoexpireCalendarFeedToken: 'fedcba0987654321fedcba0987654321',
    });
    expect(state).toEqual({
      enabled: false,
      token: 'fedcba0987654321fedcba0987654321',
      url: 'https://cloud.appwrite.io/v1/storage/buckets/bucket-1/files/cal_fedcba0987654321fedcba0987654321/view?project=project-1',
    });
  });
});
