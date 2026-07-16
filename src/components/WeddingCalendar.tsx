/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CalendarEvent, TodoItem } from '../types';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon, 
  Clock, 
  Tag, 
  X,
  Sparkles,
  ClipboardList,
  Edit3,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WeddingCalendarProps {
  tasks: TodoItem[];
  setTasks: React.Dispatch<React.SetStateAction<TodoItem[]>>;
  calendarEvents: CalendarEvent[];
  setCalendarEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
}

export default function WeddingCalendar({ 
  tasks, 
  setTasks,
  calendarEvents, 
  setCalendarEvents 
}: WeddingCalendarProps) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    today.toISOString().split('T')[0]
  );
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingItem, setEditingItem] = useState<{ type: 'task' | 'event'; id: string } | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Form states for new calendar event
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventNotes, setNewEventNotes] = useState('');
  const [newEventTime, setNewEventTime] = useState('09:00');
  const [newEventCategory, setNewEventCategory] = useState('婚禮準備');

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  // Helper to format date as YYYY-MM-DD
  const formatDateString = (year: number, month: number, day: number) => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  // Generate days in the calendar month grid (including padding from previous & next months)
  const getCalendarDays = () => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const totalDaysInPrevMonth = new Date(prevMonthYear, prevMonth + 1, 0).getDate();

    const days = [];

    // Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = totalDaysInPrevMonth - i;
      days.push({
        dayNum,
        monthOffset: -1,
        dateStr: formatDateString(prevMonthYear, prevMonth, dayNum)
      });
    }

    // Current month days
    for (let i = 1; i <= totalDaysInMonth; i++) {
      days.push({
        dayNum: i,
        monthOffset: 0,
        dateStr: formatDateString(currentYear, currentMonth, i)
      });
    }

    // Next month padding days to fill 6 weeks (42 cells)
    const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        dayNum: i,
        monthOffset: 1,
        dateStr: formatDateString(nextMonthYear, nextMonth, i)
      });
    }

    return days;
  };

  const calendarDays = getCalendarDays();
  const monthNames = [
    '一月 January', '二月 February', '三月 March', '四月 April', 
    '五月 May', '六月 June', '七月 July', '八月 August', 
    '九月 September', '十月 October', '十一月 November', '十二月 December'
  ];

  const isValidEventTime = (time?: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time || '');

  const getEventTime = (event: CalendarEvent) => isValidEventTime(event.time) ? event.time! : '00:00';
  const getTaskTime = (task: TodoItem) => isValidEventTime(task.due_time) ? task.due_time! : '23:59';

  const sortEventsByTime = (events: CalendarEvent[]) => [...events].sort((a, b) => {
    const timeCompare = getEventTime(a).localeCompare(getEventTime(b));
    if (timeCompare !== 0) return timeCompare;
    return a.title.localeCompare(b.title);
  });

  // Get items for a given date
  const getItemsForDate = (dateStr: string) => {
    const dayTasks = tasks.filter(t => t.due_date === dateStr)
      .sort((a, b) => getTaskTime(a).localeCompare(getTaskTime(b)) || a.title.localeCompare(b.title));
    const dayEvents = calendarEvents.filter(e => e.date === dateStr);
    return { dayTasks, dayEvents };
  };

  const getPreviewItemsForDate = (dateStr: string) => {
    const { dayTasks, dayEvents } = getItemsForDate(dateStr);
    const eventItems = sortEventsByTime(dayEvents).map(event => ({
      id: event.id,
      type: 'event' as const,
      label: `${getEventTime(event)} ${event.title}`,
      className: 'bg-[#FAF5EE] text-[#8C745A] border-[#E8DFD1]',
    }));
    const taskItems = dayTasks.map(task => ({
      id: task.id,
      type: 'task' as const,
      label: `${task.due_time || ''} ${task.title}`.trim(),
      className: 'bg-[#F5F8F5] text-[#7D8C7C] border-[#E2D9CD]/40',
    }));
    return [...eventItems, ...taskItems];
  };

  // Handle adding custom event
  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;

    const newEvent: CalendarEvent = {
      id: `event_${Date.now()}`,
      title: newEventTitle.trim(),
      date: selectedDateStr,
      time: isValidEventTime(newEventTime) ? newEventTime : '00:00',
      notes: newEventNotes,
      category: newEventCategory
    };

    setCalendarEvents(prev => [...prev, newEvent]);
    setNewEventTitle('');
    setNewEventTime('09:00');
    setNewEventNotes('');
    setIsAddingEvent(false);
  };

  // Handle deleting custom event
  const handleDeleteEvent = (id: string) => {
    setCalendarEvents(prev => prev.filter(e => e.id !== id));
  };

  const handleStartEdit = (type: 'task' | 'event', item: TodoItem | CalendarEvent) => {
    setEditingItem({ type, id: item.id });
    setEditTitle(item.title);
    setEditDate(type === 'task' ? (item as TodoItem).due_date : (item as CalendarEvent).date);
    setEditTime(type === 'task' ? (item as TodoItem).due_time || '' : (item as CalendarEvent).time || '');
    setEditNotes(item.notes || '');
  };

  const handleSaveEdit = () => {
    if (!editingItem || !editTitle.trim() || !editDate) return;
    if (editingItem.type === 'task') {
      setTasks(previous => previous.map(task => task.id === editingItem.id ? {
        ...task, title: editTitle.trim(), due_date: editDate,
        due_time: isValidEventTime(editTime) ? editTime : undefined, notes: editNotes
      } : task));
    } else {
      setCalendarEvents(previous => previous.map(event => event.id === editingItem.id ? {
        ...event, title: editTitle.trim(), date: editDate,
        time: isValidEventTime(editTime) ? editTime : '00:00', notes: editNotes
      } : event));
    }
    setSelectedDateStr(editDate);
    setEditingItem(null);
  };
  const { dayTasks: selectedTasks, dayEvents: selectedEvents } = getItemsForDate(selectedDateStr);
  const sortedSelectedEvents = sortEventsByTime(selectedEvents);
  const totalItemsToday = selectedTasks.length + selectedEvents.length;

  return (
    <div id="calendar_section" className="bg-white rounded-[2rem] shadow-sm border border-[#F0EBE4] p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold font-serif tracking-tight text-[#5E564E] flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[#8E9E8C]" />
            婚禮籌備日曆
          </h2>
          <p className="text-xs text-[#A6998A] mt-1">連結待辦事項截止日與自訂行程，掌握關鍵時程</p>
        </div>
        
        {/* Month selector controls */}
        <div className="flex items-center gap-2 bg-[#FAF8F5] border border-[#F0EBE4] rounded-xl px-3 py-1.5 self-start md:self-auto">
          <button
            id="btn_prev_month"
            onClick={handlePrevMonth}
            className="p-1 hover:bg-[#F2EDE4] rounded-lg text-[#5E564E] transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold font-serif text-[#5E564E] min-w-[110px] text-center">
            {currentYear}年 {monthNames[currentMonth].split(' ')[0]}
          </span>
          <button
            id="btn_next_month"
            onClick={handleNextMonth}
            className="p-1 hover:bg-[#F2EDE4] rounded-lg text-[#5E564E] transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="border border-[#F0EBE4] rounded-[1.5rem] overflow-hidden bg-white mb-6">
        {/* Week headers */}
        <div className="grid grid-cols-7 border-b border-[#F0EBE4] bg-[#FAF8F5] text-center py-2.5 text-xs font-semibold text-[#8C745A]">
          <div>日</div>
          <div>一</div>
          <div>二</div>
          <div>三</div>
          <div>四</div>
          <div>五</div>
          <div>六</div>
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 bg-white">
          {calendarDays.map((day, idx) => {
            const previewItems = getPreviewItemsForDate(day.dateStr);
            const visiblePreviewItems = previewItems.slice(0, 2);
            const hiddenPreviewCount = Math.max(previewItems.length - visiblePreviewItems.length, 0);
            const isSelected = day.dateStr === selectedDateStr;
            const isToday = day.dateStr === today.toISOString().split('T')[0];
            const hasItems = previewItems.length > 0;
            const isCurrentMonth = day.monthOffset === 0;

            return (
              <div
                key={idx}
                onClick={() => setSelectedDateStr(day.dateStr)}
                className={`min-h-[74px] sm:min-h-[88px] p-1 sm:p-1.5 border-r border-b border-[#F0EBE4] flex flex-col justify-start cursor-pointer transition-all hover:bg-[#FAF8F5]/80 ${
                  isCurrentMonth ? 'text-[#5E564E]' : 'text-[#A6998A]/50 bg-[#FAF8F5]/30'
                } ${isSelected ? 'bg-[#F2EDE4]/70 ring-1 ring-inset ring-[#8E9E8C]/50' : ''}`}
              >
                {/* Day number row */}
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-xs font-mono font-medium rounded-full w-5 h-5 flex items-center justify-center ${
                    isToday ? 'bg-[#8E9E8C] text-white font-bold' : ''
                  } ${isSelected && !isToday ? 'bg-[#D4A373]/20 text-[#8C745A] font-bold' : ''}`}>
                    {day.dayNum}
                  </span>
                  {hasItems && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4A373]" />
                  )}
                </div>

                {/* Event previews */}
                <div className="flex flex-col gap-0.5 justify-start overflow-hidden max-h-[42px] sm:max-h-[48px] pointer-events-none">
                  {visiblePreviewItems.map(item => (
                    <div
                      key={`${item.type}_${item.id}`}
                      className={`text-[7px] sm:text-[8px] px-1 py-0.5 rounded border truncate font-medium max-w-full ${item.className}`}
                    >
                      {item.type === 'task' && <span className="inline-block w-1 h-1 rounded-full bg-[#8E9E8C] mr-0.5 align-middle" />}
                      {item.label}
                    </div>
                  ))}
                  {hiddenPreviewCount > 0 && (
                    <div className="text-[7px] sm:text-[8px] text-[#8C745A] text-right pr-0.5 font-bold font-mono">
                      +{hiddenPreviewCount}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily schedule details panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-stretch">
        {/* Selected date events (7 cols) */}
        <div className="lg:col-span-7 border border-[#F0EBE4] rounded-[2rem] p-5 flex flex-col bg-[#FAF8F5]/50 justify-between">
          <div>
            <div className="flex justify-between items-center border-b border-[#E2D9CD]/60 pb-3 mb-4">
              <div>
                <h3 className="font-serif text-base font-bold text-[#5E564E]">
                  {selectedDateStr === today.toISOString().split('T')[0] ? '今天 ' : ''}
                  {selectedDateStr.split('-')[1]}月{selectedDateStr.split('-')[2]}日 的排程
                </h3>
                <p className="text-[10px] text-[#A6998A] mt-0.5 font-mono">{selectedDateStr}</p>
              </div>
              
              <button
                id="btn_add_agenda_toggle"
                onClick={() => setIsAddingEvent(!isAddingEvent)}
                className="flex items-center gap-1 px-3 py-1 bg-[#F2EDE4] text-[#8C745A] hover:bg-[#E6D5C3]/80 border border-[#E2D9CD] rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                {isAddingEvent ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                新增行程
              </button>
            </div>

            {/* Event Form Overlay inside Card */}
            <AnimatePresence>
              {isAddingEvent && (
                <motion.form
                  onSubmit={handleAddEvent}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white border border-[#E2D9CD] rounded-2xl p-4 mb-4 space-y-3 overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-medium text-[#A6998A] mb-1">行程名稱 *</label>
                      <input
                        type="text"
                        required
                        placeholder="輸入行程名稱"
                        value={newEventTitle}
                        onChange={e => setNewEventTitle(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-[#E2D9CD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8E9E8C]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-[#A6998A] mb-1">時間</label>
                      <input
                        type="time"
                        step="60"
                        lang="en-GB"
                        value={newEventTime}
                        onChange={e => setNewEventTime(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-[#E2D9CD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8E9E8C] font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-[#A6998A] mb-1">分類標籤</label>
                      <select
                        value={newEventCategory}
                        onChange={e => setNewEventCategory(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-[#E2D9CD] rounded-lg focus:outline-none"
                      >
                        <option value="婚禮準備">婚禮準備</option>
                        <option value="與廠商見面">與廠商見面</option>
                        <option value="儀式與排練">儀式與排練</option>
                        <option value="付款提醒">付款提醒</option>
                        <option value="重要紀念日">重要紀念日</option>
                        <option value="其他行程">其他行程</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-[#A6998A] mb-1">行程備註</label>
                    <input
                      type="text"
                      placeholder="輸入補充細節"
                      value={newEventNotes}
                      onChange={e => setNewEventNotes(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-[#E2D9CD] rounded-lg focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsAddingEvent(false)}
                      className="px-2.5 py-1.5 bg-[#FAF8F5] text-[#A6998A] text-[10px] font-semibold rounded-lg transition"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-[#8E9E8C] text-white text-[10px] font-semibold rounded-lg hover:bg-[#7D8C7C] transition cursor-pointer"
                    >
                      新增行程
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {editingItem && (
              <div className="bg-white border border-[#E2D9CD] rounded-2xl p-4 mb-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="標題" className="px-3 py-1.5 text-xs border border-[#E2D9CD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8E9E8C]" />
                  <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="px-3 py-1.5 text-xs border border-[#E2D9CD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8E9E8C]" />
                  <input type="time" step="60" value={editTime} onChange={e => setEditTime(e.target.value)} className="px-3 py-1.5 text-xs border border-[#E2D9CD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8E9E8C]" />
                  <input type="text" value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="備註" className="px-3 py-1.5 text-xs border border-[#E2D9CD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8E9E8C]" />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEditingItem(null)} className="px-2.5 py-1.5 bg-stone-100 text-stone-500 text-[10px] font-semibold rounded-lg">取消</button>
                  <button type="button" onClick={handleSaveEdit} className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#8E9E8C] text-white text-[10px] font-semibold rounded-lg"><Check className="w-3 h-3" />儲存</button>
                </div>
              </div>
            )}
            {/* List of Today's Items */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {totalItemsToday === 0 ? (
                <div className="text-center py-8 bg-white border border-[#F0EBE4] rounded-2xl">
                  <CalendarIcon className="w-6 h-6 text-[#A6998A]/40 mx-auto mb-1.5" />
                  <p className="text-xs text-[#A6998A]">這一天尚無任何待辦或自訂行程</p>
                </div>
              ) : (
                <>
                  {/* Custom Calendar Events */}
                  {sortedSelectedEvents.map(ev => (
                    <div 
                      key={ev.id}
                      className="flex items-center justify-between p-3 bg-white border border-[#F0EBE4] rounded-xl hover:border-[#D4A373]/40 transition group"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[#FAF5EE] flex items-center justify-center text-[#D4A373] shrink-0">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FAF5EE] text-[#8C745A] border border-[#E8DFD1] font-mono font-bold">{getEventTime(ev)}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white text-[#8C745A] border border-[#E8DFD1]">行事曆</span>
                            <span className="text-xs font-semibold text-[#5E564E]">{ev.title}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#FAF5EE] text-[#D4A373] border border-[#E8DFD1]">
                              {ev.category || '行程'}
                            </span>
                          </div>
                          {ev.notes && (
                            <p className="text-[10px] text-[#A6998A] mt-1">{ev.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleStartEdit('event', ev)} className="p-1.5 hover:bg-[#FAF8F5] text-[#A6998A]/70 hover:text-[#8E9E8C] rounded-lg transition cursor-pointer" title="編輯行程">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>                        <button
                          onClick={() => handleDeleteEvent(ev.id)}
                        className="p-1.5 hover:bg-[#FAF8F5] text-[#A6998A]/70 hover:text-[#D4A373] rounded-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition cursor-pointer"
                        title="刪除此行程"
                      >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Deadline Tasks */}
                  {selectedTasks.map(task => (
                    <div 
                      key={task.id}
                      className="flex items-center justify-between p-3 bg-white border border-[#F0EBE4] rounded-xl hover:border-[#8E9E8C]/40 transition group"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[#F5F8F5] flex items-center justify-center text-[#8E9E8C] shrink-0">
                          <ClipboardList className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F5F8F5] text-[#7D8C7C] border border-[#E2D9CD]/40 font-mono font-bold">{task.due_time || '全天'}</span><span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white text-[#7D8C7C] border border-[#E2D9CD]/40">待辦</span><span className="text-xs font-semibold text-[#5E564E]">{task.title}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#F5F8F5] text-[#7D8C7C] border border-[#E2D9CD]/30">
                              截止待辦
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">
                              {task.status === 'Completed' ? '已完成' : task.status === 'In_Progress' ? '進行中' : '未開始'}
                            </span>
                          </div>
                          {task.notes && (
                            <p className="text-[10px] text-[#A6998A] mt-1">{task.notes}</p>
                          )}
                        </div>
                      </div>
                      <button onClick={() => handleStartEdit('task', task)} className="p-1.5 hover:bg-[#FAF8F5] text-[#A6998A]/70 hover:text-[#8E9E8C] rounded-lg transition cursor-pointer" title="編輯待辦">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Tips & Month stats summary (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="border border-[#E2D9CD] rounded-[2rem] p-5 bg-white space-y-4">
            <h3 className="text-xs font-semibold text-[#5E564E] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#8E9E8C]" />
              籌備行事曆小幫手
            </h3>
            <ul className="text-[11px] text-[#8C8479] space-y-2 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="text-[#8E9E8C] mt-0.5">•</span>
                <span><strong>連動功能：</strong>只要在待辦清單中設定了截止日期，該項任務就會自動出現在日曆的該日，免除重複輸入。</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#8E9E8C] mt-0.5">•</span>
                <span><strong>自訂行程：</strong>除了待辦清單，您還可以點擊任意日期，手動加入當日的與廠商會面、試穿禮服等零星行程。</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#8E9E8C] mt-0.5">•</span>
                <span><strong>時程管理：</strong>建議將付款提醒、彩排日、婚攝溝通日都加入，可以清晰看出每週、每月的籌備熱點。</span>
              </li>
            </ul>
          </div>

          <div className="border border-[#F0EBE4] rounded-[2rem] p-5 bg-[#FAF8F5] text-center flex flex-col justify-center items-center flex-1">
            <span className="text-[10px] uppercase tracking-wider text-[#A6998A] mb-1 font-semibold">本月籌備熱度</span>
            <div className="text-2xl font-serif font-bold text-[#8C745A] my-1 font-mono">
              {(() => {
                const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
                const mTasks = tasks.filter(t => t.due_date.startsWith(prefix)).length;
                const mEvents = calendarEvents.filter(e => e.date.startsWith(prefix)).length;
                return `${mTasks + mEvents} 件安排`;
              })()}
            </div>
            <p className="text-[10px] text-[#A6998A] max-w-[180px] mt-1 leading-normal">
              本月共安排了多項準備與待辦事項。分工合作，每天前進一小步！
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
