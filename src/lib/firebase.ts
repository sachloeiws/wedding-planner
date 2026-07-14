import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

let dbInstance: any = null;

export async function getFirebaseDb() {
  if (dbInstance) return dbInstance;

  try {
    const response = await fetch('/firebase-applet-config.json');
    if (!response.ok) {
      throw new Error('Failed to load Firebase configuration');
    }
    const config = await response.json();
    const app = initializeApp(config);
    
    // Check if a specific firestore database ID is set
    if (config.firestoreDatabaseId) {
      dbInstance = getFirestore(app, config.firestoreDatabaseId);
    } else {
      dbInstance = getFirestore(app);
    }
    return dbInstance;
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
}

// Interface for what we save in a wedding plan doc
export interface WeddingPlanData {
  weddingDate: string;
  categories: string[];
  tasks: any[];
  tableAssignments: any;
  calendarEvents: any[];
  updatedAt?: any;
}

// Helpers for loading and saving
export async function saveWeddingPlan(planId: string, data: WeddingPlanData) {
  try {
    const db = await getFirebaseDb();
    const planDocRef = doc(db, "wedding_plans", planId);
    await setDoc(planDocRef, {
      ...data,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error(`Error saving wedding plan ${planId}:`, error);
    throw error;
  }
}

export async function loadWeddingPlan(planId: string): Promise<WeddingPlanData | null> {
  try {
    const db = await getFirebaseDb();
    const planDocRef = doc(db, "wedding_plans", planId);
    const docSnap = await getDoc(planDocRef);
    if (docSnap.exists()) {
      return docSnap.data() as WeddingPlanData;
    }
    return null;
  } catch (error) {
    console.error(`Error loading wedding plan ${planId}:`, error);
    throw error;
  }
}

export function subscribeWeddingPlan(planId: string, callback: (data: WeddingPlanData) => void, onError?: (err: Error) => void) {
  let unsubscribe: (() => void) | null = null;
  
  getFirebaseDb().then(db => {
    const planDocRef = doc(db, "wedding_plans", planId);
    unsubscribe = onSnapshot(planDocRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as WeddingPlanData);
      }
    }, (error) => {
      console.error(`Error subscribing to wedding plan ${planId}:`, error);
      if (onError) onError(error);
    });
  }).catch(err => {
    console.error("Failed to subscribe due to Firebase init error:", err);
    if (onError) onError(err);
  });

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
}
