const express = require('express');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { db } = require('../db');
const { authMiddleware, soloSuperAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware, soloSuperAdmin);

router.get('/', (req, res) => {
  const camiones = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM movimientos m WHERE m.camion_id = c.id) as total_visitas,
      (SELECT COUNT(*) FROM movimientos m WHERE m.camion_id = c.id AND m.estado = 'en_predio') as en_predio
    FROM camiones c
    ORDER BY c.nombre ASC
  `).all();
  res.json(camiones);
});

router.post('/', (req, res) => {
  const { nombre, patente, cliente } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

  const codigo = crypto.randomUUID();
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO camiones (codigo, nombre, patente, cliente) VALUES (?, ?, ?, ?)
  `).run(codigo, nombre, patente || null, cliente || null);

  res.status(201).json(db.prepare('SELECT * FROM camiones WHERE id = ?').get(lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const { nombre, patente, cliente, activo } = req.body;
  const camion = db.prepare('SELECT * FROM camiones WHERE id = ?').get(req.params.id);
  if (!camion) return res.status(404).json({ error: 'Camión no encontrado' });

  db.prepare(`
    UPDATE camiones SET
      nombre   = COALESCE(?, nombre),
      patente  = COALESCE(?, patente),
      cliente  = COALESCE(?, cliente),
      activo   = COALESCE(?, activo)
    WHERE id = ?
  `).run(nombre ?? null, patente ?? null, cliente ?? null, activo !== undefined ? (activo ? 1 : 0) : null, camion.id);

  res.json(db.prepare('SELECT * FROM camiones WHERE id = ?').get(camion.id));
});

router.delete('/:id', (req, res) => {
  const camion = db.prepare('SELECT * FROM camiones WHERE id = ?').get(req.params.id);
  if (!camion) return res.status(404).json({ error: 'Camión no encontrado' });

  const enPredioBloqueando = db.prepare(
    "SELECT id FROM movimientos WHERE camion_id = ? AND estado = 'en_predio'"
  ).get(camion.id);
  if (enPredioBloqueando) {
    return res.status(409).json({ error: 'No se puede eliminar: el camión está actualmente en el predio' });
  }

  db.prepare('DELETE FROM camiones WHERE id = ?').run(camion.id);
  res.json({ mensaje: 'Camión eliminado' });
});

// Devuelve imagen PNG del QR (se usa con <img src="/api/camiones/:id/qr">)
router.get('/:id/qr', async (req, res) => {
  const camion = db.prepare('SELECT * FROM camiones WHERE id = ?').get(req.params.id);
  if (!camion) return res.status(404).json({ error: 'Camión no encontrado' });

  try {
    const png = await QRCode.toBuffer(camion.codigo, {
      width: 400,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="qr-${camion.nombre.replace(/\s/g, '_')}.png"`);
    res.send(png);
  } catch {
    res.status(500).json({ error: 'Error generando QR' });
  }
});

module.exports = router;
