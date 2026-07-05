import { createContext, useState, useEffect, type ReactNode } from 'react';
// تعريف شكل بيانات المستخدم
interface User {
  id: string;
  name: string;
  role: string;
  phone: string; 
  email: string;
}

// تعريف الدوال اللي هنستخدمها في الأبلكيشن كله
interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (userData: User, authToken: string) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // أول ما الموقع يفتح، بندور في ذاكرة المتصفح (localStorage) لو العميل كان مسجل قبل كده
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // دالة تسجيل الدخول (بتحفظ البيانات في المتصفح عشان متضيعش مع الريفريش)
  const login = (userData: User, authToken: string) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  // دالة تسجيل الخروج (بتمسح البيانات)
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};