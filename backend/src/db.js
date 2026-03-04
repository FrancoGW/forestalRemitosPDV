const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'remitero.db');

const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS camiones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      patente TEXT,
      cliente TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      rol TEXT NOT NULL CHECK(rol IN ('superadmin', 'pdv')),
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS puntos_de_venta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero INTEGER UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS catalogos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      valor TEXT NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS remitos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero INTEGER NOT NULL,
      pdv_id INTEGER NOT NULL REFERENCES puntos_de_venta(id),
      fecha_emision TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_facturacion TEXT,
      cliente TEXT NOT NULL,
      predio TEXT NOT NULL,
      rodal TEXT NOT NULL,
      producto TEXT NOT NULL,
      especie TEXT NOT NULL,
      categoria TEXT NOT NULL,
      sub_categoria TEXT NOT NULL,
      empresa_elaboracion TEXT NOT NULL,
      empresa_extraccion TEXT NOT NULL,
      empresa_carga TEXT NOT NULL,
      balanza TEXT NOT NULL,
      patente_camion TEXT NOT NULL,
      tara REAL NOT NULL DEFAULT 0,
      peso_bruto REAL NOT NULL DEFAULT 0,
      toneladas_ingresada REAL GENERATED ALWAYS AS (peso_bruto - tara) STORED,
      toneladas_cliente REAL NOT NULL DEFAULT 0,
      patente_acoplado TEXT,
      m3 REAL,
      largos TEXT,
      transporte TEXT,
      nombre_conductor TEXT,
      dni_conductor TEXT,
      distancia_km REAL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'borrador' CHECK(estado IN ('borrador','emitido','anulado')),
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      camion_id INTEGER NOT NULL REFERENCES camiones(id),
      pdv_id INTEGER NOT NULL REFERENCES puntos_de_venta(id),
      remito_id INTEGER REFERENCES remitos(id),
      fecha_entrada TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_salida TEXT,
      estado TEXT NOT NULL DEFAULT 'en_predio' CHECK(estado IN ('en_predio','salio')),
      notas TEXT
    );
  `);

  seedSuperAdmin();
  seedCatalogos();
}

function seedSuperAdmin() {
  const existing = db.prepare("SELECT id FROM usuarios WHERE rol = 'superadmin' LIMIT 1").get();
  if (!existing) {
    const hash = bcrypt.hashSync('admin1234', 10);
    db.prepare(`
      INSERT INTO usuarios (nombre, username, password, rol)
      VALUES ('Super Admin', 'admin', ?, 'superadmin')
    `).run(hash);
    console.log('[DB] Superadmin creado → usuario: admin / contraseña: admin1234');
  }
}

function seedCatalogos() {
  const count = db.prepare("SELECT COUNT(*) as c FROM catalogos").get();
  if (count.c > 0) return;

  const items = [
    ['producto',     'Aserrable'],
    ['producto',     'Debobinado'],
    ['producto',     'Triturado'],
    ['especie',      'Pino'],
    ['especie',      'Eucalipto'],
    ['especie',      'Álamo'],
    ['categoria',    'Super Grueso'],
    ['categoria',    'Grueso'],
    ['categoria',    'Mediano'],
    ['categoria',    'Fino'],
    ['sub_categoria','Super Grueso'],
    ['sub_categoria','Grueso'],
    ['sub_categoria','Mediano'],
    ['sub_categoria','Fino'],
    ['balanza',      'La Fuente'],
    ['balanza',      'El Alamo'],
    ['balanza',      'Central'],
  ];

  const stmt = db.prepare("INSERT INTO catalogos (tipo, valor) VALUES (?, ?)");
  for (const [tipo, valor] of items) stmt.run(tipo, valor);
  console.log('[DB] Catálogos iniciales cargados');
}

module.exports = { db, initDB };
