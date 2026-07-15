import { initializeApp } from 'firebase/app';
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';

let dbInstance: ReturnType<typeof getFirestore> | null = null;

export async function getFirebaseDb() {
  if (dbInstance) return dbInstance;
  const app = initializeApp({
    apiKey: 'AIzaSyDX57hGVw4Ah6XQZQDR-x2aHIuGIHvS3YU',
    authDomain: 'gen-lang-client-0384823757.firebaseapp.com',
    projectId: 'gen-lang-client-0384823757',
    storageBucket: 'gen-lang-client-0384823757.firebasestorage.app',
    messagingSenderId: '264454517889',
    appId: '1:264454517889:web:a4e556433abc37609f8980'
  });
  dbInstance = getFirestore(app, 'default');
  return dbInstance;
}

export interface WeddingPlanData {
  weddingDate: string;
  categories: string[];
  tasks: any[];
  tableAssignments: any;
  calendarEvents: any[];
  responseSourceConfig?: any;
  responseHeaders?: string[];
  formResponses?: any[];
  responseFieldMapping?: any;
  responseFilterRules?: any[];
  updatedAt?: any;
}

export const PLAN_SECTIONS = ['general', 'tasks', 'calendar', 'tables', 'responses'] as const;
export type PlanSection = typeof PLAN_SECTIONS[number];
export type SectionVersions = Record<PlanSection, number>;

export interface EditorIdentity {
  editorId: string;
  displayName: string;
}

export interface SectionSnapshot {
  section: PlanSection;
  payload: Record<string, any>;
  version: number;
  updatedBy: EditorIdentity;
}

export interface LoadedWeddingPlan {
  data: WeddingPlanData;
  versions: SectionVersions;
  updatedBy: Partial<Record<PlanSection, EditorIdentity>>;
  isLegacy: boolean;
}

export class PlanConflictError extends Error {
  conflicts: SectionSnapshot[];

  constructor(conflicts: SectionSnapshot[]) {
    super('PLAN_VERSION_CONFLICT');
    this.name = 'PlanConflictError';
    this.conflicts = conflicts;
  }
}

const normalizeEditor = (value: unknown): EditorIdentity => {
  if (value && typeof value === 'object' && 'editorId' in value) {
    const editor = value as Partial<EditorIdentity>;
    return { editorId: editor.editorId || '', displayName: editor.displayName || '' };
  }
  return { editorId: '', displayName: typeof value === 'string' ? value : '' };
};

export const emptyVersions = (): SectionVersions => ({
  general: 0,
  tasks: 0,
  calendar: 0,
  tables: 0,
  responses: 0
});

export function splitPlanData(data: WeddingPlanData): Record<PlanSection, Record<string, any>> {
  return {
    general: { weddingDate: data.weddingDate, categories: data.categories },
    tasks: { tasks: data.tasks },
    calendar: { calendarEvents: data.calendarEvents },
    tables: { tableAssignments: data.tableAssignments },
    responses: {
      responseSourceConfig: data.responseSourceConfig || { sheetUrl: '', spreadsheetId: '', range: '' },
      responseHeaders: data.responseHeaders || [],
      formResponses: data.formResponses || [],
      responseFieldMapping: data.responseFieldMapping || { nameField: '' },
      responseFilterRules: data.responseFilterRules || []
    }
  };
}

function combineSections(sections: Partial<Record<PlanSection, Record<string, any>>>): WeddingPlanData {
  return {
    weddingDate: sections.general?.weddingDate || '',
    categories: sections.general?.categories || [],
    tasks: sections.tasks?.tasks || [],
    calendarEvents: sections.calendar?.calendarEvents || [],
    tableAssignments: sections.tables?.tableAssignments || { table_size_limit: 12, tables: [] },
    responseSourceConfig: sections.responses?.responseSourceConfig || { sheetUrl: '', spreadsheetId: '', range: '' },
    responseHeaders: sections.responses?.responseHeaders || [],
    formResponses: sections.responses?.formResponses || [],
    responseFieldMapping: sections.responses?.responseFieldMapping || { nameField: '' },
    responseFilterRules: sections.responses?.responseFilterRules || []
  };
}

export async function loadWeddingPlan(planId: string): Promise<LoadedWeddingPlan | null> {
  const db = await getFirebaseDb();
  const rootRef = doc(db, 'wedding_plans', planId);
  const sectionRefs = PLAN_SECTIONS.map(section => doc(db, 'wedding_plans', planId, 'sections', section));
  const [rootSnapshot, ...sectionSnapshots] = await Promise.all([
    getDoc(rootRef),
    ...sectionRefs.map(reference => getDoc(reference))
  ]);

  const hasSections = sectionSnapshots.some(snapshot => snapshot.exists());
  if (!hasSections) {
    if (!rootSnapshot.exists()) return null;
    const legacy = rootSnapshot.data() as WeddingPlanData;
    return { data: legacy, versions: emptyVersions(), updatedBy: {}, isLegacy: true };
  }

  const versions = emptyVersions();
  const updatedBy: Partial<Record<PlanSection, EditorIdentity>> = {};
  const payloads: Partial<Record<PlanSection, Record<string, any>>> = {};
  sectionSnapshots.forEach((snapshot, index) => {
    if (!snapshot.exists()) return;
    const section = PLAN_SECTIONS[index];
    const sectionData = snapshot.data();
    payloads[section] = sectionData.payload || {};
    versions[section] = sectionData.version || 0;
    updatedBy[section] = normalizeEditor(sectionData.updatedBy);
  });

  return { data: combineSections(payloads), versions, updatedBy, isLegacy: false };
}

export async function saveWeddingPlan(
  planId: string,
  data: WeddingPlanData,
  updatedBy: EditorIdentity,
  baseVersions: SectionVersions,
  sections: PlanSection[] = [...PLAN_SECTIONS],
  force = false
) {
  const db = await getFirebaseDb();
  const payloads = splitPlanData(data);
  const nextVersions = { ...baseVersions };

  await runTransaction(db, async transaction => {
    const references = sections.map(section => ({
      section,
      reference: doc(db, 'wedding_plans', planId, 'sections', section)
    }));
    const snapshots = await Promise.all(references.map(item => transaction.get(item.reference)));
    const conflicts: SectionSnapshot[] = [];

    snapshots.forEach((snapshot, index) => {
      const section = references[index].section;
      const current = snapshot.exists() ? snapshot.data() : {};
      const currentVersion = current.version || 0;
      if (!force && currentVersion !== baseVersions[section]) {
        conflicts.push({
          section,
          payload: current.payload || {},
          version: currentVersion,
          updatedBy: normalizeEditor(current.updatedBy)
        });
      }
    });

    if (conflicts.length) throw new PlanConflictError(conflicts);

    snapshots.forEach((snapshot, index) => {
      const { section, reference } = references[index];
      const currentVersion = snapshot.exists() ? snapshot.data().version || 0 : 0;
      const version = currentVersion + 1;
      nextVersions[section] = version;
      transaction.set(reference, {
        payload: JSON.parse(JSON.stringify(payloads[section])),
        version,
        updatedBy,
        updatedAt: serverTimestamp()
      });
    });

    transaction.set(doc(db, 'wedding_plans', planId), {
      schemaVersion: 2,
      updatedBy,
      updatedAt: serverTimestamp()
    }, { merge: true });
  });

  return nextVersions;
}

export function subscribeWeddingPlanSections(
  planId: string,
  callback: (snapshot: SectionSnapshot) => void,
  onError?: (error: Error) => void
) {
  const unsubscribers: Array<() => void> = [];
  let disposed = false;

  getFirebaseDb().then(db => {
    if (disposed) return;
    PLAN_SECTIONS.forEach(section => {
      const unsubscribe = onSnapshot(
        doc(db, 'wedding_plans', planId, 'sections', section),
        { includeMetadataChanges: true },
        snapshot => {
          if (!snapshot.exists() || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
          const data = snapshot.data();
          callback({
            section,
            payload: data.payload || {},
            version: data.version || 0,
            updatedBy: normalizeEditor(data.updatedBy)
          });
        },
        error => onError?.(error)
      );
      unsubscribers.push(unsubscribe);
    });
  }).catch(error => onError?.(error));

  return () => {
    disposed = true;
    unsubscribers.forEach(unsubscribe => unsubscribe());
  };
}
