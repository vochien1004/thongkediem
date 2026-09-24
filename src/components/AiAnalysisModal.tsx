import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  X,
  Copy,
  Check,
  Download,
  RotateCw,
  BookOpen,
  School,
  Calendar,
  Layers,
  AlertCircle,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { StudentScore, SystemConfig, GlobalFilterState } from '../types';
import { calculateStats } from '../utils/scoreClassifier';

interface AiAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  filteredStudents: StudentScore[];
  allStudents: StudentScore[];
  globalFilter: GlobalFilterState;
  config: SystemConfig;
}

export const AiAnalysisModal: React.FC<AiAnalysisModalProps> = ({
  isOpen,
  onClose,
  filteredStudents,
  allStudents,
  globalFilter,
  config,
}) => {
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [focusArea, setFocusArea] = useState<'comprehensive' | 'progress' | 'intervention'>('comprehensive');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available subjects and classes in current dataset
  const uniqueSubjects = useMemo(() => {
    return Array.from(new Set(allStudents.map((s) => s.monHoc || s.subject).filter(Boolean))).sort();
  }, [allStudents]);

  const uniqueClasses = useMemo(() => {
    return Array.from(new Set(allStudents.map((s) => s.lop || s.class).filter(Boolean))).sort();
  }, [allStudents]);

  // Determine effective period text for prompt
  const periodContextText = useMemo(() => {
    const yearStr = globalFilter.academicYear === 'ALL' ? 'Các năm học' : `năm học ${globalFilter.academicYear}`;
    if (globalFilter.semester === 'ALL') {
      return `Cả năm học (${yearStr})`;
    }
    const semName = globalFilter.semester === 'HK1' ? 'Học kỳ 1' : 'Học kỳ 2';
    if (globalFilter.period === 'ALL') {
      return `Toàn bộ ${semName} (${yearStr})`;
    }
    const perName = globalFilter.period === 'GKI' ? 'Giữa kỳ (GKI)' : 'Cuối kỳ (CKI)';
    return `đợt ${perName} - ${semName} ${yearStr}`;
  }, [globalFilter]);

  // Target subset of students for the AI prompt
  const targetSubset = useMemo(() => {
    return filteredStudents.filter((s) => {
      const sub = s.monHoc || s.subject;
      const cls = s.lop || s.class;
      if (selectedSubject !== 'ALL' && sub !== selectedSubject) return false;
      if (selectedClass !== 'ALL' && cls !== selectedClass) return false;
      return true;
    });
  }, [filteredStudents, selectedSubject, selectedClass]);

  // Calculate statistics for the target subset
  const subsetStats = useMemo(() => {
    return calculateStats(targetSubset);
  }, [targetSubset]);

  // Multi-period comparison data (if viewing whole semester or whole year)
  const multiPeriodBreakdown = useMemo(() => {
    const periodDefs = [
      { key: 'KS', label: 'KS đầu năm', match: (s: any) => s.period === 'KS' || s.semester === 'KS' || s.dotDiem === 'KS' || s.hocKy === 'KS' },
      { key: 'GKI-HK1', label: 'GKI - HK1', match: (s: any) => (s.semester || s.hocKy) === 'HK1' && (s.period || s.dotDiem) === 'GKI' },
      { key: 'CKI-HK1', label: 'CKI - HK1', match: (s: any) => (s.semester || s.hocKy) === 'HK1' && (s.period || s.dotDiem) === 'CKI' },
      { key: 'GKII', label: 'GKII (Giữa HK2)', match: (s: any) => (s.semester || s.hocKy) === 'HK2' && ((s.period || s.dotDiem) === 'GKII' || (s.period || s.dotDiem) === 'GKI') },
      { key: 'CKII', label: 'CKII (Cuối HK2)', match: (s: any) => (s.semester || s.hocKy) === 'HK2' && ((s.period || s.dotDiem) === 'CKII' || (s.period || s.dotDiem) === 'CKI') },
    ];
    return periodDefs.map((p) => {
      const list = allStudents.filter((s) => {
        const matchYear = globalFilter.academicYear === 'ALL' || (s.academicYear || s.namHoc) === globalFilter.academicYear;
        const matchSub = selectedSubject === 'ALL' || (s.monHoc || s.subject) === selectedSubject;
        const matchCls = selectedClass === 'ALL' || (s.lop || s.class) === selectedClass;
        return matchYear && p.match(s) && matchSub && matchCls;
      });
      const st = calculateStats(list);
      return {
        key: p.key,
        label: p.label,
        count: st.total,
        avg: st.average,
        totPct: st.totPercent,
        khaPct: st.khaPercent,
        datPct: st.datPercent,
        chuaDatPct: st.chuaDatPercent,
      };
    }).filter((item) => item.count > 0);
  }, [allStudents, globalFilter.academicYear, selectedSubject, selectedClass]);

  // Construct context-rich AI prompt
  const generatedPrompt = useMemo(() => {
    const subLabel = selectedSubject === 'ALL' ? 'Toàn bộ các môn' : `môn ${selectedSubject}`;
    const clsLabel = selectedClass === 'ALL' ? 'Toàn bộ các lớp' : `lớp ${selectedClass}`;
    const school = config.schoolName || 'Trường học';

    let prompt = `Bạn là một chuyên gia đánh giá chất lượng giáo dục và cố vấn khảo thí sư phạm của trường ${school}.\n`;
    prompt += `Hãy viết bài nhận xét, đánh giá chuyên sâu và kiến nghị sư phạm cho tình hình học tập ${subLabel}, ${clsLabel}, thời điểm: [${periodContextText}].\n\n`;

    prompt += `=== SỐ LIỆU KHẢO SÁT HIỆN TẠI ===\n`;
    prompt += `- Tổng số lượt bài thi / học sinh: ${subsetStats.total}\n`;
    prompt += `- Số lượng có điểm: ${subsetStats.gradedCount} (Vắng thi: ${subsetStats.absentCount})\n`;
    prompt += `- Điểm trung bình: ${subsetStats.average} / 10\n`;
    prompt += `- Điểm cao nhất: ${subsetStats.max}, Thấp nhất: ${subsetStats.min}, Độ lệch chuẩn: ${subsetStats.standardDeviation}\n`;
    prompt += `- Xếp loại Tốt (>=8.0): ${subsetStats.totCount} HS (${subsetStats.totPercent}%)\n`;
    prompt += `- Xếp loại Khá (6.5-7.9): ${subsetStats.khaCount} HS (${subsetStats.khaPercent}%)\n`;
    prompt += `- Xếp loại Đạt (5.0-6.4): ${subsetStats.datCount} HS (${subsetStats.datPercent}%)\n`;
    prompt += `- Xếp loại Chưa đạt (<5.0): ${subsetStats.chuaDatCount} HS (${subsetStats.chuaDatPercent}%)\n\n`;

    if (multiPeriodBreakdown.length > 1) {
      prompt += `=== DIỄN BIẾN QUA CÁC ĐỢT ĐÁNH GIÁ (TIẾN BỘ / BIẾN ĐỘNG) ===\n`;
      multiPeriodBreakdown.forEach((item) => {
        prompt += `- Đợt [${item.label}]: Sĩ số: ${item.count} | Điểm TB: ${item.avg} | Tốt: ${item.totPct}% | Khá: ${item.khaPct}% | Đạt: ${item.datPct}% | Chưa đạt: ${item.chuaDatPct}%\n`;
      });
      prompt += `Yêu cầu phân tích thêm: Đánh giá xu hướng tiến bộ hoặc giảm sút giữa các đợt (Giữa kỳ vs Cuối kỳ, hoặc HK1 vs HK2), phát hiện nguyên nhân tiềm ẩn và hiệu quả của các giải pháp can thiệp dạy học.\n\n`;
    }

    if (focusArea === 'intervention') {
      prompt += `=== TRỌNG TÂM YÊU CẦU ===\n`;
      prompt += `Tập trung sâu vào nhóm học sinh Chưa đạt (${subsetStats.chuaDatCount} HS), chỉ ra các phương pháp phụ đạo bồi dưỡng cụ thể, phân nhóm học sinh theo mức thiếu hụt kiến thức và lập kế hoạch can thiệp 4 tuần.\n`;
    } else if (focusArea === 'progress') {
      prompt += `=== TRỌNG TÂM YÊU CẦU ===\n`;
      prompt += `Tập trung phân tích động thái tiến bộ, so sánh các mốc điểm, tỷ lệ bứt phá từ Khá lên Tốt và các cảnh báo nguy cơ trượt dốc.\n`;
    } else {
      prompt += `=== YÊU CẦU BỐ CỤC BÀI ĐÁNH GIÁ ===\n`;
      prompt += `1. TỔNG QUAN CHẤT LƯỢNG: Đánh giá khái quát mức độ hoàn thành mục tiêu dạy học theo thang chuẩn GDPT.\n`;
      prompt += `2. ĐIỂM SÁNG NỔI BẬT: Các thành tựu tích cực về phổ điểm và tỷ lệ khá giỏi.\n`;
      prompt += `3. VẤN ĐỀ CẦN LƯU Ý & CẢNH BÁO: Tỷ lệ chưa đạt, điểm số thấp cục bộ, các điểm nghẽn kiến thức.\n`;
      if (multiPeriodBreakdown.length > 1) {
        prompt += `4. XU HƯỚNG PHÁT TRIỂN QUA CÁC ĐỢT: So sánh tiến bộ giữa các đợt khảo sát.\n`;
      }
      prompt += `5. ĐỀ XUẤT HÀNH ĐỘNG CỤ THỂ: Dành cho Ban giám hiệu, Tổ bộ môn, Giáo viên trực tiếp giảng dạy và gia đình học sinh.\n`;
    }

    prompt += `Hãy trình bày với phong cách sư phạm chuẩn mực, mạch lạc, tôn trọng, giàu tính khích lệ và tính hành động thực tiễn cao.`;
    return prompt;
  }, [selectedSubject, selectedClass, periodContextText, subsetStats, multiPeriodBreakdown, focusArea, config.schoolName]);

  const handleGenerateAi = async () => {
    if (subsetStats.total === 0) {
      setErrorMessage('Không có dữ liệu học sinh trong phạm vi đã chọn để phân tích.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: generatedPrompt,
          systemInstruction:
            'Bạn là Cố vấn Khảo thí & Chuyên gia Phân tích Dữ liệu Giáo dục hàng đầu. Bạn viết các bản nhận xét học tập và báo cáo sư phạm chuyên sâu, chính xác, khách quan và giàu tính xây dựng.',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Lỗi khi gọi API Gemini.');
      }

      setAiResponse(data.text);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Đã xảy ra lỗi khi kết nối tới dịch vụ AI.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!aiResponse) return;
    navigator.clipboard.writeText(aiResponse);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!aiResponse) return;
    const blob = new Blob([aiResponse], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Nhan_xet_AI_${selectedSubject}_${selectedClass}_${globalFilter.period}_${globalFilter.semester}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <span>Nhận Xét & Đánh Giá Sư Phạm Bằng AI</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/40 font-mono">
                  Gemini 3.7 Flash
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                Tự động tổng hợp số liệu theo đợt điểm, học kỳ và năm học để tạo nhận xét chất lượng cao
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Controls Bar */}
          <div className="bg-slate-50 rounded-xl p-3 sm:p-4 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Subject Selector */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>Môn học phân tích:</span>
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">Tất cả các môn học ({uniqueSubjects.length} môn)</option>
                {uniqueSubjects.map((sub) => (
                  <option key={sub} value={sub}>
                    Môn {sub}
                  </option>
                ))}
              </select>
            </div>

            {/* Class Selector */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <School className="w-3.5 h-3.5 text-blue-600" />
                <span>Lớp học:</span>
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">Tất cả các lớp ({uniqueClasses.length} lớp)</option>
                {uniqueClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    Lớp {cls}
                  </option>
                ))}
              </select>
            </div>

            {/* Focus Area */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                <span>Góc nhìn đánh giá:</span>
              </label>
              <select
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
              >
                <option value="comprehensive">Toàn diện (Tổng quan, Điểm sáng, Hạn chế, Giải pháp)</option>
                <option value="progress">Phân tích xu hướng tiến bộ qua các đợt</option>
                <option value="intervention">Kế hoạch can thiệp & phụ đạo học sinh yếu</option>
              </select>
            </div>
          </div>

          {/* Active Context Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-900">
            <div className="flex items-center gap-2">
              <span className="font-bold">Ngữ cảnh đánh giá:</span>
              <span className="px-2 py-0.5 rounded-md bg-indigo-200/70 text-indigo-800 font-medium">
                {periodContextText}
              </span>
              <span>•</span>
              <span>
                Phạm vi: <strong>{subsetStats.total}</strong> học sinh | Điểm TB: <strong>{subsetStats.average}</strong>
              </span>
            </div>

            {multiPeriodBreakdown.length > 1 && (
              <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Có dữ liệu so sánh {multiPeriodBreakdown.length} đợt
              </span>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* AI Result Box */}
          {aiResponse ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span>Bản nhận xét & Báo cáo từ Gemini AI:</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải file .txt</span>
                  </button>
                  <button
                    onClick={handleGenerateAi}
                    disabled={isLoading}
                    className="px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>Tạo lại</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 text-slate-100 p-5 rounded-xl text-xs sm:text-sm font-sans leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto border border-slate-800 shadow-inner">
                {aiResponse}
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 mx-auto flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm text-slate-800">
                Sẵn sàng tạo bản nhận xét sư phạm tự động
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Hệ thống sẽ tổng hợp số liệu thực tế của <strong>{subsetStats.total}</strong> học sinh trong ngữ cảnh{' '}
                <strong>{periodContextText}</strong> để Gemini phân tích và đưa ra giải pháp sư phạm chuẩn xác.
              </p>
              <button
                onClick={handleGenerateAi}
                disabled={isLoading || subsetStats.total === 0}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-indigo-200 transition inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Đang phân tích dữ liệu và viết nhận xét...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Bắt đầu Tạo Nhận Xét AI</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div>
            Đang phân tích: <strong>{selectedSubject === 'ALL' ? 'Mọi môn' : selectedSubject}</strong> •{' '}
            <strong>{selectedClass === 'ALL' ? 'Mọi lớp' : selectedClass}</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
