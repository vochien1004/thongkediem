export type ScoreClassification = 'Tốt' | 'Khá' | 'Đạt' | 'Chưa đạt' | 'Vắng' | 'Vắng/Thiếu điểm';

export type SemesterType = 'KS' | 'HK1' | 'HK2' | string;
export type PeriodType = 'KS' | 'GKI' | 'CKI' | 'GKII' | 'CKII' | string;

export interface ExamPeriodConfig {
  id: string; // 'KS' | 'GKI-HK1' | 'CKI-HK1' | 'GKII' | 'CKII'
  code: string;
  name: string; // 'KS đầu năm' | 'Giữa HK1 (GKI)' | 'Giữa HK2 (GKII)'...
  fullName: string; // 'Khảo sát đầu năm' | 'Kiểm tra giữa học kỳ II (GKII)'...
  term: string; // 'Khảo sát đầu năm' | 'Học kỳ I' | 'Học kỳ II'
  semester: string;
  period: string; // 'KS' | 'GKI' | 'CKI' | 'GKII' | 'CKII'
  order: number; // 0: KS đầu năm (trước HK1), 1: GKI-HK1, 2: CKI-HK1, 3: GKII, 4: CKII
  enabledYears?: string[]; // Các năm học được cấu hình áp dụng đợt này
  enabled?: boolean;
  applicableYears?: string[];
  description?: string;
}

export interface GlobalFilterState {
  academicYear: string; // VD: '2025-2026' hoặc 'ALL'
  semester: 'ALL' | 'KS' | 'HK1' | 'HK2' | string; // 'ALL' = Cả năm, 'KS' = Khảo sát đầu năm
  period: 'ALL' | 'KS' | 'GKI' | 'CKI' | 'GKII' | 'CKII' | string; // 'ALL' = Tất cả các đợt
}

export interface StudentScore {
  id: string;
  // Thuộc tính chuẩn theo yêu cầu đầu vào
  subject: string; // Tên môn học từ tên Sheet (Toán, Văn, Sử, Tiếng Anh, Tin, Vật lý, Hóa, Sinh...)
  studentId: string; // Mã học sinh / SBD (StudentID)
  fullName: string; // Họ và tên (FullName)
  class: string; // Lớp học (Class, VD: 10B1, 10B3...)
  dob: string; // Ngày sinh (DOB)
  ethnicity: string; // Dân tộc (Ethnicity)
  grade: string; // Khối lớp (Grade, VD: 10)
  score: number | null; // Điểm số (Score, null nếu vắng hoặc không hợp lệ)
  teacherName: string; // Tên giáo viên bộ môn (TeacherName)
  rank: ScoreClassification; // Xếp loại: Tốt (>=8.0), Khá (6.5-7.9), Đạt (5.0-6.4), Chưa đạt (<5.0), Vắng (null)

  // Thông tin Năm học - Học kỳ - Đợt lấy điểm
  academicYear: string; // VD: '2025-2026'
  semester: SemesterType | string; // 'HK1' | 'HK2'
  period: PeriodType | string; // 'GKI' (Giữa kỳ) | 'CKI' (Cuối kỳ)

  // Alias tiếng Việt hỗ trợ tương thích ngược cho toàn bộ components
  tt: number;
  soBD: string;
  hoTen: string;
  lop: string;
  ngaySinh: string;
  danToc: string;
  khoi: string;
  diem: number | null;
  giaoVien: string;
  monHoc: string;
  xepLoai: ScoreClassification;
  namHoc?: string;
  hocKy?: string;
  dotDiem?: string;
  ghiChu?: string;
  updatedAt?: any;
}

export interface ScoreThresholds {
  totMin: number; // Mặc định >= 8.0
  khaMin: number; // Mặc định 6.5 - 7.9
  datMin: number; // Mặc định 5.0 - 6.4
  // Dưới datMin là Chưa đạt (< 5.0)
}

export interface FirebaseCustomConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  firestoreDatabaseId?: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface SystemConfig {
  thresholds: ScoreThresholds;
  schoolName: string;
  academicYear: string;
  term: string;
  examName: string;
  reportTitle?: string;
  availableAcademicYears?: string[];
  examPeriods?: ExamPeriodConfig[];
}

export interface SummaryStats {
  total: number;
  gradedCount: number;
  absentCount: number;
  average: number;
  max: number;
  min: number;
  median: number;
  standardDeviation: number;
  totCount: number;
  totPercent: number;
  khaCount: number;
  khaPercent: number;
  datCount: number;
  datPercent: number;
  chuaDatCount: number;
  chuaDatPercent: number;
}

export interface GroupSummary {
  groupKey: string;
  name: string;
  stats: SummaryStats;
  students: StudentScore[];
}

export type ActiveTab = 'dashboard' | 'upload' | 'statistics' | 'settings';

export type StatModuleType =
  | 'theo_mon' // Thống kê chất lượng theo môn
  | 'theo_lop' // Thống kê chất lượng theo lớp
  | 'theo_giao_vien' // ThongKeChatLuong_Theo Giáo viên
  | 'so_luong_can_quan_tam' // Số lượng HS cần quan tâm
  | 'danh_sach_can_quan_tam' // Danh sách HS cần quan tâm theo môn
  | 'quan_tam_dac_biet' // Danh sách HS cần quan tâm đặc biệt (điểm <= 3.5)
  | 'so_sanh_tien_bo'; // So sánh tiến bộ 4 đợt

export type UserRole = 'admin' | 'teacher';

export interface AuthUser {
  username: string;
  name: string;
  role: UserRole;
  title: string;
  loginAt?: string;
}
