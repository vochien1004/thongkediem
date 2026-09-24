import * as XLSX from 'xlsx';
import { StudentScore, SystemConfig, GlobalFilterState } from '../types';
import { calculateStats } from './scoreClassifier';
import { exportQualityBySubjectExcelFile } from './exportQualityBySubjectExcel';
import { exportQualityByClassExcelFile } from './exportQualityByClassExcel';
import { getReportHeaderInfo } from './syncExamInfo';

/**
 * 1. Xuất file Thống kê chất lượng theo Môn
 */
export function exportQualityBySubject(
  students: StudentScore[],
  config: SystemConfig,
  globalFilter?: GlobalFilterState
) {
  exportQualityBySubjectExcelFile(students, config, undefined, globalFilter);
}

/**
 * 2. Xuất file Thống kê chất lượng theo Lớp
 */
export function exportQualityByClass(
  students: StudentScore[],
  config: SystemConfig,
  globalFilter?: GlobalFilterState
) {
  exportQualityByClassExcelFile(students, config, undefined, globalFilter);
}

import { exportQualityByTeacherExcelFile } from './exportQualityByTeacherExcel';
import { exportQuantityNeedAttentionExcel } from './exportQuantityNeedAttentionExcel';
import { exportListNeedAttentionExcel } from './exportListNeedAttentionExcel';
import { exportSpecialAttentionExcel } from './exportSpecialAttentionExcel';

/**
 * 3. Xuất file Thống kê chất lượng theo Giáo viên
 * Đúng chuẩn hình ảnh: Mỗi giáo viên một Sheet, hiển thị đủ số môn và số lớp GV phụ trách
 */
export function exportQualityByTeacher(
  students: StudentScore[],
  config: SystemConfig,
  globalFilter?: GlobalFilterState
) {
  exportQualityByTeacherExcelFile(students, config, globalFilter);
}

/**
 * 4. Xuất file Ma trận & Thống kê Số lượng HS cần quan tâm
 */
export function exportQuantityNeedAttention(
  students: StudentScore[],
  config: SystemConfig,
  globalFilter?: GlobalFilterState
) {
  exportQuantityNeedAttentionExcel(students, config, globalFilter);
}

/**
 * 5. Xuất file Danh sách HS cần quan tâm theo Môn ở các Lớp (Mỗi sheet 1 môn)
 */
export function exportListNeedAttention(
  students: StudentScore[],
  config: SystemConfig,
  globalFilter?: GlobalFilterState
) {
  exportListNeedAttentionExcel(students, config, globalFilter);
}

/**
 * 6. Xuất file Danh sách HS cần quan tâm đặc biệt theo Môn ở các Lớp (điểm <= 3.5, Mỗi sheet 1 môn)
 */
export function exportSpecialAttention(
  students: StudentScore[],
  config: SystemConfig,
  globalFilter?: GlobalFilterState
) {
  exportSpecialAttentionExcel(students, config, globalFilter);
}

/**
 * 7. Tải trọn bộ các file Excel báo cáo cùng lúc
 */
export async function exportAll5Reports(
  students: StudentScore[],
  config: SystemConfig,
  globalFilter?: GlobalFilterState
) {
  exportQualityBySubject(students, config, globalFilter);
  exportQualityByClass(students, config, globalFilter);
  exportQualityByTeacher(students, config, globalFilter);
  exportQuantityNeedAttention(students, config, globalFilter);
  exportListNeedAttention(students, config, globalFilter);
  exportSpecialAttention(students, config, globalFilter);
}
