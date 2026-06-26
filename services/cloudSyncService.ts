import { ID, Permission, Role, type Models } from 'appwrite';
import { Account, Goal, Reminder } from '../types';
import { MonoExpireData, normalizeSyncData, sortAccounts, sortGoals } from './syncService';
import {
  appwriteAccount,
  appwriteConfig,
  appwriteTables,
  isAppwriteAuthError,
} from './appwriteClient';

export type CloudSyncStatus = 'disabled' | 'signed_out' | 'syncing' | 'synced' | 'error';
export type CloudItemType = 'subscription' | 'reminder' | 'goal';

interface CloudSyncRow {
  item_type: CloudItemType;
  item_id: string;
  payload: unknown;
  updated_at: string;
  deleted_at: string | null;
  device_id: string | null;
}

interface UpsertCloudSyncRow extends CloudSyncRow {
  user_id: string;
}

interface AppwriteCloudSyncRow extends Models.Row {
  item_type: CloudItemType;
  item_id: string;
  payload_json: string;
  updated_at: string;
  deleted_at?: string;
  device_id?: string;
}

export interface CloudSession {
  user: {
    id: string;
    email?: string;
  };
}

export interface CloudSyncResult {
  data: MonoExpireData;
  downloadedCount: number;
  uploadedCount: number;
}

const dateValue = (value?: string | null): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const keyFor = (type: CloudItemType, id: string) => `${type}:${id}`;

const appwriteRowIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;

const hashKey = (value: string): string => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
};

const rowIdFor = (type: CloudItemType, id: string): string => {
  if (appwriteRowIdPattern.test(id)) return id;

  return `${type}-${hashKey(keyFor(type, id))}`;
};

const itemUpdatedAt = (item: Account | Reminder | Goal): string => {
  return item.updatedAt || new Date().toISOString();
};

const toRows = (data: MonoExpireData, userId: string, deviceId: string): UpsertCloudSyncRow[] => [
  ...data.accounts.map(account => ({
    user_id: userId,
    item_type: 'subscription' as const,
    item_id: account.id,
    payload: account,
    updated_at: itemUpdatedAt(account),
    deleted_at: account.deletedAt || null,
    device_id: deviceId,
  })),
  ...data.reminders.map(reminder => ({
    user_id: userId,
    item_type: 'reminder' as const,
    item_id: reminder.id,
    payload: reminder,
    updated_at: itemUpdatedAt(reminder),
    deleted_at: reminder.deletedAt || null,
    device_id: deviceId,
  })),
  ...data.goals.map(goal => ({
    user_id: userId,
    item_type: 'goal' as const,
    item_id: goal.id,
    payload: goal,
    updated_at: itemUpdatedAt(goal),
    deleted_at: goal.deletedAt || null,
    device_id: deviceId,
  })),
];

const rowToItem = (row: CloudSyncRow): Account | Reminder | Goal | null => {
  if (!row.payload || typeof row.payload !== 'object') return null;

  return {
    ...row.payload,
    id: row.item_id,
    type: row.item_type,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || undefined,
  } as Account | Reminder | Goal;
};

const isCloudItemType = (value: unknown): value is CloudItemType => {
  return value === 'subscription' || value === 'reminder' || value === 'goal';
};

const parsePayloadJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const appwriteRowToCloudRow = (row: AppwriteCloudSyncRow): CloudSyncRow | null => {
  if (!isCloudItemType(row.item_type) || !row.item_id || !row.updated_at) {
    return null;
  }

  return {
    item_type: row.item_type,
    item_id: row.item_id,
    payload: parsePayloadJson(row.payload_json || '{}'),
    updated_at: row.updated_at,
    deleted_at: row.deleted_at || null,
    device_id: row.device_id || null,
  };
};

const cloudRowToAppwriteData = (row: UpsertCloudSyncRow) => ({
  item_type: row.item_type,
  item_id: row.item_id,
  payload_json: JSON.stringify(row.payload),
  updated_at: row.updated_at,
  deleted_at: row.deleted_at || '',
  device_id: row.device_id || '',
});

const rowPermissionsFor = (userId: string): string[] => [
  Permission.read(Role.user(userId)),
  Permission.update(Role.user(userId)),
  Permission.delete(Role.user(userId)),
];

const addItem = (data: MonoExpireData, item: Account | Reminder | Goal) => {
  if (item.deletedAt) return;

  if (item.type === 'subscription') {
    data.accounts.push(item);
  } else if (item.type === 'reminder') {
    data.reminders.push(item);
  } else {
    data.goals.push(item);
  }
};

const requireAppwriteAccount = () => {
  if (!appwriteAccount) throw new Error('Appwrite is not configured');

  return appwriteAccount;
};

const requireAppwriteTables = () => {
  if (!appwriteTables) throw new Error('Appwrite is not configured');

  return appwriteTables;
};

const clearMagicUrlParams = () => {
  const params = new URLSearchParams(window.location.search);
  ['userId', 'secret', 'expire', 'phrase'].forEach(param => params.delete(param));
  const search = params.toString();
  const cleanUrl = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;

  window.history.replaceState({}, document.title, cleanUrl);
};

const completePendingMagicUrlSession = async (): Promise<void> => {
  const userId = new URLSearchParams(window.location.search).get('userId');
  const secret = new URLSearchParams(window.location.search).get('secret');

  if (!userId || !secret) return;

  const account = requireAppwriteAccount();
  await account.createSession({ userId, secret });
  clearMagicUrlParams();
};

const getAuthenticatedUserId = async (): Promise<string> => {
  const account = requireAppwriteAccount();

  try {
    const user = await account.get();

    return user.$id;
  } catch (error) {
    if (isAppwriteAuthError(error)) {
      throw new Error('Not signed in');
    }

    throw error;
  }
};

export const getCloudSession = async (): Promise<CloudSession | null> => {
  if (!appwriteAccount) return null;

  try {
    await completePendingMagicUrlSession();
    const user = await appwriteAccount.get();

    return {
      user: {
        id: user.$id,
        email: user.email || undefined,
      },
    };
  } catch (error) {
    if (isAppwriteAuthError(error)) {
      return null;
    }

    throw error;
  }
};

export const signInToCloud = async (email: string): Promise<void> => {
  const account = requireAppwriteAccount();
  const redirectUrl = `${window.location.origin}${window.location.pathname}`;

  await account.createMagicURLToken({
    userId: ID.unique(),
    email,
    url: redirectUrl,
  });
};

export const signOutFromCloud = async (): Promise<void> => {
  if (!appwriteAccount) return;

  try {
    await appwriteAccount.deleteSession({ sessionId: 'current' });
  } catch (error) {
    if (!isAppwriteAuthError(error)) throw error;
  }
};

export const syncMonoExpireData = async (
  localData: MonoExpireData,
  deviceId: string
): Promise<CloudSyncResult> => {
  const tables = requireAppwriteTables();
  const userId = await getAuthenticatedUserId();
  const normalizedLocal = normalizeSyncData(localData);
  const localRows = toRows(normalizedLocal, userId, deviceId);
  const localMap = new Map(localRows.map(row => [keyFor(row.item_type, row.item_id), row]));

  const remoteResult = await tables.listRows<AppwriteCloudSyncRow>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.tableId,
    queries: [],
    total: false,
    ttl: 0,
  });
  const remoteRows = remoteResult.rows
    .map(appwriteRowToCloudRow)
    .filter((row): row is CloudSyncRow => Boolean(row));

  const remoteMap = new Map(
    remoteRows.map(row => [keyFor(row.item_type, row.item_id), row])
  );
  const seen = new Set<string>();
  const merged: MonoExpireData = { accounts: [], reminders: [], goals: [] };
  const rowsToUpload: UpsertCloudSyncRow[] = [];
  let downloadedCount = 0;

  localRows.forEach(localRow => {
    const key = keyFor(localRow.item_type, localRow.item_id);
    const remoteRow = remoteMap.get(key);
    seen.add(key);

    if (remoteRow) {
      const remoteDeletedAt = dateValue(remoteRow.deleted_at);
      const remoteUpdatedAt = dateValue(remoteRow.updated_at);
      const localUpdatedAt = dateValue(localRow.updated_at);

      if (remoteDeletedAt && remoteDeletedAt >= localUpdatedAt) {
        downloadedCount++;
        return;
      }

      if (!remoteRow.deleted_at && remoteUpdatedAt > localUpdatedAt) {
        const remoteItem = rowToItem(remoteRow);
        if (remoteItem) {
          addItem(merged, remoteItem);
          downloadedCount++;
          return;
        }
      }
    }

    const localItem = rowToItem(localRow);
    if (localItem) addItem(merged, localItem);
    rowsToUpload.push({ ...localRow, deleted_at: null });
  });

  remoteMap.forEach((remoteRow, key) => {
    if (seen.has(key) || remoteRow.deleted_at) return;

    const remoteItem = rowToItem(remoteRow);
    if (remoteItem) {
      addItem(merged, remoteItem);
      downloadedCount++;
    }
  });

  if (rowsToUpload.length > 0) {
    const permissions = rowPermissionsFor(userId);

    await Promise.all(rowsToUpload.map(row => (
      tables.upsertRow<AppwriteCloudSyncRow>({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.tableId,
        rowId: rowIdFor(row.item_type, row.item_id),
        data: cloudRowToAppwriteData(row),
        permissions,
      })
    )));
  }

  return {
    data: normalizeSyncData({
      accounts: sortAccounts(merged.accounts),
      reminders: merged.reminders,
      goals: sortGoals(merged.goals),
    }),
    downloadedCount,
    uploadedCount: rowsToUpload.length,
  };
};

export const markCloudItemDeleted = async (
  itemType: CloudItemType,
  itemId: string,
  deviceId: string,
  deletedAt = new Date().toISOString()
): Promise<void> => {
  if (!appwriteTables) return;

  const userId = await getAuthenticatedUserId();
  const row: UpsertCloudSyncRow = {
      user_id: userId,
      item_type: itemType,
      item_id: itemId,
      payload: {},
      updated_at: deletedAt,
      deleted_at: deletedAt,
      device_id: deviceId,
  };

  await appwriteTables.upsertRow<AppwriteCloudSyncRow>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.tableId,
    rowId: rowIdFor(itemType, itemId),
    data: cloudRowToAppwriteData(row),
    permissions: rowPermissionsFor(userId),
  });
};
