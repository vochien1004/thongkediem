import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Download,
  School,
  BookOpen,
  Users,
  Grid,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { StudentScore, SystemConfig, GlobalFilterState } from '../../types';
import {
  buildAttentionMatrix,
  exportQuantityNeedAttentionExcel,
  getExamTitleForAttentionReport,
} from '../../utils/exportQuantityNeedAttentionExcel';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface StatQuantityNeedAttentionProps {
  students: StudentScore[];
  config: SystemConfig;
  globalFilter?: GlobalFilterState;
}

export const StatQuantityNeedAttention: React.FC<StatQuantityNeedAttentionProps> = ({
  students,
  config,
  globalFilter,
}) => {
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');

  // Danh sách các khối duy nhất từ dữ liệu học sinh
  const uniqueGrades = useMemo(() => {
    const grds = students
      .map((s) => {
        if (s.khoi || s.grade) return String(s.khoi || s.grade).replace(/\D/g, '');
        const match = (s.lop || s.class || '').match(/^(\d+)/);
        return match ? match[1] : '';
      })
      .filter(Boolean);
    return Array.from(new Set(grds)).sort((a, b) => Number(a) - Number(b));
  }, [students]);

  // Lọc dữ liệu theo khối (nếu người dùng chọn khối cụ thể)
  const filteredStudents = useMemo(() => {
    if (gradeFilter === 'ALL') return students;
    return students.filter((s) => {
      const gNum = (s.khoi || s.grade || '').replace(/\D/g, '');
      if (gNum) return gNum === gradeFilter;
      const match = (s.lop || s.class || '').match(/^(\d+)/);
      return match ? match[1] === gradeFilter : false;
    });
  }, [students, gradeFilter]);

  // Xây dựng ma trận Lớp × Môn chuẩn 100% biểu mẫu Sở GD&ĐT
  const matrix = useMemo(() => {
    return buildAttentionMatrix(filteredStudents, config);
  }, [filteredStudents, config]);

  // Danh sách học sinh cần quan tâm (Chỉ tính học sinh chưa đạt điểm < 5, không tính học sinh không tham gia thi)
  const attentionList = useMemo(() => {
    const datMin = config.thresholds?.datMin ?? 5.0;
    return filteredStudents.filter((s) => {
      const score = s.diem !== undefined && s.diem !== null ? s.diem : s.score;
      return typeof score === 'number' && !isNaN(score) && score < datMin;
    });
  }, [filteredStudents, config.thresholds?.datMin]);

  // Học sinh riêng biệt cần quan tâm (unique student by studentId or fullName + class)
  const uniqueAttentionStudents = useMemo(() => {
    const map = new Map<string, StudentScore>();
    attentionList.forEach((s) => {
      const key = (s.soBD || s.studentId) || `${s.hoTen || s.fullName}_${s.lop || s.class}`;
      if (!map.has(key)) {
        map.set(key, s);
      }
    });
    return Array.from(map.values());
  }, [attentionList]);

  // Môn có nhiều học sinh cần quan tâm nhất
  const topSubject = useMemo(() => {
    let top = { name: '—', count: 0 };
    matrix.subjectColumns.forEach((sub) => {
      const cnt = matrix.grandTotals[sub] || 0;
      if (cnt > top.count) top = { name: sub, count: cnt };
    });
    return top;
  }, [matrix]);

  // Lớp có nhiều học sinh cần quan tâm nhất
  const topClass = useMemo(() => {
    let top = { name: '—', count: 0 };
    matrix.gradeGroups.forEach((gg) => {
      gg.classes.forEach((cls) => {
        let sum = 0;
        matrix.subjectColumns.forEach((sub) => {
          sum += matrix.classCounts[cls]?.[sub] || 0;
        });
        if (sum > top.count) top = { name: cls, count: sum };
      });
    });
    return top;
  }, [matrix]);

  // Danh sách tất cả các lớp đang hiển thị
  const allDisplayClasses = useMemo(() => {
    return matrix.gradeGroups.flatMap((gg) => gg.classes);
  }, [matrix]);

  // Tổng số lượt quan tâm của từng lớp
  const classTotalAttMap = useMemo(() => {
    const map: Record<string, number> = {};
    matrix.gradeGroups.forEach((gg) => {
      gg.classes.forEach((cls) => {
        let sum = 0;
        matrix.subjectColumns.forEach((sub) => {
          sum += matrix.classCounts[cls]?.[sub] || 0;
        });
        map[cls] = sum;
      });
    });
    return map;
  }, [matrix]);

  // Xuất file Excel đúng định dạng như hình ảnh
  const handleExportExcel = () => {
    exportQuantityNeedAttentionExcel(filteredStudents, config, globalFilter);
  };

  const currentExamTitle = getExamTitleForAttentionReport(config, globalFilter);

  return (
    <div className="space-y-5">
      {/* Bộ lọc & Header */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Số Lượng Học Sinh Cần Quan Tâm
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                Mẫu chuẩn Sở GD&ĐT
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tổng hợp số lượng học sinh có điểm dưới ngưỡng Đạt (&lt;{config.thresholds?.datMin ?? 5.0} điểm), không tính học sinh không tham gia thi
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
            <span>Khối học:</span>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-900 font-bold rounded-lg focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả các khối</option>
              {uniqueGrades.map((g) => (
                <option key={g} value={g}>
                  Khối {g}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Xuất bảng tổng hợp số lượng HS cần quan tâm theo đúng biểu mẫu hình ảnh"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất file Excel chuẩn</span>
          </button>
        </div>
      </div>

      {/* 4 Thẻ KPI vĩ mô */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Tổng lượt cần quan tâm</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-600">{attentionList.length} lượt</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Tỷ lệ: <strong>{filteredStudents.length > 0 ? ((attentionList.length / filteredStudents.length) * 100).toFixed(1) : 0}%</strong> trên tổng bài thi
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Số HS riêng biệt</span>
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{uniqueAttentionStudents.length} học sinh</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Các em có ít nhất 1 môn cần phụ đạo
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Môn nhiều HS yếu nhất</span>
            <BookOpen className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 truncate" title={topSubject.name}>
            {topSubject.name}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Ghi nhận: <strong>{topSubject.count}</strong> lượt cần quan tâm
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Lớp cần hỗ trợ nhất</span>
            <School className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">{topClass.name}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Chiếm: <strong>{topClass.count}</strong> lượt chưa đạt chuẩn
          </div>
        </div>
      </div>

      {/* Ma trận Số lượng HS cần quan tâm (Đúng định dạng mẫu ảnh) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Grid className="w-4 h-4 text-amber-600" />
            <div>
              <h4 className="font-bold text-slate-900 text-sm">
                TỔNG HỢP SỐ LƯỢNG HỌC SINH CẦN QUAN TÂM
              </h4>
              <p className="text-xs text-slate-500">
                {currentExamTitle} • Giao thoa số lượng điểm dưới {config.thresholds?.datMin ?? 5.0}đ theo Lớp và Môn
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-slate-50 border border-slate-300 inline-block text-center text-[9px] text-slate-400">0</span> 0 lượt
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-amber-50 border border-amber-300 inline-block text-center text-[9px] text-amber-700 font-bold">&gt;0</span> Có HS yếu
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <th className="py-2.5 px-3 w-32 bg-slate-200 sticky left-0 z-10 border border-slate-300 text-left">
                  Lớp/Môn
                </th>
                {matrix.subjectColumns.map((sub) => (
                  <th
                    key={sub}
                    className="py-2.5 px-2 text-center min-w-[70px] border border-slate-300 font-bold text-slate-900"
                  >
                    {sub}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {matrix.gradeGroups.map((gg) => (
                <React.Fragment key={gg.gradeNum}>
                  {/* Danh sách từng lớp trong khối */}
                  {gg.classes.map((cls) => (
                    <tr key={cls} className="hover:bg-amber-50/30 transition">
                      <td className="py-2 px-3 font-semibold text-slate-800 bg-slate-50 sticky left-0 z-10 border border-slate-200">
                        {cls}
                      </td>
                      {matrix.subjectColumns.map((sub) => {
                        const count = matrix.classCounts[cls]?.[sub] || 0;
                        return (
                          <td
                            key={sub}
                            className={`py-2 px-2 text-center border border-slate-200 ${
                              count > 0
                                ? 'font-semibold text-slate-900 bg-white'
                                : 'text-slate-400 bg-slate-50/50'
                            }`}
                          >
                            {count}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* Dòng Tổng khối (VD: Tổng khối 10, Tổng khối 11, Tổng khối 12) */}
                  <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-b-2 border-slate-300">
                    <td className="py-2.5 px-3 sticky left-0 z-10 bg-slate-200 text-slate-900 border border-slate-300 font-bold">
                      {gg.gradeLabel}
                    </td>
                    {matrix.subjectColumns.map((sub) => {
                      const val = matrix.gradeTotals[gg.gradeNum]?.[sub] || 0;
                      return (
                        <td
                          key={sub}
                          className="py-2.5 px-2 text-center text-slate-900 border border-slate-300 font-bold bg-slate-100"
                        >
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
            <tfoot>
              {/* Dòng Tổng toàn trường chuẩn như hình ảnh */}
              <tr className="bg-slate-200 font-bold text-slate-950 border-t-2 border-slate-400">
                <td className="py-3 px-3 sticky left-0 z-10 bg-slate-300 border border-slate-400 font-bold uppercase tracking-wide">
                  Tổng toàn trường
                </td>
                {matrix.subjectColumns.map((sub) => {
                  const val = matrix.grandTotals[sub] || 0;
                  return (
                    <td
                      key={sub}
                      className="py-3 px-2 text-center text-slate-950 border border-slate-400 font-bold text-sm bg-slate-200"
                    >
                      {val}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Biểu đồ so sánh số lượng HS cần quan tâm */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <h4 className="font-bold text-slate-900 text-xs mb-1">
            Số lượng HS cần quan tâm theo Lớp
          </h4>
          <p className="text-[11px] text-slate-500 mb-4">Các lớp có số lượt điểm &lt; 5.0đ cần lưu ý</p>
          <div className="h-60">
            <Bar
              data={{
                labels: allDisplayClasses,
                datasets: [
                  {
                    label: 'Số lượt cần quan tâm',
                    data: allDisplayClasses.map((cls) => classTotalAttMap[cls] || 0),
                    backgroundColor: '#f59e0b',
                    borderRadius: 6,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: { ticks: { stepSize: 2 } },
                },
                plugins: { legend: { display: false } },
              }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <h4 className="font-bold text-slate-900 text-xs mb-1">
            Số lượng HS cần quan tâm theo Môn học
          </h4>
          <p className="text-[11px] text-slate-500 mb-4">Phân bố số lượng điểm chưa đạt giữa các môn</p>
          <div className="h-60">
            <Bar
              data={{
                labels: matrix.subjectColumns,
                datasets: [
                  {
                    label: 'Số lượt cần quan tâm',
                    data: matrix.subjectColumns.map((sub) => matrix.grandTotals[sub] || 0),
                    backgroundColor: '#f43f5e',
                    borderRadius: 6,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: { ticks: { stepSize: 2 } },
                },
                plugins: { legend: { display: false } },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
