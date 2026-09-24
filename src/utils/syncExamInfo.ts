import { GlobalFilterState, SystemConfig } from '../types';

/**
 * Tự động tính toán và chuẩn hóa thông tin Đợt thi, Năm học, Học kỳ từ Bộ lọc toàn cục
 */
export function getExamDetailsFromGlobalFilter(filter: GlobalFilterState) {
  // 1. Chuẩn hóa Năm học (VD: "2025-2026" -> "2025 - 2026")
  let academicYear = filter.academicYear !== 'ALL' ? filter.academicYear : '2025 - 2026';
  if (/^\d{4}-\d{4}$/.test(academicYear)) {
    academicYear = academicYear.replace('-', ' - ');
  }

  // 2. Chuẩn hóa Học kỳ
  const isKS = filter.period === 'KS' || filter.semester === 'KS';
  let term = 'Học kỳ I';
  if (isKS) {
    term = 'Khảo sát đầu năm';
  } else if (filter.semester === 'HK2') {
    term = 'Học kỳ II';
  } else if (filter.semester === 'ALL') {
    term = 'Cả năm học';
  } else {
    term = 'Học kỳ I';
  }

  // 3. Chuẩn hóa Tên kỳ thi / Đợt kiểm tra theo yêu cầu:
  // - KS (Khảo sát đầu năm) => "Khảo sát đầu năm"
  // - GKI (Giữa HK1) => "Kiểm tra giữa học kỳ I (GKI)"
  // - CKI (Cuối HK1) => "Kiểm tra cuối học kỳ I (CKI)"
  // - GKII (Giữa HK2) => "Kiểm tra giữa học kỳ II (GKII)"
  // - CKII (Cuối HK2) => "Kiểm tra cuối học kỳ II (CKII)"
  let examName = 'Kiểm tra giữa học kỳ I (GKI)';
  const isHK1 = filter.semester === 'HK1';
  const isHK2 = filter.semester === 'HK2';
  const isGKII = filter.period === 'GKII' || (filter.period === 'GKI' && isHK2);
  const isCKII = filter.period === 'CKII' || (filter.period === 'CKI' && isHK2);
  const isGKI = (filter.period === 'GKI' && !isHK2);
  const isCKI = (filter.period === 'CKI' && !isHK2);

  if (isKS) {
    examName = 'Khảo sát đầu năm';
  } else if (isGKII) {
    examName = 'Kiểm tra giữa học kỳ II (GKII)';
  } else if (isCKII) {
    examName = 'Kiểm tra cuối học kỳ II (CKII)';
  } else if (isGKI && isHK1) {
    examName = 'Kiểm tra giữa học kỳ I (GKI)';
  } else if (isCKI && isHK1) {
    examName = 'Kiểm tra cuối học kỳ I (CKI)';
  } else if (isGKI && filter.semester === 'ALL') {
    examName = 'Kiểm tra giữa học kỳ I (GKI)';
  } else if (isCKI && filter.semester === 'ALL') {
    examName = 'Kiểm tra cuối học kỳ I (CKI)';
  } else if (filter.period === 'ALL') {
    if (isHK1) {
      examName = 'Khảo sát chất lượng Học kỳ I';
    } else if (isHK2) {
      examName = 'Khảo sát chất lượng Học kỳ II';
    } else {
      examName = 'Đánh giá chất lượng Cả năm học';
    }
  }

  // Mã định danh ngắn gọn dùng cho tên Sheet Excel (VD: KS_DauNam, GKI, CKI, GKII, CKII, CaNam)
  let periodCode = 'GKI';
  if (isKS) {
    periodCode = 'KS_DauNam';
  } else if (isGKII) {
    periodCode = 'GKII';
  } else if (isCKII) {
    periodCode = 'CKII';
  } else if (filter.period !== 'ALL' && filter.semester !== 'ALL') {
    periodCode = `${filter.period}_${filter.semester}`;
  } else if (filter.period !== 'ALL') {
    periodCode = filter.period;
  } else if (filter.semester !== 'ALL') {
    periodCode = filter.semester;
  } else {
    periodCode = 'CaNam';
  }

  // Tiêu đề báo cáo và nhãn chi tiết chuẩn hóa
  const fullReportTitle = `BÁO CÁO THỐNG KÊ KẾT QUẢ ${examName.toUpperCase()} - NĂM HỌC ${academicYear.toUpperCase()}`;
  const detailLabel = `Đợt đánh giá: ${examName} | Học kỳ: ${term} | Năm học: ${academicYear}`;

  return {
    academicYear,
    term,
    examName,
    periodCode,
    fullReportTitle,
    detailLabel,
  };
}

/**
 * Trả về thông tin đầy đủ cho Header file Excel từ SystemConfig và GlobalFilter
 */
export function getReportHeaderInfo(config: SystemConfig, filter?: GlobalFilterState) {
  const synced = filter
    ? getExamDetailsFromGlobalFilter(filter)
    : {
        academicYear: config.academicYear || '2025 - 2026',
        term: config.term || 'Học kỳ I',
        examName: config.examName || 'Kiểm tra giữa học kỳ I',
        periodCode: 'GKI_HK1',
        fullReportTitle: `BÁO CÁO THỐNG KÊ KẾT QUẢ ${(config.examName || 'KIỂM TRA GIỮA HỌC KỲ I').toUpperCase()} - NĂM HỌC ${(config.academicYear || '2025 - 2026').toUpperCase()}`,
        detailLabel: `Đợt đánh giá: ${config.examName || 'Kiểm tra giữa học kỳ I'} | Học kỳ: ${config.term || 'Học kỳ I'} | Năm học: ${config.academicYear || '2025 - 2026'}`,
      };

  const schoolName = (config.schoolName || 'TRƯỜNG PTDTNT THPT SA THẦY').toUpperCase();
  const schoolDept = 'SỞ GD&ĐT QUẢNG NGÃI';

  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const currentDateStr = `${day}/${month}/${year}`;

  return {
    schoolName,
    schoolDept,
    currentDateStr,
    ...synced,
  };
}

/**
 * Tự động đồng bộ các trường Năm học, Học kỳ, Tên kỳ thi trong SystemConfig khi GlobalFilter thay đổi
 */
export function syncExamInfoFromFilter(config: SystemConfig, filter: GlobalFilterState): SystemConfig {
  const details = getExamDetailsFromGlobalFilter(filter);
  return {
    ...config,
    academicYear: details.academicYear,
    term: details.term,
    examName: details.examName,
    reportTitle: `${details.examName} - Năm học ${details.academicYear}`,
  };
}
