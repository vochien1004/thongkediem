import React, { useState, useMemo } from 'react';
import {
  AlertOctagon,
  Search,
  Download,
  BookOpen,
  Filter,
  User,
  GraduationCap,
  Flame,
  ShieldAlert,
} from 'lucide-react';
import { StudentScore, SystemConfig, GlobalFilterState } from '../../types';
import { exportSpecialAttentionExcel, SPECIAL_ATTENTION_THRESHOLD } from '../../utils/exportSpecialAttentionExcel';

interface StatSpecialAttentionProps {
  students: StudentScore[];
  config: SystemConfig;
  globalFilter?: GlobalFilterState;
}

export const StatSpecialAttention: React.FC<StatSpecialAttentionProps> = ({
  students,
  config,
  globalFilter,
}) => {
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'VERY_LOW' | 'LOW'>('ALL');

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

  // Danh sách học sinh cần quan tâm đặc biệt (Chỉ tính học sinh có tham gia thi và điểm <= 3.5)
  const filteredList = useMemo(() => {
    return students
      .filter((s) => {
        const score = s.diem !== undefined && s.diem !== null ? s.diem : s.score;
        // Chỉ lấy những em có tham gia thi và điểm <= 3.5
        const isValidScore = typeof score === 'number' && !isNaN(score);
        const isSpecialAttention = isValidScore && score <= SPECIAL_ATTENTION_THRESHOLD;
        if (!isSpecialAttention) return false;

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

        // Lọc phân nhóm điểm
        if (severityFilter === 'VERY_LOW') {
          if (score >= 2.0) return false; // Cực yếu (< 2.0đ)
        } else if (severityFilter === 'LOW') {
          if (score < 2.0 || score > SPECIAL_ATTENTION_THRESHOLD) return false; // Yếu (2.0 - 3.5đ)
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
  }, [students, selectedSubject, selectedClass, severityFilter, searchTerm]);

  // Thống kê nhanh cho danh sách đang hiển thị
  const statsSummary = useMemo(() => {
    const scores = filteredList
      .map((s) => s.diem ?? s.score)
      .filter((s): s is number => s !== null && typeof s === 'number');

    const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : '—';
    const minScore = scores.length > 0 ? Math.min(...scores).toFixed(1) : '—';
    const veryLowCount = filteredList.filter((s) => {
      const sc = s.diem ?? s.score;
      return typeof sc === 'number' && sc < 2.0;
    }).length;

    // Tổng số lượt thi có điểm hợp lệ để tính tỷ lệ
    const totalValidExams = students.filter((s) => {
      const sc = s.diem ?? s.score;
      return typeof sc === 'number' && !isNaN(sc);
    }).length;

    const rate = totalValidExams > 0 ? ((filteredList.length / totalValidExams) * 100).toFixed(1) : '0';

    return {
      total: filteredList.length,
      average: avg,
      minScore,
      veryLowCount,
      rate,
    };
  }, [filteredList, students]);

  // Xuất file Excel đúng định dạng: Mỗi sheet 1 môn, hiển thị theo lớp
  const handleExportExcel = () => {
    exportSpecialAttentionExcel(students, config, globalFilter);
  };

  return (
    <div className="space-y-5">
      {/* Header & Banner cảnh báo */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-red-200 shadow-xs flex flex-wrap items-center justify-between gap-3 bg-linear-to-r from-red-50/40 via-white to-orange-50/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold shrink-0 shadow-xs border border-red-200">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Danh Sách Học Sinh Cần Quan Tâm Đặc Biệt
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
                Điểm ≤ 3.5
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tổng hợp danh sách học sinh có kết quả kiểm tra ở mức yếu kém nghiêm trọng (≤ 3.5 điểm) cần can thiệp khẩn cấp
            </p>
          </div>
        </div>

        <button
          onClick={handleExportExcel}
          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer border border-red-700"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Xuất Danh sách HS cần quan tâm đặc biệt.xlsx</span>
        </button>
      </div>

      {/* 4 Thẻ chỉ số cảnh báo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl p-4 border border-red-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Tổng HS quan tâm đặc biệt</span>
            <ShieldAlert className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-red-600">{statsSummary.total} em</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Điểm kiểm tra ≤ 3.5 điểm
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-red-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Mức cực yếu (&lt; 2.0đ)</span>
            <Flame className="w-4 h-4 text-rose-700" />
          </div>
          <div className="text-2xl font-bold text-rose-800">{statsSummary.veryLowCount} em</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Nguy cơ mất căn bản kiến thức
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Điểm TB nhóm đặc biệt</span>
            <GraduationCap className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-2xl font-bold text-orange-600">{statsSummary.average}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Điểm thấp nhất: <strong className="text-red-700">{statsSummary.minScore}</strong>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Tỷ lệ trên toàn trường</span>
            <User className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{statsSummary.rate}%</div>
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
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
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
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phân mức điểm:</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="ALL">Tất cả (≤ 3.5 điểm)</option>
              <option value="VERY_LOW">Mức cực yếu (&lt; 2.0 điểm)</option>
              <option value="LOW">Mức yếu (2.0 - 3.5 điểm)</option>
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
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
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
              Danh Sách Học Sinh Cần Quan Tâm Đặc Biệt ({filteredList.length} học sinh)
            </h4>
            <p className="text-xs text-slate-500">
              Sắp xếp theo môn học và thứ tự điểm số tăng dần
            </p>
          </div>
        </div>

        {filteredList.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <AlertOctagon className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium">Không có học sinh nào trong diện quan tâm đặc biệt (≤ 3.5 điểm)</p>
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
                  <th className="py-3 px-3">Mức độ thiếu chuẩn</th>
                  <th className="py-3 px-3">Giáo viên phụ trách</th>
                  <th className="py-3 px-3">Kế hoạch can thiệp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((s, idx) => {
                  const score = s.diem ?? s.score;
                  const scoreNum = typeof score === 'number' ? score : 0;
                  const isVeryLow = scoreNum < 2.0;
                  const gap = (config.thresholds.datMin - scoreNum).toFixed(1);

                  return (
                    <tr key={`${s.id || idx}_${s.monHoc}`} className="hover:bg-red-50/40 transition">
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
                        <span
                          className={`px-2.5 py-0.5 rounded font-bold text-xs inline-block ${
                            isVeryLow
                              ? 'bg-red-200 text-red-900 border border-red-400 font-mono'
                              : 'bg-red-100 text-red-800 border border-red-300 font-mono'
                          }`}
                        >
                          {scoreNum.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-red-700 font-medium">
                          Thiếu <strong className="font-bold text-red-800">{gap}đ</strong> để đạt (≥{config.thresholds.datMin})
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-medium">
                        {s.giaoVien || s.teacherName || '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-500 max-w-xs truncate" title={s.ghiChu}>
                        {s.ghiChu || (isVeryLow ? 'Phụ đạo khẩn cấp 1 kèm 1' : 'Kèm cặp bồi dưỡng trọng tâm')}
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
