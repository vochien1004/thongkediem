import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  Search,
  Download,
  BookOpen,
  Filter,
  User,
  GraduationCap,
  Calendar,
} from 'lucide-react';
import { StudentScore, SystemConfig, GlobalFilterState } from '../../types';
import { exportListNeedAttentionExcel } from '../../utils/exportListNeedAttentionExcel';

interface StatListNeedAttentionBySubjectProps {
  students: StudentScore[];
  config: SystemConfig;
  globalFilter?: GlobalFilterState;
}

export const StatListNeedAttentionBySubject: React.FC<StatListNeedAttentionBySubjectProps> = ({
  students,
  config,
  globalFilter,
}) => {
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'MODERATE'>('ALL');

  // Danh sách các môn và lớp duy nhất
  const uniqueSubjects = useMemo(() => {
    const subs = students.map((s) => s.monHoc || s.subject).filter((s): s is string => Boolean(s));
    return Array.from(new Set(subs)).sort();
  }, [students]);

  const uniqueClasses = useMemo(() => {
    const clss = students.map((s) => s.lop || s.class).filter((c): c is string => Boolean(c));
    return Array.from(new Set(clss)).sort((a: string, b: string) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [students]);

  // Danh sách học sinh cần quan tâm (Chỉ tính học sinh có điểm thi hợp lệ và < datMin / < 5)
  const filteredList = useMemo(() => {
    return students
      .filter((s) => {
        const score = s.diem ?? s.score;
        // Chỉ lấy những em có tham gia thi và điểm < datMin
        const isValidScore = typeof score === 'number' && !isNaN(score);
        const isNeedAttention = isValidScore && score < config.thresholds.datMin;
        if (!isNeedAttention) return false;

        // Lọc môn
        if (selectedSubject !== 'ALL') {
          const sub = s.monHoc || s.subject;
          if (sub !== selectedSubject) return false;
        }

        // Lọc lớp
        if (selectedClass !== 'ALL') {
          const cls = s.lop || s.class;
          if (cls !== selectedClass) return false;
        }

        // Lọc mức độ
        if (severityFilter === 'CRITICAL') {
          if (score >= 3.5) return false;
        } else if (severityFilter === 'MODERATE') {
          if (score < 3.5 || score >= config.thresholds.datMin) return false;
        }

        // Tìm kiếm
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase().trim();
          const name = (s.hoTen || s.fullName || '').toLowerCase();
          const sbd = (s.soBD || s.studentId || '').toLowerCase();
          const teacher = (s.giaoVien || s.teacherName || '').toLowerCase();
          if (!name.includes(term) && !sbd.includes(term) && !teacher.includes(term)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // Sắp xếp ưu tiên môn -> lớp -> điểm tăng dần (điểm thấp nhất lên trước)
        const subA = a.monHoc || a.subject || '';
        const subB = b.monHoc || b.subject || '';
        if (subA !== subB) return subA.localeCompare(subB);

        const scoreA = a.diem ?? a.score ?? -1;
        const scoreB = b.diem ?? b.score ?? -1;
        return scoreA - scoreB;
      });
  }, [students, config.thresholds.datMin, selectedSubject, selectedClass, severityFilter, searchTerm]);

  // Thống kê nhanh cho danh sách đang hiển thị
  const statsSummary = useMemo(() => {
    const scores = filteredList
      .map((s) => s.diem ?? s.score)
      .filter((s): s is number => s !== null && typeof s === 'number');

    const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : '—';
    const minScore = scores.length > 0 ? Math.min(...scores).toFixed(1) : '—';
    const criticalCnt = filteredList.filter((s) => {
      const sc = s.diem ?? s.score;
      return sc !== null && sc < 3.5;
    }).length;

    return {
      total: filteredList.length,
      average: avg,
      minScore,
      criticalCnt,
    };
  }, [filteredList]);

  // Xuất file Excel đúng định dạng mẫu ảnh: Mỗi sheet 1 môn, hiển thị theo lớp
  const handleExportExcel = () => {
    exportListNeedAttentionExcel(students, config, globalFilter);
  };

  return (
    <div className="space-y-5">
      {/* Bộ lọc & Header */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Danh Sách Học Sinh Cần Quan Tâm
            </h3>
            <p className="text-xs text-slate-500">
              Chi tiết danh tính, số điểm còn thiếu và giáo viên phụ trách để nhà trường tổ chức phụ đạo kịp thời
            </p>
          </div>
        </div>

        <button
          onClick={handleExportExcel}
          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Xuất Danh sách HS cần quan tâm theo môn.xlsx</span>
        </button>
      </div>

      {/* 4 Thẻ tóm tắt */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Tổng HS trong danh sách</span>
            <User className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-600">{statsSummary.total} em</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Cần kế hoạch kèm cặp kiến thức
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Báo động đỏ (&lt;3.5đ)</span>
            <AlertCircle className="w-4 h-4 text-rose-700" />
          </div>
          <div className="text-2xl font-bold text-rose-800">{statsSummary.criticalCnt} em</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Học lực yếu nghiêm trọng
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Điểm TB nhóm cần bồi dưỡng</span>
            <GraduationCap className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{statsSummary.average}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Điểm thấp nhất: <strong>{statsSummary.minScore}</strong>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Mức độ cần hỗ trợ</span>
            <Calendar className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{filteredList.length > 0 ? `${((filteredList.length / (students.filter(s => typeof (s.diem ?? s.score) === 'number').length || 1)) * 100).toFixed(1)}%` : '0%'}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Tỉ lệ trên tổng số lượt dự thi
          </div>
        </div>
      </div>

      {/* Thanh bộ lọc đa chiều */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Chọn Môn học:</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
            >
              <option value="ALL">-- Tất cả các môn --</option>
              {uniqueSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  Môn {sub}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Chọn Lớp:</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
            >
              <option value="ALL">-- Tất cả các lớp --</option>
              {uniqueClasses.map((cls) => (
                <option key={cls} value={cls}>
                  Lớp {cls}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mức độ cảnh báo:</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
            >
              <option value="ALL">Tất cả (&lt; 5.0 điểm)</option>
              <option value="CRITICAL">Báo động đỏ (&lt; 3.5 điểm)</option>
              <option value="MODERATE">Cần phụ đạo (3.5 - 4.9 điểm)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tìm kiếm học sinh:</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tên, mã HS hoặc GV..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Bảng danh sách chi tiết */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">
              Danh Sách Học Sinh Cần Quan Tâm ({filteredList.length} học sinh)
            </h4>
            <p className="text-xs text-slate-500">
              Sắp xếp theo môn học và mức độ điểm số tăng dần
            </p>
          </div>
        </div>

        {filteredList.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium">Không tìm thấy học sinh nào phù hợp với bộ lọc</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="py-3 px-3 text-center w-12">STT</th>
                  <th className="py-3 px-3">Mã HS / SBD</th>
                  <th className="py-3 px-3">Họ và tên</th>
                  <th className="py-3 px-3">Lớp</th>
                  <th className="py-3 px-3">Môn học</th>
                  <th className="py-3 px-3 text-center">Điểm thi</th>
                  <th className="py-3 px-3">Mức độ điểm thiếu</th>
                  <th className="py-3 px-3">Giáo viên phụ trách</th>
                  <th className="py-3 px-3">Kế hoạch / Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((s, idx) => {
                  const score = s.diem ?? s.score;
                  const isAbsent = score === null;
                  const isCritical = score !== null && score < 3.5;
                  const gap = score !== null ? (config.thresholds.datMin - score).toFixed(1) : null;

                  return (
                    <tr key={`${s.id || idx}_${s.monHoc}`} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-3 font-mono text-slate-600 font-medium">
                        {s.soBD || s.studentId || '—'}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {s.hoTen || s.fullName}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700">
                        {s.lop || s.class}
                      </td>
                      <td className="py-3 px-3 font-semibold text-indigo-700">
                        {s.monHoc || s.subject}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isAbsent ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            Vắng
                          </span>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-xs ${
                              isCritical
                                ? 'bg-rose-100 text-rose-800 font-mono'
                                : 'bg-amber-100 text-amber-800 font-mono'
                            }`}
                          >
                            {score.toFixed(1)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {isAbsent ? (
                          <span className="text-slate-500 italic">Vắng kiểm tra</span>
                        ) : (
                          <span className={isCritical ? 'text-rose-700 font-medium' : 'text-amber-700 font-medium'}>
                            Thiếu <strong className="font-bold">{gap}đ</strong> để đạt chuẩn (≥{config.thresholds.datMin})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-medium">
                        {s.giaoVien || s.teacherName || '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-500 max-w-xs truncate" title={s.ghiChu}>
                        {s.ghiChu || (isAbsent ? 'Cần tổ chức kiểm tra bù' : 'Kèm cặp bồi dưỡng')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
