/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { TodoItem, TaskStatus } from '../types';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Trash2, 
  Plus, 
  Calendar, 
  Edit3, 
  X, 
  Check,
  AlertCircle,
  MapPin,
  Store,
  Phone,
  FolderPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TodoListProps {
  tasks: TodoItem[];
  setTasks: React.Dispatch<React.SetStateAction<TodoItem[]>>;
  categories: string[];
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
}

export default function TodoList({ 
  tasks, 
  setTasks, 
  categories, 
  setCategories 
}: TodoListProps) {
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Category management state
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Form states for adding
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState(categories[0] || '場地與餐宴');
  const [newDueDate, setNewDueDate] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newShopName, setNewShopName] = useState('');
  const [newBudget, setNewBudget] = useState('');
  const [newActualAmount, setNewActualAmount] = useState('');
  const [newContactInfo, setNewContactInfo] = useState('');
  const [newLocation, setNewLocation] = useState('');

  // Form states for editing
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editShopName, setEditShopName] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editActualAmount, setEditActualAmount] = useState('');
  const [editContactInfo, setEditContactInfo] = useState('');
  const [editLocation, setEditLocation] = useState('');

  // Delete category handler
  const handleDeleteCategory = (catName: string) => {
    const isUsed = tasks.some(t => t.category === catName);
    if (isUsed) {
      alert(`分類「${catName}」目前有待辦事項正在使用，請先修改該事項的分類後再行刪除。`);
      return;
    }
    
    if (categories.length <= 1) {
      alert('至少需保留一個分類！');
      return;
    }

    if (window.confirm(`確定要刪除「${catName}」分類嗎？`)) {
      const updated = categories.filter(c => c !== catName);
      setCategories(updated);
      if (newCategory === catName) {
        setNewCategory(updated[0]);
      }
    }
  };

  // Add Custom Category
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCategoryName.trim();
    if (!cleanName) return;

    if (categories.includes(cleanName)) {
      alert('此分類已存在！');
      return;
    }

    const updated = [...categories, cleanName];
    setCategories(updated);
    setNewCategory(cleanName); // auto select newly created category
    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTask: TodoItem = {
      id: `task_${Date.now()}`,
      category: newCategory,
      title: newTitle,
      due_date: newDueDate || new Date().toISOString().split('T')[0],
      status: 'Pending',
      notes: newNotes,
      shopName: newShopName.trim() || undefined,
      budget: newBudget ? parseFloat(newBudget) : undefined,
      actualAmount: newActualAmount ? parseFloat(newActualAmount) : undefined,
      contactInfo: newContactInfo.trim() || undefined,
      location: newLocation.trim() || undefined,
    };

    setTasks(prev => [newTask, ...prev]);
    
    // Reset form
    setNewTitle('');
    setNewDueDate('');
    setNewNotes('');
    setNewShopName('');
    setNewBudget('');
    setNewActualAmount('');
    setNewContactInfo('');
    setNewLocation('');
    setIsAdding(false);
  };

  const handleStartEdit = (task: TodoItem) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditCategory(task.category);
    setEditDueDate(task.due_date);
    setEditNotes(task.notes);
    setEditShopName(task.shopName || '');
    setEditBudget(task.budget !== undefined ? String(task.budget) : '');
    setEditActualAmount(task.actualAmount !== undefined ? String(task.actualAmount) : '');
    setEditContactInfo(task.contactInfo || '');
    setEditLocation(task.location || '');
  };

  const handleSaveEdit = (id: string) => {
    if (!editTitle.trim()) return;
    setTasks(prev => prev.map(t => t.id === id ? {
      ...t,
      title: editTitle,
      category: editCategory,
      due_date: editDueDate,
      notes: editNotes,
      shopName: editShopName.trim() || undefined,
      budget: editBudget ? parseFloat(editBudget) : undefined,
      actualAmount: editActualAmount ? parseFloat(editActualAmount) : undefined,
      contactInfo: editContactInfo.trim() || undefined,
      location: editLocation.trim() || undefined,
    } : t));
    setEditingId(null);
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const toggleTaskStatus = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        let nextStatus: TaskStatus = 'Pending';
        if (t.status === 'Pending') nextStatus = 'In_Progress';
        else if (t.status === 'In_Progress') nextStatus = 'Completed';
        return { ...t, status: nextStatus };
      }
      return t;
    }));
  };

  // Budget calculations
  const totalBudget = tasks.reduce((acc, t) => acc + (t.budget || 0), 0);
  const totalActual = tasks.reduce((acc, t) => acc + (t.actualAmount || 0), 0);
  const budgetDiff = totalBudget - totalActual;

  // Calculate completion percentage
  const completedCount = tasks.filter(t => t.status === 'Completed').length;
  const progressPercent = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  // Filtered tasks
  const filteredTasks = tasks.filter(t => {
    const matchCat = filterCategory === 'All' || t.category === filterCategory;
    const matchStatus = filterStatus === 'All' || t.status === filterStatus;
    return matchCat && matchStatus;
  });

  const getStatusStyle = (status: TaskStatus) => {
    switch (status) {
      case 'Completed':
        return {
          bg: 'bg-[#F5F8F5] text-[#7D8C7C] border-[#E2D9CD]/50',
          icon: <CheckCircle2 className="w-5 h-5 text-[#8E9E8C]" />
        };
      case 'In_Progress':
        return {
          bg: 'bg-[#FAF5EE] text-[#D4A373] border-[#E8DFD1]',
          icon: <Clock className="w-5 h-5 text-[#D4A373]" />
        };
      default:
        return {
          bg: 'bg-white text-[#A6998A] border-[#E2D9CD]/50',
          icon: <Circle className="w-5 h-5 text-[#A6998A]" />
        };
    }
  };

  const getStatusLabel = (status: TaskStatus) => {
    switch (status) {
      case 'Completed': return '已完成';
      case 'In_Progress': return '進行中';
      default: return '未開始';
    }
  };

  // Progress & Budget Cards Layout with Custom SVG Donut Pie Chart
  const categoryCosts = categories.map((cat) => {
    const actual = tasks.filter(t => t.category === cat).reduce((sum, t) => sum + (t.actualAmount || 0), 0);
    const budget = tasks.filter(t => t.category === cat).reduce((sum, t) => sum + (t.budget || 0), 0);
    return {
      category: cat,
      actual,
      budget
    };
  }).filter(item => item.actual > 0);

  const totalActualCost = categoryCosts.reduce((sum, c) => sum + c.actual, 0);

  const chartCircumference = 2 * Math.PI * 35;
  let accumulatedPercent = 0;
  const colors = [
    '#8E9E8C', // Sage
    '#D4A373', // Sandy Gold
    '#A6998A', // Warm Grey
    '#C4A287', // Rose Dusty
    '#7D8C7C', // Dark Sage
    '#B58A63', // Dark Gold
    '#8C745A', // Brown Tones
    '#E6D5C3', // Light Beige
  ];

  const slices = categoryCosts.map((item, idx) => {
    const percent = totalActualCost > 0 ? (item.actual / totalActualCost) : 0;
    const dashArray = `${percent * chartCircumference} ${chartCircumference}`;
    const dashOffset = -accumulatedPercent * chartCircumference;
    accumulatedPercent += percent;
    const color = colors[idx % colors.length];

    return {
      ...item,
      percent,
      dashArray,
      dashOffset,
      color
    };
  });

  return (
    <div id="todo_section" className="bg-white rounded-[2rem] shadow-sm border border-[#F0EBE4] p-6 flex flex-col h-full">
      {/* Title & Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold font-serif tracking-tight text-[#5E564E]">婚禮籌備待辦清單</h2>
          <p className="text-xs text-[#A6998A] mt-1">規劃與追踪您的籌備進展、預算與合作店家</p>
        </div>
        <button
          id="btn_add_task_toggle"
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#F2EDE4] text-[#8C745A] hover:bg-[#E6D5C3]/80 border border-[#E2D9CD] rounded-lg text-xs font-semibold transition cursor-pointer shrink-0"
        >
          {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isAdding ? '取消' : '新增待辦'}
        </button>
      </div>

      {/* Stats and Expense Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#FAF8F5] rounded-2xl p-4 border border-[#F0EBE4] flex flex-col justify-between min-h-[120px]">
          <div>
            <span className="text-[10px] font-semibold text-[#A6998A] block uppercase tracking-wider mb-1">規劃進度</span>
            <span className="text-sm font-semibold text-[#5E564E]">{completedCount} / {tasks.length} 已完成 ({progressPercent}%)</span>
          </div>
          <div className="w-full bg-[#F2EDE4] rounded-full h-2 mt-2">
            <div
              className="bg-[#8E9E8C] h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="bg-[#FAF8F5] rounded-2xl p-4 border border-[#F0EBE4] flex flex-col justify-between min-h-[120px] text-xs">
          <div>
            <div className="flex justify-between text-[#A6998A] font-semibold text-[10px] uppercase tracking-wider mb-1">
              <span>預算控管</span>
              <span>{budgetDiff >= 0 ? '剩餘' : '超支'}</span>
            </div>
            <div className="flex justify-between items-baseline mt-1 gap-3">
              <div className="space-y-0.5 text-[#5E564E] font-mono min-w-0">
                <div>預算: <strong className="text-[#5E564E]">NT${totalBudget.toLocaleString()}</strong></div>
                <div>實際: <strong className="text-[#5E564E]">NT${totalActual.toLocaleString()}</strong></div>
              </div>
              <span className={`font-mono font-bold text-sm shrink-0 ${budgetDiff >= 0 ? 'text-[#8E9E8C]' : 'text-[#D4A373]'}`}>
                {budgetDiff >= 0 ? `+NT$${budgetDiff.toLocaleString()}` : `-NT$${Math.abs(budgetDiff).toLocaleString()}`}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[#FAF8F5] rounded-2xl p-4 sm:p-5 border border-[#F0EBE4] min-h-[220px] lg:col-span-2">
          <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-5">
            <div className="relative w-36 h-36 sm:w-40 sm:h-40 shrink-0 flex items-center justify-center">
              {totalActualCost > 0 ? (
                <>
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    {slices.map((slice, idx) => (
                      <circle
                        key={idx}
                        cx="50"
                        cy="50"
                        r="35"
                        fill="transparent"
                        stroke={slice.color}
                        strokeWidth="18"
                        strokeDasharray={slice.dashArray}
                        strokeDashoffset={slice.dashOffset}
                        strokeLinecap="round"
                        className="transition-all duration-300"
                        style={{ transformOrigin: '50% 50%' }}
                      />
                    ))}
                    <circle cx="50" cy="50" r="23" fill="#FAF8F5" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                    <span className="text-[10px] text-[#A6998A] font-semibold">實際支出</span>
                    <span className="text-base font-bold font-mono text-[#5E564E] leading-tight">
                      NT${totalActualCost >= 10000 ? `${(totalActualCost / 1000).toFixed(0)}k` : totalActualCost.toLocaleString()}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    <circle cx="50" cy="50" r="35" fill="transparent" stroke="#E6D5C3" strokeWidth="18" className="opacity-60" />
                    <circle cx="50" cy="50" r="23" fill="#FAF8F5" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] text-[#A6998A] font-semibold">尚無支出</span>
                    <span className="text-base font-bold font-mono text-[#A6998A]">NT$0</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex-1 min-w-0 w-full flex flex-col justify-center">
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-[10px] font-semibold text-[#A6998A] block uppercase tracking-wider">支出類別比例</span>
                <span className="text-[10px] text-[#8C745A] font-mono shrink-0">{slices.length} 類</span>
              </div>
              {totalActualCost > 0 ? (
                <div className="space-y-2.5">
                  {slices.map((slice, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                        <span className="text-[#5E564E] truncate flex-1 font-medium" title={slice.category}>{slice.category}</span>
                        <span className="text-[#A6998A] font-mono shrink-0">NT${slice.actual.toLocaleString()}</span>
                        <span className="text-[#8C745A] font-mono shrink-0 font-bold w-9 text-right">{Math.round(slice.percent * 100)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#F2EDE4] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(slice.percent * 100, 3)}%`, backgroundColor: slice.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#A6998A] italic leading-relaxed">
                  新增實際支出後，這裡會顯示各類別佔比，方便快速看出預算主要花在哪些項目。
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Add Task Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.form 
            id="add_task_form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleAddTask}
            className="overflow-hidden border border-[#E2D9CD] bg-[#F2EDE4]/20 rounded-2xl p-4 mb-6 space-y-3"
          >
            {/* Title & Category Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#A6998A] mb-1">任務名稱 *</label>
                <input
                  id="input_task_title"
                  type="text"
                  required
                  placeholder="例如：挑選喜餅品牌、預約試妝"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-[#E2D9CD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8E9E8C]"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-[#A6998A]">分類</label>
                  <button
                    type="button"
                    onClick={() => setIsAddingCategory(!isAddingCategory)}
                    className="text-[10px] text-[#8C745A] hover:underline flex items-center gap-0.5"
                  >
                    <FolderPlus className="w-3 h-3" />
                    自訂分類
                  </button>
                </div>

                {isAddingCategory ? (
                  <div className="space-y-2.5 border border-[#E2D9CD] bg-[#FAF8F5] p-3 rounded-xl mt-1">
                    <div className="flex gap-1">
                      <input
                        type="text"
                        placeholder="新分類名稱"
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        className="flex-1 px-2.5 py-1 text-xs bg-white border border-[#E2D9CD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8E9E8C]"
                      />
                      <button
                        type="button"
                        onClick={handleAddCategory}
                        className="px-2 py-1 bg-[#8E9E8C] text-white text-[10px] rounded hover:bg-[#7D8C7C] transition"
                      >
                        新增
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingCategory(false)}
                        className="px-2 py-1 bg-stone-100 text-stone-500 text-[10px] rounded hover:bg-stone-200 transition"
                      >
                        關閉
                      </button>
                    </div>

                    <div className="pt-2 border-t border-[#E2D9CD]/50">
                      <p className="text-[10px] font-semibold text-[#A6998A] mb-1.5">點擊垃圾桶刪除現有分類：</p>
                      <div className="flex flex-wrap gap-1.5">
                        {categories.map(cat => (
                          <span 
                            key={cat} 
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#E2D9CD] text-[10px] text-[#5E564E] font-medium"
                          >
                            {cat}
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat)}
                              className="text-[#A6998A] hover:text-[#D4A373] p-0.5 transition cursor-pointer font-bold"
                              title={`刪除分類 ${cat}`}
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <select
                    id="select_task_category"
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-[#E2D9CD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8E9E8C]"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Vendor & Contact row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#A6998A] mb-1">店家名稱 / 廠商</label>
                <input
                  type="text"
                  placeholder="例如：珍愛婚紗、皇樓喜餅"
                  value={newShopName}
                  onChange={e => setNewShopName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-[#E2D9CD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8E9E8C]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A6998A] mb-1">聯絡人資訊</label>
                <input
                  type="text"
                  placeholder="例如：林經理 0912-345678"
                  value={newContactInfo}
                  onChange={e => setNewContactInfo(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-[#E2D9CD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8E9E8C]"
                />
              </div>
            </div>

            {/* Budget & Actual row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#A6998A] mb-1">預算金額 (元)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="預算金額，例如：30000"
                  value={newBudget}
                  onChange={e => setNewBudget(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-[#E2D9CD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8E9E8C]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A6998A] mb-1">實際金額 (元)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="實際花費，例如：28000"
                  value={newActualAmount}
                  onChange={e => setNewActualAmount(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-[#E2D9CD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8E9E8C]"
                />
              </div>
            </div>

            {/* Date & Location row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#A6998A] mb-1">截止日期</label>
                <input
                  id="input_task_due"
                  type="date"
                  value={newDueDate}
                  onChange={e => setNewDueDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-[#E2D9CD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8E9E8C]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A6998A] mb-1">籌備地點</label>
                <input
                  type="text"
                  placeholder="輸入地點/地址，例如：大直典華"
                  value={newLocation}
                  onChange={e => setNewLocation(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-[#E2D9CD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8E9E8C]"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-[#A6998A] mb-1">備註說明</label>
              <input
                id="input_task_notes"
                type="text"
                placeholder="補充細節，例如：起桌價、場勘名單"
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-[#E2D9CD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8E9E8C]"
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-2">
              <button
                id="btn_submit_task"
                type="submit"
                className="px-4 py-1.5 bg-[#8E9E8C] hover:bg-[#7D8C7C] text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                確認新增
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div>
          <select
            id="filter_category"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="px-2.5 py-1.5 bg-white hover:bg-[#FAF8F5] border border-[#E2D9CD] text-[#4A443F] rounded-lg text-xs focus:outline-none cursor-pointer"
          >
            <option value="All">所有類別</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div>
          <select
            id="filter_status"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-white hover:bg-[#FAF8F5] border border-[#E2D9CD] text-[#4A443F] rounded-lg text-xs focus:outline-none cursor-pointer"
          >
            <option value="All">所有狀態</option>
            <option value="Pending">未開始</option>
            <option value="In_Progress">進行中</option>
            <option value="Completed">已完成</option>
          </select>
        </div>
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto space-y-3 max-h-[550px] pr-1 scrollbar-thin">
        <AnimatePresence initial={false}>
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-[#E2D9CD] rounded-xl bg-[#FAF8F5]/30">
              <p className="text-sm text-[#A6998A]">沒有符合篩選條件的待辦事項</p>
            </div>
          ) : (
            filteredTasks.map(task => {
              const { bg, icon } = getStatusStyle(task.status);
              const isEditing = editingId === task.id;

              return (
                <motion.div
                  key={task.id}
                  id={`task_card_${task.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-4 border rounded-2xl shadow-xs relative overflow-hidden transition-all group ${
                    task.status === 'Completed' ? 'border-[#E2D9CD]/40 bg-stone-50/40 opacity-80' : 'border-[#F0EBE4] bg-white hover:border-[#8E9E8C]'
                  }`}
                >
                  {/* Status indicator bar to the right */}
                  {!isEditing && task.status === 'In_Progress' && (
                    <div className="absolute top-0 right-0 h-full w-1 bg-[#D4A373]" />
                  )}
                  {!isEditing && task.status === 'Completed' && (
                    <div className="absolute top-0 right-0 h-full w-1 bg-[#8E9E8C]" />
                  )}

                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-medium text-[#A6998A] mb-0.5">任務名稱</label>
                          <input
                            id={`edit_task_title_${task.id}`}
                            type="text"
                            required
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border border-[#E2D9CD] rounded focus:outline-none focus:ring-1 focus:ring-[#8E9E8C]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-[#A6998A] mb-0.5">分類</label>
                          <select
                            id={`edit_task_category_${task.id}`}
                            value={editCategory}
                            onChange={e => setEditCategory(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border border-[#E2D9CD] rounded focus:outline-none"
                          >
                            {categories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-medium text-[#A6998A] mb-0.5">店家名稱</label>
                          <input
                            type="text"
                            value={editShopName}
                            onChange={e => setEditShopName(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border border-[#E2D9CD] rounded focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-[#A6998A] mb-0.5">聯絡資訊</label>
                          <input
                            type="text"
                            value={editContactInfo}
                            onChange={e => setEditContactInfo(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border border-[#E2D9CD] rounded focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-medium text-[#A6998A] mb-0.5">預算金額</label>
                          <input
                            type="number"
                            value={editBudget}
                            onChange={e => setEditBudget(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border border-[#E2D9CD] rounded focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-[#A6998A] mb-0.5">實際金額</label>
                          <input
                            type="number"
                            value={editActualAmount}
                            onChange={e => setEditActualAmount(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border border-[#E2D9CD] rounded focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-medium text-[#A6998A] mb-0.5">截止日</label>
                          <input
                            id={`edit_task_due_${task.id}`}
                            type="date"
                            value={editDueDate}
                            onChange={e => setEditDueDate(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border border-[#E2D9CD] rounded focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-[#A6998A] mb-0.5">地點 (地址)</label>
                          <input
                            type="text"
                            value={editLocation}
                            onChange={e => setEditLocation(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border border-[#E2D9CD] rounded focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-medium text-[#A6998A] mb-0.5">備註說明</label>
                        <input
                          id={`edit_task_notes_${task.id}`}
                          type="text"
                          placeholder="備註說明"
                          value={editNotes}
                          onChange={e => setEditNotes(e.target.value)}
                          className="w-full px-2.5 py-1 text-xs border border-[#E2D9CD] rounded focus:outline-none focus:ring-1 focus:ring-[#8E9E8C]"
                        />
                      </div>

                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          id={`btn_cancel_edit_${task.id}`}
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 bg-[#F2EDE4] text-[#4A443F] rounded text-xs font-medium cursor-pointer"
                        >
                          取消
                        </button>
                        <button
                          id={`btn_save_edit_${task.id}`}
                          type="button"
                          onClick={() => handleSaveEdit(task.id)}
                          className="px-2.5 py-1 bg-[#8E9E8C] text-white rounded text-xs font-semibold cursor-pointer"
                        >
                          儲存
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pr-0">
                      <div className="flex items-start justify-between gap-2 sm:gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          {/* Complete status toggler button */}
                          <button
                            id={`btn_toggle_status_${task.id}`}
                            onClick={() => toggleTaskStatus(task.id)}
                            className="mt-0.5 hover:scale-110 transition cursor-pointer shrink-0"
                            title={`切換狀態 (目前: ${getStatusLabel(task.status)})`}
                          >
                            {icon}
                          </button>
                          
                          <div>
                            <h3 className={`text-sm font-semibold text-[#4A443F] leading-snug ${task.status === 'Completed' ? 'line-through text-[#A6998A]' : ''}`}>
                              {task.title}
                            </h3>
                            
                            {/* Standard tag badges row */}
                            <div className="flex flex-wrap gap-1.5 items-center mt-1.5">
                              <span className="text-[9px] px-2 py-0.5 rounded-full font-medium bg-[#F5F8F5] text-[#7D8C7C] border border-[#E2D9CD]/30">
                                {task.category}
                              </span>
                              
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border ${bg}`}>
                                {getStatusLabel(task.status)}
                              </span>

                              {task.due_date && (
                                <span className="text-[9px] text-[#D4A373] flex items-center gap-0.5 font-mono">
                                  <Calendar className="w-2.5 h-2.5" />
                                  {task.due_date}
                                </span>
                              )}
                            </div>

                            {/* Extra planning fields bento row */}
                            {(task.shopName || task.contactInfo || task.budget !== undefined || task.actualAmount !== undefined) && (
                              <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-2 bg-[#FAF8F5] border border-[#F0EBE4]/70 rounded-xl p-2.5 text-[10px] text-[#5E564E]">
                                {/* Vendor Details */}
                                {(task.shopName || task.contactInfo) && (
                                  <div className="space-y-1">
                                    {task.shopName && (
                                      <div className="flex items-center gap-1">
                                        <Store className="w-3.5 h-3.5 text-[#8E9E8C]" />
                                        <span className="font-medium text-stone-700">{task.shopName}</span>
                                      </div>
                                    )}
                                    {task.contactInfo && (
                                      <div className="flex items-center gap-1 text-[#8C8479]">
                                        <Phone className="w-3 h-3 text-[#A6998A]" />
                                        <span>{task.contactInfo}</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Budget Details */}
                                {(task.budget !== undefined || task.actualAmount !== undefined) && (
                                  <div className="space-y-1 md:border-l md:border-[#E2D9CD]/40 md:pl-2.5 flex flex-col justify-center">
                                    <div className="flex items-center justify-between gap-1 text-stone-600 font-mono">
                                      <span>預算: ${task.budget?.toLocaleString() || 0}</span>
                                      <span>實際: ${task.actualAmount?.toLocaleString() || 0}</span>
                                    </div>
                                    
                                    {/* Budget warning/savings badge */}
                                    {task.budget !== undefined && task.actualAmount !== undefined && (
                                      <div className="text-right">
                                        {task.actualAmount > task.budget ? (
                                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#D4A373] bg-[#FAF5EE] px-1.5 py-0.5 rounded-full border border-[#D4A373]/20">
                                            超支 ${(task.actualAmount - task.budget).toLocaleString()}
                                          </span>
                                        ) : task.actualAmount < task.budget ? (
                                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#8E9E8C] bg-[#F5F8F5] px-1.5 py-0.5 rounded-full border border-[#8E9E8C]/20">
                                            省下 ${(task.budget - task.actualAmount).toLocaleString()}
                                          </span>
                                        ) : (
                                          <span className="text-[9px] text-[#A6998A] font-medium">符合預算</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Location Display - Purely static, no Google Maps link/frame */}
                            {task.location && (
                              <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-[#8C745A]">
                                <MapPin className="w-3.5 h-3.5 text-[#D4A373]" />
                                <span className="font-medium">籌備地點: {task.location}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0 rounded-xl bg-[#FAF8F5] border border-[#F0EBE4] p-0.5 opacity-100 sm:bg-transparent sm:border-transparent sm:p-0 transition">
                          <button
                            id={`btn_edit_task_${task.id}`}
                            onClick={() => handleStartEdit(task)}
                            className="p-1.5 sm:p-1 hover:bg-white sm:hover:bg-[#FAF8F5] text-[#8C745A] sm:text-[#A6998A] hover:text-[#4A443F] rounded-lg cursor-pointer"
                            title="編輯"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`btn_delete_task_${task.id}`}
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1.5 sm:p-1 hover:bg-white sm:hover:bg-[#FAF8F5] text-[#D4A373] sm:text-[#A6998A] hover:text-[#D4A373] rounded-lg cursor-pointer"
                            title="刪除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {task.notes && (
                        <div className="mt-2.5 text-xs text-[#8C8479] border-l-2 border-[#D4A373]/50 pl-2 bg-[#F5F0E8]/40 py-1.5 rounded-r">
                          {task.notes}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
