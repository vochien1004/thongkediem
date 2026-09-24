import { AuthUser } from '../types';

const AUTH_STORAGE_KEY = 'eduscore_auth_user';

export const PRESET_ACCOUNTS = [
  {
    username: 'admin',
    password: 'admin',
    user: {
      username: 'admin',
      name: 'Quản Trị Viên Hệ Thống',
      role: 'admin' as const,
      title: 'Quản trị viên (Admin)',
    },
    description: 'Toàn quyền điều khiển tất cả các menu và chức năng hệ thống',
  },
  {
    username: 'giaovien',
    password: '123',
    user: {
      username: 'giaovien',
      name: 'Giáo Viên Bộ Môn',
      role: 'teacher' as const,
      title: 'Giáo viên',
    },
    description: 'Quyền sử dụng Module Thống kê để xem, lọc và tải các biểu mẫu báo cáo chuẩn',
  },
];

export function getStoredAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch (err) {
    console.error('Failed to parse stored auth user:', err);
    return null;
  }
}

export function saveStoredAuthUser(user: AuthUser | null): void {
  try {
    if (!user) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } else {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    }
  } catch (err) {
    console.error('Failed to save auth user to storage:', err);
  }
}

export function authenticateUser(
  usernameInput: string,
  passwordInput: string
): { success: boolean; user?: AuthUser; message?: string } {
  const cleanUsername = usernameInput.trim().toLowerCase();
  const cleanPassword = passwordInput.trim();

  const matched = PRESET_ACCOUNTS.find(
    (acc) => acc.username.toLowerCase() === cleanUsername && acc.password === cleanPassword
  );

  if (!matched) {
    return {
      success: false,
      message: 'Tên đăng nhập hoặc mật khẩu không chính xác! Vui lòng kiểm tra lại.',
    };
  }

  const authenticatedUser: AuthUser = {
    ...matched.user,
    loginAt: new Date().toISOString(),
  };

  saveStoredAuthUser(authenticatedUser);
  return {
    success: true,
    user: authenticatedUser,
  };
}

export function logoutStoredUser(): void {
  saveStoredAuthUser(null);
}
