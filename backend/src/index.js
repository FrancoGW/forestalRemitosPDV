require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./db');

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

async function startServer() {
  // Levantar el servidor primero para que Railway no lo mate por health check
  app.listen(PORT, () => {
    console.log(`[Server] Corriendo en http://localhost:${PORT}`);
  });

  // Reintentar initDB con backoff exponencial hasta que la DB esté disponible
  let intentos = 0;
  while (true) {
    try {
      await initDB();
      break;
    } catch (err) {
      intentos++;
      const espera = Math.min(5000 * intentos, 60000);
      console.error(`[DB] Error en initDB (intento ${intentos}): ${err.message}`);
      console.log(`[DB] Reintentando en ${espera / 1000}s...`);
      await sleep(espera);
    }
  }
}

startServer();
