import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  Filter,
  Link,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  UserCheck,
  Users
} from 'lucide-react';
import {
  FormResponseRow,
  ResponseFieldMapping,
  ResponseFilterOperator,
  ResponseFilterRule,
  ResponseSourceConfig
} from '../types';
import { filterResponses } from './ResponseList';
import { showSuccess, showWarning } from '../lib/alerts';

interface Props {
  sourceConfig: ResponseSourceConfig;
  setSourceConfig: React.Dispatch<React.SetStateAction<ResponseSourceConfig>>;
  headers: string[];
  setHeaders: React.Dispatch<React.SetStateAction<string[]>>;
  responses: FormResponseRow[];
  setResponses: React.Dispatch<React.SetStateAction<FormResponseRow[]>>;
  fieldMapping: ResponseFieldMapping;
  setFieldMapping: React.Dispatch<React.SetStateAction<ResponseFieldMapping>>;
  filterRules: ResponseFilterRule[];
  setFilterRules: React.Dispatch<React.SetStateAction<ResponseFilterRule[]>>;
}

const DEFAULT_RANGE = 'A:Z';
const OPERATORS: { value: ResponseFilterOperator; label: string }[] = [
  { value: 'equals', label: '等於' },
  { value: 'contains', label: '包含' },
  { value: 'not_equals', label: '不等於' },
  { value: 'not_empty', label: '有填寫' }
];

const FIELD_OPTIONS: { key: keyof ResponseFieldMapping; label: string; required?: boolean }[] = [
  { key: 'nameField', label: '賓客姓名', required: true },
  { key: 'attendanceField', label: '是否出席' },
  { key: 'countField', label: '出席人數' },
  { key: 'relationshipField', label: '關係／群組' },
  { key: 'phoneField', label: '手機' },
  { key: 'emailField', label: 'Email' },
  { key: 'notesField', label: '備註／需求' }
];

function extractSpreadsheetId(input: string) {
  const trimmed = input.trim();
  const id = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1]
    || (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed) ? trimmed : '');
  const gid = trimmed.match(/[?#&]gid=(\d+)/)?.[1] || '';
  return { id, gid };
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function toResponses(rows: string[][]) {
  if (!rows.length) return { headers: [] as string[], responses: [] as FormResponseRow[] };
  const headers = rows[0].map((header, index) => header.trim() || `欄位 ${index + 1}`);
  const responses = rows.slice(1).map((row, index) => {
    const values = Object.fromEntries(headers.map((header, column) => [header, (row[column] || '').trim()]));
    return { id: `sheet_${index + 2}_${Object.values(values).join('|').slice(0, 20)}`, rowNumber: index + 2, values };
  }).filter(item => Object.values(item.values).some(Boolean));
  return { headers, responses };
}

function attendanceTone(value: string) {
  if (!value) return { label: '未指定', className: 'bg-stone-100 text-stone-500' };
  if (/不|否|無法|不能|缺席|no/i.test(value)) return { label: value, className: 'bg-rose-50 text-rose-600' };
  if (/是|會|出席|參加|可以|yes/i.test(value)) return { label: value, className: 'bg-emerald-50 text-emerald-700' };
  return { label: value, className: 'bg-amber-50 text-amber-700' };
}

export default function ResponseWorkspace(props: Props) {
  const {
    sourceConfig, setSourceConfig, headers, setHeaders, responses, setResponses,
    fieldMapping, setFieldMapping, filterRules, setFilterRules
  } = props;
  const [step, setStep] = useState<1 | 2 | 3>(sourceConfig.setupComplete ? 3 : headers.length ? 2 : 1);
  const [editingSetup, setEditingSetup] = useState(!sourceConfig.setupComplete);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const standardizedGuests = useMemo(() => filterResponses(responses, filterRules).map(row => ({
    id: row.id,
    row,
    name: fieldMapping.nameField ? (row.values[fieldMapping.nameField] || '').trim() : '',
    attendance: fieldMapping.attendanceField ? row.values[fieldMapping.attendanceField] || '' : '',
    count: fieldMapping.countField ? Math.max(1, Number.parseInt(row.values[fieldMapping.countField], 10) || 1) : 1,
    relationship: fieldMapping.relationshipField ? row.values[fieldMapping.relationshipField] || '' : '',
    phone: fieldMapping.phoneField ? row.values[fieldMapping.phoneField] || '' : '',
    email: fieldMapping.emailField ? row.values[fieldMapping.emailField] || '' : '',
    notes: fieldMapping.notesField ? row.values[fieldMapping.notesField] || '' : ''
  })).filter(guest => guest.name), [responses, filterRules, fieldMapping]);

  const visibleGuests = standardizedGuests.filter(guest => {
    const query = search.trim().toLowerCase();
    return !query || [guest.name, guest.relationship, guest.phone, guest.email, guest.notes].some(value => value.toLowerCase().includes(query));
  });

  const updateUrl = (sheetUrl: string) => {
    const parsed = extractSpreadsheetId(sheetUrl);
    setSourceConfig(previous => ({
      ...previous,
      sheetUrl,
      spreadsheetId: parsed.id,
      gid: parsed.gid,
      range: previous.range || DEFAULT_RANGE,
      setupComplete: false
    }));
  };

  const loadResponses = async () => {
    if (/docs\.google\.com\/forms\/d\//i.test(sourceConfig.sheetUrl)) {
      setLoadError('請貼上表單所連結的 Google 試算表，而不是 Google Form 填寫網址。');
      return;
    }
    const parsed = extractSpreadsheetId(sourceConfig.sheetUrl || sourceConfig.spreadsheetId);
    const spreadsheetId = sourceConfig.spreadsheetId || parsed.id;
    if (!spreadsheetId) {
      setLoadError('無法辨識試算表網址。');
      return;
    }

    setIsLoading(true);
    setLoadError('');
    const range = encodeURIComponent(sourceConfig.range || DEFAULT_RANGE);
    const urls = [
      sourceConfig.gid ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${sourceConfig.gid}` : '',
      sourceConfig.sheetName ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sourceConfig.sheetName)}&range=${range}` : '',
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&range=${range}`
    ].filter(Boolean);

    let errorMessage = '無法讀取試算表。';
    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (!response.ok) { errorMessage = `Google 回傳錯誤（${response.status}）。`; continue; }
        const text = await response.text();
        if (/^\s*</.test(text)) { errorMessage = '試算表權限不足，請設為知道連結的人可檢視。'; continue; }
        const parsedData = toResponses(parseCsv(text));
        if (!parsedData.headers.length) { errorMessage = '試算表沒有可讀取的欄位。'; continue; }

        setHeaders(parsedData.headers);
        setResponses(parsedData.responses);
        setSourceConfig(previous => ({ ...previous, spreadsheetId, range: previous.range || DEFAULT_RANGE, lastLoadedAt: new Date().toISOString(), setupComplete: false }));
        const guess = (pattern: RegExp) => parsedData.headers.find(header => pattern.test(header)) || '';
        setFieldMapping(previous => ({
          ...previous,
          nameField: previous.nameField || guess(/姓名|名字|name/i) || parsedData.headers[0],
          attendanceField: previous.attendanceField || guess(/出席|參加|attendance/i),
          countField: previous.countField || guess(/人數|幾位|count|party/i),
          relationshipField: previous.relationshipField || guess(/關係|身份|群組|relation/i),
          phoneField: previous.phoneField || guess(/電話|手機|phone|mobile/i),
          emailField: previous.emailField || guess(/email|信箱|郵件/i),
          notesField: previous.notesField || guess(/備註|需求|飲食|note/i)
        }));
        setStep(2);
        setIsLoading(false);
        return;
      } catch (error: any) {
        errorMessage = error?.message || errorMessage;
      }
    }
    setLoadError(errorMessage);
    setIsLoading(false);
  };

  const finishSetup = () => {
    if (!fieldMapping.nameField) {
      showWarning('尚未設定姓名欄位', '請返回第二步選擇賓客姓名欄位。');
      return;
    }
    setSourceConfig(previous => ({ ...previous, setupComplete: true }));
    setEditingSetup(false);
    showSuccess('設定完成', `${standardizedGuests.length} 筆賓客資料已可供宴席排座使用。`);
  };

  const addRule = () => setFilterRules(previous => [...previous, {
    id: `filter_${Date.now()}`,
    field: headers[0] || '',
    operator: 'equals',
    value: ''
  }]);

  const StepHeader = () => (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      {[
        [1, 'Connect Form', '連接回覆'],
        [2, 'Map Fields', '對應欄位'],
        [3, 'Review', '確認名單']
      ].map(([number, english, chinese]) => {
        const active = step === number;
        const completed = step > number;
        return (
          <button key={number} type="button" onClick={() => completed && setStep(number as 1 | 2 | 3)} className="text-left">
            <div className={`h-1 rounded-full mb-2 ${active || completed ? 'bg-[#8E9E8C]' : 'bg-[#E2D9CD]'}`} />
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${active || completed ? 'bg-[#8E9E8C] text-white' : 'bg-[#F2EDE4] text-[#A6998A]'}`}>
                {completed ? <Check className="w-3.5 h-3.5" /> : number}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-[#5E564E] truncate">{english}</p>
                <p className="text-[9px] text-[#A6998A] hidden sm:block">{chinese}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-[#F0EBE4] p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold font-serif text-[#5E564E] flex items-center gap-2"><Users className="w-5 h-5 text-[#8E9E8C]" />賓客回覆中心</h2>
          <p className="text-xs text-[#A6998A] mt-1">連接 Google Form 回覆試算表，整理成可直接排座的賓客名單。</p>
        </div>
        {!editingSetup && (
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button onClick={loadResponses} disabled={isLoading} className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-[#8E9E8C] text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"><RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isLoading ? 'animate-spin' : ''}`} />同步最新回覆</button>
            <button onClick={() => { setEditingSetup(true); setStep(1); }} className="flex-1 sm:flex-none px-3 py-2 rounded-xl border border-[#E2D9CD] text-[#8C745A] text-xs font-semibold whitespace-nowrap"><Settings2 className="w-3.5 h-3.5 inline mr-1" />重新設定</button>
          </div>
        )}
      </div>

      {editingSetup ? (
        <section className="bg-[#FAF8F5] border border-[#F0EBE4] rounded-[1.5rem] p-4 sm:p-5 space-y-5">
          <StepHeader />

          {step === 1 && (
            <div className="max-w-2xl mx-auto space-y-4 py-2">
              <div className="text-center"><Link className="w-8 h-8 mx-auto text-[#8E9E8C] mb-2" /><h3 className="font-serif font-semibold text-[#5E564E]">連接 Google 表單回覆</h3><p className="text-xs text-[#A6998A] mt-1">請先在 Google Form 的「回覆」分頁連結試算表，再貼上試算表網址。</p></div>
              <label className="block text-xs font-semibold text-[#8C745A]">Google Sheet 分享網址</label>
              <input value={sourceConfig.sheetUrl} onChange={event => updateUrl(event.target.value)} placeholder="貼上 Google 試算表網址" className="w-full px-4 py-3 bg-white border border-[#E2D9CD] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#8E9E8C]" />
              <div className="grid sm:grid-cols-2 gap-3">
                <input value={sourceConfig.sheetName || ''} onChange={event => setSourceConfig(previous => ({ ...previous, sheetName: event.target.value }))} placeholder="工作表名稱（選填）" className="px-3 py-2 bg-white border border-[#E2D9CD] rounded-xl text-xs" />
                <input value={sourceConfig.range || DEFAULT_RANGE} onChange={event => setSourceConfig(previous => ({ ...previous, range: event.target.value }))} placeholder="讀取範圍" className="px-3 py-2 bg-white border border-[#E2D9CD] rounded-xl text-xs font-mono" />
              </div>
              {loadError && <div className="flex gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700"><AlertCircle className="w-4 h-4 shrink-0" />{loadError}</div>}
              <button onClick={loadResponses} disabled={isLoading || !sourceConfig.sheetUrl.trim()} className="w-full py-3 rounded-xl bg-[#8E9E8C] text-white text-sm font-semibold disabled:opacity-50 flex justify-center items-center gap-2">{isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}{isLoading ? '正在讀取回覆' : '連接並讀取回覆'}</button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div><h3 className="font-serif font-semibold text-[#5E564E]">將表單問題對應到賓客資料</h3><p className="text-xs text-[#A6998A] mt-1">系統已自動判斷欄位，請確認後繼續。</p></div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {FIELD_OPTIONS.map(option => (
                  <label key={option.key} className="space-y-1"><span className="text-[10px] font-bold text-[#8C745A]">{option.label}{option.required ? ' *' : ''}</span><select value={fieldMapping[option.key] || ''} onChange={event => setFieldMapping(previous => ({ ...previous, [option.key]: event.target.value }))} className="w-full px-3 py-2.5 bg-white border border-[#E2D9CD] rounded-xl text-xs"><option value="">不指定</option>{headers.map(header => <option key={header} value={header}>{header}</option>)}</select></label>
                ))}
              </div>
              <div className="bg-white border border-[#F0EBE4] rounded-xl p-3"><p className="text-[10px] font-bold text-[#A6998A] mb-2">即時預覽</p><div className="grid sm:grid-cols-3 gap-2">{standardizedGuests.slice(0, 3).map(guest => <div key={guest.id} className="p-3 bg-[#FAF8F5] rounded-lg"><p className="text-xs font-semibold">{guest.name || '未辨識姓名'}</p><p className="text-[10px] text-[#A6998A] mt-1">{guest.relationship || '未設定關係'}・{guest.count} 位</p></div>)}</div></div>
              <div className="flex justify-between"><button onClick={() => setStep(1)} className="px-4 py-2 text-xs text-[#8C745A] flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" />上一步</button><button disabled={!fieldMapping.nameField} onClick={() => setStep(3)} className="px-5 py-2.5 rounded-xl bg-[#8E9E8C] text-white text-xs font-semibold disabled:opacity-50">預覽賓客名單</button></div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3"><div className="p-3 bg-white rounded-xl border border-[#F0EBE4] text-center"><span className="block text-[10px] text-[#A6998A]">原始回覆</span><strong className="font-mono text-lg">{responses.length}</strong></div><div className="p-3 bg-white rounded-xl border border-[#F0EBE4] text-center"><span className="block text-[10px] text-[#A6998A]">有效賓客</span><strong className="font-mono text-lg text-[#8E9E8C]">{standardizedGuests.length}</strong></div><div className="p-3 bg-white rounded-xl border border-[#F0EBE4] text-center"><span className="block text-[10px] text-[#A6998A]">預計席位</span><strong className="font-mono text-lg text-[#D4A373]">{standardizedGuests.reduce((sum, guest) => sum + guest.count, 0)}</strong></div></div>
              <p className="text-xs text-[#A6998A]">完成後，這份標準化名單會出現在「宴席排座」的待安排賓客池。</p>
              <div className="flex justify-between"><button onClick={() => setStep(2)} className="px-4 py-2 text-xs text-[#8C745A] flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" />上一步</button><button onClick={finishSetup} className="px-5 py-2.5 rounded-xl bg-[#8E9E8C] text-white text-xs font-semibold flex items-center gap-1.5"><UserCheck className="w-4 h-4" />完成設定並建立名單</button></div>
            </div>
          )}
        </section>
      ) : (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-[#F5F8F5] border border-[#E2D9CD]"><Check className="w-4 h-4 text-[#8E9E8C]" /><span className="text-xs font-semibold text-[#5E564E]">已連接 Google 表單回覆</span><span className="text-[10px] text-[#A6998A]">{sourceConfig.lastLoadedAt ? `最後同步 ${new Date(sourceConfig.lastLoadedAt).toLocaleString()}` : ''}</span></div>
      )}

      {!editingSetup && (
        <>
          <section className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h3 className="font-serif font-semibold text-[#5E564E]">標準化賓客名單</h3><p className="text-xs text-[#A6998A]">只顯示排座需要的資料，完整回答仍保留在明細中。</p></div><div className="relative sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A6998A]" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜尋賓客" className="w-full pl-9 pr-3 py-2 border border-[#E2D9CD] rounded-xl text-xs" /></div></div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2"><div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#F0EBE4]"><span className="text-[10px] text-[#A6998A]">賓客回覆</span><strong className="block font-mono text-lg">{standardizedGuests.length}</strong></div><div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#F0EBE4]"><span className="text-[10px] text-[#A6998A]">預計席位</span><strong className="block font-mono text-lg">{standardizedGuests.reduce((sum, guest) => sum + guest.count, 0)}</strong></div><div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100"><span className="text-[10px] text-emerald-700">明確出席</span><strong className="block font-mono text-lg text-emerald-700">{standardizedGuests.filter(guest => /是|會|出席|參加|可以|yes/i.test(guest.attendance)).length}</strong></div><div className="p-3 rounded-xl bg-amber-50 border border-amber-100"><span className="text-[10px] text-amber-700">需確認</span><strong className="block font-mono text-lg text-amber-700">{standardizedGuests.filter(guest => !guest.attendance).length}</strong></div></div>

            <button onClick={() => setShowFilters(value => !value)} className="text-xs font-semibold text-[#8C745A] flex items-center gap-1"><Filter className="w-3.5 h-3.5" />進階篩選<ChevronDown className={`w-3.5 h-3.5 transition ${showFilters ? 'rotate-180' : ''}`} /></button>
            {showFilters && <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#F0EBE4] space-y-2"><div className="flex justify-between"><span className="text-xs font-semibold">只有符合規則的賓客會進入排座名單</span><button onClick={addRule} className="text-xs text-[#8E9E8C] font-semibold">＋新增規則</button></div>{filterRules.map(rule => <div key={rule.id} className="grid sm:grid-cols-[1.3fr_1fr_1.3fr_auto] gap-2"><select value={rule.field} onChange={event => setFilterRules(previous => previous.map(item => item.id === rule.id ? { ...item, field: event.target.value } : item))} className="px-2 py-2 bg-white border rounded-lg text-xs">{headers.map(header => <option key={header}>{header}</option>)}</select><select value={rule.operator} onChange={event => setFilterRules(previous => previous.map(item => item.id === rule.id ? { ...item, operator: event.target.value as ResponseFilterOperator } : item))} className="px-2 py-2 bg-white border rounded-lg text-xs">{OPERATORS.map(operator => <option key={operator.value} value={operator.value}>{operator.label}</option>)}</select><input value={rule.value} disabled={rule.operator === 'not_empty'} onChange={event => setFilterRules(previous => previous.map(item => item.id === rule.id ? { ...item, value: event.target.value } : item))} className="px-2 py-2 bg-white border rounded-lg text-xs" /><button onClick={() => setFilterRules(previous => previous.filter(item => item.id !== rule.id))} className="p-2 text-[#D4A373]"><Trash2 className="w-4 h-4" /></button></div>)}</div>}

            <div className="hidden md:block border border-[#F0EBE4] rounded-2xl overflow-hidden"><table className="w-full text-xs"><thead className="bg-[#FAF8F5] text-[#8C745A]"><tr><th className="text-left p-3">姓名</th><th className="text-left p-3">出席</th><th className="text-left p-3">人數</th><th className="text-left p-3">關係／群組</th><th className="text-left p-3">聯絡方式</th><th className="text-left p-3">備註</th></tr></thead><tbody>{visibleGuests.map(guest => { const tone = attendanceTone(guest.attendance); return <tr key={guest.id} className="border-t border-[#F0EBE4]"><td className="p-3 font-semibold">{guest.name}</td><td className="p-3"><span className={`px-2 py-1 rounded-full text-[10px] ${tone.className}`}>{tone.label}</span></td><td className="p-3 font-mono">{guest.count}</td><td className="p-3">{guest.relationship || '—'}</td><td className="p-3"><div>{guest.phone || guest.email || '—'}</div></td><td className="p-3 max-w-[220px] truncate" title={guest.notes}>{guest.notes || '—'}</td></tr>; })}</tbody></table></div>
            <div className="md:hidden space-y-2">{visibleGuests.map(guest => { const tone = attendanceTone(guest.attendance); return <details key={guest.id} className="p-3 rounded-xl bg-[#FAF8F5] border border-[#F0EBE4]"><summary className="list-none flex items-center justify-between gap-2"><div className="min-w-0"><p className="text-sm font-semibold truncate">{guest.name}</p><p className="text-[10px] text-[#A6998A] mt-1 truncate">{guest.relationship || '未設定關係'}・{guest.count} 位</p></div><span className={`shrink-0 max-w-[45%] truncate px-2 py-1 rounded-full text-[10px] ${tone.className}`}>{tone.label}</span></summary><div className="pt-3 mt-3 border-t text-xs text-[#8C745A] space-y-1 break-words"><p>聯絡：{guest.phone || guest.email || '—'}</p><p>備註：{guest.notes || '—'}</p></div></details>; })}</div>
            {!visibleGuests.length && <div className="py-10 text-center text-xs text-[#A6998A]"><ExternalLink className="w-7 h-7 mx-auto mb-2 opacity-50" />沒有符合條件的賓客。</div>}
          </section>
        </>
      )}
    </div>
  );
}
