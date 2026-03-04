const express = require('express');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const { tipo } = req.query;
  const query = tipo
    ? db.prepare("SELECT * FROM catalogos WHERE tipo = ? AND activo = 1 ORDER BY valor ASC")
    : db.prepare("SELECT * FROM catalogos WHERE activo = 1 ORDER BY tipo, valor ASC");

  const items = tipo ? query.all(tipo) : query.all();

  const agrupados = items.reduce((acc, item) => {
    if (!acc[item.tipo]) acc[item.tipo] = [];
    acc[item.tipo].push(item.valor);
    return acc;
  }, {});

  res.json(agrupados);
});

router.post('/', (req, res) => {
  if (req.user.rol !== 'superadmin') {
    return res.status(403).json({ error: 'Solo superadmin puede gestionar catálogos' });
  }
  const { tipo, valor } = req.body;
  if (!tipo || !valor) return res.status(400).json({ error: 'tipo y valor requeridos' });

  const { lastInsertRowid } = db.prepare("INSERT INTO catalogos (tipo, valor) VALUES (?, ?)").run(tipo, valor);
  res.status(201).json({ id: lastInsertRowid, tipo, valor });
});

router.delete('/:id', (req, res) => {
  if (req.user.rol !== 'superadmin') {
    return res.status(403).json({ error: 'Solo superadmin puede gestionar catálogos' });
  }
  db.prepare("UPDATE catalogos SET activo = 0 WHERE id = ?").run(req.params.id);
  res.json({ mensaje: 'Ítem eliminado' });
});

module.exports = router;
