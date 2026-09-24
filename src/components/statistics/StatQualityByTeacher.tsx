import React, { useState, useMemo, useEffect } from 'react';
import {
  UserCheck,
  TrendingUp,
  Award,
  AlertTriangle,
  Download,
  Users,
  BookOpen,
  FileSpreadsheet,
  BarChart3,
  Layers,
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
import { getReportHeaderInfo } from '../../utils/syncExamInfo';
import {
  exportQualityByTeacherExcelFile,
  calculateTeacherGroupedStats,
  getExamTitleForTeacherReport,
  TeacherSubjectStatGroup,
} from '../../utils/exportQualityByTeacherExcel';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface StatQualityByTeacherProps {
  students: StudentScore[];
  config: SystemConfig;
  globalFilter?: GlobalFilterState;
}

export const StatQualityByTeacher: React.FC<StatQualityByTeacherProps> = ({
  students,
  config,
  globalFilter,
}) => {
  const [selectedTeacher, setSelectedTeacher] = useState<string>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'excel_standard' | 'overview'>('excel_standard');
  const [activeTeacherTab, setActiveTeacherTab] = useState<string>('');

  // Danh sách giáo viên duy nhất
  const uniqueTeachers = useMemo(() => {
    const tchs = students
      .map((s) => (s.giaoVien || s.teacherName || '').trim())
      .filter((t): t is string => Boolean(t && t !== 'Chưa phân công'));
    return Array.from(new Set<string>(tchs)).sort((a: string, b: string) => a.localeCompare(b, 'vi'));
  }, [students]);

  // Danh sách môn học duy nhất
  const uniqueSubjects = useMemo(() => {
    const subs = students
      .map((s) => (s.monHoc || s.subject || '').trim())
      .filter((s): s is string => Boolean(s));
    return Array.from(new Set<string>(subs)).sort((a: string, b: string) => a.localeCompare(b, 'vi'));
  }, [students]);

  // Cập nhật activeTeacherTab khi danh sách giáo viên hoặc selectedTeacher thay đổi
  useEffect(() => {
    if (selectedTeacher !== 'ALL') {
      setActiveTeacherTab(selectedTeacher);
    } else if (!activeTeacherTab && uniqueTeachers.length > 0) {
      // Ưu tiên chọn Đào Thị Thanh Nga nếu có, hoặc GV đầu tiên
      const nga = uniqueTeachers.find((t) => t.includes('Nga'));
      setActiveTeacherTab(nga || uniqueTeachers[0]);
    }
  }, [selectedTeacher, uniqueTeachers, activeTeacherTab]);

  // Tính toán dữ liệu nhóm chi tiết theo từng Môn và từng Lớp cho Giáo viên đang chọn xem
  const currentTeacherGroupedData: TeacherSubjectStatGroup[] = useMemo(() => {
    const targetTeacher = selectedTeacher !== 'ALL' ? selectedTeacher : activeTeacherTab;
    if (!targetTeacher) return [];

    let filteredStudents = students;
    if (subjectFilter !== 'ALL') {
      filteredStudents = students.filter(
        (s) => (s.monHoc || s.subject || '').trim() === subjectFilter
      );
    }

    return calculateTeacherGroupedStats(targetTeacher, filteredStudents, config);
  }, [students, selectedTeacher, activeTeacherTab, subjectFilter, config]);

  // Thống kê phân tích tổng hợp theo Giáo viên
  const dataReport = useMemo(() => {
    const filtered = students.filter((s) => {
      const teacherName = (s.giaoVien || s.teacherName || 'Chưa phân công').trim();
      const matchTch = selectedTeacher === 'ALL' ? true : teacherName === selectedTeacher;
      const matchSub = subjectFilter === 'ALL' ? true : (s.monHoc || s.subject) === subjectFilter;
      return matchTch && matchSub;
    });

    const teacherMap: Record<string, StudentScore[]> = {};
    filtered.forEach((s) => {
      const tch = (s.giaoVien || s.teacherName || 'Chưa phân công').trim();
      if (!teacherMap[tch]) teacherMap[tch] = [];
      teacherMap[tch].push(s);
    });

    const teacherList = Object.keys(teacherMap).sort((a, b) => a.localeCompare(b, 'vi'));

    const summaries = teacherList.map((tch) => {
      const list = teacherMap[tch];
      const stats = calculateStats(list);

      const subjectsTaught = Array.from(
        new Set(list.map((s) => s.monHoc || s.subject).filter(Boolean))
      ).join(', ');
      const classesTaught = Array.from(
        new Set(list.map((s) => s.lop || s.class).filter(Boolean))
      )
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
        .join(', ');

      return {
        teacherName: tch,
        subjectsTaught: subjectsTaught || '—',
        classesTaught: classesTaught || '—',
        stats,
        students: list,
      };
    });

    const totalStats = calculateStats(filtered);

    return {
      summaries,
      totalStats,
      totalCount: filtered.length,
    };
  }, [students, selectedTeacher, subjectFilter]);

  // Xuất file Excel đúng tên: ThongKeChatLuong_Theo Giáo viên.xlsx
  // Chứa đầy đủ các Sheet của từng Giáo viên, đúng chuẩn định dạng như hình ảnh
  const handleExportExcelAll = () => {
    exportQualityByTeacherExcelFile(students, config, globalFilter);
  };

  const handleExportCurrentTeacher = () => {
    const teacherToExport = selectedTeacher !== 'ALL' ? selectedTeacher : activeTeacherTab;
    if (teacherToExport) {
      exportQualityByTeacherExcelFile(students, config, globalFilter, teacherToExport);
    }
  };

  const currentTeacherName = selectedTeacher !== 'ALL' ? selectedTeacher : activeTeacherTab;
  const examTitle = getExamTitleForTeacherReport(config, globalFilter);
  const schoolDept = ((config as any).departmentName || 'SỞ GD&ĐT QUẢNG NGÃI').toUpperCase();
  const schoolName = (config.schoolName || 'TRƯỜNG PTDTNT THPT SA THẦY').toUpperCase();
  const { datMin = 5.0, khaMin = 6.5, totMin = 8.0 } = config.thresholds || {};

  return (
    <div className="space-y-5">
      {/* Bộ lọc Giáo viên & Môn */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Thống Kê Chất Lượng Theo Giáo Viên
            </h3>
            <p className="text-xs text-slate-500">
              Đánh giá hiệu quả giảng dạy của{' '}
              <span className="font-semibold text-purple-700">
                {selectedTeacher === 'ALL'
                  ? `Tất cả Giáo viên (${uniqueTeachers.length} thầy/cô)`
                  : `GV ${selectedTeacher}`}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
            <span>Chọn Giáo viên:</span>
            <select
              value={selectedTeacher}
              onChange={(e) => {
                setSelectedTeacher(e.target.value);
                if (e.target.value !== 'ALL') {
                  setActiveTeacherTab(e.target.value);
                }
              }}
              className="px-3 py-1.5 bg-purple-50 border border-purple-200 text-purple-900 font-bold rounded-lg focus:outline-none"
            >
              <option value="ALL">-- Tất cả Giáo viên ({uniqueTeachers.length}) --</option>
              {uniqueTeachers.map((tch) => (
                <option key={tch} value={tch}>
                  GV {tch}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
            <span>Môn:</span>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none"
            >
              <option value="ALL">Tất cả môn</option>
              {uniqueSubjects.map((s) => (
                <option key={s} value={s}>
                  Môn {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportExcelAll}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              title="Xuất file Excel chứa đầy đủ các Sheet của từng Giáo viên, hiển thị đủ số lớp và số môn"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất ThongKeChatLuong_Theo Giáo viên.xlsx</span>
            </button>
            {selectedTeacher !== 'ALL' && (
              <button
                onClick={handleExportCurrentTeacher}
                className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                title={`Chỉ xuất riêng sheet cho GV ${selectedTeacher}`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Xuất riêng GV này</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chuyển đổi chế độ xem: Báo cáo chuẩn theo Giáo viên (giống file xuất Excel) vs Tổng hợp & Biểu đồ */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('excel_standard')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer ${
              viewMode === 'excel_standard'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Mẫu báo cáo chuẩn theo Giáo viên (Chuẩn Excel)</span>
          </button>
          <button
            onClick={() => setViewMode('overview')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer ${
              viewMode === 'overview'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Tổng hợp & Biểu đồ so sánh</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 hidden sm:block">
          {viewMode === 'excel_standard'
            ? 'Định dạng khớp 100% với file Excel mẫu có đầy đủ số môn & lớp'
            : 'Tổng hợp chỉ số toàn trường và so sánh tương quan giữa các GV'}
        </div>
      </div>

      {/* ===================== VIEW 1: BÁO CÁO CHUẨN THEO GIÁO VIÊN (ĐÚNG MẪU HÌNH ẢNH) ===================== */}
      {viewMode === 'excel_standard' && (
        <div className="space-y-4">
          {/* Thanh Tab chọn Giáo viên theo phong cách Tab Sheet Excel */}
          <div className="bg-slate-100/80 p-2 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-1.5 px-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                Danh sách Sheet Giáo viên ({uniqueTeachers.length} thầy/cô)
              </span>
              <span className="text-[11px] text-slate-400">
                Nhấp vào tên Giáo viên để xem trước báo cáo
              </span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {uniqueTeachers.map((tch) => {
                const isActive = tch === currentTeacherName;
                return (
                  <button
                    key={tch}
                    onClick={() => {
                      setActiveTeacherTab(tch);
                      if (selectedTeacher !== 'ALL') setSelectedTeacher(tch);
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-purple-50 hover:text-purple-700 border border-slate-200'
                    }`}
                  >
                    <span>{tch}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Khung tài liệu bảng biểu định dạng chuẩn như file Excel trong hình */}
          <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden font-sans">
            {/* Header văn bản hành chính theo đúng ảnh mẫu */}
            <div className="p-6 sm:p-8 bg-white border-b border-slate-200">
              <div className="max-w-4xl mx-auto space-y-4 text-center">
                <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-800 font-bold border-b border-slate-100 pb-3">
                  <div className="text-left space-y-0.5">
                    <div>{schoolDept}</div>
                    <div className="underline underline-offset-2">{schoolName}</div>
                  </div>
                  <div className="text-right text-slate-500 font-normal mt-2 sm:mt-0 text-[11px]">
                    Ngày in: {getReportHeaderInfo(config, globalFilter).currentDateStr}
                  </div>
                </div>

                <div className="pt-2 space-y-1">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 uppercase tracking-wide">
                    {examTitle}
                  </h2>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 uppercase">
                    THỐNG KÊ CHẤT LƯỢNG THEO GIÁO VIÊN
                  </h3>
                </div>

                <div className="text-left font-bold text-slate-900 text-sm pt-1">
                  Giáo viên: <span className="text-purple-900">{currentTeacherName}</span>
                </div>
              </div>
            </div>

            {/* Bảng dữ liệu đúng cấu trúc 2 tầng Header và phân nhóm Môn */}
            <div className="overflow-x-auto p-4 sm:p-6 bg-slate-50/50">
              {currentTeacherGroupedData.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Không tìm thấy bài chấm thi nào của giáo viên{' '}
                  <span className="font-semibold">{currentTeacherName}</span> với bộ lọc hiện tại.
                </div>
              ) : (
                <table className="w-full border-collapse border border-slate-400 bg-white text-xs">
                  {/* Tầng 1 & 2 Header */}
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 font-bold">
                      <th
                        rowSpan={2}
                        className="border border-slate-400 py-2.5 px-2 text-center w-12"
                      >
                        TT
                      </th>
                      <th
                        rowSpan={2}
                        className="border border-slate-400 py-2.5 px-3 text-center min-w-[80px]"
                      >
                        Lớp
                      </th>
                      <th
                        rowSpan={2}
                        className="border border-slate-400 py-2.5 px-2 text-center min-w-[90px]"
                      >
                        SL HS
                        <br />
                        dự KT
                      </th>
                      <th
                        colSpan={2}
                        className="border border-slate-400 py-2 px-2 text-center bg-rose-50/80"
                      >
                        Chưa đạt
                        <br />
                        <span className="font-normal text-[11px]">(điểm &lt; {datMin})</span>
                      </th>
                      <th
                        colSpan={2}
                        className="border border-slate-400 py-2 px-2 text-center bg-amber-50/80"
                      >
                        Đạt
                        <br />
                        <span className="font-normal text-[11px]">
                          ({datMin}&lt;= điểm &lt;{khaMin})
                        </span>
                      </th>
                      <th
                        colSpan={2}
                        className="border border-slate-400 py-2 px-2 text-center bg-blue-50/80"
                      >
                        Khá
                        <br />
                        <span className="font-normal text-[11px]">
                          ({khaMin}&lt;= điểm &lt;{totMin})
                        </span>
                      </th>
                      <th
                        colSpan={2}
                        className="border border-slate-400 py-2 px-2 text-center bg-emerald-50/80"
                      >
                        Tốt
                        <br />
                        <span className="font-normal text-[11px]">(điểm &gt;= {totMin})</span>
                      </th>
                      <th
                        rowSpan={2}
                        className="border border-slate-400 py-2.5 px-2 text-center min-w-[100px] bg-purple-50/60 text-purple-950 font-bold"
                      >
                        Điểm TB
                        <br />
                        môn của lớp
                      </th>
                    </tr>
                    <tr className="bg-slate-100 text-slate-800 font-semibold text-[11px]">
                      <th className="border border-slate-400 py-1.5 px-2 text-center w-12 bg-rose-50/50">
                        SL
                      </th>
                      <th className="border border-slate-400 py-1.5 px-2 text-center w-16 bg-rose-50/50">
                        TL
                      </th>
                      <th className="border border-slate-400 py-1.5 px-2 text-center w-12 bg-amber-50/50">
                        SL
                      </th>
                      <th className="border border-slate-400 py-1.5 px-2 text-center w-16 bg-amber-50/50">
                        TL
                      </th>
                      <th className="border border-slate-400 py-1.5 px-2 text-center w-12 bg-blue-50/50">
                        SL
                      </th>
                      <th className="border border-slate-400 py-1.5 px-2 text-center w-16 bg-blue-50/50">
                        TL
                      </th>
                      <th className="border border-slate-400 py-1.5 px-2 text-center w-12 bg-emerald-50/50">
                        SL
                      </th>
                      <th className="border border-slate-400 py-1.5 px-2 text-center w-16 bg-emerald-50/50">
                        TL
                      </th>
                    </tr>
                  </thead>

                  {/* Body: Nhóm theo từng môn và các lớp */}
                  <tbody>
                    {currentTeacherGroupedData.map((group) => (
                      <React.Fragment key={group.subjectName}>
                        {/* Dòng tiêu đề môn: ví dụ "Môn: CNNN", "Môn: Sinh" */}
                        <tr className="bg-slate-100/90 font-bold text-slate-900 border-t-2 border-slate-400">
                          <td
                            colSpan={12}
                            className="border border-slate-400 py-2 px-3 text-left font-bold text-purple-950 bg-slate-50"
                          >
                            Môn: {group.subjectName}
                          </td>
                        </tr>

                        {/* Các dòng lớp học dưới môn này */}
                        {group.classes.map((clsRow) => (
                          <tr
                            key={clsRow.lop}
                            className="hover:bg-purple-50/30 transition text-slate-800"
                          >
                            <td className="border border-slate-400 py-2 px-2 text-center font-medium">
                              {clsRow.tt}
                            </td>
                            <td className="border border-slate-400 py-2 px-3 text-center font-bold text-slate-900">
                              {clsRow.lop}
                            </td>
                            <td className="border border-slate-400 py-2 px-2 text-center font-semibold">
                              {clsRow.slDuKt}
                            </td>
                            <td className="border border-slate-400 py-2 px-2 text-center bg-rose-50/30">
                              {clsRow.chuaDatSL}
                            </td>
                            <td className="border border-slate-400 py-2 px-2 text-center bg-rose-50/30 font-medium">
                              {clsRow.chuaDatTL}
                            </td>
                            <td className="border border-slate-400 py-2 px-2 text-center bg-amber-50/30">
                              {clsRow.datSL}
                            </td>
                            <td className="border border-slate-400 py-2 px-2 text-center bg-amber-50/30 font-medium">
                              {clsRow.datTL}
                            </td>
                            <td className="border border-slate-400 py-2 px-2 text-center bg-blue-50/30">
                              {clsRow.khaSL}
                            </td>
                            <td className="border border-slate-400 py-2 px-2 text-center bg-blue-50/30 font-medium">
                              {clsRow.khaTL}
                            </td>
                            <td className="border border-slate-400 py-2 px-2 text-center bg-emerald-50/30">
                              {clsRow.totSL}
                            </td>
                            <td className="border border-slate-400 py-2 px-2 text-center bg-emerald-50/30 font-medium">
                              {clsRow.totTL}
                            </td>
                            <td className="border border-slate-400 py-2 px-2 text-center font-bold text-slate-900 bg-purple-50/30">
                              {clsRow.diemTb}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Chân trang thông tin bổ trợ */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
              <span>
                Hiển thị đầy đủ {currentTeacherGroupedData.length} môn học và các lớp do Giáo viên{' '}
                <strong className="text-purple-700">{currentTeacherName}</strong> phụ trách.
              </span>
              <button
                onClick={handleExportExcelAll}
                className="text-purple-600 hover:text-purple-700 font-semibold underline flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải trọn bộ file Excel đa Sheet</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== VIEW 2: TỔNG QUAN, CHỈ SỐ & BIỂU ĐỒ SO SÁNH ===================== */}
      {viewMode === 'overview' && (
        <div className="space-y-5">
          {/* 4 Thẻ chỉ số tổng hợp */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-medium">Số Giáo viên</span>
                <Users className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {dataReport.summaries.length} Thầy/Cô
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Tổng lượt bài chấm: <strong>{dataReport.totalStats.total}</strong>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-medium">Điểm TB học sinh</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-emerald-600">
                {dataReport.totalStats.average}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Cao nhất: <strong>{dataReport.totalStats.max}</strong> | Thấp nhất:{' '}
                <strong>{dataReport.totalStats.min}</strong>
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
                {dataReport.totalStats.totCount + dataReport.totalStats.khaCount} học sinh đạt loại
                Khá & Tốt
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-medium">Tỷ lệ Chưa đạt</span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-bold text-rose-600">
                {dataReport.totalStats.chuaDatPercent}%
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {dataReport.totalStats.chuaDatCount} bài thi chưa đạt chuẩn
              </div>
            </div>
          </div>

          {/* Biểu đồ so sánh giữa các Giáo viên */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
              <h4 className="font-bold text-slate-900 text-xs mb-1">
                Điểm trung bình theo Giáo viên (
                {selectedTeacher === 'ALL' ? 'Tất cả GV' : `GV ${selectedTeacher}`})
              </h4>
              <p className="text-[11px] text-slate-500 mb-4">
                So sánh phổ điểm trung bình của các lớp do thầy/cô phụ trách
              </p>
              <div className="h-60">
                <Bar
                  data={{
                    labels: dataReport.summaries.map((s) => s.teacherName),
                    datasets: [
                      {
                        label: 'Điểm trung bình',
                        data: dataReport.summaries.map((s) => s.stats.average),
                        backgroundColor: '#9333ea',
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
                Cơ cấu Xếp loại học sinh theo Giáo viên
              </h4>
              <p className="text-[11px] text-slate-500 mb-4">
                Phân bố số lượng học sinh Tốt / Khá / Đạt / Chưa đạt
              </p>
              <div className="h-60">
                <Bar
                  data={{
                    labels: dataReport.summaries.map((s) => s.teacherName),
                    datasets: [
                      {
                        label: `Tốt (≥${totMin})`,
                        data: dataReport.summaries.map((s) => s.stats.totCount),
                        backgroundColor: '#10b981',
                        borderRadius: 4,
                      },
                      {
                        label: `Khá (${khaMin}-${totMin - 0.1})`,
                        data: dataReport.summaries.map((s) => s.stats.khaCount),
                        backgroundColor: '#3b82f6',
                        borderRadius: 4,
                      },
                      {
                        label: `Đạt (${datMin}-${khaMin - 0.1})`,
                        data: dataReport.summaries.map((s) => s.stats.datCount),
                        backgroundColor: '#f59e0b',
                        borderRadius: 4,
                      },
                      {
                        label: `Chưa đạt (<${datMin})`,
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

          {/* Bảng số liệu chi tiết toàn trường */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Bảng Tổng Hợp Chi Tiết Toàn Trường Theo Giáo Viên
                </h4>
                <p className="text-xs text-slate-500">
                  Tổng hợp chỉ số xếp loại và điểm số của từng thầy cô phụ trách
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <th className="py-3 px-3 text-center w-12">STT</th>
                    <th className="py-3 px-3">Giáo viên</th>
                    <th className="py-3 px-3">Môn giảng dạy</th>
                    <th className="py-3 px-3">Lớp phụ trách</th>
                    <th className="py-3 px-3 text-center">Sĩ số</th>
                    <th className="py-3 px-3 text-center">Điểm TB</th>
                    <th className="py-3 px-3 text-center">Độ lệch</th>
                    <th className="py-3 px-3 text-center bg-emerald-50/60 text-emerald-900">
                      Tốt (≥{totMin})
                    </th>
                    <th className="py-3 px-3 text-center bg-blue-50/60 text-blue-900">
                      Khá ({khaMin}-{totMin - 0.1})
                    </th>
                    <th className="py-3 px-3 text-center bg-amber-50/60 text-amber-900">
                      Đạt ({datMin}-{khaMin - 0.1})
                    </th>
                    <th className="py-3 px-3 text-center bg-rose-50/60 text-rose-900">
                      Chưa đạt (&lt;{datMin})
                    </th>
                    <th className="py-3 px-3 text-center">Khá - Tốt %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dataReport.summaries.map((item, idx) => (
                    <tr key={item.teacherName} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-3 font-semibold text-purple-950">
                        <button
                          onClick={() => {
                            setActiveTeacherTab(item.teacherName);
                            setViewMode('excel_standard');
                          }}
                          className="hover:underline text-left cursor-pointer"
                        >
                          {item.teacherName}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-medium">
                        {item.subjectsTaught}
                      </td>
                      <td
                        className="py-3 px-3 text-slate-600 max-w-xs truncate"
                        title={item.classesTaught}
                      >
                        {item.classesTaught}
                      </td>
                      <td className="py-3 px-3 text-center font-medium text-slate-700">
                        {item.stats.total}
                        {item.stats.absentCount > 0 && (
                          <span className="text-[10px] text-slate-400 block">
                            ({item.stats.absentCount} vắng)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-emerald-700 text-sm">
                        {item.stats.average}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-500 font-mono">
                        ±{item.stats.standardDeviation}
                      </td>
                      <td className="py-3 px-3 text-center bg-emerald-50/20">
                        <span className="font-bold text-emerald-700">{item.stats.totCount}</span>
                        <span className="text-[10px] text-emerald-600 block">
                          ({item.stats.totPercent}%)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center bg-blue-50/20">
                        <span className="font-bold text-blue-700">{item.stats.khaCount}</span>
                        <span className="text-[10px] text-blue-600 block">
                          ({item.stats.khaPercent}%)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center bg-amber-50/20">
                        <span className="font-bold text-amber-700">{item.stats.datCount}</span>
                        <span className="text-[10px] text-amber-600 block">
                          ({item.stats.datPercent}%)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center bg-rose-50/20">
                        <span className="font-bold text-rose-700">{item.stats.chuaDatCount}</span>
                        <span className="text-[10px] text-rose-600 block">
                          ({item.stats.chuaDatPercent}%)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-800">
                        {(item.stats.totPercent + item.stats.khaPercent).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                    <td className="py-3 px-3 text-center" colSpan={4}>
                      TỔNG CỘNG ({dataReport.summaries.length} Thầy/Cô)
                    </td>
                    <td className="py-3 px-3 text-center">{dataReport.totalStats.total}</td>
                    <td className="py-3 px-3 text-center text-emerald-700 text-sm">
                      {dataReport.totalStats.average}
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      ±{dataReport.totalStats.standardDeviation}
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
                      {(dataReport.totalStats.totPercent + dataReport.totalStats.khaPercent).toFixed(
                        1
                      )}
                      %
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
