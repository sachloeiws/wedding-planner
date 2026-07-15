/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { TableItem, TableStatus, TableAssignments, DEFAULT_ZONES, GuestImportCandidate } from '../types';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Plus, 
  AlertCircle, 
  HelpCircle, 
  Sliders, 
  Layers,
  MapPin,
  X,
  Sparkles,
  Search,
  Edit3,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TablePlannerProps {
  tableAssignments: TableAssignments;
  setTableAssignments: React.Dispatch<React.SetStateAction<TableAssignments>>;
  responseGuests?: GuestImportCandidate[];
}

export default function TablePlanner({ tableAssignments, setTableAssignments, responseGuests = [] }: TablePlannerProps) {
  const { tables, table_size_limit } = tableAssignments;
  
  const [selectedTableNo, setSelectedTableNo] = useState<number | null>(tables[0]?.table_no || null);
  const [newZone, setNewZone] = useState('男方親友');
  const [customZone, setCustomZone] = useState('');
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Local state for guest inputs per table
  const [guestInputs, setGuestInputs] = useState<{ [key: number]: string }>({});

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 12;
    setTableAssignments(prev => ({
      ...prev,
      table_size_limit: Math.max(2, Math.min(20, val)), // Range 2-20
    }));
  };

  const handleAddTable = (e: React.FormEvent) => {
    e.preventDefault();
    const zoneName = newZone === '其他' && customZone.trim() ? customZone.trim() : newZone;
    
    // Auto increment table number
    const nextTableNo = tables.length > 0 ? Math.max(...tables.map(t => t.table_no)) + 1 : 1;
    
    const newTable: TableItem = {
      table_no: nextTableNo,
      zone: zoneName,
      guests: []
    };

    setTableAssignments(prev => ({
      ...prev,
      tables: [...prev.tables, newTable]
    }));

    setCustomZone('');
    setIsAddingTable(false);
    setSelectedTableNo(nextTableNo);
  };

  const handleDeleteTable = (tableNo: number) => {
    setTableAssignments(prev => ({
      ...prev,
      tables: prev.tables.filter(t => t.table_no !== tableNo)
    }));
    if (selectedTableNo === tableNo) {
      const remaining = tables.filter(t => t.table_no !== tableNo);
      setSelectedTableNo(remaining.length > 0 ? remaining[0].table_no : null);
    }
  };

  // Local states for editing a specific guest in the list
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [editingGuestName, setEditingGuestName] = useState('');
  const [editingGuestNotes, setEditingGuestNotes] = useState('');

  const handleAddGuest = (tableNo: number, name: string) => {
    if (!name.trim()) return;
    
    const newGuest = {
      id: `g_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: name.trim(),
      notes: ''
    };

    setTableAssignments(prev => ({
      ...prev,
      tables: prev.tables.map(t => {
        if (t.table_no === tableNo) {
          return {
            ...t,
            guests: [...t.guests, newGuest]
          };
        }
        return t;
      })
    }));

    // Clear input
    setGuestInputs(prev => ({ ...prev, [tableNo]: '' }));
  };

  const handleAddMultipleGuests = (tableNo: number, inputStr: string) => {
    const names = inputStr
      .split(/[,，\n]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0);

    if (names.length === 0) return;

    const newGuests = names.map((name, idx) => ({
      id: `g_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
      name,
      notes: ''
    }));

    setTableAssignments(prev => ({
      ...prev,
      tables: prev.tables.map(t => {
        if (t.table_no === tableNo) {
          return {
            ...t,
            guests: [...t.guests, ...newGuests]
          };
        }
        return t;
      })
    }));

    setGuestInputs(prev => ({ ...prev, [tableNo]: '' }));
  };

  const handleRemoveGuest = (tableNo: number, guestId: string) => {
    setTableAssignments(prev => ({
      ...prev,
      tables: prev.tables.map(t => {
        if (t.table_no === tableNo) {
          return {
            ...t,
            guests: t.guests.filter(g => g.id !== guestId)
          };
        }
        return t;
      })
    }));
  };

  const handleSaveGuestEdit = (tableNo: number, guestId: string) => {
    if (!editingGuestName.trim()) return;
    setTableAssignments(prev => ({
      ...prev,
      tables: prev.tables.map(t => {
        if (t.table_no === tableNo) {
          return {
            ...t,
            guests: t.guests.map(g => g.id === guestId ? {
              ...g,
              name: editingGuestName.trim(),
              notes: editingGuestNotes.trim()
            } : g)
          };
        }
        return t;
      })
    }));
    setEditingGuestId(null);
  };

  const getTableStatus = (guestCount: number): TableStatus => {
    if (guestCount === 0) return 'Empty';
    if (guestCount === table_size_limit) return 'Full';
    if (guestCount > table_size_limit) return 'Overfilled';
    return 'Partially_Full';
  };

  const getStatusBadge = (status: TableStatus, count: number) => {
    switch (status) {
      case 'Full':
        return (
          <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-[#FAF5EE] text-[#D4A373] border border-[#E8DFD1]">
            已滿 ({count}/{table_size_limit})
          </span>
        );
      case 'Overfilled':
        return (
          <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-[#FAF5EE] text-[#D4A373] border border-[#D4A373]/30 flex items-center gap-1 animate-pulse">
            <AlertCircle className="w-3 h-3 text-[#D4A373]" />
            超額 ({count}/{table_size_limit})
          </span>
        );
      case 'Empty':
        return (
          <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-medium bg-[#FAF8F5] text-[#A6998A] border border-[#E2D9CD]">
            空桌 ({count}/{table_size_limit})
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-medium bg-[#F5F8F5] text-[#7D8C7C] border border-[#E2D9CD]/30">
            未滿 ({count}/{table_size_limit})
          </span>
        );
    }
  };

  // Find currently selected table
  const selectedTable = tables.find(t => t.table_no === selectedTableNo);
  const seatedGuestNames = new Set(
    tables.flatMap(t => t.guests.map(g => g.name.trim().toLowerCase()).filter(Boolean))
  );
  const availableResponseGuests = responseGuests.filter(candidate => {
    const nameKey = candidate.name.trim().toLowerCase();
    return nameKey && !seatedGuestNames.has(nameKey);
  });

  const handleImportResponseGuest = (tableNo: number, candidate: GuestImportCandidate) => {
    const name = candidate.name.trim();
    const nameKey = name.toLowerCase();
    if (!nameKey) return;

    const alreadySeated = tableAssignments.tables.some(table =>
      table.guests.some(guest => guest.name.trim().toLowerCase() === nameKey)
    );

    if (alreadySeated) {
      alert(`${name} 已經在座位表中`);
      return;
    }

    const newGuest = {
      id: `g_response_${candidate.id}_${Date.now()}`,
      name,
      notes: candidate.notes || candidate.sourceLabel || ''
    };

    setTableAssignments(prev => ({
      ...prev,
      tables: prev.tables.map(table => table.table_no === tableNo
        ? { ...table, guests: [...table.guests, newGuest] }
        : table
      )
    }));
  };

  const handleImportAllResponseGuests = (tableNo: number) => {
    if (availableResponseGuests.length === 0) return;

    setTableAssignments(prev => {
      const currentNames = new Set(
        prev.tables.flatMap(table => table.guests.map(guest => guest.name.trim().toLowerCase()).filter(Boolean))
      );

      const guestsToAdd = availableResponseGuests
        .filter(candidate => !currentNames.has(candidate.name.trim().toLowerCase()))
        .map(candidate => ({
          id: `g_response_${candidate.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: candidate.name.trim(),
          notes: candidate.notes || candidate.sourceLabel || ''
        }));

      if (guestsToAdd.length === 0) return prev;

      return {
        ...prev,
        tables: prev.tables.map(table => table.table_no === tableNo
          ? { ...table, guests: [...table.guests, ...guestsToAdd] }
          : table
        )
      };
    });
  };

  // Layout calculations for interactive circular table seating visualization
  const renderVisualTable = (table: TableItem) => {
    const guestCount = table.guests.length;
    const isSelected = selectedTableNo === table.table_no;
    const status = getTableStatus(guestCount);
    
    // Circle configurations
    const tableRadius = 45; 
    const seatRadius = 8;
    const orbitRadius = 60;
    const centerPoint = 80; // (80, 80) SVG center

    // Determine color scheme based on status using Natural Tones theme
    let tableBg = 'fill-white stroke-[#E2D9CD]';
    let tableText = 'fill-[#5E564E]';
    let zoneText = 'fill-[#A6998A]';
    
    if (isSelected) {
      tableBg = 'fill-[#F2EDE4] stroke-[#8E9E8C] stroke-[2]';
      tableText = 'fill-[#5E564E] font-bold';
      zoneText = 'fill-[#8E9E8C]';
    } else if (status === 'Full') {
      tableBg = 'fill-[#FAF5EE] stroke-[#D4A373]';
      tableText = 'fill-[#8C745A]';
    } else if (status === 'Overfilled') {
      tableBg = 'fill-white stroke-[#D4A373]';
      tableText = 'fill-[#D4A373]';
    }

    return (
      <svg 
        key={table.table_no} 
        viewBox="0 0 160 160" 
        className={`w-32 h-32 md:w-36 md:h-36 cursor-pointer transition-transform duration-300 hover:scale-105 ${isSelected ? 'ring-2 ring-[#8E9E8C] ring-offset-2 rounded-full' : ''}`}
        onClick={() => setSelectedTableNo(table.table_no)}
      >
        {/* Seats representation (Render up to table_size_limit or guestCount, whichever is higher) */}
        {Array.from({ length: Math.max(table_size_limit, guestCount) }).map((_, i) => {
          const angle = (i * 2 * Math.PI) / Math.max(table_size_limit, guestCount);
          const x = centerPoint + Math.cos(angle) * orbitRadius;
          const y = centerPoint + Math.sin(angle) * orbitRadius;
          const isOccupied = i < guestCount;
          const guestName = isOccupied ? table.guests[i]?.name : null;

          let seatColor = 'fill-[#F2EDE4] stroke-[#E2D9CD]';
          if (isOccupied) {
            seatColor = isSelected ? 'fill-[#8E9E8C] stroke-[#7D8C7C]' : 'fill-[#D4A373] stroke-[#C39262]';
          } else if (i >= table_size_limit) {
            // Overfilled extra seats representation
            seatColor = 'fill-[#E6D5C3] stroke-[#D4A373]';
          }

          return (
            <g key={i}>
              <circle 
                cx={x} 
                cy={y} 
                r={seatRadius} 
                className={`${seatColor} transition-all duration-300`} 
              />
              {isOccupied && (
                <text 
                  x={x} 
                  y={y - 12} 
                  textAnchor="middle" 
                  className="fill-[#5E564E] text-[8px] font-medium opacity-0 hover:opacity-100 pointer-events-none transition-opacity duration-200"
                >
                  {guestName}
                </text>
              )}
            </g>
          );
        })}

        {/* Central Table */}
        <circle 
          cx={centerPoint} 
          cy={centerPoint} 
          r={tableRadius} 
          className={`${tableBg} transition-all duration-300`}
        />
        <text 
          x={centerPoint} 
          y={centerPoint - 4} 
          textAnchor="middle" 
          className={`${tableText} text-xs font-serif`}
        >
          第 {table.table_no} 桌
        </text>
        <text 
          x={centerPoint} 
          y={centerPoint + 14} 
          textAnchor="middle" 
          className={`${zoneText} text-[9px]`}
        >
          {table.zone.length > 5 ? `${table.zone.substring(0, 4)}..` : table.zone}
        </text>
      </svg>
    );
  };

  // Find tables or guests matching search query
  const filteredTables = tables.filter(t => {
    if (!searchQuery) return true;
    const matchZone = t.zone.toLowerCase().includes(searchQuery.toLowerCase());
    const matchTableNo = t.table_no.toString() === searchQuery;
    const matchGuest = t.guests.some(g => 
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (g.notes && g.notes.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    return matchZone || matchTableNo || matchGuest;
  });

  return (
    <div id="table_section" className="bg-white rounded-[2rem] shadow-sm border border-[#F0EBE4] p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold font-serif tracking-tight text-[#5E564E]">宴席排座管理</h2>
          <p className="text-xs text-[#A6998A] mt-1">劃分桌區、設定每桌上限並安排賓客座位</p>
        </div>
        
        {/* Config and Add Controls */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <button
            id="btn_add_table_toggle"
            onClick={() => setIsAddingTable(!isAddingTable)}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#F2EDE4] text-[#8C745A] hover:bg-[#E6D5C3]/80 border border-[#E2D9CD] rounded-lg text-xs font-medium transition cursor-pointer"
          >
            {isAddingTable ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {isAddingTable ? '取消' : '新增桌次'}
          </button>
        </div>
      </div>

      {/* Global Setting: Table Size Limit */}
      <div className="bg-[#FAF8F5] border border-[#F0EBE4] rounded-2xl p-4 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#8E9E8C]" />
          <div>
            <span className="text-xs font-semibold text-[#5E564E] block">每桌人數上限 (座位數)</span>
            <span className="text-[10px] text-[#A6998A]">目前設定每桌提供 {table_size_limit} 個標準座位</span>
          </div>
        </div>
        <div className="flex items-center gap-3 justify-end">
          <input
            id="input_table_size_limit"
            type="range"
            min="2"
            max="20"
            value={table_size_limit}
            onChange={handleLimitChange}
            className="w-full accent-[#8E9E8C] h-1.5 bg-[#F2EDE4] rounded-lg appearance-none cursor-pointer"
          />
          <span className="font-mono text-sm font-bold text-[#4A443F] w-8 text-right bg-white px-2 py-0.5 border border-[#E2D9CD] rounded">
            {table_size_limit}
          </span>
        </div>
      </div>

      {/* Add Table Form */}
      <AnimatePresence>
        {isAddingTable && (
          <motion.form 
            id="add_table_form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddTable}
            className="overflow-hidden border border-[#E2D9CD] bg-[#F2EDE4]/20 rounded-2xl p-4 mb-6 space-y-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#A6998A] mb-1">選擇桌位區域 / 關係分類</label>
                <select
                  id="select_table_zone"
                  value={newZone}
                  onChange={e => setNewZone(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-white border border-[#E2D9CD] rounded-lg focus:outline-none"
                >
                  {DEFAULT_ZONES.map(z => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                  <option value="其他">其他 (自訂區域)</option>
                </select>
              </div>
              {newZone === '其他' && (
                <div>
                  <label className="block text-xs font-medium text-[#A6998A] mb-1">輸入自訂區域名稱 *</label>
                  <input
                    id="input_custom_zone"
                    type="text"
                    required
                    placeholder="例如：伴郎伴娘、國中同學"
                    value={customZone}
                    onChange={e => setCustomZone(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-[#E2D9CD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8E9E8C] focus:border-[#8E9E8C]"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                id="btn_submit_table"
                type="submit"
                className="px-4 py-1.5 bg-[#8E9E8C] hover:bg-[#7D8C7C] text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                新增此桌
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Search Seating Chart */}
      <div className="relative mb-6">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#A6998A]">
          <Search className="w-4 h-4" />
        </span>
        <input
          id="search_seating_chart"
          type="text"
          placeholder="搜尋桌區、桌號或賓客姓名..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white border border-[#E2D9CD] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#8E9E8C] focus:border-[#8E9E8C] transition"
        />
      </div>

      {/* Interactive Seating Map Flow */}
      <div className="mb-6">
        <span className="text-xs font-semibold text-[#A6998A] block mb-3">視覺化桌位平面圖 (點擊切換編輯桌位)</span>
        <div className="bg-[#FAF8F5] border border-[#F0EBE4] rounded-[2rem] p-4 overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-2 px-1">
            {filteredTables.length === 0 ? (
              <p className="text-xs text-[#A6998A] py-4 px-2">無匹配的桌位</p>
            ) : (
              filteredTables.map(t => renderVisualTable(t))
            )}
          </div>
        </div>
      </div>

      {/* Two Pane Split inside the table assignment panel:
          Left Pane: Active Table Seating Editor (detailed view of selectedTable)
          Right Pane: Rapid Guest Allocation & Quick Help
      */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        
        {/* Selected Table Detail (7 cols) */}
        <div className="lg:col-span-7 border border-[#F0EBE4] rounded-[2rem] p-5 flex flex-col h-full bg-[#FAF8F5]/50">
          {selectedTable ? (
            <div className="flex flex-col h-full">
              {/* Header inside detailed view */}
              <div className="flex justify-between items-start border-b border-[#E2D9CD]/60 pb-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-lg font-bold text-[#5E564E]">第 {selectedTable.table_no} 桌</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#F2EDE4] text-[#8C745A] font-medium flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {selectedTable.zone}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#A6998A] mt-1">賓客座位安排明細</p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(getTableStatus(selectedTable.guests.length), selectedTable.guests.length)}
                  <button
                    id={`btn_delete_table_${selectedTable.table_no}`}
                    onClick={() => handleDeleteTable(selectedTable.table_no)}
                    className="p-1 hover:bg-[#FAF8F5] text-[#A6998A] hover:text-[#D4A373] rounded transition cursor-pointer"
                    title="刪除此桌"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Guest add controls inside table */}
              <div className="mb-4">
                <label className="block text-[11px] font-medium text-[#A6998A] mb-1.5">新增賓客到本桌</label>
                <div className="flex gap-2">
                  <input
                    id={`input_add_guest_${selectedTable.table_no}`}
                    type="text"
                    placeholder="輸入姓名 (多位請用逗號或換行隔開)"
                    value={guestInputs[selectedTable.table_no] || ''}
                    onChange={e => setGuestInputs({ ...guestInputs, [selectedTable.table_no]: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = guestInputs[selectedTable.table_no] || '';
                        if (val.includes(',') || val.includes('，') || val.includes('\n')) {
                          handleAddMultipleGuests(selectedTable.table_no, val);
                        } else {
                          handleAddGuest(selectedTable.table_no, val);
                        }
                      }
                    }}
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#E2D9CD] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8E9E8C] focus:border-[#8E9E8C]"
                  />
                  <button
                    id={`btn_submit_guest_${selectedTable.table_no}`}
                    onClick={() => {
                      const val = guestInputs[selectedTable.table_no] || '';
                      if (val.includes(',') || val.includes('，') || val.includes('\n')) {
                        handleAddMultipleGuests(selectedTable.table_no, val);
                      } else {
                        handleAddGuest(selectedTable.table_no, val);
                      }
                    }}
                    className="px-3 py-1.5 bg-[#8E9E8C] hover:bg-[#7D8C7C] text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    安排
                  </button>
                </div>
                <span className="text-[10px] text-[#A6998A] mt-1 block">提示：您可以一次輸入「王小明, 李小華, 張大德」快速整批新增。</span>
              </div>

              {/* Seated Guests List - detailed views with edit form and remarks */}
              <div className="flex-1 overflow-y-auto max-h-[350px] border border-[#F0EBE4] rounded-[1.5rem] bg-white p-4">
                {selectedTable.guests.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-xs text-[#A6998A]">本桌目前尚無安排賓客</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedTable.guests.map((guest, idx) => {
                      const isEditingThisGuest = editingGuestId === guest.id;
                      return (
                        <div key={guest.id || idx} className="col-span-1">
                          {isEditingThisGuest ? (
                            <div className="bg-[#FAF8F5] border border-[#8E9E8C] rounded-xl p-3 space-y-2 text-xs">
                              <div className="space-y-1">
                                <label className="text-[10px] text-[#A6998A] block font-semibold">賓客姓名 *</label>
                                <input
                                  type="text"
                                  value={editingGuestName}
                                  onChange={e => setEditingGuestName(e.target.value)}
                                  className="w-full px-2.5 py-1 bg-white border border-[#E2D9CD] rounded focus:outline-none focus:ring-1 focus:ring-[#8E9E8C]"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] text-[#A6998A] block font-semibold">備註 / 需求 (如：素食、嬰兒椅)</label>
                                <input
                                  type="text"
                                  value={editingGuestNotes}
                                  placeholder="無"
                                  onChange={e => setEditingGuestNotes(e.target.value)}
                                  className="w-full px-2.5 py-1 bg-white border border-[#E2D9CD] rounded focus:outline-none"
                                />
                              </div>
                              <div className="flex justify-end gap-1.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingGuestId(null)}
                                  className="px-2 py-1 bg-stone-100 text-stone-600 rounded text-[10px] font-medium"
                                >
                                  取消
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveGuestEdit(selectedTable.table_no, guest.id)}
                                  className="px-2 py-1 bg-[#8E9E8C] text-white rounded text-[10px] font-semibold flex items-center gap-0.5"
                                >
                                  <Check className="w-3 h-3" />
                                  儲存
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 bg-[#FAF8F5] border border-[#F0EBE4]/60 hover:border-[#8E9E8C] rounded-xl flex flex-col justify-between h-full group transition relative">
                              <div className="flex items-start justify-between">
                                <div className="font-semibold text-[#4A443F] text-xs">
                                  <span className="font-mono text-[#A6998A] mr-1.5 text-[10px]">{idx + 1}.</span>
                                  {guest.name}
                                </div>
                                <div className="flex gap-1 md:opacity-0 group-hover:opacity-100 transition duration-150 shrink-0">
                                  <button
                                    onClick={() => {
                                      setEditingGuestId(guest.id);
                                      setEditingGuestName(guest.name);
                                      setEditingGuestNotes(guest.notes || '');
                                    }}
                                    className="p-1 hover:bg-[#FAF8F5] text-[#A6998A] hover:text-[#5E564E] rounded transition cursor-pointer"
                                    title="編輯備註"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveGuest(selectedTable.table_no, guest.id)}
                                    className="p-1 hover:bg-[#FAF8F5] text-[#A6998A] hover:text-[#D4A373] rounded transition cursor-pointer"
                                    title="移出此桌"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              
                              {/* Notes/remarks indicator badge */}
                              {guest.notes ? (
                                <div className="mt-2 text-[10px] text-[#D4A373] bg-[#FAF5EE] border border-[#D4A373]/10 px-2 py-0.5 rounded-md font-medium w-fit max-w-full truncate" title={guest.notes}>
                                  💬 {guest.notes}
                                </div>
                              ) : (
                                <button 
                                  onClick={() => {
                                    setEditingGuestId(guest.id);
                                    setEditingGuestName(guest.name);
                                    setEditingGuestNotes('');
                                  }}
                                  className="mt-2 text-[9px] text-[#A6998A] hover:text-[#D4A373] cursor-pointer text-left font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition"
                                >
                                  + 新增備註 (素食/座位等)
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <Users className="w-8 h-8 text-[#A6998A] mx-auto mb-2" />
              <p className="text-xs text-[#A6998A]">請先選擇或新增一個桌位進行編輯</p>
            </div>
          )}
        </div>

        {/* Quick Allocation & Stats (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="border border-[#E2D9CD] rounded-[2rem] p-5 bg-white space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold text-[#5E564E] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#8E9E8C]" />
                  表單名單池
                </h3>
                <p className="text-[10px] text-[#A6998A] mt-1">
                  使用回覆清單目前篩選後的名單
                </p>
              </div>
              <button
                type="button"
                disabled={!selectedTable || availableResponseGuests.length === 0}
                onClick={() => selectedTable && handleImportAllResponseGuests(selectedTable.table_no)}
                className="px-3 py-1.5 bg-[#8E9E8C] hover:bg-[#7D8C7C] disabled:bg-stone-200 disabled:text-stone-400 text-white rounded-lg text-[10px] font-semibold transition"
              >
                全部加入此桌
              </button>
            </div>

            {responseGuests.length === 0 ? (
              <div className="border border-dashed border-[#E2D9CD] rounded-2xl p-4 text-center text-xs text-[#A6998A] bg-[#FAF8F5]">
                請先到「回覆清單」讀取表單，並設定姓名欄位與篩選條件。
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#FAF8F5] border border-[#F0EBE4] rounded-xl p-2 text-center">
                    <span className="block text-[10px] text-[#A6998A]">篩選名單</span>
                    <span className="font-mono text-sm font-bold text-[#5E564E]">{responseGuests.length}</span>
                  </div>
                  <div className="bg-[#F5F8F5] border border-[#E2D9CD]/60 rounded-xl p-2 text-center">
                    <span className="block text-[10px] text-[#A6998A]">尚未入座</span>
                    <span className="font-mono text-sm font-bold text-[#8E9E8C]">{availableResponseGuests.length}</span>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {responseGuests.map(candidate => {
                    const nameKey = candidate.name.trim().toLowerCase();
                    const isSeated = seatedGuestNames.has(nameKey);
                    return (
                      <div key={candidate.id} className="flex items-start justify-between gap-2 border border-[#F0EBE4] rounded-xl p-3 bg-[#FAF8F5]">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#4A443F] truncate">{candidate.name}</p>
                          {(candidate.notes || candidate.sourceLabel) && (
                            <p className="text-[10px] text-[#A6998A] mt-1 line-clamp-2">{candidate.notes || candidate.sourceLabel}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={!selectedTable || isSeated}
                          onClick={() => selectedTable && handleImportResponseGuest(selectedTable.table_no, candidate)}
                          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-[#F2EDE4]/40 disabled:bg-stone-100 disabled:text-stone-400 border border-[#E2D9CD] text-[#8C745A] rounded-lg text-[10px] font-semibold transition"
                          title={isSeated ? '已在座位表中' : '加入目前選取的桌'}
                        >
                          <UserPlus className="w-3 h-3" />
                          {isSeated ? '已入座' : '加入'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Quick Helper Panel */}
          <div className="border border-[#E2D9CD] rounded-[2rem] p-5 bg-[#FAF8F5]">
            <h3 className="text-xs font-semibold text-[#5E564E] flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#8E9E8C]" />
              座位排座指南
            </h3>
            <ul className="text-[11px] text-[#8C8479] space-y-2 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="text-[#8E9E8C] mt-0.5">•</span>
                <span><strong>主桌配置：</strong>雙方主桌一般設定 10-12 人座，建議長輩與至親入座。</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#8E9E8C] mt-0.5">•</span>
                <span><strong>區域防呆：</strong>當桌次賓客超出設定的座位上限時，系統會自動亮起「超額」警示。</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#8E9E8C] mt-0.5">•</span>
                <span><strong>快速搜尋：</strong>您可以使用上方的搜尋框，輸入親友姓名，秒速定位他在第幾桌。</span>
              </li>
            </ul>
          </div>

          {/* Quick Seating Summary stats */}
          <div className="border border-[#F0EBE4] rounded-[2rem] p-5 bg-white space-y-3">
            <h3 className="text-xs font-semibold text-[#5E564E] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#8E9E8C]" />
              席次統計總覽
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#FAF8F5] rounded-xl p-2.5 text-center border border-[#F0EBE4]">
                <span className="text-[10px] text-[#A6998A] block">總開桌數</span>
                <span className="text-lg font-serif font-bold text-[#5E564E] font-mono">{tables.length}</span>
              </div>
              <div className="bg-[#FAF8F5] rounded-xl p-2.5 text-center border border-[#F0EBE4]">
                <span className="text-[10px] text-[#A6998A] block">已排座賓客數</span>
                <span className="text-lg font-serif font-bold text-[#5E564E] font-mono">
                  {tables.reduce((acc, t) => acc + t.guests.length, 0)} 位
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
