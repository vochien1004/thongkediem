import React, { useState } from 'react';
import {
  Users,
  Award,
  TrendingUp,
  AlertTriangle,
  BookOpen,
  ArrowRight,
  UserCheck,
  FileSpreadsheet,
  BarChart3,
  Download,
  School,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { StudentScore, SummaryStats, ActiveTab, SystemConfig, GlobalFilterState, AuthUser } from '../types';
import {
  exportQualityBySubject,
  exportQualityByClass,
  exportQualityByTeacher,
  exportQuantityNeedAttention,
  exportListNeedAttention,
  exportSpecialAttention,
  exportAll5Reports,
} from '../utils/reportExportHelpers';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

interface DashboardViewProps {
  students: StudentScore[];
  stats: SummaryStats;
  config: SystemConfig;
  setActiveTab: (tab: ActiveTab) => void;
  onLoadSampleData: () => void;
  globalFilter?: GlobalFilterState;
  currentUser?: AuthUser | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  students,
  stats,
  config,
  setActiveTab,
  onLoadSampleData,
  globalFilter,
  currentUser,
}) => {
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const isTeacher = currentUser?.role === 'teacher';

  if (students.length === 0) {
    return (
      <div className="p-4 sm:p-8 max-w-5xl mx-auto text-center">
        <div className="bg-white rounded-2xl p-6 sm:p-12 border border-slate-200 shadow-xs">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <FileSpreadsheet className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Chưa có dữ liệu điểm học sinh</h2>
          <p className="text-slate-500 max-w-md mx-auto mb-6 text-xs sm:text-sm">
            {isTeacher
              ? 'Hiện tại chưa có dữ liệu điểm của đợt kiểm tra này. Vui lòng liên hệ Quản trị viên (Admin) để cập nhật bảng điểm vào hệ thống.'
              : 'Bạn có thể tải lên file Excel (.xlsx) danh sách điểm học sinh hoặc nạp dữ liệu mẫu để trải nghiệm đầy đủ các tính năng thống kê và phân tích điểm số.'}
          </p>
          {!isTeacher && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => setActiveTab('upload')}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition inline-flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Tải file Excel lên</span>
              </button>
              <button
                onClick={onLoadSampleData}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 transition inline-flex items-center justify-center gap-2"
              >
                <span>Nạp 45 học sinh mẫu</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Phân tích dữ liệu theo môn học
  const subjectsMap: Record<string, { scores: number[]; count: number }> = {};
  students.forEach((s) => {
    if (!subjectsMap[s.monHoc]) {
      subjectsMap[s.monHoc] = { scores: [], count: 0 };
    }
    subjectsMap[s.monHoc].count++;
    if (s.diem !== null) {
      subjectsMap[s.monHoc].scores.push(s.diem);
    }
  });

  const subjectNames = Object.keys(subjectsMap);
  const subjectAverages = subjectNames.map((subj) => {
    const scores = subjectsMap[subj].scores;
    if (scores.length === 0) return 0;
    return Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));
  });

  // Top 5 học sinh điểm cao nhất
  const topStudents = [...students]
    .filter((s) => s.diem !== null)
    .sort((a, b) => (b.diem || 0) - (a.diem || 0))
    .slice(0, 5);

  // Học sinh cần hỗ trợ (Chưa đạt)
  const atRiskStudents = students.filter((s) => s.xepLoai === 'Chưa đạt').slice(0, 5);

  // Dữ liệu biểu đồ tròn tỷ lệ xếp loại
  const classificationDoughnutData = {
    labels: ['Tốt (≥8.0)', 'Khá (6.5-7.9)', 'Đạt (5.0-6.4)', 'Chưa đạt (<5.0)', 'Vắng/Thiếu'],
    datasets: [
      {
        data: [
          stats.totCount,
          stats.khaCount,
          stats.datCount,
          stats.chuaDatCount,
          stats.absentCount,
        ],
        backgroundColor: [
          '#10b981', // emerald-500
          '#3b82f6', // blue-500
          '#f59e0b', // amber-500
          '#f43f5e', // rose-500
          '#94a3b8', // slate-400
        ],
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  };

  // Dữ liệu biểu đồ cột điểm TB theo môn
  const subjectBarData = {
    labels: subjectNames,
    datasets: [
      {
        label: 'Điểm trung bình môn',
        data: subjectAverages,
        backgroundColor: '#4f46e5', // indigo-600
        borderRadius: 6,
      },
    ],
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Banner chào mừng & tóm tắt nhanh */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-4 sm:p-6 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Báo cáo tổng hợp
            </span>
            <span className="text-[11px] sm:text-xs text-slate-300">
              Cập nhật từ dữ liệu bảng điểm
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {config.examName} • {config.schoolName}
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Tổng số <strong>{stats.total}</strong> lượt bài thi của học sinh trên{' '}
            <strong>{subjectNames.length}</strong> bộ môn. Tỷ lệ học sinh đạt chuẩn từ mức Đạt trở lên là{' '}
            <strong className="text-emerald-400">
              {(100 - stats.chuaDatPercent - (stats.absentCount / stats.total) * 100).toFixed(1)}%
            </strong>.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 w-full sm:w-auto">
          {!isTeacher ? (
            <button
              onClick={() => setActiveTab('statistics')}
              className="flex-1 sm:flex-none px-3.5 py-2 sm:px-4 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-950/40 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <BarChart3 className="w-4 h-4 text-indigo-200" />
              <span>Phân hệ Thống kê chi tiết</span>
            </button>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Quyền Giáo viên: Xem & Tải báo cáo</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid 6 Thẻ KPI tổng quan (Responsive: 2 cols on mobile, 3 on tablet, 6 on desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
        {/* Tổng số bài thi */}
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Tổng HS/Bài</span>
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1">
            Vắng: <span className="font-semibold text-slate-700">{stats.absentCount}</span> HS
          </div>
        </div>

        {/* Điểm trung bình */}
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Điểm TB</span>
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-indigo-600 mt-1">{stats.average}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1">
            Cao: <span className="font-semibold text-slate-700">{stats.max}</span> | Thấp: <span className="font-semibold text-slate-700">{stats.min}</span>
          </div>
        </div>

        {/* Xếp loại Tốt */}
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Tốt (≥ {config.thresholds.totMin})</span>
            <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 mt-1">{stats.totCount}</div>
          <div className="text-[10px] sm:text-[11px] font-semibold text-emerald-700 mt-1">
            Tỷ lệ: {stats.totPercent}%
          </div>
        </div>

        {/* Xếp loại Khá */}
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-blue-700 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Khá ({config.thresholds.khaMin}-{config.thresholds.totMin - 0.1})</span>
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-blue-600 mt-1">{stats.khaCount}</div>
          <div className="text-[10px] sm:text-[11px] font-semibold text-blue-700 mt-1">
            Tỷ lệ: {stats.khaPercent}%
          </div>
        </div>

        {/* Xếp loại Đạt */}
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Đạt ({config.thresholds.datMin}-{config.thresholds.khaMin - 0.1})</span>
            <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-600 mt-1">{stats.datCount}</div>
          <div className="text-[10px] sm:text-[11px] font-semibold text-amber-700 mt-1">
            Tỷ lệ: {stats.datPercent}%
          </div>
        </div>

        {/* Chưa đạt */}
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Chưa đạt (&lt; {config.thresholds.datMin})</span>
            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-rose-600 mt-1">{stats.chuaDatCount}</div>
          <div className="text-[10px] sm:text-[11px] font-semibold text-rose-700 mt-1">
            Tỷ lệ: {stats.chuaDatPercent}%
          </div>
        </div>
      </div>

      {/* PHÂN HỆ TẢI BIỂU MẪU THỐNG KÊ (Dành cho Giáo viên & Quản trị viên) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Xuất Báo Cáo Excel
              </span>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Biểu Mẫu Thống Kê & Báo Cáo Chuẩn Sở GD&ĐT
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Nhấn tải trực tiếp các tệp Excel theo đúng cấu trúc chuẩn của đợt đánh giá hiện tại.
            </p>
          </div>

          <button
            type="button"
            disabled={isDownloadingAll}
            onClick={async () => {
              setIsDownloadingAll(true);
              try {
                await exportAll5Reports(students, config, globalFilter);
              } finally {
                setIsDownloadingAll(false);
              }
            }}
            className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isDownloadingAll ? 'Đang xuất toàn bộ...' : 'Tải trọn bộ 6 file Excel'}</span>
          </button>
        </div>

        {/* 6 Thẻ biểu mẫu tải nhanh */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* Form 1: Theo môn */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 font-bold text-xs">
                <BookOpen className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-slate-900 text-xs mb-1">1. Thống kê theo Môn</h4>
              <p className="text-[11px] text-slate-500 line-clamp-2 mb-3">
                Phân tích Khối, đa sheet từng môn học, tỷ lệ Tốt/Khá/Đạt/Chưa đạt.
              </p>
            </div>
            <button
              type="button"
              onClick={() => exportQualityBySubject(students, config, globalFilter)}
              className="w-full py-1.5 px-2.5 bg-white hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-200 transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải Excel</span>
            </button>
          </div>

          {/* Form 2: Theo lớp */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-2 font-bold text-xs">
                <School className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-slate-900 text-xs mb-1">2. Thống kê theo Lớp</h4>
              <p className="text-[11px] text-slate-500 line-clamp-2 mb-3">
                Bảng tổng hợp chất lượng đa sheet theo từng lớp học, xếp hạng chi tiết.
              </p>
            </div>
            <button
              type="button"
              onClick={() => exportQualityByClass(students, config, globalFilter)}
              className="w-full py-1.5 px-2.5 bg-white hover:bg-blue-50 text-blue-700 hover:text-blue-800 text-xs font-semibold rounded-lg border border-blue-200 transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải Excel</span>
            </button>
          </div>

          {/* Form 3: Theo giáo viên */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2 font-bold text-xs">
                <UserCheck className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-slate-900 text-xs mb-1">3. Thống kê Giáo viên</h4>
              <p className="text-[11px] text-slate-500 line-clamp-2 mb-3">
                Tổng hợp số liệu khối lượng và chất lượng bài dạy theo giáo viên bộ môn.
              </p>
            </div>
            <button
              type="button"
              onClick={() => exportQualityByTeacher(students, config, globalFilter)}
              className="w-full py-1.5 px-2.5 bg-white hover:bg-indigo-50 text-indigo-700 hover:text-indigo-800 text-xs font-semibold rounded-lg border border-indigo-200 transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải Excel</span>
            </button>
          </div>

          {/* Form 4: Ma trận cần quan tâm */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-2 font-bold text-xs">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-slate-900 text-xs mb-1">4. Ma trận HS Cần quan tâm</h4>
              <p className="text-[11px] text-slate-500 line-clamp-2 mb-3">
                Ma trận tổng hợp 2 chiều Lớp × Môn cảnh báo số lượng học sinh dưới chuẩn.
              </p>
            </div>
            <button
              type="button"
              onClick={() => exportQuantityNeedAttention(students, config, globalFilter)}
              className="w-full py-1.5 px-2.5 bg-white hover:bg-amber-50 text-amber-700 hover:text-amber-800 text-xs font-semibold rounded-lg border border-amber-200 transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải Excel</span>
            </button>
          </div>

          {/* Form 5: Danh sách HS cần quan tâm */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center mb-2 font-bold text-xs">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-slate-900 text-xs mb-1">5. Danh sách HS Cần quan tâm</h4>
              <p className="text-[11px] text-slate-500 line-clamp-2 mb-3">
                Danh sách chi tiết học sinh chưa đạt (&lt; 5.0đ) theo từng môn ở các lớp.
              </p>
            </div>
            <button
              type="button"
              onClick={() => exportListNeedAttention(students, config, globalFilter)}
              className="w-full py-1.5 px-2.5 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 text-xs font-semibold rounded-lg border border-rose-200 transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải Excel</span>
            </button>
          </div>

          {/* Form 6: Danh sách HS quan tâm đặc biệt */}
          <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/40 hover:bg-red-50 transition flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center mb-2 font-bold text-xs">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-slate-900 text-xs mb-1">6. Quan tâm đặc biệt</h4>
              <p className="text-[11px] text-slate-500 line-clamp-2 mb-3">
                Danh sách học sinh có điểm ≤ 3.5 theo từng môn ở các lớp cần can thiệp khẩn cấp.
              </p>
            </div>
            <button
              type="button"
              onClick={() => exportSpecialAttention(students, config, globalFilter)}
              className="w-full py-1.5 px-2.5 bg-white hover:bg-red-50 text-red-700 hover:text-red-800 text-xs font-semibold rounded-lg border border-red-200 transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid Đồ thị Trực quan */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Biểu đồ tròn Xếp loại */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm mb-1 flex items-center justify-between">
              <span>Cơ cấu xếp loại học lực</span>
              <span className="text-xs font-normal text-slate-400">{stats.total} bài thi</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Phân bố theo 4 bậc tiêu chuẩn khảo thí
            </p>
            <div className="h-48 sm:h-56 relative flex items-center justify-center">
              <Doughnut
                data={classificationDoughnutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: {
                        boxWidth: 10,
                        padding: 8,
                        font: { size: 10 },
                      },
                    },
                  },
                  cutout: '68%',
                }}
              />
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-xs text-slate-600">
            <div className="p-2 rounded-lg bg-emerald-50/50">
              <div className="text-[10px] sm:text-[11px] text-slate-500">Khá & Tốt</div>
              <div className="font-bold text-emerald-700 text-xs sm:text-sm">
                {(stats.totPercent + stats.khaPercent).toFixed(1)}%
              </div>
            </div>
            <div className="p-2 rounded-lg bg-rose-50/50">
              <div className="text-[10px] sm:text-[11px] text-slate-500">Chưa đạt</div>
              <div className="font-bold text-rose-700 text-xs sm:text-sm">{stats.chuaDatPercent}%</div>
            </div>
          </div>
        </div>

        {/* Biểu đồ cột Điểm TB theo môn */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Điểm trung bình theo từng Môn học
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                So sánh chất lượng học tập giữa các môn khảo sát
              </p>
            </div>
            <button
              onClick={() => setActiveTab('statistics')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
            >
              <span>Xem chi tiết</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-56 sm:h-64">
            <Bar
              data={subjectBarData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    min: 0,
                    max: 10,
                    ticks: { stepSize: 2 },
                  },
                },
                plugins: {
                  legend: { display: false },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Grid 2 Bảng: Vinh danh & Cần phụ đạo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Bảng Top 5 Học sinh điểm cao */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Top 5 học sinh xuất sắc nhất</h3>
                <p className="text-[11px] sm:text-xs text-slate-500">Điểm số cao nhất kỳ thi</p>
              </div>
            </div>
            <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-md font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Vinh danh
            </span>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-xs text-left min-w-[320px]">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100 font-medium">
                  <th className="py-2 px-2">Hạng</th>
                  <th className="py-2 px-2">Số BD</th>
                  <th className="py-2 px-2">Họ và tên</th>
                  <th className="py-2 px-2">Lớp</th>
                  <th className="py-2 px-2">Môn</th>
                  <th className="py-2 px-2 text-right">Điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topStudents.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2 px-2">
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                        idx === 0 ? 'bg-amber-400 text-white' :
                        idx === 1 ? 'bg-slate-300 text-slate-800' :
                        idx === 2 ? 'bg-amber-700 text-white' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-2 px-2 font-mono text-slate-600">{s.soBD}</td>
                    <td className="py-2 px-2 font-semibold text-slate-900 truncate max-w-[120px] sm:max-w-none">{s.hoTen}</td>
                    <td className="py-2 px-2 text-slate-600">{s.lop}</td>
                    <td className="py-2 px-2 text-slate-600">{s.monHoc}</td>
                    <td className="py-2 px-2 text-right font-bold text-emerald-600 text-xs sm:text-sm">
                      {s.diem}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bảng Học sinh cần hỗ trợ / Chưa đạt */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Danh sách học sinh cần phụ đạo</h3>
                <p className="text-[11px] sm:text-xs text-slate-500">Mức điểm &lt; 5.0 cần giáo viên can thiệp</p>
              </div>
            </div>
            <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-md font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              {stats.chuaDatCount} học sinh
            </span>
          </div>

          {atRiskStudents.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              <UserCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              Tất cả học sinh đều đạt điểm chuẩn từ 5.0 trở lên!
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-xs text-left min-w-[340px]">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100 font-medium">
                    <th className="py-2 px-2">Số BD</th>
                    <th className="py-2 px-2">Họ và tên</th>
                    <th className="py-2 px-2">Lớp</th>
                    <th className="py-2 px-2">Môn</th>
                    <th className="py-2 px-2">Giáo viên</th>
                    <th className="py-2 px-2 text-right">Điểm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {atRiskStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-rose-50/40 transition">
                      <td className="py-2 px-2 font-mono text-slate-600">{s.soBD}</td>
                      <td className="py-2 px-2 font-semibold text-slate-900 truncate max-w-[120px] sm:max-w-none">{s.hoTen}</td>
                      <td className="py-2 px-2 text-slate-600">{s.lop}</td>
                      <td className="py-2 px-2 text-slate-600">{s.monHoc}</td>
                      <td className="py-2 px-2 text-slate-600 truncate max-w-[100px] sm:max-w-none">{s.giaoVien}</td>
                      <td className="py-2 px-2 text-right font-bold text-rose-600 text-xs sm:text-sm">
                        {s.diem}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
