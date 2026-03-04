const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

function getPdvId(user) {
  return user.rol === 'pdv' ? user.pdv_id : null;
}

// Buscar camión por código QR (al escanear)
router.get('/escanear/:codigo', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, qr.codigo AS app_codigo
       FROM camion c JOIN app_camion_qr qr ON qr.camion_id = c.id
       WHERE qr.codigo = $1`,
      [req.params.codigo]
    );
    if (!rows.length) return res.status(404).json({ error: 'QR inválido o camión no encontrado' });

    const camion = rows[0];
    const { rows: movRows } = await pool.query(`
      SELECT m.*, pv.numero AS pdv_numero, pv.nombre AS pdv_nombre
      FROM app_movimientos m
      JOIN puntoventa pv ON pv.id = m.puntoventa_id
      WHERE m.camion_id = $1 AND m.estado = 'en_predio'
      ORDER BY m.fecha_entrada DESC LIMIT 1
    `, [camion.id]);

    res.json({ camion, movimiento_activo: movRows[0] || null });
  } catch (e) {
    console.error('[GET /movimientos/escanear]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Registrar ENTRADA
router.post('/entrada', async (req, res) => {
  try {
    const { codigo, notas } = req.body;
    const pdvId = getPdvId(req.user) || req.body.pdv_id;

    if (!codigo) return res.status(400).json({ error: 'Código QR requerido' });
    if (!pdvId)  return res.status(400).json({ error: 'pdv_id requerido' });

    const { rows: camRows } = await pool.query(
      `SELECT c.*, qr.codigo AS app_codigo
       FROM camion c JOIN app_camion_qr qr ON qr.camion_id = c.id
       WHERE qr.codigo = $1`,
      [codigo]
    );
    if (!camRows.length) return res.status(404).json({ error: 'QR inválido o camión no encontrado' });

    const camion = camRows[0];

    const { rows: activo } = await pool.query(
      `SELECT id FROM app_movimientos WHERE camion_id = $1 AND estado = 'en_predio'`,
      [camion.id]
    );
    if (activo.length) {
      return res.status(409).json({ error: 'El camión ya tiene una entrada activa sin salida registrada' });
    }

    const { rows } = await pool.query(
      `INSERT INTO app_movimientos (camion_id, puntoventa_id, notas) VALUES ($1, $2, $3) RETURNING *`,
      [camion.id, pdvId, notas || null]
    );

    res.status(201).json({ mensaje: 'Entrada registrada', movimiento: rows[0], camion });
  } catch (e) {
    console.error('[POST /movimientos/entrada]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Registrar SALIDA — requiere despacho_id
router.post('/salida', async (req, res) => {
  try {
    const { movimiento_id, remito_id, notas } = req.body;
    const pdvId = getPdvId(req.user);

    if (!movimiento_id) return res.status(400).json({ error: 'movimiento_id requerido' });
    if (!remito_id)     return res.status(400).json({ error: 'Debés asociar un remito para registrar la salida' });

    const { rows } = await pool.query(
      'SELECT * FROM app_movimientos WHERE id = $1', [movimiento_id]
    );
    const mov = rows[0];
    if (!mov) return res.status(404).json({ error: 'Movimiento no encontrado' });
    if (mov.estado === 'salio') return res.status(400).json({ error: 'El camión ya registró su salida' });
    if (pdvId && parseInt(mov.puntoventa_id) !== parseInt(pdvId)) {
      return res.status(403).json({ error: 'Sin acceso a este movimiento' });
    }

    const { rows: remRows } = await pool.query(
      'SELECT id, estado_id FROM despacho WHERE id = $1', [remito_id]
    );
    if (!remRows.length) return res.status(404).json({ error: 'Remito no encontrado' });
    if (parseInt(remRows[0].estado_id) === 4) {
      return res.status(400).json({ error: 'No se puede usar un remito cancelado' });
    }

    const { rows: updated } = await pool.query(
      `UPDATE app_movimientos
       SET estado = 'salio', fecha_salida = NOW(),
           despacho_id = $1, notas = COALESCE($2, notas)
       WHERE id = $3
       RETURNING *`,
      [remito_id, notas || null, mov.id]
    );

    res.json({ mensaje: 'Salida registrada', movimiento: updated[0] });
  } catch (e) {
    console.error('[POST /movimientos/salida]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Listar movimientos
router.get('/', async (req, res) => {
  try {
    const { estado, fecha, pdv_id: qPdvId } = req.query;
    const pdvId = getPdvId(req.user) || qPdvId;

    const conditions = ['1=1'];
    const params = [];

    if (pdvId) { params.push(pdvId); conditions.push(`m.puntoventa_id = $${params.length}`); }
    if (estado) { params.push(estado); conditions.push(`m.estado = $${params.length}`); }
    if (fecha)  { params.push(fecha);  conditions.push(`m.fecha_entrada::date = $${params.length}`); }

    const sql = `
      SELECT m.*,
        c.patente  AS camion_patente,
        c.marca    AS camion_marca,
        pv.numero  AS pdv_numero,
        pv.nombre  AS pdv_nombre,
        d.nroremito AS remito_numero
      FROM app_movimientos m
      JOIN camion     c  ON c.id  = m.camion_id
      JOIN puntoventa pv ON pv.id = m.puntoventa_id
      LEFT JOIN despacho d ON d.id = m.despacho_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY m.fecha_entrada DESC LIMIT 200
    `;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('[GET /movimientos]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Remitos disponibles para asociar a la salida de un camión
router.get('/remitos-disponibles', async (req, res) => {
  try {
    const pdvId = getPdvId(req.user) || req.query.pdv_id;
    if (!pdvId) return res.status(400).json({ error: 'pdv_id requerido' });

    const { rows } = await pool.query(`
      SELECT d.id, d.nroremito AS numero,
             cl.nombre1 AS cliente,
             cam.patente AS patente_camion,
             d.fecha AS fecha_emision,
             CASE d.estado_id WHEN 4 THEN 'anulado'
                              WHEN 3 THEN 'emitido'
                              ELSE 'borrador' END AS estado
      FROM despacho d
      LEFT JOIN cliente cl  ON cl.id  = d.cliente_id
      LEFT JOIN camion  cam ON cam.id = d.camion_id
      WHERE d.puntoventa_id = $1
        AND d.estado_id != 4
        AND d.id NOT IN (
          SELECT despacho_id FROM app_movimientos WHERE despacho_id IS NOT NULL
        )
      ORDER BY d.id DESC
      LIMIT 50
    `, [pdvId]);

    res.json(rows);
  } catch (e) {
    console.error('[GET /movimientos/remitos-disponibles]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
