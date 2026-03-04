# Remitero Forestal

Sistema de gestión de remitos para empresas forestales.

## Stack

- **Backend**: Node.js + Express + SQLite (better-sqlite3) + JWT
- **Frontend**: React + TypeScript + Vite + **Mantine UI**
- **Mobile (futuro)**: Capacitor para iOS/Android

## Arrancar el proyecto

### Backend
```bash
cd backend
npm run dev
# Corre en http://localhost:3001
```

### Frontend
```bash
cd frontend
npm run dev
# Corre en http://localhost:5173
```

## Credenciales por defecto

| Rol        | Email                   | Contraseña |
|------------|-------------------------|------------|
| Superadmin | admin@forestal.com      | admin1234  |

> Los PDV se crean desde el panel de Superadmin con email y contraseña a elección.

## Roles

- **superadmin**: Acceso completo — Panel, Puntos de Venta, Remitos (todos los PDVs)
- **pdv**: Acceso restringido — Panel, Remitos (solo del propio PDV)

## API Endpoints

| Método | Ruta                     | Descripción              |
|--------|--------------------------|--------------------------|
| POST   | /api/auth/login          | Iniciar sesión           |
| GET    | /api/auth/me             | Usuario actual           |
| GET    | /api/pdv                 | Listar PDVs (admin)      |
| POST   | /api/pdv                 | Crear PDV (admin)        |
| PUT    | /api/pdv/:id             | Editar PDV (admin)       |
| DELETE | /api/pdv/:id             | Eliminar PDV (admin)     |
| GET    | /api/remitos             | Listar remitos           |
| POST   | /api/remitos             | Crear remito             |
| PUT    | /api/remitos/:id         | Editar remito            |
| PATCH  | /api/remitos/:id/anular  | Anular remito            |
| GET    | /api/catalogos           | Obtener catálogos        |
