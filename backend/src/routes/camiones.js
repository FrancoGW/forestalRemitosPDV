const express = require('express');
const { pool } = require('../db');
const { authMiddleware, soloSuperAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware, soloSuperAdmin);

// ─── Lista de camiones con estado en predio y llavero NFC asignado ───────────
router.get('/', async (req, res) => {
  try {
    const buscar = (req.query.buscar || '').trim();
    const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
    const limite = Math.min(100, parseInt(req.query.limite) || 50);
    const offset = (pagina - 1) * limite;

    const whereClause = buscar ? `WHERE c.patente ILIKE $1` : '';
    const params      = buscar ? [`%${buscar}%`] : [];

    const countParams = buscar ? [`%${buscar}%`] : [];
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) AS total FROM camion c ${whereClause}`,
      countParams
    );
    const total = parseInt(countRows[0].total);

    const limitOffsetParams = buscar ? [`%${buscar}%`, limite, offset] : [limite, offset];
    const limitIdx  = buscar ? 2 : 1;
    const offsetIdx = buscar ? 3 : 2;

    const { rows } = await pool.query(`
      SELECT
        c.id, c.patente, c.marca, c.modelo,
        nfc.id        AS nfc_id,
        nfc.uid_nfc   AS nfc_uid,
        nfc.alias     AS nfc_alias,
        nfc.activo    AS nfc_activo,
        (SELECT COUNT(*) FROM app_movimientos m WHERE m.camion_id = c.id)                            AS total_visitas,
        (SELECT COUNT(*) FROM app_movimientos m WHERE m.camion_id = c.id AND m.estado = 'en_predio') AS en_predio,
        (SELECT COUNT(*) FROM despacho d WHERE d.camion_id = c.id)                                   AS total_remitos,
        (SELECT COUNT(*) FROM despacho d WHERE d.camion_id = c.id AND d.estado_id = 3)               AS remitos_emitidos
      FROM camion c
      LEFT JOIN app_camion_nfc nfc ON nfc.camion_id = c.id AND nfc.activo = TRUE
      ${whereClause}
      ORDER BY c.patente ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `, limitOffsetParams);

    res.json({ data: rows, total, pagina, limite, paginas: Math.ceil(total / limite) });
  } catch (e) {
    console.error('[GET /camiones]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Crear camión ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { patente, marca, modelo } = req.body;
  if (!patente) return res.status(400).json({ error: 'La patente es requerida' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO camion (patente, marca, modelo) VALUES ($1, $2, $3) RETURNING *`,
      [patente.toUpperCase(), marca || null, modelo || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe un camión con esa patente' });
    console.error('[POST /camiones]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Editar camión ────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE camion
       SET patente = COALESCE($1, patente),
           marca   = COALESCE($2, marca),
           modelo  = COALESCE($3, modelo)
       WHERE id = $4
       RETURNING *`,
      [req.body.patente?.toUpperCase() || null, req.body.marca || null, req.body.modelo || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Camión no encontrado' });
    res.json(rows[0]);
  } catch (e) {
    console.error('[PUT /camiones/:id]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Eliminar camión ──────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rows: activo } = await pool.query(
      `SELECT id FROM app_movimientos WHERE camion_id = $1 AND estado = 'en_predio'`,
      [req.params.id]
    );
    if (activo.length) {
      return res.status(409).json({ error: 'No se puede eliminar: el camión está actualmente en el predio' });
    }
    const { rows } = await pool.query('DELETE FROM camion WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Camión no encontrado' });
    res.json({ mensaje: 'Camión eliminado' });
  } catch (e) {
    console.error('[DELETE /camiones/:id]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Llaveros NFC ─────────────────────────────────────────────────────────────

// Listar todos los llaveros
router.get('/nfc', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        nfc.id, nfc.uid_nfc, nfc.alias, nfc.activo, nfc.creado_en,
        c.id      AS camion_id,
        c.patente AS camion_patente,
        c.marca   AS camion_marca,
        c.modelo  AS camion_modelo
      FROM app_camion_nfc nfc
      LEFT JOIN camion c ON c.id = nfc.camion_id
      ORDER BY nfc.creado_en DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error('[GET /camiones/nfc]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Registrar un llavero nuevo (puede llegar sin camion_id asignado aún)
router.post('/nfc', async (req, res) => {
  const { uid_nfc, alias, camion_id } = req.body;
  if (!uid_nfc?.trim()) return res.status(400).json({ error: 'uid_nfc es requerido' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO app_camion_nfc (uid_nfc, alias, camion_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [uid_nfc.trim().toUpperCase(), alias || null, camion_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe un llavero con ese UID' });
    console.error('[POST /camiones/nfc]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Asociar / reasignar un llavero a un camión
router.patch('/nfc/:id', async (req, res) => {
  const { camion_id, alias, activo } = req.body;
  try {
    const sets = [];
    const vals = [];

    if (camion_id !== undefined) { vals.push(camion_id || null); sets.push(`camion_id = $${vals.length}`); }
    if (alias !== undefined)     { vals.push(alias || null);     sets.push(`alias = $${vals.length}`); }
    if (activo !== undefined)    { vals.push(activo);            sets.push(`activo = $${vals.length}`); }

    if (!sets.length) return res.status(400).json({ error: 'Sin campos para actualizar' });

    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE app_camion_nfc SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'Llavero no encontrado' });
    res.json(rows[0]);
  } catch (e) {
    console.error('[PATCH /camiones/nfc/:id]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Eliminar un llavero
router.delete('/nfc/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM app_camion_nfc WHERE id = $1 RETURNING id', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Llavero no encontrado' });
    res.json({ mensaje: 'Llavero eliminado' });
  } catch (e) {
    console.error('[DELETE /camiones/nfc/:id]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Escaneo NFC: recibe uid y determina si es entrada o salida ───────────────
router.post('/nfc/escanear', async (req, res) => {
  try {
    const { uid_nfc, pdv_id } = req.body;
    if (!uid_nfc)  return res.status(400).json({ error: 'uid_nfc requerido' });
    if (!pdv_id)   return res.status(400).json({ error: 'pdv_id requerido' });

    const uid = uid_nfc.trim().toUpperCase();

    // Buscar llavero
    const { rows: nfcRows } = await pool.query(
      `SELECT nfc.*, c.patente, c.marca, c.modelo
       FROM app_camion_nfc nfc
       LEFT JOIN camion c ON c.id = nfc.camion_id
       WHERE nfc.uid_nfc = $1 AND nfc.activo = TRUE`,
      [uid]
    );

    if (!nfcRows.length) {
      // Llavero desconocido: registrarlo como pendiente de asignación
      const { rows: nuevo } = await pool.query(
        `INSERT INTO app_camion_nfc (uid_nfc) VALUES ($1)
         ON CONFLICT (uid_nfc) DO UPDATE SET uid_nfc = EXCLUDED.uid_nfc
         RETURNING *`,
        [uid]
      );
      return res.status(202).json({
        accion: 'desconocido',
        mensaje: 'Llavero no registrado. Fue agregado para su asignación.',
        nfc: nuevo[0],
      });
    }

    const nfc = nfcRows[0];

    if (!nfc.camion_id) {
      return res.status(202).json({
        accion: 'sin_camion',
        mensaje: 'Llavero registrado pero sin camión asignado.',
        nfc,
      });
    }

    // Ver si el camión tiene una entrada activa
    const { rows: movActivo } = await pool.query(
      `SELECT m.*, pv.numero AS pdv_numero, pv.nombre AS pdv_nombre
       FROM app_movimientos m
       JOIN puntoventa pv ON pv.id = m.puntoventa_id
       WHERE m.camion_id = $1 AND m.estado = 'en_predio'
       ORDER BY m.fecha_entrada DESC LIMIT 1`,
      [nfc.camion_id]
    );

    if (movActivo.length) {
      // Registrar SALIDA automática
      const { rows: updated } = await pool.query(
        `UPDATE app_movimientos
         SET estado = 'salio', fecha_salida = NOW()
         WHERE id = $1 RETURNING *`,
        [movActivo[0].id]
      );
      return res.json({
        accion: 'salida',
        mensaje: `Salida registrada — ${nfc.patente}`,
        movimiento: updated[0],
        camion: { id: nfc.camion_id, patente: nfc.patente, marca: nfc.marca, modelo: nfc.modelo },
      });
    }

    // Registrar ENTRADA
    const { rows: entrada } = await pool.query(
      `INSERT INTO app_movimientos (camion_id, puntoventa_id)
       VALUES ($1, $2) RETURNING *`,
      [nfc.camion_id, pdv_id]
    );
    return res.status(201).json({
      accion: 'entrada',
      mensaje: `Entrada registrada — ${nfc.patente}`,
      movimiento: entrada[0],
      camion: { id: nfc.camion_id, patente: nfc.patente, marca: nfc.marca, modelo: nfc.modelo },
    });

  } catch (e) {
    console.error('[POST /camiones/nfc/escanear]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Estadísticas de camiones ─────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const { periodo = 'mes', desde, hasta } = req.query;
    const hoy = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);

    let fechaDesde, fechaHasta, groupExpr;
    let historico = false;

    switch (periodo) {
      case 'historico': historico = true; groupExpr = `TO_CHAR(fecha_entrada, 'YYYY-MM')`; break;
      case 'hoy':       fechaDesde = fechaHasta = fmt(hoy); groupExpr = `TO_CHAR(fecha_entrada, 'HH24:00')`; break;
      case 'semana':    { const d = new Date(hoy); d.setDate(d.getDate() - 6); fechaDesde = fmt(d); fechaHasta = fmt(hoy); groupExpr = `TO_CHAR(fecha_entrada, 'YYYY-MM-DD')`; break; }
      case 'mes':       { const d = new Date(hoy); d.setDate(d.getDate() - 29); fechaDesde = fmt(d); fechaHasta = fmt(hoy); groupExpr = `TO_CHAR(fecha_entrada, 'YYYY-MM-DD')`; break; }
      case 'año':       { const d = new Date(hoy); d.setMonth(d.getMonth() - 11); d.setDate(1); fechaDesde = fmt(d); fechaHasta = fmt(hoy); groupExpr = `TO_CHAR(fecha_entrada, 'YYYY-MM')`; break; }
      case 'personalizado': {
        fechaDesde = desde || fmt(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
        fechaHasta = hasta || fmt(hoy);
        const dias = Math.round((new Date(fechaHasta) - new Date(fechaDesde)) / 86400000);
        groupExpr = dias > 60 ? `TO_CHAR(fecha_entrada, 'YYYY-MM')` : `TO_CHAR(fecha_entrada, 'YYYY-MM-DD')`;
        break;
      }
      default: { const d = new Date(hoy); d.setDate(d.getDate() - 29); fechaDesde = fmt(d); fechaHasta = fmt(hoy); groupExpr = `TO_CHAR(fecha_entrada, 'YYYY-MM-DD')`; }
    }

    const dateWhere   = historico ? '' : `AND fecha_entrada::date >= $1 AND fecha_entrada::date <= $2`;
    const dateParams  = historico ? [] : [fechaDesde, fechaHasta];

    const [enPredio, linea, topPatentes, porPdv, tiempoPromedio, kpis] = await Promise.all([

      // Camiones actualmente en predio
      pool.query(`
        SELECT m.id, c.patente, c.marca, c.modelo, m.fecha_entrada,
               pv.numero AS pdv_numero, pv.nombre AS pdv_nombre
        FROM app_movimientos m
        JOIN camion c ON c.id = m.camion_id
        JOIN puntoventa pv ON pv.id = m.puntoventa_id
        WHERE m.estado = 'en_predio'
        ORDER BY m.fecha_entrada ASC
      `),

      // Ingresos por período
      pool.query(`
        SELECT ${groupExpr} AS label, COUNT(*) AS ingresos
        FROM app_movimientos
        WHERE 1=1 ${dateWhere}
        GROUP BY 1 ORDER BY 1 ASC
      `, dateParams),

      // Top patentes más frecuentes
      pool.query(`
        SELECT c.patente, COUNT(m.id) AS ingresos,
               ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(m.fecha_salida, NOW()) - m.fecha_entrada))/3600)::numeric, 1) AS horas_promedio
        FROM app_movimientos m
        JOIN camion c ON c.id = m.camion_id
        WHERE 1=1 ${dateWhere}
        GROUP BY c.patente
        ORDER BY ingresos DESC LIMIT 10
      `, dateParams),

      // Ingresos por PDV
      pool.query(`
        SELECT pv.numero, pv.nombre, COUNT(m.id) AS ingresos
        FROM app_movimientos m
        JOIN puntoventa pv ON pv.id = m.puntoventa_id
        WHERE 1=1 ${dateWhere}
        GROUP BY pv.numero, pv.nombre
        ORDER BY ingresos DESC
      `, dateParams),

      // Tiempo promedio en predio (horas) — solo movimientos con salida
      pool.query(`
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (fecha_salida - fecha_entrada))/3600)::numeric, 2) AS horas_promedio
        FROM app_movimientos
        WHERE estado = 'salio' AND fecha_salida IS NOT NULL ${dateWhere}
      `, dateParams),

      // KPIs generales del período
      pool.query(`
        SELECT
          COUNT(*) AS total_ingresos,
          COUNT(DISTINCT camion_id) AS camiones_unicos,
          SUM(CASE WHEN estado = 'en_predio' THEN 1 ELSE 0 END) AS en_predio_ahora
        FROM app_movimientos
        WHERE 1=1 ${dateWhere}
      `, dateParams),
    ]);

    const ni = (v) => parseInt(v) || 0;
    const n  = (v) => parseFloat(v) || 0;

    res.json({
      periodo: { desde: fechaDesde, hasta: fechaHasta, tipo: periodo },
      kpis: {
        total_ingresos:    ni(kpis.rows[0].total_ingresos),
        camiones_unicos:   ni(kpis.rows[0].camiones_unicos),
        en_predio_ahora:   ni(kpis.rows[0].en_predio_ahora),
        horas_promedio:    n(tiempoPromedio.rows[0]?.horas_promedio),
      },
      enPredio: enPredio.rows,
      linea: linea.rows.map(r => ({ label: r.label, ingresos: ni(r.ingresos) })),
      topPatentes: topPatentes.rows.map(r => ({
        patente:        r.patente,
        ingresos:       ni(r.ingresos),
        horas_promedio: n(r.horas_promedio),
      })),
      porPdv: porPdv.rows.map(r => ({
        pdv:      `PDV ${r.numero}`,
        numero:   ni(r.numero),
        ingresos: ni(r.ingresos),
      })),
    });
  } catch (e) {
    console.error('[GET /camiones/stats]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
