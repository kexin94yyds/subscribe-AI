import { Account } from '../types';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const STORAGE_KEY = 'monoexpire_accounts';

export const getStoredAccounts = async (): Promise<Account[]> => {
  try {
    if (Capacitor.isNativePlatform()) {
      // iOS/Android: 使用 Capacitor Preferences（原生存储）
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      return value ? JSON.parse(value) : [];
    } else {
      // Web: 使用 localStorage
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    }
  } catch (error) {
    console.error("Failed to get accounts from storage", error);
    return [];
  }
};

export const saveAccountsToStorage = async (accounts: Account[]): Promise<void> => {
  try {
    const data = JSON.stringify(accounts);
    if (Capacitor.isNativePlatform()) {
      // iOS/Android: 使用 Capacitor Preferences（原生存储）
      await Preferences.set({ key: STORAGE_KEY, value: data });
    } else {
      // Web: 使用 localStorage
      localStorage.setItem(STORAGE_KEY, data);
    }
  } catch (error) {
    console.error("Failed to save accounts to storage", error);
  }
};

// 从旧存储迁移（兼容性）
export const migrateFromLocalStorage = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    // 检查 localStorage 中是否有旧数据
    const oldData = localStorage.getItem(STORAGE_KEY);
    if (oldData) {
      const accounts = JSON.parse(oldData) as Account[];
      if (accounts.length > 0) {
        await saveAccountsToStorage(accounts);
        localStorage.removeItem(STORAGE_KEY);
        console.log('Migrated accounts to native storage');
      }
    }
  } catch (error) {
    console.error("Failed to migrate from localStorage", error);
  }
};