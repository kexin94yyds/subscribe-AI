import { ID, Permission, Role } from 'appwrite';
import { appwriteAccount, appwriteConfig, appwriteStorage } from './appwriteClient';
import { buildCalendarExportEvents } from './calendarExportService';
import { buildIcsFeed } from './icsFeedService';
import type { MonoExpireData } from './syncService';

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

interface CalendarFeedConfig {
  endpoint: string;
  projectId: string;
  bucketId: string;
}

interface CalendarFeedAccount {
  get: () => Promise<unknown>;
  getPrefs: () => Promise<Record<string, unknown>>;
  updatePrefs: (prefs: Record<string, unknown>) => Promise<unknown>;
}

interface CalendarFeedStorage {
  createFile: (params: {
    bucketId: string;
    fileId: string;
    file: File;
    permissions?: string[];
  }) => Promise<unknown>;
  deleteFile: (params: {
    bucketId: string;
    fileId: string;
  }) => Promise<unknown>;
}

interface CalendarFeedDependencies {
  account: CalendarFeedAccount;
  storage: CalendarFeedStorage;
  config: CalendarFeedConfig;
  randomToken: () => string;
  buildIcs: (data: MonoExpireData) => string;
}

interface AppwriteError {
  code?: number;
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

const safeToken = (value: string): string => value.replace(/[^a-zA-Z0-9]/g, '');

const randomToken = (): string => {
  if (globalThis.crypto?.randomUUID) {
    return safeToken(globalThis.crypto.randomUUID()).slice(0, 32);
  }

  return safeToken(ID.unique(32)).padEnd(32, '0').slice(0, 32);
};

export const buildCalendarFeedIcs = (
  data: MonoExpireData,
  baseDate = new Date()
): string => buildIcsFeed([
  ...buildCalendarExportEvents('subscription', data, baseDate),
  ...buildCalendarExportEvents('reminder', data, baseDate),
  ...buildCalendarExportEvents('goal', data, baseDate),
], { now: baseDate });

export const createCalendarFeedService = (deps: CalendarFeedDependencies) => {
  const stateFromPrefs = (prefs: Record<string, unknown>): CalendarFeedState => {
    const enabled = prefs[ENABLED_PREF] === true;
    const token = typeof prefs[TOKEN_PREF] === 'string' ? prefs[TOKEN_PREF] : null;
    const fileId = token ? feedFileIdForToken(token) : null;

    return {
      enabled,
      token,
      url: fileId ? buildCalendarFeedUrl({ ...deps.config, fileId }) : null,
    };
  };

  const upload = async (token: string, data: MonoExpireData): Promise<void> => {
    const fileId = feedFileIdForToken(token);
    const file = new File([deps.buildIcs(data)], `${fileId}.ics`, {
      type: 'text/calendar;charset=utf-8',
    });
    const permissions = [Permission.read(Role.any())];
    const createParams = {
      bucketId: deps.config.bucketId,
      fileId,
      file,
      permissions,
    };

    try {
      await deps.storage.createFile(createParams);
    } catch (error) {
      if ((error as AppwriteError | undefined)?.code !== 409) {
        throw error;
      }

      await deps.storage.deleteFile({
        bucketId: deps.config.bucketId,
        fileId,
      });
      await deps.storage.createFile(createParams);
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
      const nextPrefs = {
        ...prefs,
        [ENABLED_PREF]: true,
        [TOKEN_PREF]: token,
      };

      await deps.account.updatePrefs(nextPrefs);
      await upload(token, data);
      return stateFromPrefs(nextPrefs);
    },
    publishCalendarFeed: async (data: MonoExpireData): Promise<CalendarFeedState> => {
      const prefs = await deps.account.getPrefs();
      const state = stateFromPrefs(prefs);
      if (!state.enabled || !state.token) {
        return state;
      }

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

      const nextPrefs = {
        ...prefs,
        [ENABLED_PREF]: false,
        [TOKEN_PREF]: deps.randomToken(),
      };

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
    buildIcs: buildCalendarFeedIcs,
  });
};

export const getCalendarFeedState = (): Promise<CalendarFeedState> => (
  runtimeService().getCalendarFeedState()
);

export const enableCalendarFeed = (data: MonoExpireData): Promise<CalendarFeedState> => (
  runtimeService().enableCalendarFeed(data)
);

export const publishCalendarFeed = (data: MonoExpireData): Promise<CalendarFeedState> => (
  runtimeService().publishCalendarFeed(data)
);

export const revokeCalendarFeed = (): Promise<CalendarFeedState> => (
  runtimeService().revokeCalendarFeed()
);
