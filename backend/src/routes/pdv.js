const express = require('express');
const { pool } = require('../db');
const { authMiddleware, soloSuperAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware, soloSuperAdmin);

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        pv.id,
        pv.numero,
        pv.nombre,
        pv.mostrar                AS activo,
        u.id                      AS usuario_id,
        u.nome                    AS usuario_nombre,
        u.codigoacesso            AS usuario_username,
        u.habilitado              AS usuario_activo
      FROM puntoventa pv
      LEFT JOIN app_usuario_pdv aup ON aup.puntoventa_id = pv.id
      LEFT JOIN usuario u           ON u.id = aup.usuario_id
      WHERE pv.mostrar = true
      ORDER BY pv.numero ASC
    `);
    res.json(rows);
  } catch (e) {
    console.error('[GET /pdv]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Lista de todos los usuarios con su rol y PDV asociado
router.get('/usuarios', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        u.id,
        u.codigoacesso   AS username,
        u.nome           AS nombre,
        u.habilitado,
        u.superusuario,
        pv.id            AS pdv_id,
        pv.numero        AS pdv_numero,
        pv.nombre        AS pdv_nombre
      FROM usuario u
      LEFT JOIN app_usuario_pdv aup ON aup.usuario_id = u.id
      LEFT JOIN puntoventa pv       ON pv.id = aup.puntoventa_id
      ORDER BY u.superusuario DESC, u.codigoacesso ASC
    `);
    res.json(rows);
  } catch (e) {
    console.error('[GET /pdv/usuarios]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Lista de usuarios disponibles para asignar a un PDV
router.get('/usuarios-disponibles', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.nome AS nombre, u.codigoacesso AS username, u.habilitado
      FROM usuario u
      WHERE u.superusuario = false
      ORDER BY u.codigoacesso ASC
    `);
    res.json(rows);
  } catch (e) {
    console.error('[GET /pdv/usuarios-disponibles]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Asignar un usuario existente a un PDV
router.post('/:id/asignar-usuario', async (req, res) => {
  const { usuario_id } = req.body;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });
  try {
    await pool.query(`
      INSERT INTO app_usuario_pdv (usuario_id, puntoventa_id)
      VALUES ($1, $2)
      ON CONFLICT (usuario_id) DO UPDATE SET puntoventa_id = $2
    `, [usuario_id, req.params.id]);
    res.json({ mensaje: 'Usuario asignado al PDV' });
  } catch (e) {
    console.error('[POST /pdv/:id/asignar-usuario]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  const { numero, nombre, username, password } = req.body;
  if (!numero || !nombre || !username || !password) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query(
      'SELECT id FROM usuario WHERE codigoacesso = $1', [username]
    );
    if (existing.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'El nombre de usuario ya está en uso' });
    }

    const { rows: existePdv } = await client.query(
      'SELECT id FROM puntoventa WHERE numero = $1', [numero]
    );
    if (existePdv.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'El número de punto de venta ya existe' });
    }

    const { rows: pvRows } = await client.query(
      `INSERT INTO puntoventa (nombre, numero, mostrar) VALUES ($1, $2, true) RETURNING id`,
      [nombre, numero]
    );
    const pdvId = pvRows[0].id;

    const { rows: uRows } = await client.query(
      `INSERT INTO usuario (codigoacesso, senha, nome, habilitado, superusuario, empresa_chavefiscal, estilo_id, idioma_id)
       VALUES ($1, $2, $3, true, false, '654321', 5, 1)
       RETURNING id`,
      [username, password, nombre]
    );
    const userId = uRows[0].id;

    await client.query(
      `INSERT INTO app_usuario_pdv (usuario_id, puntoventa_id) VALUES ($1, $2)`,
      [userId, pdvId]
    );

    await client.query('COMMIT');
    res.status(201).json({ mensaje: 'Punto de venta creado', pdvId });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[POST /pdv]', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT pv.*, u.id AS usuario_id FROM puntoventa pv
       LEFT JOIN app_usuario_pdv aup ON aup.puntoventa_id = pv.id
       LEFT JOIN usuario u           ON u.id = aup.usuario_id
       WHERE pv.id = $1`,
      [req.params.id]
    );
    const pdv = rows[0];
    if (!pdv) return res.status(404).json({ error: 'Punto de venta no encontrado' });

    await client.query('BEGIN');

    const { nombre, username, password, activo } = req.body;

    if (nombre) {
      await client.query('UPDATE puntoventa SET nombre = $1 WHERE id = $2', [nombre, pdv.id]);
      if (pdv.usuario_id) {
        await client.query('UPDATE usuario SET nome = $1 WHERE id = $2', [nombre, pdv.usuario_id]);
      }
    }

    if (username && pdv.usuario_id) {
      const { rows: col } = await client.query(
        'SELECT id FROM usuario WHERE codigoacesso = $1 AND id != $2', [username, pdv.usuario_id]
      );
      if (col.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'El nombre de usuario ya está en uso' });
      }
      await client.query('UPDATE usuario SET codigoacesso = $1 WHERE id = $2', [username, pdv.usuario_id]);
    }

    if (password && pdv.usuario_id) {
      await client.query('UPDATE usuario SET senha = $1 WHERE id = $2', [password, pdv.usuario_id]);
    }

    if (activo !== undefined) {
      await client.query('UPDATE puntoventa SET mostrar = $1 WHERE id = $2', [activo, pdv.id]);
      if (pdv.usuario_id) {
        await client.query('UPDATE usuario SET habilitado = $1 WHERE id = $2', [activo, pdv.usuario_id]);
      }
    }

    await client.query('COMMIT');
    res.json({ mensaje: 'Punto de venta actualizado' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[PUT /pdv/:id]', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id FROM puntoventa WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Punto de venta no encontrado' });

    await pool.query('UPDATE puntoventa SET mostrar = false WHERE id = $1', [req.params.id]);
    res.json({ mensaje: 'Punto de venta desactivado' });
  } catch (e) {
    console.error('[DELETE /pdv/:id]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
