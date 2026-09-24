import React from 'react';
import { BookOpen, RefreshCw } from 'lucide-react';
import { StudentScore, SystemConfig, GlobalFilterState, StatModuleType } from '../types';
import { StatQualityBySubject } from './statistics/StatQualityBySubject';
import { StatQualityByClass } from './statistics/StatQualityByClass';
import { StatQualityByTeacher } from './statistics/StatQualityByTeacher';
import { StatQuantityNeedAttention } from './statistics/StatQuantityNeedAttention';
import { StatListNeedAttentionBySubject } from './statistics/StatListNeedAttentionBySubject';
import { StatSpecialAttention } from './statistics/StatSpecialAttention';
import { StatPeriodComparison } from './statistics/StatPeriodComparison';

export interface StatisticsViewProps {
  students: StudentScore[];
  allStudents?: StudentScore[];
  globalFilter?: GlobalFilterState;
  config: SystemConfig;
  onRefreshFromFirestore?: () => Promise<void> | void;
  isRefreshing?: boolean;
  onOpenAiModal?: () => void;
  activeModule?: StatModuleType;
  onModuleChange?: (module: StatModuleType) => void;
}

const DEFAULT_GLOBAL_FILTER: GlobalFilterState = {
  academicYear: 'ALL',
  semester: 'ALL',
  period: 'ALL',
};

export const StatisticsView: React.FC<StatisticsViewProps> = ({
  students,
  allStudents = students,
  globalFilter = DEFAULT_GLOBAL_FILTER,
  config,
  onRefreshFromFirestore,
  isRefreshing = false,
  onOpenAiModal,
  activeModule = 'theo_mon',
}) => {
  if (students.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 max-w-xl mx-auto my-8 shadow-xs">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Chưa có dữ liệu điểm để thống kê</h3>
        <p className="text-sm text-slate-500 mb-6">
          Vui lòng tải file Excel bảng điểm tại tab <strong>"Nhập dữ liệu"</strong> hoặc đồng bộ từ
          Firestore để sử dụng hệ thống thống kê chuyên sâu.
        </p>
        {onRefreshFromFirestore && (
          <button
            onClick={() => onRefreshFromFirestore()}
            disabled={isRefreshing}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2 cursor-pointer shadow-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Đồng bộ từ Cloud Firestore</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Hiển thị duy nhất phân hệ module tương ứng được chọn từ menu con */}
      <div className="transition-all duration-200">
        {activeModule === 'theo_mon' && (
          <StatQualityBySubject students={students} config={config} globalFilter={globalFilter} />
        )}

        {activeModule === 'theo_lop' && (
          <StatQualityByClass students={students} config={config} globalFilter={globalFilter} />
        )}

        {activeModule === 'theo_giao_vien' && (
          <StatQualityByTeacher students={students} config={config} globalFilter={globalFilter} />
        )}

        {activeModule === 'so_luong_can_quan_tam' && (
          <StatQuantityNeedAttention
            students={students}
            config={config}
            globalFilter={globalFilter}
          />
        )}

        {activeModule === 'danh_sach_can_quan_tam' && (
          <StatListNeedAttentionBySubject
            students={students}
            config={config}
            globalFilter={globalFilter}
          />
        )}

        {activeModule === 'quan_tam_dac_biet' && (
          <StatSpecialAttention
            students={students}
            config={config}
            globalFilter={globalFilter}
          />
        )}

        {activeModule === 'so_sanh_tien_bo' && (
          <StatPeriodComparison
            allStudents={allStudents}
            globalFilter={globalFilter}
            config={config}
            onOpenAiModal={onOpenAiModal}
          />
        )}
      </div>
    </div>
  );
};
