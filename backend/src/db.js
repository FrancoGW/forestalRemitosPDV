const { Pool, Client } = require('pg');

const dbConfig = {
  host:     process.env.PG_HOST,
  port:     parseInt(process.env.PG_PORT || '5432'),
  user:     process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
};

const pool = new Pool({
  ...dbConfig,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis:       3000,   // Cierra conexiones inactivas en 3s
  max:                     2,      // Máximo 2 conexiones simultáneas
  min:                     0,      // No mantener conexiones abiertas en reposo
  allowExitOnIdle:         true,
});

async function initDB() {
  // Usar un client directo (no el pool) para el arranque
  const client = new Client(dbConfig);
  try {
    await client.connect();

    // Matar conexiones idle zombie de deploys anteriores
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND state = 'idle'
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS app_usuario_pdv (
        usuario_id    INTEGER NOT NULL UNIQUE,
        puntoventa_id INTEGER,
        PRIMARY KEY (usuario_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS app_camion_qr (
        camion_id INTEGER NOT NULL UNIQUE,
        codigo    VARCHAR(100) UNIQUE,
        PRIMARY KEY (camion_id)
      )
    `);

    // Llaveros NFC: cada llavero tiene un uid_nfc único y puede estar asociado a un camión
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_camion_nfc (
        id         SERIAL PRIMARY KEY,
        uid_nfc    VARCHAR(100) NOT NULL UNIQUE,
        camion_id  INTEGER REFERENCES camion(id) ON DELETE SET NULL,
        alias      VARCHAR(100),
        activo     BOOLEAN NOT NULL DEFAULT TRUE,
        creado_en  TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS app_movimientos (
        id            SERIAL PRIMARY KEY,
        camion_id     INTEGER NOT NULL,
        puntoventa_id INTEGER NOT NULL,
        despacho_id   INTEGER,
        fecha_entrada TIMESTAMP NOT NULL DEFAULT NOW(),
        fecha_salida  TIMESTAMP,
        estado        VARCHAR(20) NOT NULL DEFAULT 'en_predio'
                        CHECK(estado IN ('en_predio','salio')),
        notas         TEXT
      )
    `);

    console.log('[DB] PostgreSQL conectado y tablas de app inicializadas');
  } catch (err) {
    console.error('[DB] Error en initDB:', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

module.exports = { pool, initDB };
