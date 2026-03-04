const express = require('express');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { pool } = require('../db');
const { authMiddleware, soloSuperAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware, soloSuperAdmin);

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, qr.codigo AS app_codigo,
        (SELECT COUNT(*) FROM app_movimientos m WHERE m.camion_id = c.id)                            AS total_visitas,
        (SELECT COUNT(*) FROM app_movimientos m WHERE m.camion_id = c.id AND m.estado = 'en_predio') AS en_predio
      FROM camion c
      LEFT JOIN app_camion_qr qr ON qr.camion_id = c.id
      ORDER BY c.patente ASC
    `);
    res.json(rows);
  } catch (e) {
    console.error('[GET /camiones]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  const { patente, marca, modelo } = req.body;
  if (!patente) return res.status(400).json({ error: 'La patente es requerida' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const codigo = crypto.randomUUID();
    const { rows } = await client.query(
      `INSERT INTO camion (patente, marca, modelo) VALUES ($1, $2, $3) RETURNING *`,
      [patente.toUpperCase(), marca || null, modelo || null]
    );
    const camion = rows[0];
    await client.query(
      `INSERT INTO app_camion_qr (camion_id, codigo) VALUES ($1, $2)`,
      [camion.id, codigo]
    );
    await client.query('COMMIT');
    res.status(201).json({ ...camion, app_codigo: codigo });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un camión con esa patente' });
    }
    console.error('[POST /camiones]', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT id FROM camion WHERE id = $1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Camión no encontrado' });

    const { patente, marca, modelo } = req.body;
    const { rows } = await pool.query(
      `UPDATE camion
       SET patente = COALESCE($1, patente),
           marca   = COALESCE($2, marca),
           modelo  = COALESCE($3, modelo)
       WHERE id = $4
       RETURNING *`,
      [patente?.toUpperCase() || null, marca || null, modelo || null, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error('[PUT /camiones/:id]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id FROM camion WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Camión no encontrado' });

    const { rows: enPredioBloqueando } = await pool.query(
      `SELECT id FROM app_movimientos WHERE camion_id = $1 AND estado = 'en_predio'`,
      [req.params.id]
    );
    if (enPredioBloqueando.length) {
      return res.status(409).json({ error: 'No se puede eliminar: el camión está actualmente en el predio' });
    }

    await pool.query('DELETE FROM camion WHERE id = $1', [req.params.id]);
    res.json({ mensaje: 'Camión eliminado' });
  } catch (e) {
    console.error('[DELETE /camiones/:id]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/qr', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, qr.codigo AS app_codigo
       FROM camion c LEFT JOIN app_camion_qr qr ON qr.camion_id = c.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Camión no encontrado' });

    const camion = rows[0];
    let codigo = camion.app_codigo;

    // Asignar código QR si no tiene
    if (!codigo) {
      codigo = crypto.randomUUID();
      await pool.query(
        `INSERT INTO app_camion_qr (camion_id, codigo) VALUES ($1, $2)
         ON CONFLICT (camion_id) DO UPDATE SET codigo = EXCLUDED.codigo`,
        [camion.id, codigo]
      );
    }

    const png = await QRCode.toBuffer(codigo, {
      width: 400, margin: 2,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="qr-${camion.patente}.png"`);
    res.send(png);
  } catch (e) {
    console.error('[GET /camiones/:id/qr]', e.message);
    res.status(500).json({ error: 'Error generando QR' });
  }
});

module.exports = router;
