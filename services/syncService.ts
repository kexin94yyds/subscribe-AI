import { Account, Goal, Reminder } from '../types';

export interface MonoExpireData {
  accounts: Account[];
  reminders: Reminder[];
  goals: Goal[];
}

export interface MonoExpireBackup {
  app: 'MonoExpire';
  version: 2;
  exportedAt: string;
  payload: MonoExpireData;
}

export interface ParsedMonoExpireBackup {
  data: MonoExpireData;
  legacyAccountsOnly: boolean;
}

export interface SyncCounts {
  accounts: number;
  reminders: number;
  goals: number;
  total: number;
}

const timestamp = (value?: string): number => {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const nowIso = () => new Date().toISOString();

export const touchAccount = (account: Omit<Account, 'updatedAt'> | Account): Account => ({
  ...account,
  updatedAt: nowIso(),
});

export const touchReminder = (reminder: Omit<Reminder, 'updatedAt'> | Reminder): Reminder => ({
  ...reminder,
  updatedAt: nowIso(),
});

export const touchGoal = (goal: Omit<Goal, 'updatedAt'> | Goal): Goal => ({
  ...goal,
  updatedAt: nowIso(),
});

export const sortAccounts = (accounts: Account[]): Account[] => {
  return [...accounts].sort((a, b) => timestamp(a.expirationDate) - timestamp(b.expirationDate));
};

export const sortGoals = (goals: Goal[]): Goal[] => {
  return [...goals].sort((a, b) => timestamp(a.deadline) - timestamp(b.deadline));
};

export const normalizeSyncData = (data: MonoExpireData, fallbackUpdatedAt = nowIso()): MonoExpireData => ({
  accounts: sortAccounts(data.accounts).map(account => ({
    ...account,
    updatedAt: account.updatedAt || fallbackUpdatedAt,
  })),
  reminders: data.reminders.map(reminder => ({
    ...reminder,
    updatedAt: reminder.updatedAt || fallbackUpdatedAt,
  })),
  goals: sortGoals(data.goals).map(goal => ({
    ...goal,
    updatedAt: goal.updatedAt || fallbackUpdatedAt,
  })),
});

export const createMonoExpireBackup = (data: MonoExpireData): MonoExpireBackup => {
  const exportedAt = nowIso();

  return {
    app: 'MonoExpire',
    version: 2,
    exportedAt,
    payload: normalizeSyncData(data, exportedAt),
  };
};

export const countSyncData = (data: MonoExpireData): SyncCounts => {
  const accounts = data.accounts.length;
  const reminders = data.reminders.length;
  const goals = data.goals.length;

  return {
    accounts,
    reminders,
    goals,
    total: accounts + reminders + goals,
  };
};

export const parseMonoExpireBackup = (rawText: string): ParsedMonoExpireBackup => {
  const parsed = JSON.parse(rawText) as unknown;
  const fallbackUpdatedAt = nowIso();

  if (Array.isArray(parsed)) {
    return {
      data: normalizeSyncData({
        accounts: parsed as Account[],
        reminders: [],
        goals: [],
      }, fallbackUpdatedAt),
      legacyAccountsOnly: true,
    };
  }

  if (!isRecord(parsed)) {
    throw new Error('Invalid backup file');
  }

  const exportedAt = typeof parsed.exportedAt === 'string' ? parsed.exportedAt : fallbackUpdatedAt;
  const payload = isRecord(parsed.payload)
    ? parsed.payload
    : isRecord(parsed.data)
      ? parsed.data
      : parsed;

  const accounts = Array.isArray(payload.accounts) ? payload.accounts as Account[] : [];
  const reminders = Array.isArray(payload.reminders) ? payload.reminders as Reminder[] : [];
  const goals = Array.isArray(payload.goals) ? payload.goals as Goal[] : [];

  if (!accounts.length && !reminders.length && !goals.length) {
    throw new Error('Backup file contains no MonoExpire data');
  }

  return {
    data: normalizeSyncData({ accounts, reminders, goals }, exportedAt),
    legacyAccountsOnly: false,
  };
};
