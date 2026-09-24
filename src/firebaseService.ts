import { initializeApp, getApps, getApp, deleteApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import defaultAppletConfig from '../firebase-applet-config.json';
import { StudentScore, SystemConfig, ScoreThresholds, FirebaseCustomConfig } from './types';
import { classifyScore, DEFAULT_THRESHOLDS } from './utils/scoreClassifier';

export const LOCAL_STORAGE_FIREBASE_KEY = 'eduscore_firebase_config_v1';
export const STUDENT_SCORES_COLLECTION = 'student_scores';
const CONFIG_COLLECTION = 'settings';
const CONFIG_DOC_ID = 'system_config';

export interface FirestoreQuotaInfo {
  isExceeded: boolean;
  errorType: 'write' | 'read' | 'general' | null;
  metricName?: string;
  message?: string;
  consoleUrl: string;
}

const DEFAULT_CONSOLE_URL = `https://console.firebase.google.com/project/${defaultAppletConfig.projectId}/firestore/databases/${defaultAppletConfig.firestoreDatabaseId || '(default)'}/data?openUpgradeDialog=true`;

let globalQuotaInfo: FirestoreQuotaInfo = {
  isExceeded: false,
  errorType: null,
  consoleUrl: DEFAULT_CONSOLE_URL,
};

// Check if quota was previously flagged in this browser session
try {
  if (typeof window !== 'undefined' && sessionStorage.getItem('eduscore_firestore_quota_exceeded') === 'true') {
    globalQuotaInfo.isExceeded = true;
    globalQuotaInfo.errorType = 'write';
    globalQuotaInfo.metricName = 'Free daily write units per project';
    globalQuotaInfo.message = 'Hạn mức ghi miễn phí trong ngày (Free daily write units) của Cloud Firestore đã đạt giới hạn.';
  }
} catch {
  // ignore
}

const quotaListeners: Array<(info: FirestoreQuotaInfo) => void> = [];

export function getFirestoreQuotaInfo(): FirestoreQuotaInfo {
  return { ...globalQuotaInfo };
}

export function isFirestoreQuotaExceeded(): boolean {
  return globalQuotaInfo.isExceeded;
}

export function subscribeToQuotaStatus(listener: (info: FirestoreQuotaInfo) => void): () => void {
  quotaListeners.push(listener);
  listener(getFirestoreQuotaInfo());
  return () => {
    const idx = quotaListeners.indexOf(listener);
    if (idx !== -1) quotaListeners.splice(idx, 1);
  };
}

export function isQuotaExceededError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err || '');
  const code = String(err.code || '');
  return (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('quota metric') ||
    msg.includes('Free daily write units') ||
    msg.includes('Free daily read units')
  );
}

export function recordQuotaExceeded(err: any): void {
  const msg = String(err?.message || err || '');
  const isWrite = msg.includes('write') || msg.includes('Free daily write units');
  const isRead = msg.includes('read') || msg.includes('Free daily read units');

  globalQuotaInfo = {
    isExceeded: true,
    errorType: isWrite ? 'write' : isRead ? 'read' : 'general',
    metricName: isWrite
      ? 'Free daily write units per project (free tier database)'
      : isRead
      ? 'Free daily read units per project (free tier database)'
      : 'Firestore Quota Limit',
    message: msg || 'Quota limit exceeded for Cloud Firestore',
    consoleUrl: DEFAULT_CONSOLE_URL,
  };

  try {
    sessionStorage.setItem('eduscore_firestore_quota_exceeded', 'true');
  } catch {
    // ignore
  }

  quotaListeners.forEach((fn) => {
    try {
      fn(getFirestoreQuotaInfo());
    } catch {
      // ignore
    }
  });
}

/**
 * Kiểm tra xem người dùng đã lưu cấu hình Firebase trong localStorage chưa
 */
export function hasSavedFirebaseConfig(): boolean {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_FIREBASE_KEY);
    if (!saved) return false;
    const parsed = JSON.parse(saved);
    return Boolean(parsed && parsed.projectId && parsed.apiKey);
  } catch {
    return false;
  }
}

/**
 * Lấy cấu hình Firebase đang hoạt động (từ LocalStorage hoặc fallback sang file cấu hình AI Studio)
 */
export function getActiveFirebaseConfig(): FirebaseCustomConfig {
  let cfg: FirebaseCustomConfig = {
    projectId: defaultAppletConfig.projectId,
    appId: defaultAppletConfig.appId,
    apiKey: defaultAppletConfig.apiKey,
    authDomain: defaultAppletConfig.authDomain,
    firestoreDatabaseId: defaultAppletConfig.firestoreDatabaseId || '',
    storageBucket: defaultAppletConfig.storageBucket,
    messagingSenderId: defaultAppletConfig.messagingSenderId,
    measurementId: defaultAppletConfig.measurementId || '',
  };

  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_FIREBASE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.projectId && parsed.apiKey) {
        cfg = {
          ...cfg,
          ...parsed,
        };
      }
    }
  } catch (e) {
    console.warn('Không thể đọc cấu hình Firebase từ localStorage:', e);
  }

  // Tự động sửa lỗi gõ nhầm chữ O hoa (9O4) thành số 0 (904) trong Web API Key
  if (cfg.apiKey && cfg.apiKey.includes('9O4ke8psCVTHqloA')) {
    cfg.apiKey = cfg.apiKey.replace('9O4ke8psCVTHqloA', '904ke8psCVTHqloA');
    try {
      localStorage.setItem(LOCAL_STORAGE_FIREBASE_KEY, JSON.stringify(cfg));
    } catch {
      // ignore
    }
  }

  return cfg;
}

let currentApp: FirebaseApp;
export let db: Firestore;

const configChangeListeners: Array<(newDb: Firestore, config: FirebaseCustomConfig) => void> = [];

/**
 * Đăng ký lắng nghe sự kiện thay đổi cấu hình Firebase để cập nhật lại listener snapshot & kết nối
 */
export function subscribeToFirebaseConfigChange(
  listener: (newDb: Firestore, config: FirebaseCustomConfig) => void
): () => void {
  configChangeListeners.push(listener);
  return () => {
    const idx = configChangeListeners.indexOf(listener);
    if (idx !== -1) configChangeListeners.splice(idx, 1);
  };
}

function notifyConfigChanged(newDb: Firestore, cfg: FirebaseCustomConfig) {
  configChangeListeners.forEach((fn) => {
    try {
      fn(newDb, cfg);
    } catch (e) {
      console.warn('Lỗi khi gọi config change listener:', e);
    }
  });
}

function getFirestoreInstance(app: FirebaseApp, customDatabaseId?: string): Firestore {
  const cleanDbId = (customDatabaseId || '').trim();
  if (cleanDbId && cleanDbId !== '(default)') {
    return getFirestore(app, cleanDbId);
  }
  return getFirestore(app);
}

function initFirebaseSync(): Firestore {
  const cfg = getActiveFirebaseConfig();
  if (getApps().length > 0) {
    currentApp = getApp();
  } else {
    currentApp = initializeApp(cfg);
  }

  db = getFirestoreInstance(currentApp, cfg.firestoreDatabaseId);

  return db;
}

// Khởi tạo đồng bộ lần đầu
initFirebaseSync();

/**
 * Khởi tạo lại Firebase app và Firestore với cấu hình mới nhất (Xóa app cũ trước khi khởi tạo lại)
 */
export async function reinitializeFirebase(customConfig?: FirebaseCustomConfig): Promise<Firestore> {
  const cfg = customConfig || getActiveFirebaseConfig();

  // 1. Xóa và giải phóng tất cả Firebase App cũ đang chạy để tránh giữ kết nối cũ
  const existingApps = getApps();
  for (const app of existingApps) {
    try {
      await deleteApp(app);
    } catch (err) {
      console.warn('Lỗi khi hủy app Firebase cũ:', err);
    }
  }

  // 2. Khởi tạo app mới hoàn toàn với cấu hình vừa thay đổi
  currentApp = initializeApp(cfg);
  db = getFirestoreInstance(currentApp, cfg.firestoreDatabaseId);

  // 3. Đặt lại thông tin quota limit của phiên
  globalQuotaInfo = {
    isExceeded: false,
    errorType: null,
    consoleUrl: `https://console.firebase.google.com/project/${cfg.projectId}/firestore/databases/${cfg.firestoreDatabaseId || '(default)'}/data?openUpgradeDialog=true`,
  };
  try {
    sessionStorage.removeItem('eduscore_firestore_quota_exceeded');
  } catch {
    // ignore
  }

  // 4. Phát tín hiệu tới toàn bộ ứng dụng để re-subscribe snapshot và tải dữ liệu từ database mới
  notifyConfigChanged(db, cfg);

  return db;
}

/**
 * Lưu cấu hình Firebase tùy chỉnh vào LocalStorage và kết nối thật ngay lập tức
 */
export async function saveCustomFirebaseConfig(config: FirebaseCustomConfig): Promise<Firestore> {
  localStorage.setItem(LOCAL_STORAGE_FIREBASE_KEY, JSON.stringify(config));
  // Khởi tạo lại Firebase app thật với cấu hình mới
  const newDb = await reinitializeFirebase(config);
  return newDb;
}

/**
 * Khôi phục cấu hình Firebase mặc định của AI Studio và kết nối lại
 */
export async function resetFirebaseConfigToDefault(): Promise<Firestore> {
  localStorage.removeItem(LOCAL_STORAGE_FIREBASE_KEY);
  const newDb = await reinitializeFirebase();
  return newDb;
}

/**
 * Kiểm tra kết nối thực tế tới Cloud Firestore (Real Connection Healthcheck)
 */
export async function testFirestoreConnection(): Promise<{ success: boolean; message: string; quotaExceeded?: boolean; timestamp?: string }> {
  if (globalQuotaInfo.isExceeded) {
    return {
      success: false,
      quotaExceeded: true,
      message: 'Hạn mức ghi miễn phí trong ngày (Free daily write units) của Cloud Firestore đã đạt giới hạn (20.000 lượt ghi/ngày).',
      timestamp: new Date().toLocaleTimeString('vi-VN'),
    };
  }

  try {
    const currentDb = db;
    // Thử truy vấn 1 bản ghi bất kỳ từ collection student_scores với limit(1) để tiết kiệm quota read
    const snap = await getDocs(query(collection(currentDb, STUDENT_SCORES_COLLECTION), limit(1)));
    return {
      success: true,
      message: `Kết nối thành công! Đã kết nối Firestore (${snap.size > 0 ? 'Có dữ liệu' : 'Sẵn sàng'})`,
      timestamp: new Date().toLocaleTimeString('vi-VN'),
    };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      recordQuotaExceeded(err);
      return {
        success: false,
        quotaExceeded: true,
        message: 'Hạn mức miễn phí trong ngày của Cloud Firestore đã đạt giới hạn.',
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      };
    }
    console.error('Lỗi kiểm tra kết nối Firestore:', err);
    return {
      success: false,
      message: `Không thể kết nối Firestore: ${err?.message || 'Vui lòng kiểm tra apiKey/projectId'}`,
    };
  }
}

/**
 * Chuẩn hóa tài liệu từ Firestore sang đối tượng StudentScore với đầy đủ trường dữ liệu & alias
 */
function normalizeFirestoreDoc(id: string, data: any, thresholds: ScoreThresholds = DEFAULT_THRESHOLDS, index = 0): StudentScore {
  const rawScore = data.score !== undefined && data.score !== null && data.score !== ''
    ? Number(data.score)
    : data.diem !== undefined && data.diem !== null && data.diem !== ''
    ? Number(data.diem)
    : null;

  const subject = String(data.subject || data.monHoc || 'Toán').trim();
  const studentId = String(data.studentId || data.soBD || `HS${String(index + 1).padStart(4, '0')}`).trim();
  const fullName = String(data.fullName || data.hoTen || `Học sinh ${studentId}`).trim();
  const className = String(data.class || data.lop || '10B1').trim();
  const dob = String(data.dob || data.ngaySinh || '').trim();
  const ethnicity = String(data.ethnicity || data.danToc || 'Kinh').trim();
  const grade = String(data.grade || data.khoi || '10').trim();
  const teacherName = String(data.teacherName || data.giaoVien || 'Chưa phân công').trim();
  const rank = classifyScore(rawScore, thresholds);

  // Năm học, Học kỳ, Đợt lấy điểm
  const academicYear = String(data.academicYear || data.namHoc || '2025-2026').trim();
  const semester = String(data.semester || data.hocKy || 'HK1').trim();
  let period = String(data.period || data.dotDiem || 'GKI').trim();

  // Chuẩn hóa tên đợt cho HK2: GKII và CKII trên toàn hệ thống và Firebase
  if (semester === 'HK2') {
    if (period === 'GKI' || period === 'GKI-HK2' || period === 'GK1') {
      period = 'GKII';
    } else if (period === 'CKI' || period === 'CKI-HK2' || period === 'CK1') {
      period = 'CKII';
    }
  }

  return {
    id,
    subject,
    studentId,
    fullName,
    class: className,
    dob,
    ethnicity,
    grade,
    score: rawScore,
    teacherName,
    rank,

    academicYear,
    semester,
    period,

    // Aliases tiếng Việt
    tt: data.tt ?? (index + 1),
    soBD: studentId,
    hoTen: fullName,
    lop: className,
    ngaySinh: dob,
    danToc: ethnicity,
    khoi: grade.startsWith('Khối') ? grade : `Khối ${grade}`,
    diem: rawScore,
    giaoVien: teacherName,
    monHoc: subject,
    xepLoai: rank,
    namHoc: academicYear,
    hocKy: semester,
    dotDiem: period,
    ghiChu: data.ghiChu || '',
    updatedAt: data.updatedAt,
  };
}

/**
 * Lắng nghe toàn bộ danh sách điểm học sinh theo thời gian thực (Real-time Snapshot) từ Collection `student_scores`
 */
export function subscribeToStudents(
  thresholds: ScoreThresholds | (() => ScoreThresholds) = DEFAULT_THRESHOLDS,
  callback: (students: StudentScore[]) => void,
  onError?: (error: Error) => void
) {
  const scoresRef = collection(db, STUDENT_SCORES_COLLECTION);
  const q = query(scoresRef);

  return onSnapshot(
    q,
    (snapshot) => {
      const activeThresholds = typeof thresholds === 'function' ? thresholds() : thresholds;
      const list: StudentScore[] = [];
      let index = 0;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push(normalizeFirestoreDoc(docSnap.id, data, activeThresholds, index++));
      });

      // Sắp xếp mặc định theo Môn học, Lớp và Mã học sinh
      list.sort((a, b) => {
        if (a.subject !== b.subject) return a.subject.localeCompare(b.subject, 'vi');
        if (a.class !== b.class) return a.class.localeCompare(b.class, 'vi');
        return a.studentId.localeCompare(b.studentId, 'vi');
      });

      callback(list);
    },
    (err: any) => {
      if (isQuotaExceededError(err)) {
        recordQuotaExceeded(err);
      }
      console.warn('Firebase snapshot warning/error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Đọc dữ liệu thực 1 lần (One-time Fetch) từ Collection `student_scores` trên Firestore
 */
export async function fetchStudentsFromFirestoreOnce(
  thresholds: ScoreThresholds = DEFAULT_THRESHOLDS
): Promise<StudentScore[]> {
  try {
    const snap = await getDocs(collection(db, STUDENT_SCORES_COLLECTION));
    const list: StudentScore[] = [];
    let index = 0;
    snap.forEach((docSnap) => {
      list.push(normalizeFirestoreDoc(docSnap.id, docSnap.data(), thresholds, index++));
    });

    list.sort((a, b) => {
      if (a.subject !== b.subject) return a.subject.localeCompare(b.subject, 'vi');
      if (a.class !== b.class) return a.class.localeCompare(b.class, 'vi');
      return a.studentId.localeCompare(b.studentId, 'vi');
    });

    return list;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      recordQuotaExceeded(err);
    }
    console.error('Lỗi khi fetch dữ liệu từ Firestore:', err);
    throw new Error(`Không thể tải dữ liệu từ Firestore: ${err?.message || err}`);
  }
}

/**
 * Tạo ID kết hợp (Composite Key) chuẩn xác cho điểm học sinh:
 * [studentId + subject + academicYear + semester + period]
 * Đảm bảo upload lại cùng đợt điểm sẽ ghi đè / cập nhật (Merge) mà không bị trùng lặp.
 */
export function buildCompositeScoreId(
  studentId: string,
  subject: string,
  academicYear: string,
  semester: string,
  period: string
): string {
  const normYear = (academicYear || '2025-2026').replace(/\s+/g, '');
  const normSem = (semester || 'HK1').replace(/\s+/g, '');
  const normPer = (period || 'GKI').replace(/\s+/g, '');
  const normSub = (subject || 'Toan').replace(/\s+/g, '');
  const normId = (studentId || 'HS').replace(/\s+/g, '');

  return `${normYear}_${normSem}_${normPer}_${normSub}_${normId}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();
}

/**
 * Lưu danh sách điểm học sinh lên Firestore (Collection `student_scores`) sử dụng WriteBatch (<=450 bản ghi/batch)
 */
export async function saveStudentsToFirestore(
  students: StudentScore[],
  replaceExisting: boolean = false,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; count: number; distinctSubjects: number; quotaExceeded?: boolean; message?: string }> {
  try {
    if (students.length === 0) {
      return { success: true, count: 0, distinctSubjects: 0, message: 'Không có dữ liệu để lưu' };
    }

    if (isFirestoreQuotaExceeded()) {
      return {
        success: false,
        quotaExceeded: true,
        count: students.length,
        distinctSubjects: new Set(students.map((s) => s.subject || s.monHoc || '')).size,
        message: 'Hạn mức ghi miễn phí trong ngày của Cloud Firestore (20.000 lượt ghi/ngày) đã đạt giới hạn. Dữ liệu đã được lưu trữ an toàn trong LocalStorage.',
      };
    }

    const currentDb = db;

    // Nếu chọn xóa sạch dữ liệu cũ trước khi nạp
    if (replaceExisting) {
      try {
        const existingSnap = await getDocs(collection(currentDb, STUDENT_SCORES_COLLECTION));
        let delBatch = writeBatch(currentDb);
        let delCount = 0;

        for (const docSnap of existingSnap.docs) {
          delBatch.delete(docSnap.ref);
          delCount++;
          if (delCount % 450 === 0) {
            await delBatch.commit();
            delBatch = writeBatch(currentDb);
          }
        }
        if (delCount % 450 !== 0) {
          await delBatch.commit();
        }
      } catch (delErr: any) {
        if (isQuotaExceededError(delErr)) {
          recordQuotaExceeded(delErr);
          return {
            success: false,
            quotaExceeded: true,
            count: students.length,
            distinctSubjects: new Set(students.map((s) => s.subject || s.monHoc || '')).size,
            message: 'Đã đạt hạn mức ghi của Cloud Firestore trong ngày.',
          };
        }
        console.warn('Lỗi khi xóa dữ liệu cũ:', delErr);
      }
    }

    // Đẩy dữ liệu mới bằng Batch Write theo từng nhóm 450 bản ghi
    let batch = writeBatch(currentDb);
    let count = 0;
    const distinctSubjectsSet = new Set<string>();

    for (const student of students) {
      const subject = student.subject || student.monHoc || 'Toán';
      const studentId = student.studentId || student.soBD || 'HS';
      const className = student.class || student.lop || 'Lop';
      const academicYear = student.academicYear || student.namHoc || '2025-2026';
      const semester = student.semester || student.hocKy || 'HK1';
      let period = student.period || student.dotDiem || 'GKI';

      // Chuẩn hóa tên đợt HK2: GKII và CKII
      if (semester === 'HK2') {
        if (period === 'GKI' || period === 'GKI-HK2' || period === 'GK1') {
          period = 'GKII';
        } else if (period === 'CKI' || period === 'CKI-HK2' || period === 'CK1') {
          period = 'CKII';
        }
      }

      distinctSubjectsSet.add(subject);

      // Tạo ID duy nhất theo composite key: [studentId + subject + academicYear + semester + period]
      const safeId = buildCompositeScoreId(studentId, subject, academicYear, semester, period);
      const docRef = doc(currentDb, STUDENT_SCORES_COLLECTION, safeId);

      const scoreVal = student.score !== undefined ? student.score : (student.diem !== undefined ? student.diem : null);
      const rankVal = student.rank || student.xepLoai || classifyScore(scoreVal, DEFAULT_THRESHOLDS);

      batch.set(docRef, {
        subject: subject,
        studentId: studentId,
        fullName: student.fullName || student.hoTen || '',
        class: className,
        dob: student.dob || student.ngaySinh || '',
        ethnicity: student.ethnicity || student.danToc || 'Kinh',
        grade: student.grade || student.khoi || '10',
        score: scoreVal,
        teacherName: student.teacherName || student.giaoVien || '',
        rank: rankVal,

        // Năm học, Học kỳ, Đợt lấy điểm
        academicYear: academicYear,
        semester: semester,
        period: period,

        // Alias fields
        tt: student.tt || (count + 1),
        soBD: studentId,
        hoTen: student.fullName || student.hoTen || '',
        lop: className,
        ngaySinh: student.dob || student.ngaySinh || '',
        danToc: student.ethnicity || student.danToc || 'Kinh',
        khoi: student.grade || student.khoi || '10',
        diem: scoreVal,
        giaoVien: student.teacherName || student.giaoVien || '',
        monHoc: subject,
        xepLoai: rankVal,
        namHoc: academicYear,
        hocKy: semester,
        dotDiem: period,
        ghiChu: student.ghiChu || '',
        updatedAt: Timestamp.now(),
      }, { merge: true });

      count++;
      if (count % 450 === 0) {
        try {
          await batch.commit();
        } catch (bErr: any) {
          if (isQuotaExceededError(bErr)) {
            recordQuotaExceeded(bErr);
            return {
              success: false,
              quotaExceeded: true,
              count,
              distinctSubjects: distinctSubjectsSet.size,
              message: 'Hạn mức ghi Cloud Firestore trong ngày đã hết. Dữ liệu đã được lưu trữ an toàn trong máy.',
            };
          }
          throw bErr;
        }
        if (onProgress) onProgress(count, students.length);
        batch = writeBatch(currentDb);
      }
    }

    if (count % 450 !== 0) {
      try {
        await batch.commit();
      } catch (bErr: any) {
        if (isQuotaExceededError(bErr)) {
          recordQuotaExceeded(bErr);
          return {
            success: false,
            quotaExceeded: true,
            count,
            distinctSubjects: distinctSubjectsSet.size,
            message: 'Hạn mức ghi Cloud Firestore trong ngày đã hết. Dữ liệu đã được lưu trữ an toàn trong máy.',
          };
        }
        throw bErr;
      }
      if (onProgress) onProgress(count, students.length);
    }

    return {
      success: true,
      count: students.length,
      distinctSubjects: distinctSubjectsSet.size,
    };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      recordQuotaExceeded(err);
      return {
        success: false,
        quotaExceeded: true,
        count: 0,
        distinctSubjects: 0,
        message: 'Hạn mức ghi Cloud Firestore trong ngày đã đạt giới hạn (20.000 lượt ghi/ngày).',
      };
    }
    console.error('Lỗi khi lưu dữ liệu lên Firestore:', err);
    throw new Error(`Không thể lưu vào Firestore: ${err?.message || err}`);
  }
}

/**
 * Cập nhật hoặc thêm mới 1 học sinh đơn lẻ lên Firestore
 */
export async function saveSingleStudentToFirestore(student: StudentScore): Promise<boolean> {
  if (isFirestoreQuotaExceeded()) return false;

  const subject = student.subject || student.monHoc || 'Toán';
  const studentId = student.studentId || student.soBD || 'HS';
  const className = student.class || student.lop || 'Lop';
  const academicYear = student.academicYear || student.namHoc || '2025-2026';
  const semester = student.semester || student.hocKy || 'HK1';
  let period = student.period || student.dotDiem || 'GKI';

  // Chuẩn hóa tên đợt HK2: GKII và CKII
  if (semester === 'HK2') {
    if (period === 'GKI' || period === 'GKI-HK2' || period === 'GK1') {
      period = 'GKII';
    } else if (period === 'CKI' || period === 'CKI-HK2' || period === 'CK1') {
      period = 'CKII';
    }
  }

  const safeId = buildCompositeScoreId(studentId, subject, academicYear, semester, period);
  const docRef = doc(db, STUDENT_SCORES_COLLECTION, safeId);
  const scoreVal = student.score !== undefined ? student.score : (student.diem !== undefined ? student.diem : null);
  const rankVal = student.rank || student.xepLoai || classifyScore(scoreVal, DEFAULT_THRESHOLDS);

  try {
    await setDoc(docRef, {
      subject,
      studentId,
      fullName: student.fullName || student.hoTen || '',
      class: className,
      dob: student.dob || student.ngaySinh || '',
      ethnicity: student.ethnicity || student.danToc || 'Kinh',
      grade: student.grade || student.khoi || '10',
      score: scoreVal,
      teacherName: student.teacherName || student.giaoVien || '',
      rank: rankVal,
      academicYear,
      semester,
      period,
      tt: student.tt ?? 1,
      soBD: studentId,
      hoTen: student.fullName || student.hoTen || '',
      lop: className,
      ngaySinh: student.dob || student.ngaySinh || '',
      danToc: student.ethnicity || student.danToc || 'Kinh',
      khoi: student.grade || student.khoi || '10',
      diem: scoreVal,
      giaoVien: student.teacherName || student.giaoVien || '',
      monHoc: subject,
      xepLoai: rankVal,
      namHoc: academicYear,
      hocKy: semester,
      dotDiem: period,
      ghiChu: student.ghiChu || '',
      updatedAt: Timestamp.now(),
    }, { merge: true });
    return true;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      recordQuotaExceeded(err);
      return false;
    }
    console.error('Lỗi khi lưu 1 học sinh lên Firestore:', err);
    return false;
  }
}

/**
 * Chuẩn hóa toàn bộ dữ liệu HK2 trên Firestore sang GKII và CKII (xóa bản ghi ID cũ, tạo ID mới chuẩn)
 */
export async function migrateHK2PeriodsInFirestore(
  onProgress?: (current: number, total: number) => void
): Promise<{ migratedCount: number }> {
  // If already migrated on this client or quota exceeded, skip
  try {
    if (typeof window !== 'undefined' && localStorage.getItem('eduscore_hk2_migrated_v2') === 'done') {
      return { migratedCount: 0 };
    }
  } catch {
    // ignore
  }

  if (isFirestoreQuotaExceeded()) {
    return { migratedCount: 0 };
  }

  try {
    const snap = await getDocs(collection(db, STUDENT_SCORES_COLLECTION));
    const toMigrate: { oldRef: any; newData: any; newRef: any }[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const sem = String(data.semester || data.hocKy || '').trim();
      const per = String(data.period || data.dotDiem || '').trim();

      if (
        sem === 'HK2' &&
        (per === 'GKI' || per === 'CKI' || per === 'GKI-HK2' || per === 'CKI-HK2' || per === 'GK1' || per === 'CK1')
      ) {
        const newPeriod = (per === 'CKI' || per === 'CKI-HK2' || per === 'CK1') ? 'CKII' : 'GKII';
        const studentId = String(data.studentId || data.soBD || 'HS');
        const subject = String(data.subject || data.monHoc || 'Toan');
        const academicYear = String(data.academicYear || data.namHoc || '2025-2026');
        const newDocId = buildCompositeScoreId(studentId, subject, academicYear, sem, newPeriod);
        const newDocRef = doc(db, STUDENT_SCORES_COLLECTION, newDocId);

        toMigrate.push({
          oldRef: docSnap.ref,
          newRef: newDocRef,
          newData: {
            ...data,
            period: newPeriod,
            dotDiem: newPeriod,
            updatedAt: Timestamp.now(),
          },
        });
      }
    });

    if (toMigrate.length === 0) {
      try {
        localStorage.setItem('eduscore_hk2_migrated_v2', 'done');
      } catch {}
      return { migratedCount: 0 };
    }

    let count = 0;
    let batch = writeBatch(db);

    for (const item of toMigrate) {
      batch.set(item.newRef, item.newData, { merge: true });
      if (item.oldRef.id !== item.newRef.id) {
        batch.delete(item.oldRef);
      }
      count++;
      if (count % 300 === 0) {
        try {
          await batch.commit();
        } catch (err: any) {
          if (isQuotaExceededError(err)) {
            recordQuotaExceeded(err);
            return { migratedCount: 0 };
          }
          throw err;
        }
        if (onProgress) onProgress(count, toMigrate.length);
        batch = writeBatch(db);
      }
    }

    if (count % 300 !== 0) {
      try {
        await batch.commit();
      } catch (err: any) {
        if (isQuotaExceededError(err)) {
          recordQuotaExceeded(err);
          return { migratedCount: 0 };
        }
        throw err;
      }
      if (onProgress) onProgress(count, toMigrate.length);
    }

    try {
      localStorage.setItem('eduscore_hk2_migrated_v2', 'done');
    } catch {}

    return { migratedCount: toMigrate.length };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      recordQuotaExceeded(err);
    }
    console.error('Lỗi khi migrate HK2 periods trên Firestore:', err);
    return { migratedCount: 0 };
  }
}

/**
 * Xóa 1 bản ghi điểm khỏi Firestore
 */
export async function deleteStudentFromFirestore(studentId: string): Promise<boolean> {
  if (isFirestoreQuotaExceeded()) return false;
  try {
    const docRef = doc(db, STUDENT_SCORES_COLLECTION, studentId);
    await deleteDoc(docRef);
    return true;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      recordQuotaExceeded(err);
      return false;
    }
    throw err;
  }
}

/**
 * Tiêu chí phạm vi xóa dữ liệu (Theo Năm học / Đợt kiểm tra)
 */
export interface DeleteScopeCriteria {
  academicYear: string; // VD: '2025-2026' hoặc 'ALL'
  periodId: string; // VD: 'KS' | 'GKI' | 'CKI' | 'GKII' | 'CKII' | 'ALL'
}

/**
 * Kiểm tra xem một bản ghi dữ liệu có thuộc phạm vi tiêu chí xóa không
 */
export function isRecordInDeleteScope(
  data: {
    academicYear?: string;
    namHoc?: string;
    semester?: string;
    hocKy?: string;
    period?: string;
    dotDiem?: string;
  },
  criteria: DeleteScopeCriteria
): boolean {
  // 1. Kiểm tra năm học
  if (criteria.academicYear && criteria.academicYear !== 'ALL') {
    const docYear = String(data.academicYear || data.namHoc || '2025-2026').trim();
    if (docYear !== criteria.academicYear) {
      return false;
    }
  }

  // 2. Kiểm tra đợt kiểm tra
  if (criteria.periodId && criteria.periodId !== 'ALL') {
    const sem = String(data.semester || data.hocKy || 'HK1').trim();
    const per = String(data.period || data.dotDiem || 'GKI').trim();

    if (criteria.periodId === 'KS') {
      if (per !== 'KS' && sem !== 'KS') return false;
    } else if (criteria.periodId === 'GKI' || criteria.periodId === 'GKI-HK1') {
      const isGkiPer = per === 'GKI' || per === 'GKI-HK1' || per === 'GK1';
      const isHk1 = sem === 'HK1' || !data.semester;
      if (!isGkiPer || !isHk1) return false;
    } else if (criteria.periodId === 'CKI' || criteria.periodId === 'CKI-HK1') {
      const isCkiPer = per === 'CKI' || per === 'CKI-HK1' || per === 'CK1';
      const isHk1 = sem === 'HK1' || !data.semester;
      if (!isCkiPer || !isHk1) return false;
    } else if (criteria.periodId === 'GKII') {
      const isGkii =
        per === 'GKII' || ((per === 'GKI' || per === 'GKI-HK2' || per === 'GK1') && sem === 'HK2');
      if (!isGkii) return false;
    } else if (criteria.periodId === 'CKII') {
      const isCkii =
        per === 'CKII' || ((per === 'CKI' || per === 'CKI-HK2' || per === 'CK1') && sem === 'HK2');
      if (!isCkii) return false;
    } else {
      if (per !== criteria.periodId) return false;
    }
  }

  return true;
}

/**
 * Xóa dữ liệu học sinh trên Firestore theo phạm vi Năm học và Đợt kiểm tra
 */
export async function deleteStudentsByScopeFromFirestore(
  criteria: DeleteScopeCriteria,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; count: number; quotaExceeded?: boolean }> {
  if (isFirestoreQuotaExceeded()) {
    return { success: false, count: 0, quotaExceeded: true };
  }

  try {
    const snap = await getDocs(collection(db, STUDENT_SCORES_COLLECTION));
    const matchingDocs: any[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (isRecordInDeleteScope(data, criteria)) {
        matchingDocs.push(docSnap.ref);
      }
    });

    const total = matchingDocs.length;
    if (total === 0) {
      return { success: true, count: 0 };
    }

    let batch = writeBatch(db);
    let count = 0;

    for (const ref of matchingDocs) {
      batch.delete(ref);
      count++;
      if (count % 450 === 0) {
        try {
          await batch.commit();
        } catch (bErr: any) {
          if (isQuotaExceededError(bErr)) {
            recordQuotaExceeded(bErr);
            return { success: false, count, quotaExceeded: true };
          }
          throw bErr;
        }
        if (onProgress) onProgress(count, total);
        batch = writeBatch(db);
      }
    }

    if (count % 450 !== 0) {
      try {
        await batch.commit();
      } catch (bErr: any) {
        if (isQuotaExceededError(bErr)) {
          recordQuotaExceeded(bErr);
          return { success: false, count, quotaExceeded: true };
        }
        throw bErr;
      }
      if (onProgress) onProgress(count, total);
    }

    return { success: true, count: total };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      recordQuotaExceeded(err);
      return { success: false, count: 0, quotaExceeded: true };
    }
    console.error('Lỗi khi xóa dữ liệu theo phạm vi khỏi Firestore:', err);
    throw new Error(`Không thể xóa dữ liệu từ Firestore: ${err?.message || err}`);
  }
}

/**
 * Xóa toàn bộ dữ liệu bảng điểm trên Firestore (Collection `student_scores`)
 */
export async function clearAllStudentsFromFirestore(
  onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; count: number; quotaExceeded?: boolean }> {
  return deleteStudentsByScopeFromFirestore({ academicYear: 'ALL', periodId: 'ALL' }, onProgress);
}

/**
 * Đọc cấu hình hệ thống từ Firestore
 */
export async function loadSystemConfigFromFirestore(): Promise<SystemConfig | null> {
  try {
    const docRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as SystemConfig;
    }
    return null;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      recordQuotaExceeded(err);
    }
    console.warn('Chưa có cấu hình trên Firestore hoặc có lỗi khi đọc:', err);
    return null;
  }
}

/**
 * Lưu cấu hình hệ thống lên Firestore
 */
export async function saveSystemConfigToFirestore(config: SystemConfig): Promise<boolean> {
  if (isFirestoreQuotaExceeded()) {
    return false;
  }
  try {
    const docRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);
    await setDoc(docRef, {
      ...config,
      updatedAt: Timestamp.now(),
    }, { merge: true });
    return true;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      recordQuotaExceeded(err);
      return false;
    }
    console.warn('Lỗi khi lưu cấu hình lên Firestore:', err);
    return false;
  }
}
