import { FormResponseRow } from '../types';

const CHILD_KEYWORDS = /兒童|孩童|小孩|小朋友|幼兒|child(?:ren)?|kid(?:s)?/i;
const CHILD_COUNT_AFTER = /(?:兒童|孩童|小孩|小朋友|幼兒|child(?:ren)?|kid(?:s)?)[^0-9]{0,12}(\d+)/i;
const CHILD_COUNT_BEFORE = /(\d+)[^0-9]{0,12}(?:位|名|個|人)?[^0-9]{0,6}(?:兒童|孩童|小孩|小朋友|幼兒|child(?:ren)?|kid(?:s)?)/i;

function parseCount(value: string, fallback = 0) {
  const match = value.replace(/[,，]/g, '').match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : fallback;
}

function parseChildCount(header: string, value: string) {
  if (CHILD_KEYWORDS.test(header)) return parseCount(value);
  const match = value.match(CHILD_COUNT_AFTER) || value.match(CHILD_COUNT_BEFORE);
  return match ? Number.parseInt(match[1], 10) : 0;
}

export function getResponseGuestCounts(row: FormResponseRow, countField?: string) {
  const adultCount = countField ? Math.max(1, parseCount(row.values[countField] || '', 1)) : 1;
  const childCount = Object.entries(row.values).reduce((total, [header, value]) => {
    if (header === countField) return total;
    return total + parseChildCount(header, value);
  }, 0);
  return { adultCount, childCount, totalCount: adultCount + childCount };
}

export function getResponsePartySize(row: FormResponseRow, countField?: string) {
  return getResponseGuestCounts(row, countField).totalCount;
}
