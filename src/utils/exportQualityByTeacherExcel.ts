import XLSX from 'xlsx-js-style';
import { StudentScore, SystemConfig, GlobalFilterState } from '../types';
import { compareSubjectsStandardOrder } from './exportQualityByClassExcel';

// Định nghĩa viền ô bảng tính
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
 * Lấy tiêu đề kỳ thi ngắn gọn và năm học theo định dạng:
 * Ví dụ: "KIỂM TRA GIỮA HK II - NĂM HỌC 2025 - 2026"
 */
export function getExamTitleForTeacherReport(
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

  if (period === 'GKI' && semester === 'HK1') {
    return `KIỂM TRA GIỮA HK I - NĂM HỌC ${academicYear}`;
  }
  if (period === 'CKI' && semester === 'HK1') {
    return `KIỂM TRA CUỐI HK I - NĂM HỌC ${academicYear}`;
  }
  if (period === 'GKII' || (period === 'GKI' && semester === 'HK2')) {
    return `KIỂM TRA GIỮA HK II (GKII) - NĂM HỌC ${academicYear}`;
  }
  if (period === 'CKII' || (period === 'CKI' && semester === 'HK2')) {
    return `KIỂM TRA CUỐI HK II (CKII) - NĂM HỌC ${academicYear}`;
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
  return `${defaultExam} - NĂM HỌC ${academicYear}`;
}

export interface TeacherClassStatRow {
  tt: number;
  lop: string;
  slDuKt: number;
  chuaDatSL: number;
  chuaDatTL: string;
  datSL: number;
  datTL: string;
  khaSL: number;
  khaTL: string;
  totSL: number;
  totTL: string;
  diemTb: string | number;
}

export interface TeacherSubjectStatGroup {
  subjectName: string;
  classes: TeacherClassStatRow[];
}

/**
 * Tính toán thống kê chi tiết cho một giáo viên theo từng môn và từng lớp:
 * Nhóm theo Môn học mà giáo viên giảng dạy, dưới mỗi môn liệt kê đầy đủ các lớp
 */
export function calculateTeacherGroupedStats(
  teacherName: string,
  allStudents: StudentScore[],
  config: SystemConfig
): TeacherSubjectStatGroup[] {
  // Lọc tất cả học sinh do giáo viên này phụ trách
  const teacherStudents = allStudents.filter((s) => {
    const tch = (s.giaoVien || s.teacherName || '').trim();
    return tch.toLowerCase() === teacherName.trim().toLowerCase();
  });

  if (teacherStudents.length === 0) return [];

  // Danh sách các môn học giáo viên này giảng dạy
  const subjects = Array.from(
    new Set(
      teacherStudents
        .map((s) => (s.monHoc || s.subject || '').trim())
        .filter((subj): subj is string => Boolean(subj))
    )
  ).sort(compareSubjectsStandardOrder);

  const { datMin = 5.0, khaMin = 6.5, totMin = 8.0 } = config.thresholds || {};

  const result: TeacherSubjectStatGroup[] = [];

  subjects.forEach((subj) => {
    const studentsOfSubj = teacherStudents.filter(
      (s) => (s.monHoc || s.subject || '').trim() === subj
    );

    // Lấy tất cả các lớp mà GV dạy môn này
    const classNames = Array.from(
      new Set(
        studentsOfSubj
          .map((s) => (s.lop || s.class || '').trim())
          .filter((cls): cls is string => Boolean(cls))
      )
    ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const classRows: TeacherClassStatRow[] = [];

    classNames.forEach((cls, classIdx) => {
      const clsStudents = studentsOfSubj.filter(
        (s) => (s.lop || s.class || '').trim() === cls
      );

      // Học sinh dự kiểm tra (có điểm thi hợp lệ và không vắng)
      const tested = clsStudents.filter((s) => {
        const sc = s.diem ?? s.score;
        return sc !== null && sc !== undefined && s.xepLoai !== 'Vắng' && s.rank !== 'Vắng';
      });
      const slDuKt = tested.length;

      const chuaDatSL = tested.filter((s) => {
        const sc = Number(s.diem ?? s.score);
        return sc < datMin;
      }).length;
      const datSL = tested.filter((s) => {
        const sc = Number(s.diem ?? s.score);
        return sc >= datMin && sc < khaMin;
      }).length;
      const khaSL = tested.filter((s) => {
        const sc = Number(s.diem ?? s.score);
        return sc >= khaMin && sc < totMin;
      }).length;
      const totSL = tested.filter((s) => {
        const sc = Number(s.diem ?? s.score);
        return sc >= totMin;
      }).length;

      const chuaDatTL = slDuKt > 0 ? `${((chuaDatSL / slDuKt) * 100).toFixed(1)}%` : '0.0%';
      const datTL = slDuKt > 0 ? `${((datSL / slDuKt) * 100).toFixed(1)}%` : '0.0%';
      const khaTL = slDuKt > 0 ? `${((khaSL / slDuKt) * 100).toFixed(1)}%` : '0.0%';
      const totTL = slDuKt > 0 ? `${((totSL / slDuKt) * 100).toFixed(1)}%` : '0.0%';

      const diemTb =
        slDuKt > 0
          ? Number(
              (
                tested.reduce((sum, s) => sum + Number(s.diem ?? s.score), 0) / slDuKt
              ).toFixed(1)
            )
          : '—';

      classRows.push({
        tt: classIdx + 1,
        lop: cls,
        slDuKt,
        chuaDatSL,
        chuaDatTL,
        datSL,
        datTL,
        khaSL,
        khaTL,
        totSL,
        totTL,
        diemTb,
      });
    });

    if (classRows.length > 0) {
      result.push({
        subjectName: subj,
        classes: classRows,
      });
    }
  });

  return result;
}

/**
 * Xây dựng worksheet cho một Giáo viên cụ thể chuẩn 100% theo mẫu ảnh:
 * - Dòng 1: Col B: SỞ GD&ĐT QUẢNG NGÃI
 * - Dòng 2: Col B: TRƯỜNG PTDTNT THPT SA THẦY
 * - Dòng 4: KIỂM TRA GIỮA HK II - NĂM HỌC 2025 - 2026 (Căn giữa A..L)
 * - Dòng 5: THỐNG KÊ CHẤT LƯỢNG THEO GIÁO VIÊN (Căn giữa A..L)
 * - Dòng 6: Col B: Giáo viên: [Tên Giáo Viên]
 * - Dòng 7: Khoảng trống
 * - Dòng 8-9: Header 2 tầng: TT | Lớp | SL HS dự KT | Chưa đạt (điểm < 5) | Đạt (5<= điểm <6.5) | Khá (6.5<= điểm <8) | Tốt (điểm >= 8) | Điểm TB môn của lớp
 * - Dòng 10+: Lần lượt các Môn học (Môn: CNNN, Môn: Sinh...), dưới mỗi môn là danh sách các lớp phụ trách
 */
export function buildTeacherWorksheet(
  teacherName: string,
  teacherGroupedData: TeacherSubjectStatGroup[],
  config: SystemConfig,
  globalFilter?: GlobalFilterState
): XLSX.WorkSheet {
  const aoa: any[][] = [];
  const merges: XLSX.Range[] = [];

  const schoolDept = ((config as any).departmentName || 'SỞ GD&ĐT QUẢNG NGÃI').toUpperCase();
  const schoolName = (config.schoolName || 'TRƯỜNG PTDTNT THPT SA THẦY').toUpperCase();
  const examTitle = getExamTitleForTeacherReport(config, globalFilter);
  const { datMin = 5.0, khaMin = 6.5, totMin = 8.0 } = config.thresholds || {};

  // Dòng 1 (r: 0): SỞ GD&ĐT QUẢNG NGÃI tại Col B (c: 1)
  aoa.push([
    makeCell(''),
    makeCell(schoolDept, {
      font: { name: 'Arial', sz: 10.5, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    }),
    makeCell(''), makeCell(''), makeCell(''), makeCell(''),
    makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''),
  ]);
  merges.push({ s: { r: 0, c: 1 }, e: { r: 0, c: 4 } });

  // Dòng 2 (r: 1): TRƯỜNG PTDTNT THPT SA THẦY tại Col B (c: 1) (gạch chân nhẹ)
  aoa.push([
    makeCell(''),
    makeCell(schoolName, {
      font: { name: 'Arial', sz: 10.5, bold: true, underline: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    }),
    makeCell(''), makeCell(''), makeCell(''), makeCell(''),
    makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''),
  ]);
  merges.push({ s: { r: 1, c: 1 }, e: { r: 1, c: 4 } });

  // Dòng 3 (r: 2): Trống
  aoa.push(new Array(12).fill(null).map(() => makeCell('')));

  // Dòng 4 (r: 3): KIỂM TRA GIỮA HK II - NĂM HỌC 2025 - 2026 (Căn giữa A..L)
  aoa.push([
    makeCell(examTitle, {
      font: { name: 'Arial', sz: 12, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    }),
    ...new Array(11).fill(null).map(() => makeCell('')),
  ]);
  merges.push({ s: { r: 3, c: 0 }, e: { r: 3, c: 11 } });

  // Dòng 5 (r: 4): THỐNG KÊ CHẤT LƯỢNG THEO GIÁO VIÊN (Căn giữa A..L)
  aoa.push([
    makeCell('THỐNG KÊ CHẤT LƯỢNG THEO GIÁO VIÊN', {
      font: { name: 'Arial', sz: 12, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    }),
    ...new Array(11).fill(null).map(() => makeCell('')),
  ]);
  merges.push({ s: { r: 4, c: 0 }, e: { r: 4, c: 11 } });

  // Dòng 6 (r: 5): Giáo viên: [Tên Giáo Viên] (tại Col B hoặc A..E)
  aoa.push([
    makeCell(''),
    makeCell(`Giáo viên: ${teacherName}`, {
      font: { name: 'Arial', sz: 11, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    }),
    ...new Array(10).fill(null).map(() => makeCell('')),
  ]);
  merges.push({ s: { r: 5, c: 1 }, e: { r: 5, c: 5 } });

  // Dòng 7 (r: 6): Trống
  aoa.push(new Array(12).fill(null).map(() => makeCell('')));

  // Dòng 8 (r: 7): Header tầng 1 của bảng
  aoa.push([
    makeCell('TT', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
    makeCell('Lớp', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
    makeCell('SL HS\ndự KT', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
    makeCell(`Chưa đạt\n(điểm < ${datMin})`, {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
    makeCell('', { border: cellBorderAll }),
    makeCell(`Đạt\n(${datMin}<= điểm <${khaMin})`, {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
    makeCell('', { border: cellBorderAll }),
    makeCell(`Khá\n(${khaMin}<= điểm <${totMin})`, {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
    makeCell('', { border: cellBorderAll }),
    makeCell(`Tốt\n(điểm >= ${totMin})`, {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
    makeCell('', { border: cellBorderAll }),
    makeCell('Điểm TB\nmôn của lớp', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
  ]);

  // Dòng 9 (r: 8): Header tầng 2 của bảng (SL / TL)
  aoa.push([
    makeCell('', { border: cellBorderAll }),
    makeCell('', { border: cellBorderAll }),
    makeCell('', { border: cellBorderAll }),
    makeCell('SL', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('TL', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('SL', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('TL', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('SL', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('TL', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('SL', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('TL', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('', { border: cellBorderAll }),
  ]);

  // Các ô gộp cho Table Header (r: 7 & r: 8)
  merges.push({ s: { r: 7, c: 0 }, e: { r: 8, c: 0 } }); // TT
  merges.push({ s: { r: 7, c: 1 }, e: { r: 8, c: 1 } }); // Lớp
  merges.push({ s: { r: 7, c: 2 }, e: { r: 8, c: 2 } }); // SL HS dự KT
  merges.push({ s: { r: 7, c: 3 }, e: { r: 7, c: 4 } }); // Chưa đạt
  merges.push({ s: { r: 7, c: 5 }, e: { r: 7, c: 6 } }); // Đạt
  merges.push({ s: { r: 7, c: 7 }, e: { r: 7, c: 8 } }); // Khá
  merges.push({ s: { r: 7, c: 9 }, e: { r: 7, c: 10 } }); // Tốt
  merges.push({ s: { r: 7, c: 11 }, e: { r: 8, c: 11 } }); // Điểm TB môn của lớp

  let currentRowIdx = 9;

  // Render từng Môn học và các lớp do GV phụ trách
  teacherGroupedData.forEach((group) => {
    // Dòng Tiêu đề Môn học: ví dụ "Môn: CNNN", "Môn: Sinh"
    const subjectRow = [
      makeCell(`Môn: ${group.subjectName}`, {
        font: { name: 'Arial', sz: 10.5, bold: true, color: { rgb: '000000' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: cellBorderAll,
      }),
      ...new Array(11).fill(null).map(() => makeCell('', { border: cellBorderAll })),
    ];
    aoa.push(subjectRow);
    merges.push({ s: { r: currentRowIdx, c: 0 }, e: { r: currentRowIdx, c: 11 } });
    currentRowIdx++;

    // Các dòng lớp học dưới môn này
    group.classes.forEach((clsRow) => {
      aoa.push([
        makeCell(clsRow.tt, {
          font: { name: 'Arial', sz: 10, color: { rgb: '000000' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }),
        makeCell(clsRow.lop, {
          font: { name: 'Arial', sz: 10, color: { rgb: '000000' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }),
        makeCell(clsRow.slDuKt, {
          font: { name: 'Arial', sz: 10, color: { rgb: '000000' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }),
        makeCell(clsRow.chuaDatSL, {
          font: { name: 'Arial', sz: 10, color: { rgb: '000000' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }),
        makeCell(clsRow.chuaDatTL, {
          font: { name: 'Arial', sz: 10, color: { rgb: '000000' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }),
        makeCell(clsRow.datSL, {
          font: { name: 'Arial', sz: 10, color: { rgb: '000000' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }),
        makeCell(clsRow.datTL, {
          font: { name: 'Arial', sz: 10, color: { rgb: '000000' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }),
        makeCell(clsRow.khaSL, {
          font: { name: 'Arial', sz: 10, color: { rgb: '000000' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }),
        makeCell(clsRow.khaTL, {
          font: { name: 'Arial', sz: 10, color: { rgb: '000000' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }),
        makeCell(clsRow.totSL, {
          font: { name: 'Arial', sz: 10, color: { rgb: '000000' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }),
        makeCell(clsRow.totTL, {
          font: { name: 'Arial', sz: 10, color: { rgb: '000000' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }),
        makeCell(clsRow.diemTb, {
          font: { name: 'Arial', sz: 10.5, bold: true, color: { rgb: '000000' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }),
      ]);
      currentRowIdx++;
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = merges;

  // Thiết lập độ rộng cột khớp hoàn hảo với mẫu
  ws['!cols'] = [
    { wch: 6 },  // A: TT
    { wch: 11 }, // B: Lớp
    { wch: 12 }, // C: SL HS dự KT
    { wch: 8 },  // D: Chưa đạt SL
    { wch: 9 },  // E: Chưa đạt TL
    { wch: 8 },  // F: Đạt SL
    { wch: 9 },  // G: Đạt TL
    { wch: 8 },  // H: Khá SL
    { wch: 9 },  // I: Khá TL
    { wch: 8 },  // J: Tốt SL
    { wch: 9 },  // K: Tốt TL
    { wch: 14 }, // L: Điểm TB môn của lớp
  ];

  // Thiết lập chiều cao dòng
  const rowsHeight: any[] = [];
  rowsHeight[0] = { hpt: 20 };
  rowsHeight[1] = { hpt: 20 };
  rowsHeight[2] = { hpt: 10 };
  rowsHeight[3] = { hpt: 24 };
  rowsHeight[4] = { hpt: 24 };
  rowsHeight[5] = { hpt: 22 };
  rowsHeight[6] = { hpt: 10 };
  rowsHeight[7] = { hpt: 26 };
  rowsHeight[8] = { hpt: 20 };
  for (let r = 9; r < currentRowIdx; r++) {
    rowsHeight[r] = { hpt: 20 };
  }
  ws['!rows'] = rowsHeight;

  return ws;
}

/**
 * Xuất file Excel "ThongKeChatLuong_Theo Giáo viên.xlsx" chứa đầy đủ các Sheet của từng Giáo viên
 * Đúng chuẩn hình ảnh mẫu: mỗi Giáo viên một tab sheet, hiển thị đủ số lớp và số môn GV đó dạy.
 */
export function exportQualityByTeacherExcelFile(
  students: StudentScore[],
  config: SystemConfig,
  globalFilter?: GlobalFilterState,
  specificTeacher?: string
) {
  const wb = XLSX.utils.book_new();

  // Danh sách các giáo viên duy nhất trong tập dữ liệu
  const allTeachers = Array.from(
    new Set(
      students
        .map((s) => (s.giaoVien || s.teacherName || '').trim())
        .filter((t): t is string => Boolean(t && t !== 'Chưa phân công'))
    )
  ).sort((a, b) => a.localeCompare(b, 'vi'));

  // Nếu chỉ xuất 1 giáo viên cụ thể được chọn
  let targetTeachers = allTeachers;
  if (specificTeacher && specificTeacher !== 'ALL') {
    targetTeachers = allTeachers.filter(
      (t) => t.toLowerCase() === specificTeacher.trim().toLowerCase()
    );
    if (targetTeachers.length === 0) {
      targetTeachers = [specificTeacher];
    }
  }

  // Nếu không có giáo viên nào, dùng tên mẫu
  if (targetTeachers.length === 0) {
    targetTeachers = ['Đào Thị Thanh Nga'];
  }

  const usedSheetNames = new Set<string>();

  targetTeachers.forEach((tch, idx) => {
    const groupedData = calculateTeacherGroupedStats(tch, students, config);

    // Chuẩn hóa tên Sheet: giới hạn tối đa 31 ký tự, không chứa ký tự cấm: \ / ? * : [ ]
    let sheetName = tch.replace(/[\\/?*:[\]]/g, '').trim().slice(0, 31);
    if (!sheetName) sheetName = `GV_${idx + 1}`;
    if (usedSheetNames.has(sheetName.toLowerCase())) {
      sheetName = `${sheetName.slice(0, 27)}_${idx + 1}`;
    }
    usedSheetNames.add(sheetName.toLowerCase());

    const ws = buildTeacherWorksheet(tch, groupedData, config, globalFilter);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const fileName = 'ThongKeChatLuong_Theo Giáo viên.xlsx';
  XLSX.writeFile(wb, fileName);
}
