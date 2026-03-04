const { Pool } = require('pg');

const pool = new Pool({
  host:                    process.env.PG_HOST,
  port:                    parseInt(process.env.PG_PORT || '5432'),
  user:                    process.env.PG_USER,
  password:                process.env.PG_PASSWORD,
  database:                process.env.PG_DATABASE,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis:       10000,
  max:                     3,
  allowExitOnIdle:         true,
});

// Las tablas de la app usan IDs simples (sin FK a tablas de producción)
// para no generar locks sobre las tablas del sistema de producción.
async function initDB() {
  try {
    // Asocia usuarios de PG a un PDV en esta app
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_usuario_pdv (
        usuario_id    INTEGER NOT NULL UNIQUE,
        puntoventa_id INTEGER,
        PRIMARY KEY (usuario_id)
      )
    `);

    // Almacena el código QR de cada camión
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_camion_qr (
        camion_id INTEGER NOT NULL UNIQUE,
        codigo    VARCHAR(100) UNIQUE,
        PRIMARY KEY (camion_id)
      )
    `);

    // Registros de entrada/salida de camiones al predio
    await pool.query(`
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
  }
}

module.exports = { pool, initDB };
