import XLSX from 'xlsx-js-style';
import { StudentScore, SystemConfig, GlobalFilterState } from '../types';

// Danh sách 12 môn học chuẩn đúng thứ tự theo biểu mẫu báo cáo Sở GD&ĐT (image.png):
// Toán | Văn | Tiếng Anh | Vật lý | Hóa | Sinh | Sử | Địa | Tin | KTPL | CNCN | CNNN
export const STANDARD_ATTENTION_SUBJECTS = [
  'Toán',
  'Văn',
  'Tiếng Anh',
  'Vật lý',
  'Hóa',
  'Sinh',
  'Sử',
  'Địa',
  'Tin',
  'KTPL',
  'CNCN',
  'CNNN',
] as const;

// Định nghĩa viền ô bảng tính màu đen mảnh (thin black border)
const BORDER_BLACK_THIN = { style: 'thin', color: { rgb: '000000' } };
const cellBorderAll = {
  top: BORDER_BLACK_THIN,
  bottom: BORDER_BLACK_THIN,
  left: BORDER_BLACK_THIN,
  right: BORDER_BLACK_THIN,
};

/**
 * Helper tạo cell với style đầy đủ cho xlsx-js-style
 */
function makeCell(value: any, style: any = {}, type?: 's' | 'n' | 'b' | 'e') {
  const cellObj: any = {
    v: value ?? '',
    s: style,
  };
  if (type) {
    cellObj.t = type;
  } else if (typeof value === 'number') {
    cellObj.t = 'n';
  } else {
    cellObj.t = 's';
  }
  return cellObj;
}

/**
 * Chuẩn hóa tên môn học về 1 trong 12 cột chuẩn, hoặc giữ nguyên nếu là môn khác
 */
export function mapSubjectToStandardColumn(rawSubject: string): string {
  if (!rawSubject) return '';
  const s = rawSubject.trim().toLowerCase();

  // Toán
  if (s === 'toán' || s === 'toan' || s === 'toán học' || s === 'toan hoc') return 'Toán';

  // Văn
  if (s === 'văn' || s === 'van' || s === 'ngữ văn' || s === 'ngu van') return 'Văn';

  // Tiếng Anh
  if (
    s.includes('tiếng anh') ||
    s.includes('tieng anh') ||
    s === 'anh' ||
    s === 'ngoại ngữ' ||
    s === 'ngoại ngữ 1' ||
    s === 'nn1' ||
    s === 'english'
  ) {
    return 'Tiếng Anh';
  }

  // Vật lý
  if (s === 'vật lý' || s === 'vật lí' || s === 'vat ly' || s === 'vat li' || s === 'lý' || s === 'lí') {
    return 'Vật lý';
  }

  // Hóa
  if (s === 'hóa' || s === 'hoa' || s === 'hóa học' || s === 'hoa hoc') return 'Hóa';

  // Sinh
  if (s === 'sinh' || s === 'sinh học' || s === 'sinh hoc') return 'Sinh';

  // Sử
  if (s === 'sử' || s === 'su' || s === 'lịch sử' || s === 'lich su') return 'Sử';

  // Địa
  if (s === 'địa' || s === 'dia' || s === 'địa lí' || s === 'địa lý' || s === 'dia li' || s === 'dia ly') {
    return 'Địa';
  }

  // Tin
  if (s === 'tin' || s === 'tin học' || s === 'tin hoc' || s.startsWith('tin')) {
    return 'Tin';
  }

  // KTPL (Kinh tế & Pháp luật / GDKT&PL / GDCD)
  if (
    s === 'ktpl' ||
    s === 'gdkt&pl' ||
    s === 'gdkt & pl' ||
    s === 'giáo dục kt&pl' ||
    s === 'giáo dục kt & pl' ||
    s.includes('kinh tế') ||
    s.includes('pháp luật') ||
    s === 'gdcd'
  ) {
    return 'KTPL';
  }

  // CNCN (Công nghệ công nghiệp)
  if (
    s === 'cncn' ||
    s.includes('công nghệ cn') ||
    s.includes('cong nghe cn') ||
    s.includes('công nghệ công nghiệp') ||
    s.includes('cong nghe cong nghiep') ||
    s.includes('cn công nghiệp') ||
    s === 'công nghệ' ||
    s === 'cong nghe'
  ) {
    return 'CNCN';
  }

  // CNNN (Công nghệ nông nghiệp)
  if (
    s === 'cnnn' ||
    s.includes('công nghệ nn') ||
    s.includes('cong nghe nn') ||
    s.includes('công nghệ nông nghiệp') ||
    s.includes('cong nghe nong nghiep') ||
    s.includes('cn nông nghiệp')
  ) {
    return 'CNNN';
  }

  return rawSubject.trim();
}

/**
 * Trích xuất khối học từ tên lớp (VD: 10B1 -> 10, 11B2 -> 11, 12B3 -> 12)
 */
export function getGradeFromClass(className: string, studentGrade?: string): string {
  if (studentGrade) {
    const num = studentGrade.replace(/\D/g, '');
    if (num === '10' || num === '11' || num === '12' || num === '6' || num === '7' || num === '8' || num === '9') {
      return num;
    }
  }
  const match = className.match(/^(\d+)/);
  if (match) return match[1];
  return 'Khác';
}

export interface GradeGroupData {
  gradeNum: string;
  gradeLabel: string; // VD: 'Tổng khối 10'
  classes: string[];
}

export interface AttentionMatrixStructure {
  subjectColumns: string[];
  gradeGroups: GradeGroupData[];
  classCounts: Record<string, Record<string, number>>; // classCounts[cls][sub] = number
  gradeTotals: Record<string, Record<string, number>>; // gradeTotals[gradeNum][sub] = number
  grandTotals: Record<string, number>; // grandTotals[sub] = number
}

/**
 * Xây dựng ma trận thống kê học sinh cần quan tâm (Lớp × Môn)
 * Phân theo từng Khối (Khối 10, Khối 11, Khối 12) kèm dòng Tổng khối và Tổng toàn trường
 */
export function buildAttentionMatrix(
  students: StudentScore[],
  config: SystemConfig
): AttentionMatrixStructure {
  const datMin = config.thresholds?.datMin ?? 5.0;

  // 1. Xác định tập các môn học (bắt đầu bằng 12 môn chuẩn, sau đó thêm môn phụ nếu có trong data)
  const presentSubjects = new Set<string>();
  students.forEach((s) => {
    const rawSub = s.monHoc || s.subject;
    if (rawSub) {
      presentSubjects.add(mapSubjectToStandardColumn(rawSub));
    }
  });

  const subjectColumns: string[] = [...STANDARD_ATTENTION_SUBJECTS];
  presentSubjects.forEach((sub) => {
    if (!subjectColumns.includes(sub)) {
      subjectColumns.push(sub);
    }
  });

  // 2. Thu thập danh sách lớp và phân nhóm theo Khối
  const classGradeMap: Record<string, string> = {};
  const allClassesSet = new Set<string>();

  students.forEach((s) => {
    const cls = s.lop || s.class;
    if (cls) {
      allClassesSet.add(cls);
      if (!classGradeMap[cls]) {
        classGradeMap[cls] = getGradeFromClass(cls, s.khoi || s.grade);
      }
    }
  });

  // Gom các lớp theo từng Khối
  const gradeClassesMap: Record<string, string[]> = {};
  Array.from(allClassesSet).forEach((cls) => {
    const g = classGradeMap[cls] || 'Khác';
    if (!gradeClassesMap[g]) gradeClassesMap[g] = [];
    gradeClassesMap[g].push(cls);
  });

  // Sắp xếp thứ tự các khối: 10, 11, 12, ...
  const sortedGradeKeys = Object.keys(gradeClassesMap).sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  const gradeGroups: GradeGroupData[] = sortedGradeKeys.map((g) => {
    const sortedClasses = gradeClassesMap[g].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
    return {
      gradeNum: g,
      gradeLabel: `Tổng khối ${g}`,
      classes: sortedClasses,
    };
  });

  // 3. Khởi tạo cấu trúc đếm
  const classCounts: Record<string, Record<string, number>> = {};
  allClassesSet.forEach((cls) => {
    classCounts[cls] = {};
    subjectColumns.forEach((sub) => {
      classCounts[cls][sub] = 0;
    });
  });

  // 4. Đếm số lượng học sinh cần quan tâm (Chỉ tính học sinh có điểm < datMin, không tính học sinh không tham gia thi)
  students.forEach((s) => {
    const cls = s.lop || s.class;
    const rawSub = s.monHoc || s.subject;
    if (!cls || !rawSub) return;

    const sub = mapSubjectToStandardColumn(rawSub);
    if (classCounts[cls] && classCounts[cls][sub] !== undefined) {
      const score = s.diem !== undefined && s.diem !== null ? s.diem : s.score;
      if (typeof score === 'number' && !isNaN(score) && score < datMin) {
        classCounts[cls][sub] = (classCounts[cls][sub] || 0) + 1;
      }
    }
  });

  // 5. Tính tổng theo từng Khối và Tổng toàn trường
  const gradeTotals: Record<string, Record<string, number>> = {};
  const grandTotals: Record<string, number> = {};

  subjectColumns.forEach((sub) => {
    grandTotals[sub] = 0;
  });

  gradeGroups.forEach((gg) => {
    gradeTotals[gg.gradeNum] = {};
    subjectColumns.forEach((sub) => {
      gradeTotals[gg.gradeNum][sub] = 0;
    });

    gg.classes.forEach((cls) => {
      subjectColumns.forEach((sub) => {
        const cnt = classCounts[cls]?.[sub] || 0;
        gradeTotals[gg.gradeNum][sub] += cnt;
        grandTotals[sub] += cnt;
      });
    });
  });

  return {
    subjectColumns,
    gradeGroups,
    classCounts,
    gradeTotals,
    grandTotals,
  };
}

/**
 * Lấy tiêu đề kỳ thi ngắn gọn và năm học theo định dạng:
 * Ví dụ: "KIỂM TRA GIỮA HK II - NĂM HỌC 2025 - 2026" (hoặc "KIỂM TRA GIỮA HK II- NĂM HỌC 2025 - 2026")
 */
export function getExamTitleForAttentionReport(
  config: SystemConfig,
  globalFilter?: GlobalFilterState
): string {
  let academicYear = globalFilter?.academicYear && globalFilter.academicYear !== 'ALL'
    ? globalFilter.academicYear
    : config.academicYear || '2025 - 2026';
  if (/^\d{4}-\d{4}$/.test(academicYear)) {
    academicYear = academicYear.replace('-', ' - ');
  }

  const period = globalFilter?.period;
  const semester = globalFilter?.semester;

  if (period === 'KS' || semester === 'KS') {
    return `KHẢO SÁT ĐẦU NĂM - NĂM HỌC ${academicYear}`;
  }
  if (period === 'GKI' && semester === 'HK1') {
    return `KIỂM TRA GIỮA HK I - NĂM HỌC ${academicYear}`;
  }
  if (period === 'CKI' && semester === 'HK1') {
    return `KIỂM TRA CUỐI HK I - NĂM HỌC ${academicYear}`;
  }
  if (period === 'GKII' || (period === 'GKI' && semester === 'HK2')) {
    return `KIỂM TRA GIỮA HK II- NĂM HỌC ${academicYear}`;
  }
  if (period === 'CKII' || (period === 'CKI' && semester === 'HK2')) {
    return `KIỂM TRA CUỐI HK II- NĂM HỌC ${academicYear}`;
  }
  if (semester === 'HK1') {
    return `KIỂM TRA HỌC KỲ I - NĂM HỌC ${academicYear}`;
  }
  if (semester === 'HK2') {
    return `KIỂM TRA HỌC KỲ II - NĂM HỌC ${academicYear}`;
  }

  const defaultExam = config.examName
    ? config.examName.toUpperCase()
    : 'KIỂM TRA GIỮA HK II';
  return `${defaultExam}- NĂM HỌC ${academicYear}`;
}

/**
 * Xuất file Excel chuẩn định dạng 100% như hình ảnh:
 * - Row 1: SỞ GD&ĐT QUẢNG NGÃI
 * - Row 2: TRƯỜNG PTDNT THPT SA THẦY
 * - Row 4: KIỂM TRA GIỮA HK II- NĂM HỌC 2025 - 2026 (Căn giữa)
 * - Row 5: TỔNG HỢP SỐ LƯỢNG HỌC SINH CẦN QUAN TÂM (Căn giữa)
 * - Row 7: Lớp/Môn | Toán | Văn | Tiếng Anh | Vật lý | Hóa | Sinh | Sử | Địa | Tin | KTPL | CNCN | CNNN
 * - Dữ liệu theo Khối:
 *   - Lớp Khối 10: 10B1 ... 10B6
 *   - Dòng: Tổng khối 10
 *   - Lớp Khối 11: 11B1 ... 11B5
 *   - Dòng: Tổng khối 11
 *   - Lớp Khối 12: 12B1 ... 12B5
 *   - Dòng: Tổng khối 12
 *   - Dòng: Tổng toàn trường
 */
export function exportQuantityNeedAttentionExcel(
  students: StudentScore[],
  config: SystemConfig,
  globalFilter?: GlobalFilterState
): void {
  const matrix = buildAttentionMatrix(students, config);
  const examTitle = getExamTitleForAttentionReport(config, globalFilter);
  const schoolDept = ((config as any).departmentName || 'SỞ GD&ĐT QUẢNG NGÃI').toUpperCase();
  const schoolName = (config.schoolName || 'TRƯỜNG PTDNT THPT SA THẦY').toUpperCase();

  const totalCols = matrix.subjectColumns.length + 1; // 1 cột Lớp/Môn + các cột môn
  const lastColIdx = totalCols - 1;

  const ws: any = {};
  const merges: any[] = [];
  let currentRow = 0; // 0-indexed

  // --- STYLE CHUẨN TIMES NEW ROMAN ---
  const fontRegular = { name: 'Times New Roman', sz: 11 };
  const fontBold = { name: 'Times New Roman', sz: 11, bold: true };
  const fontTitle1 = { name: 'Times New Roman', sz: 12, bold: true };
  const fontTitle2 = { name: 'Times New Roman', sz: 13, bold: true };

  const styleTopHeader = {
    font: fontBold,
    alignment: { vertical: 'center' },
  };

  const styleTopSchool = {
    font: { name: 'Times New Roman', sz: 11, bold: true, underline: true },
    alignment: { vertical: 'center' },
  };

  const styleExamTitle = {
    font: fontTitle1,
    alignment: { horizontal: 'center', vertical: 'center' },
  };

  const styleReportTitle = {
    font: fontTitle2,
    alignment: { horizontal: 'center', vertical: 'center' },
  };

  const styleTableHead = {
    font: fontBold,
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: cellBorderAll,
  };

  const styleClassCell = {
    font: fontRegular,
    alignment: { horizontal: 'left', vertical: 'center' },
    border: cellBorderAll,
  };

  const styleNumberCell = {
    font: fontRegular,
    alignment: { horizontal: 'center', vertical: 'center' },
    border: cellBorderAll,
  };

  const styleSubtotalClassCell = {
    font: fontBold,
    alignment: { horizontal: 'center', vertical: 'center' },
    border: cellBorderAll,
  };

  const styleSubtotalNumberCell = {
    font: fontBold,
    alignment: { horizontal: 'center', vertical: 'center' },
    border: cellBorderAll,
  };

  // 1. DÒNG 1 (r: 0): SỞ GD&ĐT QUẢNG NGÃI
  const cellA1Ref = XLSX.utils.encode_cell({ r: currentRow, c: 0 });
  ws[cellA1Ref] = makeCell(schoolDept, styleTopHeader);
  currentRow++;

  // 2. DÒNG 2 (r: 1): TRƯỜNG PTDNT THPT SA THẦY
  const cellA2Ref = XLSX.utils.encode_cell({ r: currentRow, c: 0 });
  ws[cellA2Ref] = makeCell(schoolName, styleTopSchool);
  currentRow++;

  // 3. DÒNG 3 (r: 2): Trống
  currentRow++;

  // 4. DÒNG 4 (r: 3): KIỂM TRA GIỮA HK II- NĂM HỌC 2025 - 2026
  const rowExamTitle = currentRow;
  for (let c = 0; c <= lastColIdx; c++) {
    const ref = XLSX.utils.encode_cell({ r: rowExamTitle, c });
    ws[ref] = makeCell(c === 0 ? examTitle : '', styleExamTitle);
  }
  merges.push({ s: { r: rowExamTitle, c: 0 }, e: { r: rowExamTitle, c: lastColIdx } });
  currentRow++;

  // 5. DÒNG 5 (r: 4): TỔNG HỢP SỐ LƯỢNG HỌC SINH CẦN QUAN TÂM
  const rowReportTitle = currentRow;
  for (let c = 0; c <= lastColIdx; c++) {
    const ref = XLSX.utils.encode_cell({ r: rowReportTitle, c });
    ws[ref] = makeCell(c === 0 ? 'TỔNG HỢP SỐ LƯỢNG HỌC SINH CẦN QUAN TÂM' : '', styleReportTitle);
  }
  merges.push({ s: { r: rowReportTitle, c: 0 }, e: { r: rowReportTitle, c: lastColIdx } });
  currentRow++;

  // 6. DÒNG 6 (r: 5): Trống
  currentRow++;

  // 7. DÒNG 7 (r: 6): TIÊU ĐỀ CỘT BẢNG THỐNG KÊ (Lớp/Môn | Toán | Văn ...)
  const rowHeader = currentRow;
  const colAHeadRef = XLSX.utils.encode_cell({ r: rowHeader, c: 0 });
  ws[colAHeadRef] = makeCell('Lớp/Môn', styleTableHead);

  matrix.subjectColumns.forEach((sub, idx) => {
    const ref = XLSX.utils.encode_cell({ r: rowHeader, c: idx + 1 });
    ws[ref] = makeCell(sub, styleTableHead);
  });
  currentRow++;

  // 8. DỮ LIỆU CÁC LỚP THEO TỪNG KHỐI
  matrix.gradeGroups.forEach((gg) => {
    // Từng lớp trong khối
    gg.classes.forEach((cls) => {
      const rowIdx = currentRow;
      const refCls = XLSX.utils.encode_cell({ r: rowIdx, c: 0 });
      ws[refCls] = makeCell(cls, styleClassCell);

      matrix.subjectColumns.forEach((sub, sIdx) => {
        const val = matrix.classCounts[cls]?.[sub] || 0;
        const refNum = XLSX.utils.encode_cell({ r: rowIdx, c: sIdx + 1 });
        ws[refNum] = makeCell(val, styleNumberCell, 'n');
      });
      currentRow++;
    });

    // Dòng Tổng khối (VD: Tổng khối 10)
    const rowGradeTotal = currentRow;
    const refGgLabel = XLSX.utils.encode_cell({ r: rowGradeTotal, c: 0 });
    ws[refGgLabel] = makeCell(gg.gradeLabel, styleSubtotalClassCell);

    matrix.subjectColumns.forEach((sub, sIdx) => {
      const gVal = matrix.gradeTotals[gg.gradeNum]?.[sub] || 0;
      const refGNum = XLSX.utils.encode_cell({ r: rowGradeTotal, c: sIdx + 1 });
      ws[refGNum] = makeCell(gVal, styleSubtotalNumberCell, 'n');
    });
    currentRow++;
  });

  // 9. DÒNG TỔNG TOÀN TRƯỜNG (Dưới cùng)
  const rowGrandTotal = currentRow;
  const refGrandLabel = XLSX.utils.encode_cell({ r: rowGrandTotal, c: 0 });
  ws[refGrandLabel] = makeCell('Tổng toàn trường', styleSubtotalClassCell);

  matrix.subjectColumns.forEach((sub, sIdx) => {
    const totalVal = matrix.grandTotals[sub] || 0;
    const refGrandNum = XLSX.utils.encode_cell({ r: rowGrandTotal, c: sIdx + 1 });
    ws[refGrandNum] = makeCell(totalVal, styleSubtotalNumberCell, 'n');
  });
  currentRow++;

  // Thiết lập vùng tính toán của Sheet (!ref)
  const lastRowIdx = currentRow - 1;
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: lastRowIdx, c: lastColIdx },
  });

  // Thiết lập Merge
  ws['!merges'] = merges;

  // Thiết lập độ rộng cột (!cols)
  const cols = [
    { wch: 18 }, // Cột Lớp/Môn (đủ cho "Tổng toàn trường")
  ];
  for (let i = 0; i < matrix.subjectColumns.length; i++) {
    cols.push({ wch: 11 }); // Cột Toán, Văn, Tiếng Anh...
  }
  ws['!cols'] = cols;

  // Thiết lập chiều cao dòng (!rows)
  const rows = [];
  rows[rowExamTitle] = { hpt: 22 };
  rows[rowReportTitle] = { hpt: 24 };
  rows[rowHeader] = { hpt: 24 };
  ws['!rows'] = rows;

  // Đặt tên sheet là 'Sheet1' chuẩn như trên hình
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  // Tên file xuất
  const safeTitle = examTitle
    .replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_')
    .replace(/_+/g, '_');
  const fileName = `TongHop_SoLuong_HS_CanQuanTam_${safeTitle}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
