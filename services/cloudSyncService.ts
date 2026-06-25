import { Session } from '@supabase/supabase-js';
import { Account, Goal, Reminder } from '../types';
import { MonoExpireData, normalizeSyncData, sortAccounts, sortGoals } from './syncService';
import { supabase } from './supabaseClient';

export type CloudSyncStatus = 'disabled' | 'signed_out' | 'syncing' | 'synced' | 'error';
export type CloudItemType = 'subscription' | 'reminder' | 'goal';

interface CloudSyncRow {
  item_type: CloudItemType;
  item_id: string;
  payload: Record<string, unknown>;
  updated_at: string;
  deleted_at: string | null;
  device_id: string | null;
}

interface UpsertCloudSyncRow extends CloudSyncRow {
  user_id: string;
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

const getAuthenticatedUserId = async (): Promise<string> => {
  if (!supabase) throw new Error('Supabase is not configured');

  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Not signed in');

  return data.user.id;
};

export const getCloudSession = async (): Promise<Session | null> => {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  return data.session;
};

export const signInToCloud = async (email: string): Promise<void> => {
  if (!supabase) throw new Error('Supabase is not configured');

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
      shouldCreateUser: true,
    },
  });

  if (error) throw error;
};

export const signOutFromCloud = async (): Promise<void> => {
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const syncMonoExpireData = async (
  localData: MonoExpireData,
  deviceId: string
): Promise<CloudSyncResult> => {
  if (!supabase) throw new Error('Supabase is not configured');

  const userId = await getAuthenticatedUserId();
  const normalizedLocal = normalizeSyncData(localData);
  const localRows = toRows(normalizedLocal, userId, deviceId);
  const localMap = new Map(localRows.map(row => [keyFor(row.item_type, row.item_id), row]));

  const { data: remoteRows, error } = await supabase
    .from('monoexpire_items')
    .select('item_type,item_id,payload,updated_at,deleted_at,device_id')
    .eq('user_id', userId);

  if (error) throw error;

  const remoteMap = new Map(
    ((remoteRows || []) as CloudSyncRow[]).map(row => [keyFor(row.item_type, row.item_id), row])
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
    const { error: upsertError } = await supabase
      .from('monoexpire_items')
      .upsert(rowsToUpload, { onConflict: 'user_id,item_type,item_id' });

    if (upsertError) throw upsertError;
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
  if (!supabase) return;

  const userId = await getAuthenticatedUserId();
  const { error } = await supabase
    .from('monoexpire_items')
    .upsert({
      user_id: userId,
      item_type: itemType,
      item_id: itemId,
      payload: {},
      updated_at: deletedAt,
      deleted_at: deletedAt,
      device_id: deviceId,
    }, { onConflict: 'user_id,item_type,item_id' });

  if (error) throw error;
};

