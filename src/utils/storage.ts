import { ScoreThresholds, StudentScore, SystemConfig } from '../types';
import { getSampleStudents } from '../data/sampleData';
import { DEFAULT_THRESHOLDS } from './scoreClassifier';
import { DEFAULT_EXAM_PERIODS } from './periodConfig';

const STORAGE_KEYS = {
  STUDENTS: 'eduscore_students_v1',
  CONFIG: 'eduscore_config_v1',
};

export const DEFAULT_CONFIG: SystemConfig = {
  thresholds: DEFAULT_THRESHOLDS,
  schoolName: 'TRƯỜNG PTDNT THPT SA THẦY',
  academicYear: '2025 - 2026',
  term: 'Khảo sát đầu năm',
  examName: 'Khảo sát đầu năm',
  availableAcademicYears: ['2024-2025', '2025-2026', '2026-2027'],
  examPeriods: DEFAULT_EXAM_PERIODS,
};

// Xóa bỏ lưu trữ học sinh vào LocalStorage theo yêu cầu hệ thống (chỉ lưu trên Cloud Firestore)
try {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('eduscore_students_v1');
  }
} catch {
  // ignore
}

export function loadStoredStudents(): StudentScore[] {
  // Dữ liệu học sinh được nạp 100% từ Cloud Firestore, không lấy từ LocalStorage
  return [];
}

export function saveStoredStudents(_students: StudentScore[]): void {
  // Không lưu dữ liệu điểm vào LocalStorage - Toàn bộ dữ liệu được quản lý tập trung trên Cloud Firestore
}

export function loadStoredConfig(): SystemConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (!raw) {
      saveStoredConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }
    const parsed = JSON.parse(raw);
    const examPeriods =
      parsed.examPeriods && parsed.examPeriods.some((p: any) => p.id === 'KS')
        ? parsed.examPeriods
        : DEFAULT_EXAM_PERIODS;

    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      examPeriods,
      thresholds: {
        ...DEFAULT_CONFIG.thresholds,
        ...(parsed.thresholds || {}),
      },
    };
  } catch (err) {
    console.error('Lỗi khi đọc cấu hình từ LocalStorage:', err);
    return DEFAULT_CONFIG;
  }
}

export function saveStoredConfig(config: SystemConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  } catch (err) {
    console.error('Lỗi khi lưu cấu hình vào LocalStorage:', err);
  }
}

export function exportBackupJSON(students: StudentScore[], config: SystemConfig) {
  const data = {
    appName: 'EduScore',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    students,
    config,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `EduScore_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
