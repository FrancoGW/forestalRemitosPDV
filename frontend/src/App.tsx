import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout, { iconos } from './components/Layout';
import Login from './pages/Login';
import PanelAdmin from './pages/superadmin/Panel';
import PuntosDeVenta from './pages/superadmin/PuntosDeVenta';
import RemitosAdmin from './pages/superadmin/Remitos';
import Camiones from './pages/superadmin/Camiones';
import Usuarios from './pages/superadmin/Usuarios';
import RemitosPDV from './pages/pdv/Remitos';
import Accesos from './pages/pdv/Accesos';
import RemitoForm from './pages/remitos/RemitoForm';

const NAV_ADMIN = [
  { label: 'Panel',           icon: iconos.panel,    href: ''                 },
  { label: 'Puntos de Venta', icon: iconos.pdvs,     href: '/puntos-de-venta' },
  { label: 'Usuarios',        icon: iconos.accesos,  href: '/usuarios'        },
  { label: 'Remitos',         icon: iconos.remitos,  href: '/remitos'         },
  { label: 'Control Camiones', icon: iconos.camiones, href: '/camiones'        },
];

const NAV_PDV = [
  { label: 'Remitos',         icon: iconos.remitos, href: '/remitos' },
  { label: 'Control Acceso',  icon: iconos.accesos, href: '/accesos' },
];

function Redirector() {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  return <Navigate to={usuario.rol === 'superadmin' ? '/admin' : '/pdv/remitos'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Redirector />} />

          {/* Rutas Superadmin */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute rol="superadmin">
                <Layout navItems={NAV_ADMIN} basePath="/admin" />
              </ProtectedRoute>
            }
          >
            <Route index element={<PanelAdmin />} />
            <Route path="puntos-de-venta" element={<PuntosDeVenta />} />
            <Route path="remitos" element={<RemitosAdmin />} />
            <Route path="remitos/nuevo" element={<RemitoForm />} />
            <Route path="remitos/:id/editar" element={<RemitoForm />} />
            <Route path="camiones" element={<Camiones />} />
            <Route path="usuarios" element={<Usuarios />} />
          </Route>

          {/* Rutas PDV */}
          <Route
            path="/pdv"
            element={
              <ProtectedRoute rol="pdv">
                <Layout navItems={NAV_PDV} basePath="/pdv" />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="remitos" replace />} />
            <Route path="remitos" element={<RemitosPDV />} />
            <Route path="remitos/nuevo" element={<RemitoForm />} />
            <Route path="remitos/:id/editar" element={<RemitoForm />} />
            <Route path="accesos" element={<Accesos />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
