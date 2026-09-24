import { ExamPeriodConfig, SystemConfig } from '../types';

export const DEFAULT_EXAM_PERIODS: ExamPeriodConfig[] = [
  {
    id: 'KS',
    code: 'KS',
    name: 'KS đầu năm',
    fullName: 'Khảo sát đầu năm',
    term: 'Khảo sát đầu năm',
    semester: 'KS',
    period: 'KS',
    order: 0, // Đứng trước Học kỳ 1 (HK1)
    enabledYears: ['2024-2025', '2025-2026', '2026-2027'],
    applicableYears: ['2024-2025', '2025-2026', '2026-2027'],
    enabled: true,
    description: 'Đợt khảo sát chất lượng đầu năm học (trước khi bắt đầu HK1)',
  },
  {
    id: 'GKI-HK1',
    code: 'GKI',
    name: 'Giữa HK1 (GKI)',
    fullName: 'Kiểm tra giữa học kỳ I',
    term: 'Học kỳ I',
    semester: 'HK1',
    period: 'GKI',
    order: 1,
    enabledYears: ['2024-2025', '2025-2026', '2026-2027'],
    applicableYears: ['2024-2025', '2025-2026', '2026-2027'],
    enabled: true,
    description: 'Đánh giá giữa Học kỳ 1 (GKI)',
  },
  {
    id: 'CKI-HK1',
    code: 'CKI',
    name: 'Cuối HK1 (CKI)',
    fullName: 'Kiểm tra cuối học kỳ I',
    term: 'Học kỳ I',
    semester: 'HK1',
    period: 'CKI',
    order: 2,
    enabledYears: ['2024-2025', '2025-2026', '2026-2027'],
    applicableYears: ['2024-2025', '2025-2026', '2026-2027'],
    enabled: true,
    description: 'Đánh giá cuối Học kỳ 1 (CKI)',
  },
  {
    id: 'GKII',
    code: 'GKII',
    name: 'Giữa HK2 (GKII)',
    fullName: 'Kiểm tra giữa học kỳ II (GKII)',
    term: 'Học kỳ II',
    semester: 'HK2',
    period: 'GKII',
    order: 3,
    enabledYears: ['2024-2025', '2025-2026', '2026-2027'],
    applicableYears: ['2024-2025', '2025-2026', '2026-2027'],
    enabled: true,
    description: 'Đánh giá giữa Học kỳ 2 (GKII)',
  },
  {
    id: 'CKII',
    code: 'CKII',
    name: 'Cuối HK2 (CKII)',
    fullName: 'Kiểm tra cuối học kỳ II (CKII)',
    term: 'Học kỳ II',
    semester: 'HK2',
    period: 'CKII',
    order: 4,
    enabledYears: ['2024-2025', '2025-2026', '2026-2027'],
    applicableYears: ['2024-2025', '2025-2026', '2026-2027'],
    enabled: true,
    description: 'Đánh giá cuối Học kỳ 2 (CKII)',
  },
];

/**
 * Kiểm tra xem một đợt kiểm tra có được cấu hình kích hoạt cho năm học cụ thể không
 */
export function isPeriodEnabledForYear(
  config: SystemConfig,
  periodId: string,
  year: string
): boolean {
  if (year === 'ALL') return true;
  const periods = config.examPeriods && config.examPeriods.length > 0 ? config.examPeriods : DEFAULT_EXAM_PERIODS;
  const target = periods.find((p) => p.id === periodId);
  if (!target) return true;
  if (!target.enabledYears || target.enabledYears.length === 0) return true;
  return target.enabledYears.includes(year);
}

/**
 * Lấy danh sách đợt kiểm tra áp dụng cho năm học
 */
export function getPeriodsForYear(config: SystemConfig, year: string): ExamPeriodConfig[] {
  const periods = config.examPeriods && config.examPeriods.length > 0 ? config.examPeriods : DEFAULT_EXAM_PERIODS;
  if (year === 'ALL') return periods;
  return periods.filter((p) => !p.enabledYears || p.enabledYears.length === 0 || p.enabledYears.includes(year));
}
