export interface Account {
  id: string;
  name: string;
  provider?: string;
  expirationDate: string; // ISO string YYYY-MM-DD
  notes?: string;
  category?: 'ai' | 'tool' | 'subscription' | 'other';
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