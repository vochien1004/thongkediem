import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  TrendingUp,
  Award,
  AlertTriangle,
  Download,
  School,
  FileSpreadsheet,
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
import * as XLSX from 'xlsx';
import { StudentScore, SystemConfig, GlobalFilterState } from '../../types';
import { calculateStats } from '../../utils/scoreClassifier';
import {
  exportQualityBySubjectExcelFile,
  extractGrade,
  calculateQualityClassStats,
  getShortSubjectName,
} from '../../utils/exportQualityBySubjectExcel';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface StatQualityBySubjectProps {
  students: StudentScore[];
  config: SystemConfig;
  globalFilter?: GlobalFilterState;
}

export const StatQualityBySubject: React.FC<StatQualityBySubjectProps> = ({
  students,
  config,
  globalFilter,
}) => {
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');
  const [viewLayout, setViewLayout] = useState<'official' | 'extended'>('official');

  // Danh sách các môn học duy nhất
  const uniqueSubjects = useMemo(() => {
    const subs = students.map((s) => s.monHoc || s.subject).filter((s): s is string => Boolean(s));
    return Array.from(new Set(subs)).sort();
  }, [students]);

  // Danh sách các khối duy nhất
  const uniqueGrades = useMemo(() => {
    const grds = students.map((s) => s.khoi || s.grade).filter((g): g is string => Boolean(g));
    return Array.from(new Set(grds)).sort();
  }, [students]);

  // Thống kê phân tích theo Môn đối với từng Lớp
  const dataReport = useMemo(() => {
    const filtered = students.filter((s) => {
      const matchSub = selectedSubject === 'ALL' ? true : (s.monHoc || s.subject) === selectedSubject;
      const matchGrd = gradeFilter === 'ALL' ? true : (s.khoi || s.grade) === gradeFilter;
      return matchSub && matchGrd;
    });

    // Gom nhóm theo Lớp
    const classMap: Record<string, StudentScore[]> = {};
    filtered.forEach((s) => {
      const cls = s.lop || s.class || 'Chưa phân lớp';
      if (!classMap[cls]) classMap[cls] = [];
      classMap[cls].push(s);
    });

    const classList = Object.keys(classMap).sort((a: string, b: string) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    const summaries = classList
      .map((cls) => {
        const list = classMap[cls];
        const stats = calculateStats(list);
        const qualityStats = calculateQualityClassStats(list);
        return {
          className: cls,
          stats,
          qualityStats,
          students: list,
        };
      })
      .filter((item) => item.qualityStats.slDuKt > 0);

    const totalStats = calculateStats(filtered);
    const totalQualityStats = calculateQualityClassStats(filtered);

    // Gom nhóm theo Khối chuẩn cho bảng chính thức
    const gradeGroupMap: Record<string, typeof summaries> = {};
    summaries.forEach((sum) => {
      const rep = sum.students[0];
      const gr = extractGrade(sum.className, rep?.khoi || rep?.grade);
      if (!gradeGroupMap[gr]) gradeGroupMap[gr] = [];
      gradeGroupMap[gr].push(sum);
    });

    const sortedGrades = Object.keys(gradeGroupMap)
      .filter((gr) => gradeGroupMap[gr] && gradeGroupMap[gr].length > 0)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    let runningTT = 1;
    const gradeGroups = sortedGrades.map((gr) => {
      const classesInGrade = gradeGroupMap[gr].sort((a, b) =>
        a.className.localeCompare(b.className, undefined, { numeric: true, sensitivity: 'base' })
      );

      const classesWithTT = classesInGrade.map((c) => ({
        ...c,
        tt: runningTT++,
      }));

      const allGradeStudents = classesInGrade.flatMap((c) => c.students);
      const gradeQualityStats = calculateQualityClassStats(allGradeStudents);

      return {
        grade: gr,
        classes: classesWithTT,
        gradeQualityStats,
      };
    });

    return {
      summaries,
      totalStats,
      totalQualityStats,
      totalCount: filtered.length,
      gradeGroups,
    };
  }, [students, selectedSubject, gradeFilter]);

  // Xuất file Excel đúng tên chuẩn mẫu Sở GD&ĐT đồng bộ đợt điểm
  const handleExportExcel = () => {
    exportQualityBySubjectExcelFile(students, config, selectedSubject, globalFilter);
  };

  return (
    <div className="space-y-5">
      {/* Bộ lọc Môn & Khối */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Thống Kê Chất Lượng Theo Môn
            </h3>
            <p className="text-xs text-slate-500">
              Đánh giá kết quả môn <span className="font-semibold text-indigo-700">{selectedSubject === 'ALL' ? 'Tất cả các môn' : selectedSubject}</span> đối với từng lớp học
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
            <span>Chọn Môn:</span>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold rounded-lg focus:outline-none"
            >
              <option value="ALL">-- Tất cả các môn --</option>
              {uniqueSubjects.map((subj) => (
                <option key={subj} value={subj}>
                  Môn {subj}
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
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất ThongKeChatLuong_Theo môn.xlsx</span>
          </button>
        </div>
      </div>

      {/* 4 Thẻ chỉ số tổng hợp */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Số lớp tham gia</span>
            <School className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{dataReport.summaries.length} Lớp</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Tổng số bài kiểm tra: <strong>{dataReport.totalStats.total}</strong>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Điểm TB toàn môn</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{dataReport.totalStats.average}</div>
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
            {(dataReport.totalStats.totPercent + dataReport.totalStats.khaPercent).toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {dataReport.totalStats.totCount + dataReport.totalStats.khaCount} học sinh đạt loại Khá & Tốt
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Tỷ lệ Chưa đạt</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-600">{dataReport.totalStats.chuaDatPercent}%</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {dataReport.totalStats.chuaDatCount} bài thi cần bồi dưỡng thêm
          </div>
        </div>
      </div>

      {/* Biểu đồ so sánh giữa các lớp */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <h4 className="font-bold text-slate-900 text-xs mb-1">
            Điểm trung bình theo từng Lớp ({selectedSubject === 'ALL' ? 'Tất cả môn' : `Môn ${selectedSubject}`})
          </h4>
          <p className="text-[11px] text-slate-500 mb-4">So sánh chất lượng học tập giữa các lớp trên thang 10.0</p>
          <div className="h-60">
            <Bar
              data={{
                labels: dataReport.summaries.map((s) => s.className),
                datasets: [
                  {
                    label: 'Điểm trung bình',
                    data: dataReport.summaries.map((s) => s.stats.average),
                    backgroundColor: '#4f46e5',
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
            Cơ cấu Xếp loại theo từng Lớp ({selectedSubject === 'ALL' ? 'Tất cả môn' : `Môn ${selectedSubject}`})
          </h4>
          <p className="text-[11px] text-slate-500 mb-4">Số lượng học sinh theo các mức xếp loại</p>
          <div className="h-60">
            <Bar
              data={{
                labels: dataReport.summaries.map((s) => s.className),
                datasets: [
                  {
                    label: `Tốt (≥${config.thresholds.totMin})`,
                    data: dataReport.summaries.map((s) => s.stats.totCount),
                    backgroundColor: '#10b981',
                    borderRadius: 4,
                  },
                  {
                    label: `Khá (${config.thresholds.khaMin}-${config.thresholds.totMin - 0.1})`,
                    data: dataReport.summaries.map((s) => s.stats.khaCount),
                    backgroundColor: '#3b82f6',
                    borderRadius: 4,
                  },
                  {
                    label: `Đạt (${config.thresholds.datMin}-${config.thresholds.khaMin - 0.1})`,
                    data: dataReport.summaries.map((s) => s.stats.datCount),
                    backgroundColor: '#f59e0b',
                    borderRadius: 4,
                  },
                  {
                    label: `Chưa đạt (<${config.thresholds.datMin})`,
                    data: dataReport.summaries.map((s) => s.stats.chuaDatCount),
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

      {/* Bảng số liệu chi tiết */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">
              Bảng Thống Kê Chất Lượng Theo Môn ({selectedSubject === 'ALL' ? 'Tất cả các môn' : selectedSubject})
            </h4>
            <p className="text-xs text-slate-500">
              {viewLayout === 'official'
                ? 'Đang hiển thị chuẩn theo mẫu Sở GD&ĐT phân theo Khối và dòng Tổng khối'
                : 'Đang hiển thị bảng mở rộng với độ lệch chuẩn và điểm cao/thấp'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex p-1 bg-slate-200/70 rounded-xl text-xs font-semibold text-slate-700">
              <button
                onClick={() => setViewLayout('official')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  viewLayout === 'official'
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mẫu chuẩn Sở GD&ĐT (Phân Khối)
              </button>
              <button
                onClick={() => setViewLayout('extended')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  viewLayout === 'extended'
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bảng phân tích mở rộng
              </button>
            </div>

            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              title="Xuất file Excel đúng mẫu hình ảnh với đầy đủ các sheet theo môn"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải file Excel chuẩn</span>
            </button>
          </div>
        </div>

        {viewLayout === 'official' ? (
          /* BẢNG CHUẨN THEO MẪU SỞ GD&ĐT TRONG ẢNH */
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

              {/* Tiêu đề bảng */}
              <div className="text-center my-4">
                <h3 className="font-extrabold text-slate-900 text-base uppercase tracking-wide">
                  {config.examName || 'KIỂM TRA GIỮA HỌC KỲ II'} - NĂM HỌC {config.academicYear || '2025 - 2026'}
                </h3>
                <h4 className="font-bold text-indigo-800 text-sm uppercase mt-1">
                  THỐNG KÊ CHẤT LƯỢNG THEO MÔN HỌC
                </h4>
                <div className="font-bold text-slate-700 text-xs mt-1.5">
                  Môn: <span className="text-indigo-900 underline">{selectedSubject === 'ALL' ? 'Toán (Mẫu minh họa)' : selectedSubject}</span>
                </div>
              </div>

              {/* Bảng 2 tầng header */}
              <table className="w-full text-xs text-left border-collapse border border-slate-800">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800 text-center">
                    <th rowSpan={2} className="border border-slate-800 py-2 px-2 w-10">TT</th>
                    <th rowSpan={2} className="border border-slate-800 py-2 px-3 w-28">Lớp</th>
                    <th rowSpan={2} className="border border-slate-800 py-2 px-2.5 w-20 leading-tight">
                      SL HS<br />dự KT
                    </th>
                    <th colSpan={2} className="border border-slate-800 py-1.5 px-2 bg-rose-50/70 text-rose-950 leading-tight">
                      Chưa đạt<br /><span className="font-normal text-[11px]">(điểm &lt; 5)</span>
                    </th>
                    <th colSpan={2} className="border border-slate-800 py-1.5 px-2 bg-amber-50/70 text-amber-950 leading-tight">
                      Đạt<br /><span className="font-normal text-[11px]">(5 &lt;= điểm &lt; 6.5)</span>
                    </th>
                    <th colSpan={2} className="border border-slate-800 py-1.5 px-2 bg-blue-50/70 text-blue-950 leading-tight">
                      Khá<br /><span className="font-normal text-[11px]">(6.5 &lt;= điểm &lt; 8)</span>
                    </th>
                    <th colSpan={2} className="border border-slate-800 py-1.5 px-2 bg-emerald-50/70 text-emerald-950 leading-tight">
                      Tốt<br /><span className="font-normal text-[11px]">(điểm &gt;= 8)</span>
                    </th>
                    <th rowSpan={2} className="border border-slate-800 py-2 px-2.5 w-24">Điểm TB lớp</th>
                  </tr>
                  <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800 text-center">
                    <th className="border border-slate-800 py-1 px-1.5 w-12 bg-rose-50/40">SL</th>
                    <th className="border border-slate-800 py-1 px-1.5 w-14 bg-rose-50/40">TL</th>
                    <th className="border border-slate-800 py-1 px-1.5 w-12 bg-amber-50/40">SL</th>
                    <th className="border border-slate-800 py-1 px-1.5 w-14 bg-amber-50/40">TL</th>
                    <th className="border border-slate-800 py-1 px-1.5 w-12 bg-blue-50/40">SL</th>
                    <th className="border border-slate-800 py-1 px-1.5 w-14 bg-blue-50/40">TL</th>
                    <th className="border border-slate-800 py-1 px-1.5 w-12 bg-emerald-50/40">SL</th>
                    <th className="border border-slate-800 py-1 px-1.5 w-14 bg-emerald-50/40">TL</th>
                  </tr>
                </thead>
                <tbody>
                  {dataReport.gradeGroups.map((group) => (
                    <React.Fragment key={group.grade}>
                      {/* Từng lớp trong khối */}
                      {group.classes.map((clsItem) => (
                        <tr key={clsItem.className} className="hover:bg-indigo-50/30 transition">
                          <td className="border border-slate-800 py-1.5 px-2 text-center text-slate-700 font-mono">
                            {clsItem.tt}
                          </td>
                          <td className="border border-slate-800 py-1.5 px-3 font-semibold text-slate-900">
                            {clsItem.className}
                          </td>
                          <td className="border border-slate-800 py-1.5 px-2 text-center font-medium">
                            {clsItem.qualityStats.slDuKt}
                          </td>
                          <td className="border border-slate-800 py-1.5 px-2 text-center text-rose-700 font-medium">
                            {clsItem.qualityStats.chuaDatSl}
                          </td>
                          <td className="border border-slate-800 py-1.5 px-2 text-center text-slate-700 font-mono">
                            {clsItem.qualityStats.chuaDatTl.toFixed(1)}%
                          </td>
                          <td className="border border-slate-800 py-1.5 px-2 text-center text-amber-700 font-medium">
                            {clsItem.qualityStats.datSl}
                          </td>
                          <td className="border border-slate-800 py-1.5 px-2 text-center text-slate-700 font-mono">
                            {clsItem.qualityStats.datTl.toFixed(1)}%
                          </td>
                          <td className="border border-slate-800 py-1.5 px-2 text-center text-blue-700 font-medium">
                            {clsItem.qualityStats.khaSl}
                          </td>
                          <td className="border border-slate-800 py-1.5 px-2 text-center text-slate-700 font-mono">
                            {clsItem.qualityStats.khaTl.toFixed(1)}%
                          </td>
                          <td className="border border-slate-800 py-1.5 px-2 text-center text-emerald-700 font-medium">
                            {clsItem.qualityStats.totSl}
                          </td>
                          <td className="border border-slate-800 py-1.5 px-2 text-center text-slate-700 font-mono">
                            {clsItem.qualityStats.totTl.toFixed(1)}%
                          </td>
                          <td className="border border-slate-800 py-1.5 px-2 text-center font-bold text-slate-900">
                            {clsItem.qualityStats.slDuKt > 0 ? clsItem.qualityStats.diemTb.toFixed(1) : ''}
                          </td>
                        </tr>
                      ))}

                      {/* Dòng Tổng khối */}
                      <tr className="bg-slate-100/90 font-bold text-slate-900 border-b-2 border-slate-800">
                        <td className="border border-slate-800 py-1.5 px-2 text-center"></td>
                        <td className="border border-slate-800 py-1.5 px-3 uppercase text-slate-900 font-extrabold tracking-wide">
                          TỔNG KHỐI {group.grade}
                        </td>
                        <td className="border border-slate-800 py-1.5 px-2 text-center font-extrabold">
                          {group.gradeQualityStats.slDuKt}
                        </td>
                        <td className="border border-slate-800 py-1.5 px-2 text-center text-rose-800 font-extrabold">
                          {group.gradeQualityStats.chuaDatSl}
                        </td>
                        <td className="border border-slate-800 py-1.5 px-2 text-center font-mono font-bold">
                          {group.gradeQualityStats.chuaDatTl.toFixed(1)}%
                        </td>
                        <td className="border border-slate-800 py-1.5 px-2 text-center text-amber-800 font-extrabold">
                          {group.gradeQualityStats.datSl}
                        </td>
                        <td className="border border-slate-800 py-1.5 px-2 text-center font-mono font-bold">
                          {group.gradeQualityStats.datTl.toFixed(1)}%
                        </td>
                        <td className="border border-slate-800 py-1.5 px-2 text-center text-blue-800 font-extrabold">
                          {group.gradeQualityStats.khaSl}
                        </td>
                        <td className="border border-slate-800 py-1.5 px-2 text-center font-mono font-bold">
                          {group.gradeQualityStats.khaTl.toFixed(1)}%
                        </td>
                        <td className="border border-slate-800 py-1.5 px-2 text-center text-emerald-800 font-extrabold">
                          {group.gradeQualityStats.totSl}
                        </td>
                        <td className="border border-slate-800 py-1.5 px-2 text-center font-mono font-bold">
                          {group.gradeQualityStats.totTl.toFixed(1)}%
                        </td>
                        <td className="border border-slate-800 py-1.5 px-2 text-center font-black text-indigo-950">
                          {group.gradeQualityStats.slDuKt > 0 ? group.gradeQualityStats.diemTb.toFixed(1) : ''}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}

                  {/* Dòng Tổng toàn trường */}
                  <tr className="bg-slate-200/90 font-black text-slate-900 border-t-2 border-slate-900 text-sm">
                    <td className="border border-slate-800 py-2 px-2 text-center"></td>
                    <td className="border border-slate-800 py-2 px-3 uppercase text-slate-950 tracking-wider font-black">
                      TỔNG TOÀN TRƯỜNG
                    </td>
                    <td className="border border-slate-800 py-2 px-2 text-center font-black text-slate-950">
                      {dataReport.totalQualityStats.slDuKt}
                    </td>
                    <td className="border border-slate-800 py-2 px-2 text-center text-rose-900 font-black">
                      {dataReport.totalQualityStats.chuaDatSl}
                    </td>
                    <td className="border border-slate-800 py-2 px-2 text-center font-mono font-black">
                      {dataReport.totalQualityStats.chuaDatTl.toFixed(1)}%
                    </td>
                    <td className="border border-slate-800 py-2 px-2 text-center text-amber-900 font-black">
                      {dataReport.totalQualityStats.datSl}
                    </td>
                    <td className="border border-slate-800 py-2 px-2 text-center font-mono font-black">
                      {dataReport.totalQualityStats.datTl.toFixed(1)}%
                    </td>
                    <td className="border border-slate-800 py-2 px-2 text-center text-blue-900 font-black">
                      {dataReport.totalQualityStats.khaSl}
                    </td>
                    <td className="border border-slate-800 py-2 px-2 text-center font-mono font-black">
                      {dataReport.totalQualityStats.khaTl.toFixed(1)}%
                    </td>
                    <td className="border border-slate-800 py-2 px-2 text-center text-emerald-900 font-black">
                      {dataReport.totalQualityStats.totSl}
                    </td>
                    <td className="border border-slate-800 py-2 px-2 text-center font-mono font-black">
                      {dataReport.totalQualityStats.totTl.toFixed(1)}%
                    </td>
                    <td className="border border-slate-800 py-2 px-2 text-center font-black text-indigo-950 text-base">
                      {dataReport.totalQualityStats.slDuKt > 0 ? dataReport.totalQualityStats.diemTb.toFixed(1) : ''}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Chân trang Người lập */}
              <div className="mt-8 pt-4 flex justify-between items-start">
                <div className="w-56 text-center">
                  <div className="font-extrabold uppercase text-xs text-slate-900">NGƯỜI LẬP</div>
                  <div className="h-16 flex items-center justify-center">
                    <span className="text-slate-300 italic text-xs">[Chữ ký]</span>
                  </div>
                  <div className="font-bold text-slate-900 text-sm">Võ Chiến</div>
                </div>

                <div className="text-right text-[11px] text-slate-400 self-end">
                  File Excel xuất ra có các tab môn học: <span className="font-semibold text-slate-600">Toán, Văn, Tiếng Anh, Sử, Tin, Vật lý, Hóa, Sinh, Địa, KTPL, CNCN, CNNN</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* BẢNG PHÂN TÍCH MỞ RỘNG (ĐỘ LỆCH CHUẨN, CAO/THẤP) */
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="py-3 px-3 text-center w-12">STT</th>
                  <th className="py-3 px-3">Lớp</th>
                  <th className="py-3 px-3 text-center">Sĩ số</th>
                  <th className="py-3 px-3 text-center">Điểm TB</th>
                  <th className="py-3 px-3 text-center">Độ lệch</th>
                  <th className="py-3 px-3 text-center">Cao / Thấp</th>
                  <th className="py-3 px-3 text-center bg-emerald-50/60 text-emerald-900">
                    Tốt (≥{config.thresholds.totMin})
                  </th>
                  <th className="py-3 px-3 text-center bg-blue-50/60 text-blue-900">
                    Khá ({config.thresholds.khaMin}-{config.thresholds.totMin - 0.1})
                  </th>
                  <th className="py-3 px-3 text-center bg-amber-50/60 text-amber-900">
                    Đạt ({config.thresholds.datMin}-{config.thresholds.khaMin - 0.1})
                  </th>
                  <th className="py-3 px-3 text-center bg-rose-50/60 text-rose-900">
                    Chưa đạt (&lt;{config.thresholds.datMin})
                  </th>
                  <th className="py-3 px-3 text-center">Khá - Tốt %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dataReport.summaries.map((item, idx) => (
                  <tr key={item.className} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-3 px-3 font-semibold text-slate-900">{item.className}</td>
                    <td className="py-3 px-3 text-center font-medium text-slate-700">
                      {item.stats.total}
                      {item.stats.absentCount > 0 && (
                        <span className="text-[10px] text-slate-400 block">({item.stats.absentCount} vắng)</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-700 text-sm">{item.stats.average}</td>
                    <td className="py-3 px-3 text-center text-slate-500 font-mono">±{item.stats.standardDeviation}</td>
                    <td className="py-3 px-3 text-center text-slate-600">
                      <span className="text-emerald-700 font-semibold">{item.stats.max}</span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className="text-rose-700 font-semibold">{item.stats.min}</span>
                    </td>
                    <td className="py-3 px-3 text-center bg-emerald-50/20">
                      <span className="font-bold text-emerald-700">{item.stats.totCount}</span>
                      <span className="text-[10px] text-emerald-600 block">({item.stats.totPercent}%)</span>
                    </td>
                    <td className="py-3 px-3 text-center bg-blue-50/20">
                      <span className="font-bold text-blue-700">{item.stats.khaCount}</span>
                      <span className="text-[10px] text-blue-600 block">({item.stats.khaPercent}%)</span>
                    </td>
                    <td className="py-3 px-3 text-center bg-amber-50/20">
                      <span className="font-bold text-amber-700">{item.stats.datCount}</span>
                      <span className="text-[10px] text-amber-600 block">({item.stats.datPercent}%)</span>
                    </td>
                    <td className="py-3 px-3 text-center bg-rose-50/20">
                      <span className="font-bold text-rose-700">{item.stats.chuaDatCount}</span>
                      <span className="text-[10px] text-rose-600 block">({item.stats.chuaDatPercent}%)</span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-800">
                      {(item.stats.totPercent + item.stats.khaPercent).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td className="py-3 px-3 text-center" colSpan={2}>
                    TỔNG CỘNG ({dataReport.summaries.length} Lớp)
                  </td>
                  <td className="py-3 px-3 text-center">{dataReport.totalStats.total}</td>
                  <td className="py-3 px-3 text-center text-emerald-700 text-sm">{dataReport.totalStats.average}</td>
                  <td className="py-3 px-3 text-center font-mono">±{dataReport.totalStats.standardDeviation}</td>
                  <td className="py-3 px-3 text-center">
                    <span className="text-emerald-700">{dataReport.totalStats.max}</span>
                    <span className="text-slate-400 mx-1">/</span>
                    <span className="text-rose-700">{dataReport.totalStats.min}</span>
                  </td>
                  <td className="py-3 px-3 text-center text-emerald-800">
                    {dataReport.totalStats.totCount} ({dataReport.totalStats.totPercent}%)
                  </td>
                  <td className="py-3 px-3 text-center text-blue-800">
                    {dataReport.totalStats.khaCount} ({dataReport.totalStats.khaPercent}%)
                  </td>
                  <td className="py-3 px-3 text-center text-amber-800">
                    {dataReport.totalStats.datCount} ({dataReport.totalStats.datPercent}%)
                  </td>
                  <td className="py-3 px-3 text-center text-rose-800">
                    {dataReport.totalStats.chuaDatCount} ({dataReport.totalStats.chuaDatPercent}%)
                  </td>
                  <td className="py-3 px-3 text-center">
                    {(dataReport.totalStats.totPercent + dataReport.totalStats.khaPercent).toFixed(1)}%
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
