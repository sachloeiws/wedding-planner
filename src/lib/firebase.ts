import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

let dbInstance: any = null;

export async function getFirebaseDb() {
  // 如果已經初始化過，就直接回傳實例，避免重複連線
  if (dbInstance) return dbInstance;

  try {
    // 🛑 移除原本的 fetch('/firebase-applet-config.json')
    // ✅ 改用 import.meta.env 讀取 Vite 環境變數
    const config = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };

    // 檢查是否有讀取到 API Key (防呆機制)
    if (!config.apiKey) {
      throw new Error('Failed to load Firebase configuration from environment variables.');
    }

    const app = initializeApp(config);
    
    // 初始化 Firestore
    dbInstance = getFirestore(app, 'Wedding Planner Main');
    
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

    // 💡 新增這行：將 data 轉成 JSON 字串再轉回物件，藉此徹底濾除所有 undefined 的欄位
    console.log("準備寫入的資料:", data);
    const sanitizedData = JSON.parse(JSON.stringify(data));

    await setDoc(planDocRef, {
      ...sanitizedData, // 改為寫入清洗過的資料
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
