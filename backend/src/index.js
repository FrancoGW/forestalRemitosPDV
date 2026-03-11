require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB, pool } = require('./db');

const authRoutes        = require('./routes/auth');
const pdvRoutes         = require('./routes/pdv');
const remitosRoutes     = require('./routes/remitos');
const catalogosRoutes   = require('./routes/catalogos');
const camionesRoutes    = require('./routes/camiones');
const movimientosRoutes = require('./routes/movimientos');
const adminRoutes       = require('./routes/admin');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api/auth',        authRoutes);
app.use('/api/pdv',         pdvRoutes);
app.use('/api/remitos',     remitosRoutes);
app.use('/api/catalogos',   catalogosRoutes);
app.use('/api/camiones',    camionesRoutes);
app.use('/api/movimientos', movimientosRoutes);
app.use('/api/admin',       adminRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function limpiarConexionesZombie() {
  try {
    const { rows } = await pool.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND state IN ('idle', 'idle in transaction', 'idle in transaction (aborted)')
    `);
    if (rows.length) console.log(`[DB] Limpié ${rows.length} conexiones zombie`);
  } catch (e) {
    console.warn('[DB] limpiarConexionesZombie falló:', e.message);
  }
}

async function startServer() {
  app.listen(PORT, () => {
    console.log(`[Server] Corriendo en http://localhost:${PORT}`);
  });

  // Limpiar inmediatamente al arrancar, antes de intentar initDB
  await limpiarConexionesZombie();

  // Reintentar initDB con backoff exponencial hasta que la DB esté disponible
  let intentos = 0;
  while (true) {
    try {
      await initDB();
      break;
    } catch (err) {
      intentos++;
      // Si es "too many clients", limpiar antes de reintentar
      if (err.message.includes('too many clients')) {
        await limpiarConexionesZombie();
      }
      const espera = Math.min(5000 * intentos, 30000);
      console.error(`[DB] Error en initDB (intento ${intentos}): ${err.message}`);
      console.log(`[DB] Reintentando en ${espera / 1000}s...`);
      await sleep(espera);
    }
  }

  // Limpiar conexiones zombie cada minuto
  setInterval(limpiarConexionesZombie, 60 * 1000);
}

startServer();

// Cierre limpio del pool al reiniciar (nodemon envía SIGUSR2, Railway/Ctrl+C usan SIGTERM/SIGINT)
async function shutdown(signal) {
  console.log(`[Server] ${signal} — cerrando pool...`);
  try { await pool.end(); } catch (_) {}
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGUSR2', () => shutdown('SIGUSR2'));
