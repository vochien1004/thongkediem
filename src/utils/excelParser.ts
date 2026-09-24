import * as XLSX from 'xlsx';
import { ScoreThresholds, StudentScore } from '../types';
import { classifyScore, DEFAULT_THRESHOLDS } from './scoreClassifier';

export interface SheetParseSummary {
  sheetName: string;
  subject: string;
  rowCount: number;
  validScoresCount: number;
  averageScore: number;
  teachers: string[];
}

export interface MultiSheetParseResult {
  success: boolean;
  data: StudentScore[];
  totalRawRows: number;
  validRows: number;
  cleanedRows: number;
  sheetNames: string[];
  sheetsSummary: SheetParseSummary[];
  distinctSubjects: string[];
  errors: string[];
  warnings: string[];
}

// Chuẩn hóa tên cột để so khớp linh hoạt không phân biệt hoa thường và dấu tiếng Việt
function normalizeHeader(str: string): string {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Kiểm tra dòng có phải là dòng tiêu đề phụ / ngắt trang / phân trang hay không
function isHeaderOrPageBreak(rowStr: string): boolean {
  const lower = rowStr.toLowerCase().trim();
  if (/^p\s*\d+$/i.test(lower)) return true;
  if (/^trang\s*\d+/i.test(lower)) return true;
  if (/^page\s*\d+/i.test(lower)) return true;
  if (lower.includes('danh sách điểm thi') || lower.includes('học kỳ') || lower.includes('năm học 20')) return true;
  if (lower.includes('bảng điểm') || lower.includes('phòng thi số') || lower.includes('chữ ký giám thị')) return true;
  return false;
}

// Parse giá trị điểm số (Tự động đổi dấu phẩy ',' thành dấu chấm '.' và parseFloat)
export function parseScoreValue(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).trim().replace(',', '.').toUpperCase();
  if (str === 'V' || str === 'VẮNG' || str === 'VANG' || str === 'VT' || str === 'MIỄN' || str === 'MIEN' || str === 'KTHI') {
    return null;
  }
  const num = parseFloat(str);
  if (isNaN(num)) return null;
  if (num < 0 || num > 10) return null;
  return Number(num.toFixed(2));
}

// Chuyển đổi ngày tháng Excel (serial number) hoặc chuỗi ngày tháng
export function parseDateValue(val: any): string {
  if (!val) return '';
  if (typeof val === 'number') {
    try {
      const parsedDate = XLSX.SSF.parse_date_code(val);
      if (parsedDate) {
        const d = String(parsedDate.d).padStart(2, '0');
        const m = String(parsedDate.m).padStart(2, '0');
        const y = parsedDate.y;
        return `${d}/${m}/${y}`;
      }
    } catch {
      // ignore
    }
  }
  return String(val).trim();
}

export interface ParseExcelOptions {
  academicYear?: string;
  semester?: string;
  period?: string;
}

/**
 * Phân tích 1 Sheet đơn lẻ trong Workbook
 */
function parseSingleSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  thresholds: ScoreThresholds = DEFAULT_THRESHOLDS,
  startGlobalIndex = 0,
  options?: ParseExcelOptions
): { students: StudentScore[]; rawCount: number; cleanedCount: number; summary: SheetParseSummary } {
  // Lấy tên môn học từ chính tên Sheet (ví dụ: Sheet "Toán" => môn Toán, Sheet "Văn" => môn Văn...)
  const subjectName = sheetName.trim() || 'Toán';
  const academicYear = options?.academicYear || '2025-2026';
  const semester = options?.semester || 'HK1';
  const period = options?.period || 'GKI';

  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (!rawRows || rawRows.length === 0) {
    return {
      students: [],
      rawCount: 0,
      cleanedCount: 0,
      summary: {
        sheetName,
        subject: subjectName,
        rowCount: 0,
        validScoresCount: 0,
        averageScore: 0,
        teachers: [],
      },
    };
  }

  // Nhận diện cột theo cấu trúc chuẩn:
  // Cột A: StudentID, Cột B: FullName, Cột C: Class, Cột D: DOB, Cột E: Ethnicity, Cột F: Grade, Cột G: Score, Cột H: TeacherName
  let headerRowIndex = -1;
  let colIndices = {
    studentId: -1,
    fullName: -1,
    class: -1,
    dob: -1,
    ethnicity: -1,
    grade: -1,
    score: -1,
    teacherName: -1,
  };

  const searchLimit = Math.min(rawRows.length, 15);
  for (let r = 0; r < searchLimit; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;

    const indices = {
      studentId: -1,
      fullName: -1,
      class: -1,
      dob: -1,
      ethnicity: -1,
      grade: -1,
      score: -1,
      teacherName: -1,
    };

    let matchCount = 0;

    for (let c = 0; c < row.length; c++) {
      const cellVal = normalizeHeader(String(row[c] || ''));
      if (!cellVal) continue;

      if (
        indices.studentId === -1 &&
        (cellVal === 'studentid' || cellVal === 'sbd' || cellVal.includes('sobd') || cellVal.includes('mahs') || cellVal === 'id')
      ) {
        indices.studentId = c;
        matchCount++;
      } else if (
        indices.fullName === -1 &&
        (cellVal === 'fullname' || cellVal === 'name' || cellVal.includes('hoten') || cellVal.includes('hovaten') || cellVal === 'ten')
      ) {
        indices.fullName = c;
        matchCount++;
      } else if (
        indices.class === -1 &&
        (cellVal === 'class' || cellVal === 'lop' || cellVal.includes('tenlop') || cellVal.includes('malop'))
      ) {
        indices.class = c;
        matchCount++;
      } else if (
        indices.dob === -1 &&
        (cellVal === 'dob' || cellVal.includes('ngaysinh') || cellVal.includes('nsinh') || cellVal === 'birthday')
      ) {
        indices.dob = c;
        matchCount++;
      } else if (
        indices.ethnicity === -1 &&
        (cellVal === 'ethnicity' || cellVal === 'ethnic' || cellVal.includes('dantoc') || cellVal === 'dt')
      ) {
        indices.ethnicity = c;
        matchCount++;
      } else if (
        indices.grade === -1 &&
        (cellVal === 'grade' || cellVal.includes('khoi') || cellVal.includes('khoilop'))
      ) {
        indices.grade = c;
        matchCount++;
      } else if (
        indices.score === -1 &&
        (cellVal === 'score' || cellVal === 'diem' || cellVal.includes('diemso') || cellVal.includes('diemthi'))
      ) {
        indices.score = c;
        matchCount++;
      } else if (
        indices.teacherName === -1 &&
        (cellVal === 'teachername' || cellVal === 'teacher' || cellVal.includes('giaovien') || cellVal.includes('gv'))
      ) {
        indices.teacherName = c;
        matchCount++;
      }
    }

    if ((indices.studentId !== -1 || indices.fullName !== -1) && (indices.score !== -1 || indices.class !== -1) && matchCount >= 2) {
      headerRowIndex = r;
      colIndices = indices;
      break;
    }
  }

  // Nếu không nhận diện được tiêu đề, áp dụng vị trí mặc định dựa trên cấu trúc file "Nhap diem GKI - ban 5 lop - CKI.xlsx"
  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    colIndices = {
      studentId: 0,
      fullName: 1,
      class: 2,
      dob: 3,
      ethnicity: 4,
      grade: 5,
      score: 6,
      teacherName: 7,
    };
  }

  const sheetStudents: StudentScore[] = [];
  let cleanedCount = 0;
  const teachersSet = new Set<string>();
  const validScores: number[] = [];

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || !Array.isArray(row) || row.length === 0) {
      cleanedCount++;
      continue;
    }

    const rowJoined = row.join(' ').trim();
    if (!rowJoined || isHeaderOrPageBreak(rowJoined)) {
      cleanedCount++;
      continue;
    }

    const studentIdRaw = colIndices.studentId !== -1 ? String(row[colIndices.studentId] || '').trim() : '';
    const fullNameRaw = colIndices.fullName !== -1 ? String(row[colIndices.fullName] || '').trim() : '';
    const classRaw = colIndices.class !== -1 ? String(row[colIndices.class] || '').trim() : '';
    const dobRaw = colIndices.dob !== -1 ? parseDateValue(row[colIndices.dob]) : '';
    const ethnicityRaw = colIndices.ethnicity !== -1 ? String(row[colIndices.ethnicity] || 'Kinh').trim() : 'Kinh';
    const gradeRaw = colIndices.grade !== -1 ? String(row[colIndices.grade] || '').trim() : '';
    const scoreRaw = colIndices.score !== -1 ? parseScoreValue(row[colIndices.score]) : null;
    const teacherNameRaw = colIndices.teacherName !== -1 ? String(row[colIndices.teacherName] || '').trim() : '';

    // Bỏ qua dòng rác không có cả Tên và Mã HS
    if (!fullNameRaw && !studentIdRaw) {
      cleanedCount++;
      continue;
    }

    // Bỏ qua nếu là dòng tiêu đề lặp lại
    if (normalizeHeader(fullNameRaw) === 'fullname' || normalizeHeader(fullNameRaw) === 'hoten') {
      cleanedCount++;
      continue;
    }

    const globalIdx = startGlobalIndex + sheetStudents.length + 1;
    const studentIdFinal = studentIdRaw || `HS${String(globalIdx).padStart(4, '0')}`;
    const fullNameFinal = fullNameRaw || `Học sinh ${studentIdFinal}`;
    const classFinal = classRaw || '10B1';
    const teacherNameFinal = teacherNameRaw || 'Chưa phân công';

    // Chuẩn hóa Khối lớp
    let gradeFinal = gradeRaw;
    if (gradeFinal && /^\d+$/.test(gradeFinal)) {
      gradeFinal = `Khối ${gradeFinal}`;
    } else if (!gradeFinal && classFinal) {
      const m = classFinal.match(/^(\d+)/);
      if (m) gradeFinal = `Khối ${m[1]}`;
    }
    if (!gradeFinal) gradeFinal = 'Khối 10';

    if (teacherNameFinal && teacherNameFinal !== 'Chưa phân công') {
      teachersSet.add(teacherNameFinal);
    }
    if (scoreRaw !== null) {
      validScores.push(scoreRaw);
    }

    // Phân loại xếp loại
    const rank = classifyScore(scoreRaw, thresholds);

    // Tạo ID kết hợp (Composite Key) chuẩn [studentId + subject + academicYear + semester + period]
    const safeId = `${academicYear}_${semester}_${period}_${subjectName}_${studentIdFinal}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .toLowerCase();

    sheetStudents.push({
      id: safeId,
      subject: subjectName,
      studentId: studentIdFinal,
      fullName: fullNameFinal,
      class: classFinal,
      dob: dobRaw,
      ethnicity: ethnicityRaw || 'Kinh',
      grade: gradeFinal,
      score: scoreRaw,
      teacherName: teacherNameFinal,
      rank,

      academicYear,
      semester,
      period,

      // Aliases tiếng Việt
      tt: globalIdx,
      soBD: studentIdFinal,
      hoTen: fullNameFinal,
      lop: classFinal,
      ngaySinh: dobRaw,
      danToc: ethnicityRaw || 'Kinh',
      khoi: gradeFinal,
      diem: scoreRaw,
      giaoVien: teacherNameFinal,
      monHoc: subjectName,
      xepLoai: rank,
      namHoc: academicYear,
      hocKy: semester,
      dotDiem: period,
      ghiChu: '',
    });
  }

  const averageScore =
    validScores.length > 0
      ? Number((validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2))
      : 0;

  return {
    students: sheetStudents,
    rawCount: rawRows.length,
    cleanedCount,
    summary: {
      sheetName,
      subject: subjectName,
      rowCount: sheetStudents.length,
      validScoresCount: validScores.length,
      averageScore,
      teachers: Array.from(teachersSet),
    },
  };
}

/**
 * Phân tích TOÀN BỘ các Sheet trong Workbook Excel và gom nhóm thành danh sách điểm duy nhất
 */
export async function parseExcelFile(
  file: File | ArrayBuffer,
  thresholds: ScoreThresholds = DEFAULT_THRESHOLDS,
  targetSheetName?: string,
  options?: ParseExcelOptions
): Promise<MultiSheetParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    let dataBuffer: ArrayBuffer;
    if (file instanceof File) {
      dataBuffer = await file.arrayBuffer();
    } else {
      dataBuffer = file;
    }

    const workbook = XLSX.read(dataBuffer, { type: 'array', cellDates: false });
    const sheetNames = workbook.SheetNames;

    if (!sheetNames || sheetNames.length === 0) {
      return {
        success: false,
        data: [],
        totalRawRows: 0,
        validRows: 0,
        cleanedRows: 0,
        sheetNames: [],
        sheetsSummary: [],
        distinctSubjects: [],
        errors: ['File Excel không chứa bất kỳ Sheet nào.'],
        warnings: [],
      };
    }

    // Xác định các sheet cần duyệt: nếu targetSheetName được truyền và khác 'ALL' thì chỉ parse sheet đó, ngược lại duyệt TẤT CẢ các sheet
    const sheetsToParse =
      targetSheetName && targetSheetName !== 'ALL' && sheetNames.includes(targetSheetName)
        ? [targetSheetName]
        : sheetNames;

    const allStudents: StudentScore[] = [];
    const sheetsSummary: SheetParseSummary[] = [];
    const distinctSubjectsSet = new Set<string>();
    let totalRawCount = 0;
    let totalCleanedCount = 0;

    for (const sName of sheetsToParse) {
      const sheet = workbook.Sheets[sName];
      if (!sheet) continue;

      const { students, rawCount, cleanedCount, summary } = parseSingleSheet(
        sheet,
        sName,
        thresholds,
        allStudents.length,
        options
      );

      totalRawCount += rawCount;
      totalCleanedCount += cleanedCount;

      if (students.length > 0) {
        allStudents.push(...students);
        sheetsSummary.push(summary);
        distinctSubjectsSet.add(summary.subject);
      } else {
        warnings.push(`Sheet "${sName}" không có dòng dữ liệu học sinh hợp lệ.`);
      }
    }

    if (allStudents.length === 0) {
      return {
        success: false,
        data: [],
        totalRawRows: totalRawCount,
        validRows: 0,
        cleanedRows: totalCleanedCount,
        sheetNames,
        sheetsSummary: [],
        distinctSubjects: [],
        errors: ['Không tìm thấy bản ghi điểm học sinh nào hợp lệ trong các Sheet.'],
        warnings,
      };
    }

    return {
      success: true,
      data: allStudents,
      totalRawRows: totalRawCount,
      validRows: allStudents.length,
      cleanedRows: totalCleanedCount,
      sheetNames,
      sheetsSummary,
      distinctSubjects: Array.from(distinctSubjectsSet),
      errors: [],
      warnings,
    };
  } catch (err: any) {
    console.error('Lỗi khi phân tích file Excel đa Sheet:', err);
    return {
      success: false,
      data: [],
      totalRawRows: 0,
      validRows: 0,
      cleanedRows: 0,
      sheetNames: [],
      sheetsSummary: [],
      distinctSubjects: [],
      errors: [`Đã xảy ra lỗi khi đọc file: ${err?.message || 'Không rõ nguyên nhân'}`],
      warnings: [],
    };
  }
}

/**
 * Tải file Excel mẫu chuẩn theo cấu trúc "Nhap diem GKI - ban 5 lop - CKI.xlsx"
 * Bao gồm nhiều Sheet, mỗi Sheet là một môn học (Toán, Văn, Sử, Tiếng Anh, Tin, Vật lý, Hóa, Sinh)
 */
export function downloadExcelTemplate() {
  const headers = [
    'StudentID',
    'FullName',
    'Class',
    'DOB',
    'Ethnicity',
    'Grade',
    'Score',
    'TeacherName',
  ];

  const subjects = [
    { name: 'Toán', teacher: 'Trần Thị Mỹ Tuyên' },
    { name: 'Văn', teacher: 'Lê Thị Như' },
    { name: 'Sử', teacher: 'Nguyễn Thanh Dũng' },
    { name: 'Tiếng Anh', teacher: 'Mai Thị Thủy' },
    { name: 'Tin', teacher: 'Hoàng Văn Nam' },
    { name: 'Vật lý', teacher: 'Đặng Quốc Huy' },
    { name: 'Hóa', teacher: 'Phạm Thị Thoa' },
    { name: 'Sinh', teacher: 'Bùi Thị Hà' },
  ];

  const sampleBase = [
    ['170001', 'Hoàng Minh Anh', '10B3', '11/17/2010', 'Kinh', 10, '5,8', 'Trần Thị Mỹ Tuyên'],
    ['170002', 'Lương Nhất Lê Anh', '10B3', '10/23/2010', 'Thái', 10, '5,3', 'Trần Thị Mỹ Tuyên'],
    ['170003', 'Bùi Thị Lan Anh', '10B5', '12/4/2009', 'Mường', 10, '5,5', 'Lê Thị Như'],
    ['170004', 'A Âu', '10B3', '11/8/2010', 'Gia-rai', 10, '4,3', 'Trần Thị Mỹ Tuyên'],
    ['170005', 'A Bang', '10B1', '9/13/2010', 'Gia-rai', 10, '5,5', 'Trần Thị Mỹ Tuyên'],
    ['170006', 'Y Bích', '10B2', '7/7/2010', 'Gia-rai', 10, '3,8', 'Nguyễn Thanh Dũng'],
    ['170007', 'Y Bích', '10B6', '10/1/2010', 'Gia-rai', 10, '5,0', 'Mai Thị Thủy'],
    ['170008', 'A Bin', '10B5', '10/11/2010', 'Ba-na', 10, '4,0', 'Lê Thị Như'],
    ['170009', 'Tống Thanh Bình', '10B3', '9/6/2010', 'Kinh', 10, '3,8', 'Trần Thị Mỹ Tuyên'],
    ['170010', 'A To By', '10B1', '4/24/2010', 'Ba-na', 10, '4,0', 'Trần Thị Mỹ Tuyên'],
    ['170011', 'Nguyễn Thị Diệu Châu', '10B2', '8/15/2010', 'Kinh', 10, '8,5', 'Trần Thị Mỹ Tuyên'],
    ['170012', 'Trần Đình Chiến', '10B4', '3/12/2010', 'Kinh', 10, '9,2', 'Trần Thị Mỹ Tuyên'],
  ];

  const wb = XLSX.utils.book_new();

  subjects.forEach((subj, idx) => {
    const rows = sampleBase.map((row, rIdx) => {
      const baseNum = parseFloat(String(row[6]).replace(',', '.')) || 5.0;
      const variedNum = Math.min(10, Math.max(2, Number((baseNum + (idx % 3) * 0.4 - (rIdx % 2) * 0.2).toFixed(1))));
      const scoreStr = String(variedNum).replace('.', ',');
      return [
        row[0],
        row[1],
        row[2],
        row[3],
        row[4],
        row[5],
        scoreStr,
        subj.teacher,
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [
      { wch: 12 }, // StudentID
      { wch: 24 }, // FullName
      { wch: 10 }, // Class
      { wch: 14 }, // DOB
      { wch: 12 }, // Ethnicity
      { wch: 8 },  // Grade
      { wch: 8 },  // Score
      { wch: 24 }, // TeacherName
    ];

    XLSX.utils.book_append_sheet(wb, ws, subj.name);
  });

  XLSX.writeFile(wb, 'Nhap_diem_GKI_ban_5_lop_CKI.xlsx');
}

/**
 * Xuất danh sách điểm học sinh ra file Excel (.xlsx)
 */
export function exportStudentsToExcel(students: StudentScore[], filename = 'Bang_Diem_EduScore.xlsx') {
  // Gom nhóm học sinh theo từng môn học để xuất ra từng Sheet riêng biệt tương ứng
  const subjectsMap = new Map<string, StudentScore[]>();
  for (const s of students) {
    const subj = s.subject || s.monHoc || 'Toán';
    if (!subjectsMap.has(subj)) {
      subjectsMap.set(subj, []);
    }
    subjectsMap.get(subj)!.push(s);
  }

  const wb = XLSX.utils.book_new();
  const headers = [
    'StudentID',
    'FullName',
    'Class',
    'DOB',
    'Ethnicity',
    'Grade',
    'Score',
    'TeacherName',
    'Rank',
    'Năm học',
    'Học kỳ',
    'Đợt điểm',
  ];

  subjectsMap.forEach((scoreList, subjectName) => {
    const rows = scoreList.map((s) => [
      s.studentId || s.soBD,
      s.fullName || s.hoTen,
      s.class || s.lop,
      s.dob || s.ngaySinh,
      s.ethnicity || s.danToc,
      s.grade || s.khoi,
      s.score !== null ? s.score : '',
      s.teacherName || s.giaoVien,
      s.rank || s.xepLoai,
      s.academicYear || s.namHoc || '',
      s.semester || s.hocKy || '',
      s.period || s.dotDiem || '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [
      { wch: 12 },
      { wch: 25 },
      { wch: 10 },
      { wch: 14 },
      { wch: 12 },
      { wch: 10 },
      { wch: 8 },
      { wch: 25 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
    ];

    // SheetJS cho phép tên sheet tối đa 31 ký tự
    const cleanSheetName = subjectName.substring(0, 30);
    XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);
  });

  // Nếu không có sheet nào (danh sách rỗng)
  if (subjectsMap.size === 0) {
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(wb, ws, 'DuLieuDiem');
  }

  XLSX.writeFile(wb, filename);
}
