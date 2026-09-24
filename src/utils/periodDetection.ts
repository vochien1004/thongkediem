import { StudentScore, GlobalFilterState } from '../types';

export const LATEST_FILTER_STORAGE_KEY = 'eduscore_latest_uploaded_filter';

/**
 * Trích xuất timestamp chính xác từ giá trị updatedAt
 */
export function extractTimestamp(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val.toMillis === 'function') {
    return val.toMillis();
  }
  if (typeof val.seconds === 'number') {
    return val.seconds * 1000 + (val.nanoseconds || 0) / 1e6;
  }
  if (val instanceof Date) {
    return val.getTime();
  }
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Tính trọng số thời gian theo niên khóa và đợt kiểm tra
 * VD: Năm 2025-2026, CKII (5) > GKII (4) > CKI (3) > GKI (2) > KS (1)
 */
export function getExamPeriodChronologicalWeight(academicYear?: string, semester?: string, period?: string): number {
  let startYear = 2025;
  const yearStr = String(academicYear || '');
  const yearMatch = yearStr.match(/(\d{4})/);
  if (yearMatch) {
    startYear = parseInt(yearMatch[1], 10);
  }

  const sem = String(semester || '').toUpperCase();
  const per = String(period || '').toUpperCase();

  let periodRank = 2; // Mặc định GKI
  if (per === 'CKII' || (sem === 'HK2' && (per === 'CKI' || per === 'CK1' || per === 'CKII'))) {
    periodRank = 5;
  } else if (per === 'GKII' || (sem === 'HK2' && (per === 'GKI' || per === 'GK1' || per === 'GKII'))) {
    periodRank = 4;
  } else if (per === 'CKI' || per === 'CK1' || (sem === 'HK1' && (per === 'CKI' || per === 'CK1'))) {
    periodRank = 3;
  } else if (per === 'GKI' || per === 'GK1' || (sem === 'HK1' && (per === 'GKI' || per === 'GK1'))) {
    periodRank = 2;
  } else if (per === 'KS' || sem === 'KS' || per.includes('KHẢO SÁT') || sem.includes('KHẢO SÁT')) {
    periodRank = 1;
  }

  return startYear * 10 + periodRank;
}

/**
 * Xác định chuẩn hóa (academicYear, semester, period) cho 1 bản ghi
 */
export function normalizeStudentExamPeriod(s: StudentScore): {
  academicYear: string;
  semester: 'KS' | 'HK1' | 'HK2';
  period: 'KS' | 'GKI' | 'CKI' | 'GKII' | 'CKII';
} {
  const academicYear = (s.academicYear || s.namHoc || '2025-2026').trim();
  let semester = (s.semester || s.hocKy || 'HK1').trim();
  let period = (s.period || s.dotDiem || 'GKI').trim();

  // Chuẩn hóa KS
  if (
    semester === 'KS' ||
    period === 'KS' ||
    semester.toLowerCase().includes('ks') ||
    period.toLowerCase().includes('ks') ||
    period.toLowerCase().includes('khảo sát')
  ) {
    return {
      academicYear,
      semester: 'KS',
      period: 'KS',
    };
  }

  // Chuẩn hóa HK2
  if (semester === 'HK2') {
    if (period === 'GKI' || period === 'GKI-HK2' || period === 'GK1' || period === 'GKII') {
      return { academicYear, semester: 'HK2', period: 'GKII' };
    }
    return { academicYear, semester: 'HK2', period: 'CKII' };
  }

  // Chuẩn hóa HK1
  if (period === 'GKII') {
    return { academicYear, semester: 'HK2', period: 'GKII' };
  }
  if (period === 'CKII') {
    return { academicYear, semester: 'HK2', period: 'CKII' };
  }
  if (period === 'CKI' || period === 'CKI-HK1' || period === 'CK1') {
    return { academicYear, semester: 'HK1', period: 'CKI' };
  }
  return { academicYear, semester: 'HK1', period: 'GKI' };
}

/**
 * Tự động phân tích toàn bộ danh sách điểm và tìm ra đợt kiểm tra được upload điểm gần nhất
 */
export function detectLatestUploadedPeriod(students: StudentScore[]): GlobalFilterState | null {
  if (!students || students.length === 0) {
    return null;
  }

  interface PeriodGroup {
    academicYear: string;
    semester: 'KS' | 'HK1' | 'HK2';
    period: 'KS' | 'GKI' | 'CKI' | 'GKII' | 'CKII';
    latestTimestamp: number;
    chronologicalWeight: number;
    count: number;
  }

  const groups = new Map<string, PeriodGroup>();

  for (const s of students) {
    const norm = normalizeStudentExamPeriod(s);
    const key = `${norm.academicYear}__${norm.semester}__${norm.period}`;
    const ts = extractTimestamp(s.updatedAt);
    const weight = getExamPeriodChronologicalWeight(norm.academicYear, norm.semester, norm.period);

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        academicYear: norm.academicYear,
        semester: norm.semester,
        period: norm.period,
        latestTimestamp: ts,
        chronologicalWeight: weight,
        count: 1,
      });
    } else {
      existing.count += 1;
      if (ts > existing.latestTimestamp) {
        existing.latestTimestamp = ts;
      }
    }
  }

  const groupList = Array.from(groups.values());
  if (groupList.length === 0) return null;

  // Sắp xếp:
  // 1. Ưu tiên đợt có `latestTimestamp` mới nhất (lớn nhất)
  // 2. Nếu không có timestamp hoặc timestamp bằng nhau, ưu tiên đợt có thứ tự thời gian gần nhất (năm học lớn nhất & đợt kiểm tra mới nhất)
  groupList.sort((a, b) => {
    if (a.latestTimestamp > 0 || b.latestTimestamp > 0) {
      if (b.latestTimestamp !== a.latestTimestamp) {
        return b.latestTimestamp - a.latestTimestamp;
      }
    }
    return b.chronologicalWeight - a.chronologicalWeight;
  });

  const best = groupList[0];
  return {
    academicYear: best.academicYear,
    semester: best.semester,
    period: best.period,
  };
}

/**
 * Đọc cấu hình đợt upload gần nhất từ localStorage
 */
export function getSavedLatestUploadedFilter(): GlobalFilterState | null {
  try {
    const raw = localStorage.getItem(LATEST_FILTER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.academicYear && parsed.semester && parsed.period) {
        return parsed as GlobalFilterState;
      }
    }
  } catch {}
  return null;
}

/**
 * Lưu cấu hình đợt upload gần nhất vào localStorage
 */
export function saveLatestUploadedFilter(filter: GlobalFilterState): void {
  try {
    localStorage.setItem(LATEST_FILTER_STORAGE_KEY, JSON.stringify(filter));
  } catch {}
}
