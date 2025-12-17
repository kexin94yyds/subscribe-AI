import { Account } from '../types';

const DB_NAME = 'monoexpire_db';
const DB_VERSION = 1;
const STORE_NAME = 'accounts';

let dbInstance: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const getStoredAccounts = async (): Promise<Account[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to get accounts from IndexedDB", error);
    // 回退到 localStorage
    try {
      const stored = localStorage.getItem('monoexpire_accounts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
};

export const saveAccountsToStorage = async (accounts: Account[]): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // 清空并重新添加所有账户
      store.clear();
      accounts.forEach(account => store.put(account));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error("Failed to save accounts to IndexedDB", error);
    // 回退到 localStorage
    try {
      localStorage.setItem('monoexpire_accounts', JSON.stringify(accounts));
    } catch {
      // ignore
    }
  }
};

// 从 localStorage 迁移到 IndexedDB
export const migrateFromLocalStorage = async (): Promise<void> => {
  try {
    const stored = localStorage.getItem('monoexpire_accounts');
    if (stored) {
      const accounts = JSON.parse(stored) as Account[];
      if (accounts.length > 0) {
        await saveAccountsToStorage(accounts);
        localStorage.removeItem('monoexpire_accounts');
        console.log('Migrated accounts from localStorage to IndexedDB');
      }
    }
  } catch (error) {
    console.error("Failed to migrate from localStorage", error);
  }
};