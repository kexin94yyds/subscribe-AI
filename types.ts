// 页面类型
export type PageType = 'subscription' | 'reminder' | 'goal';

// 订阅账号
export interface Account {
  id: string;
  type: 'subscription';
  name: string;
  provider?: string;
  expirationDate: string; // ISO string YYYY-MM-DD
  notes?: string;
  category?: 'ai' | 'tool' | 'subscription' | 'other';
  refreshCycleDays?: number; // 用量刷新周期（天），如30表示每月刷新
  nextRefreshDate?: string; // 下次刷新日期
}

// 重复规则
export type RepeatRule = 
  | 'none'           // 不重复
  | 'daily'          // 每天
  | 'weekdays'       // 工作日
  | 'weekly'         // 每周
  | 'custom';        // 自定义

// 日历导出天数
export type CalendarExportDays = 30 | 90 | 180 | 365;

// 提醒
export interface Reminder {
  id: string;
  type: 'reminder';
  name: string;
  times: string[]; // 多个时间点，HH:mm 格式
  repeatRule: RepeatRule;
  customDays?: number[]; // 0-6 表示周日到周六
  calendarDays?: CalendarExportDays; // 日历导出天数
  notes?: string;
  isCompleted?: boolean;
  lastCompletedDate?: string; // 上次完成日期
}

// 目标
export interface Goal {
  id: string;
  type: 'goal';
  name: string;
  deadline: string;          // ISO string YYYY-MM-DD
  notes?: string;
  isCompleted?: boolean;
  completedDate?: string;
}

// 统一类型
export type Item = Account | Reminder | Goal;

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