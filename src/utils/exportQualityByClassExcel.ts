import XLSX from 'xlsx-js-style';
import { StudentScore, SystemConfig, GlobalFilterState } from '../types';
import { getReportHeaderInfo } from './syncExamInfo';
import {
  getShortSubjectName,
  calculateQualityClassStats,
} from './exportQualityBySubjectExcel';

// Thứ tự chuẩn của các môn học theo đúng mẫu báo cáo trường học:
// Toán -> Văn -> Tiếng Anh -> Vật lý -> Hóa -> Sinh -> Sử -> Địa -> KTPL -> Tin -> CNCN -> CNNN -> GDQP -> GDTC
export const STANDARD_CLASS_SUBJECT_ORDER = [
  'Toán',
  'Ngữ văn',
  'Văn',
  'Tiếng Anh',
  'Vật lí',
  'Vật lý',
  'Hóa học',
  'Hóa',
  'Sinh học',
  'Sinh',
  'Lịch sử',
  'Sử',
  'Địa lí',
  'Địa lý',
  'Địa',
  'Giáo dục KT&PL',
  'KTPL',
  'Kinh tế và Pháp luật',
  'Tin học',
  'Tin',
  'Công nghệ CN',
  'CNCN',
  'Công nghệ NN',
  'CNNN',
  'Công nghệ',
  'GDQP',
  'GDTC',
];

// Helper so sánh thứ tự chuẩn của môn học
export function compareSubjectsStandardOrder(subA: string, subB: string): number {
  const aShort = getShortSubjectName(subA);
  const bShort = getShortSubjectName(subB);

  const idxA = STANDARD_CLASS_SUBJECT_ORDER.findIndex(
    (s) => getShortSubjectName(s) === aShort || s === subA
  );
  const idxB = STANDARD_CLASS_SUBJECT_ORDER.findIndex(
    (s) => getShortSubjectName(s) === bShort || s === subB
  );

  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
  if (idxA !== -1) return -1;
  if (idxB !== -1) return 1;
  return aShort.localeCompare(bShort, 'vi');
}

// Định nghĩa các đường viền bảng tính
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
 * Xây dựng worksheet cho một Lớp cụ thể theo đúng chuẩn và mẫu ảnh gửi:
 * - Dòng 1: B1: SỞ GD&ĐT QUẢNG NGÃI | H1: Ngày in: dd/mm/yyyy
 * - Dòng 2: B2: TRƯỜNG PTDTNT THPT SA THẦY
 * - Dòng 4: KIỂM TRA GIỮA HỌC KỲ II - NĂM HỌC 2025 - 2026
 * - Dòng 5: THỐNG KÊ CHẤT LƯỢNG THEO LỚP
 * - Dòng 6: Lớp: [ClassName]
 * - Bảng 2 tầng header: TT | Môn | SL HS dự KT | Chưa đạt (điểm < 5) | Đạt (5<= điểm <6.5) | Khá (6.5<= điểm <8) | Tốt (điểm >= 8)
 *   Sub-header: SL | TL
 * - CHỈ XUẤT CÁC MÔN HỌC MÀ LỚP NÀY CÓ HỌC SINH DỰ KIỂM TRA (slDuKt > 0).
 * - Chân trang: NGƯỜI LẬP (Võ Chiến)
 */
export function buildClassWorksheet(
  className: string,
  allStudentsOfClass: StudentScore[],
  config: SystemConfig,
  currentDateStr: string,
  signerName: string = 'Võ Chiến',
  globalFilter?: GlobalFilterState
): XLSX.WorkSheet {
  // Lấy các môn mà học sinh lớp này tham gia
  const subjectMap: Record<string, StudentScore[]> = {};
  allStudentsOfClass.forEach((s) => {
    const subj = s.monHoc || s.subject || '';
    if (!subj) return;
    if (!subjectMap[subj]) subjectMap[subj] = [];
    subjectMap[subj].push(s);
  });

  // Lọc chỉ lấy các môn thực sự có học sinh dự kiểm tra (slDuKt > 0)
  // Các môn lớp này không học hoặc không có điểm kiểm tra sẽ BỊ LOẠI BỎ hoàn toàn!
  const activeSubjects = Object.keys(subjectMap).filter((subj) => {
    const st = calculateQualityClassStats(subjectMap[subj]);
    return st.slDuKt > 0;
  });

  // Sắp xếp các môn theo đúng thứ tự chuẩn trong chương trình giáo dục (Toán, Văn, Anh, Lý, Hóa, Sinh, Sử, Địa, KTPL, Tin, CN...)
  const sortedSubjects = activeSubjects.sort(compareSubjectsStandardOrder);

  // Mảng dữ liệu 2 chiều (AOA) - 11 cột (A..K)
  const aoa: any[][] = [];

  // Thông tin Đơn vị & Kỳ thi tự động đồng bộ từ Bộ lọc toàn cục
  const headerInfo = getReportHeaderInfo(config, globalFilter);
  const printDate = currentDateStr || headerInfo.currentDateStr;

  // Dòng 1 (Row 1): [TÊN TRƯỜNG / CƠ SỞ GD] (Viết hoa, in đậm) và Ngày in
  aoa.push([
    makeCell(''),
    makeCell(headerInfo.schoolName, { font: { name: 'Arial', sz: 10.5, bold: true, color: { rgb: '0F172A' } } }),
    makeCell(''),
    makeCell(''),
    makeCell(''),
    makeCell(''),
    makeCell(''),
    makeCell(`Ngày in: ${printDate}`, {
      font: { name: 'Arial', sz: 9.5, italic: true, color: { rgb: '475569' } },
      alignment: { horizontal: 'right' },
    }),
    makeCell(''),
    makeCell(''),
    makeCell(''),
  ]);

  // Dòng 2 (Row 2): TIÊU ĐỀ BÁO CÁO DẠNG IN ĐẬM, VIẾT HOA (Căn giữa A..K)
  aoa.push([
    makeCell(headerInfo.fullReportTitle, {
      font: { name: 'Arial', sz: 13, bold: true, color: { rgb: '1E3A8A' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    }),
    makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''),
  ]);

  // Dòng 3 (Row 3): Nhãn chi tiết: Đợt đánh giá: [Tên kỳ thi] | Học kỳ: [Học kỳ] | Năm học: [Năm học]
  aoa.push([
    makeCell(headerInfo.detailLabel, {
      font: { name: 'Arial', sz: 10, italic: true, color: { rgb: '475569' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    }),
    makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''),
  ]);

  // Dòng 4 (Row 4): THỐNG KÊ CHẤT LƯỢNG THEO LỚP (Căn giữa A..K)
  aoa.push([
    makeCell('THỐNG KÊ CHẤT LƯỢNG THEO LỚP', {
      font: { name: 'Arial', sz: 14, bold: true, color: { rgb: '1E40AF' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    }),
    makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''),
  ]);

  // Dòng 5 (Row 5): Lớp: [ClassName] (Căn trái ở cột A)
  aoa.push([
    makeCell(`Lớp:  ${className}`, {
      font: { name: 'Arial', sz: 11, bold: true, italic: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    }),
    makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''),
  ]);

  // Dòng 6 (Row 6): Khoảng trống
  aoa.push([makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell('')]);

  // Dòng 7 (Row 7): Header tầng 1 của bảng (A..K)
  aoa.push([
    makeCell('TT', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      fill: { fgColor: { rgb: 'F8FAFC' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
    makeCell('Môn', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      fill: { fgColor: { rgb: 'F8FAFC' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
    makeCell('SL\nHS\ndự KT', {
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '000000' } },
      fill: { fgColor: { rgb: 'F8FAFC' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
    makeCell('Chưa đạt\n(điểm < 5)', {
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '000000' } },
      fill: { fgColor: { rgb: 'FEE2E2' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
    makeCell('', { fill: { fgColor: { rgb: 'FEE2E2' } }, border: cellBorderAll }),
    makeCell('Đạt\n(5<= điểm\n<6.5)', {
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '000000' } },
      fill: { fgColor: { rgb: 'FEF3C7' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
    makeCell('', { fill: { fgColor: { rgb: 'FEF3C7' } }, border: cellBorderAll }),
    makeCell('Khá\n(6.5<= điểm\n<8)', {
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '000000' } },
      fill: { fgColor: { rgb: 'DBEAFE' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
    makeCell('', { fill: { fgColor: { rgb: 'DBEAFE' } }, border: cellBorderAll }),
    makeCell('Tốt\n(điểm >= 8)', {
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '000000' } },
      fill: { fgColor: { rgb: 'D1FAE5' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
    makeCell('', { fill: { fgColor: { rgb: 'D1FAE5' } }, border: cellBorderAll }),
  ]);

  // Dòng 8 (Row 8): Header tầng 2 của bảng (SL / TL)
  aoa.push([
    makeCell('', { fill: { fgColor: { rgb: 'F8FAFC' } }, border: cellBorderAll }),
    makeCell('', { fill: { fgColor: { rgb: 'F8FAFC' } }, border: cellBorderAll }),
    makeCell('', { fill: { fgColor: { rgb: 'F8FAFC' } }, border: cellBorderAll }),
    makeCell('SL', {
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '000000' } },
      fill: { fgColor: { rgb: 'FFF1F2' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('TL', {
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '000000' } },
      fill: { fgColor: { rgb: 'FFF1F2' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('SL', {
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '000000' } },
      fill: { fgColor: { rgb: 'FFFBEB' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('TL', {
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '000000' } },
      fill: { fgColor: { rgb: 'FFFBEB' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('SL', {
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '000000' } },
      fill: { fgColor: { rgb: 'EFF6FF' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('TL', {
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '000000' } },
      fill: { fgColor: { rgb: 'EFF6FF' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('SL', {
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '000000' } },
      fill: { fgColor: { rgb: 'ECFDF5' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('TL', {
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '000000' } },
      fill: { fgColor: { rgb: 'ECFDF5' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
  ]);

  const merges: XLSX.Range[] = [
    // Header dòng 1: B1:E1 (Tên trường), H1:K1 (Ngày in)
    { s: { r: 0, c: 1 }, e: { r: 0, c: 4 } },
    { s: { r: 0, c: 7 }, e: { r: 0, c: 10 } },
    // Header dòng 2 (Tiêu đề báo cáo in đậm viết hoa): A2:K2
    { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
    // Header dòng 3 (Nhãn chi tiết đợt đánh giá): A3:K3
    { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
    // Header dòng 4 (Thống kê chất lượng theo lớp): A4:K4
    { s: { r: 3, c: 0 }, e: { r: 3, c: 10 } },
    // Header dòng 5 (Lớp): A5:K5
    { s: { r: 4, c: 0 }, e: { r: 4, c: 10 } },
    // Table Header merges:
    { s: { r: 6, c: 0 }, e: { r: 7, c: 0 } }, // TT (A7:A8)
    { s: { r: 6, c: 1 }, e: { r: 7, c: 1 } }, // Môn (B7:B8)
    { s: { r: 6, c: 2 }, e: { r: 7, c: 2 } }, // SL HS dự KT (C7:C8)
    { s: { r: 6, c: 3 }, e: { r: 6, c: 4 } }, // Chưa đạt (D7:E7)
    { s: { r: 6, c: 5 }, e: { r: 6, c: 6 } }, // Đạt (F7:G7)
    { s: { r: 6, c: 7 }, e: { r: 6, c: 8 } }, // Khá (H7:I7)
    { s: { r: 6, c: 9 }, e: { r: 6, c: 10 } }, // Tốt (J7:K7)
  ];

  // Dữ liệu từng môn học
  let currentTT = 1;
  sortedSubjects.forEach((subj) => {
    const list = subjectMap[subj] || [];
    const st = calculateQualityClassStats(list);
    const shortName = getShortSubjectName(subj);

    aoa.push([
      makeCell(currentTT++, {
        font: { name: 'Arial', sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderAll,
      }, 'n'),
      makeCell(shortName, {
        font: { name: 'Arial', sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderAll,
      }),
      makeCell(st.slDuKt, {
        font: { name: 'Arial', sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderAll,
      }, 'n'),
      makeCell(st.chuaDatSl, {
        font: { name: 'Arial', sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderAll,
      }, 'n'),
      makeCell(`${st.chuaDatTl.toFixed(1)}%`, {
        font: { name: 'Arial', sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderAll,
      }),
      makeCell(st.datSl, {
        font: { name: 'Arial', sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderAll,
      }, 'n'),
      makeCell(`${st.datTl.toFixed(1)}%`, {
        font: { name: 'Arial', sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderAll,
      }),
      makeCell(st.khaSl, {
        font: { name: 'Arial', sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderAll,
      }, 'n'),
      makeCell(`${st.khaTl.toFixed(1)}%`, {
        font: { name: 'Arial', sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderAll,
      }),
      makeCell(st.totSl, {
        font: { name: 'Arial', sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderAll,
      }, 'n'),
      makeCell(`${st.totTl.toFixed(1)}%`, {
        font: { name: 'Arial', sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderAll,
      }),
    ]);
  });

  // Thêm 2 dòng trống có viền bảng như trong hình mẫu của người dùng
  for (let emptyRow = 0; emptyRow < 2; emptyRow++) {
    aoa.push([
      makeCell('', { border: cellBorderAll }),
      makeCell('', { border: cellBorderAll }),
      makeCell('', { border: cellBorderAll }),
      makeCell('', { border: cellBorderAll }),
      makeCell('', { border: cellBorderAll }),
      makeCell('', { border: cellBorderAll }),
      makeCell('', { border: cellBorderAll }),
      makeCell('', { border: cellBorderAll }),
      makeCell('', { border: cellBorderAll }),
      makeCell('', { border: cellBorderAll }),
      makeCell('', { border: cellBorderAll }),
    ]);
  }

  // Thêm các dòng trống trước phần ký tên
  aoa.push([makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell('')]);
  aoa.push([makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell('')]);

  // Chân trang: NGƯỜI LẬP (Cột B)
  aoa.push([
    makeCell(''),
    makeCell('NGƯỜI LẬP', {
      font: { name: 'Arial', sz: 10.5, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center' },
    }),
    makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''),
  ]);
  aoa.push([makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell('')]);
  aoa.push([makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell('')]);
  aoa.push([
    makeCell(''),
    makeCell(signerName, {
      font: { name: 'Arial', sz: 11, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center' },
    }),
    makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''),
  ]);

  // Tạo Sheet từ AOA
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Gán merges
  ws['!merges'] = merges;

  // Cấu hình độ rộng các cột (A..K)
  ws['!cols'] = [
    { wch: 6 },  // A: TT
    { wch: 16 }, // B: Môn
    { wch: 12 }, // C: SL HS dự KT
    { wch: 8 },  // D: Chưa đạt SL
    { wch: 11 }, // E: Chưa đạt TL
    { wch: 8 },  // F: Đạt SL
    { wch: 11 }, // G: Đạt TL
    { wch: 8 },  // H: Khá SL
    { wch: 11 }, // I: Khá TL
    { wch: 8 },  // J: Tốt SL
    { wch: 11 }, // K: Tốt TL
  ];

  // Cấu hình chiều cao các dòng
  const rowsConfig: { hpt: number }[] = [
    { hpt: 19 }, // Row 1 (School name & print date)
    { hpt: 26 }, // Row 2 (Báo cáo thống kê... in đậm viết hoa)
    { hpt: 18 }, // Row 3 (Nhãn chi tiết đợt đánh giá)
    { hpt: 22 }, // Row 4 (Thống kê chất lượng theo lớp)
    { hpt: 20 }, // Row 5 (Lớp: ...)
    { hpt: 10 }, // Row 6 (Khoảng trống)
    { hpt: 28 }, // Row 7 (Header 1: TT / Môn / SL HS / Chưa đạt / Đạt / Khá / Tốt)
    { hpt: 20 }, // Row 8 (Header 2: SL / TL)
  ];

  for (let i = 8; i < aoa.length; i++) {
    rowsConfig.push({ hpt: 21 });
  }
  ws['!rows'] = rowsConfig;

  return ws;
}

/**
 * Tạo và xuất file Excel "ThongKeChatLuong_Theo lớp.xlsx"
 * Bao gồm đầy đủ các sheet tương ứng với từng lớp học như trong hình ảnh:
 * 10B1 | 10B2 | 10B3 | 10B4 | 10B5 | 10B6 | 11B1 | 11B2 | 11B3 ...
 */
export function exportQualityByClassExcelFile(
  students: StudentScore[],
  config: SystemConfig,
  currentClassFilter?: string,
  globalFilter?: GlobalFilterState
) {
  const wb = XLSX.utils.book_new();

  // Danh sách các lớp có trong dữ liệu
  const existingClasses = Array.from(
    new Set(students.map((s) => s.lop || s.class || '').filter(Boolean))
  );

  // Lọc chỉ giữ các lớp thực sự có học sinh dự kiểm tra ở ít nhất 1 môn
  const activeClasses = existingClasses.filter((cls) => {
    const classStudents = students.filter((s) => (s.lop || s.class) === cls);
    const tested = classStudents.filter(
      (s) => s.diem !== null && s.diem !== undefined && !isNaN(Number(s.diem))
    );
    return tested.length > 0;
  });

  const classesToUse = activeClasses.length > 0 ? activeClasses : existingClasses;

  // Sắp xếp các lớp theo thứ tự tự nhiên (10B1, 10B2, ..., 11B1, ..., 12B1...)
  const sortedClasses = classesToUse.sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  // Nếu người dùng đang chọn 1 lớp cụ thể (khác 'ALL'), đưa tab lớp đó lên đầu tiên
  if (currentClassFilter && currentClassFilter !== 'ALL') {
    const foundIdx = sortedClasses.findIndex((c) => c === currentClassFilter);
    if (foundIdx > -1) {
      const item = sortedClasses.splice(foundIdx, 1)[0];
      sortedClasses.unshift(item);
    }
  }

  // Ngày in hiện tại theo định dạng DD/MM/YYYY
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const currentDateStr = `${day}/${month}/${year}`;

  const { periodCode } = getReportHeaderInfo(config, globalFilter);
  const sheetNamesUsed = new Set<string>();

  // Tạo từng worksheet cho từng lớp
  sortedClasses.forEach((cls) => {
    const classStudents = students.filter((s) => (s.lop || s.class) === cls);

    // 3. Tên Sheet của file Excel xuất ra cũng được đặt tự động theo công thức: [Tên môn/lớp]_[Mã đợt điểm]
    const cleanCls = cls.replace(/\s+/g, '');
    let tabName = `${cleanCls}_${periodCode}`.slice(0, 31);
    if (sheetNamesUsed.has(tabName)) {
      tabName = `${cleanCls}_${sheetNamesUsed.size}_${periodCode}`.slice(0, 31);
    }
    sheetNamesUsed.add(tabName);

    const ws = buildClassWorksheet(
      cls,
      classStudents,
      config,
      currentDateStr,
      'Võ Chiến',
      globalFilter
    );

    XLSX.utils.book_append_sheet(wb, ws, tabName);
  });

  // Xuất file với đúng tên đồng bộ đợt điểm
  XLSX.writeFile(wb, `ThongKeChatLuong_TheoLop_${periodCode}.xlsx`);
}
