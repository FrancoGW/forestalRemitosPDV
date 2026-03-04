import axios from 'axios';

// En web usa el proxy de Vite (/api → VITE_API_URL).
// En Capacitor (iOS/Android) no hay proxy, se conecta directo al servidor.
const isNative = typeof (window as any).Capacitor !== 'undefined';
const baseURL = isNative
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
