import XLSX from 'xlsx-js-style';
import { StudentScore, SystemConfig, GlobalFilterState } from '../types';
import { getReportHeaderInfo } from './syncExamInfo';
import { mapSubjectToStandardColumn } from './exportQuantityNeedAttentionExcel';
import { STANDARD_SHEET_SUBJECTS } from './exportListNeedAttentionExcel';

// Ngưỡng điểm quan tâm đặc biệt (<= 3.5 điểm)
export const SPECIAL_ATTENTION_THRESHOLD = 3.5;

// Viền ô màu đen mảnh
const BORDER_BLACK_THIN = { style: 'thin', color: { rgb: '000000' } };
const cellBorderAll = {
  top: BORDER_BLACK_THIN,
  bottom: BORDER_BLACK_THIN,
  left: BORDER_BLACK_THIN,
  right: BORDER_BLACK_THIN,
};

const FONT_FAMILY = 'Times New Roman';

/**
 * Tạo cell có style cho xlsx-js-style
 */
function makeCell(value: any, style: any = {}, type?: 's' | 'n' | 'b' | 'e') {
  const cellObj: any = {
    v: value ?? '',
    s: {
      font: { name: FONT_FAMILY, sz: 11, ...style.font },
      alignment: { vertical: 'center', ...style.alignment },
      border: style.border,
      fill: style.fill,
    },
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
 * Xuất file Excel "Danh sách học sinh cần quan tâm đặc biệt theo môn ở các lớp" (điểm <= 3.5)
 * Định dạng chuẩn theo mẫu hình ảnh:
 * - Mỗi sheet là 1 môn (Toán, Văn, Tiếng Anh, Sử, Tin, Vật lý, Hóa, Sinh, Địa, KTPL, CNCN, CNNN)
 * - Mỗi sheet hiển thị danh sách các lớp có HS cần quan tâm đặc biệt (có tham gia thi và điểm <= 3.5)
 * - Thứ tự lớp từ trên xuống dưới, kèm tiêu đề "Lớp: X (Gồm có N HS cần quan tâm đặc biệt)"
 */
export function exportSpecialAttentionExcel(
  students: StudentScore[],
  config: SystemConfig,
  globalFilter?: GlobalFilterState
) {
  const wb = XLSX.utils.book_new();
  const headerInfo = getReportHeaderInfo(config, globalFilter);

  // Lấy danh sách tất cả các môn trong dữ liệu
  const allSubjectsInData = Array.from(
    new Set(students.map((s) => s.monHoc || s.subject).filter((s): s is string => Boolean(s)))
  );

  const distinctMappedSubjects = new Set<string>();
  allSubjectsInData.forEach((s) => {
    distinctMappedSubjects.add(mapSubjectToStandardColumn(s) || s);
  });

  // Thứ tự các sheet môn học: ưu tiên 12 môn chuẩn, sau đó là các môn khác nếu có
  const subjectsToExport: string[] = [];
  STANDARD_SHEET_SUBJECTS.forEach((sub) => {
    subjectsToExport.push(sub);
  });

  distinctMappedSubjects.forEach((sub) => {
    if (!subjectsToExport.includes(sub)) {
      subjectsToExport.push(sub);
    }
  });

  // Chuẩn bị tiêu đề đợt kiểm tra theo chuẩn
  let examHeader = 'KIỂM TRA GIỮA HKII - NĂM HỌC 2025 - 2026';
  if (globalFilter) {
    const isKS = globalFilter.period === 'KS' || globalFilter.semester === 'KS';
    const isHK2 = globalFilter.semester === 'HK2';
    const isGKII = globalFilter.period === 'GKII' || (globalFilter.period === 'GKI' && isHK2);
    const isCKII = globalFilter.period === 'CKII' || (globalFilter.period === 'CKI' && isHK2);
    const isGKI = globalFilter.period === 'GKI' && !isHK2;
    const isCKI = globalFilter.period === 'CKI' && !isHK2;

    const acadYear = headerInfo.academicYear;

    if (isKS) {
      examHeader = `KHẢO SÁT ĐẦU NĂM - NĂM HỌC ${acadYear}`;
    } else if (isGKII) {
      examHeader = `KIỂM TRA GIỮA HKII - NĂM HỌC ${acadYear}`;
    } else if (isCKII) {
      examHeader = `KIỂM TRA CUỐI HKII - NĂM HỌC ${acadYear}`;
    } else if (isGKI) {
      examHeader = `KIỂM TRA GIỮA HKI - NĂM HỌC ${acadYear}`;
    } else if (isCKI) {
      examHeader = `KIỂM TRA CUỐI HKI - NĂM HỌC ${acadYear}`;
    } else {
      examHeader = `${headerInfo.examName.toUpperCase()} - NĂM HỌC ${acadYear}`;
    }
  }

  // Tạo từng Sheet cho từng môn học
  subjectsToExport.forEach((subjectName) => {
    const sheetData: any[][] = [];
    const merges: XLSX.Range[] = [];
    let currentRow = 0;

    // 1. Header trường & Sở (Dòng 1, 2)
    sheetData.push([
      makeCell(headerInfo.schoolDept || 'SỞ GD&ĐT QUẢNG NGÃI', { font: { bold: true, sz: 11 } }),
      makeCell(''),
      makeCell(''),
      makeCell(''),
      makeCell(''),
      makeCell(''),
    ]);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 2 } });
    currentRow++;

    // Dòng 2: Tên trường
    sheetData.push([
      makeCell(headerInfo.schoolName || 'TRƯỜNG PTDTNT THPT SA THẦY', { font: { bold: true, sz: 11 } }),
      makeCell(''),
      makeCell(''),
      makeCell(''),
      makeCell(''),
      makeCell(''),
    ]);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 2 } });
    currentRow++;

    // Dòng 3: Dòng trống
    sheetData.push([makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell('')]);
    currentRow++;

    // Dòng 4: Tiêu đề đợt kiểm tra
    sheetData.push([
      makeCell(examHeader, {
        font: { bold: true, sz: 13 },
        alignment: { horizontal: 'center', vertical: 'center' },
      }),
      makeCell(''),
      makeCell(''),
      makeCell(''),
      makeCell(''),
      makeCell(''),
    ]);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 5 } });
    currentRow++;

    // Dòng 5: DANH SÁCH HỌC SINH CẦN QUAN TÂM ĐẶC BIỆT THEO MÔN Ở CÁC LỚP
    sheetData.push([
      makeCell('DANH SÁCH HỌC SINH CẦN QUAN TÂM ĐẶC BIỆT THEO MÔN Ở CÁC LỚP', {
        font: { bold: true, sz: 13 },
        alignment: { horizontal: 'center', vertical: 'center' },
      }),
      makeCell(''),
      makeCell(''),
      makeCell(''),
      makeCell(''),
      makeCell(''),
    ]);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 5 } });
    currentRow++;

    // Dòng 6: Môn:    Toán
    sheetData.push([
      makeCell('Môn:', { font: { bold: true, sz: 11 } }),
      makeCell(subjectName, { font: { bold: true, sz: 11 } }),
      makeCell(''),
      makeCell(''),
      makeCell(''),
      makeCell(''),
    ]);
    currentRow++;

    // Lọc các học sinh của môn này:
    // - Chỉ lấy học sinh CÓ THAM GIA THI (score hợp lệ, không null/NaN)
    // - Điểm từ 3.5 trở xuống (score <= 3.5)
    const subjectStudents = students.filter((s) => {
      const sSub = mapSubjectToStandardColumn(s.monHoc || s.subject) || s.monHoc || s.subject;
      if (sSub !== subjectName) return false;

      const rawScore = s.diem !== undefined && s.diem !== null ? s.diem : s.score;
      if (typeof rawScore !== 'number' || isNaN(rawScore)) return false;
      return rawScore <= SPECIAL_ATTENTION_THRESHOLD;
    });

    // Lấy danh sách các lớp có học sinh cần quan tâm đặc biệt môn này
    const classSet = new Set<string>();
    subjectStudents.forEach((s) => {
      const cls = (s.lop || s.class || '').trim();
      if (cls) classSet.add(cls);
    });

    // Sắp xếp thứ tự lớp tự nhiên
    const sortedClasses = Array.from(classSet).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    if (sortedClasses.length === 0) {
      sheetData.push([
        makeCell('(Không có học sinh cần quan tâm đặc biệt ở môn này - Không có điểm ≤ 3.5)', {
          font: { italic: true, sz: 11 },
          alignment: { horizontal: 'left' },
        }),
        makeCell(''),
        makeCell(''),
        makeCell(''),
        makeCell(''),
        makeCell(''),
      ]);
      merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 5 } });
      currentRow++;
    } else {
      // Duyệt qua từng lớp từ trên xuống dưới
      sortedClasses.forEach((className) => {
        const studentsInClass = subjectStudents
          .filter((s) => (s.lop || s.class || '').trim() === className)
          .sort((a, b) => {
            const ttA = a.tt ?? 0;
            const ttB = b.tt ?? 0;
            if (ttA && ttB && ttA !== ttB) return ttA - ttB;
            const nameA = a.hoTen || a.fullName || '';
            const nameB = b.hoTen || b.fullName || '';
            return nameA.localeCompare(nameB, 'vi');
          });

        const studentCount = studentsInClass.length;

        // Tiêu đề Lớp: "Lớp: 10B1 (Gồm có X HS cần quan tâm đặc biệt)"
        sheetData.push([
          makeCell(`Lớp: ${className} (Gồm có ${studentCount} HS cần quan tâm đặc biệt)`, {
            font: { bold: true, sz: 11 },
            border: cellBorderAll,
          }),
          makeCell('', { border: cellBorderAll }),
          makeCell('', { border: cellBorderAll }),
          makeCell('', { border: cellBorderAll }),
          makeCell('', { border: cellBorderAll }),
          makeCell('', { border: cellBorderAll }),
        ]);
        merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 5 } });
        currentRow++;

        // Hàng tiêu đề các cột
        sheetData.push([
          makeCell('TT', { font: { bold: true }, alignment: { horizontal: 'center' }, border: cellBorderAll }),
          makeCell('Họ và tên', { font: { bold: true }, alignment: { horizontal: 'left' }, border: cellBorderAll }),
          makeCell('Ngày sinh', { font: { bold: true }, alignment: { horizontal: 'center' }, border: cellBorderAll }),
          makeCell('Điểm', { font: { bold: true }, alignment: { horizontal: 'center' }, border: cellBorderAll }),
          makeCell('Xếp loại', { font: { bold: true }, alignment: { horizontal: 'center' }, border: cellBorderAll }),
          makeCell('GV dạy', { font: { bold: true }, alignment: { horizontal: 'left' }, border: cellBorderAll }),
        ]);
        currentRow++;

        // Các hàng học sinh
        studentsInClass.forEach((st, idx) => {
          const rawScore = st.diem !== undefined && st.diem !== null ? st.diem : st.score;
          const scoreVal = typeof rawScore === 'number' ? Number(rawScore) : null;
          const scoreDisplay = scoreVal !== null ? (Number.isInteger(scoreVal) ? scoreVal : Number(scoreVal.toFixed(1))) : '';
          const rankDisplay = st.xepLoai || st.rank || 'Chưa đạt';
          const teacher = st.giaoVien || st.teacherName || '';
          const dob = st.ngaySinh || st.dob || '';

          sheetData.push([
            makeCell(idx + 1, { alignment: { horizontal: 'center' }, border: cellBorderAll }, 'n'),
            makeCell(st.hoTen || st.fullName || '', { alignment: { horizontal: 'left' }, border: cellBorderAll }),
            makeCell(dob, { alignment: { horizontal: 'center' }, border: cellBorderAll }),
            makeCell(scoreDisplay, { alignment: { horizontal: 'center' }, border: cellBorderAll }, typeof scoreDisplay === 'number' ? 'n' : 's'),
            makeCell(rankDisplay, { alignment: { horizontal: 'center' }, border: cellBorderAll }),
            makeCell(teacher, { alignment: { horizontal: 'left' }, border: cellBorderAll }),
          ]);
          currentRow++;
        });
      });
    }

    // Chuyển mảng sheetData thành sheet object
    const ws: any = {};
    for (let R = 0; R < sheetData.length; ++R) {
      for (let C = 0; C < sheetData[R].length; ++C) {
        const cell = sheetData[R][C];
        if (cell !== undefined && cell !== null) {
          const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
          ws[cellRef] = cell;
        }
      }
    }

    const range = {
      s: { r: 0, c: 0 },
      e: { r: Math.max(currentRow - 1, 0), c: 5 },
    };
    ws['!ref'] = XLSX.utils.encode_range(range);
    ws['!merges'] = merges;

    // Thiết lập độ rộng các cột
    ws['!cols'] = [
      { wch: 6 },  // TT
      { wch: 24 }, // Họ và tên
      { wch: 14 }, // Ngày sinh
      { wch: 10 }, // Điểm
      { wch: 13 }, // Xếp loại
      { wch: 26 }, // GV dạy
    ];

    const validSheetName = subjectName.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, validSheetName);
  });

  const periodCode = headerInfo.periodCode || 'GKII';
  const fileName = `DanhSach_HS_CanQuanTamDacBiet_${periodCode}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
