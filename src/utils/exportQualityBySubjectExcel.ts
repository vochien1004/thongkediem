import XLSX from 'xlsx-js-style';
import { StudentScore, SystemConfig, GlobalFilterState } from '../types';
import { getReportHeaderInfo } from './syncExamInfo';

/**
 * Chuẩn hóa tên tab sheet của môn học theo format ngắn gọn quen thuộc
 * Khớp chính xác với hình ảnh: Toán | Văn | Tiếng Anh | Sử | Tin | Vật lý | Hóa | Sinh | Địa | KTPL | CNCN | CNNN
 */
export function getShortSubjectName(subject: string): string {
  const s = (subject || '').trim().toLowerCase();
  if (s === 'toán' || s === 'toan') return 'Toán';
  if (s === 'ngữ văn' || s === 'ngu van' || s === 'văn' || s === 'van') return 'Văn';
  if (s.includes('tiếng anh') || s.includes('ngoại ngữ') || s === 'anh' || s === 'english') return 'Tiếng Anh';
  if (s === 'lịch sử' || s === 'lich su' || s === 'sử' || s === 'su') return 'Sử';
  if (s === 'tin học' || s === 'tin hoc' || s === 'tin') return 'Tin';
  if (s === 'vật lí' || s === 'vật lý' || s === 'vat ly' || s === 'vat li' || s === 'lý' || s === 'lí') return 'Vật lý';
  if (s === 'hóa học' || s === 'hoa hoc' || s === 'hóa' || s === 'hoa') return 'Hóa';
  if (s === 'sinh học' || s === 'sinh hoc' || s === 'sinh') return 'Sinh';
  if (s === 'địa lí' || s === 'địa lý' || s === 'dia ly' || s === 'dia li' || s === 'địa' || s === 'dia') return 'Địa';
  if (s.includes('ktpl') || s.includes('kinh tế') || s.includes('pháp luật')) return 'KTPL';
  if (s.includes('cncn') || s.includes('công nghiệp')) return 'CNCN';
  if (s.includes('cnnn') || s.includes('nông nghiệp')) return 'CNNN';
  if (s.includes('công nghệ') || s === 'cn') return 'Công nghệ';
  if (s.includes('gdqp') || s.includes('quốc phòng')) return 'GDQP';
  if (s.includes('gdtc') || s.includes('thể dục')) return 'GDTC';

  return subject.slice(0, 30);
}

/**
 * Tên đầy đủ hiển thị tại dòng "Môn: ..." trên đầu trang
 */
export function getFullSubjectDisplayName(subject: string): string {
  const s = (subject || '').trim().toLowerCase();
  if (s === 'toán' || s === 'toan') return 'Toán';
  if (s === 'ngữ văn' || s === 'ngu van' || s === 'văn' || s === 'van') return 'Ngữ văn';
  if (s.includes('tiếng anh') || s.includes('ngoại ngữ') || s === 'anh') return 'Tiếng Anh';
  if (s === 'lịch sử' || s === 'lich su' || s === 'sử') return 'Lịch sử';
  if (s === 'tin học' || s === 'tin hoc' || s === 'tin') return 'Tin học';
  if (s.includes('vật lí') || s.includes('vật lý') || s === 'lý' || s === 'lí') return 'Vật lý';
  if (s === 'hóa học' || s === 'hoa hoc' || s === 'hóa') return 'Hóa học';
  if (s === 'sinh học' || s === 'sinh hoc' || s === 'sinh') return 'Sinh học';
  if (s.includes('địa')) return 'Địa lí';
  if (s.includes('ktpl') || s.includes('kinh tế')) return 'Giáo dục Kinh tế và Pháp luật';
  if (s.includes('cncn')) return 'CNCN';
  if (s.includes('cnnn')) return 'CNNN';
  return subject;
}

/**
 * Trích xuất khối (Grade) từ tên lớp hoặc trường khối
 * Ví dụ: "10B1" -> "10", "11B2" -> "11", "12B3" -> "12"
 */
export function extractGrade(className: string, rawGrade?: string): string {
  if (rawGrade) {
    const num = rawGrade.replace(/\D/g, '');
    if (num) return num;
  }
  const match = (className || '').match(/^(\d+)/);
  if (match) return match[1];
  return 'Khác';
}

/**
 * Tính toán số liệu thống kê chuẩn theo 4 thang điểm như mẫu ảnh:
 * - Chưa đạt: điểm < 5.0
 * - Đạt: 5.0 <= điểm < 6.5
 * - Khá: 6.5 <= điểm < 8.0
 * - Tốt: điểm >= 8.0
 */
export function calculateQualityClassStats(studentList: StudentScore[]) {
  // Chỉ tính các học sinh đã dự kiểm tra (có điểm hợp lệ)
  const tested = studentList.filter(
    (s) => s.diem !== null && s.diem !== undefined && !isNaN(Number(s.diem))
  );
  const slDuKt = tested.length;

  if (slDuKt === 0) {
    return {
      slDuKt: 0,
      chuaDatSl: 0,
      chuaDatTl: 0,
      datSl: 0,
      datTl: 0,
      khaSl: 0,
      khaTl: 0,
      totSl: 0,
      totTl: 0,
      diemTb: 0,
    };
  }

  let chuaDatSl = 0;
  let datSl = 0;
  let khaSl = 0;
  let totSl = 0;
  let sumScore = 0;

  tested.forEach((s) => {
    const d = Number(s.diem);
    sumScore += d;
    if (d < 5.0) {
      chuaDatSl++;
    } else if (d < 6.5) {
      datSl++;
    } else if (d < 8.0) {
      khaSl++;
    } else {
      totSl++;
    }
  });

  const chuaDatTl = (chuaDatSl / slDuKt) * 100;
  const datTl = (datSl / slDuKt) * 100;
  const khaTl = (khaSl / slDuKt) * 100;
  const totTl = (totSl / slDuKt) * 100;
  const diemTb = Number((sumScore / slDuKt).toFixed(1));

  return {
    slDuKt,
    chuaDatSl,
    chuaDatTl,
    datSl,
    datTl,
    khaSl,
    khaTl,
    totSl,
    totTl,
    diemTb,
  };
}

// Border definitions
const BORDER_BLACK_THIN = { style: 'thin', color: { rgb: '000000' } };
const BORDER_BLACK_MEDIUM = { style: 'medium', color: { rgb: '000000' } };
const BORDER_BLACK_DOUBLE = { style: 'double', color: { rgb: '000000' } };

const cellBorderAll = {
  top: BORDER_BLACK_THIN,
  bottom: BORDER_BLACK_THIN,
  left: BORDER_BLACK_THIN,
  right: BORDER_BLACK_THIN,
};

const cellBorderTotalKhối = {
  top: BORDER_BLACK_THIN,
  bottom: BORDER_BLACK_MEDIUM,
  left: BORDER_BLACK_THIN,
  right: BORDER_BLACK_THIN,
};

const cellBorderTotalSchool = {
  top: BORDER_BLACK_MEDIUM,
  bottom: BORDER_BLACK_DOUBLE,
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
 * Xây dựng worksheet cho một môn học cụ thể theo đúng chuẩn và phong cách thẩm mỹ:
 * - Bảng phân cấp 2 tầng header, có phối màu nhẹ nhàng đúng chuẩn chương trình:
 *   Chưa đạt (đỏ nhạt), Đạt (vàng nhạt), Khá (xanh dương nhạt), Tốt (xanh lá nhạt).
 * - ĐẶC BIỆT: Các lớp không có học sinh dự kiểm tra (không học môn này) sẽ BỊ LOẠI BỎ hoàn toàn.
 * - Nhóm theo Khối (10, 11, 12...) kèm dòng TỔNG KHỐI in hoa đậm.
 * - Dòng TỔNG TOÀN TRƯỜNG nổi bật cuối bảng.
 */
export function buildSubjectWorksheet(
  subjectOriginalName: string,
  allStudentsOfSubject: StudentScore[],
  config: SystemConfig,
  currentDateStr: string,
  signerName: string = 'Võ Chiến',
  globalFilter?: GlobalFilterState
): XLSX.WorkSheet {
  // LỌC CHÍNH XÁC CÁC HỌC SINH THUỘC ĐÚNG MÔN HỌC NÀY:
  const subjectStudents = allStudentsOfSubject.filter((s) => {
    const m = s.monHoc || s.subject;
    if (!m) return true;
    return m === subjectOriginalName || getShortSubjectName(m) === getShortSubjectName(subjectOriginalName);
  });

  // LẤY DANH SÁCH LỚP:
  // CHỈ LẤY CÁC LỚP CÓ HỌC SINH DỰ KIỂM TRA MÔN NÀY (slDuKt > 0)
  // Các lớp không học môn này (hoặc 0 học sinh dự KT) sẽ KHÔNG XUẤT RA!
  const uniqueClassesInSubject = Array.from(
    new Set(subjectStudents.map((s) => s.lop || s.class || '').filter(Boolean))
  );

  const targetClasses = uniqueClassesInSubject.filter((cls) => {
    const classStudents = subjectStudents.filter((s) => (s.lop || s.class) === cls);
    const st = calculateQualityClassStats(classStudents);
    return st.slDuKt > 0;
  });

  // Gom các lớp hợp lệ theo Khối (10, 11, 12, ...)
  const gradeMap: Record<string, string[]> = {};
  targetClasses.forEach((cls) => {
    const rep = subjectStudents.find((s) => (s.lop || s.class) === cls);
    const gr = extractGrade(cls, rep?.khoi || rep?.grade);
    if (!gradeMap[gr]) gradeMap[gr] = [];
    gradeMap[gr].push(cls);
  });

  // Sắp xếp các khối theo thứ tự tự nhiên (10, 11, 12...)
  // Chỉ lấy các khối có ít nhất 1 lớp có học sinh học môn này
  const sortedGrades = Object.keys(gradeMap)
    .filter((gr) => gradeMap[gr] && gradeMap[gr].length > 0)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  // Mảng dữ liệu 2 chiều (AOA)
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
    makeCell(''),
  ]);

  // Dòng 2 (Row 2): TIÊU ĐỀ BÁO CÁO DẠNG IN ĐẬM, VIẾT HOA (Căn giữa A..L)
  aoa.push([
    makeCell(headerInfo.fullReportTitle, {
      font: { name: 'Arial', sz: 13, bold: true, color: { rgb: '1E3A8A' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    }),
    makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''),
  ]);

  // Dòng 3 (Row 3): Nhãn chi tiết: Đợt đánh giá: [Tên kỳ thi] | Học kỳ: [Học kỳ] | Năm học: [Năm học]
  aoa.push([
    makeCell(headerInfo.detailLabel, {
      font: { name: 'Arial', sz: 10, italic: true, color: { rgb: '475569' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    }),
    makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''),
  ]);

  // Dòng 4 (Row 4): THỐNG KÊ CHẤT LƯỢNG THEO MÔN HỌC (Căn giữa A..L, chữ xanh đậm như app)
  aoa.push([
    makeCell('THỐNG KÊ CHẤT LƯỢNG THEO MÔN HỌC', {
      font: { name: 'Arial', sz: 14, bold: true, color: { rgb: '1E3A8A' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    }),
    makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''),
  ]);

  // Dòng 6 (Row 6): Môn: [Tên môn] (Căn giữa A..L)
  aoa.push([
    makeCell(`Môn: ${getFullSubjectDisplayName(subjectOriginalName)}`, {
      font: { name: 'Arial', sz: 12, bold: true, color: { rgb: '1E40AF' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    }),
    makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''),
  ]);

  // Dòng 7 (Row 7): Khoảng trống trước bảng
  aoa.push([makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell('')]);

  // Dòng 8 (Row 8): Header tầng 1 của bảng
  aoa.push([
    makeCell('TT', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '0F172A' } },
      fill: { fgColor: { rgb: 'F1F5F9' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
    makeCell('Lớp', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '0F172A' } },
      fill: { fgColor: { rgb: 'F1F5F9' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
    makeCell('SL HS dự KT', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '0F172A' } },
      fill: { fgColor: { rgb: 'F1F5F9' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
    makeCell('Chưa đạt (điểm < 5)', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '991B1B' } },
      fill: { fgColor: { rgb: 'FEE2E2' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
    makeCell('', { fill: { fgColor: { rgb: 'FEE2E2' } }, border: cellBorderAll }),
    makeCell('Đạt (5 <= điểm < 6.5)', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '92400E' } },
      fill: { fgColor: { rgb: 'FEF3C7' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
    makeCell('', { fill: { fgColor: { rgb: 'FEF3C7' } }, border: cellBorderAll }),
    makeCell('Khá (6.5 <= điểm < 8)', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '1E40AF' } },
      fill: { fgColor: { rgb: 'DBEAFE' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
    makeCell('', { fill: { fgColor: { rgb: 'DBEAFE' } }, border: cellBorderAll }),
    makeCell('Tốt (điểm >= 8)', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '065F46' } },
      fill: { fgColor: { rgb: 'D1FAE5' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
    makeCell('', { fill: { fgColor: { rgb: 'D1FAE5' } }, border: cellBorderAll }),
    makeCell('Điểm TB lớp', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '0F172A' } },
      fill: { fgColor: { rgb: 'F1F5F9' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderAll,
    }),
  ]);

  // Dòng 9 (Row 9): Header tầng 2 của bảng (SL / TL)
  aoa.push([
    makeCell('', { fill: { fgColor: { rgb: 'F1F5F9' } }, border: cellBorderAll }),
    makeCell('', { fill: { fgColor: { rgb: 'F1F5F9' } }, border: cellBorderAll }),
    makeCell('', { fill: { fgColor: { rgb: 'F1F5F9' } }, border: cellBorderAll }),
    makeCell('SL', {
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '991B1B' } },
      fill: { fgColor: { rgb: 'FFF1F2' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('TL', {
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '991B1B' } },
      fill: { fgColor: { rgb: 'FFF1F2' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('SL', {
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '92400E' } },
      fill: { fgColor: { rgb: 'FFFBEB' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('TL', {
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '92400E' } },
      fill: { fgColor: { rgb: 'FFFBEB' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('SL', {
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '1E40AF' } },
      fill: { fgColor: { rgb: 'EFF6FF' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('TL', {
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '1E40AF' } },
      fill: { fgColor: { rgb: 'EFF6FF' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('SL', {
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '065F46' } },
      fill: { fgColor: { rgb: 'ECFDF5' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('TL', {
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '065F46' } },
      fill: { fgColor: { rgb: 'ECFDF5' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderAll,
    }),
    makeCell('', { fill: { fgColor: { rgb: 'F1F5F9' } }, border: cellBorderAll }),
  ]);

  const merges: XLSX.Range[] = [
    // Header dòng 1: B1:F1 (Tên trường), H1:L1 (Ngày in)
    { s: { r: 0, c: 1 }, e: { r: 0, c: 5 } },
    { s: { r: 0, c: 7 }, e: { r: 0, c: 11 } },
    // Header dòng 2 (Tiêu đề báo cáo in đậm viết hoa): A2:L2
    { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },
    // Header dòng 3 (Nhãn chi tiết đợt đánh giá): A3:L3
    { s: { r: 2, c: 0 }, e: { r: 2, c: 11 } },
    // Header dòng 4 (Thống kê chất lượng theo môn học): A4:L4
    { s: { r: 3, c: 0 }, e: { r: 3, c: 11 } },
    // Header dòng 5 (Môn: ...): A5:L5
    { s: { r: 4, c: 0 }, e: { r: 4, c: 11 } },
    // Table Header merges:
    { s: { r: 6, c: 0 }, e: { r: 7, c: 0 } }, // TT (A7:A8)
    { s: { r: 6, c: 1 }, e: { r: 7, c: 1 } }, // Lớp (B7:B8)
    { s: { r: 6, c: 2 }, e: { r: 7, c: 2 } }, // SL HS dự KT (C7:C8)
    { s: { r: 6, c: 3 }, e: { r: 6, c: 4 } }, // Chưa đạt (D7:E7)
    { s: { r: 6, c: 5 }, e: { r: 6, c: 6 } }, // Đạt (F7:G7)
    { s: { r: 6, c: 7 }, e: { r: 6, c: 8 } }, // Khá (H7:I7)
    { s: { r: 6, c: 9 }, e: { r: 6, c: 10 } }, // Tốt (J7:K7)
    { s: { r: 6, c: 11 }, e: { r: 7, c: 11 } }, // Điểm TB lớp (L7:L8)
  ];

  let currentTT = 1;
  const allTestedStudentsInSchoolForSubject: StudentScore[] = [];

  // Lặp qua từng khối có lớp học môn này
  sortedGrades.forEach((grade) => {
    const classesOfGrade = gradeMap[grade].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    const gradeStudents: StudentScore[] = [];

    classesOfGrade.forEach((cls) => {
      const classStudents = subjectStudents.filter(
        (s) => (s.lop || s.class) === cls
      );
      gradeStudents.push(...classStudents);
      allTestedStudentsInSchoolForSubject.push(...classStudents);

      const st = calculateQualityClassStats(classStudents);

      // Thêm dòng từng lớp
      aoa.push([
        makeCell(currentTT++, {
          font: { name: 'Arial', sz: 10 },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }, 'n'),
        makeCell(cls, {
          font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '0F172A' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }),
        makeCell(st.slDuKt, {
          font: { name: 'Arial', sz: 10, bold: true },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }, 'n'),
        makeCell(st.chuaDatSl, {
          font: {
            name: 'Arial',
            sz: 10,
            bold: st.chuaDatSl > 0,
            color: { rgb: st.chuaDatSl > 0 ? 'DC2626' : '000000' },
          },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }, 'n'),
        makeCell(`${st.chuaDatTl.toFixed(1)}%`, {
          font: { name: 'Arial', sz: 10 },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }),
        makeCell(st.datSl, {
          font: {
            name: 'Arial',
            sz: 10,
            bold: st.datSl > 0,
            color: { rgb: st.datSl > 0 ? 'D97706' : '000000' },
          },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }, 'n'),
        makeCell(`${st.datTl.toFixed(1)}%`, {
          font: { name: 'Arial', sz: 10 },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }),
        makeCell(st.khaSl, {
          font: {
            name: 'Arial',
            sz: 10,
            bold: st.khaSl > 0,
            color: { rgb: st.khaSl > 0 ? '2563EB' : '000000' },
          },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }, 'n'),
        makeCell(`${st.khaTl.toFixed(1)}%`, {
          font: { name: 'Arial', sz: 10 },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }),
        makeCell(st.totSl, {
          font: {
            name: 'Arial',
            sz: 10,
            bold: st.totSl > 0,
            color: { rgb: st.totSl > 0 ? '059669' : '000000' },
          },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }, 'n'),
        makeCell(`${st.totTl.toFixed(1)}%`, {
          font: { name: 'Arial', sz: 10 },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }),
        makeCell(st.slDuKt > 0 ? st.diemTb.toFixed(1) : '', {
          font: { name: 'Arial', sz: 10.5, bold: true, color: { rgb: '0F172A' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: cellBorderAll,
        }),
      ]);
    });

    // Dòng TỔNG KHỐI [grade] (in hoa, đậm, màu nền xám nhạt như web)
    const gradeStats = calculateQualityClassStats(gradeStudents);
    aoa.push([
      makeCell('', { fill: { fgColor: { rgb: 'F1F5F9' } }, border: cellBorderTotalKhối }),
      makeCell(`TỔNG KHỐI ${grade}`, {
        font: { name: 'Arial', sz: 10.5, bold: true, color: { rgb: '0F172A' } },
        fill: { fgColor: { rgb: 'F1F5F9' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderTotalKhối,
      }),
      makeCell(gradeStats.slDuKt, {
        font: { name: 'Arial', sz: 10.5, bold: true },
        fill: { fgColor: { rgb: 'F1F5F9' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderTotalKhối,
      }, 'n'),
      makeCell(gradeStats.chuaDatSl, {
        font: { name: 'Arial', sz: 10.5, bold: true, color: { rgb: 'B91C1C' } },
        fill: { fgColor: { rgb: 'F1F5F9' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderTotalKhối,
      }, 'n'),
      makeCell(`${gradeStats.chuaDatTl.toFixed(1)}%`, {
        font: { name: 'Arial', sz: 10.5, bold: true },
        fill: { fgColor: { rgb: 'F1F5F9' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderTotalKhối,
      }),
      makeCell(gradeStats.datSl, {
        font: { name: 'Arial', sz: 10.5, bold: true, color: { rgb: 'B45309' } },
        fill: { fgColor: { rgb: 'F1F5F9' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderTotalKhối,
      }, 'n'),
      makeCell(`${gradeStats.datTl.toFixed(1)}%`, {
        font: { name: 'Arial', sz: 10.5, bold: true },
        fill: { fgColor: { rgb: 'F1F5F9' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderTotalKhối,
      }),
      makeCell(gradeStats.khaSl, {
        font: { name: 'Arial', sz: 10.5, bold: true, color: { rgb: '1D4ED8' } },
        fill: { fgColor: { rgb: 'F1F5F9' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderTotalKhối,
      }, 'n'),
      makeCell(`${gradeStats.khaTl.toFixed(1)}%`, {
        font: { name: 'Arial', sz: 10.5, bold: true },
        fill: { fgColor: { rgb: 'F1F5F9' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderTotalKhối,
      }),
      makeCell(gradeStats.totSl, {
        font: { name: 'Arial', sz: 10.5, bold: true, color: { rgb: '047857' } },
        fill: { fgColor: { rgb: 'F1F5F9' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderTotalKhối,
      }, 'n'),
      makeCell(`${gradeStats.totTl.toFixed(1)}%`, {
        font: { name: 'Arial', sz: 10.5, bold: true },
        fill: { fgColor: { rgb: 'F1F5F9' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderTotalKhối,
      }),
      makeCell(gradeStats.slDuKt > 0 ? gradeStats.diemTb.toFixed(1) : '', {
        font: { name: 'Arial', sz: 11, bold: true, color: { rgb: '0F172A' } },
        fill: { fgColor: { rgb: 'F1F5F9' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderTotalKhối,
      }),
    ]);
  });

  // Dòng TỔNG TOÀN TRƯỜNG (in hoa, viền đôi phía dưới, cực kỳ nổi bật)
  const schoolStats = calculateQualityClassStats(allTestedStudentsInSchoolForSubject);
  aoa.push([
    makeCell('', { fill: { fgColor: { rgb: 'E2E8F0' } }, border: cellBorderTotalSchool }),
    makeCell('TỔNG TOÀN TRƯỜNG', {
      font: { name: 'Arial', sz: 11, bold: true, color: { rgb: '020617' } },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderTotalSchool,
    }),
    makeCell(schoolStats.slDuKt, {
      font: { name: 'Arial', sz: 11, bold: true },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderTotalSchool,
    }, 'n'),
    makeCell(schoolStats.chuaDatSl, {
      font: { name: 'Arial', sz: 11, bold: true, color: { rgb: '991B1B' } },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderTotalSchool,
    }, 'n'),
    makeCell(`${schoolStats.chuaDatTl.toFixed(1)}%`, {
      font: { name: 'Arial', sz: 11, bold: true },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderTotalSchool,
    }),
    makeCell(schoolStats.datSl, {
      font: { name: 'Arial', sz: 11, bold: true, color: { rgb: '92400E' } },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderTotalSchool,
    }, 'n'),
    makeCell(`${schoolStats.datTl.toFixed(1)}%`, {
      font: { name: 'Arial', sz: 11, bold: true },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderTotalSchool,
    }),
    makeCell(schoolStats.khaSl, {
      font: { name: 'Arial', sz: 11, bold: true, color: { rgb: '1E40AF' } },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderTotalSchool,
    }, 'n'),
    makeCell(`${schoolStats.khaTl.toFixed(1)}%`, {
      font: { name: 'Arial', sz: 11, bold: true },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderTotalSchool,
    }),
    makeCell(schoolStats.totSl, {
      font: { name: 'Arial', sz: 11, bold: true, color: { rgb: '065F46' } },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderTotalSchool,
    }, 'n'),
    makeCell(`${schoolStats.totTl.toFixed(1)}%`, {
      font: { name: 'Arial', sz: 11, bold: true },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderTotalSchool,
    }),
    makeCell(schoolStats.slDuKt > 0 ? schoolStats.diemTb.toFixed(1) : '', {
      font: { name: 'Arial', sz: 11.5, bold: true, color: { rgb: '0F172A' } },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderTotalSchool,
    }),
  ]);

  // Thêm 2 dòng trống trước footer
  aoa.push([makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell('')]);
  aoa.push([makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell('')]);

  // Footer: NGƯỜI LẬP (Cột B)
  aoa.push([
    makeCell(''),
    makeCell('NGƯỜI LẬP', {
      font: { name: 'Arial', sz: 10.5, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center' },
    }),
    makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''),
  ]);
  aoa.push([makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell('')]);
  aoa.push([makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell('')]);
  aoa.push([
    makeCell(''),
    makeCell(signerName, {
      font: { name: 'Arial', sz: 11, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center' },
    }),
    makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''),
  ]);

  // Tạo Sheet từ AOA
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Gán merges
  ws['!merges'] = merges;

  // Cấu hình độ rộng các cột
  ws['!cols'] = [
    { wch: 6 },  // A: TT
    { wch: 20 }, // B: Lớp / Tổng khối / Tổng toàn trường
    { wch: 14 }, // C: SL HS dự KT
    { wch: 9 },  // D: Chưa đạt SL
    { wch: 11 }, // E: Chưa đạt TL
    { wch: 9 },  // F: Đạt SL
    { wch: 11 }, // G: Đạt TL
    { wch: 9 },  // H: Khá SL
    { wch: 11 }, // I: Khá TL
    { wch: 9 },  // J: Tốt SL
    { wch: 11 }, // K: Tốt TL
    { wch: 14 }, // L: Điểm TB lớp
  ];

  // Cấu hình chiều cao các dòng
  const rowsConfig: { hpt: number }[] = [
    { hpt: 19 }, // Row 1 (School name & print date)
    { hpt: 26 }, // Row 2 (Báo cáo thống kê... in đậm viết hoa)
    { hpt: 18 }, // Row 3 (Nhãn chi tiết đợt đánh giá)
    { hpt: 22 }, // Row 4 (Thống kê chất lượng theo môn học)
    { hpt: 20 }, // Row 5 (Môn: ...)
    { hpt: 10 }, // Row 6 (Khoảng trống)
    { hpt: 28 }, // Row 7 (Header 1)
    { hpt: 20 }, // Row 8 (Header 2)
  ];

  // Áp dụng chiều cao cho tất cả dòng còn lại
  for (let i = 8; i < aoa.length; i++) {
    rowsConfig.push({ hpt: 21 });
  }
  ws['!rows'] = rowsConfig;

  return ws;
}

/**
 * Tạo và xuất file Excel "ThongKeChatLuong_Theo môn.xlsx"
 * Bao gồm đầy đủ các sheet tương ứng với từng môn học như trong hình ảnh:
 * Toán | Văn | Tiếng Anh | Sử | Tin | Vật lý | Hóa | Sinh | Địa | KTPL | CNCN | CNNN ...
 */
export function exportQualityBySubjectExcelFile(
  students: StudentScore[],
  config: SystemConfig,
  currentSubjectFilter?: string,
  globalFilter?: GlobalFilterState
) {
  const wb = XLSX.utils.book_new();

  // Danh sách các môn có trong dữ liệu
  const existingSubjects = Array.from(
    new Set(students.map((s) => s.monHoc || s.subject || '').filter(Boolean))
  );

  // Danh sách thứ tự chuẩn của các môn học theo đúng giao diện ảnh:
  // Toán | Văn | Tiếng Anh | Sử | Tin | Vật lý | Hóa | Sinh | Địa | KTPL | CNCN | CNNN
  const standardSubjects = [
    'Toán',
    'Ngữ văn',
    'Tiếng Anh',
    'Lịch sử',
    'Tin học',
    'Vật lí',
    'Hóa học',
    'Sinh học',
    'Địa lí',
    'Giáo dục KT&PL',
    'Công nghệ CN',
    'Công nghệ NN',
  ];

  // Danh sách môn sẽ tạo: ưu tiên các môn hiện có trong dữ liệu
  const allTargetSubjects = [...existingSubjects];
  standardSubjects.forEach((std) => {
    const exists = allTargetSubjects.some(
      (ex) => getShortSubjectName(ex) === getShortSubjectName(std)
    );
    if (!exists) {
      allTargetSubjects.push(std);
    }
  });

  // Lọc chỉ giữ các môn thực sự có học sinh tham gia dự kiểm tra
  const activeSubjects = allTargetSubjects.filter((subName) => {
    const subStudents = students.filter((s) => {
      const m = s.monHoc || s.subject || '';
      return m === subName || getShortSubjectName(m) === getShortSubjectName(subName);
    });
    const tested = subStudents.filter(
      (s) => s.diem !== null && s.diem !== undefined && !isNaN(Number(s.diem))
    );
    return tested.length > 0;
  });

  // Nếu lọc xong mà rỗng (trường hợp hiếm), giữ lại allTargetSubjects
  const subjectsToUse = activeSubjects.length > 0 ? activeSubjects : allTargetSubjects;

  // Sắp xếp các môn theo đúng thứ tự tab trong ảnh
  const sortedSubjects = subjectsToUse.sort((a, b) => {
    const aShort = getShortSubjectName(a);
    const bShort = getShortSubjectName(b);
    const aIdx = standardSubjects.findIndex((s) => getShortSubjectName(s) === aShort);
    const bIdx = standardSubjects.findIndex((s) => getShortSubjectName(s) === bShort);

    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b, 'vi');
  });

  // Nếu người dùng đang chọn 1 môn cụ thể (khác 'ALL'), đưa môn đó lên đầu tiên
  if (currentSubjectFilter && currentSubjectFilter !== 'ALL') {
    const foundIdx = sortedSubjects.findIndex(
      (s) => s === currentSubjectFilter || getShortSubjectName(s) === getShortSubjectName(currentSubjectFilter)
    );
    if (foundIdx > -1) {
      const item = sortedSubjects.splice(foundIdx, 1)[0];
      sortedSubjects.unshift(item);
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

  // Tạo từng worksheet
  sortedSubjects.forEach((subName) => {
    // Tìm các sinh viên thuộc môn này (so sánh cả tên gốc lẫn short name)
    const subStudents = students.filter((s) => {
      const m = s.monHoc || s.subject || '';
      return m === subName || getShortSubjectName(m) === getShortSubjectName(subName);
    });

    // 3. Tên Sheet của file Excel xuất ra cũng được đặt tự động theo công thức: [Tên môn/lớp]_[Mã đợt điểm]
    const shortSub = getShortSubjectName(subName).replace(/\s+/g, '');
    let tabName = `${shortSub}_${periodCode}`.slice(0, 31);
    if (sheetNamesUsed.has(tabName)) {
      tabName = `${shortSub}_${sheetNamesUsed.size}_${periodCode}`.slice(0, 31);
    }
    sheetNamesUsed.add(tabName);

    const ws = buildSubjectWorksheet(
      subName,
      subStudents,
      config,
      currentDateStr,
      'Võ Chiến',
      globalFilter
    );

    XLSX.utils.book_append_sheet(wb, ws, tabName);
  });

  // Xuất file với tên đồng bộ đợt điểm
  XLSX.writeFile(wb, `ThongKeChatLuong_TheoMon_${periodCode}.xlsx`);
}
