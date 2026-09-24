import { ScoreClassification, ScoreThresholds, StudentScore, SummaryStats } from '../types';

export const DEFAULT_THRESHOLDS: ScoreThresholds = {
  totMin: 8.0,
  khaMin: 6.5,
  datMin: 5.0,
};

export function classifyScore(
  diem: number | null | undefined,
  thresholds: ScoreThresholds = DEFAULT_THRESHOLDS
): ScoreClassification {
  if (diem === null || diem === undefined || isNaN(diem)) {
    return 'Vắng/Thiếu điểm';
  }
  if (diem >= thresholds.totMin) {
    return 'Tốt';
  }
  if (diem >= thresholds.khaMin) {
    return 'Khá';
  }
  if (diem >= thresholds.datMin) {
    return 'Đạt';
  }
  return 'Chưa đạt';
}

export function calculateStats(students: StudentScore[]): SummaryStats {
  const total = students.length;
  if (total === 0) {
    return {
      total: 0,
      gradedCount: 0,
      absentCount: 0,
      average: 0,
      max: 0,
      min: 0,
      median: 0,
      standardDeviation: 0,
      totCount: 0,
      totPercent: 0,
      khaCount: 0,
      khaPercent: 0,
      datCount: 0,
      datPercent: 0,
      chuaDatCount: 0,
      chuaDatPercent: 0,
    };
  }

  const validScores: number[] = [];
  let totCount = 0;
  let khaCount = 0;
  let datCount = 0;
  let chuaDatCount = 0;
  let absentCount = 0;

  for (const s of students) {
    if (s.diem === null || isNaN(s.diem)) {
      absentCount++;
    } else {
      validScores.push(s.diem);
      switch (s.xepLoai) {
        case 'Tốt':
          totCount++;
          break;
        case 'Khá':
          khaCount++;
          break;
        case 'Đạt':
          datCount++;
          break;
        case 'Chưa đạt':
          chuaDatCount++;
          break;
        default:
          absentCount++;
          break;
      }
    }
  }

  const gradedCount = validScores.length;
  if (gradedCount === 0) {
    return {
      total,
      gradedCount: 0,
      absentCount,
      average: 0,
      max: 0,
      min: 0,
      median: 0,
      standardDeviation: 0,
      totCount: 0,
      totPercent: 0,
      khaCount: 0,
      khaPercent: 0,
      datCount: 0,
      datPercent: 0,
      chuaDatCount: 0,
      chuaDatPercent: 0,
    };
  }

  const sum = validScores.reduce((acc, v) => acc + v, 0);
  const average = Number((sum / gradedCount).toFixed(2));
  const max = Math.max(...validScores);
  const min = Math.min(...validScores);

  // Median
  const sorted = [...validScores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 !== 0
      ? sorted[mid]
      : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));

  // Standard Deviation
  const variance =
    validScores.reduce((acc, v) => acc + Math.pow(v - average, 2), 0) /
    gradedCount;
  const standardDeviation = Number(Math.sqrt(variance).toFixed(2));

  return {
    total,
    gradedCount,
    absentCount,
    average,
    max,
    min,
    median,
    standardDeviation,
    totCount,
    totPercent: Number(((totCount / total) * 100).toFixed(1)),
    khaCount,
    khaPercent: Number(((khaCount / total) * 100).toFixed(1)),
    datCount,
    datPercent: Number(((datCount / total) * 100).toFixed(1)),
    chuaDatCount,
    chuaDatPercent: Number(((chuaDatCount / total) * 100).toFixed(1)),
  };
}
