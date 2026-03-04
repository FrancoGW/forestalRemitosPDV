# Remitero Forestal

Sistema de gestión de remitos para empresas forestales. Incluye control de acceso por roles, generación de remitos, seguimiento de camiones con QR y dashboard de estadísticas.

## Stack

- **Backend**: Node.js + Express + SQLite (`node:sqlite`) + JWT
- **Frontend**: React + TypeScript + Vite + Mantine UI
- **Mobile (futuro)**: Capacitor para iOS/Android

## Instalación y arranque

### 1. Variables de entorno

**Backend** — crear `backend/.env`:
```
PORT=3001
JWT_SECRET=tu_secreto_aqui
```

**Frontend** — crear `frontend/.env`:
```
VITE_API_URL=http://localhost:3001
```

### 2. Instalar dependencias

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 3. Correr el proyecto

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

El backend corre en `http://localhost:3001` y el frontend en `http://localhost:5173`.

Al iniciar, el backend crea automáticamente la base de datos SQLite y el usuario superadmin inicial. **Las credenciales por defecto se configuran en `backend/src/db.js`** — cambiálas antes de poner el sistema en producción.

## Roles

| Rol | Acceso |
|---|---|
| `superadmin` | Panel con estadísticas, Puntos de Venta, todos los Remitos, QR Camiones |
| `pdv` | Sus propios Remitos, Control de Acceso de camiones |

Los puntos de venta (PDV) se crean desde el panel del superadmin con usuario y contraseña a elección.

## API Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/auth/login | Iniciar sesión |
| GET | /api/auth/me | Usuario actual |
| GET/POST | /api/pdv | Listar / Crear PDVs |
| PUT/DELETE | /api/pdv/:id | Editar / Eliminar PDV |
| GET/POST | /api/remitos | Listar / Crear remitos |
| PUT | /api/remitos/:id | Editar remito |
| PATCH | /api/remitos/:id/anular | Anular remito |
| GET/POST | /api/camiones | Listar / Crear camiones |
| GET | /api/camiones/:id/qr | Obtener QR del camión |
| POST | /api/movimientos/scan | Escanear QR (entrada/salida) |
| GET | /api/admin/stats | Estadísticas del dashboard |
| POST | /api/admin/seed-demo | Cargar datos de prueba |
