import React from 'react';
import {
  Download,
  Database,
  Building2,
  Layers,
  CheckCircle2,
  Menu,
  Cloud,
  CloudOff,
  LogOut,
  User,
  Shield,
} from 'lucide-react';
import { ActiveTab, StatModuleType, SystemConfig, AuthUser } from '../types';
import { downloadExcelTemplate } from '../utils/excelParser';

interface HeaderProps {
  activeTab: ActiveTab;
  activeStatModule?: StatModuleType;
  config: SystemConfig;
  totalStudents: number;
  isFirebaseConnected?: boolean;
  onLoadSampleData: () => void;
  onOpenSettings?: () => void;
  onToggleMobileMenu?: () => void;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

const STAT_MODULE_TITLES: Record<StatModuleType, { title: string; subtitle: string }> = {
  theo_mon: {
    title: 'Theo Môn',
    subtitle: 'Đánh giá chất lượng từng môn đối với các lớp',
  },
  theo_lop: {
    title: 'Theo Lớp',
    subtitle: 'Đánh giá chất lượng từng lớp đối với các môn',
  },
  theo_giao_vien: {
    title: 'Theo Giáo viên',
    subtitle: 'Đánh giá hiệu quả giảng dạy theo từng giáo viên',
  },
  so_luong_can_quan_tam: {
    title: 'Số lượng HS cần quan tâm',
    subtitle: 'Ma trận & tổng hợp học sinh chưa đạt',
  },
  danh_sach_can_quan_tam: {
    title: 'Danh sách HS cần quan tâm',
    subtitle: 'Danh sách chi tiết học sinh cần bồi dưỡng',
  },
  quan_tam_dac_biet: {
    title: 'Quan tâm đặc biệt',
    subtitle: 'Danh sách học sinh có điểm ≤ 3.5 cần can thiệp khẩn cấp',
  },
  so_sanh_tien_bo: {
    title: 'So sánh chất lượng',
    subtitle: 'Đối sánh Giữa kỳ vs Cuối kỳ & tiến độ các đợt kiểm tra',
  },
};

const TAB_TITLES: Record<ActiveTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Tổng quan kết quả học tập',
    subtitle: 'Chỉ số KPI, tỷ lệ xếp loại và đồ thị phân tích toàn trường',
  },
  upload: {
    title: 'Nhập & Quản lý dữ liệu Excel',
    subtitle: 'Tải lên bảng điểm từ file .xlsx, tự động làm sạch và xếp loại học sinh',
  },
  statistics: {
    title: 'Thống kê chất lượng',
    subtitle: 'Lọc và tổng hợp số liệu theo Lớp, Môn học, Khối và Giáo viên',
  },
  settings: {
    title: 'Cấu hình hệ thống & Thang điểm',
    subtitle: 'Thiết lập ngưỡng điểm Tốt/Khá/Đạt và thông tin trường học',
  },
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  activeStatModule = 'theo_mon',
  config,
  totalStudents,
  isFirebaseConnected = true,
  onLoadSampleData,
  onOpenSettings,
  onToggleMobileMenu,
  currentUser,
  onLogout,
}) => {
  const currentTabInfo =
    activeTab === 'statistics' && activeStatModule && STAT_MODULE_TITLES[activeStatModule]
      ? STAT_MODULE_TITLES[activeStatModule]
      : TAB_TITLES[activeTab] || TAB_TITLES.dashboard;
  const isTeacher = currentUser?.role === 'teacher';

  return (
    <header className="h-14 sm:h-16 bg-white border-b border-slate-200 px-3 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20 shrink-0 gap-2">
      {/* Mobile Hamburger & Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onToggleMobileMenu}
          className="p-2 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden shrink-0"
          aria-label="Mở menu điều hướng"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight truncate flex items-center gap-2">
            {currentTabInfo.title}
          </h1>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-medium text-slate-400 truncate">
            <span className="flex items-center gap-1 truncate">
              <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{config.schoolName}</span>
            </span>
            <span className="hidden xs:inline">•</span>
            <span className="hidden xs:flex items-center gap-1 text-indigo-600 font-semibold truncate">
              <Layers className="w-3 h-3 shrink-0" />
              <span className="truncate">{config.examName}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons & Status Badges */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Firebase Status Indicator (Only admin can click to configure) */}
        <button
          type="button"
          onClick={!isTeacher ? onOpenSettings : undefined}
          className={`px-2 sm:px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-2xs border transition ${
            !isTeacher ? 'cursor-pointer' : 'cursor-default'
          } ${
            isFirebaseConnected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 animate-pulse'
          }`}
          title={
            isFirebaseConnected
              ? isTeacher
                ? 'Đã kết nối Firebase Firestore'
                : 'Đã kết nối Firebase Firestore (Nhấn để cấu hình)'
              : isTeacher
              ? 'Chưa kết nối Firebase'
              : 'Chưa kết nối Firebase - Nhấn để mở Cấu hình'
          }
        >
          {isFirebaseConnected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <Cloud className="w-3.5 h-3.5 text-emerald-600 hidden sm:inline" />
              <span className="hidden sm:inline">Firebase Đã kết nối</span>
              <span className="sm:hidden">Firebase OK</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <CloudOff className="w-3.5 h-3.5 text-amber-600 hidden sm:inline" />
              <span className="hidden sm:inline">Chưa kết nối Firebase</span>
              <span className="sm:hidden">Chưa kết nối</span>
            </>
          )}
        </button>

        {/* Download Template Button (For all or admin) */}
        <button
          onClick={downloadExcelTemplate}
          className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition"
          title="Tải file mẫu Excel để điền điểm"
        >
          <Download className="w-3.5 h-3.5 text-slate-600" />
          <span>File mẫu</span>
        </button>

        {/* Sample Data button only available for Admin */}
        {!isTeacher && totalStudents === 0 ? (
          <button
            onClick={onLoadSampleData}
            className="inline-flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-100 transition whitespace-nowrap"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nạp 45 HS mẫu</span>
            <span className="sm:hidden">Dữ liệu mẫu</span>
          </button>
        ) : totalStudents > 0 ? (
          <div className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 rounded-lg border border-slate-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Đã tải: <strong>{totalStudents}</strong> HS</span>
          </div>
        ) : null}

        {/* User Account Pill & Role Badge */}
        {currentUser && (
          <div className="flex items-center gap-1.5 pl-1.5 sm:pl-2 border-l border-slate-200">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                isTeacher
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}
              title={`Đang đăng nhập: ${currentUser.name} (${currentUser.title})`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] text-white ${
                  isTeacher ? 'bg-emerald-600' : 'bg-indigo-600'
                }`}
              >
                {isTeacher ? 'GV' : 'AD'}
              </span>
              <span className="hidden md:inline font-bold">
                {isTeacher ? 'Giáo viên' : 'Admin'}
              </span>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                title="Đăng xuất khỏi hệ thống"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
