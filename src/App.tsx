/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import TodoList from './components/TodoList';
import TablePlanner from './components/TablePlanner';
import WeddingCalendar from './components/WeddingCalendar';
import { filterResponses } from './components/ResponseList';
import ResponseWorkspace from './components/ResponseWorkspace';
import {
  TodoItem,
  TableAssignments,
  DEFAULT_CATEGORIES,
  CalendarEvent,
  FormResponseRow,
  GuestImportCandidate,
  ResponseFieldMapping,
  ResponseFilterRule,
  ResponseSourceConfig
} from './types';
import { 
  Heart, 
  Calendar, 
  Download, 
  RefreshCw, 
  Gift, 
  Sparkles,
  CheckCircle2,
  Check,
  X,
  ClipboardList,
  Users,
  Cloud,
  CloudOff,
  Database,
  FileText
} from 'lucide-react';
import {
  emptyVersions,
  loadWeddingPlan,
  PLAN_SECTIONS,
  PlanConflictError,
  PlanSection,
  saveWeddingPlan,
  SectionSnapshot,
  splitPlanData,
  subscribeWeddingPlanSections,
  WeddingPlanData
} from './lib/firebase';
import { showConfirm, showConflict, showError, showSuccess, showWarning } from './lib/alerts';

const getTodayDate = () => {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60_000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
};

const getOrCreateEditorId = () => {
  const saved = localStorage.getItem('wedding_editor_id');
  if (saved) return saved;
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem('wedding_editor_id', id);
  return id;
};

const getEmptyPlanData = (): WeddingPlanData => ({
  weddingDate: getTodayDate(),
  categories: [...DEFAULT_CATEGORIES],
  tasks: [],
  tableAssignments: { table_size_limit: 12, tables: [] },
  calendarEvents: [],
  responseSourceConfig: { sheetUrl: '', spreadsheetId: '', range: '' },
  responseHeaders: [],
  formResponses: [],
  responseFieldMapping: { nameField: '' },
  responseFilterRules: []
});

export default function App() {
  // Empty default tasks
  const [tasks, setTasks] = useState<TodoItem[]>(() => {
    const saved = localStorage.getItem('wedding_tasks');
    return saved ? JSON.parse(saved) : [...DEFAULT_CATEGORIES];
  });

  // Empty default table assignments
  const [tableAssignments, setTableAssignments] = useState<TableAssignments>(() => {
    const saved = localStorage.getItem('wedding_table_assignments');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as TableAssignments;
        if (parsed && Array.isArray(parsed.tables)) {
          parsed.tables = parsed.tables.map(t => ({
            ...t,
            guests: Array.isArray(t.guests) ? t.guests.map((g: any, index: number) => {
              if (typeof g === 'string') {
                return {
                  id: `g_${t.table_no}_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 4)}`,
                  name: g,
                  notes: ''
                };
              }
              return g;
            }) : []
          }));
        }
        return parsed;
      } catch (e) {
        console.error("Error parsing stored table assignments:", e);
        return { table_size_limit: 12, tables: [] };
      }
    }
    return { table_size_limit: 12, tables: [] };
  });

  const [weddingDate, setWeddingDate] = useState<string>(() => {
    const saved = localStorage.getItem('wedding_date');
    return saved || getTodayDate();
  });

  // Restored Default Categories
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('wedding_categories');
    return saved ? JSON.parse(saved) : [];
  });

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() => {
    const saved = localStorage.getItem('wedding_calendar_events');
    return saved ? JSON.parse(saved) : [];
  });

  const [responseSourceConfig, setResponseSourceConfig] = useState<ResponseSourceConfig>(() => {
    const saved = localStorage.getItem('wedding_response_source_config');
    return saved ? JSON.parse(saved) : { sheetUrl: '', spreadsheetId: '', range: '' };
  });

  const [responseHeaders, setResponseHeaders] = useState<string[]>(() => {
    const saved = localStorage.getItem('wedding_response_headers');
    return saved ? JSON.parse(saved) : [];
  });

  const [formResponses, setFormResponses] = useState<FormResponseRow[]>(() => {
    const saved = localStorage.getItem('wedding_form_responses');
    return saved ? JSON.parse(saved) : [];
  });

  const [responseFieldMapping, setResponseFieldMapping] = useState<ResponseFieldMapping>(() => {
    const saved = localStorage.getItem('wedding_response_field_mapping');
    return saved ? JSON.parse(saved) : { nameField: '' };
  });

  const [responseFilterRules, setResponseFilterRules] = useState<ResponseFilterRule[]>(() => {
    const saved = localStorage.getItem('wedding_response_filter_rules');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTab, setActiveTab] = useState<'todo' | 'calendar' | 'responses' | 'table'>('todo');

  // Firebase collaboration states
  const [syncKey, setSyncKey] = useState<string>(() => {
    return localStorage.getItem('wedding_sync_key') || '';
  });
  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem('wedding_sync_username') || '';
  });
  const [editorName, setEditorName] = useState<string>(() => {
    return localStorage.getItem('wedding_editor_name') || '';
  });
  const [editorId] = useState<string>(getOrCreateEditorId);
  const [isSyncEnabled, setIsSyncEnabled] = useState<boolean>(() => {
    return false;
  });
  const [activeDocumentId, setActiveDocumentId] = useState('');
  const [syncStatus, setSyncStatus] = useState<'offline' | 'loading' | 'synced' | 'error'>('offline');
  const [syncError, setSyncError] = useState<string>('');
  const sectionAnchors = useRef<Record<PlanSection, string>>({ general: '', tasks: '', calendar: '', tables: '', responses: '' });
  const sectionVersions = useRef(emptyVersions());
  const currentSections = useRef<Record<PlanSection, Record<string, any>>>(splitPlanData(getEmptyPlanData()));
  const conflictOpen = useRef(false);
  const pendingSnapshots = useRef(new Map<PlanSection, SectionSnapshot>());
  const [, refreshSyncState] = useState(0);

  const getCurrentPlanData = (): WeddingPlanData => ({
      weddingDate,
      categories,
      tasks,
      tableAssignments,
      calendarEvents,
      responseSourceConfig,
      responseHeaders,
      formResponses,
      responseFieldMapping,
      responseFilterRules
  });

  const applyPlanData = (data: WeddingPlanData) => {
    setWeddingDate(data.weddingDate || getTodayDate());
    setCategories(data.categories !== undefined ? data.categories : [...DEFAULT_CATEGORIES]);
    setTasks(data.tasks || []);
    setTableAssignments(data.tableAssignments || { table_size_limit: 12, tables: [] });
    setCalendarEvents(data.calendarEvents || []);
    setResponseSourceConfig(data.responseSourceConfig || { sheetUrl: '', spreadsheetId: '', range: '' });
    setResponseHeaders(data.responseHeaders || []);
    setFormResponses(data.formResponses || []);
    setResponseFieldMapping(data.responseFieldMapping || { nameField: '' });
    setResponseFilterRules(data.responseFilterRules || []);
  };

  const applySection = (section: PlanSection, payload: Record<string, any>) => {
    if (section === 'general') {
      setWeddingDate(payload.weddingDate || getTodayDate());
      setCategories(payload.categories !== undefined ? payload.categories : [...DEFAULT_CATEGORIES]);
    } else if (section === 'tasks') setTasks(payload.tasks || []);
    else if (section === 'calendar') setCalendarEvents(payload.calendarEvents || []);
    else if (section === 'tables') setTableAssignments(payload.tableAssignments || { table_size_limit: 12, tables: [] });
    else {
      setResponseSourceConfig(payload.responseSourceConfig || { sheetUrl: '', spreadsheetId: '', range: '' });
      setResponseHeaders(payload.responseHeaders || []);
      setFormResponses(payload.formResponses || []);
      setResponseFieldMapping(payload.responseFieldMapping || { nameField: '' });
      setResponseFilterRules(payload.responseFilterRules || []);
    }
  };

  const mergeSection = (section: PlanSection, cloud: Record<string, any>, local: Record<string, any>) => {
    const mergeBy = (cloudItems: any[] = [], localItems: any[] = [], key: string) => {
      const merged = new Map(cloudItems.map(item => [String(item[key]), item]));
      localItems.forEach(item => merged.set(String(item[key]), item));
      return Array.from(merged.values());
    };
    if (section === 'tasks') return { tasks: mergeBy(cloud.tasks, local.tasks, 'id') };
    if (section === 'calendar') return { calendarEvents: mergeBy(cloud.calendarEvents, local.calendarEvents, 'id') };
    if (section === 'tables') return {
      tableAssignments: {
        ...(cloud.tableAssignments || {}),
        ...(local.tableAssignments || {}),
        tables: mergeBy(cloud.tableAssignments?.tables, local.tableAssignments?.tables, 'table_no')
      }
    };
    if (section === 'responses') return {
      ...cloud,
      ...local,
      formResponses: mergeBy(cloud.formResponses, local.formResponses, 'id')
    };
    return { ...cloud, ...local };
  };

  currentSections.current = splitPlanData(getCurrentPlanData());
  const dirtySections = PLAN_SECTIONS.filter(section => sectionAnchors.current[section]
    && JSON.stringify(currentSections.current[section]) !== sectionAnchors.current[section]);
  const hasUnsavedChanges = isSyncEnabled && dirtySections.length > 0;

  const acceptSectionSnapshot = async (snapshot: SectionSnapshot) => {
    if (snapshot.version <= sectionVersions.current[snapshot.section]) return;
    const localPayload = currentSections.current[snapshot.section];
    const isDirty = Boolean(sectionAnchors.current[snapshot.section])
      && JSON.stringify(localPayload) !== sectionAnchors.current[snapshot.section];

    if (!isDirty) {
      applySection(snapshot.section, snapshot.payload);
      sectionAnchors.current[snapshot.section] = JSON.stringify(snapshot.payload);
      sectionVersions.current[snapshot.section] = snapshot.version;
      refreshSyncState(value => value + 1);
      return;
    }

    if (conflictOpen.current) {
      pendingSnapshots.current.set(snapshot.section, snapshot);
      return;
    }
    conflictOpen.current = true;
    const labels: Record<PlanSection, string> = { general: '基本設定', tasks: '待辦事項', calendar: '籌備日曆', tables: '宴席排座', responses: '賓客回覆' };
    const choice = await showConflict(snapshot.updatedBy.editorId, [labels[snapshot.section]]);
    sectionVersions.current[snapshot.section] = snapshot.version;
    sectionAnchors.current[snapshot.section] = JSON.stringify(snapshot.payload);
    if (choice === 'cloud') applySection(snapshot.section, snapshot.payload);
    else if (choice === 'merge') applySection(snapshot.section, mergeSection(snapshot.section, snapshot.payload, localPayload));
    refreshSyncState(value => value + 1);
    conflictOpen.current = false;
    const queued = Array.from(pendingSnapshots.current.values()) as SectionSnapshot[];
    pendingSnapshots.current.clear();
    queued.forEach(item => { void acceptSectionSnapshot(item); });
  };

  useEffect(() => {
    if (!isSyncEnabled || !activeDocumentId) {
      setSyncStatus('offline');
      return;
    }
    let disposed = false;
    let unsubscribe = () => {};
    setSyncStatus('loading');
    setSyncError('');

    const initialize = async () => {
      try {
        let loaded = await loadWeddingPlan(activeDocumentId);
        if (!loaded) {
          const initialData = getEmptyPlanData();
          const versions = await saveWeddingPlan(activeDocumentId, initialData, { editorId, displayName: editorName.trim() }, emptyVersions());
          loaded = { data: initialData, versions, updatedBy: {}, isLegacy: false };
        } else if (loaded.isLegacy) {
          const versions = await saveWeddingPlan(activeDocumentId, loaded.data, { editorId, displayName: editorName.trim() }, emptyVersions());
          loaded = { ...loaded, versions, isLegacy: false };
        }
        if (disposed) return;
        applyPlanData(loaded.data);
        sectionVersions.current = loaded.versions;
        const payloads = splitPlanData(loaded.data);
        PLAN_SECTIONS.forEach(section => { sectionAnchors.current[section] = JSON.stringify(payloads[section]); });
        refreshSyncState(value => value + 1);
        setSyncStatus('synced');
        unsubscribe = subscribeWeddingPlanSections(activeDocumentId, snapshot => { void acceptSectionSnapshot(snapshot); }, error => {
          setSyncStatus('error');
          setSyncError(`連線錯誤: ${error.message}`);
        });
      } catch (error: any) {
        if (disposed) return;
        setSyncStatus('error');
        setSyncError(`連線錯誤: ${error.message}`);
      }
    };
    void initialize();
    localStorage.setItem('wedding_sync_key', syncKey.trim());
    localStorage.setItem('wedding_sync_username', username.trim());
    localStorage.setItem('wedding_editor_name', editorName.trim());
    localStorage.setItem('wedding_sync_enabled', 'true');
    return () => { disposed = true; unsubscribe(); };
  }, [isSyncEnabled, activeDocumentId]);

  useEffect(() => {
    localStorage.setItem('wedding_sync_enabled', isSyncEnabled ? 'true' : 'false');
  }, [isSyncEnabled]);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [hasUnsavedChanges]);

  const handleConfirmCredentials = () => {
    const cleanKey = syncKey.trim();
    const cleanUsername = username.trim();
    if (!cleanKey || !cleanUsername || !editorName.trim()) {
      showWarning('資料尚未填寫完整', '請輸入共用名稱、同步金鑰及您的編輯者名稱。');
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(cleanKey) || !/^[A-Za-z0-9_-]+$/.test(cleanUsername)) {
      showWarning('格式不正確', '使用者名稱及金鑰只可包含英文、數字、底線或連字號。');
      return;
    }
    setActiveDocumentId(`${cleanUsername}_${cleanKey}`);
    setIsSyncEnabled(true);
  };

  const handleManualUpload = async () => {
    if (!isSyncEnabled || !activeDocumentId) {
      showWarning('尚未連接雲端', '請先確認使用者名稱及婚禮同步金鑰。');
      return;
    }
    try {
      setSyncStatus('loading');
      const dataToSave = getCurrentPlanData();
      const sectionsToSave = dirtySections.length ? dirtySections : [...PLAN_SECTIONS];
      const versions = await saveWeddingPlan(activeDocumentId, dataToSave, { editorId, displayName: editorName.trim() }, sectionVersions.current, sectionsToSave);
      sectionVersions.current = versions;
      const payloads = splitPlanData(dataToSave);
      sectionsToSave.forEach(section => { sectionAnchors.current[section] = JSON.stringify(payloads[section]); });
      refreshSyncState(value => value + 1);
      setSyncStatus('synced');
      showSuccess('儲存成功', '目前的籌備資料已同步至雲端。');
    } catch (err: any) {
      if (err instanceof PlanConflictError) {
        const labels: Record<PlanSection, string> = { general: '基本設定', tasks: '待辦事項', calendar: '籌備日曆', tables: '宴席排座', responses: '賓客回覆' };
        const choice = await showConflict(err.conflicts[0]?.updatedBy.editorId || '', err.conflicts.map(item => labels[item.section]));
        err.conflicts.forEach(conflict => {
          const localPayload = currentSections.current[conflict.section];
          sectionVersions.current[conflict.section] = conflict.version;
          sectionAnchors.current[conflict.section] = JSON.stringify(conflict.payload);
          if (choice === 'cloud') applySection(conflict.section, conflict.payload);
          else if (choice === 'merge') applySection(conflict.section, mergeSection(conflict.section, conflict.payload, localPayload));
        });
        refreshSyncState(value => value + 1);
        setSyncStatus('synced');
        if (choice !== 'cloud') showWarning('請再次儲存', '衝突已處理，請確認內容後再次按下「儲存」。');
        return;
      }
      setSyncStatus('error');
      setSyncError(`儲存失敗: ${err.message}`);
      showError('儲存失敗', err.message);
    }
  };

  const handleManualDownload = async () => {
    if (!isSyncEnabled || !activeDocumentId) {
      showWarning('尚未連接雲端', '請先確認使用者名稱及婚禮同步金鑰。');
      return;
    }
    if (!await showConfirm('從雲端同步？', '這會覆蓋目前裝置上的所有資料，而且無法復原。')) {
      return;
    }
    try {
      setSyncStatus('loading');
      const loaded = await loadWeddingPlan(activeDocumentId);
      if (!loaded) {
        showWarning('找不到雲端資料', '此帳戶尚未建立任何雲端資料。');
        setSyncStatus('offline');
        return;
      }
      
      applyPlanData(loaded.data);
      sectionVersions.current = loaded.versions;
      const payloads = splitPlanData(loaded.data);
      PLAN_SECTIONS.forEach(section => { sectionAnchors.current[section] = JSON.stringify(payloads[section]); });
      refreshSyncState(value => value + 1);
      
      setSyncStatus('synced');
      showSuccess('同步完成', '已載入最新的雲端籌備資料。');
    } catch (err: any) {
      setSyncStatus('error');
      setSyncError(`雲端同步失敗: ${err.message}`);
      showError('雲端同步失敗', err.message);
    }
  };

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('wedding_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('wedding_table_assignments', JSON.stringify(tableAssignments));
  }, [tableAssignments]);

  useEffect(() => {
    localStorage.setItem('wedding_date', weddingDate);
  }, [weddingDate]);

  useEffect(() => {
    localStorage.setItem('wedding_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('wedding_calendar_events', JSON.stringify(calendarEvents));
  }, [calendarEvents]);

  useEffect(() => {
    localStorage.setItem('wedding_response_source_config', JSON.stringify(responseSourceConfig));
  }, [responseSourceConfig]);

  useEffect(() => {
    localStorage.setItem('wedding_response_headers', JSON.stringify(responseHeaders));
  }, [responseHeaders]);

  useEffect(() => {
    localStorage.setItem('wedding_form_responses', JSON.stringify(formResponses));
  }, [formResponses]);

  useEffect(() => {
    localStorage.setItem('wedding_response_field_mapping', JSON.stringify(responseFieldMapping));
  }, [responseFieldMapping]);

  useEffect(() => {
    localStorage.setItem('wedding_response_filter_rules', JSON.stringify(responseFilterRules));
  }, [responseFilterRules]);

  const filteredResponseGuestCandidates: GuestImportCandidate[] = filterResponses(formResponses, responseFilterRules)
    .map((row): GuestImportCandidate | null => {
      const nameField = responseFieldMapping.nameField;
      const name = nameField ? (row.values[nameField] || '').trim() : '';
      if (!name) return null;

      const notes = [
        responseFieldMapping.attendanceField ? row.values[responseFieldMapping.attendanceField] : '',
        responseFieldMapping.countField ? `人數 ${row.values[responseFieldMapping.countField]}` : '',
        responseFieldMapping.phoneField ? row.values[responseFieldMapping.phoneField] : '',
        responseFieldMapping.emailField ? row.values[responseFieldMapping.emailField] : '',
        responseFieldMapping.notesField ? row.values[responseFieldMapping.notesField] : '',
      ].filter(Boolean).join(' / ');

      return {
        id: row.id,
        name,
        notes,
        sourceLabel: `表單第 ${row.rowNumber} 列`,
        response: row,
        phone: responseFieldMapping.phoneField ? row.values[responseFieldMapping.phoneField] : '',
        email: responseFieldMapping.emailField ? row.values[responseFieldMapping.emailField] : '',
        attendance: responseFieldMapping.attendanceField ? row.values[responseFieldMapping.attendanceField] : '',
        partySize: responseFieldMapping.countField ? Math.max(1, Number.parseInt(row.values[responseFieldMapping.countField], 10) || 1) : 1,
        relationship: responseFieldMapping.relationshipField ? row.values[responseFieldMapping.relationshipField] : '',
      };
    })
    .filter((candidate): candidate is GuestImportCandidate => Boolean(candidate));

  const getDaysRemaining = () => {
    if (!weddingDate) return null;
    const wedding = new Date(weddingDate);
    wedding.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = wedding.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysRemaining = getDaysRemaining();

  const handleReset = async () => {
    if (await showConfirm('清除所有資料？', '目前的修改將被清除，而且無法復原。')) {
      setTasks([]);
      setTableAssignments({ table_size_limit: 12, tables: [] });
      setWeddingDate(getTodayDate());
      setCategories([...DEFAULT_CATEGORIES]);
      setCalendarEvents([]);
      setResponseSourceConfig({ sheetUrl: '', spreadsheetId: '', range: '' });
      setResponseHeaders([]);
      setFormResponses([]);
      setResponseFieldMapping({ nameField: '' });
      setResponseFilterRules([]);
      setActiveTab('todo');
    }
  };

  const handleExportExcel = async () => {
    const { Workbook } = await import('exceljs');
    const workbook = new Workbook();
    const addSheet = (name: string, rows: Record<string, unknown>[], widths: number[]) => {
      const data = rows.length ? rows : [{ 資料: '尚無資料' }];
      const keys = Object.keys(data[0]);
      const worksheet = workbook.addWorksheet(name);
      worksheet.columns = keys.map((key, index) => ({
        header: key,
        key,
        width: widths[index] || 18
      }));
      worksheet.addRows(data);
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8E9E8C' } };
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    };

    addSheet('待辦事項', tasks.map(task => ({
      分類: task.category,
      任務名稱: task.title,
      到期日: task.due_date,
      狀態: task.status === 'Completed' ? '已完成' : task.status === 'In_Progress' ? '進行中' : '待處理',
      店家品牌: task.shopName || '',
      預算: task.budget ?? '',
      實際花費: task.actualAmount ?? '',
      聯絡資料: task.contactInfo || '',
      地點: task.location || '',
      備註: task.notes || ''
    })), [16, 28, 14, 12, 20, 14, 14, 22, 24, 32]);

    addSheet('桌席安排', tableAssignments.tables.map(table => ({
      桌號: table.table_no,
      桌席區域: table.zone,
      賓客人數: table.guests.length,
      每桌上限: tableAssignments.table_size_limit
    })), [10, 22, 12, 12]);

    addSheet('賓客名單', tableAssignments.tables.flatMap(table => table.guests.map(guest => ({
      桌號: table.table_no,
      桌席區域: table.zone,
      賓客姓名: guest.name,
      備註: guest.notes || ''
    }))), [10, 22, 20, 32]);

    addSheet('籌備日曆', calendarEvents.map(event => ({
      日期: event.date,
      時間: event.time || '',
      行程名稱: event.title,
      分類: event.category || '',
      備註: event.notes || ''
    })), [14, 10, 28, 18, 32]);

    addSheet('表單回覆', formResponses.map(response => ({
      列號: response.rowNumber,
      ...response.values
    })), [10, ...responseHeaders.map(() => 22)]);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `婚禮籌備資料_${getTodayDate()}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    showSuccess('Excel 匯出完成', '檔案已下載至您的裝置。');
  };

  return (
    <div id="wedding_app_container" className="min-h-screen bg-[#FAF8F5] text-[#4A443F] flex flex-col pb-12 antialiased">
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-[#8E9E8C]/10 via-[#F2EDE4]/30 to-transparent pointer-events-none" />

      <header className={`relative bg-[#F2EDE4]/80 backdrop-blur-md border-b border-[#E2D9CD] px-6 py-4 transition ${!isSyncEnabled ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={!isSyncEnabled}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FAF8F5] flex items-center justify-center border border-[#E2D9CD]">
              <Heart className="w-5 h-5 text-[#8E9E8C] fill-[#8E9E8C]/10" />
            </div>
            <div>
              <h1 className="text-xl font-semibold font-serif text-[#5E564E] tracking-tight flex items-center gap-2">
                婚禮待辦與排座助手
                <span className="text-[10px] font-sans font-normal px-2 py-0.5 rounded-full bg-[#FAF8F5] border border-[#E2D9CD] text-[#8E9E8C] flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Planner
                </span>
              </h1>
              <p className="text-xs text-[#A6998A] mt-0.5">優雅籌備您的完美婚宴 🌸</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-[#FAF8F5]/90 border border-[#E2D9CD] px-3 py-1.5 rounded-xl text-xs">
              <Calendar className="w-3.5 h-3.5 text-[#A6998A]" />
              <span className="text-[#A6998A] font-medium">婚禮日期:</span>
              <input 
                id="wedding_date_picker"
                type="date"
                value={weddingDate}
                onChange={(e) => setWeddingDate(e.target.value)}
                className="bg-transparent border-none text-[#4A443F] font-semibold focus:outline-none p-0 w-28 cursor-pointer"
              />
            </div>

            <button
              id="btn_export_data"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8E9E8C] text-white hover:bg-[#7D8C7C] rounded-lg text-xs font-semibold shadow-xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              匯出 Excel
            </button>
            <button
              id="btn_reset_data"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-[#4A443F] hover:bg-[#FAF8F5] border border-[#E2D9CD] rounded-lg text-xs font-semibold transition"
              title="清除所有資料"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              全部清除
            </button>
          </div>

        </div>
      </header>

      <main className="relative flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6">
        
        <div className={`bg-white border border-[#F0EBE4] rounded-[2rem] p-6 shadow-xs mb-6 flex flex-col md:flex-row justify-between items-center gap-4 relative overflow-hidden transition ${!isSyncEnabled ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={!isSyncEnabled}>
          <div className="absolute top-0 left-0 h-1.5 w-full bg-[#8E9E8C]" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#F5F8F5] flex items-center justify-center text-[#8E9E8C]">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#A6998A] mb-1">Wedding Countdown</p>
              <h2 className="text-lg font-serif text-[#5E564E]">
                {daysRemaining === null ? (
                  <>請先設定您的 <span className="text-[#D4A373] text-xl font-bold">大喜之日</span></>
                ) : daysRemaining > 0 ? (
                  <>距離大喜之日還有 <span className="text-[#D4A373] text-2xl font-bold font-mono">{daysRemaining}</span> 天</>
                ) : daysRemaining === 0 ? (
                  <span className="text-[#8E9E8C] font-bold flex items-center gap-1">🎉 祝新婚快樂！今天就是你們的大喜之日！ 🎉</span>
                ) : (
                  <>大喜之日已圓滿完成 <span className="text-[#A6998A] font-mono font-bold">{Math.abs(daysRemaining)}</span> 天</>
                )}
              </h2>
              <p className="text-xs text-[#A6998A] mt-1 italic">
                「百年好合，琴瑟和鳴」— 記錄下籌備的每一步，成就最璀璨的回憶。
              </p>
            </div>
          </div>

          <div className="flex gap-4 self-stretch md:self-auto justify-around border-t md:border-t-0 md:border-l border-[#E2D9CD] pt-4 md:pt-0 md:pl-6 text-center">
            <div>
              <span className="text-[10px] text-[#A6998A] block uppercase font-semibold tracking-wider">待辦完成率</span>
              <span className="text-lg font-bold text-[#5E564E] font-mono">
                {tasks.length > 0 
                  ? `${Math.round((tasks.filter(t => t.status === 'Completed').length / tasks.length) * 100)}%`
                  : '0%'
                }
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#A6998A] block uppercase font-semibold tracking-wider">已安排桌席</span>
              <span className="text-lg font-bold text-[#5E564E] font-mono">
                {tableAssignments.tables.length} 桌
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#A6998A] block uppercase font-semibold tracking-wider">總賓客人數</span>
              <span className="text-lg font-bold text-[#5E564E] font-mono">
                {tableAssignments.tables.reduce((acc, t) => acc + t.guests.length, 0)} 人
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#F0EBE4] rounded-[2rem] p-6 shadow-xs mb-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-1 w-full bg-[#D4A373]/60" />
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            
            <div className="space-y-2 max-w-md">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[#8E9E8C]" />
                <h3 className="text-sm font-semibold font-serif text-[#5E564E] tracking-tight">
                  與另一半共用婚禮計畫
                </h3>
              </div>
              <p className="text-xs text-[#A6998A] leading-relaxed">
                和另一半或婚禮夥伴輸入相同的共用名稱與同步金鑰，就能開啟同一份婚禮計畫。編輯者名稱則用來辨識每次更新是由誰完成。
              </p>
              
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[10px] font-semibold text-[#8C745A]">同步狀態：</span>
                {syncStatus === 'offline' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-stone-100 border border-stone-200 text-stone-600 text-[10px] font-medium">
                    <CloudOff className="w-3 h-3 text-stone-400" />
                    本機單機模式（不儲存至雲端）
                  </span>
                )}
                {syncStatus === 'loading' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FAF5EE] border border-[#E8DFD1] text-[#D4A373] text-[10px] font-medium animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin text-[#D4A373]" />
                    正在連接雲端資料庫...
                  </span>
                )}
                {syncStatus === 'synced' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F5F8F5] border border-[#E2D9CD]/50 text-[#8E9E8C] text-[10px] font-bold">
                    <Cloud className="w-3 h-3 text-[#8E9E8C]" />
                    已連線：{activeDocumentId}
                  </span>
                )}
                {hasUnsavedChanges && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold" role="status">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
                    有尚未儲存的變更
                  </span>
                )}
                {syncStatus === 'synced' && !hasUnsavedChanges && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-medium" role="status">
                    <CheckCircle2 className="w-3 h-3" />
                    所有變更已儲存
                  </span>
                )}
                {syncStatus === 'error' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 border border-red-100 text-red-500 text-[10px] font-medium">
                    <X className="w-3 h-3 text-red-400" />
                    連線異常
                  </span>
                )}
                {syncError && (
                  <span className="text-[10px] text-red-400 font-medium block w-full mt-0.5">
                    ⚠️ {syncError}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 max-w-2xl bg-[#FAF8F5] border border-[#F0EBE4] p-4 rounded-2xl space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
              <div className="w-full space-y-1.5">
                <label className="block text-[10px] font-bold text-[#A6998A] uppercase tracking-wider">
                  💍 共用計畫名稱（必填）
                </label>
                <input
                  type="text"
                  placeholder="雙方輸入相同名稱"
                  value={username}
                  disabled={isSyncEnabled}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E2D9CD] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#8E9E8C] font-mono disabled:bg-stone-100 disabled:text-stone-500"
                />
              </div>
              <div className="w-full space-y-1.5">
                <label className="block text-[10px] font-bold text-[#A6998A] uppercase tracking-wider">
                  👤 您的編輯者名稱（必填）
                </label>
                <input
                  type="text"
                  placeholder="用來顯示由誰更新"
                  value={editorName}
                  disabled={isSyncEnabled}
                  onChange={(e) => setEditorName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E2D9CD] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#8E9E8C] disabled:bg-stone-100 disabled:text-stone-500"
                />
                <p className="text-[9px] text-[#A6998A] font-mono">裝置識別碼：{editorId.slice(0, 8).toUpperCase()}</p>
              </div>
              <div className="w-full space-y-1.5">
                <label className="block text-[10px] font-bold text-[#A6998A] uppercase tracking-wider">
                  🔑 專屬婚禮同步金鑰（必填）
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="輸入同步金鑰"
                    value={syncKey}
                    disabled={isSyncEnabled}
                    onChange={(e) => setSyncKey(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleConfirmCredentials()}
                    className="w-full pl-3 pr-11 py-2 text-xs bg-white border border-[#E2D9CD] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#8E9E8C] font-mono disabled:bg-stone-100 disabled:text-stone-500"
                  />
                  <button
                    onClick={handleConfirmCredentials}
                    disabled={isSyncEnabled || !username.trim() || !editorName.trim() || !syncKey.trim()}
                    className="absolute right-1 top-1 bottom-1 aspect-square flex items-center justify-center bg-[#8E9E8C] hover:bg-[#7D8C7C] text-white rounded-lg transition disabled:bg-stone-300 disabled:cursor-not-allowed"
                    title="確認並連接雲端資料"
                    aria-label="確認共用名稱、編輯者名稱及同步金鑰"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                {isSyncEnabled && (
                  <button
                    onClick={async () => {
                      if (hasUnsavedChanges && !await showConfirm('更改帳戶資料？', '目前有尚未儲存的變更，繼續後這些變更可能會遺失。')) return;
                      setIsSyncEnabled(false);
                      setActiveDocumentId('');
                      setSyncStatus('offline');
                    }}
                    className="px-3.5 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    更改帳戶資料
                  </button>
                )}

                <button
                  onClick={handleManualUpload}
                  disabled={!isSyncEnabled}
                  className="relative px-3.5 py-2 bg-[#8E9E8C] hover:bg-[#7D8C7C] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:bg-stone-300 disabled:cursor-not-allowed"
                  title="將目前資料儲存至雲端"
                >
                  {hasUnsavedChanges && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white" aria-hidden="true" />
                  )}
                  儲存
                </button>
                <button
                  onClick={handleManualDownload}
                  disabled={!isSyncEnabled}
                  className="px-3.5 py-2 bg-white hover:bg-[#F2EDE4]/30 border border-[#E2D9CD] text-[#5E564E] text-xs font-semibold rounded-xl transition cursor-pointer disabled:bg-stone-100 disabled:text-stone-400 disabled:cursor-not-allowed"
                  title="從雲端同步最新資料並覆蓋本機"
                >
                  從雲端同步
                </button>
              </div>
            </div>

          </div>
        </div>

        {!isSyncEnabled && (
          <p className="mb-4 text-center text-xs font-medium text-[#8C745A]">請先填寫共用計畫名稱、編輯者名稱與同步金鑰，並按下 ✓ 解鎖婚禮籌備內容。</p>
        )}
        <div className={`bg-[#F2EDE4]/70 p-1 rounded-2xl border border-[#E2D9CD] grid grid-cols-2 sm:flex gap-1 mb-6 max-w-3xl mx-auto w-full transition ${!isSyncEnabled ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={!isSyncEnabled}>
          <button
            id="btn_tab_todo"
            onClick={() => setActiveTab('todo')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'todo'
                ? 'bg-white text-[#5E564E] shadow-xs border border-[#E2D9CD]/50'
                : 'text-[#8C745A] hover:bg-white/40'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            待辦與預算
          </button>
          <button
            id="btn_tab_calendar"
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'calendar'
                ? 'bg-white text-[#5E564E] shadow-xs border border-[#E2D9CD]/50'
                : 'text-[#8C745A] hover:bg-white/40'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            籌備日曆
          </button>
          <button
            id="btn_tab_responses"
            onClick={() => setActiveTab('responses')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'responses'
                ? 'bg-white text-[#5E564E] shadow-xs border border-[#E2D9CD]/50'
                : 'text-[#8C745A] hover:bg-white/40'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            回覆清單
          </button>
          <button
            id="btn_tab_table"
            onClick={() => setActiveTab('table')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'table'
                ? 'bg-white text-[#5E564E] shadow-xs border border-[#E2D9CD]/50'
                : 'text-[#8C745A] hover:bg-white/40'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            宴席排座
          </button>
        </div>

        <div className={`w-full transition ${!isSyncEnabled ? 'pointer-events-none opacity-40 select-none' : ''}`} aria-disabled={!isSyncEnabled}>
          {activeTab === 'todo' && (
            <TodoList 
              tasks={tasks} 
              setTasks={setTasks} 
              categories={categories}
              setCategories={setCategories}
            />
          )}
          {activeTab === 'calendar' && (
            <WeddingCalendar 
              tasks={tasks} 
              calendarEvents={calendarEvents} 
              setCalendarEvents={setCalendarEvents} 
            />
          )}
          {activeTab === 'responses' && (
            <ResponseWorkspace
              sourceConfig={responseSourceConfig}
              setSourceConfig={setResponseSourceConfig}
              headers={responseHeaders}
              setHeaders={setResponseHeaders}
              responses={formResponses}
              setResponses={setFormResponses}
              fieldMapping={responseFieldMapping}
              setFieldMapping={setResponseFieldMapping}
              filterRules={responseFilterRules}
              setFilterRules={setResponseFilterRules}
            />
          )}
          {activeTab === 'table' && (
            <TablePlanner 
              tableAssignments={tableAssignments} 
              setTableAssignments={setTableAssignments}
              responseGuests={filteredResponseGuestCandidates}
            />
          )}
        </div>

      </main>

      <footer className="mt-12 text-center text-[11px] text-[#A6998A]">
        <p>© 2026 婚禮待辦與排座助手 • 陪伴每對新人優雅起航</p>
      </footer>
    </div>
  );
}
