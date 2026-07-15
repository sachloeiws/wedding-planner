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
  time?: string;
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
export interface ResponseSourceConfig {
  sheetUrl: string;
  spreadsheetId: string;
  gid?: string;
  sheetName?: string;
  range: string;
  lastLoadedAt?: string;
}

export interface ResponseFieldMapping {
  nameField: string;
  phoneField?: string;
  emailField?: string;
  attendanceField?: string;
  countField?: string;
  notesField?: string;
}

export type ResponseFilterOperator = 'equals' | 'contains' | 'not_equals' | 'not_empty';

export interface ResponseFilterRule {
  id: string;
  field: string;
  operator: ResponseFilterOperator;
  value: string;
}

export interface FormResponseRow {
  id: string;
  rowNumber: number;
  values: Record<string, string>;
}

export interface GuestImportCandidate {
  id: string;
  name: string;
  notes?: string;
  sourceLabel?: string;
  response: FormResponseRow;
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
