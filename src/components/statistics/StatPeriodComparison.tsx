import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Layers,
  BookOpen,
  School,
  Award,
  AlertCircle,
  Download,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { StudentScore, SystemConfig, GlobalFilterState } from '../../types';
import { calculateStats } from '../../utils/scoreClassifier';
import { getReportHeaderInfo } from '../../utils/syncExamInfo';

interface StatPeriodComparisonProps {
  allStudents: StudentScore[];
  globalFilter: GlobalFilterState;
  config: SystemConfig;
  onOpenAiModal?: () => void;
}

interface PeriodSummary {
  key: string;
  semester: string;
  period: string;
  label: string;
  count: number;
  gradedCount: number;
  average: number;
  totPct: number;
  khaPct: number;
  datPct: number;
  chuaDatPct: number;
  passPct: number; // >= 5.0
}

interface StudentProgression {
  studentId: string;
  fullName: string;
  className: string;
  subject: string;
  ksScore: number | null;
  gki1Score: number | null;
  cki1Score: number | null;
  gki2Score: number | null;
  cki2Score: number | null;
  deltaHk1: number | null; // CKI1 - GKI1
  deltaFullYear: number | null; // CKI2 - GKI1
  trend: 'up' | 'down' | 'same' | 'na';
}

export const StatPeriodComparison: React.FC<StatPeriodComparisonProps> = ({
  allStudents,
  globalFilter,
  config,
  onOpenAiModal,
}) => {
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [comparisonMode, setComparisonMode] = useState<'hk1' | 'hk2' | 'year'>('year');

  const uniqueSubjects = useMemo(() => {
    return Array.from(new Set(allStudents.map((s) => s.monHoc || s.subject).filter(Boolean))).sort();
  }, [allStudents]);

  const uniqueClasses = useMemo(() => {
    return Array.from(new Set(allStudents.map((s) => s.lop || s.class).filter(Boolean))).sort();
  }, [allStudents]);

  const activeYear = globalFilter.academicYear === 'ALL' ? '2025-2026' : globalFilter.academicYear;

  // Filter students for the active year, subject, and class
  const baseStudents = useMemo(() => {
    return allStudents.filter((s) => {
      const matchYear = globalFilter.academicYear === 'ALL' || (s.academicYear || s.namHoc) === activeYear;
      const matchSub = selectedSubject === 'ALL' || (s.monHoc || s.subject) === selectedSubject;
      const matchCls = selectedClass === 'ALL' || (s.lop || s.class) === selectedClass;
      return matchYear && matchSub && matchCls;
    });
  }, [allStudents, activeYear, selectedSubject, selectedClass]);

  // Summaries of the key periods (KS đầu năm đứng trước HK1)
  const periodSummaries: PeriodSummary[] = useMemo(() => {
    const definitions = [
      { key: 'KS', sem: 'KS', per: 'KS', label: 'KS đầu năm' },
      { key: 'GKI-HK1', sem: 'HK1', per: 'GKI', label: 'Giữa HK1' },
      { key: 'CKI-HK1', sem: 'HK1', per: 'CKI', label: 'Cuối HK1' },
      { key: 'GKII', sem: 'HK2', per: 'GKII', label: 'GKII' },
      { key: 'CKII', sem: 'HK2', per: 'CKII', label: 'CKII' },
    ];

    return definitions.map((d) => {
      const list = baseStudents.filter((s) => {
        if (d.key === 'KS') {
          return (
            s.period === 'KS' ||
            s.semester === 'KS' ||
            s.dotDiem === 'KS' ||
            s.hocKy === 'KS' ||
            (s.dotDiem && s.dotDiem.toLowerCase().includes('khảo sát')) ||
            (s.dotDiem && s.dotDiem.toLowerCase().includes('đầu năm'))
          );
        }
        if (d.key === 'GKII') {
          return (
            (s.semester || s.hocKy) === 'HK2' &&
            ((s.period || s.dotDiem) === 'GKII' ||
              (s.period || s.dotDiem) === 'GKI' ||
              (s.period || s.dotDiem) === 'GKI-HK2' ||
              (s.period || s.dotDiem) === 'GK1')
          );
        }
        if (d.key === 'CKII') {
          return (
            (s.semester || s.hocKy) === 'HK2' &&
            ((s.period || s.dotDiem) === 'CKII' ||
              (s.period || s.dotDiem) === 'CKI' ||
              (s.period || s.dotDiem) === 'CKI-HK2' ||
              (s.period || s.dotDiem) === 'CK1')
          );
        }
        return (s.semester || s.hocKy) === d.sem && (s.period || s.dotDiem) === d.per;
      });
      const st = calculateStats(list);
      return {
        key: d.key,
        semester: d.sem,
        period: d.per,
        label: d.label,
        count: st.total,
        gradedCount: st.gradedCount,
        average: st.average,
        totPct: st.totPercent,
        khaPct: st.khaPercent,
        datPct: st.datPercent,
        chuaDatPct: st.chuaDatPercent,
        passPct: Number((st.totPercent + st.khaPercent + st.datPercent).toFixed(2)),
      };
    });
  }, [baseStudents]);

  // Calculate individual student progression
  const studentProgressions: StudentProgression[] = useMemo(() => {
    // Group by studentId + subject
    type StudentEntry = {
      name: string;
      cls: string;
      sub: string;
      scores: Record<string, number | null>;
    };
    const map = new Map<string, StudentEntry>();

    baseStudents.forEach((s) => {
      const sId = s.studentId || s.soBD;
      const sub = s.monHoc || s.subject;
      const key = `${sId}_${sub}`;
      const isKS =
        s.period === 'KS' ||
        s.semester === 'KS' ||
        s.dotDiem === 'KS' ||
        s.hocKy === 'KS' ||
        (s.dotDiem && s.dotDiem.toLowerCase().includes('khảo sát')) ||
        (s.dotDiem && s.dotDiem.toLowerCase().includes('đầu năm'));

      let periodKey = isKS ? 'KS' : `${s.period || s.dotDiem}-${s.semester || s.hocKy}`;
      const sem = s.semester || s.hocKy;
      const per = s.period || s.dotDiem;
      if (sem === 'HK2') {
        if (per === 'GKII' || per === 'GKI' || per === 'GKI-HK2' || per === 'GK1') periodKey = 'GKII';
        else if (per === 'CKII' || per === 'CKI' || per === 'CKI-HK2' || per === 'CK1') periodKey = 'CKII';
      } else if (sem === 'HK1') {
        if (per === 'GKI' || per === 'GKI-HK1') periodKey = 'GKI-HK1';
        else if (per === 'CKI' || per === 'CKI-HK1') periodKey = 'CKI-HK1';
      }

      if (!map.has(key)) {
        map.set(key, {
          name: s.fullName || s.hoTen,
          cls: s.class || s.lop,
          sub: sub,
          scores: {},
        });
      }
      const entry = map.get(key)!;
      entry.scores[periodKey] = s.score !== undefined ? s.score : (s.diem !== undefined ? s.diem : null);
    });

    const result: StudentProgression[] = [];
    map.forEach((data, key) => {
      const sId = key.split('_')[0];
      const ks = data.scores['KS'] ?? null;
      const gki1 = data.scores['GKI-HK1'] ?? null;
      const cki1 = data.scores['CKI-HK1'] ?? null;
      const gki2 = data.scores['GKII'] ?? data.scores['GKI-HK2'] ?? null;
      const cki2 = data.scores['CKII'] ?? data.scores['CKI-HK2'] ?? null;

      let deltaHk1: number | null = null;
      if (gki1 !== null && cki1 !== null) {
        deltaHk1 = Number((cki1 - gki1).toFixed(2));
      }

      let deltaFullYear: number | null = null;
      if (gki1 !== null && cki2 !== null) {
        deltaFullYear = Number((cki2 - gki1).toFixed(2));
      } else if (ks !== null && cki2 !== null) {
        deltaFullYear = Number((cki2 - ks).toFixed(2));
      } else if (gki1 !== null && cki1 !== null) {
        deltaFullYear = deltaHk1;
      }

      let trend: 'up' | 'down' | 'same' | 'na' = 'na';
      const activeDelta = comparisonMode === 'hk1' ? deltaHk1 : deltaFullYear;
      if (activeDelta !== null) {
        if (activeDelta > 0.2) trend = 'up';
        else if (activeDelta < -0.2) trend = 'down';
        else trend = 'same';
      }

      result.push({
        studentId: sId,
        fullName: data.name,
        className: data.cls,
        subject: data.sub,
        ksScore: ks,
        gki1Score: gki1,
        cki1Score: cki1,
        gki2Score: gki2,
        cki2Score: cki2,
        deltaHk1,
        deltaFullYear,
        trend,
      });
    });

    return result.sort((a, b) => {
      if (a.className !== b.className) return a.className.localeCompare(b.className, 'vi');
      return a.studentId.localeCompare(b.studentId, 'vi');
    });
  }, [baseStudents, comparisonMode]);

  // Aggregate progression stats
  const progressStats = useMemo(() => {
    let upCount = 0;
    let downCount = 0;
    let sameCount = 0;
    let validPairs = 0;
    let sumDelta = 0;

    studentProgressions.forEach((sp) => {
      const delta = comparisonMode === 'hk1' ? sp.deltaHk1 : sp.deltaFullYear;
      if (delta !== null) {
        validPairs++;
        sumDelta += delta;
        if (delta > 0.2) upCount++;
        else if (delta < -0.2) downCount++;
        else sameCount++;
      }
    });

    const avgDelta = validPairs > 0 ? Number((sumDelta / validPairs).toFixed(2)) : 0;
    const upPct = validPairs > 0 ? Number(((upCount / validPairs) * 100).toFixed(1)) : 0;
    const downPct = validPairs > 0 ? Number(((downCount / validPairs) * 100).toFixed(1)) : 0;

    return { upCount, downCount, sameCount, validPairs, avgDelta, upPct, downPct };
  }, [studentProgressions, comparisonMode]);

  // Export comparison table to Excel
  const handleExportComparisonExcel = () => {
    const wb = XLSX.utils.book_new();
    const headerInfo = getReportHeaderInfo(config, globalFilter);
    const printDate = headerInfo.currentDateStr;

    // Sheet 1: Tổng hợp 4 đợt
    const sumHeaders = [
      'Đợt đánh giá',
      'Học kỳ',
      'Sĩ số',
      'Đã chấm',
      'Điểm TB',
      'Đạt chuẩn (>=5.0) %',
      'Tốt (>=8.0) %',
      'Khá (6.5-7.9) %',
      'Đạt (5.0-6.4) %',
      'Chưa đạt (<5.0) %',
    ];
    const sumRows = periodSummaries.map((p) => [
      p.label,
      p.semester,
      p.count,
      p.gradedCount,
      p.average,
      `${p.passPct}%`,
      `${p.totPct}%`,
      `${p.khaPct}%`,
      `${p.datPct}%`,
      `${p.chuaDatPct}%`,
    ]);

    const titleRows1 = [
      ['', headerInfo.schoolName, '', '', '', '', `Ngày in: ${printDate}`],
      [`BÁO CÁO ĐỐI SÁNH TIẾN ĐỘ & CHẤT LƯỢNG CÁC ĐỢT ĐÁNH GIÁ - NĂM HỌC ${activeYear}`],
      [`Năm học: ${activeYear} | Đối sánh: KS đầu năm, GKI-HK1, CKI-HK1, GKII, CKII`],
      ['BẢNG TỔNG HỢP DIỄN BIẾN CHẤT LƯỢNG CÁC ĐỢT KIỂM TRA'],
      [],
    ];

    const ws1 = XLSX.utils.aoa_to_sheet([...titleRows1, sumHeaders, ...sumRows]);
    ws1['!merges'] = [
      { s: { r: 0, c: 1 }, e: { r: 0, c: 4 } },
      { s: { r: 0, c: 6 }, e: { r: 0, c: 9 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 9 } },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'TongHop_Cac_Dot');

    // Sheet 2: Chi tiết học sinh và tiến độ
    const progHeaders = [
      'Mã HS',
      'Họ và tên',
      'Lớp',
      'Môn học',
      'KS đầu năm',
      'GKI - HK1',
      'CKI - HK1',
      'GKII',
      'CKII',
      'Tiến độ HK1 (CKI1-GKI1)',
      'Tiến độ Cả năm',
      'Xu hướng',
    ];
    const progRows = studentProgressions.map((s) => [
      s.studentId,
      s.fullName,
      s.className,
      s.subject,
      s.ksScore ?? '',
      s.gki1Score ?? '',
      s.cki1Score ?? '',
      s.gki2Score ?? '',
      s.cki2Score ?? '',
      s.deltaHk1 !== null ? (s.deltaHk1 > 0 ? `+${s.deltaHk1}` : s.deltaHk1) : '',
      s.deltaFullYear !== null ? (s.deltaFullYear > 0 ? `+${s.deltaFullYear}` : s.deltaFullYear) : '',
      s.trend === 'up' ? 'Tiến bộ' : s.trend === 'down' ? 'Giảm sút' : s.trend === 'same' ? 'Ổn định' : 'N/A',
    ]);

    const titleRows2 = [
      ['', headerInfo.schoolName, '', '', '', '', `Ngày in: ${printDate}`],
      [`DANH SÁCH THEO DÕI TIẾN ĐỘ TỪNG HỌC SINH QUA CÁC ĐỢT - NĂM HỌC ${activeYear}`],
      [`Năm học: ${activeYear} | Đánh giá độ lệch và xu hướng học tập`],
      ['CHI TIẾT ĐIỂM SỐ VÀ TIẾN BỘ TỪNG HỌC SINH'],
      [],
    ];

    const ws2 = XLSX.utils.aoa_to_sheet([...titleRows2, progHeaders, ...progRows]);
    ws2['!merges'] = [
      { s: { r: 0, c: 1 }, e: { r: 0, c: 4 } },
      { s: { r: 0, c: 6 }, e: { r: 0, c: 10 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 10 } },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, 'TienDo_HocSinh');

    XLSX.writeFile(wb, `BaoCao_SoSanh_TienDo_CacDot_${activeYear}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Filter & Toolbar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <span>So Sánh Chất Lượng & Diễn Biến 4 Đợt Đánh Giá</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Phân tích đối sánh Giữa kỳ vs Cuối kỳ và diễn tiến học tập xuyên suốt năm học <strong>{activeYear}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportComparisonExcel}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition inline-flex items-center gap-1.5"
              title="Xuất bảng đối sánh và tiến độ học sinh ra file Excel"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Xuất Excel So sánh các đợt</span>
            </button>

            {onOpenAiModal && (
              <button
                onClick={onOpenAiModal}
                className="px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-lg shadow-xs shadow-indigo-200 transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Nhận xét tiến độ</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-filters within comparison tab */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>Môn học:</span>
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">Tất cả môn học ({uniqueSubjects.length} môn)</option>
              {uniqueSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  Môn {sub}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 text-blue-600" />
              <span>Lớp học:</span>
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">Tất cả các lớp ({uniqueClasses.length} lớp)</option>
              {uniqueClasses.map((cls) => (
                <option key={cls} value={cls}>
                  Lớp {cls}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span>Chế độ so sánh tiến độ:</span>
            </label>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setComparisonMode('hk1')}
                className={`flex-1 py-1 text-center font-semibold rounded-md transition ${
                  comparisonMode === 'hk1' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Giữa kỳ vs Cuối kỳ HK1
              </button>
              <button
                onClick={() => setComparisonMode('year')}
                className={`flex-1 py-1 text-center font-semibold rounded-md transition ${
                  comparisonMode === 'year' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cả năm (4 đợt)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Diễn biến các đợt (KS đầu năm, Giữa HK1, Cuối HK1, Giữa HK2, Cuối HK2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {periodSummaries.map((p, idx) => (
          <div
            key={p.key}
            className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-bold text-slate-700 uppercase tracking-wide">Đợt {idx + 1}</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                  {p.semester}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">{p.label}</h3>

              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-2xl font-black text-indigo-600">{p.average.toFixed(2)}</span>
                <span className="text-xs text-slate-500">Điểm TB ({p.gradedCount} HS)</span>
              </div>

              {/* Progress bars of ranks */}
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-700 font-medium">Tốt (&ge;8.0):</span>
                  <span className="font-bold text-emerald-800">{p.totPct}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-blue-700 font-medium">Khá (6.5-7.9):</span>
                  <span className="font-bold text-blue-800">{p.khaPct}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-amber-700 font-medium">Đạt (5.0-6.4):</span>
                  <span className="font-bold text-amber-800">{p.datPct}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-rose-700 font-medium">Chưa đạt (&lt;5.0):</span>
                  <span className="font-bold text-rose-800">{p.chuaDatPct}%</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Tỷ lệ trên TB:</span>
              <span className="font-bold text-emerald-600">{p.passPct}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Thẻ Thống Kê Tiến Bộ Học Sinh */}
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>
                Thống Kê Động Thái Tiến Bộ ({comparisonMode === 'hk1' ? 'Cuối kỳ vs Giữa kỳ HK1' : 'Toàn diện Cả năm'})
              </span>
            </h3>
            <p className="text-xs text-indigo-200 mt-0.5">
              Phân tích {progressStats.validPairs} cặp điểm học sinh được khảo sát liên tiếp
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <div className="text-emerald-400 text-xl sm:text-2xl font-black flex items-center justify-center gap-1">
              <TrendingUp className="w-5 h-5" />
              <span>+{progressStats.upCount}</span>
            </div>
            <div className="text-[11px] text-indigo-200 mt-1">Học sinh tăng điểm ({progressStats.upPct}%)</div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <div className="text-rose-400 text-xl sm:text-2xl font-black flex items-center justify-center gap-1">
              <TrendingDown className="w-5 h-5" />
              <span>-{progressStats.downCount}</span>
            </div>
            <div className="text-[11px] text-indigo-200 mt-1">Học sinh giảm điểm ({progressStats.downPct}%)</div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <div className="text-blue-300 text-xl sm:text-2xl font-black flex items-center justify-center gap-1">
              <Minus className="w-5 h-5" />
              <span>{progressStats.sameCount}</span>
            </div>
            <div className="text-[11px] text-indigo-200 mt-1">Giữ nguyên điểm số</div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <div className="text-amber-300 text-xl sm:text-2xl font-black">
              {progressStats.avgDelta > 0 ? `+${progressStats.avgDelta}` : progressStats.avgDelta}
            </div>
            <div className="text-[11px] text-indigo-200 mt-1">Biến động điểm TB</div>
          </div>
        </div>
      </div>

      {/* Bảng Chi Tiết Tiến Độ Từng Học Sinh */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-slate-800">
              Bảng Tiến Bộ Điểm Số Từng Học Sinh Qua Các Đợt
            </h3>
            <p className="text-xs text-slate-500">
              Hiển thị {studentProgressions.length} học sinh có dữ liệu trong phạm vi chọn
            </p>
          </div>
        </div>

        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
              <tr>
                <th className="py-2.5 px-3">Mã HS</th>
                <th className="py-2.5 px-3">Họ và tên</th>
                <th className="py-2.5 px-3 text-center">Lớp</th>
                <th className="py-2.5 px-3">Môn</th>
                <th className="py-2.5 px-3 text-center bg-amber-50 text-amber-900 border-x border-amber-200/50">KS đầu năm</th>
                <th className="py-2.5 px-3 text-center bg-indigo-50/50">GKI - HK1</th>
                <th className="py-2.5 px-3 text-center bg-indigo-50/50">CKI - HK1</th>
                <th className="py-2.5 px-3 text-center bg-purple-50/50">GKII</th>
                <th className="py-2.5 px-3 text-center bg-purple-50/50">CKII</th>
                <th className="py-2.5 px-3 text-center">Tiến độ</th>
                <th className="py-2.5 px-3 text-center">Đánh giá</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {studentProgressions.map((sp) => {
                const delta = comparisonMode === 'hk1' ? sp.deltaHk1 : sp.deltaFullYear;
                return (
                  <tr key={`${sp.studentId}_${sp.subject}`} className="hover:bg-slate-50/70 transition">
                    <td className="py-2 px-3 font-mono font-medium text-slate-500">{sp.studentId}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{sp.fullName}</td>
                    <td className="py-2 px-3 text-center font-medium">{sp.className}</td>
                    <td className="py-2 px-3">{sp.subject}</td>
                    <td className="py-2 px-3 text-center font-bold bg-amber-50/40 text-amber-900 border-x border-amber-100">
                      {sp.ksScore !== null ? sp.ksScore.toFixed(1) : '-'}
                    </td>
                    <td className="py-2 px-3 text-center font-bold bg-indigo-50/30">
                      {sp.gki1Score !== null ? sp.gki1Score.toFixed(1) : '-'}
                    </td>
                    <td className="py-2 px-3 text-center font-bold bg-indigo-50/30">
                      {sp.cki1Score !== null ? sp.cki1Score.toFixed(1) : '-'}
                    </td>
                    <td className="py-2 px-3 text-center font-bold bg-purple-50/30">
                      {sp.gki2Score !== null ? sp.gki2Score.toFixed(1) : '-'}
                    </td>
                    <td className="py-2 px-3 text-center font-bold bg-purple-50/30">
                      {sp.cki2Score !== null ? sp.cki2Score.toFixed(1) : '-'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {delta !== null ? (
                        <span
                          className={`font-bold inline-flex items-center gap-0.5 ${
                            delta > 0
                              ? 'text-emerald-600'
                              : delta < 0
                              ? 'text-rose-600'
                              : 'text-slate-500'
                          }`}
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {sp.trend === 'up' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <TrendingUp className="w-3 h-3" />
                          <span>Tiến bộ</span>
                        </span>
                      ) : sp.trend === 'down' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <TrendingDown className="w-3 h-3" />
                          <span>Giảm sút</span>
                        </span>
                      ) : sp.trend === 'same' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          <Minus className="w-3 h-3" />
                          <span>Ổn định</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">Chưa đủ đợt</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
