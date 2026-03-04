const express = require('express');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

function getPdvId(user) {
  if (user.rol === 'superadmin') return null;
  return user.pdv_id;
}

router.get('/', (req, res) => {
  const { pdv_id, estado, desde, hasta } = req.query;
  const userPdvId = getPdvId(req.user);

  let sql = `
    SELECT r.*, p.numero as pdv_numero, p.nombre as pdv_nombre
    FROM remitos r
    JOIN puntos_de_venta p ON p.id = r.pdv_id
    WHERE 1=1
  `;
  const params = [];

  if (userPdvId) {
    sql += ' AND r.pdv_id = ?';
    params.push(userPdvId);
  } else if (pdv_id) {
    sql += ' AND r.pdv_id = ?';
    params.push(pdv_id);
  }

  if (estado) { sql += ' AND r.estado = ?'; params.push(estado); }
  if (desde)  { sql += ' AND r.fecha_emision >= ?'; params.push(desde); }
  if (hasta)  { sql += ' AND r.fecha_emision <= ?'; params.push(hasta); }

  sql += ' ORDER BY r.id DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const remito = db.prepare("SELECT * FROM remitos WHERE id = ?").get(req.params.id);
  if (!remito) return res.status(404).json({ error: 'Remito no encontrado' });

  const userPdvId = getPdvId(req.user);
  if (userPdvId && remito.pdv_id !== userPdvId) {
    return res.status(403).json({ error: 'Sin acceso a este remito' });
  }
  res.json(remito);
});

router.post('/', (req, res) => {
  const userPdvId = getPdvId(req.user);
  const pdv_id = userPdvId || req.body.pdv_id;

  if (!pdv_id) return res.status(400).json({ error: 'pdv_id requerido' });

  const ultimo = db.prepare("SELECT MAX(numero) as max FROM remitos WHERE pdv_id = ?").get(pdv_id);
  const numero = (ultimo.max || 0) + 1;

  const {
    fecha_facturacion, cliente, predio, rodal, producto, especie,
    categoria, sub_categoria, empresa_elaboracion, empresa_extraccion,
    empresa_carga, balanza, patente_camion, tara, peso_bruto,
    toneladas_cliente, patente_acoplado, m3, largos,
    transporte, nombre_conductor, dni_conductor, distancia_km, estado
  } = req.body;

  const required = { cliente, predio, rodal, producto, especie, categoria, sub_categoria,
    empresa_elaboracion, empresa_extraccion, empresa_carga, balanza, patente_camion };
  const faltantes = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (faltantes.length) {
    return res.status(400).json({ error: `Campos requeridos: ${faltantes.join(', ')}` });
  }

  const { lastInsertRowid } = db.prepare(`
    INSERT INTO remitos (
      numero, pdv_id, fecha_facturacion, cliente, predio, rodal, producto, especie,
      categoria, sub_categoria, empresa_elaboracion, empresa_extraccion, empresa_carga,
      balanza, patente_camion, tara, peso_bruto, toneladas_cliente, patente_acoplado,
      m3, largos, transporte, nombre_conductor, dni_conductor, distancia_km, estado
    ) VALUES (
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    )
  `).run(
    numero, pdv_id, fecha_facturacion || null, cliente, predio, rodal, producto, especie,
    categoria, sub_categoria, empresa_elaboracion, empresa_extraccion, empresa_carga,
    balanza, patente_camion, tara || 0, peso_bruto || 0, toneladas_cliente || 0,
    patente_acoplado || null, m3 || null, largos || null, transporte || null,
    nombre_conductor || null, dni_conductor || null, distancia_km || 0,
    estado || 'borrador'
  );

  const remito = db.prepare("SELECT * FROM remitos WHERE id = ?").get(lastInsertRowid);
  res.status(201).json(remito);
});

router.put('/:id', (req, res) => {
  const remito = db.prepare("SELECT * FROM remitos WHERE id = ?").get(req.params.id);
  if (!remito) return res.status(404).json({ error: 'Remito no encontrado' });

  const userPdvId = getPdvId(req.user);
  if (userPdvId && remito.pdv_id !== userPdvId) {
    return res.status(403).json({ error: 'Sin acceso a este remito' });
  }
  if (remito.estado === 'anulado') {
    return res.status(400).json({ error: 'No se puede modificar un remito anulado' });
  }

  const campos = [
    'fecha_facturacion','cliente','predio','rodal','producto','especie',
    'categoria','sub_categoria','empresa_elaboracion','empresa_extraccion',
    'empresa_carga','balanza','patente_camion','tara','peso_bruto',
    'toneladas_cliente','patente_acoplado','m3','largos','transporte',
    'nombre_conductor','dni_conductor','distancia_km','estado'
  ];

  const sets = [];
  const vals = [];
  for (const campo of campos) {
    if (req.body[campo] !== undefined) {
      sets.push(`${campo} = ?`);
      vals.push(req.body[campo]);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'Sin campos para actualizar' });

  vals.push(req.params.id);
  db.prepare(`UPDATE remitos SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json(db.prepare("SELECT * FROM remitos WHERE id = ?").get(req.params.id));
});

router.patch('/:id/anular', (req, res) => {
  const remito = db.prepare("SELECT * FROM remitos WHERE id = ?").get(req.params.id);
  if (!remito) return res.status(404).json({ error: 'Remito no encontrado' });

  db.prepare("UPDATE remitos SET estado = 'anulado' WHERE id = ?").run(req.params.id);
  res.json({ mensaje: 'Remito anulado' });
});

module.exports = router;
