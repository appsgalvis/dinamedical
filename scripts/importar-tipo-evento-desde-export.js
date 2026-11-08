/**
 * Importa TipoEvento desde JSON exportado (get_table_data MCP SIVIGILA)
 * Uso: node scripts/importar-tipo-evento-desde-export.js ruta/al/export.json
 */
try { require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') }); } catch (_) {}
const fs = require('fs');
const path = require('path');
const sql = require('mssql');

const exportPath = process.argv[2];
if (!exportPath || !fs.existsSync(exportPath)) {
    console.error('Uso: node importar-tipo-evento-desde-export.js <archivo.json>');
    process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
const filas = raw.data || raw.recordset || raw;
if (!Array.isArray(filas)) {
    console.error('Formato no reconocido: se esperaba { data: [...] }');
    process.exit(1);
}

function limpiar(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
}

const activos = filas.filter(r => r.activo === 'T' || r.activo === true);

const configLocal = {
    server: process.env.DB_SERVIDOR || 'localhost',
    port: parseInt(process.env.DB_PUERTO, 10) || 1433,
    user: process.env.DB_USUARIO || 'sa',
    password: process.env.DB_CONTRASENA || 'AppGalvis@2024',
    database: process.env.DB_NOMBRE || 'dinamedical',
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true }
};

async function main() {
    const pool = await sql.connect(configLocal);
    const existe = await pool.request().query("SELECT OBJECT_ID('tipo_evento') AS id");
    if (!existe.recordset[0]?.id) {
        console.error('Ejecute migración 017 primero.');
        process.exit(1);
    }
    await pool.request().query('DELETE FROM tipo_evento');
    for (const row of activos) {
        await pool.request()
            .input('codigo', limpiar(row.cod_eve))
            .input('nombre', limpiar(row.nom_eve))
            .input('inmediata', row.inmediata === 'S' ? 1 : 0)
            .input('tip_not', row.tip_not || null)
            .input('formulario', row.formulario ?? null)
            .input('version', row.version ? limpiar(row.version) : null)
            .input('estado', row.estado_eve ? limpiar(row.estado_eve) : null)
            .query(`
                INSERT INTO tipo_evento (codigo, nombre, notificacion_inmediata, tipo_notificacion,
                    id_formulario, version, estado, activo, sincronizado_en)
                VALUES (@codigo, @nombre, @inmediata, @tip_not, @formulario, @version, @estado, 1, GETDATE())
            `);
    }
    const outJson = activos.map(r => ({
        codigo: limpiar(r.cod_eve),
        nombre: limpiar(r.nom_eve),
        notificacion_inmediata: r.inmediata === 'S' ? 1 : 0,
        tipo_notificacion: r.tip_not,
        id_formulario: r.formulario,
        version: limpiar(r.version),
        estado: limpiar(r.estado_eve)
    }));
    fs.writeFileSync(path.join(__dirname, 'tipo-evento-sivigila.json'), JSON.stringify(outJson, null, 2));
    await pool.close();
    console.log(`✅ ${activos.length} eventos importados (activo=T)`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
