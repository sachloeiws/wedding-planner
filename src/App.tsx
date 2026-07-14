/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import TodoList from './components/TodoList';
import TablePlanner from './components/TablePlanner';
import WeddingCalendar from './components/WeddingCalendar';
import { TodoItem, TableAssignments, CalendarEvent } from './types';
import { 
  Heart, 
  Calendar, 
  Download, 
  RefreshCw, 
  Gift, 
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  X,
  ClipboardList,
  Users,
  Cloud,
  CloudOff,
  Wifi,
  WifiOff,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { saveWeddingPlan, loadWeddingPlan, subscribeWeddingPlan, WeddingPlanData } from './lib/firebase';

export default function App() {
  // States initialized without any default values
  const [tasks, setTasks] = useState<TodoItem[]>(() => {
    const saved = localStorage.getItem('wedding_tasks');
    return saved ? JSON.parse(saved) : [];
  });

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
    return saved ? saved : '';
  });

  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('wedding_categories');
    return saved ? JSON.parse(saved) : [];
  });

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() => {
    const saved = localStorage.getItem('wedding_calendar_events');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTab, setActiveTab] = useState<'todo' | 'calendar' | 'table'>('todo');

  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Firebase Sync States
  const [syncKey, setSyncKey] = useState<string>(() => {
    return localStorage.getItem('wedding_sync_key') || '';
  });
  const [isSyncEnabled, setIsSyncEnabled] = useState<boolean>(() => {
    return localStorage.getItem('wedding_sync_enabled') === 'true';
  });
  const [syncStatus, setSyncStatus] = useState<'offline' | 'loading' | 'synced' | 'error'>('offline');
  const [syncError, setSyncError] = useState<string>('');
  const [isUpdatingFromCloud, setIsUpdatingFromCloud] = useState<boolean>(false);

  // Fixed Infinite Loop: Using functional state updates to avoid stale closures
  useEffect(() => {
    if (!isSyncEnabled || !syncKey.trim()) {
      setSyncStatus('offline');
      return;
    }

    setSyncStatus('loading');
    setSyncError('');

    const unsubscribe = subscribeWeddingPlan(
      syncKey.trim(),
      (cloudData) => {
        if (!cloudData) {
          setSyncStatus('synced');
          return;
        }

        setIsUpdatingFromCloud(true);
        
        if (cloudData.weddingDate) {
          setWeddingDate(prev => prev !== cloudData.weddingDate ? cloudData.weddingDate : prev);
        }
        if (cloudData.categories) {
          setCategories(prev => JSON.stringify(prev) !== JSON.stringify(cloudData.categories) ? cloudData.categories : prev);
        }
        if (cloudData.tasks) {
          setTasks(prev => JSON.stringify(prev) !== JSON.stringify(cloudData.tasks) ? cloudData.tasks : prev);
        }
        if (cloudData.tableAssignments) {
          setTableAssignments(prev => JSON.stringify(prev) !== JSON.stringify(cloudData.tableAssignments) ? cloudData.tableAssignments : prev);
        }
        if (cloudData.calendarEvents) {
          setCalendarEvents(prev => JSON.stringify(prev) !== JSON.stringify(cloudData.calendarEvents) ? cloudData.calendarEvents : prev);
        }

        setTimeout(() => {
          setIsUpdatingFromCloud(false);
          setSyncStatus('synced');
        }, 150);
      },
      (err) => {
        setSyncStatus('error');
        setSyncError(`連線錯誤: ${err.message}`);
      }
    );

    localStorage.setItem('wedding_sync_key', syncKey);
    localStorage.setItem('wedding_sync_enabled', 'true');

    return () => {
      unsubscribe();
      setIsUpdatingFromCloud(false);
    };
  }, [isSyncEnabled, syncKey]);

  useEffect(() => {
    localStorage.setItem('wedding_sync_enabled', isSyncEnabled ? 'true' : 'false');
  }, [isSyncEnabled]);

  // Auto-sync local state changes to Firestore
  useEffect(() => {
    if (!isSyncEnabled || !syncKey.trim() || syncStatus !== 'synced') return;
    if (isUpdatingFromCloud) return;

    const dataToSave: WeddingPlanData = {
      weddingDate,
      categories,
      tasks,
      tableAssignments,
      calendarEvents
    };

    const timeoutId = setTimeout(() => {
      saveWeddingPlan(syncKey.trim(), dataToSave)
        .catch(err => {
          console.error("Auto-sync error:", err);
          setSyncStatus('error');
          setSyncError('自動同步失敗，請檢查網路。');
        });
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [tasks, tableAssignments, weddingDate, categories, calendarEvents, isSyncEnabled, syncKey, syncStatus, isUpdatingFromCloud]);

  const handleManualUpload = async () => {
    if (!syncKey.trim()) {
      alert("請先輸入您的婚禮同步金鑰！");
      return;
    }
    try {
      setSyncStatus('loading');
      const dataToSave: WeddingPlanData = {
        weddingDate,
        categories,
        tasks,
        tableAssignments,
        calendarEvents
      };
      await saveWeddingPlan(syncKey.trim(), dataToSave);
      setSyncStatus('synced');
      alert("成功將當前本地的所有籌備資料上傳備份至雲端！");
    } catch (err: any) {
      setSyncStatus('error');
      setSyncError(`上傳失敗: ${err.message}`);
      alert(`上傳失敗: ${err.message}`);
    }
  };

  const handleManualDownload = async () => {
    if (!syncKey.trim()) {
      alert("請先輸入您的婚禮同步金鑰！");
      return;
    }
    if (!window.confirm("確定要從雲端下載並【覆蓋】您目前這台設備上的所有資料嗎？(此動作無法復原)")) {
      return;
    }
    try {
      setSyncStatus('loading');
      const cloudData = await loadWeddingPlan(syncKey.trim());
      if (!cloudData) {
        alert("雲端尚無此金鑰的任何資料，無法下載覆蓋。");
        setSyncStatus('offline');
        return;
      }
      
      setIsUpdatingFromCloud(true);
      if (cloudData.weddingDate) setWeddingDate(cloudData.weddingDate);
      if (cloudData.categories) setCategories(cloudData.categories);
      if (cloudData.tasks) setTasks(cloudData.tasks);
      if (cloudData.tableAssignments) setTableAssignments(cloudData.tableAssignments);
      if (cloudData.calendarEvents) setCalendarEvents(cloudData.calendarEvents);
      
      setTimeout(() => {
        setIsUpdatingFromCloud(false);
        setSyncStatus('synced');
        alert("成功從雲端下載最新的籌備資料，已為您覆蓋本地！");
      }, 150);
    } catch (err: any) {
      setSyncStatus('error');
      setSyncError(`下載失敗: ${err.message}`);
      alert(`下載失敗: ${err.message}`);
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

  // Calculate Countdown (Handle empty state gracefully)
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

  const handleReset = () => {
    if (window.confirm('確定要清除所有資料並重設嗎？(這將覆蓋您目前的修改)')) {
      setTasks([]);
      setTableAssignments({ table_size_limit: 12, tables: [] });
      setWeddingDate('');
      setCategories([]);
      setCalendarEvents([]);
      setActiveTab('todo');
    }
  };

  const getExportJSON = () => {
    const formattedTodoList = tasks.map(t => ({
      id: t.id,
      category: t.category,
      title: t.title,
      due_date: t.due_date,
      status: t.status,
      notes: t.notes
    }));

    const formattedTableAssignments = {
      table_size_limit: tableAssignments.table_size_limit,
      tables: tableAssignments.tables.map(t => {
        const guestCount = t.guests.length;
        let status = 'Empty';
        if (guestCount === tableAssignments.table_size_limit) status = 'Full';
        else if (guestCount > tableAssignments.table_size_limit) status = 'Overfilled';
        else if (guestCount > 0) status = 'In_Progress';

        return {
          table_no: t.table_no,
          zone: t.zone,
          current_guests: guestCount,
          status: status,
          guests: t.guests 
        };
      })
    };

    return JSON.stringify({
      todo_list: formattedTodoList,
      table_assignments: formattedTableAssignments
    }, null, 2);
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(getExportJSON());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="wedding_app_container" className="min-h-screen bg-[#FAF8F5] text-[#4A443F] flex flex-col pb-12 antialiased">
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-[#8E9E8C]/10 via-[#F2EDE4]/30 to-transparent pointer-events-none" />

      <header className="relative bg-[#F2EDE4]/80 backdrop-blur-md border-b border-[#E2D9CD] px-6 py-4">
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
              onClick={() => setIsExporting(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8E9E8C] text-white hover:bg-[#7D8C7C] rounded-lg text-xs font-semibold shadow-xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              匯出 JSON
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
        
        <div className="bg-white border border-[#F0EBE4] rounded-[2rem] p-6 shadow-xs mb-6 flex flex-col md:flex-row justify-between items-center gap-4 relative overflow-hidden">
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
                  Firebase 雲端同步與多人即時協作
                </h3>
              </div>
              <p className="text-xs text-[#A6998A] leading-relaxed">
                在不同裝置（如：新郎電腦與新娘手機）輸入同一個專屬金鑰，即可實現多人實時編輯、即時安排桌位與更新籌備進度！
              </p>
              
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[10px] font-semibold text-[#8C745A]">同步狀態：</span>
                {syncStatus === 'offline' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-stone-100 border border-stone-200 text-stone-600 text-[10px] font-medium">
                    <CloudOff className="w-3 h-3 text-stone-400" />
                    本機單機模式 (不儲存至雲端)
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
                    已連線 (即時同步中)
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

            <div className="flex-1 max-w-lg bg-[#FAF8F5] border border-[#F0EBE4] p-4 rounded-2xl flex flex-col sm:flex-row items-end gap-3.5">
              <div className="flex-1 w-full space-y-1.5">
                <label className="block text-[10px] font-bold text-[#A6998A] uppercase tracking-wider">
                  🔑 您的專屬婚禮同步金鑰 (自訂英文/數字)
                </label>
                <input
                  type="text"
                  placeholder="例如：our-big-day-2026"
                  value={syncKey}
                  onChange={(e) => {
                    setSyncKey(e.target.value.trim());
                    if (isSyncEnabled) {
                      setIsSyncEnabled(false);
                      setSyncStatus('offline');
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E2D9CD] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#8E9E8C] font-mono"
                />
              </div>

              <div className="flex w-full sm:w-auto gap-2 shrink-0">
                {isSyncEnabled ? (
                  <button
                    onClick={() => {
                      setIsSyncEnabled(false);
                      setSyncStatus('offline');
                    }}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    中斷同步
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (!syncKey.trim()) {
                        alert("請先輸入金鑰名稱！");
                        return;
                      }
                      setIsSyncEnabled(true);
                    }}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-[#8E9E8C] hover:bg-[#7D8C7C] text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    啟動同步
                  </button>
                )}

                <button
                  onClick={handleManualUpload}
                  className="px-2.5 py-2 bg-white hover:bg-[#F2EDE4]/30 border border-[#E2D9CD] text-[#5E564E] text-xs font-semibold rounded-xl transition cursor-pointer"
                  title="將當前本地資料上傳覆蓋雲端"
                >
                  上傳
                </button>
                <button
                  onClick={handleManualDownload}
                  className="px-2.5 py-2 bg-white hover:bg-[#F2EDE4]/30 border border-[#E2D9CD] text-[#5E564E] text-xs font-semibold rounded-xl transition cursor-pointer"
                  title="從雲端下載最新資料覆蓋本地"
                >
                  下載
                </button>
              </div>
            </div>

          </div>
        </div>

        <div className="bg-[#F2EDE4]/70 p-1 rounded-2xl border border-[#E2D9CD] flex gap-1 mb-6 max-w-xl mx-auto w-full">
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

        <div className="w-full">
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
          {activeTab === 'table' && (
            <TablePlanner 
              tableAssignments={tableAssignments} 
              setTableAssignments={setTableAssignments} 
            />
          )}
        </div>

      </main>

      <AnimatePresence>
        {isExporting && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] border border-[#E2D9CD] shadow-xl max-w-2xl w-full p-6 flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center border-b border-[#F0EBE4] pb-4 mb-4">
                <div>
                  <h3 className="text-lg font-semibold font-serif text-[#5E564E]">匯出婚禮籌備資料</h3>
                  <p className="text-xs text-[#A6998A] mt-1">符合您的資料規格之 JSON 格式，可備份或傳遞給其他工具</p>
                </div>
                <button
                  id="btn_close_export"
                  onClick={() => setIsExporting(false)}
                  className="p-1 hover:bg-[#FAF8F5] rounded text-[#A6998A] hover:text-[#4A443F] transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-auto bg-[#5E564E] rounded-xl p-4 mb-4 relative font-mono text-xs text-stone-100">
                <button
                  id="btn_copy_json"
                  onClick={handleCopyJSON}
                  className="absolute top-3 right-3 p-1.5 bg-black/30 hover:bg-black/50 text-stone-200 hover:text-white rounded-lg border border-white/10 flex items-center gap-1 transition"
                  title="複製到剪貼簿"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="text-[10px]">{copied ? '已複製！' : '複製'}</span>
                </button>
                <pre className="whitespace-pre-wrap select-all">{getExportJSON()}</pre>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  id="btn_export_modal_close"
                  onClick={() => setIsExporting(false)}
                  className="px-4 py-2 bg-[#F2EDE4] hover:bg-[#E2D9CD] text-[#4A443F] rounded-lg text-xs font-semibold transition"
                >
                  關閉
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="mt-12 text-center text-[11px] text-[#A6998A]">
        <p>© 2026 婚禮待辦與排座助手 • 陪伴每對新人優雅起航</p>
      </footer>
    </div>
  );
}
