import React, { useState } from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  BarChart3,
  Settings,
  GraduationCap,
  Download,
  Database,
  Layers,
  X,
  LogOut,
  User,
  Shield,
  ChevronDown,
  ChevronRight,
  BookOpen,
  School,
  UserCheck,
  AlertTriangle,
  AlertOctagon,
  TrendingUp,
} from 'lucide-react';
import { ActiveTab, StatModuleType, SystemConfig, AuthUser } from '../types';
import { downloadExcelTemplate } from '../utils/excelParser';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  activeStatModule?: StatModuleType;
  setActiveStatModule?: (module: StatModuleType) => void;
  totalStudents: number;
  config: SystemConfig;
  onLoadSampleData: () => void;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

// 7 Menu con dưới menu chính Thống kê chất lượng
const STAT_SUB_MENUS: {
  id: StatModuleType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'theo_mon',
    label: 'Theo Môn',
    icon: BookOpen,
  },
  {
    id: 'theo_lop',
    label: 'Theo Lớp',
    icon: School,
  },
  {
    id: 'theo_giao_vien',
    label: 'Theo Giáo viên',
    icon: UserCheck,
  },
  {
    id: 'so_luong_can_quan_tam',
    label: 'Số lượng HS cần quan tâm',
    icon: AlertTriangle,
  },
  {
    id: 'danh_sach_can_quan_tam',
    label: 'Danh sách HS cần quan tâm',
    icon: FileSpreadsheet,
  },
  {
    id: 'quan_tam_dac_biet',
    label: 'Quan tâm đặc biệt',
    icon: AlertOctagon,
  },
  {
    id: 'so_sanh_tien_bo',
    label: 'So sánh chất lượng',
    icon: TrendingUp,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  activeStatModule = 'theo_mon',
  setActiveStatModule,
  totalStudents,
  config,
  onLoadSampleData,
  isMobileOpen = false,
  setIsMobileOpen,
  currentUser,
  onLogout,
}) => {
  const isTeacher = currentUser?.role === 'teacher';
  // Mặc định luôn mở 7 menu con của Thống kê để người dùng dễ dàng truy cập
  const [isStatsExpanded, setIsStatsExpanded] = useState<boolean>(true);

  const allNavItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Tổng quan',
      sublabel: 'Dashboard chỉ số & biểu đồ',
      icon: LayoutDashboard,
      badge: totalStudents > 0 ? `${totalStudents} HS` : undefined,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
      allowedRoles: ['admin'],
    },
    {
      id: 'upload' as ActiveTab,
      label: 'Nhập dữ liệu',
      sublabel: 'Upload Excel & Quản lý điểm',
      icon: FileSpreadsheet,
      badge: 'Excel .xlsx',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
      allowedRoles: ['admin'],
    },
    {
      id: 'statistics' as ActiveTab,
      label: 'Thống kê chất lượng',
      sublabel: '7 biểu mẫu phân tích',
      icon: BarChart3,
      badge: undefined,
      badgeColor: '',
      allowedRoles: ['admin', 'teacher'],
    },
    {
      id: 'settings' as ActiveTab,
      label: 'Cấu hình',
      sublabel: 'Thang điểm & Thông tin trường',
      icon: Settings,
      badge: undefined,
      badgeColor: '',
      allowedRoles: ['admin'],
    },
  ];

  // Giáo viên chỉ xem được toàn bộ menu Thống kê chất lượng, không xem được trang tổng quan
  const navItems = isTeacher
    ? allNavItems.filter((item) => item.id === 'statistics')
    : allNavItems;

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (setIsMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  const handleSelectStatSubModule = (moduleId: StatModuleType) => {
    setActiveTab('statistics');
    setActiveStatModule?.(moduleId);
    if (setIsMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen?.(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 lg:w-64 bg-slate-900 text-slate-300 flex flex-col h-screen border-r border-slate-800 shrink-0 select-none transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md shadow-indigo-900/30 shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base text-white tracking-tight uppercase">EduScore AI</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate" title={config.schoolName}>
                {config.schoolName || 'Quản lý điểm thông minh'}
              </p>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={() => setIsMobileOpen?.(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden cursor-pointer"
            aria-label="Đóng menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Pill */}
        <div className="px-3.5 py-2 mx-3 mt-3 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2 truncate">
            <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="truncate">{config.academicYear} • {config.term}</span>
          </div>
          <span className="font-semibold text-indigo-400 shrink-0 ml-1 text-[11px]">
            {totalStudents} bản ghi
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-3 space-y-1 overflow-y-auto px-2">
          <div className="px-3 pb-1.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            Menu chức năng
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isStats = item.id === 'statistics';
            const isItemActive = activeTab === item.id;

            return (
              <div key={item.id} className="space-y-1">
                {/* Nút menu cấp 1 */}
                <button
                  onClick={() => {
                    if (isStats) {
                      handleSelectTab('statistics');
                      setIsStatsExpanded((prev) => !prev);
                    } else {
                      handleSelectTab(item.id);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left group cursor-pointer ${
                    isItemActive
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isItemActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">{item.label}</span>
                      {item.badge && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-semibold tracking-wide ${
                            isItemActive
                              ? 'bg-white/20 text-white'
                              : item.badgeColor
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      {isStats && (
                        <span className="text-slate-400 group-hover:text-white ml-auto">
                          {isStatsExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {/* 6 MENU CON NẰM BÊN DƯỚI MENU CHÍNH THỐNG KÊ */}
                {isStats && isStatsExpanded && (
                  <div className="ml-3 pl-2.5 border-l-2 border-indigo-500/40 space-y-1 my-1">
                    {STAT_SUB_MENUS.map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = activeTab === 'statistics' && activeStatModule === sub.id;

                      return (
                        <button
                          key={sub.id}
                          onClick={() => handleSelectStatSubModule(sub.id)}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left group cursor-pointer ${
                            isSubActive
                              ? 'bg-indigo-500/25 text-white font-bold border-l-2 border-indigo-400 pl-2 shadow-xs'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                          }`}
                          title={sub.label}
                        >
                          <SubIcon
                            className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                              isSubActive
                                ? 'text-indigo-300'
                                : 'text-slate-500 group-hover:text-indigo-400'
                            }`}
                          />
                          <span className="truncate leading-tight">{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Quick Action Footer */}
        <div className="p-4 border-t border-slate-800 space-y-2 bg-slate-900">
          <button
            onClick={() => {
              downloadExcelTemplate();
              if (setIsMobileOpen) setIsMobileOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition cursor-pointer"
            title="Tải về file Excel mẫu chuẩn có cấu trúc cột"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Tải file Excel mẫu</span>
          </button>

          {totalStudents === 0 && !isTeacher && (
            <button
              onClick={() => {
                onLoadSampleData();
                if (setIsMobileOpen) setIsMobileOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/80 rounded-lg border border-indigo-700/50 transition cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>Nạp 45 học sinh mẫu</span>
            </button>
          )}

          {/* User Info & Logout Button */}
          {currentUser && (
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-indigo-900/60 border border-indigo-700/40 flex items-center justify-center text-indigo-300 text-xs font-bold shrink-0">
                  {isTeacher ? <User className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate" title={currentUser.name}>
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {currentUser.title}
                  </div>
                </div>
              </div>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                  title="Đăng xuất khỏi hệ thống"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
