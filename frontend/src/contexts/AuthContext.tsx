import { createContext, useContext, useState, ReactNode } from 'react';
import api from '../api/client';

interface Usuario {
  id: number;
  nombre: string;
  username: string;
  rol: 'superadmin' | 'pdv';
  pdv_id: number | null;
  pdv_numero: number | null;
  pdv_nombre: string | null;
}

interface AuthContextType {
  usuario: Usuario | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  cargando: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function cargarUsuarioGuardado(): Usuario | null {
  try {
    const raw = localStorage.getItem('usuario');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(cargarUsuarioGuardado);
  const [cargando, setCargando] = useState(false);

  async function login(username: string, password: string) {
    setCargando(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));
      setUsuario(data.usuario);
    } finally {
      setCargando(false);
    }
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, login, logout, cargando }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
