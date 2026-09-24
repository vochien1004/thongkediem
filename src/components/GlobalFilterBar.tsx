import React, { useState } from 'react';
import {
  Calendar,
  Layers,
  BookOpen,
  Plus,
  Check,
  Filter,
  Sparkles,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { GlobalFilterState, SemesterType, PeriodType, AuthUser } from '../types';

interface GlobalFilterBarProps {
  filter: GlobalFilterState;
  onFilterChange: (newFilter: GlobalFilterState) => void;
  availableYears: string[];
  onAddNewYear?: (newYear: string) => void;
  matchingCount: number;
  totalCount: number;
  onOpenAiModal?: () => void;
  currentUser?: AuthUser | null;
}

export const GlobalFilterBar: React.FC<GlobalFilterBarProps> = ({
  filter,
  onFilterChange,
  availableYears,
  onAddNewYear,
  matchingCount,
  totalCount,
  onOpenAiModal,
  currentUser,
}) => {
  const [isAddingYear, setIsAddingYear] = useState(false);
  const [newYearInput, setNewYearInput] = useState('');
  const isTeacher = currentUser?.role === 'teacher';

  const handleCreateYear = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newYearInput.trim();
    if (!clean) return;
    if (onAddNewYear) {
      onAddNewYear(clean);
    }
    onFilterChange({ ...filter, academicYear: clean });
    setNewYearInput('');
    setIsAddingYear(false);
  };

  // Quick preset shortcuts for the assessment periods
  const handleQuickPreset = (sem: SemesterType, per: PeriodType) => {
    onFilterChange({
      ...filter,
      semester: sem,
      period: per,
    });
  };

  const isPresetActive = (sem: string, per: string) => {
    if (sem === 'KS' && per === 'KS') {
      return filter.period === 'KS' || filter.semester === 'KS';
    }
    if (sem === 'HK2' && (per === 'GKII' || per === 'GKI')) {
      return (
        filter.semester === 'HK2' &&
        (filter.period === 'GKII' || filter.period === 'GKI' || filter.period === 'GKI-HK2')
      );
    }
    if (sem === 'HK2' && (per === 'CKII' || per === 'CKI')) {
      return (
        filter.semester === 'HK2' &&
        (filter.period === 'CKII' || filter.period === 'CKI' || filter.period === 'CKI-HK2')
      );
    }
    if (sem === 'HK1' && per === 'GKI') {
      return filter.semester === 'HK1' && (filter.period === 'GKI' || filter.period === 'GKI-HK1');
    }
    if (sem === 'HK1' && per === 'CKI') {
      return filter.semester === 'HK1' && (filter.period === 'CKI' || filter.period === 'CKI-HK1');
    }
    return filter.semester === sem && filter.period === per;
  };

  // Human-readable active label
  const getActiveLabel = () => {
    const yearLabel = filter.academicYear === 'ALL' ? 'Tất cả năm' : `Năm ${filter.academicYear}`;
    let timeLabel = '';
    if (filter.period === 'KS' || filter.semester === 'KS') {
      timeLabel = 'KS đầu năm (Khảo sát đầu năm)';
    } else if (filter.semester === 'ALL') {
      if (filter.period === 'ALL') timeLabel = 'Cả năm học';
      else if (filter.period === 'GKII') timeLabel = 'Giữa HK2 (GKII)';
      else if (filter.period === 'CKII') timeLabel = 'Cuối HK2 (CKII)';
      else if (filter.period === 'GKI') timeLabel = 'Giữa HK1 (GKI)';
      else if (filter.period === 'CKI') timeLabel = 'Cuối HK1 (CKI)';
      else timeLabel = `Cả năm - ${filter.period}`;
    } else if (filter.semester === 'HK2') {
      const semLabel = 'Học kỳ 2';
      if (filter.period === 'ALL') {
        timeLabel = `Cả ${semLabel}`;
      } else {
        const perLabel = filter.period === 'CKII' || filter.period === 'CKI' ? 'Cuối kỳ II (CKII)' : 'Giữa kỳ II (GKII)';
        timeLabel = `${perLabel} - ${semLabel}`;
      }
    } else {
      const semLabel = 'Học kỳ 1';
      if (filter.period === 'ALL') {
        timeLabel = `Cả ${semLabel}`;
      } else {
        const perLabel = filter.period === 'CKI' ? 'Cuối kỳ I (CKI)' : 'Giữa kỳ I (GKI)';
        timeLabel = `${perLabel} - ${semLabel}`;
      }
    }
    return `${timeLabel} • ${yearLabel}`;
  };

  return (
    <div className="bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 shadow-2xs">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 max-w-7xl mx-auto">
        {/* Dropdowns Group */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
          {/* Label icon */}
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider shrink-0 pr-1">
            <Filter className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Bộ lọc toàn cục:</span>
            <span className="sm:hidden">Lọc:</span>
          </div>

          {/* 1. Dropdown Năm học */}
          <div className="relative flex items-center">
            <Calendar className="w-3.5 h-3.5 text-indigo-600 absolute left-2.5 pointer-events-none" />
            <select
              value={filter.academicYear}
              onChange={(e) => {
                if (e.target.value === '__NEW__') {
                  setIsAddingYear(true);
                } else {
                  onFilterChange({ ...filter, academicYear: e.target.value });
                }
              }}
              className="pl-8 pr-7 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-800 hover:bg-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition cursor-pointer appearance-none"
              title="Chọn Năm học để lọc dữ liệu"
            >
              <option value="ALL">Tất cả các năm học</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  Năm học {yr}
                </option>
              ))}
              {!isTeacher && <option value="__NEW__">+ Thêm năm học mới...</option>}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 pointer-events-none" />
          </div>

          {/* 2. Dropdown Học kỳ */}
          <div className="relative flex items-center">
            <BookOpen className="w-3.5 h-3.5 text-blue-600 absolute left-2.5 pointer-events-none" />
            <select
              value={filter.semester}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'KS') {
                  onFilterChange({
                    ...filter,
                    semester: 'KS',
                    period: 'KS',
                  });
                } else if (val === 'HK2') {
                  let nextPer = filter.period;
                  if (filter.period === 'GKI') nextPer = 'GKII';
                  else if (filter.period === 'CKI') nextPer = 'CKII';
                  else if (filter.period === 'KS') nextPer = 'ALL';
                  onFilterChange({
                    ...filter,
                    semester: 'HK2',
                    period: nextPer,
                  });
                } else if (val === 'HK1') {
                  let nextPer = filter.period;
                  if (filter.period === 'GKII') nextPer = 'GKI';
                  else if (filter.period === 'CKII') nextPer = 'CKI';
                  else if (filter.period === 'KS') nextPer = 'ALL';
                  onFilterChange({
                    ...filter,
                    semester: 'HK1',
                    period: nextPer,
                  });
                } else {
                  onFilterChange({
                    ...filter,
                    semester: val,
                  });
                }
              }}
              className="pl-8 pr-7 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-800 hover:bg-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition cursor-pointer appearance-none"
              title="Chọn Học kỳ (Khảo sát đầu năm, Học kỳ 1, Học kỳ 2 hoặc Cả năm)"
            >
              <option value="ALL">Cả năm học</option>
              <option value="KS">KS đầu năm (Khảo sát đầu năm)</option>
              <option value="HK1">Học kỳ 1 (HK1)</option>
              <option value="HK2">Học kỳ 2 (HK2)</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 pointer-events-none" />
          </div>

          {/* 3. Dropdown Đợt lấy điểm */}
          <div className="relative flex items-center">
            <Layers className="w-3.5 h-3.5 text-emerald-600 absolute left-2.5 pointer-events-none" />
            <select
              value={filter.period}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'KS') {
                  onFilterChange({
                    ...filter,
                    semester: 'KS',
                    period: 'KS',
                  });
                } else if (val === 'GKII' || val === 'CKII') {
                  onFilterChange({
                    ...filter,
                    semester: 'HK2',
                    period: val,
                  });
                } else if (val === 'GKI' || val === 'CKI') {
                  const nextSem = filter.semester === 'HK2' ? 'HK1' : filter.semester;
                  onFilterChange({
                    ...filter,
                    semester: nextSem,
                    period: val,
                  });
                } else {
                  onFilterChange({
                    ...filter,
                    period: val,
                  });
                }
              }}
              className="pl-8 pr-7 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-800 hover:bg-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition cursor-pointer appearance-none"
              title="Chọn Đợt lấy điểm (KS đầu năm, GKI, CKI, GKII, CKII hoặc Tất cả các đợt)"
            >
              <option value="ALL">Tất cả các đợt</option>
              <option value="KS">KS đầu năm (Khảo sát đầu năm)</option>
              <option value="GKI">Giữa học kỳ I (GKI)</option>
              <option value="CKI">Cuối học kỳ I (CKI)</option>
              <option value="GKII">Giữa học kỳ II (GKII)</option>
              <option value="CKII">Cuối học kỳ II (CKII)</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 pointer-events-none" />
          </div>

          {/* Nút reset nhanh về Cả năm */}
          {(filter.semester !== 'ALL' || filter.period !== 'ALL') && (
            <button
              onClick={() => onFilterChange({ ...filter, semester: 'ALL', period: 'ALL' })}
              className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition inline-flex items-center gap-1 border border-dashed border-slate-300"
              title="Xem toàn bộ đợt và học kỳ"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Xem cả năm</span>
            </button>
          )}
        </div>

        {/* 5 Nút Chọn Nhanh Đợt Điểm Chuẩn (KS đầu năm đứng trước HK1) & AI Button */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full lg:w-auto justify-between lg:justify-end">
          {/* 5 Quick Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-semibold">
            <button
              onClick={() => handleQuickPreset('KS', 'KS')}
              className={`px-2 py-1 rounded-md transition font-semibold ${
                isPresetActive('KS', 'KS')
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Đợt khảo sát: KS đầu năm (Khảo sát đầu năm, đứng trước HK1)"
            >
              KS đầu năm
            </button>
            <button
              onClick={() => handleQuickPreset('HK1', 'GKI')}
              className={`px-2 py-1 rounded-md transition ${
                isPresetActive('HK1', 'GKI')
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Đợt 1: Giữa Học kỳ 1 (GKI)"
            >
              GKI-HK1
            </button>
            <button
              onClick={() => handleQuickPreset('HK1', 'CKI')}
              className={`px-2 py-1 rounded-md transition ${
                isPresetActive('HK1', 'CKI')
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Đợt 2: Cuối Học kỳ 1 (CKI)"
            >
              CKI-HK1
            </button>
            <button
              onClick={() => handleQuickPreset('HK2', 'GKII')}
              className={`px-2.5 py-1 rounded-md transition font-semibold ${
                isPresetActive('HK2', 'GKII')
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Đợt 3: Giữa Học kỳ 2 (GKII)"
            >
              GKII
            </button>
            <button
              onClick={() => handleQuickPreset('HK2', 'CKII')}
              className={`px-2.5 py-1 rounded-md transition font-semibold ${
                isPresetActive('HK2', 'CKII')
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Đợt 4: Cuối Học kỳ 2 (CKII)"
            >
              CKII
            </button>
          </div>

          {/* Matching records pill */}
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
            <span className="font-semibold">{matchingCount}</span>
            <span className="text-slate-400">/</span>
            <span className="text-slate-500">{totalCount} HS</span>
          </div>

          {/* AI Analysis Trigger Button */}
          {onOpenAiModal && (
            <button
              onClick={onOpenAiModal}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-lg shadow-xs shadow-indigo-200 transition cursor-pointer"
              title="Tạo nhận xét sư phạm từ Gemini AI theo ngữ cảnh hiện tại"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Nhận xét AI</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal / Inline Input Thêm Năm Học Mới */}
      {isAddingYear && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-sm w-full shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>Thêm năm học mới</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Nhập định dạng năm học (ví dụ: <strong>2026-2027</strong>, <strong>2027-2028</strong>)
            </p>
            <form onSubmit={handleCreateYear} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tên năm học
                </label>
                <input
                  type="text"
                  placeholder="2026-2027"
                  value={newYearInput}
                  onChange={(e) => setNewYearInput(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-medium"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingYear(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!newYearInput.trim()}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition shadow-xs"
                >
                  Thêm & Chọn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
