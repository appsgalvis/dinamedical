/**
 * Copia dbo.TipoEvento (activo=T) desde SIVIGILA a dinamedical.tipo_evento
 *
 * Variables de entorno opcionales:
 *   SIVIGILA_SERVER, SIVIGILA_USER, SIVIGILA_PASSWORD, SIVIGILA_DATABASE
 * Local: DB_SERVIDOR, DB_USUARIO, DB_CONTRASENA, DB_NOMBRE (como la API)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const sql = require('mssql');

const configSivigila = {
    server: process.env.SIVIGILA_SERVER || '10.10.100.25\\DESARROLLO',
    user: process.env.SIVIGILA_USER,
    password: process.env.SIVIGILA_PASSWORD,
    database: process.env.SIVIGILA_DATABASE || 'Sivigila',
    options: {
        encrypt: process.env.SIVIGILA_ENCRYPT === 'true',
        trustServerCertificate: true,
        enableArithAbort: true
    },
    requestTimeout: 120000
};

const configLocal = {
    server: process.env.DB_SERVIDOR || 'localhost',
    port: parseInt(process.env.DB_PUERTO, 10) || 1433,
    user: process.env.DB_USUARIO || 'sa',
    password: process.env.DB_CONTRASENA || 'AppGalvis@2024',
    database: process.env.DB_NOMBRE || 'dinamedical',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

function limpiarNombre(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
}

async function main() {
    if (!configSivigila.user || !configSivigila.password) {
        console.error('❌ Defina SIVIGILA_USER y SIVIGILA_PASSWORD en .env o variables de entorno.');
        process.exit(1);
    }

    console.log('🔍 Conectando a SIVIGILA...');
    const poolRemoto = await sql.connect(configSivigila);
    const origen = await poolRemoto.request().query(`
        SELECT cod_eve, nom_eve, inmediata, tip_not, formulario, version, estado_eve, activo
        FROM dbo.TipoEvento
        WHERE activo = 'T'
        ORDER BY cod_eve
    `);
    await poolRemoto.close();
    console.log(`✓ ${origen.recordset.length} eventos activos leídos.`);

    console.log('💾 Conectando a dinamedical local...');
    const poolLocal = await new sql.ConnectionPool(configLocal).connect();

    await poolLocal.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tipo_evento')
        BEGIN
            RAISERROR('Ejecute migración 017 antes de sincronizar.', 16, 1);
        END
    `);

    await poolLocal.request().query('DELETE FROM tipo_evento');

    let insertados = 0;
    for (const row of origen.recordset) {
        await poolLocal.request()
            .input('codigo', limpiarNombre(row.cod_eve))
            .input('nombre', limpiarNombre(row.nom_eve))
            .input('inmediata', row.inmediata === 'S' ? 1 : 0)
            .input('tip_not', row.tip_not || null)
            .input('formulario', row.formulario ?? null)
            .input('version', row.version ? String(row.version).trim() : null)
            .input('estado', row.estado_eve ? String(row.estado_eve).trim() : null)
            .query(`
                INSERT INTO tipo_evento (codigo, nombre, notificacion_inmediata, tipo_notificacion,
                    id_formulario, version, estado, activo, sincronizado_en)
                VALUES (@codigo, @nombre, @inmediata, @tip_not, @formulario, @version, @estado, 1, GETDATE())
            `);
        insertados++;
    }

    await poolLocal.close();
    console.log(`✅ ${insertados} eventos copiados a dinamedical.tipo_evento`);
}

main().catch(err => {
    console.error('❌', err.message);
    process.exit(1);
});
