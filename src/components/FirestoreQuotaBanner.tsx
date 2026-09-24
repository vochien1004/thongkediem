import React, { useState } from 'react';
import { AlertTriangle, ExternalLink, X, Database, CheckCircle, ShieldAlert } from 'lucide-react';
import { FirestoreQuotaInfo } from '../firebaseService';

interface FirestoreQuotaBannerProps {
  quotaInfo: FirestoreQuotaInfo;
}

export const FirestoreQuotaBanner: React.FC<FirestoreQuotaBannerProps> = ({ quotaInfo }) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  if (!quotaInfo.isExceeded || isDismissed) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-b border-amber-300 dark:border-amber-700/50 px-4 py-3 text-slate-800 dark:text-slate-200">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2 bg-amber-500 text-white rounded-lg shrink-0 mt-0.5 shadow-sm">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                Thông báo: Đã đạt hạn mức ghi miễn phí trong ngày của Cloud Firestore (20.000 lượt ghi/ngày)
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                <CheckCircle className="w-3 h-3" />
                Ứng dụng hoạt động 100% qua LocalStorage
              </span>
            </div>

            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
              Dữ liệu học sinh, điểm số, bảng phân tích ma trận và cấu hình vẫn được lưu trữ và tính toán an toàn tại bộ nhớ trình duyệt.
              Hạn mức Firestore của Google Cloud sẽ <strong>tự động làm mới (reset) vào ngày mai</strong>.
            </p>

            {showDetails && (
              <div className="mt-2 p-2.5 bg-white/80 dark:bg-slate-900/80 rounded-lg border border-amber-200 dark:border-amber-900/50 text-xs font-mono space-y-1 text-slate-700 dark:text-slate-300">
                <div><strong>Quota Metric:</strong> {quotaInfo.metricName || 'Free daily write units per project (free tier database)'}</div>
                <div><strong>Chi tiết lỗi:</strong> {quotaInfo.message || 'Resource Exhausted: Quota limit exceeded for daily writes.'}</div>
                <div className="text-slate-500">
                  Chi tiết về gói Spark (Free tier) và hạn mức Firestore có tại{' '}
                  <a
                    href="https://firebase.google.com/pricing#cloud-firestore"
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-indigo-600 hover:text-indigo-700"
                  >
                    Bảng giá Firebase
                  </a>.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-white transition"
          >
            {showDetails ? 'Ẩn chi tiết' : 'Chi tiết mã lỗi'}
          </button>

          <a
            href={quotaInfo.consoleUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Nâng cấp / Firebase Console</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            onClick={() => setIsDismissed(true)}
            title="Đóng thông báo"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-amber-200/50 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
