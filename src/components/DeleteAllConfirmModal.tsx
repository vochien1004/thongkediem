import React, { useState, useMemo } from 'react';
import { AlertTriangle, Trash2, X, RefreshCw, Database, CheckCircle2, ShieldAlert } from 'lucide-react';
import { StudentScore } from '../types';

interface DeleteAllConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: () => Promise<void>;
  students: StudentScore[];
  isDeleting: boolean;
  deleteProgress?: { current: number; total: number } | null;
  scopeTitle?: string;
  scopeSubtitle?: string;
  academicYear?: string;
  periodName?: string;
}

export const DeleteAllConfirmModal: React.FC<DeleteAllConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmDelete,
  students,
  isDeleting,
  deleteProgress,
  scopeTitle,
  scopeSubtitle,
  academicYear,
  periodName,
}) => {
  const [confirmCheckbox, setConfirmCheckbox] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Thống kê nhanh các môn và lớp sẽ bị xóa
  const stats = useMemo(() => {
    const subjects = Array.from(new Set(students.map((s) => s.subject || s.monHoc))).filter(Boolean);
    const classes = Array.from(new Set(students.map((s) => s.class || s.lop))).filter(Boolean);
    const teachers = Array.from(new Set(students.map((s) => s.teacherName || s.giaoVien))).filter(Boolean);
    return {
      total: students.length,
      subjects,
      classes,
      teachersCount: teachers.length,
    };
  }, [students]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!confirmCheckbox && stats.total > 0) {
      setErrorMsg('Vui lòng tích chọn xác nhận trước khi tiến hành xóa.');
      return;
    }
    setErrorMsg(null);
    try {
      await onConfirmDelete();
      setConfirmCheckbox(false);
    } catch (err: any) {
      setErrorMsg(`Lỗi trong quá trình xóa dữ liệu: ${err?.message || err}`);
    }
  };

  const isSpecificScope = !!(academicYear || periodName || scopeTitle);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl max-w-lg w-full border border-rose-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header cảnh báo */}
        <div className="bg-rose-50 border-b border-rose-100 p-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {scopeTitle || 'Xác nhận xóa toàn bộ dữ liệu'}
              </h3>
              <p className="text-xs text-rose-700 font-medium mt-0.5">
                {scopeSubtitle || 'Xóa đồng thời trên Cloud Firestore & bộ nhớ chương trình'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-white/60 transition disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nội dung chi tiết */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Badge thông tin đợt xóa */}
          {isSpecificScope && (
            <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700">Phạm vi xóa:</span>
              {periodName && (
                <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-bold border border-rose-200">
                  {periodName}
                </span>
              )}
              {academicYear && (
                <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 font-bold border border-indigo-200">
                  Năm học: {academicYear}
                </span>
              )}
            </div>
          )}

          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold text-amber-950">Lưu ý quan trọng:</strong>
              <p className="mt-0.5 leading-relaxed text-amber-800">
                Hành động này sẽ xóa <strong>hoàn toàn và vĩnh viễn</strong> các bản ghi thuộc phạm vi đã chọn khỏi cơ sở dữ liệu Cloud Firestore (Collection <code>student_scores</code>) và làm sạch trên chương trình. Sau khi xóa, bạn không thể hoàn tác nếu chưa có bản sao lưu.
              </p>
            </div>
          </div>

          {/* Khối tóm tắt dữ liệu bị xóa */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Dữ liệu sẽ bị xóa:
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs">
                <div className="text-lg font-extrabold text-rose-600">{stats.total}</div>
                <div className="text-[11px] text-slate-500 font-medium">Bản ghi điểm</div>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs">
                <div className="text-lg font-extrabold text-indigo-600">{stats.subjects.length}</div>
                <div className="text-[11px] text-slate-500 font-medium">Môn học</div>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs">
                <div className="text-lg font-extrabold text-slate-800">{stats.classes.length}</div>
                <div className="text-[11px] text-slate-500 font-medium">Lớp học</div>
              </div>
            </div>

            {stats.subjects.length > 0 && (
              <div className="text-[11px] text-slate-600">
                <span className="font-semibold text-slate-700">Các môn liên quan ({stats.subjects.length}): </span>
                <span className="text-slate-500">{stats.subjects.join(', ')}</span>
              </div>
            )}

            {stats.classes.length > 0 && (
              <div className="text-[11px] text-slate-600">
                <span className="font-semibold text-slate-700">Các lớp liên quan ({stats.classes.length}): </span>
                <span className="text-slate-500">{stats.classes.join(', ')}</span>
              </div>
            )}
          </div>

          {/* Thanh tiến trình khi đang xóa */}
          {isDeleting && (
            <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-rose-900">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600" />
                  Đang xóa khỏi Cloud Firestore & cập nhật chương trình...
                </span>
                {deleteProgress && (
                  <span>
                    {deleteProgress.current} / {deleteProgress.total}
                  </span>
                )}
              </div>
              <div className="w-full h-2 bg-rose-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-600 transition-all duration-300 rounded-full"
                  style={{
                    width: deleteProgress && deleteProgress.total > 0
                      ? `${Math.min(100, Math.round((deleteProgress.current / deleteProgress.total) * 100))}%`
                      : '100%',
                  }}
                />
              </div>
            </div>
          )}

          {/* Thông báo lỗi nếu có */}
          {errorMsg && (
            <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-rose-900 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Checkbox xác nhận */}
          {stats.total > 0 && !isDeleting && (
            <label className="flex items-start gap-2.5 cursor-pointer select-none p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition">
              <input
                type="checkbox"
                checked={confirmCheckbox}
                onChange={(e) => setConfirmCheckbox(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
              />
              <span className="text-xs text-slate-700 font-medium leading-relaxed">
                Tôi hiểu và xác nhận muốn xóa vĩnh viễn <strong>{stats.total} bản ghi</strong> {periodName ? `thuộc đợt "${periodName}"` : ''} {academicYear ? `(Năm học ${academicYear})` : ''} khỏi Firestore và hệ thống.
              </span>
            </label>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 shadow-2xs transition disabled:opacity-50 cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting || (stats.total > 0 && !confirmCheckbox)}
            className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-sm shadow-rose-200 transition inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isDeleting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Đang xóa...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xác nhận xóa ({stats.total})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
