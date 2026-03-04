const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Mapeo de estado string (app) ↔ estado_id (PG)
function toEstadoId(estado) {
  if (estado === 'anulado') return 4;
  if (estado === 'emitido') return 3;
  return 2; // borrador → "Cargado"
}

function toEstadoLabel(estado_id) {
  if (parseInt(estado_id) === 4) return 'anulado';
  if (parseInt(estado_id) === 3) return 'emitido';
  return 'borrador';
}

// Query base con todos los JOINs para enriquecer la respuesta
const SELECT_DESPACHO = `
  SELECT
    d.*,
    ROUND((d.pesobruto - d.taracamion)::numeric, 3)       AS toneladas_ingresada,
    CASE d.estado_id WHEN 4 THEN 'anulado'
                     WHEN 3 THEN 'emitido'
                     ELSE        'borrador' END             AS estado,
    d.nroremito                                             AS numero,
    d.fecha                                                 AS fecha_emision,
    pv.nombre    AS pdv_nombre,
    pv.numero    AS pdv_numero,
    cl.nombre1   AS cliente,
    pr.nombre    AS predio,
    prod.nombre  AS producto,
    esp.nombre   AS especie,
    bal.nombre   AS balanza,
    et.nombre1   AS empresa_transporte,
    cam.patente  AS camion_patente,
    cat.nombre   AS categoria_nombre,
    sc.nombre    AS subcategoria_nombre,
    er.nombre    AS estado_nombre,
    elab.nombre1 AS elaborador_nombre,
    extr.nombre1 AS extractor_nombre,
    carg.nombre1 AS cargador_nombre
  FROM despacho d
  LEFT JOIN puntoventa        pv   ON pv.id   = d.puntoventa_id
  LEFT JOIN cliente           cl   ON cl.id   = d.cliente_id
  LEFT JOIN predio            pr   ON pr.id   = d.predio_id
  LEFT JOIN producto          prod ON prod.id = d.producto_id
  LEFT JOIN especie           esp  ON esp.id  = d.especie_id
  LEFT JOIN balanza           bal  ON bal.id  = d.balanza_id
  LEFT JOIN empresatransporte et   ON et.id   = d.empresatransporte_id
  LEFT JOIN camion            cam  ON cam.id  = d.camion_id
  LEFT JOIN categoria         cat  ON cat.id  = d.categoria_id
  LEFT JOIN subcategoria      sc   ON sc.id   = d.subcategoria_id
  LEFT JOIN estadoremito      er   ON er.id   = d.estado_id
  LEFT JOIN cliente           elab ON elab.id = d.elaborador_id
  LEFT JOIN cliente           extr ON extr.id = d.extractor_id
  LEFT JOIN cliente           carg ON carg.id = d.cargador_id
`;

router.get('/', async (req, res) => {
  try {
    const { pdv_id, estado, desde, hasta } = req.query;
    const userPdvId = req.user.rol === 'pdv' ? req.user.pdv_id : null;

    const conditions = ['1=1'];
    const params = [];

    if (userPdvId) {
      params.push(userPdvId);
      conditions.push(`d.puntoventa_id = $${params.length}`);
    } else if (pdv_id) {
      params.push(pdv_id);
      conditions.push(`d.puntoventa_id = $${params.length}`);
    }

    if (estado) {
      params.push(toEstadoId(estado));
      conditions.push(`d.estado_id = $${params.length}`);
    }

    if (desde) {
      params.push(desde);
      conditions.push(`d.fecha::date >= $${params.length}`);
    }

    if (hasta) {
      params.push(hasta);
      conditions.push(`d.fecha::date <= $${params.length}`);
    }

    const sql = `${SELECT_DESPACHO} WHERE ${conditions.join(' AND ')} ORDER BY d.id DESC LIMIT 500`;
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('[GET /remitos]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `${SELECT_DESPACHO} WHERE d.id = $1`,
      [req.params.id]
    );

    const remito = rows[0];
    if (!remito) return res.status(404).json({ error: 'Remito no encontrado' });

    const userPdvId = req.user.rol === 'pdv' ? req.user.pdv_id : null;
    if (userPdvId && parseInt(remito.puntoventa_id) !== parseInt(userPdvId)) {
      return res.status(403).json({ error: 'Sin acceso a este remito' });
    }

    res.json(remito);
  } catch (e) {
    console.error('[GET /remitos/:id]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const userPdvId = req.user.rol === 'pdv' ? req.user.pdv_id : null;
    const puntoventa_id = userPdvId || req.body.puntoventa_id;

    if (!puntoventa_id) return res.status(400).json({ error: 'puntoventa_id requerido' });

    // Número de remito: siguiente al máximo numérico del PDV
    const { rows: maxRows } = await pool.query(
      `SELECT MAX(nroremito::integer) AS max FROM despacho
       WHERE puntoventa_id = $1 AND nroremito ~ '^[0-9]+$'`,
      [puntoventa_id]
    );
    const nroremito = String((maxRows[0]?.max || 0) + 1);

    const {
      cliente_id, predio_id, rodal, producto_id, especie_id,
      categoria_id, subcategoria_id, elaborador_id, extractor_id, cargador_id,
      balanza_id, camion_id, acopladocamion_id, empresatransporte_id,
      taracamion, pesobruto, volumencliente, m3, largos, largo,
      conductor, dniconductor, distancia, observaciones,
      estado = 'borrador', fecha,
    } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO despacho (
        nroremito, puntoventa_id, fecha,
        cliente_id, predio_id, rodal, producto_id, especie_id,
        categoria_id, subcategoria_id,
        elaborador_id, extractor_id, cargador_id,
        balanza_id, camion_id, acopladocamion_id, empresatransporte_id,
        taracamion, pesobruto, volumencliente,
        m3, largos, largo,
        conductor, dniconductor, distancia, observaciones,
        estado_id, nombreusuario
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
        $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29
      ) RETURNING id`,
      [
        nroremito, puntoventa_id, fecha || new Date(),
        cliente_id || null, predio_id || null, rodal || null,
        producto_id || null, especie_id || null,
        categoria_id || null, subcategoria_id || null,
        elaborador_id || null, extractor_id || null, cargador_id || null,
        balanza_id || null, camion_id || null, acopladocamion_id || null,
        empresatransporte_id || null,
        taracamion || 0, pesobruto || 0, volumencliente || 0,
        m3 || null, largos || null, largo || null,
        conductor || null, dniconductor || null, distancia || null,
        observaciones || null,
        toEstadoId(estado), req.user.username,
      ]
    );

    const { rows: full } = await pool.query(`${SELECT_DESPACHO} WHERE d.id = $1`, [rows[0].id]);
    res.status(201).json(full[0]);
  } catch (e) {
    console.error('[POST /remitos]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { rows: existing } = await pool.query(
      'SELECT * FROM despacho WHERE id = $1', [req.params.id]
    );
    const remito = existing[0];
    if (!remito) return res.status(404).json({ error: 'Remito no encontrado' });

    const userPdvId = req.user.rol === 'pdv' ? req.user.pdv_id : null;
    if (userPdvId && parseInt(remito.puntoventa_id) !== parseInt(userPdvId)) {
      return res.status(403).json({ error: 'Sin acceso a este remito' });
    }
    if (parseInt(remito.estado_id) === 4) {
      return res.status(400).json({ error: 'No se puede modificar un remito cancelado' });
    }

    const camposPG = {
      cliente_id: 'cliente_id',
      predio_id: 'predio_id',
      rodal: 'rodal',
      producto_id: 'producto_id',
      especie_id: 'especie_id',
      categoria_id: 'categoria_id',
      subcategoria_id: 'subcategoria_id',
      elaborador_id: 'elaborador_id',
      extractor_id: 'extractor_id',
      cargador_id: 'cargador_id',
      balanza_id: 'balanza_id',
      camion_id: 'camion_id',
      acopladocamion_id: 'acopladocamion_id',
      empresatransporte_id: 'empresatransporte_id',
      taracamion: 'taracamion',
      pesobruto: 'pesobruto',
      volumencliente: 'volumencliente',
      m3: 'm3',
      largos: 'largos',
      largo: 'largo',
      conductor: 'conductor',
      dniconductor: 'dniconductor',
      distancia: 'distancia',
      observaciones: 'observaciones',
      fecha: 'fecha',
    };

    const sets = [];
    const vals = [];

    for (const [bodyKey, pgCol] of Object.entries(camposPG)) {
      if (req.body[bodyKey] !== undefined) {
        vals.push(req.body[bodyKey]);
        sets.push(`${pgCol} = $${vals.length}`);
      }
    }

    if (req.body.estado !== undefined) {
      vals.push(toEstadoId(req.body.estado));
      sets.push(`estado_id = $${vals.length}`);
    }

    if (!sets.length) return res.status(400).json({ error: 'Sin campos para actualizar' });

    vals.push(new Date(), req.user.username, req.params.id);
    sets.push(`fechaedicion = $${vals.length - 2}`, `usuarioedicion = $${vals.length - 1}`);

    await pool.query(
      `UPDATE despacho SET ${sets.join(', ')} WHERE id = $${vals.length}`,
      vals
    );

    const { rows: full } = await pool.query(`${SELECT_DESPACHO} WHERE d.id = $1`, [req.params.id]);
    res.json(full[0]);
  } catch (e) {
    console.error('[PUT /remitos/:id]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id/anular', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, estado_id, puntoventa_id FROM despacho WHERE id = $1',
      [req.params.id]
    );
    const remito = rows[0];
    if (!remito) return res.status(404).json({ error: 'Remito no encontrado' });

    const { motivo } = req.body;
    await pool.query(
      `UPDATE despacho
       SET estado_id = 4, motivocancelacion = $1,
           fechacancelacion = NOW(), usuariocancelacion = $2
       WHERE id = $3`,
      [motivo || null, req.user.username, req.params.id]
    );

    res.json({ mensaje: 'Remito anulado' });
  } catch (e) {
    console.error('[PATCH /remitos/:id/anular]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
