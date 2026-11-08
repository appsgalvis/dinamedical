const sql = require('mssql');
require('dotenv').config();

// Configuración de conexión a MSSQL (contenedor compartido)
const configuracion = {
    server: process.env.DB_SERVIDOR || 'mssql',
    port: parseInt(process.env.DB_PUERTO) || 1433,
    user: process.env.DB_USUARIO || 'sa',
    password: process.env.DB_CONTRASENA || 'AppGalvis@2024',
    database: process.env.DB_NOMBRE || 'dinamedical',
    options: {
        encrypt: process.env.DB_OPCIONES_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_OPCIONES_TRUST_CERTIFICADO !== 'false',
        enableArithAbort: true,
        connectionTimeout: 30000,
        requestTimeout: 30000
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let pool = null;

async function obtenerConexion() {
    if (pool) return pool;
    pool = await sql.connect(configuracion);
    return pool;
}

async function cerrarConexion() {
    if (pool) {
        await pool.close();
        pool = null;
    }
}

module.exports = { sql, obtenerConexion, cerrarConexion };
