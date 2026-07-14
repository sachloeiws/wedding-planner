/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TaskStatus = 'Pending' | 'In_Progress' | 'Completed';

export interface TodoItem {
  id: string;
  category: string;
  title: string;
  due_date: string;
  status: TaskStatus;
  notes: string;
  // New wedding prep fields
  shopName?: string;
  budget?: number;
  actualAmount?: number;
  contactInfo?: string;
  location?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  notes?: string;
  category?: string;
}

export type TableStatus = 'Empty' | 'Partially_Full' | 'Full' | 'Overfilled';

export interface GuestItem {
  id: string;
  name: string;
  notes?: string;
}

export interface TableItem {
  table_no: number;
  zone: string;
  guests: GuestItem[];
}

export interface TableAssignments {
  table_size_limit: number;
  tables: TableItem[];
}

export const DEFAULT_CATEGORIES = [
  '場地與餐宴',
  '禮服與造型',
  '喜帖與謝卡',
  '婚禮流程',
  '喜餅與禮物',
  '其他',
];

export const DEFAULT_ZONES = [
  '男方主桌',
  '女方主桌',
  '男方親友',
  '女方親友',
  '大學同學',
  '高中同學',
  '公司同事',
  '共同好友',
];
