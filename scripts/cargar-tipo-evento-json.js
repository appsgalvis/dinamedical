/**
 * Carga scripts/tipo-evento-sivigila.json en dinamedical.tipo_evento
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const sql = require('mssql');

const jsonPath = path.join(__dirname, 'tipo-evento-sivigila.json');

const configLocal = {
    server: process.env.DB_SERVIDOR || 'localhost',
    port: parseInt(process.env.DB_PUERTO, 10) || 1433,
    user: process.env.DB_USUARIO || 'sa',
    password: process.env.DB_CONTRASENA || 'AppGalvis@2024',
    database: process.env.DB_NOMBRE || 'dinamedical',
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true }
};

async function main() {
    if (!fs.existsSync(jsonPath)) {
        console.error('No existe', jsonPath);
        process.exit(1);
    }
    const eventos = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const pool = await sql.connect(configLocal);
    await pool.request().query('DELETE FROM tipo_evento');
    for (const e of eventos) {
        await pool.request()
            .input('codigo', e.codigo)
            .input('nombre', e.nombre)
            .input('inmediata', e.notificacion_inmediata ? 1 : 0)
            .input('tip_not', e.tipo_notificacion || null)
            .input('formulario', e.id_formulario ?? null)
            .input('version', e.version || null)
            .input('estado', e.estado || null)
            .query(`
                INSERT INTO tipo_evento (codigo, nombre, notificacion_inmediata, tipo_notificacion,
                    id_formulario, version, estado, activo, sincronizado_en)
                VALUES (@codigo, @nombre, @inmediata, @tip_not, @formulario, @version, @estado, 1, GETDATE())
            `);
    }
    await pool.close();
    console.log('OK:', eventos.length, 'eventos en tipo_evento');
}

main().catch(err => { console.error(err.message); process.exit(1); });
