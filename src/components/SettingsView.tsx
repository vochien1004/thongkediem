import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  Sliders,
  Building,
  Save,
  RotateCcw,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Database,
  Cloud,
  RefreshCw,
  Server,
  Key,
  ShieldCheck,
  Globe,
  Calendar,
  CalendarCheck,
  ListOrdered,
  Filter,
} from 'lucide-react';
import { SystemConfig, StudentScore, FirebaseCustomConfig, ExamPeriodConfig } from '../types';
import { DEFAULT_THRESHOLDS, classifyScore } from '../utils/scoreClassifier';
import {
  saveStoredConfig,
  saveStoredStudents,
  exportBackupJSON,
} from '../utils/storage';
import { DEFAULT_EXAM_PERIODS } from '../utils/periodConfig';
import { getSampleStudents } from '../data/sampleData';
import {
  getActiveFirebaseConfig,
  saveCustomFirebaseConfig,
  resetFirebaseConfigToDefault,
  testFirestoreConnection,
  saveStudentsToFirestore,
  clearAllStudentsFromFirestore,
  deleteStudentsByScopeFromFirestore,
  isRecordInDeleteScope,
  DeleteScopeCriteria,
  saveSystemConfigToFirestore,
} from '../firebaseService';
import { DeleteAllConfirmModal } from './DeleteAllConfirmModal';

interface SettingsViewProps {
  config: SystemConfig;
  setConfig: React.Dispatch<React.SetStateAction<SystemConfig>>;
  students: StudentScore[];
  setStudents: React.Dispatch<React.SetStateAction<StudentScore[]>>;
  onDeleteAll?: (onProgress?: (current: number, total: number) => void) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  setConfig,
  students,
  setStudents,
  onDeleteAll,
}) => {
  const [formData, setFormData] = useState<SystemConfig>(() => ({
    ...config,
    examPeriods: config.examPeriods && config.examPeriods.length > 0 ? config.examPeriods : DEFAULT_EXAM_PERIODS,
  }));
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Tự động đồng bộ formData khi config thay đổi từ Bộ lọc toàn cục
  useEffect(() => {
    setFormData({
      ...config,
      examPeriods: config.examPeriods && config.examPeriods.length > 0 ? config.examPeriods : DEFAULT_EXAM_PERIODS,
    });
  }, [config]);

  // Firebase Config State
  const [firebaseCfg, setFirebaseCfg] = useState<FirebaseCustomConfig>(() => getActiveFirebaseConfig());
  const [isTestingFirebase, setIsTestingFirebase] = useState(false);
  const [isSavingFirebase, setIsSavingFirebase] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; timestamp?: string } | null>(null);
  const [firebaseSaveSuccess, setFirebaseSaveSuccess] = useState(false);

  // Trạng thái Quản lý & Xóa dữ liệu (Danger Zone)
  const [deleteMode, setDeleteMode] = useState<'by_period' | 'all'>('by_period');
  const [deleteYear, setDeleteYear] = useState<string>(() => config.academicYear || '2025-2026');
  const [deletePeriodId, setDeletePeriodId] = useState<string>('GKI');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<{ current: number; total: number } | null>(null);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate thresholds
    const { datMin, khaMin, totMin } = formData.thresholds;
    if (datMin >= khaMin || khaMin >= totMin || datMin < 0 || totMin > 10) {
      alert('Ngưỡng điểm không hợp lệ! Quy tắc bắt buộc: 0 <= Đạt < Khá < Tốt <= 10.0');
      return;
    }

    // Cập nhật cấu hình trên ứng dụng
    setConfig(formData);
    saveStoredConfig(formData);

    // Đồng bộ tức thời cấu hình (bao gồm đợt KS đầu năm và các năm học) lên Firebase Firestore
    saveSystemConfigToFirestore(formData).catch((err) => {
      console.warn('Lỗi khi đồng bộ cấu hình lên Firebase Firestore:', err);
    });

    // Tự động tính lại xếp loại cho toàn bộ danh sách học sinh theo ngưỡng mới
    if (students.length > 0) {
      const recalculated = students.map((s) => ({
        ...s,
        rank: classifyScore(s.score, formData.thresholds),
        xepLoai: classifyScore(s.score, formData.thresholds),
      }));
      setStudents(recalculated);
      saveStoredStudents(recalculated);
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const availableAcademicYears = useMemo(() => {
    const defaultYears = ['2024-2025', '2025-2026', '2026-2027'];
    const fromConfig = formData.availableAcademicYears || config.availableAcademicYears || [];
    const fromStudents = Array.from(new Set(students.map((s) => s.academicYear || s.namHoc))).filter(Boolean) as string[];
    return Array.from(new Set([...defaultYears, ...fromConfig, ...fromStudents]));
  }, [formData.availableAcademicYears, config.availableAcademicYears, students]);

  // Helper chuyển ID đợt sang tên hiển thị
  const getPeriodDisplayName = (pId: string) => {
    if (pId === 'ALL') return `Tất cả các đợt trong năm học ${deleteYear}`;
    if (pId === 'KS') return 'Khảo sát đầu năm (KS)';
    if (pId === 'GKI' || pId === 'GKI-HK1') return 'Giữa Học kỳ 1 (GKI)';
    if (pId === 'CKI' || pId === 'CKI-HK1') return 'Cuối Học kỳ 1 (CKI)';
    if (pId === 'GKII') return 'Giữa Học kỳ 2 (GKII)';
    if (pId === 'CKII') return 'Cuối Học kỳ 2 (CKII)';
    const match = (config.examPeriods || DEFAULT_EXAM_PERIODS).find((p) => p.id === pId || p.period === pId);
    return match ? match.name : pId;
  };

  // Danh sách các bản ghi sẽ bị xóa theo lựa chọn hiện tại
  const targetDeleteStudents = useMemo(() => {
    if (deleteMode === 'all') {
      return students;
    }
    const criteria: DeleteScopeCriteria = {
      academicYear: deleteYear,
      periodId: deletePeriodId,
    };
    return students.filter((s) => isRecordInDeleteScope(s, criteria));
  }, [students, deleteMode, deleteYear, deletePeriodId]);

  // Thống kê nhanh các môn và lớp của dữ liệu sẽ xóa
  const targetStats = useMemo(() => {
    const subjects = Array.from(new Set(targetDeleteStudents.map((s) => s.subject || s.monHoc))).filter(Boolean);
    const classes = Array.from(new Set(targetDeleteStudents.map((s) => s.class || s.lop))).filter(Boolean);
    return {
      count: targetDeleteStudents.length,
      subjects,
      classes,
    };
  }, [targetDeleteStudents]);

  const handleTogglePeriodYear = (periodId: string, year: string) => {
    const periods = formData.examPeriods && formData.examPeriods.length > 0 ? formData.examPeriods : DEFAULT_EXAM_PERIODS;
    const updated = periods.map((p) => {
      if (p.id !== periodId) return p;
      const years = p.applicableYears || [];
      const nextYears = years.includes(year)
        ? years.filter((y) => y !== year)
        : [...years, year];
      return { ...p, applicableYears: nextYears };
    });
    setFormData({ ...formData, examPeriods: updated });
  };

  const handleTogglePeriodActive = (periodId: string) => {
    const periods = formData.examPeriods && formData.examPeriods.length > 0 ? formData.examPeriods : DEFAULT_EXAM_PERIODS;
    const updated = periods.map((p) => {
      if (p.id !== periodId) return p;
      return { ...p, enabled: !p.enabled };
    });
    setFormData({ ...formData, examPeriods: updated });
  };

  const handleResetThresholds = () => {
    if (window.confirm('Khôi phục thang điểm về mặc định (Đạt: 5.0, Khá: 6.5, Tốt: 8.0)?')) {
      const updated = {
        ...formData,
        thresholds: DEFAULT_THRESHOLDS,
      };
      setFormData(updated);
    }
  };

  // Kiểm tra kết nối Firestore
  const handleTestFirebaseConnection = async () => {
    setIsTestingFirebase(true);
    setTestResult(null);
    try {
      const res = await testFirestoreConnection();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Lỗi khi kiểm tra kết nối',
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      });
    } finally {
      setIsTestingFirebase(false);
    }
  };

  // Lưu cấu hình Firebase tùy chỉnh và kích hoạt kết nối thật đến Firestore mới
  const handleSaveFirebaseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseCfg.projectId || !firebaseCfg.apiKey) {
      alert('Vui lòng nhập đầy đủ Project ID và API Key!');
      return;
    }

    setIsSavingFirebase(true);
    setTestResult(null);
    try {
      // Lưu vào LocalStorage, hủy app cũ và khởi tạo app mới với cấu hình thật
      await saveCustomFirebaseConfig(firebaseCfg);

      // Thử kết nối thực tế tới project Firebase vừa cấu hình
      const res = await testFirestoreConnection();
      setTestResult(res);

      if (res.success) {
        setFirebaseSaveSuccess(true);
        setTimeout(() => setFirebaseSaveSuccess(false), 4000);
      }
    } catch (err: any) {
      console.error('Lỗi khi lưu và kết nối Firebase:', err);
      setTestResult({
        success: false,
        message: `Lỗi kết nối Firebase: ${err?.message || err}`,
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      });
      alert(`Lỗi khi kết nối Firebase: ${err?.message || err}`);
    } finally {
      setIsSavingFirebase(false);
    }
  };

  // Khôi phục cấu hình Firebase mặc định
  const handleResetFirebaseConfig = async () => {
    if (window.confirm('Khôi phục cấu hình Firebase về mặc định của hệ thống AI Studio?')) {
      setIsTestingFirebase(true);
      setTestResult(null);
      try {
        await resetFirebaseConfigToDefault();
        const defCfg = getActiveFirebaseConfig();
        setFirebaseCfg(defCfg);
        const res = await testFirestoreConnection();
        setTestResult(res);
        alert('Đã khôi phục và kết nối lại Firebase mặc định thành công!');
      } catch (err: any) {
        alert(`Lỗi khi khôi phục Firebase mặc định: ${err?.message || err}`);
      } finally {
        setIsTestingFirebase(false);
      }
    }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.students && Array.isArray(parsed.students)) {
          setStudents(parsed.students);
          saveStoredStudents(parsed.students);
          // Đồng bộ lên Firebase
          await saveStudentsToFirestore(parsed.students, true);
        }
        if (parsed.config) {
          setConfig(parsed.config);
          setFormData(parsed.config);
          saveStoredConfig(parsed.config);
        }
        alert('Khôi phục dữ liệu từ file sao lưu và đồng bộ Firebase thành công!');
      } catch (err: any) {
        alert(`File sao lưu không hợp lệ: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleLoadSample = async () => {
    if (window.confirm('Bạn có muốn tải dữ liệu học sinh mẫu đa môn học?')) {
      const sample = getSampleStudents();
      setStudents(sample);
      saveStoredStudents(sample);
      try {
        const res = await saveStudentsToFirestore(sample, true);
        if (res.quotaExceeded) {
          alert('Đã nạp thành công dữ liệu mẫu vào bộ nhớ trình duyệt (LocalStorage)! Hạn mức ghi miễn phí trong ngày của Firestore đã đạt giới hạn (sẽ tự động làm mới vào ngày mai).');
        } else {
          alert('Đã nạp học sinh mẫu và đồng bộ thành công lên Firebase Firestore!');
        }
      } catch {
        alert('Đã nạp dữ liệu mẫu vào bộ nhớ trình duyệt (LocalStorage) thành công!');
      }
    }
  };

  // Xác nhận xóa dữ liệu (Theo Đợt kiểm tra & Năm học hoặc Toàn bộ hệ thống)
  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setDeleteSuccessMsg(null);
    try {
      const criteria: DeleteScopeCriteria =
        deleteMode === 'all'
          ? { academicYear: 'ALL', periodId: 'ALL' }
          : { academicYear: deleteYear, periodId: deletePeriodId };

      const res = await deleteStudentsByScopeFromFirestore(criteria, (current, total) => {
        setDeleteProgress({ current, total });
      });

      // Cập nhật lại danh sách học sinh trên ứng dụng và LocalStorage
      const remaining =
        deleteMode === 'all'
          ? []
          : students.filter((s) => !isRecordInDeleteScope(s, criteria));

      setStudents(remaining);
      saveStoredStudents(remaining);

      if (res.quotaExceeded) {
        setDeleteSuccessMsg(
          `Đã xóa ${res.count} bản ghi trong bộ nhớ máy. Hạn mức Firestore trong ngày đã đạt giới hạn.`
        );
      } else {
        const scopeDesc =
          deleteMode === 'all'
            ? 'toàn bộ bản ghi hệ thống'
            : `các bản ghi của đợt "${getPeriodDisplayName(deletePeriodId)}" (Năm học ${deleteYear})`;
        setDeleteSuccessMsg(
          `Đã xóa thành công ${res.count} bản ghi ${scopeDesc} trên Cloud Firestore và bộ nhớ chương trình!`
        );
      }

      setIsDeleteModalOpen(false);
      setTimeout(() => setDeleteSuccessMsg(null), 6000);
    } catch (err: any) {
      alert(`Lỗi khi xóa dữ liệu: ${err?.message || err}`);
    } finally {
      setIsDeleting(false);
      setDeleteProgress(null);
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-5xl mx-auto">
      {/* Khối Cấu hình Firebase Firestore Real Data */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Cấu hình kết nối Firebase Firestore
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Real Data Mode
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Toàn bộ dữ liệu được lưu thật trên Cloud Firestore (Collection: <code>student_scores</code>)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetFirebaseConfig}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Khôi phục mặc định</span>
            </button>
            <button
              type="button"
              onClick={handleTestFirebaseConnection}
              disabled={isTestingFirebase}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition inline-flex items-center gap-1.5"
            >
              {isTestingFirebase ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              )}
              <span>Kiểm tra kết nối</span>
            </button>
          </div>
        </div>

        {/* Kết quả kiểm tra kết nối */}
        {testResult && (
          <div
            className={`mb-4 p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
              testResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
            {testResult.timestamp && (
              <span className="text-[11px] text-slate-500 font-mono">
                {testResult.timestamp}
              </span>
            )}
          </div>
        )}

        <form onSubmit={handleSaveFirebaseConfig} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Project ID (Mã dự án Firebase) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={firebaseCfg.projectId}
                onChange={(e) => setFirebaseCfg({ ...firebaseCfg, projectId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Database ID (Tên Database Firestore)
              </label>
              <input
                type="text"
                value={firebaseCfg.firestoreDatabaseId || ''}
                onChange={(e) => setFirebaseCfg({ ...firebaseCfg, firestoreDatabaseId: e.target.value })}
                placeholder="(default) hoặc ID database cụ thể"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                API Key (Web API Key) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={firebaseCfg.apiKey}
                onChange={(e) => setFirebaseCfg({ ...firebaseCfg, apiKey: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Auth Domain
              </label>
              <input
                type="text"
                value={firebaseCfg.authDomain}
                onChange={(e) => setFirebaseCfg({ ...firebaseCfg, authDomain: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                App ID
              </label>
              <input
                type="text"
                value={firebaseCfg.appId}
                onChange={(e) => setFirebaseCfg({ ...firebaseCfg, appId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Storage Bucket
              </label>
              <input
                type="text"
                value={firebaseCfg.storageBucket}
                onChange={(e) => setFirebaseCfg({ ...firebaseCfg, storageBucket: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Messaging Sender ID
              </label>
              <input
                type="text"
                value={firebaseCfg.messagingSenderId || ''}
                onChange={(e) => setFirebaseCfg({ ...firebaseCfg, messagingSenderId: e.target.value })}
                placeholder="VD: 726735657163"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-500">
              {firebaseSaveSuccess && (
                <span className="text-emerald-700 font-semibold flex items-center gap-1 animate-pulse">
                  <CheckCircle2 className="w-4 h-4" />
                  Đã lưu và kích hoạt kết nối thành công tới Firebase Firestore thật!
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={isSavingFirebase}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-sm transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isSavingFirebase ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{isSavingFirebase ? 'Đang kết nối Firebase...' : 'Lưu & Kết nối Firebase'}</span>
            </button>
          </div>
        </form>
      </div>

      <form onSubmit={handleSaveConfig} className="space-y-4 sm:space-y-6">
        {/* Khối 1: Thang điểm đánh giá */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Cấu hình thang điểm đánh giá</h3>
                <p className="text-xs text-slate-500">
                  Thiết lập ngưỡng điểm chuẩn để tự động phân loại học lực
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleResetThresholds}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Mặc định</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Ngưỡng Đạt */}
            <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200">
              <div className="text-xs font-semibold text-amber-800 mb-1">
                1. Mức Đạt (Tối thiểu)
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={formData.thresholds.datMin}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      thresholds: {
                        ...formData.thresholds,
                        datMin: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-20 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-sm font-bold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-xs text-slate-600">điểm trở lên</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Điểm &lt; {formData.thresholds.datMin} sẽ xếp loại <strong>Chưa đạt</strong>
              </p>
            </div>

            {/* Ngưỡng Khá */}
            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200">
              <div className="text-xs font-semibold text-blue-800 mb-1">
                2. Mức Khá (Tối thiểu)
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={formData.thresholds.khaMin}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      thresholds: {
                        ...formData.thresholds,
                        khaMin: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-20 px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg text-sm font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-600">điểm trở lên</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Từ {formData.thresholds.datMin} đến {(formData.thresholds.khaMin - 0.1).toFixed(1)} xếp loại <strong>Đạt</strong>
              </p>
            </div>

            {/* Ngưỡng Tốt */}
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200">
              <div className="text-xs font-semibold text-emerald-800 mb-1">
                3. Mức Tốt (Tối thiểu)
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={formData.thresholds.totMin}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      thresholds: {
                        ...formData.thresholds,
                        totMin: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-20 px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-sm font-bold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-600">điểm trở lên</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Từ {formData.thresholds.khaMin} đến {(formData.thresholds.totMin - 0.1).toFixed(1)} xếp loại <strong>Khá</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Khối 2: Thông tin Đơn vị & Kỳ thi */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Thông tin Đơn vị & Kỳ thi</h3>
              <p className="text-xs text-slate-500">
                Hiển thị trên báo cáo thống kê và tiêu đề xuất file Excel
              </p>
            </div>
          </div>

          <div className="mb-3 px-3 py-2 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-800 flex items-center justify-between">
            <span>✨ Tự động đồng bộ theo <strong>Bộ lọc toàn cục</strong> (Năm học, Học kỳ, Đợt kiểm tra). Bạn vẫn có thể chỉnh sửa thủ công dưới đây.</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tên trường / Cơ sở GD</label>
              <input
                type="text"
                value={formData.schoolName}
                onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tên kỳ thi / Đợt kiểm tra</label>
              <input
                type="text"
                value={formData.examName}
                onChange={(e) => setFormData({ ...formData, examName: e.target.value, reportTitle: `${e.target.value} - Năm học ${formData.academicYear}` })}
                className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Năm học</label>
              <input
                type="text"
                value={formData.academicYear}
                onChange={(e) => setFormData({ ...formData, academicYear: e.target.value, reportTitle: `${formData.examName} - Năm học ${e.target.value}` })}
                placeholder="VD: 2025 - 2026"
                className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Học kỳ</label>
              <input
                type="text"
                value={formData.term}
                onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                placeholder="VD: Học kỳ I"
                className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Tiêu đề báo cáo / Tên đợt (Tự động kết hợp)</label>
              <input
                type="text"
                value={formData.reportTitle || `${formData.examName} - Năm học ${formData.academicYear}`}
                onChange={(e) => setFormData({ ...formData, reportTitle: e.target.value })}
                placeholder="VD: Kiểm tra giữa học kỳ I - Năm học 2025 - 2026"
                className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-indigo-900 font-semibold"
              />
            </div>
          </div>
        </div>

        {/* Khối Cấu hình Đợt kiểm tra & Năm học áp dụng (KS đầu năm đứng trước HK1) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    Cấu hình Đợt kiểm tra theo Năm học
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    Đồng bộ Firebase
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Cấu hình đợt <strong>KS đầu năm (Khảo sát đầu năm)</strong> đứng trước Học kỳ 1 (HK1) và áp dụng cho các năm học được chọn.
                </p>
              </div>
            </div>
            <span className="text-[11px] text-slate-500 italic">
              * Tự động lưu lên Cloud Firestore khi nhấn "Lưu cấu hình"
            </span>
          </div>

          <div className="space-y-3">
            {(formData.examPeriods && formData.examPeriods.length > 0 ? formData.examPeriods : DEFAULT_EXAM_PERIODS).map(
              (p, idx) => {
                const isKS = p.id === 'KS';
                return (
                  <div
                    key={p.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isKS
                        ? 'bg-amber-50/50 border-amber-200 ring-1 ring-amber-300/60'
                        : 'bg-slate-50/70 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-start sm:items-center gap-3">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isKS
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">{p.name}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-slate-600 border border-slate-200">
                              {p.code}
                            </span>
                            {isKS && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                Đứng trước HK1
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{p.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={p.enabled}
                            onChange={() => handleTogglePeriodActive(p.id)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          />
                          <span className={`font-semibold ${p.enabled ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {p.enabled ? 'Đang bật' : 'Tạm tắt'}
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Năm học áp dụng đợt kiểm tra này */}
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                        <CalendarCheck className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Năm học áp dụng:</span>
                      </span>
                      {availableAcademicYears.map((year) => {
                        const isChecked = (p.applicableYears || []).includes(year);
                        return (
                          <button
                            key={year}
                            type="button"
                            onClick={() => handleTogglePeriodYear(p.id, year)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1 ${
                              isChecked
                                ? isKS
                                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                                  : 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            <span>{isChecked ? '✓' : '+'}</span>
                            <span>{year}</span>
                          </button>
                        );
                      })}
                      {(p.applicableYears || []).length === 0 && (
                        <span className="text-[11px] text-rose-500 italic">
                          (Chưa gán năm học nào)
                        </span>
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>

        {/* Nút lưu cấu hình */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            {saveSuccess && (
              <span className="text-emerald-700 font-semibold flex items-center gap-1 animate-pulse">
                <CheckCircle2 className="w-4 h-4" />
                <span>Đã lưu và áp dụng thang điểm mới cho {students.length} học sinh!</span>
              </span>
            )}
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 transition flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Lưu & Áp dụng cấu hình</span>
          </button>
        </div>
      </form>

      {/* Khối 3: Quản lý & Sao lưu dữ liệu */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-4">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Sao lưu & Quản lý dữ liệu hệ thống</h3>
            <p className="text-xs text-slate-500">
              Xuất / Nhập file sao lưu JSON an toàn hoặc khôi phục dữ liệu ban đầu
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => exportBackupJSON(students, config)}
            className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Xuất file sao lưu (.json)</span>
          </button>

          <label className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer">
            <Upload className="w-4 h-4 text-blue-600" />
            <span>Nhập file sao lưu (.json)</span>
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>
        </div>
      </div>

      {/* Khối 4: Vùng nguy hiểm - Xóa dữ liệu theo Đợt kiểm tra & Năm học hoặc Toàn bộ */}
      <div className="bg-white rounded-2xl p-6 border border-rose-200 shadow-xs">
        <div className="flex items-center gap-2.5 pb-4 border-b border-rose-100 mb-4">
          <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-rose-900 text-sm">
              Vùng nguy hiểm: Xóa dữ liệu theo Đợt kiểm tra & Năm học
            </h3>
            <p className="text-xs text-rose-600">
              Tùy chọn xóa dữ liệu của một đợt kiểm tra cụ thể hoặc toàn bộ hệ thống trên Cloud Firestore (Collection: <code>student_scores</code>)
            </p>
          </div>
        </div>

        {deleteSuccessMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{deleteSuccessMsg}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Lựa chọn chế độ xóa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition select-none ${
                deleteMode === 'by_period'
                  ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-500/20 shadow-2xs'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
              }`}
            >
              <input
                type="radio"
                name="deleteMode"
                value="by_period"
                checked={deleteMode === 'by_period'}
                onChange={() => setDeleteMode('by_period')}
                className="mt-0.5 text-rose-600 focus:ring-rose-500 h-4 w-4"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">Xóa theo Đợt kiểm tra & Năm học</span>
                <span className="text-slate-500 text-[11px]">
                  Xóa an toàn các bản ghi thuộc 1 đợt thi cụ thể mà không ảnh hưởng đến các đợt khác
                </span>
              </div>
            </label>

            <label
              className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition select-none ${
                deleteMode === 'all'
                  ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-500/20 shadow-2xs'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
              }`}
            >
              <input
                type="radio"
                name="deleteMode"
                value="all"
                checked={deleteMode === 'all'}
                onChange={() => setDeleteMode('all')}
                className="mt-0.5 text-rose-600 focus:ring-rose-500 h-4 w-4"
              />
              <div className="text-xs">
                <span className="font-bold text-rose-900 block">Xóa TOÀN BỘ dữ liệu hệ thống</span>
                <span className="text-slate-500 text-[11px]">
                  Xóa tất cả các năm học, môn học và làm trống toàn bộ dữ liệu Firestore
                </span>
              </div>
            </label>
          </div>

          {/* Bộ chọn Năm học & Đợt kiểm tra khi chọn xóa theo đợt */}
          {deleteMode === 'by_period' && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-indigo-600" />
                <span>Chọn Đợt kiểm tra và Năm học cần xóa:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Năm học:
                  </label>
                  <select
                    value={deleteYear}
                    onChange={(e) => setDeleteYear(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  >
                    {availableAcademicYears.map((y) => (
                      <option key={y} value={y}>
                        Năm học {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Đợt kiểm tra:
                  </label>
                  <select
                    value={deletePeriodId}
                    onChange={(e) => setDeletePeriodId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  >
                    <option value="KS">Khảo sát đầu năm (KS)</option>
                    <option value="GKI">Kiểm tra Giữa HK1 (GKI)</option>
                    <option value="CKI">Kiểm tra Cuối HK1 (CKI)</option>
                    <option value="GKII">Kiểm tra Giữa HK2 (GKII)</option>
                    <option value="CKII">Kiểm tra Cuối HK2 (CKII)</option>
                    <option value="ALL">-- Tất cả các đợt trong năm học {deleteYear} --</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Hộp tóm tắt số bản ghi và nút thực hiện */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-rose-50/50 p-4 rounded-xl border border-rose-100">
            <div className="text-xs text-slate-700 space-y-1">
              <div className="font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                <span>
                  {deleteMode === 'all' ? 'Toàn hệ thống:' : `Đợt [${getPeriodDisplayName(deletePeriodId)}] - Năm học ${deleteYear}:`}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full font-bold ${
                    targetStats.count > 0
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {targetStats.count} bản ghi điểm
                </span>
              </div>

              {targetStats.count > 0 ? (
                <div className="text-[11px] text-slate-500 space-y-0.5">
                  <p>
                    Gồm <strong>{targetStats.subjects.length} môn học</strong> ({targetStats.subjects.slice(0, 4).join(', ')}
                    {targetStats.subjects.length > 4 ? '...' : ''}) và <strong>{targetStats.classes.length} lớp học</strong>.
                  </p>
                  <p className="text-rose-700 font-medium">
                    Bấm nút bên cạnh để mở hộp thoại xác nhận xóa vĩnh viễn trên Cloud Firestore.
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic">
                  Không tìm thấy bản ghi nào thuộc phạm vi đã chọn.
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={targetStats.count === 0}
              onClick={() => setIsDeleteModalOpen(true)}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-sm shadow-rose-200 transition inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>
                {deleteMode === 'all'
                  ? `Xóa tất cả bản ghi (${students.length})`
                  : `Xóa dữ liệu đợt đã chọn (${targetStats.count})`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Bảng hỏi xác nhận xóa bản ghi theo phạm vi đã chọn */}
      <DeleteAllConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isDeleting) {
            setIsDeleteModalOpen(false);
          }
        }}
        onConfirmDelete={handleConfirmDelete}
        students={targetDeleteStudents}
        isDeleting={isDeleting}
        deleteProgress={deleteProgress}
        scopeTitle={
          deleteMode === 'all'
            ? 'Xác nhận xóa TOÀN BỘ dữ liệu hệ thống'
            : 'Xác nhận xóa dữ liệu Đợt kiểm tra'
        }
        scopeSubtitle={
          deleteMode === 'all'
            ? 'Xóa tất cả các năm học và đợt kiểm tra trên Firestore & hệ thống'
            : `Đợt: ${getPeriodDisplayName(deletePeriodId)} - Năm học ${deleteYear}`
        }
        academicYear={deleteMode === 'all' ? undefined : deleteYear}
        periodName={deleteMode === 'all' ? undefined : getPeriodDisplayName(deletePeriodId)}
      />
    </div>
  );
};
