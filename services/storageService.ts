import { Account } from '../types';

const STORAGE_KEY = 'monoexpire_accounts';

export const getStoredAccounts = (): Account[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Failed to parse accounts from storage", error);
    return [];
  }
};

export const saveAccountsToStorage = (accounts: Account[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch (error) {
    console.error("Failed to save accounts to storage", error);
  }
};