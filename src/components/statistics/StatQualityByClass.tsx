import React, { useState, useMemo } from 'react';
import {
  School,
  TrendingUp,
  Award,
  AlertTriangle,
  Download,
  BookOpen,
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
import { calculateStats } from '../../utils/scoreClassifier';
import {
  getShortSubjectName,
  calculateQualityClassStats,
} from '../../utils/exportQualityBySubjectExcel';
import {
  exportQualityByClassExcelFile,
  compareSubjectsStandardOrder,
} from '../../utils/exportQualityByClassExcel';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface StatQualityByClassProps {
  students: StudentScore[];
  config: SystemConfig;
  globalFilter?: GlobalFilterState;
}

export const StatQualityByClass: React.FC<StatQualityByClassProps> = ({
  students,
  config,
  globalFilter,
}) => {
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');
  const [viewLayout, setViewLayout] = useState<'official' | 'extended'>('official');

  // Danh sách các lớp duy nhất
  const uniqueClasses = useMemo(() => {
    const clss = students.map((s) => s.lop || s.class).filter((c): c is string => Boolean(c));
    return Array.from(new Set(clss)).sort((a: string, b: string) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [students]);

  // Lớp đang hiển thị khi chọn chế độ official (nếu chọn ALL thì hiển thị lớp đầu tiên hoặc 10B3)
  const displayClassForOfficial = useMemo(() => {
    if (selectedClass !== 'ALL') return selectedClass;
    const target = uniqueClasses.find((c) => c === '10B3') || uniqueClasses[0] || '10B1';
    return target;
  }, [selectedClass, uniqueClasses]);

  // Danh sách các khối duy nhất
  const uniqueGrades = useMemo(() => {
    const grds = students.map((s) => s.khoi || s.grade).filter((g): g is string => Boolean(g));
    return Array.from(new Set(grds)).sort();
  }, [students]);

  // Thống kê phân tích theo Lớp đối với từng Môn học
  const dataReport = useMemo(() => {
    // Với chế độ official, nếu selectedClass là ALL thì hiển thị theo displayClassForOfficial để đúng mẫu bảng 1 lớp trong ảnh
    const targetCls = viewLayout === 'official' && selectedClass === 'ALL' ? displayClassForOfficial : selectedClass;

    const filtered = students.filter((s) => {
      const matchCls = targetCls === 'ALL' ? true : (s.lop || s.class) === targetCls;
      const matchGrd = gradeFilter === 'ALL' ? true : (s.khoi || s.grade) === gradeFilter;
      return matchCls && matchGrd;
    });

    // Gom nhóm theo Môn học
    const subjectMap: Record<string, StudentScore[]> = {};
    filtered.forEach((s) => {
      const subj = s.monHoc || s.subject || 'Chung';
      if (!subjectMap[subj]) subjectMap[subj] = [];
      subjectMap[subj].push(s);
    });

    // LỌC BỎ CÁC MÔN HỌC KHÔNG CÓ HỌC SINH NÀO DỰ THI (slDuKt === 0)
    // Đúng nguyên tắc: lớp không học môn nào thì không hiển thị môn đó
    const activeSubjectList = Object.keys(subjectMap).filter((subj) => {
      const st = calculateQualityClassStats(subjectMap[subj]);
      return st.slDuKt > 0;
    }).sort(compareSubjectsStandardOrder);

    const summaries = activeSubjectList.map((subj) => {
      const list = subjectMap[subj];
      const stats = calculateStats(list);
      const quality = calculateQualityClassStats(list);
      return {
        subjectName: subj,
        shortName: getShortSubjectName(subj),
        stats,
        quality,
        students: list,
      };
    });

    const totalStats = calculateStats(filtered);
    const totalQuality = calculateQualityClassStats(filtered);

    return {
      activeClass: targetCls,
      summaries,
      totalStats,
      totalQuality,
      totalCount: filtered.length,
    };
  }, [students, selectedClass, gradeFilter, viewLayout, displayClassForOfficial]);

  // Xuất file Excel đúng tên chuẩn mẫu Sở GD&ĐT đồng bộ đợt điểm
  const handleExportExcel = () => {
    exportQualityByClassExcelFile(students, config, selectedClass, globalFilter);
  };

  return (
    <div className="space-y-5">
      {/* Bộ lọc Lớp & Khối */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold shrink-0">
            <School className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Thống Kê Chất Lượng Theo Lớp
            </h3>
            <p className="text-xs text-slate-500">
              Đánh giá kết quả các môn của <span className="font-semibold text-blue-700">{selectedClass === 'ALL' ? (viewLayout === 'official' ? `Lớp ${displayClassForOfficial} (Xem trước mẫu chuẩn)` : 'Tất cả các lớp') : `Lớp ${selectedClass}`}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
            <span>Chọn Lớp:</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-900 font-bold rounded-lg focus:outline-none"
            >
              <option value="ALL">-- Tất cả các lớp --</option>
              {uniqueClasses.map((cls) => (
                <option key={cls} value={cls}>
                  Lớp {cls}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
            <span>Khối:</span>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none"
            >
              <option value="ALL">Tất cả Khối</option>
              {uniqueGrades.map((g) => (
                <option key={g} value={g}>
                  Khối {g}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            title="Xuất file Excel đúng định dạng hình ảnh với đa sheet tương ứng từng lớp"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất ThongKeChatLuong_Theo lớp.xlsx</span>
          </button>
        </div>
      </div>

      {/* 4 Thẻ chỉ số tổng hợp */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Số môn đánh giá</span>
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{dataReport.summaries.length} Môn</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Tổng số lượt kiểm tra: <strong>{dataReport.totalQuality.slDuKt}</strong>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Điểm TB toàn lớp</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{dataReport.totalQuality.diemTb.toFixed(1)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Cao nhất: <strong>{dataReport.totalStats.max}</strong> | Thấp nhất: <strong>{dataReport.totalStats.min}</strong>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Tỷ lệ Khá - Tốt</span>
            <Award className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {(dataReport.totalQuality.totTl + dataReport.totalQuality.khaTl).toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {dataReport.totalQuality.totSl + dataReport.totalQuality.khaSl} lượt đạt loại Khá & Tốt
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Tỷ lệ Chưa đạt</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-600">{dataReport.totalQuality.chuaDatTl.toFixed(1)}%</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {dataReport.totalQuality.chuaDatSl} lượt điểm chưa đạt (&lt; 5)
          </div>
        </div>
      </div>

      {/* Biểu đồ so sánh giữa các môn */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <h4 className="font-bold text-slate-900 text-xs mb-1">
            Điểm trung bình các Môn học ({dataReport.activeClass === 'ALL' ? 'Tất cả lớp' : `Lớp ${dataReport.activeClass}`})
          </h4>
          <p className="text-[11px] text-slate-500 mb-4">So sánh phổ điểm trung bình giữa các môn trong lớp</p>
          <div className="h-60">
            <Bar
              data={{
                labels: dataReport.summaries.map((s) => s.shortName),
                datasets: [
                  {
                    label: 'Điểm trung bình',
                    data: dataReport.summaries.map((s) => s.quality.diemTb),
                    backgroundColor: '#2563eb',
                    borderRadius: 6,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: { min: 0, max: 10, ticks: { stepSize: 2 } },
                },
                plugins: { legend: { display: false } },
              }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <h4 className="font-bold text-slate-900 text-xs mb-1">
            Cơ cấu Xếp loại theo từng Môn ({dataReport.activeClass === 'ALL' ? 'Tất cả lớp' : `Lớp ${dataReport.activeClass}`})
          </h4>
          <p className="text-[11px] text-slate-500 mb-4">Số lượng học sinh theo từng bậc xếp loại theo môn</p>
          <div className="h-60">
            <Bar
              data={{
                labels: dataReport.summaries.map((s) => s.shortName),
                datasets: [
                  {
                    label: `Tốt (≥ 8.0)`,
                    data: dataReport.summaries.map((s) => s.quality.totSl),
                    backgroundColor: '#10b981',
                    borderRadius: 4,
                  },
                  {
                    label: `Khá (6.5 - <8.0)`,
                    data: dataReport.summaries.map((s) => s.quality.khaSl),
                    backgroundColor: '#3b82f6',
                    borderRadius: 4,
                  },
                  {
                    label: `Đạt (5.0 - <6.5)`,
                    data: dataReport.summaries.map((s) => s.quality.datSl),
                    backgroundColor: '#f59e0b',
                    borderRadius: 4,
                  },
                  {
                    label: `Chưa đạt (< 5.0)`,
                    data: dataReport.summaries.map((s) => s.quality.chuaDatSl),
                    backgroundColor: '#f43f5e',
                    borderRadius: 4,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  x: { stacked: true },
                  y: { stacked: true },
                },
                plugins: {
                  legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Bảng số liệu chi tiết - Hỗ trợ cả 2 chế độ hiển thị */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">
              Bảng Tổng Hợp Chi Tiết Chất Lượng Theo Lớp ({dataReport.activeClass === 'ALL' ? 'Tất cả lớp' : `Lớp ${dataReport.activeClass}`})
            </h4>
            <p className="text-xs text-slate-500">
              {viewLayout === 'official'
                ? 'Đang hiển thị chuẩn theo mẫu báo cáo nhà trường trong hình ảnh (chỉ hiển thị các môn lớp đó thực học)'
                : 'Đang hiển thị bảng mở rộng với độ lệch chuẩn và điểm cao/thấp'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex p-1 bg-slate-200/70 rounded-xl text-xs font-semibold text-slate-700">
              <button
                onClick={() => setViewLayout('official')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  viewLayout === 'official'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mẫu chuẩn theo lớp (Mẫu ảnh)
              </button>
              <button
                onClick={() => setViewLayout('extended')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  viewLayout === 'extended'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bảng phân tích mở rộng
              </button>
            </div>

            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              title="Xuất file Excel đúng định dạng hình ảnh"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải file Excel chuẩn</span>
            </button>
          </div>
        </div>

        {viewLayout === 'official' ? (
          /* BẢNG CHUẨN THEO MẪU BÁO CÁO NHÀ TRƯỜNG TRONG HÌNH ẢNH */
          <div className="p-4 sm:p-6 overflow-x-auto bg-slate-50/30">
            <div className="min-w-[760px] bg-white border border-slate-300 rounded-lg p-5 shadow-xs">
              {/* Header cơ quan & ngày in */}
              <div className="flex justify-between items-start text-xs font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">
                <div>
                  <div className="uppercase tracking-wide">SỞ GD&ĐT QUẢNG NGÃI</div>
                  <div className="uppercase text-slate-900 font-extrabold text-sm mt-0.5">
                    {config.schoolName && config.schoolName.includes('SA THẦY')
                      ? config.schoolName
                      : 'TRƯỜNG PTDTNT THPT SA THẦY'}
                  </div>
                </div>
                <div className="text-right text-slate-600 font-normal italic">
                  Ngày in: {new Date().toLocaleDateString('vi-VN')}
                </div>
              </div>

              {/* Tiêu đề kỳ thi & bảng */}
              <div className="text-center my-4">
                <h3 className="font-extrabold text-slate-900 text-base uppercase tracking-wide">
                  {config.examName || 'KIỂM TRA GIỮA HỌC KỲ II'} - NĂM HỌC {config.academicYear || '2025 - 2026'}
                </h3>
                <h4 className="font-bold text-blue-800 text-sm uppercase mt-1">
                  THỐNG KÊ CHẤT LƯỢNG THEO LỚP
                </h4>
                <div className="font-bold text-slate-800 text-sm mt-2 text-left italic">
                  Lớp: <span className="font-extrabold not-italic text-slate-900 underline ml-1">{dataReport.activeClass}</span>
                </div>
              </div>

              {/* Bảng 2 tầng header chuẩn 100% như trong ảnh */}
              <table className="w-full text-xs text-left border-collapse border border-slate-800">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800 text-center">
                    <th rowSpan={2} className="border border-slate-800 py-2 px-2 w-10">TT</th>
                    <th rowSpan={2} className="border border-slate-800 py-2 px-3 w-32">Môn</th>
                    <th rowSpan={2} className="border border-slate-800 py-2 px-2.5 w-20 leading-tight">
                      SL HS<br />dự KT
                    </th>
                    <th colSpan={2} className="border border-slate-800 py-1.5 px-2 bg-rose-50/70 text-rose-950 leading-tight">
                      Chưa đạt<br /><span className="font-normal text-[11px]">(điểm &lt; 5)</span>
                    </th>
                    <th colSpan={2} className="border border-slate-800 py-1.5 px-2 bg-amber-50/70 text-amber-950 leading-tight">
                      Đạt<br /><span className="font-normal text-[11px]">(5&lt;= điểm &lt;6.5)</span>
                    </th>
                    <th colSpan={2} className="border border-slate-800 py-1.5 px-2 bg-blue-50/70 text-blue-950 leading-tight">
                      Khá<br /><span className="font-normal text-[11px]">(6.5&lt;= điểm &lt;8)</span>
                    </th>
                    <th colSpan={2} className="border border-slate-800 py-1.5 px-2 bg-emerald-50/70 text-emerald-950 leading-tight">
                      Tốt<br /><span className="font-normal text-[11px]">(điểm &gt;= 8)</span>
                    </th>
                  </tr>
                  <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800 text-center text-[11px]">
                    <th className="border border-slate-800 py-1 px-2 bg-rose-50/40 w-12">SL</th>
                    <th className="border border-slate-800 py-1 px-2 bg-rose-50/40 w-14">TL</th>
                    <th className="border border-slate-800 py-1 px-2 bg-amber-50/40 w-12">SL</th>
                    <th className="border border-slate-800 py-1 px-2 bg-amber-50/40 w-14">TL</th>
                    <th className="border border-slate-800 py-1 px-2 bg-blue-50/40 w-12">SL</th>
                    <th className="border border-slate-800 py-1 px-2 bg-blue-50/40 w-14">TL</th>
                    <th className="border border-slate-800 py-1 px-2 bg-emerald-50/40 w-12">SL</th>
                    <th className="border border-slate-800 py-1 px-2 bg-emerald-50/40 w-14">TL</th>
                  </tr>
                </thead>
                <tbody>
                  {dataReport.summaries.map((item, idx) => (
                    <tr key={item.subjectName} className="hover:bg-slate-50 transition border-b border-slate-300">
                      <td className="border border-slate-800 py-2 px-2 text-center font-medium text-slate-600">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-800 py-2 px-3 text-center font-medium text-slate-900">
                        {item.shortName}
                      </td>
                      <td className="border border-slate-800 py-2 px-2.5 text-center font-bold text-slate-800">
                        {item.quality.slDuKt}
                      </td>
                      <td className="border border-slate-800 py-2 px-2 text-center font-medium text-slate-900">
                        {item.quality.chuaDatSl}
                      </td>
                      <td className="border border-slate-800 py-2 px-2 text-center text-slate-700">
                        {item.quality.chuaDatTl.toFixed(1)}%
                      </td>
                      <td className="border border-slate-800 py-2 px-2 text-center font-medium text-slate-900">
                        {item.quality.datSl}
                      </td>
                      <td className="border border-slate-800 py-2 px-2 text-center text-slate-700">
                        {item.quality.datTl.toFixed(1)}%
                      </td>
                      <td className="border border-slate-800 py-2 px-2 text-center font-medium text-slate-900">
                        {item.quality.khaSl}
                      </td>
                      <td className="border border-slate-800 py-2 px-2 text-center text-slate-700">
                        {item.quality.khaTl.toFixed(1)}%
                      </td>
                      <td className="border border-slate-800 py-2 px-2 text-center font-medium text-slate-900">
                        {item.quality.totSl}
                      </td>
                      <td className="border border-slate-800 py-2 px-2 text-center text-slate-700">
                        {item.quality.totTl.toFixed(1)}%
                      </td>
                    </tr>
                  ))}

                  {/* 2 Dòng trống có viền bảng như đúng trong ảnh */}
                  <tr className="border-b border-slate-300">
                    <td className="border border-slate-800 py-3 px-2">&nbsp;</td>
                    <td className="border border-slate-800 py-3 px-3">&nbsp;</td>
                    <td className="border border-slate-800 py-3 px-2.5">&nbsp;</td>
                    <td className="border border-slate-800 py-3 px-2">&nbsp;</td>
                    <td className="border border-slate-800 py-3 px-2">&nbsp;</td>
                    <td className="border border-slate-800 py-3 px-2">&nbsp;</td>
                    <td className="border border-slate-800 py-3 px-2">&nbsp;</td>
                    <td className="border border-slate-800 py-3 px-2">&nbsp;</td>
                    <td className="border border-slate-800 py-3 px-2">&nbsp;</td>
                    <td className="border border-slate-800 py-3 px-2">&nbsp;</td>
                    <td className="border border-slate-800 py-3 px-2">&nbsp;</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="border border-slate-800 py-3 px-2">&nbsp;</td>
                    <td className="border border-slate-800 py-3 px-3">&nbsp;</td>
                    <td className="border border-slate-800 py-3 px-2.5">&nbsp;</td>
                    <td className="border border-slate-800 py-3 px-2">&nbsp;</td>
                    <td className="border border-slate-800 py-3 px-2">&nbsp;</td>
                    <td className="border border-slate-800 py-3 px-2">&nbsp;</td>
                    <td className="border border-slate-800 py-3 px-2">&nbsp;</td>
                    <td className="border border-slate-800 py-3 px-2">&nbsp;</td>
                    <td className="border border-slate-800 py-3 px-2">&nbsp;</td>
                    <td className="border border-slate-800 py-3 px-2">&nbsp;</td>
                    <td className="border border-slate-800 py-3 px-2">&nbsp;</td>
                  </tr>
                </tbody>
              </table>

              {/* Chữ ký Người Lập ở chân trang đúng vị trí cột B */}
              <div className="mt-8 grid grid-cols-12">
                <div className="col-span-4 text-center">
                  <div className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                    NGƯỜI LẬP
                  </div>
                  <div className="h-16 flex items-center justify-center italic text-slate-400 text-xs font-serif">
                    (Đã ký)
                  </div>
                  <div className="font-bold text-slate-900 text-xs">
                    Võ Chiến
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* BẢNG MỞ RỘNG VỚI ĐỘ LỆCH CHUẨN VÀ ĐIỂM MIN/MAX */
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="py-3 px-3 text-center w-12">STT</th>
                  <th className="py-3 px-3">Môn học</th>
                  <th className="py-3 px-3 text-center">SL dự KT</th>
                  <th className="py-3 px-3 text-center">Điểm TB</th>
                  <th className="py-3 px-3 text-center">Độ lệch</th>
                  <th className="py-3 px-3 text-center">Cao / Thấp</th>
                  <th className="py-3 px-3 text-center bg-rose-50/60 text-rose-900">
                    Chưa đạt (&lt;5)
                  </th>
                  <th className="py-3 px-3 text-center bg-amber-50/60 text-amber-900">
                    Đạt (5-&lt;6.5)
                  </th>
                  <th className="py-3 px-3 text-center bg-blue-50/60 text-blue-900">
                    Khá (6.5-&lt;8)
                  </th>
                  <th className="py-3 px-3 text-center bg-emerald-50/60 text-emerald-900">
                    Tốt (≥8)
                  </th>
                  <th className="py-3 px-3 text-center">Khá - Tốt %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dataReport.summaries.map((item, idx) => (
                  <tr key={item.subjectName} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-3 px-3 font-semibold text-slate-900">{item.shortName}</td>
                    <td className="py-3 px-3 text-center font-medium text-slate-700">
                      {item.quality.slDuKt}
                      {item.stats.absentCount > 0 && (
                        <span className="text-[10px] text-slate-400 block">({item.stats.absentCount} vắng)</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-700 text-sm">
                      {item.quality.diemTb.toFixed(1)}
                    </td>
                    <td className="py-3 px-3 text-center text-slate-500 font-mono">±{item.stats.standardDeviation}</td>
                    <td className="py-3 px-3 text-center text-slate-600">
                      <span className="text-emerald-700 font-semibold">{item.stats.max}</span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className="text-rose-700 font-semibold">{item.stats.min}</span>
                    </td>
                    <td className="py-3 px-3 text-center bg-rose-50/20">
                      <span className="font-bold text-rose-700">{item.quality.chuaDatSl}</span>
                      <span className="text-[10px] text-rose-600 block">({item.quality.chuaDatTl.toFixed(1)}%)</span>
                    </td>
                    <td className="py-3 px-3 text-center bg-amber-50/20">
                      <span className="font-bold text-amber-700">{item.quality.datSl}</span>
                      <span className="text-[10px] text-amber-600 block">({item.quality.datTl.toFixed(1)}%)</span>
                    </td>
                    <td className="py-3 px-3 text-center bg-blue-50/20">
                      <span className="font-bold text-blue-700">{item.quality.khaSl}</span>
                      <span className="text-[10px] text-blue-600 block">({item.quality.khaTl.toFixed(1)}%)</span>
                    </td>
                    <td className="py-3 px-3 text-center bg-emerald-50/20">
                      <span className="font-bold text-emerald-700">{item.quality.totSl}</span>
                      <span className="text-[10px] text-emerald-600 block">({item.quality.totTl.toFixed(1)}%)</span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-800">
                      {(item.quality.totTl + item.quality.khaTl).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td className="py-3 px-3 text-center" colSpan={2}>
                    TỔNG CỘNG ({dataReport.summaries.length} Môn)
                  </td>
                  <td className="py-3 px-3 text-center">{dataReport.totalQuality.slDuKt}</td>
                  <td className="py-3 px-3 text-center text-emerald-700 text-sm">
                    {dataReport.totalQuality.diemTb.toFixed(1)}
                  </td>
                  <td className="py-3 px-3 text-center font-mono">±{dataReport.totalStats.standardDeviation}</td>
                  <td className="py-3 px-3 text-center">
                    <span className="text-emerald-700">{dataReport.totalStats.max}</span>
                    <span className="text-slate-400 mx-1">/</span>
                    <span className="text-rose-700">{dataReport.totalStats.min}</span>
                  </td>
                  <td className="py-3 px-3 text-center text-rose-800">
                    {dataReport.totalQuality.chuaDatSl} ({dataReport.totalQuality.chuaDatTl.toFixed(1)}%)
                  </td>
                  <td className="py-3 px-3 text-center text-amber-800">
                    {dataReport.totalQuality.datSl} ({dataReport.totalQuality.datTl.toFixed(1)}%)
                  </td>
                  <td className="py-3 px-3 text-center text-blue-800">
                    {dataReport.totalQuality.khaSl} ({dataReport.totalQuality.khaTl.toFixed(1)}%)
                  </td>
                  <td className="py-3 px-3 text-center text-emerald-800">
                    {dataReport.totalQuality.totSl} ({dataReport.totalQuality.totTl.toFixed(1)}%)
                  </td>
                  <td className="py-3 px-3 text-center">
                    {(dataReport.totalQuality.totTl + dataReport.totalQuality.khaTl).toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
