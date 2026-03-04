const express = require('express');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

function getPdvId(user) {
  return user.rol === 'pdv' ? user.pdv_id : null;
}

// Buscar camión por código QR (usado al escanear)
router.get('/escanear/:codigo', (req, res) => {
  const camion = db.prepare('SELECT * FROM camiones WHERE codigo = ? AND activo = 1').get(req.params.codigo);
  if (!camion) return res.status(404).json({ error: 'QR inválido o camión desactivado' });

  const movActivo = db.prepare(`
    SELECT m.*, p.numero as pdv_numero, p.nombre as pdv_nombre
    FROM movimientos m
    JOIN puntos_de_venta p ON p.id = m.pdv_id
    WHERE m.camion_id = ? AND m.estado = 'en_predio'
    ORDER BY m.fecha_entrada DESC LIMIT 1
  `).get(camion.id);

  res.json({ camion, movimiento_activo: movActivo || null });
});

// Registrar ENTRADA
router.post('/entrada', (req, res) => {
  const { codigo, notas } = req.body;
  const pdvId = getPdvId(req.user) || req.body.pdv_id;

  if (!codigo) return res.status(400).json({ error: 'Código QR requerido' });
  if (!pdvId)  return res.status(400).json({ error: 'pdv_id requerido' });

  const camion = db.prepare('SELECT * FROM camiones WHERE codigo = ? AND activo = 1').get(codigo);
  if (!camion) return res.status(404).json({ error: 'QR inválido o camión desactivado' });

  const yaAdentro = db.prepare(
    "SELECT id FROM movimientos WHERE camion_id = ? AND estado = 'en_predio'"
  ).get(camion.id);
  if (yaAdentro) {
    return res.status(409).json({ error: 'El camión ya tiene una entrada activa sin salida registrada' });
  }

  const { lastInsertRowid } = db.prepare(`
    INSERT INTO movimientos (camion_id, pdv_id, notas) VALUES (?, ?, ?)
  `).run(camion.id, pdvId, notas || null);

  const movimiento = db.prepare('SELECT * FROM movimientos WHERE id = ?').get(lastInsertRowid);
  res.status(201).json({ mensaje: 'Entrada registrada', movimiento, camion });
});

// Registrar SALIDA — requiere remito_id
router.post('/salida', (req, res) => {
  const { movimiento_id, remito_id, notas } = req.body;
  const pdvId = getPdvId(req.user);

  if (!movimiento_id) return res.status(400).json({ error: 'movimiento_id requerido' });
  if (!remito_id)     return res.status(400).json({ error: 'Debés asociar un remito para registrar la salida' });

  const mov = db.prepare('SELECT * FROM movimientos WHERE id = ?').get(movimiento_id);
  if (!mov) return res.status(404).json({ error: 'Movimiento no encontrado' });
  if (mov.estado === 'salio') return res.status(400).json({ error: 'El camión ya registró su salida' });
  if (pdvId && mov.pdv_id !== pdvId) return res.status(403).json({ error: 'Sin acceso a este movimiento' });

  const remito = db.prepare('SELECT * FROM remitos WHERE id = ?').get(remito_id);
  if (!remito) return res.status(404).json({ error: 'Remito no encontrado' });
  if (remito.estado === 'anulado') return res.status(400).json({ error: 'No se puede usar un remito anulado' });

  db.prepare(`
    UPDATE movimientos
    SET estado = 'salio', fecha_salida = datetime('now'), remito_id = ?, notas = COALESCE(?, notas)
    WHERE id = ?
  `).run(remito_id, notas || null, mov.id);

  const movActualizado = db.prepare('SELECT * FROM movimientos WHERE id = ?').get(mov.id);
  res.json({ mensaje: 'Salida registrada', movimiento: movActualizado });
});

// Listar movimientos
router.get('/', (req, res) => {
  const { estado, fecha, pdv_id: qPdvId } = req.query;
  const pdvId = getPdvId(req.user) || qPdvId;

  let sql = `
    SELECT m.*,
      c.nombre as camion_nombre, c.patente as camion_patente, c.cliente as camion_cliente,
      p.numero as pdv_numero, p.nombre as pdv_nombre,
      r.numero as remito_numero
    FROM movimientos m
    JOIN camiones c ON c.id = m.camion_id
    JOIN puntos_de_venta p ON p.id = m.pdv_id
    LEFT JOIN remitos r ON r.id = m.remito_id
    WHERE 1=1
  `;
  const params = [];

  if (pdvId)  { sql += ' AND m.pdv_id = ?';          params.push(pdvId); }
  if (estado) { sql += ' AND m.estado = ?';           params.push(estado); }
  if (fecha)  { sql += ' AND DATE(m.fecha_entrada) = ?'; params.push(fecha); }

  sql += ' ORDER BY m.fecha_entrada DESC LIMIT 200';
  res.json(db.prepare(sql).all(...params));
});

// Remitos disponibles para asociar a la salida de un camión (del mismo PDV, sin salida vinculada)
router.get('/remitos-disponibles', (req, res) => {
  const pdvId = getPdvId(req.user) || req.query.pdv_id;
  if (!pdvId) return res.status(400).json({ error: 'pdv_id requerido' });

  const remitos = db.prepare(`
    SELECT r.id, r.numero, r.cliente, r.patente_camion, r.fecha_emision, r.estado
    FROM remitos r
    WHERE r.pdv_id = ?
      AND r.estado != 'anulado'
      AND r.id NOT IN (SELECT remito_id FROM movimientos WHERE remito_id IS NOT NULL)
    ORDER BY r.id DESC
    LIMIT 50
  `).all(pdvId);

  res.json(remitos);
});

module.exports = router;
