const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { authMiddleware, soloSuperAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware, soloSuperAdmin);

router.get('/', (req, res) => {
  const pdvs = db.prepare(`
    SELECT p.*, u.nombre as usuario_nombre, u.username as usuario_username, u.activo as usuario_activo
    FROM puntos_de_venta p
    JOIN usuarios u ON u.id = p.usuario_id
    ORDER BY p.numero ASC
  `).all();
  res.json(pdvs);
});

router.post('/', (req, res) => {
  const { numero, nombre, username, password } = req.body;
  if (!numero || !nombre || !username || !password) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }

  const existente = db.prepare("SELECT id FROM usuarios WHERE username = ?").get(username);
  if (existente) return res.status(409).json({ error: 'El nombre de usuario ya está en uso' });

  const existeNumero = db.prepare("SELECT id FROM puntos_de_venta WHERE numero = ?").get(numero);
  if (existeNumero) return res.status(409).json({ error: 'El número de punto de venta ya existe' });

  const hash = bcrypt.hashSync(password, 10);

  let result;
  try {
    db.exec('BEGIN');
    const { lastInsertRowid: userId } = db.prepare(`
      INSERT INTO usuarios (nombre, username, password, rol) VALUES (?, ?, ?, 'pdv')
    `).run(nombre, username, hash);
    const { lastInsertRowid: pdvId } = db.prepare(`
      INSERT INTO puntos_de_venta (numero, nombre, usuario_id) VALUES (?, ?, ?)
    `).run(numero, nombre, userId);
    db.exec('COMMIT');
    result = { userId, pdvId };
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  res.status(201).json({ mensaje: 'Punto de venta creado', ...result });
});

router.put('/:id', (req, res) => {
  const { nombre, username, password, activo } = req.body;
  const pdv = db.prepare("SELECT * FROM puntos_de_venta WHERE id = ?").get(req.params.id);
  if (!pdv) return res.status(404).json({ error: 'Punto de venta no encontrado' });

  try {
    db.exec('BEGIN');
    if (nombre) {
      db.prepare("UPDATE puntos_de_venta SET nombre = ? WHERE id = ?").run(nombre, pdv.id);
      db.prepare("UPDATE usuarios SET nombre = ? WHERE id = ?").run(nombre, pdv.usuario_id);
    }
    if (username) {
      const colision = db.prepare("SELECT id FROM usuarios WHERE username = ? AND id != ?").get(username, pdv.usuario_id);
      if (colision) { db.exec('ROLLBACK'); return res.status(409).json({ error: 'El nombre de usuario ya está en uso' }); }
      db.prepare("UPDATE usuarios SET username = ? WHERE id = ?").run(username, pdv.usuario_id);
    }
    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      db.prepare("UPDATE usuarios SET password = ? WHERE id = ?").run(hash, pdv.usuario_id);
    }
    if (activo !== undefined) {
      db.prepare("UPDATE puntos_de_venta SET activo = ? WHERE id = ?").run(activo ? 1 : 0, pdv.id);
      db.prepare("UPDATE usuarios SET activo = ? WHERE id = ?").run(activo ? 1 : 0, pdv.usuario_id);
    }
    db.exec('COMMIT');
    res.json({ mensaje: 'Punto de venta actualizado' });
  } catch (e) {
    db.exec('ROLLBACK');
    res.status(409).json({ error: e.message });
  }
});

router.delete('/:id', (req, res) => {
  const pdv = db.prepare("SELECT * FROM puntos_de_venta WHERE id = ?").get(req.params.id);
  if (!pdv) return res.status(404).json({ error: 'Punto de venta no encontrado' });

  db.prepare("DELETE FROM puntos_de_venta WHERE id = ?").run(pdv.id);
  res.json({ mensaje: 'Punto de venta eliminado' });
});

module.exports = router;
