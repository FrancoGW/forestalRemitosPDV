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

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
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

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[Server] Corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[Server] Error al iniciar:', err.message);
    process.exit(1);
  });
