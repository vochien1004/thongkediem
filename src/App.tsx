import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ActiveTab, StatModuleType, StudentScore, SystemConfig, GlobalFilterState, AuthUser } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { UploadView } from './components/UploadView';
import { StatisticsView } from './components/StatisticsView';
import { SettingsView } from './components/SettingsView';
import { GlobalFilterBar } from './components/GlobalFilterBar';
import { AiAnalysisModal } from './components/AiAnalysisModal';
import { LoginView } from './components/LoginView';
import { FirestoreQuotaBanner } from './components/FirestoreQuotaBanner';
import { AlertTriangle, Cloud, ArrowRight, X } from 'lucide-react';
import {
  loadStoredConfig,
  saveStoredConfig,
} from './utils/storage';
import { calculateStats, classifyScore } from './utils/scoreClassifier';
import { getSampleStudents } from './data/sampleData';
import {
  subscribeToStudents,
  saveStudentsToFirestore,
  clearAllStudentsFromFirestore,
  loadSystemConfigFromFirestore,
  saveSystemConfigToFirestore,
  fetchStudentsFromFirestoreOnce,
  testFirestoreConnection,
  migrateHK2PeriodsInFirestore,
  getFirestoreQuotaInfo,
  subscribeToQuotaStatus,
  subscribeToFirebaseConfigChange,
  FirestoreQuotaInfo,
} from './firebaseService';
import { syncExamInfoFromFilter } from './utils/syncExamInfo';
import { getStoredAuthUser, logoutStoredUser } from './utils/auth';
import { DEFAULT_EXAM_PERIODS } from './utils/periodConfig';
import {
  getSavedLatestUploadedFilter,
  saveLatestUploadedFilter,
  detectLatestUploadedPeriod,
} from './utils/periodDetection';

export default function App() {
  // Quản lý trạng thái tài khoản đăng nhập (Admin vs Giáo viên)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredAuthUser());

  // Quản lý trạng thái hạn mức Firestore
  const [quotaInfo, setQuotaInfo] = useState<FirestoreQuotaInfo>(() => getFirestoreQuotaInfo());

  // State quản lý tab đang mở (Giáo viên mặc định vào 'statistics', Admin vào 'dashboard')
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const stored = getStoredAuthUser();
    return stored?.role === 'teacher' ? 'statistics' : 'dashboard';
  });

  // State quản lý 6 phân hệ thống kê con đang mở
  const [activeStatModule, setActiveStatModule] = useState<StatModuleType>('theo_mon');

  // Mobile sidebar drawer state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // State danh sách học sinh & điểm số (Nạp và đồng bộ 100% từ Cloud Firestore)
  const [students, setStudents] = useState<StudentScore[]>([]);

  // State cấu hình hệ thống & thang điểm
  const [config, setConfig] = useState<SystemConfig>(() => loadStoredConfig());

  // Trạng thái kết nối Firebase
  const [isFirebaseSynced, setIsFirebaseSynced] = useState<boolean>(false);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(true);
  const [dismissBanner, setDismissBanner] = useState<boolean>(false);
  const [isRefreshingFirestore, setIsRefreshingFirestore] = useState<boolean>(false);

  // Bộ lọc toàn cục đa cấp (Năm học, Học kỳ, Đợt điểm) - Tự động hiển thị đợt kiểm tra được upload điểm gần nhất
  const [globalFilter, setGlobalFilter] = useState<GlobalFilterState>(() => {
    const saved = getSavedLatestUploadedFilter();
    if (saved) return saved;
    return {
      academicYear: '2025-2026',
      semester: 'HK1',
      period: 'GKI',
    };
  });

  // Đánh dấu đã tự động phát hiện đợt điểm mới nhất từ Firestore khi khởi động
  const hasAutoDetectedPeriod = useRef<boolean>(false);

  // Modal AI Nhận xét Gemini
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);

  // Danh sách các năm học khả dụng (tổng hợp từ dữ liệu học sinh và cấu hình)
  const availableAcademicYears = useMemo(() => {
    const list = new Set<string>();
    if (config.availableAcademicYears && Array.isArray(config.availableAcademicYears)) {
      config.availableAcademicYears.forEach((y) => list.add(y));
    }
    students.forEach((s) => {
      const y = s.academicYear || s.namHoc;
      if (y) list.add(y);
    });
    list.add('2024-2025');
    list.add('2025-2026');
    list.add('2026-2027');
    return Array.from(list).sort().reverse();
  }, [students, config.availableAcademicYears]);

  // Thêm năm học mới vào hệ thống
  const handleAddNewAcademicYear = (newYear: string) => {
    const updatedYears = Array.from(new Set([...(config.availableAcademicYears || []), newYear])).sort();
    const updatedConfig = {
      ...config,
      availableAcademicYears: updatedYears,
      academicYear: newYear,
    };
    setConfig(updatedConfig);
    saveStoredConfig(updatedConfig);
    saveSystemConfigToFirestore(updatedConfig).catch(() => {});
    setGlobalFilter((prev) => ({
      ...prev,
      academicYear: newYear,
    }));
  };

  // Lắng nghe trạng thái hạn mức Firestore
  useEffect(() => {
    const unsub = subscribeToQuotaStatus((info) => {
      setQuotaInfo(info);
    });
    return unsub;
  }, []);

  // TỰ ĐỘNG ĐỒNG BỘ THÔNG TIN KỲ THI, NĂM HỌC VÀ HỌC KỲ TỪ BỘ LỌC TOÀN CỤC VÀO CONFIG (Lưu vào LocalStorage)
  useEffect(() => {
    saveLatestUploadedFilter(globalFilter);
    setConfig((prevConfig) => {
      const synced = syncExamInfoFromFilter(prevConfig, globalFilter);
      if (
        synced.academicYear === prevConfig.academicYear &&
        synced.term === prevConfig.term &&
        synced.examName === prevConfig.examName &&
        synced.reportTitle === prevConfig.reportTitle
      ) {
        return prevConfig;
      }
      saveStoredConfig(synced);
      return synced;
    });
  }, [globalFilter.academicYear, globalFilter.semester, globalFilter.period]);

  // Lọc danh sách học sinh theo Global Filter (Năm học, Học kỳ, Đợt điểm)
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const sYear = s.academicYear || s.namHoc || '2025-2026';
      const sSem = s.semester || s.hocKy || 'HK1';
      const sPer = s.period || s.dotDiem || 'GKI';

      if (globalFilter.academicYear !== 'ALL' && sYear !== globalFilter.academicYear) {
        return false;
      }

      // Đợt KS đầu năm (Khảo sát đầu năm)
      const isFilterKS = globalFilter.semester === 'KS' || globalFilter.period === 'KS';
      const isStudentKS =
        sSem === 'KS' ||
        sPer === 'KS' ||
        sPer.toLowerCase().includes('ks') ||
        sSem.toLowerCase().includes('ks') ||
        (s.dotDiem && s.dotDiem.toLowerCase().includes('khảo sát'));

      if (isFilterKS) {
        return isStudentKS;
      }

      // Nếu không lọc KS, bỏ qua các bản ghi KS nếu người dùng đang lọc HK1/HK2/GKI/CKI cụ thể
      if (isStudentKS && (globalFilter.semester === 'HK1' || globalFilter.semester === 'HK2')) {
        return false;
      }

      if (globalFilter.semester !== 'ALL' && sSem !== globalFilter.semester) {
        return false;
      }
      if (globalFilter.period !== 'ALL') {
        let matchesPeriod = sPer === globalFilter.period;
        if (globalFilter.period === 'GKII') {
          matchesPeriod = sPer === 'GKII' || (sSem === 'HK2' && (sPer === 'GKI' || sPer === 'GKI-HK2' || sPer === 'GK1'));
        } else if (globalFilter.period === 'CKII') {
          matchesPeriod = sPer === 'CKII' || (sSem === 'HK2' && (sPer === 'CKI' || sPer === 'CKI-HK2' || sPer === 'CK1'));
        } else if (globalFilter.period === 'GKI' && globalFilter.semester === 'HK2') {
          matchesPeriod = sPer === 'GKII' || sPer === 'GKI' || sPer === 'GKI-HK2';
        } else if (globalFilter.period === 'CKI' && globalFilter.semester === 'HK2') {
          matchesPeriod = sPer === 'CKII' || sPer === 'CKI' || sPer === 'CKI-HK2';
        }
        if (!matchesPeriod) return false;
      }
      return true;
    });
  }, [students, globalFilter]);

  // Tính toán số liệu thống kê cho tập dữ liệu đã lọc
  const filteredStats = useMemo(() => {
    return calculateStats(filteredStudents);
  }, [filteredStudents]);

  // Ref lưu thresholds hiện tại để dùng cho subscriber realtime mà không cần recreate listener
  const thresholdsRef = useRef(config.thresholds);
  thresholdsRef.current = config.thresholds;

  // 1. Kiểm tra trạng thái kết nối Firestore & Tải cấu hình từ Cloud khi khởi động (Chỉ chạy 1 lần)
  useEffect(() => {
    testFirestoreConnection().then((res) => {
      setIsFirebaseConnected(res.success);
      if (res.success) {
        migrateHK2PeriodsInFirestore().then((m) => {
          if (m.migratedCount > 0) {
            console.log(`Đã chuẩn hóa ${m.migratedCount} bản ghi HK2 sang GKII / CKII trên Firestore.`);
          }
        }).catch((err) => {
          console.warn('Lỗi migrate đợt kiểm tra HK2:', err);
        });
      }
    }).catch(() => {
      setIsFirebaseConnected(false);
    });

    // Tải cấu hình từ Firebase một lần khi ứng dụng mở
    loadSystemConfigFromFirestore().then((cloudConfig) => {
      if (cloudConfig) {
        const hasKS = cloudConfig.examPeriods && cloudConfig.examPeriods.some((p) => p.id === 'KS');
        const examPeriods = hasKS ? cloudConfig.examPeriods : DEFAULT_EXAM_PERIODS;
        const merged: SystemConfig = {
          ...cloudConfig,
          examPeriods,
        };
        setConfig(merged);
        saveStoredConfig(merged);
      }
    }).catch(() => {});
  }, []);

  // 2. Đồng bộ Realtime từ Firebase Firestore cho danh sách học sinh (Tự động cập nhật khi đổi cấu hình Firebase)
  useEffect(() => {
    let currentUnsubscribe: (() => void) | null = null;

    const startStudentSubscription = () => {
      if (currentUnsubscribe) {
        currentUnsubscribe();
        currentUnsubscribe = null;
      }
      currentUnsubscribe = subscribeToStudents(
        () => thresholdsRef.current,
        (firestoreStudents) => {
          const list = firestoreStudents || [];
          setStudents(list);
          setIsFirebaseSynced(true);
          setIsFirebaseConnected(true);

          // Tự động phát hiện đợt kiểm tra được upload điểm gần nhất khi ứng dụng khởi động
          if (!hasAutoDetectedPeriod.current && list.length > 0) {
            hasAutoDetectedPeriod.current = true;
            const latestPeriod = detectLatestUploadedPeriod(list);
            if (latestPeriod) {
              setGlobalFilter(latestPeriod);
              saveLatestUploadedFilter(latestPeriod);
            }
          }
        },
        (error) => {
          console.warn('Firestore subscription error:', error);
          setIsFirebaseSynced(true);
          setIsFirebaseConnected(false);
        }
      );
    };

    // Bắt đầu lắng nghe ban đầu
    startStudentSubscription();

    // Lắng nghe sự kiện cấu hình Firebase thay đổi để nạp lại dữ liệu từ project / database mới
    const unsubConfig = subscribeToFirebaseConfigChange(() => {
      testFirestoreConnection().then((res) => {
        setIsFirebaseConnected(res.success);
      }).catch(() => {
        setIsFirebaseConnected(false);
      });

      loadSystemConfigFromFirestore().then((cloudConfig) => {
        if (cloudConfig) {
          const hasKS = cloudConfig.examPeriods && cloudConfig.examPeriods.some((p) => p.id === 'KS');
          const examPeriods = hasKS ? cloudConfig.examPeriods : DEFAULT_EXAM_PERIODS;
          const merged: SystemConfig = {
            ...cloudConfig,
            examPeriods,
          };
          setConfig(merged);
          saveStoredConfig(merged);
        }
      }).catch(() => {});

      startStudentSubscription();
    });

    return () => {
      if (currentUnsubscribe) {
        currentUnsubscribe();
      }
      unsubConfig();
    };
  }, []);

  // 3. Tự động tính lại xếp loại học sinh khi người dùng thay đổi thang điểm cấu hình
  useEffect(() => {
    setStudents((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((s) => {
        const rawScore = s.score !== undefined && s.score !== null ? s.score : s.diem;
        const newRank = classifyScore(rawScore, config.thresholds);
        if (s.rank === newRank && s.xepLoai === newRank) return s;
        return {
          ...s,
          rank: newRank,
          xepLoai: newRank,
        };
      });
    });
  }, [config.thresholds?.totMin, config.thresholds?.khaMin, config.thresholds?.datMin]);

  // 4. Tự động lưu cấu hình cục bộ vào LocalStorage khi config thay đổi
  useEffect(() => {
    saveStoredConfig(config);
  }, [config]);

  // Tải lại 100% dữ liệu thật từ Firestore
  const handleRefreshFromFirestore = async () => {
    setIsRefreshingFirestore(true);
    try {
      const realData = await fetchStudentsFromFirestoreOnce(config.thresholds);
      setStudents(realData);
      setIsFirebaseConnected(true);
    } catch (err: any) {
      console.error('Lỗi khi làm mới từ Firestore:', err);
      setIsFirebaseConnected(false);
    } finally {
      setIsRefreshingFirestore(false);
    }
  };

  // Nạp dữ liệu mẫu 45 học sinh và lưu trực tiếp lên Firebase Firestore
  const handleLoadSampleData = async () => {
    const sample = getSampleStudents();
    const withConfig = sample.map((s) => ({
      ...s,
      xepLoai: classifyScore(s.diem, config.thresholds),
    }));

    const latest = detectLatestUploadedPeriod(withConfig);
    if (latest) {
      setGlobalFilter(latest);
      saveLatestUploadedFilter(latest);
    }
    
    // Lưu thật trực tiếp lên Firebase Firestore
    try {
      await saveStudentsToFirestore(withConfig, true);
    } catch (e) {
      console.error('Error saving sample to Firebase:', e);
      setStudents(withConfig);
    }
  };

  // Xóa toàn bộ bản ghi điểm trên Firebase Firestore và trên chương trình
  const handleDeleteAllRecords = async (onProgress?: (current: number, total: number) => void) => {
    try {
      await clearAllStudentsFromFirestore(onProgress);
      setStudents([]);
    } catch (err: any) {
      console.error('Lỗi khi xóa tất cả bản ghi:', err);
      throw err;
    }
  };

  // Đăng xuất tài khoản
  const handleLogout = () => {
    logoutStoredUser();
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  const isTeacher = currentUser?.role === 'teacher';

  // Giáo viên chỉ xem được toàn bộ menu Thống kê chất lượng, không xem được trang tổng quan
  useEffect(() => {
    if (isTeacher && activeTab !== 'statistics') {
      setActiveTab('statistics');
    }
  }, [isTeacher, activeTab]);

  const handleSetActiveTab = (tab: ActiveTab) => {
    if (isTeacher && tab !== 'statistics') {
      return;
    }
    setActiveTab(tab);
  };

  // NẾU CHƯA ĐĂNG NHẬP: Hiển thị giao diện Đăng nhập
  if (!currentUser) {
    return (
      <LoginView
        config={config}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setActiveTab(user.role === 'teacher' ? 'statistics' : 'dashboard');
        }}
      />
    );
  }

  return (
    <div id="eduscore-app-root" className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Sidebar Navigation (with Mobile Drawer Support) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        activeStatModule={activeStatModule}
        setActiveStatModule={setActiveStatModule}
        totalStudents={students.length}
        config={config}
        onLoadSampleData={handleLoadSampleData}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Header Breadcrumb & Actions */}
        <Header
          activeTab={activeTab}
          activeStatModule={activeStatModule}
          config={config}
          totalStudents={students.length}
          isFirebaseConnected={isFirebaseConnected}
          onLoadSampleData={handleLoadSampleData}
          onOpenSettings={!isTeacher ? () => setActiveTab('settings') : undefined}
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        {/* Firestore Quota Exhaustion Notice Banner */}
        <FirestoreQuotaBanner quotaInfo={quotaInfo} />

        {/* Global Filter Bar (Đa cấp: Năm học, Học kỳ, Đợt lấy điểm) */}
        <GlobalFilterBar
          filter={globalFilter}
          onFilterChange={setGlobalFilter}
          availableYears={availableAcademicYears}
          matchingCount={filteredStudents.length}
          totalCount={students.length}
          onOpenAiModal={!isTeacher ? () => setIsAiModalOpen(true) : undefined}
          onAddAcademicYear={!isTeacher ? handleAddNewAcademicYear : undefined}
          currentUser={currentUser}
        />

        {/* Top Banner: Chỉ hiển thị cảnh báo khi CHƯA kết nối được Firebase (Chỉ cho Admin) */}
        {!isTeacher && !isFirebaseConnected && !dismissBanner && (
          <div className="bg-amber-50 border-b border-amber-200 px-3 sm:px-6 py-2 flex items-center justify-between gap-2 text-xs text-amber-900 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="truncate">
                <strong>Chưa kết nối Firebase:</strong> Ứng dụng chưa thể kết nối đến Cloud Firestore. Vui lòng kiểm tra cấu hình tại menu <strong>Cấu hình</strong> để đồng bộ dữ liệu thật.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-[11px] transition inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Cấu hình ngay</span>
                <ArrowRight className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setDismissBanner(true)}
                className="p-1 text-amber-600 hover:text-amber-900 rounded-md transition"
                title="Đóng thông báo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Dynamic View by Tab */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'dashboard' && !isTeacher && (
            <DashboardView
              students={filteredStudents}
              stats={filteredStats}
              config={config}
              setActiveTab={handleSetActiveTab}
              onLoadSampleData={handleLoadSampleData}
              globalFilter={globalFilter}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'upload' && !isTeacher && (
            <UploadView
              students={students}
              setStudents={setStudents}
              config={config}
              onLoadSampleData={handleLoadSampleData}
              onDeleteAll={handleDeleteAllRecords}
              globalFilter={globalFilter}
              onFilterChange={setGlobalFilter}
              availableYears={availableAcademicYears}
            />
          )}

          {activeTab === 'statistics' && (
            <StatisticsView
              students={filteredStudents}
              allStudents={students}
              globalFilter={globalFilter}
              config={config}
              onRefreshFromFirestore={handleRefreshFromFirestore}
              isRefreshing={isRefreshingFirestore}
              onOpenAiModal={!isTeacher ? () => setIsAiModalOpen(true) : undefined}
              activeModule={activeStatModule}
              onModuleChange={setActiveStatModule}
            />
          )}

          {activeTab === 'settings' && !isTeacher && (
            <SettingsView
              config={config}
              setConfig={setConfig}
              students={students}
              setStudents={setStudents}
              onDeleteAll={handleDeleteAllRecords}
            />
          )}
        </main>

        {/* Footer Status Bar */}
        <footer className="h-8 sm:h-9 bg-white border-t border-slate-200 px-3 sm:px-6 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 font-medium tracking-wide shrink-0 select-none">
          <div className="flex items-center gap-2 sm:gap-4 truncate">
            <span className="flex items-center gap-1.5 truncate">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isFirebaseConnected ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
              <span className="text-slate-600 font-semibold truncate">Firestore: {isFirebaseConnected ? 'Đã kết nối' : 'Chưa kết nối / Đang kết nối...'}</span>
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden md:inline">
              Đang lọc: {globalFilter.academicYear} | {globalFilter.semester} | {globalFilter.period} ({filteredStudents.length}/{students.length} bản ghi)
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline text-slate-500">
              {currentUser.title}: <strong>{currentUser.name}</strong>
            </span>
            <span className="hidden sm:inline">•</span>
            <div>
              Hiển thị: <strong className="text-slate-700">{filteredStudents.length}</strong> / {students.length}
            </div>
          </div>
        </footer>
      </div>

      {/* AI Analysis Modal (Chỉ cho Admin) */}
      {!isTeacher && (
        <AiAnalysisModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          filteredStudents={filteredStudents}
          allStudents={students}
          globalFilter={globalFilter}
          config={config}
        />
      )}
    </div>
  );
}
