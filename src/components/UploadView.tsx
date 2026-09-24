import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  Database,
  Trash2,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit2,
  X,
  ChevronLeft,
  ChevronRight,
  Save,
  Check,
  Cloud,
  RefreshCw,
  Layers,
  Sparkles,
  BookOpen,
  Calendar,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { StudentScore, SystemConfig, GlobalFilterState, PeriodType } from '../types';
import {
  parseExcelFile,
  downloadExcelTemplate,
  exportStudentsToExcel,
  MultiSheetParseResult,
} from '../utils/excelParser';
import { classifyScore } from '../utils/scoreClassifier';
import {
  saveStudentsToFirestore,
  saveSingleStudentToFirestore,
  deleteStudentFromFirestore,
  clearAllStudentsFromFirestore,
  buildCompositeScoreId,
} from '../firebaseService';
import { saveLatestUploadedFilter } from '../utils/periodDetection';
import { DeleteAllConfirmModal } from './DeleteAllConfirmModal';

interface UploadViewProps {
  students: StudentScore[];
  setStudents: React.Dispatch<React.SetStateAction<StudentScore[]>>;
  config: SystemConfig;
  onLoadSampleData: () => void;
  onDeleteAll?: (onProgress?: (current: number, total: number) => void) => Promise<void>;
  globalFilter?: GlobalFilterState;
  onFilterChange?: (filter: GlobalFilterState) => void;
  availableYears?: string[];
}

export const UploadView: React.FC<UploadViewProps> = ({
  students,
  setStudents,
  config,
  onLoadSampleData,
  onDeleteAll,
  globalFilter,
  onFilterChange,
  availableYears = ['2024-2025', '2025-2026', '2026-2027'],
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingFirebase, setIsSavingFirebase] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [multiSheetResult, setMultiSheetResult] = useState<MultiSheetParseResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [firebaseStatusMessage, setFirebaseStatusMessage] = useState<string | null>(null);

  // Đợt điểm mục tiêu khi import file Excel
  const [uploadYear, setUploadYear] = useState<string>(() =>
    globalFilter && globalFilter.academicYear !== 'ALL' ? globalFilter.academicYear : (config.academicYear || '2025-2026')
  );
  const [uploadSemester, setUploadSemester] = useState<'KS' | 'HK1' | 'HK2'>(() =>
    globalFilter && (globalFilter.semester === 'KS' || globalFilter.period === 'KS')
      ? 'KS'
      : globalFilter && globalFilter.semester === 'HK2'
      ? 'HK2'
      : 'HK1'
  );
  const [uploadPeriod, setUploadPeriod] = useState<PeriodType>(() => {
    if (globalFilter && (globalFilter.period === 'KS' || globalFilter.semester === 'KS')) {
      return 'KS';
    }
    if (globalFilter?.semester === 'HK2') {
      return (globalFilter.period === 'CKII' || globalFilter.period === 'CKI') ? 'CKII' : 'GKII';
    }
    return globalFilter && globalFilter.period === 'CKI' ? 'CKI' : 'GKI';
  });

  // Đồng bộ với globalFilter nếu bên ngoài thay đổi
  useEffect(() => {
    if (globalFilter?.academicYear && globalFilter.academicYear !== 'ALL') {
      setUploadYear(globalFilter.academicYear);
    }
    if (globalFilter?.semester && globalFilter.semester !== 'ALL') {
      setUploadSemester(globalFilter.semester as 'KS' | 'HK1' | 'HK2');
    }
    if (globalFilter?.period && globalFilter.period !== 'ALL') {
      if (globalFilter.semester === 'HK2') {
        setUploadPeriod(
          globalFilter.period === 'CKII' || globalFilter.period === 'CKI' ? 'CKII' : 'GKII'
        );
      } else {
        setUploadPeriod(globalFilter.period as PeriodType);
      }
    }
  }, [globalFilter?.academicYear, globalFilter?.semester, globalFilter?.period]);

  // Modal Xóa tất cả bản ghi
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteAllProgress, setDeleteAllProgress] = useState<{ current: number; total: number } | null>(null);

  // Lưu file đã chọn để chuyển đổi hoặc phân tích lại
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [selectedSheetScope, setSelectedSheetScope] = useState<string>('ALL');

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('ALL');
  const [filterSubject, setFilterSubject] = useState('ALL');
  const [filterClassification, setFilterClassification] = useState('ALL');
  const [filterGrade, setFilterGrade] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // In-line editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScoreValue, setEditScoreValue] = useState<string>('');

  // Manual Add Student Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudent, setNewStudent] = useState({
    studentId: '',
    fullName: '',
    class: '10B3',
    dob: '',
    ethnicity: 'Kinh',
    grade: 'Khối 10',
    score: '',
    teacherName: 'Trần Thị Mỹ Tuyên',
    subject: 'Toán',
    academicYear: uploadYear,
    semester: uploadSemester,
    period: uploadPeriod,
    ghiChu: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Xử lý đọc file Excel và đẩy lên Firestore
  const handleFileProcess = async (file: File, targetSheet = 'ALL') => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setErrorMessage('Định dạng file không được hỗ trợ. Vui lòng chọn file Excel (.xlsx, .xls) hoặc CSV.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setMultiSheetResult(null);
    setFirebaseStatusMessage(null);
    setUploadProgress(null);
    setCurrentFile(file);

    try {
      // 1. Phân tích các Sheet trong Workbook và gắn thông tin Đợt điểm / Học kỳ / Năm học
      const result = await parseExcelFile(file, config.thresholds, targetSheet, {
        academicYear: uploadYear,
        semester: uploadSemester,
        period: uploadPeriod,
      });
      setMultiSheetResult(result);

      if (result.success && result.data.length > 0) {
        setIsSavingFirebase(true);
        setFirebaseStatusMessage(
          `Đang đẩy trực tiếp ${result.data.length} bản ghi của ${result.distinctSubjects.length} môn học [${uploadPeriod} - ${uploadSemester} • ${uploadYear}] lên Firebase Cloud Firestore...`
        );

        // Đẩy trực tiếp 100% dữ liệu lên Cloud Firestore (không lưu LocalStorage)
        try {
          const saveRes = await saveStudentsToFirestore(
            result.data,
            false,
            (current, total) => {
              setUploadProgress({ current, total });
            }
          );

          if (saveRes.quotaExceeded) {
            setErrorMessage(
              `Hạn mức ghi Cloud Firestore trong ngày đã đạt giới hạn. Vui lòng thử lại vào ngày mai hoặc nâng cấp tài nguyên cơ sở dữ liệu.`
            );
          } else {
            // Cập nhật state học sinh trong bộ nhớ phiên làm việc
            setStudents((prev) => {
              const map = new Map<string, StudentScore>();
              prev.forEach((s) => map.set(s.id, s));
              result.data.forEach((s) => map.set(s.id, s));
              return Array.from(map.values());
            });

            // Tự động chuyển bộ lọc toàn cục sang đợt vừa upload và lưu lại cho lần khởi động sau
            const uploadedFilter: GlobalFilterState = {
              academicYear: uploadYear,
              semester: uploadSemester,
              period: uploadPeriod,
            };
            saveLatestUploadedFilter(uploadedFilter);
            if (onFilterChange) {
              onFilterChange(uploadedFilter);
            }

            setFirebaseStatusMessage(
              `Đã đẩy và lưu thành công ${saveRes.count} dòng điểm (${saveRes.distinctSubjects} môn học: ${result.distinctSubjects.join(', ')}) trực tiếp lên Cloud Firestore!`
            );

            // Pháo hoa ăn mừng
            try {
              confetti({
                particleCount: 90,
                spread: 75,
                origin: { y: 0.6 },
              });
            } catch {
              // ignore
            }
          }
        } catch (fErr: any) {
          console.error('Lỗi đẩy dữ liệu lên Firestore:', fErr);
          setErrorMessage(
            `Lỗi khi lưu dữ liệu lên Cloud Firestore: ${fErr?.message || 'Không thể kết nối đến máy chủ CSDL'}`
          );
        }

        setCurrentPage(1);
      } else {
        setErrorMessage(
          result.errors.length > 0
            ? result.errors.join('. ')
            : 'Không tìm thấy dữ liệu điểm hợp lệ trong các Sheet.'
        );
      }
    } catch (err: any) {
      setErrorMessage(`Lỗi phân tích file / lưu Firestore: ${err?.message || 'Không xác định'}`);
    } finally {
      setIsLoading(false);
      setIsSavingFirebase(false);
    }
  };

  const handleSelectSheetScope = (scope: string) => {
    setSelectedSheetScope(scope);
    if (currentFile) {
      handleFileProcess(currentFile, scope);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0], selectedSheetScope);
    }
  };

  // Danh sách các môn, lớp, khối duy nhất trích xuất trực tiếp từ Firestore data
  const uniqueClasses = Array.from(new Set(students.map((s) => s.class || s.lop))).filter(Boolean).sort();
  const uniqueSubjects = Array.from(new Set(students.map((s) => s.subject || s.monHoc))).filter(Boolean).sort();
  const uniqueGrades = Array.from(new Set(students.map((s) => s.grade || s.khoi))).filter(Boolean).sort();

  // Lọc dữ liệu
  const filteredStudents = students.filter((s) => {
    const sSubject = s.subject || s.monHoc || '';
    const sClass = s.class || s.lop || '';
    const sGrade = s.grade || s.khoi || '';
    const sRank = s.rank || s.xepLoai || '';
    const sName = s.fullName || s.hoTen || '';
    const sID = s.studentId || s.soBD || '';
    const sTeacher = s.teacherName || s.giaoVien || '';
    const sEthnicity = s.ethnicity || s.danToc || '';

    // Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = sName.toLowerCase().includes(term);
      const matchSBD = sID.toLowerCase().includes(term);
      const matchTeacher = sTeacher.toLowerCase().includes(term);
      const matchEthnic = sEthnicity.toLowerCase().includes(term);
      const matchSubject = sSubject.toLowerCase().includes(term);
      if (!matchName && !matchSBD && !matchTeacher && !matchEthnic && !matchSubject) return false;
    }
    // Class filter
    if (filterClass !== 'ALL' && sClass !== filterClass) return false;
    // Subject filter
    if (filterSubject !== 'ALL' && sSubject !== filterSubject) return false;
    // Grade filter
    if (filterGrade !== 'ALL' && sGrade !== filterGrade) return false;
    // Classification filter
    if (filterClassification !== 'ALL' && sRank !== filterClassification) return false;

    return true;
  });

  // Phân trang
  const totalFiltered = filteredStudents.length;
  const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedStudents = filteredStudents.slice(startIndex, startIndex + pageSize);

  // Lưu chỉnh sửa điểm nhanh trực tiếp lên Firebase
  const handleSaveInlineScore = async (student: StudentScore) => {
    const rawNum = editScoreValue.trim().replace(',', '.');
    const newScore = rawNum === '' ? null : parseFloat(rawNum);

    if (newScore !== null && (isNaN(newScore) || newScore < 0 || newScore > 10)) {
      alert('Điểm số phải là số từ 0.0 đến 10.0 hoặc bỏ trống nếu vắng thi.');
      return;
    }

    const finalScore = newScore !== null ? Number(newScore.toFixed(2)) : null;
    const finalRank = classifyScore(finalScore, config.thresholds);

    const updatedStudent: StudentScore = {
      ...student,
      score: finalScore,
      diem: finalScore,
      rank: finalRank,
      xepLoai: finalRank,
    };

    try {
      await saveSingleStudentToFirestore(updatedStudent);
      setEditingId(null);
    } catch (err: any) {
      alert(`Lỗi khi lưu điểm lên Firebase: ${err?.message}`);
    }
  };

  // Xóa học sinh khỏi Firebase
  const handleDeleteStudent = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa bản ghi này khỏi Firebase?')) {
      try {
        await deleteStudentFromFirestore(id);
      } catch (err: any) {
        alert(`Lỗi khi xóa: ${err?.message}`);
      }
    }
  };

  // Thêm học sinh mới thủ công và đẩy lên Firebase
  const handleAddNewStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.fullName.trim()) {
      alert('Vui lòng nhập họ và tên học sinh.');
      return;
    }

    const rawNum = newStudent.score.trim().replace(',', '.');
    const parsedScore = rawNum === '' ? null : parseFloat(rawNum);
    const finalScore = parsedScore !== null && !isNaN(parsedScore) ? Number(parsedScore.toFixed(2)) : null;
    const finalRank = classifyScore(finalScore, config.thresholds);

    const studentIdFinal = newStudent.studentId.trim() || `1700${String(students.length + 1).padStart(2, '0')}`;
    const subjectFinal = newStudent.subject.trim() || 'Toán';
    const classFinal = newStudent.class.trim() || '10B1';

    const targetYear = newStudent.academicYear || uploadYear;
    const targetSemester = (newStudent.semester as any) || uploadSemester;
    const targetPeriod = (newStudent.period as any) || uploadPeriod;

    const safeId = buildCompositeScoreId(
      studentIdFinal,
      subjectFinal,
      targetYear,
      targetSemester,
      targetPeriod
    );

    const created: StudentScore = {
      id: safeId,
      subject: subjectFinal,
      studentId: studentIdFinal,
      fullName: newStudent.fullName.trim(),
      class: classFinal,
      dob: newStudent.dob.trim(),
      ethnicity: newStudent.ethnicity.trim() || 'Kinh',
      grade: newStudent.grade.trim() || 'Khối 10',
      score: finalScore,
      teacherName: newStudent.teacherName.trim() || 'Chưa phân công',
      rank: finalRank,
      academicYear: targetYear,
      semester: targetSemester,
      period: targetPeriod,

      // Aliases tiếng Việt
      tt: students.length + 1,
      soBD: studentIdFinal,
      hoTen: newStudent.fullName.trim(),
      lop: classFinal,
      ngaySinh: newStudent.dob.trim(),
      danToc: newStudent.ethnicity.trim() || 'Kinh',
      khoi: newStudent.grade.trim() || 'Khối 10',
      diem: finalScore,
      giaoVien: newStudent.teacherName.trim() || 'Chưa phân công',
      monHoc: subjectFinal,
      xepLoai: finalRank,
      namHoc: targetYear,
      hocKy: targetSemester,
      dotDiem: targetPeriod,
      ghiChu: newStudent.ghiChu.trim(),
    };

    try {
      await saveSingleStudentToFirestore(created);
      const addedFilter: GlobalFilterState = {
        academicYear: targetYear,
        semester: targetSemester,
        period: targetPeriod,
      };
      saveLatestUploadedFilter(addedFilter);
      if (onFilterChange) {
        onFilterChange(addedFilter);
      }
      setShowAddModal(false);
      setNewStudent({
        studentId: '',
        fullName: '',
        class: '10B3',
        dob: '',
        ethnicity: 'Kinh',
        grade: 'Khối 10',
        score: '',
        teacherName: 'Trần Thị Mỹ Tuyên',
        subject: 'Toán',
        ghiChu: '',
      });
    } catch (err: any) {
      alert(`Lỗi khi thêm học sinh lên Firebase: ${err?.message}`);
    }
  };

  // Mở bảng hỏi xác nhận xóa toàn bộ dữ liệu
  const handleOpenDeleteAllModal = () => {
    setIsDeleteAllModalOpen(true);
  };

  // Thực hiện xóa toàn bộ dữ liệu cả trên Firebase Firestore và trong chương trình
  const handleConfirmDeleteAll = async () => {
    setIsDeletingAll(true);
    setErrorMessage(null);
    try {
      if (onDeleteAll) {
        await onDeleteAll((current, total) => setDeleteAllProgress({ current, total }));
      } else {
        await clearAllStudentsFromFirestore((current, total) => setDeleteAllProgress({ current, total }));
        setStudents([]);
      }
      setMultiSheetResult(null);
      setCurrentFile(null);
      setFirebaseStatusMessage('Đã xóa sạch toàn bộ bản ghi điểm trên Cloud Firestore và trên chương trình.');
      setIsDeleteAllModalOpen(false);
    } catch (err: any) {
      setErrorMessage(`Lỗi khi xóa dữ liệu: ${err?.message || err}`);
      throw err;
    } finally {
      setIsDeletingAll(false);
      setDeleteAllProgress(null);
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Khung Upload File Excel Kéo Thả */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600 shrink-0" />
                <span>Nhập bảng điểm đa Sheet từ file Excel (.xlsx / .xls)</span>
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Cloud className="w-3 h-3 text-emerald-600" />
                <span>Lưu thật trên Firestore: student_scores</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Tự động duyệt <strong>TẤT CẢ CÁC SHEET</strong> (Toán, Văn, Sử, Tiếng Anh, Tin, Vật lý, Hóa, Sinh...), lấy tên Sheet làm môn học và lưu qua Batch Write.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
            <button
              onClick={downloadExcelTemplate}
              className="flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition inline-flex items-center justify-center gap-1.5"
              title="Tải file Excel mẫu đúng chuẩn đa sheet"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Tải file Excel mẫu đa sheet</span>
            </button>
            <button
              onClick={onLoadSampleData}
              className="flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition inline-flex items-center justify-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <span>Nạp 45 HS mẫu đa môn</span>
            </button>
            {students.length > 0 && (
              <button
                onClick={handleOpenDeleteAllModal}
                className="flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition inline-flex items-center justify-center gap-1.5"
                title="Xóa toàn bộ bản ghi trên Firebase và chương trình"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Xóa tất cả ({students.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Widget Cấu hình Đợt điểm gắn cho File Import */}
        <div className="mb-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Gắn Đợt Điểm Cho File Excel Chuẩn Bị Tải Lên:</span>
            </span>
            <span className="text-[11px] text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 font-medium">
              Bộ khóa Merge: <strong>[Mã HS + Môn + {uploadYear} + {uploadSemester} + {uploadPeriod}]</strong> (Không lo trùng lặp)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Năm học:</label>
              <select
                value={uploadYear}
                onChange={(e) => setUploadYear(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Năm học {yr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Học kỳ:</label>
              <select
                value={uploadSemester}
                onChange={(e) => {
                  const val = e.target.value as 'KS' | 'HK1' | 'HK2';
                  setUploadSemester(val);
                  if (val === 'KS') {
                    setUploadPeriod('KS');
                  } else if (val === 'HK2') {
                    if (uploadPeriod === 'GKI' || uploadPeriod === 'KS') setUploadPeriod('GKII');
                    else if (uploadPeriod === 'CKI') setUploadPeriod('CKII');
                  } else if (val === 'HK1') {
                    if (uploadPeriod === 'GKII' || uploadPeriod === 'KS') setUploadPeriod('GKI');
                    else if (uploadPeriod === 'CKII') setUploadPeriod('CKI');
                  }
                }}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500"
              >
                <option value="KS">KS đầu năm (Khảo sát đầu năm)</option>
                <option value="HK1">Học kỳ 1 (HK1)</option>
                <option value="HK2">Học kỳ 2 (HK2)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Đợt lấy điểm:</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setUploadPeriod('KS');
                    setUploadSemester('KS');
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                    uploadPeriod === 'KS'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                  title="Đợt khảo sát đầu năm (trước HK1)"
                >
                  KS đầu năm
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (uploadSemester === 'HK2') {
                      setUploadPeriod('GKII');
                    } else {
                      setUploadPeriod('GKI');
                      if (uploadSemester === 'KS') setUploadSemester('HK1');
                    }
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                    (uploadSemester === 'HK2' ? (uploadPeriod === 'GKII' || uploadPeriod === 'GKI') : uploadPeriod === 'GKI')
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {uploadSemester === 'HK2' ? 'Giữa kỳ (GKII)' : 'Giữa kỳ (GKI)'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (uploadSemester === 'HK2') {
                      setUploadPeriod('CKII');
                    } else {
                      setUploadPeriod('CKI');
                      if (uploadSemester === 'KS') setUploadSemester('HK1');
                    }
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                    (uploadSemester === 'HK2' ? (uploadPeriod === 'CKII' || uploadPeriod === 'CKI') : uploadPeriod === 'CKI')
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {uploadSemester === 'HK2' ? 'Cuối kỳ (CKII)' : 'Cuối kỳ (CKI)'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 sm:p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]'
              : 'border-slate-300 hover:border-indigo-500 hover:bg-slate-50/60'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileProcess(e.target.files[0], selectedSheetScope);
              }
            }}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />

          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-xs">
            {isSavingFirebase ? (
              <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-indigo-600" />
            ) : (
              <UploadCloud className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
          </div>

          <h3 className="text-sm font-bold text-slate-800 mb-1">
            {isLoading
              ? 'Đang phân tích toàn bộ Sheet & đồng bộ Firestore...'
              : 'Kéo thả file Excel vào đây hoặc click để chọn'}
          </h3>
          <p className="text-xs text-slate-500 max-w-2xl mx-auto">
            Hỗ trợ cột chuẩn: <strong>StudentID</strong>, <strong>FullName</strong>, <strong>Class</strong>, <strong>DOB</strong>, <strong>Ethnicity</strong>, <strong>Grade</strong>, <strong>Score (tự đổi phẩy &quot;,&quot; thành chấm &quot;.&quot;)</strong>, <strong>TeacherName</strong>.
          </p>
        </div>

        {/* Thanh tiến trình upload (Progress Bar) */}
        {uploadProgress && (
          <div className="mt-4 p-3.5 bg-indigo-50/80 rounded-xl border border-indigo-200 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-900">
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                Đang ghi Firestore (Batch Write):
              </span>
              <span>
                {uploadProgress.current} / {uploadProgress.total} ({Math.round((uploadProgress.current / uploadProgress.total) * 100)}%)
              </span>
            </div>
            <div className="w-full h-2 bg-indigo-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, Math.round((uploadProgress.current / uploadProgress.total) * 100))}%` }}
              />
            </div>
          </div>
        )}

        {/* Sheet Switcher nếu file có nhiều Sheet */}
        {multiSheetResult && multiSheetResult.sheetNames.length > 1 && (
          <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Tìm thấy {multiSheetResult.sheetNames.length} Sheet môn học trong file:</span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Tự động lấy tên Sheet làm tên Môn học
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => handleSelectSheetScope('ALL')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                  selectedSheetScope === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Tất cả các môn (Toàn bộ {multiSheetResult.sheetNames.length} Sheet)
              </button>
              {multiSheetResult.sheetNames.map((sheet) => (
                <button
                  key={sheet}
                  onClick={() => handleSelectSheetScope(sheet)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition ${
                    selectedSheetScope === sheet
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {sheet}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Thông báo lỗi nếu có */}
        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong>Không thể xử lý file:</strong> {errorMessage}
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Trạng thái Firebase */}
        {firebaseStatusMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{firebaseStatusMessage}</span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
              Collection: student_scores
            </span>
          </div>
        )}

        {/* Thống kê từng Sheet sau khi upload */}
        {multiSheetResult && multiSheetResult.sheetsSummary.length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {multiSheetResult.sheetsSummary.map((summary) => (
              <div
                key={summary.sheetName}
                className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-800 truncate" title={summary.sheetName}>
                    {summary.sheetName}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {summary.rowCount} HS
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  <span>ĐTB: </span>
                  <span className="font-bold text-slate-800">{summary.averageScore}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bảng Xem Trước & Quản Lý Dữ Liệu Thực (Data Preview Table) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Header toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Bảng danh sách điểm học sinh
              </h3>
              <span className="px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {filteredStudents.length} / {students.length} bản ghi
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Firestore Realtime (student_scores)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Dữ liệu thời gian thực được đồng bộ trực tiếp từ Cloud Firestore. Có thể lọc, tìm kiếm, chỉnh sửa điểm nhanh.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex-1 sm:flex-none px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-indigo-100 transition inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm học sinh</span>
            </button>
            {students.length > 0 && (
              <>
                <button
                  onClick={() =>
                    exportStudentsToExcel(
                      filteredStudents,
                      `Bang_Diem_EduScore_${config.academicYear || '2025-2026'}.xlsx`
                    )
                  }
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition inline-flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Xuất Excel đa sheet</span>
                </button>
                <button
                  onClick={handleOpenDeleteAllModal}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Xóa toàn bộ bản ghi trên Firebase và trong chương trình"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Xóa tất cả ({students.length})</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Thanh Bộ Lọc & Tìm Kiếm */}
        <div className="p-3 sm:p-4 bg-slate-50/70 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
          {/* Ô tìm kiếm */}
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm theo Tên, SBD, Giáo viên, Dân tộc..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Chọn Môn học */}
          <div>
            <select
              value={filterSubject}
              onChange={(e) => {
                setFilterSubject(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white rounded-lg border border-slate-300 font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">Tất cả Môn học ({uniqueSubjects.length})</option>
              {uniqueSubjects.map((subj) => (
                <option key={subj} value={subj}>
                  Môn {subj}
                </option>
              ))}
            </select>
          </div>

          {/* Chọn Lớp */}
          <div>
            <select
              value={filterClass}
              onChange={(e) => {
                setFilterClass(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white rounded-lg border border-slate-300 font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">Tất cả Lớp ({uniqueClasses.length})</option>
              {uniqueClasses.map((cls) => (
                <option key={cls} value={cls}>
                  Lớp {cls}
                </option>
              ))}
            </select>
          </div>

          {/* Chọn Xếp loại */}
          <div>
            <select
              value={filterClassification}
              onChange={(e) => {
                setFilterClassification(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white rounded-lg border border-slate-300 font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">Tất cả xếp loại</option>
              <option value="Tốt">Tốt (&gt;= 8.0)</option>
              <option value="Khá">Khá (6.5 - 7.9)</option>
              <option value="Đạt">Đạt (5.0 - 6.4)</option>
              <option value="Chưa đạt">Chưa đạt (&lt; 5.0)</option>
              <option value="Vắng">Vắng thi / Chưa có điểm</option>
            </select>
          </div>
        </div>

        {/* Bảng danh sách điểm */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <th className="py-3 px-3 text-center w-12">#</th>
                <th className="py-3 px-3 w-24">Mã HS / SBD</th>
                <th className="py-3 px-3 min-w-[160px]">Họ và tên</th>
                <th className="py-3 px-3 w-20 text-center">Lớp</th>
                <th className="py-3 px-3 w-28 text-center">Môn học</th>
                <th className="py-3 px-3 w-28 text-center">Đợt điểm</th>
                <th className="py-3 px-3 w-24 text-center">Ngày sinh</th>
                <th className="py-3 px-3 w-24 text-center">Dân tộc</th>
                <th className="py-3 px-3 w-20 text-center">Khối</th>
                <th className="py-3 px-3 w-24 text-center">Điểm số</th>
                <th className="py-3 px-3 w-28 text-center">Xếp loại</th>
                <th className="py-3 px-3 min-w-[150px]">Giáo viên dạy</th>
                <th className="py-3 px-3 text-center w-24">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400">
                    <div className="max-w-sm mx-auto space-y-2">
                      <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="font-semibold text-slate-600">Không có dữ liệu điểm nào</p>
                      <p className="text-xs text-slate-400">
                        Hãy kéo thả file Excel điểm danh hoặc bấm &quot;Nạp 45 HS mẫu&quot; để trải nghiệm.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((s, idx) => {
                  const isEditing = editingId === s.id;
                  const studentId = s.studentId || s.soBD;
                  const fullName = s.fullName || s.hoTen;
                  const className = s.class || s.lop;
                  const subject = s.subject || s.monHoc;
                  const period = s.period || s.dotDiem || 'GKI';
                  const semester = s.semester || s.hocKy || 'HK1';
                  const year = s.academicYear || s.namHoc || '2025-2026';
                  const dob = s.dob || s.ngaySinh;
                  const ethnicity = s.ethnicity || s.danToc;
                  const grade = s.grade || s.khoi;
                  const score = s.score !== undefined ? s.score : s.diem;
                  const teacher = s.teacherName || s.giaoVien;
                  const rank = s.rank || s.xepLoai;

                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-indigo-50/30 transition-colors group"
                    >
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {startIndex + idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">
                        {studentId}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {fullName}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-semibold text-slate-700 border border-slate-200">
                          {className}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 bg-indigo-50 rounded text-[11px] font-bold text-indigo-700 border border-indigo-200">
                          {subject}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                          {period} - {semester}
                          <span className="block text-[9px] text-slate-500 font-normal">
                            {year}
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 text-[11px]">
                        {dob || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600">
                        {ethnicity || 'Kinh'}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 text-[11px]">
                        {grade}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="text"
                              value={editScoreValue}
                              onChange={(e) => setEditScoreValue(e.target.value)}
                              placeholder="0-10"
                              className="w-14 px-1.5 py-0.5 text-center text-xs font-bold border border-indigo-500 rounded bg-white focus:outline-none"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveInlineScore(s);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                            />
                            <button
                              onClick={() => handleSaveInlineScore(s)}
                              className="p-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                              title="Lưu điểm"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300"
                              title="Hủy"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span
                            onClick={() => {
                              setEditingId(s.id);
                              setEditScoreValue(score !== null ? String(score) : '');
                            }}
                            className={`cursor-pointer px-2 py-0.5 rounded text-xs transition ${
                              score === null
                                ? 'text-slate-400 bg-slate-100 hover:bg-slate-200'
                                : score >= 8.0
                                ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                : score >= 6.5
                                ? 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                                : score >= 5.0
                                ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                                : 'text-rose-700 bg-rose-50 hover:bg-rose-100'
                            }`}
                            title="Click để sửa nhanh điểm"
                          >
                            {score !== null ? score.toFixed(1) : 'Vắng'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            rank === 'Tốt'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : rank === 'Khá'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : rank === 'Đạt'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : rank === 'Chưa đạt'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {rank}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 text-xs truncate max-w-[180px]" title={teacher}>
                        {teacher}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100">
                          <button
                            onClick={() => {
                              setEditingId(s.id);
                              setEditScoreValue(score !== null ? String(score) : '');
                            }}
                            className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                            title="Sửa điểm"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(s.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Xóa bản ghi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50/50">
            <div>
              Hiển thị <strong>{startIndex + 1}</strong> - <strong>{Math.min(startIndex + pageSize, totalFiltered)}</strong> trên tổng số <strong>{totalFiltered}</strong> bản ghi
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-slate-800">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === 1 || currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Thêm Học Sinh Thủ Công */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                <span>Thêm học sinh mới vào Firestore</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewStudentSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mã HS / SBD <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newStudent.studentId}
                    onChange={(e) => setNewStudent({ ...newStudent, studentId: e.target.value })}
                    placeholder="VD: 170016"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Môn học <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newStudent.subject}
                    onChange={(e) => setNewStudent({ ...newStudent, subject: e.target.value })}
                    placeholder="VD: Toán, Văn, Sử..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Họ và tên học sinh <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newStudent.fullName}
                  onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })}
                  placeholder="VD: Nguyễn Văn An"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lớp</label>
                  <input
                    type="text"
                    value={newStudent.class}
                    onChange={(e) => setNewStudent({ ...newStudent, class: e.target.value })}
                    placeholder="VD: 10B1"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Khối</label>
                  <input
                    type="text"
                    value={newStudent.grade}
                    onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value })}
                    placeholder="VD: Khối 10"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dân tộc</label>
                  <input
                    type="text"
                    value={newStudent.ethnicity}
                    onChange={(e) => setNewStudent({ ...newStudent, ethnicity: e.target.value })}
                    placeholder="Kinh, Gia-rai..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày sinh</label>
                  <input
                    type="text"
                    value={newStudent.dob}
                    onChange={(e) => setNewStudent({ ...newStudent, dob: e.target.value })}
                    placeholder="DD/MM/YYYY"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Điểm số (0.0 - 10.0)
                  </label>
                  <input
                    type="text"
                    value={newStudent.score}
                    onChange={(e) => setNewStudent({ ...newStudent, score: e.target.value })}
                    placeholder="VD: 8.5 hoặc để trống"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Giáo viên giảng dạy</label>
                <input
                  type="text"
                  value={newStudent.teacherName}
                  onChange={(e) => setNewStudent({ ...newStudent, teacherName: e.target.value })}
                  placeholder="VD: Trần Thị Mỹ Tuyên"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 font-semibold rounded-lg transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm shadow-indigo-200 transition inline-flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu lên Firebase</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bảng hỏi xác nhận xóa toàn bộ bản ghi (Modal) */}
      <DeleteAllConfirmModal
        isOpen={isDeleteAllModalOpen}
        onClose={() => {
          if (!isDeletingAll) {
            setIsDeleteAllModalOpen(false);
          }
        }}
        onConfirmDelete={handleConfirmDeleteAll}
        students={students}
        isDeleting={isDeletingAll}
        deleteProgress={deleteAllProgress}
      />
    </div>
  );
};
