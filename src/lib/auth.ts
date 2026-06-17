/**
 * Simple localStorage-based auth module
 */

interface AuthResult {
  success: boolean;
  message: string;
}

const STORAGE_KEY = 'aperture_users';

function getUsers(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveUsers(users: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  } catch {}
}

export function isRegistered(email: string): boolean {
  const users = getUsers();
  return email in users;
}

export function register(email: string, password: string): AuthResult {
  const users = getUsers();
  users[email] = password;
  saveUsers(users);
  return { success: true, message: '注册成功！' };
}

export function login(email: string, password: string): AuthResult {
  const users = getUsers();
  if (!(email in users)) {
    return { success: false, message: '账号不存在，请先注册' };
  }
  if (users[email] !== password) {
    return { success: false, message: '密码错误，请重试' };
  }
  return { success: true, message: '登录成功' };
}
