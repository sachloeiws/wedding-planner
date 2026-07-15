/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  DownloadCloud,
  ExternalLink,
  Filter,
  Link,
  ListFilter,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  Users
} from 'lucide-react';
import {
  FormResponseRow,
  ResponseFieldMapping,
  ResponseFilterOperator,
  ResponseFilterRule,
  ResponseSourceConfig
} from '../types';

interface ResponseListProps {
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
  { value: 'not_empty', label: '有填寫' },
];

function extractSpreadsheetId(input: string) {
  const trimmed = input.trim();
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = trimmed.match(/[?#&]gid=(\d+)/);

  if (idMatch) {
    return {
      spreadsheetId: idMatch[1],
      gid: gidMatch?.[1] || '',
    };
  }

  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return { spreadsheetId: trimmed, gid: gidMatch?.[1] || '' };
  }

  return { spreadsheetId: '', gid: '' };
}

function isGoogleFormsUrl(input: string) {
  return /docs\.google\.com\/forms\/d\//i.test(input);
}
function csvValueToRows(text: string) {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(current);
      if (row.some(cell => cell.trim() !== '')) rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some(cell => cell.trim() !== '')) rows.push(row);
  return rows;
}

function normalizeHeader(header: string, index: number) {
  const clean = header.trim();
  return clean || `欄位 ${index + 1}`;
}

function rowsToResponses(rows: string[][]) {
  if (rows.length === 0) return { headers: [] as string[], responses: [] as FormResponseRow[] };

  const headers = rows[0].map(normalizeHeader);
  const responses = rows.slice(1).map((row, rowIndex) => {
    const values = headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = (row[index] || '').trim();
      return acc;
    }, {});

    return {
      id: `sheet_row_${rowIndex + 2}_${Object.values(values).join('|').slice(0, 24)}`,
      rowNumber: rowIndex + 2,
      values,
    };
  }).filter(row => Object.values(row.values).some(value => value.trim() !== ''));

  return { headers, responses };
}

function buildCsvUrls(config: ResponseSourceConfig) {
  const encodedSheet = config.sheetName ? encodeURIComponent(config.sheetName) : '';
  const encodedRange = encodeURIComponent(config.range || DEFAULT_RANGE);
  const id = config.spreadsheetId;
  const urls: string[] = [];

  if (config.gid) {
    urls.push(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${config.gid}`);
    urls.push(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${config.gid}&range=${encodedRange}`);
  }

  if (encodedSheet) {
    urls.push(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodedSheet}&range=${encodedRange}`);
  }

  urls.push(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&range=${encodedRange}`);
  return urls;
}

function responseMatchesRule(row: FormResponseRow, rule: ResponseFilterRule) {
  const actual = (row.values[rule.field] || '').trim();
  const expected = rule.value.trim();

  switch (rule.operator) {
    case 'contains':
      return actual.toLowerCase().includes(expected.toLowerCase());
    case 'not_equals':
      return actual !== expected;
    case 'not_empty':
      return actual.length > 0;
    case 'equals':
    default:
      return actual === expected;
  }
}

export function filterResponses(rows: FormResponseRow[], rules: ResponseFilterRule[]) {
  const activeRules = rules.filter(rule => rule.field && (rule.operator === 'not_empty' || rule.value.trim()));
  if (activeRules.length === 0) return rows;
  return rows.filter(row => activeRules.every(rule => responseMatchesRule(row, rule)));
}

export default function ResponseList({
  sourceConfig,
  setSourceConfig,
  headers,
  setHeaders,
  responses,
  setResponses,
  fieldMapping,
  setFieldMapping,
  filterRules,
  setFilterRules,
}: ResponseListProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [searchText, setSearchText] = useState('');

  const filteredResponses = useMemo(() => {
    const byRule = filterResponses(responses, filterRules);
    const cleanSearch = searchText.trim().toLowerCase();
    if (!cleanSearch) return byRule;
    return byRule.filter(row => Object.values(row.values).some(value => value.toLowerCase().includes(cleanSearch)));
  }, [filterRules, responses, searchText]);

  const updateSheetUrl = (sheetUrl: string) => {
    const parsed = extractSpreadsheetId(sheetUrl);
    setSourceConfig(prev => ({
      ...prev,
      sheetUrl,
      spreadsheetId: parsed.spreadsheetId,
      gid: parsed.gid || '',
      range: prev.range || DEFAULT_RANGE,
    }));
  };

  const loadResponses = async () => {
    if (isGoogleFormsUrl(sourceConfig.sheetUrl)) {
      setLoadError('目前瀏覽器端無法只靠 Google Forms 連結讀取回覆內容。請到表單的「回覆」分頁開啟連結的 Google 試算表，將該試算表設為知道連結者可存取後貼上連結。');
      return;
    }
    const parsed = extractSpreadsheetId(sourceConfig.sheetUrl || sourceConfig.spreadsheetId);
    const nextConfig: ResponseSourceConfig = {
      ...sourceConfig,
      spreadsheetId: sourceConfig.spreadsheetId || parsed.spreadsheetId,
      gid: sourceConfig.gid || parsed.gid,
      range: sourceConfig.range || DEFAULT_RANGE,
    };

    if (!nextConfig.spreadsheetId) {
      setLoadError('無法辨識試算表連結，請貼上 Google Sheet 的分享連結。');
      return;
    }

    setIsLoading(true);
    setLoadError('');

    const urls = buildCsvUrls(nextConfig);
    let lastError = '';

    for (const url of urls) {
      try {
        const result = await fetch(url, { method: 'GET' });
        if (!result.ok) {
          lastError = `讀取失敗 (${result.status})`;
          continue;
        }

        const text = await result.text();
        if (/^\s*</.test(text)) {
          lastError = 'Google 回傳登入或權限頁面，這份試算表目前無法直接讀取。';
          continue;
        }

        const parsedRows = csvValueToRows(text);
        const parsedData = rowsToResponses(parsedRows);
        if (parsedData.headers.length === 0) {
          lastError = '試算表沒有可讀取的欄位。';
          continue;
        }

        setHeaders(parsedData.headers);
        setResponses(parsedData.responses);
        setSourceConfig({ ...nextConfig, lastLoadedAt: new Date().toISOString() });

        if (!fieldMapping.nameField) {
          const possibleName = parsedData.headers.find(header => /姓名|名字|name/i.test(header)) || parsedData.headers[0];
          setFieldMapping(prev => ({ ...prev, nameField: possibleName }));
        }

        setIsLoading(false);
        return;
      } catch (error: any) {
        lastError = error?.message || '讀取時發生未知錯誤。';
      }
    }

    setIsLoading(false);
    setLoadError(`${lastError || '無法讀取試算表。'} 請確認分享權限至少是「知道連結的人可檢視」。`);
  };

  const addFilterRule = () => {
    setFilterRules(prev => [
      ...prev,
      { id: `filter_${Date.now()}`, field: headers[0] || '', operator: 'equals', value: '' },
    ]);
  };

  const updateFilterRule = (id: string, patch: Partial<ResponseFilterRule>) => {
    setFilterRules(prev => prev.map(rule => rule.id === id ? { ...rule, ...patch } : rule));
  };

  const removeFilterRule = (id: string) => {
    setFilterRules(prev => prev.filter(rule => rule.id !== id));
  };

  return (
    <div id="responses_section" className="bg-white rounded-[2rem] shadow-sm border border-[#F0EBE4] p-4 sm:p-6 flex flex-col h-full gap-5">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold font-serif tracking-tight text-[#5E564E] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#8E9E8C]" />
            表單回覆清單
          </h2>
          <p className="text-xs text-[#A6998A] mt-1 leading-relaxed">
            貼上 Google Form 回覆試算表連結，自動讀取欄位與回覆，並提供後續排座使用。
          </p>
        </div>
        {sourceConfig.lastLoadedAt && (
          <span className="text-[10px] font-mono text-[#A6998A] bg-[#FAF8F5] border border-[#F0EBE4] rounded-full px-3 py-1 w-fit">
            最後同步 {new Date(sourceConfig.lastLoadedAt).toLocaleString()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <section className="xl:col-span-5 bg-[#FAF8F5] border border-[#F0EBE4] rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#5E564E]">
            <Link className="w-4 h-4 text-[#8E9E8C]" />
            試算表來源
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[#A6998A] uppercase tracking-wider">Google Sheet 分享連結</label>
            <input
              type="text"
              value={sourceConfig.sheetUrl}
              onChange={event => updateSheetUrl(event.target.value)}
              placeholder="貼上 https://docs.google.com/spreadsheets/d/..."
              className="w-full px-3 py-2 text-xs bg-white border border-[#E2D9CD] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#8E9E8C]"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#A6998A] uppercase tracking-wider">工作表名稱（選填）</label>
              <input
                type="text"
                value={sourceConfig.sheetName || ''}
                onChange={event => setSourceConfig(prev => ({ ...prev, sheetName: event.target.value }))}
                placeholder="例如：表單回應 1"
                className="w-full px-3 py-2 text-xs bg-white border border-[#E2D9CD] rounded-xl focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#A6998A] uppercase tracking-wider">讀取範圍</label>
              <input
                type="text"
                value={sourceConfig.range || DEFAULT_RANGE}
                onChange={event => setSourceConfig(prev => ({ ...prev, range: event.target.value || DEFAULT_RANGE }))}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E2D9CD] rounded-xl focus:outline-none font-mono"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={loadResponses}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#8E9E8C] hover:bg-[#7D8C7C] disabled:opacity-60 text-white rounded-xl text-xs font-semibold transition"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
            {isLoading ? '讀取中...' : '讀取回覆'}
          </button>
          {loadError && (
            <div className="flex items-start gap-2 text-xs text-[#D4A373] bg-[#FAF5EE] border border-[#E8DFD1] rounded-xl p-3 leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{loadError}</span>
            </div>
          )}
          <p className="text-[10px] text-[#A6998A] leading-relaxed">
            建議將試算表分享權限設為「知道連結的人可檢視」。如果 Google 阻擋直接讀取，畫面會提示如何調整。
          </p>
        </section>

        <section className="xl:col-span-7 bg-white border border-[#F0EBE4] rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#5E564E]">
            <Settings2 className="w-4 h-4 text-[#8E9E8C]" />
            欄位對應
          </div>
          {headers.length === 0 ? (
            <p className="text-xs text-[#A6998A] bg-[#FAF8F5] border border-dashed border-[#E2D9CD] rounded-xl p-4 text-center">
              讀取試算表後，這裡會顯示可對應的題目欄位。
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {([
                ['nameField', '姓名欄位 *'],
                ['phoneField', '手機欄位'],
                ['emailField', 'Email 欄位'],
                ['attendanceField', '出席欄位'],
                ['countField', '人數欄位'],
                ['notesField', '備註欄位'],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <label className="text-[10px] font-bold text-[#A6998A] uppercase tracking-wider">{label}</label>
                  <select
                    value={fieldMapping[key] || ''}
                    onChange={event => setFieldMapping(prev => ({ ...prev, [key]: event.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E2D9CD] rounded-xl focus:outline-none"
                  >
                    <option value="">不指定</option>
                    {headers.map(header => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="bg-[#FAF8F5] border border-[#F0EBE4] rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#5E564E]">
            <ListFilter className="w-4 h-4 text-[#8E9E8C]" />
            篩選規則
          </div>
          <button
            type="button"
            onClick={addFilterRule}
            disabled={headers.length === 0}
            className="px-3 py-1.5 bg-white hover:bg-[#F2EDE4]/40 disabled:opacity-50 border border-[#E2D9CD] text-[#8C745A] rounded-xl text-xs font-semibold transition"
          >
            新增規則
          </button>
        </div>

        {filterRules.length === 0 ? (
          <p className="text-xs text-[#A6998A]">尚未設定篩選；排座可使用全部回覆名單。</p>
        ) : (
          <div className="space-y-2">
            {filterRules.map(rule => (
              <div key={rule.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 bg-white border border-[#F0EBE4] rounded-xl p-2">
                <select
                  value={rule.field}
                  onChange={event => updateFilterRule(rule.id, { field: event.target.value })}
                  className="md:col-span-4 px-3 py-2 text-xs border border-[#E2D9CD] rounded-lg bg-white"
                >
                  {headers.map(header => <option key={header} value={header}>{header}</option>)}
                </select>
                <select
                  value={rule.operator}
                  onChange={event => updateFilterRule(rule.id, { operator: event.target.value as ResponseFilterOperator })}
                  className="md:col-span-3 px-3 py-2 text-xs border border-[#E2D9CD] rounded-lg bg-white"
                >
                  {OPERATORS.map(operator => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
                </select>
                <input
                  type="text"
                  value={rule.value}
                  disabled={rule.operator === 'not_empty'}
                  onChange={event => updateFilterRule(rule.id, { value: event.target.value })}
                  placeholder="選項文字"
                  className="md:col-span-4 px-3 py-2 text-xs border border-[#E2D9CD] rounded-lg bg-white disabled:bg-stone-50"
                />
                <button
                  type="button"
                  onClick={() => removeFilterRule(rule.id)}
                  className="md:col-span-1 flex items-center justify-center p-2 text-[#D4A373] hover:bg-[#FAF5EE] rounded-lg"
                  title="刪除規則"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-[#F0EBE4] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#F0EBE4] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F5F8F5] text-[#8E9E8C] border border-[#E2D9CD]/50 text-[10px] font-bold">
              <Check className="w-3 h-3" />
              已讀取 {responses.length} 筆
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FAF5EE] text-[#8C745A] border border-[#E8DFD1] text-[10px] font-bold">
              <Filter className="w-3 h-3" />
              篩選後 {filteredResponses.length} 筆
            </span>
          </div>
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A6998A]" />
            <input
              type="text"
              value={searchText}
              onChange={event => setSearchText(event.target.value)}
              placeholder="搜尋任一欄位"
              className="w-full pl-9 pr-3 py-2 text-xs border border-[#E2D9CD] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#8E9E8C]"
            />
          </div>
        </div>

        {headers.length === 0 ? (
          <div className="text-center py-14 px-4 text-[#A6998A]">
            <ExternalLink className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">尚未載入任何回覆</p>
            <p className="text-xs mt-1">貼上 Google 試算表連結後按下讀取回覆。</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[520px]">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-[#FAF8F5] text-[#8C745A] z-10">
                <tr>
                  <th className="text-left px-3 py-2 border-b border-[#F0EBE4] w-14">列</th>
                  {headers.map(header => (
                    <th key={header} className="text-left px-3 py-2 border-b border-[#F0EBE4] min-w-[140px] font-semibold">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredResponses.length === 0 ? (
                  <tr>
                    <td colSpan={headers.length + 1} className="px-3 py-10 text-center text-[#A6998A]">
                      沒有符合目前篩選的回覆。
                    </td>
                  </tr>
                ) : filteredResponses.map(row => (
                  <tr key={row.id} className="odd:bg-white even:bg-[#FAF8F5]/50 hover:bg-[#F5F8F5]">
                    <td className="px-3 py-2 border-b border-[#F0EBE4] font-mono text-[#A6998A]">{row.rowNumber}</td>
                    {headers.map(header => (
                      <td key={header} className="px-3 py-2 border-b border-[#F0EBE4] text-[#5E564E] max-w-[260px] truncate" title={row.values[header] || ''}>
                        {row.values[header] || <span className="text-[#A6998A]/50">-</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
