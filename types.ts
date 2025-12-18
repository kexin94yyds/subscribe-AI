export interface Account {
  id: string;
  name: string;
  provider?: string;
  expirationDate: string; // ISO string YYYY-MM-DD
  notes?: string;
  category?: 'ai' | 'tool' | 'subscription' | 'other';
  refreshCycleDays?: number; // 用量刷新周期（天），如30表示每月刷新
  nextRefreshDate?: string; // 下次刷新日期
}

export enum ExpiryStatus {
  Active = 'Active',
  ExpiringSoon = 'ExpiringSoon', // <= 7 days
  Expired = 'Expired',
}

export interface ParsedAccountData {
  name: string;
  expirationDate: string;
  notes?: string;
}