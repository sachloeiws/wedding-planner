import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, getDocFromServer, setDoc, onSnapshot } from "firebase/firestore";

let dbInstance: any = null;

export async function getFirebaseDb() {
  // 如果已經初始化過，就直接回傳實例，避免重複連線
  if (dbInstance) return dbInstance;

  try {
    // 🛑 移除原本的 fetch('/firebase-applet-config.json')
    // ✅ 改用 import.meta.env 讀取 Vite 環境變數
    const config = {
      apiKey: "AIzaSyDX57hGVw4Ah6XQZQDR-x2aHIuGIHvS3YU",
      authDomain: "gen-lang-client-0384823757.firebaseapp.com",
      projectId: "gen-lang-client-0384823757",
      storageBucket: "gen-lang-client-0384823757.firebasestorage.app",
      messagingSenderId: "264454517889",
      appId: "1:264454517889:web:a4e556433abc37609f8980"
    };
    console.log("🔍 Firebase Config 檢查:", {
      ...config,
      firestoreDatabaseId: "default"
    });

    // 檢查是否有讀取到 API Key (防呆機制)
    if (!config.apiKey) {
      throw new Error('Failed to load Firebase configuration from environment variables.');
    }

    const app = initializeApp(config);
    
    // Firebase Console 顯示的 Database ID 是 "default"，需明確傳入。
    dbInstance = getFirestore(app, "default");
    
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
  responseSourceConfig?: any;
  responseHeaders?: string[];
  formResponses?: any[];
  responseFieldMapping?: any;
  responseFilterRules?: any[];
  updatedAt?: any;
}

// Helpers for loading and saving
const PLAN_DOCUMENT_ID = "wedding_plan";

export async function saveWeddingPlan(collectionName: string, data: WeddingPlanData) {
  try {
    const db = await getFirebaseDb();
    const planDocRef = doc(db, collectionName, PLAN_DOCUMENT_ID);
    const sanitizedData = JSON.parse(JSON.stringify(data));

    console.log("[1] 準備發送寫入請求到 Firestore...");
    console.log(sanitizedData);

    // 真正的寫入動作在這裡
    await setDoc(planDocRef, {
      ...sanitizedData,
      updatedAt: new Date().toISOString()
    });
    
    console.log("[2] Firestore 回傳成功！資料確定已寫入！");
    return true;

  } catch (error) {
    console.error("[3] 寫入時遭到 Firebase 拒絕或發生錯誤：", error);
    throw error;
  }
}

export async function loadWeddingPlan(collectionName: string): Promise<WeddingPlanData | null> {
  try {
    const db = await getFirebaseDb();
    const planDocRef = doc(db, collectionName, PLAN_DOCUMENT_ID);
    const docSnap = await getDoc(planDocRef);
    if (docSnap.exists()) {
      return docSnap.data() as WeddingPlanData;
    }
    return null;
  } catch (error) {
    console.error(`Error loading wedding plan ${collectionName}:`, error);
    throw error;
  }
}

export function subscribeWeddingPlan(collectionName: string, callback: (data: WeddingPlanData | null) => void, onError?: (err: Error) => void) {
  let unsubscribe: (() => void) | null = null;
  
  getFirebaseDb().then(async db => {
    const planDocRef = doc(db, collectionName, PLAN_DOCUMENT_ID);
    const initialSnap = await getDocFromServer(planDocRef);

    if (initialSnap.exists()) {
      callback(initialSnap.data() as WeddingPlanData);
    } else {
      callback(null);
    }

    unsubscribe = onSnapshot(planDocRef, { includeMetadataChanges: true }, (docSnap) => {
      if (docSnap.metadata.fromCache) {
        return;
      }

      if (docSnap.exists()) {
        callback(docSnap.data() as WeddingPlanData);
      } else {
        callback(null);
      }
    }, (error) => {
      console.error(`Error subscribing to wedding plan ${collectionName}:`, error);
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
