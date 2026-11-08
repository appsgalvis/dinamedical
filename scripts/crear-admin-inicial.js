#!/usr/bin/env node
/**
 * Crea el usuario administrador inicial (admin_dinamedical)
 * Ejecutar después de la migración 001
 * Uso: node scripts/crear-admin-inicial.js
 * Variables: ADMIN_EMAIL, ADMIN_CLAVE, ADMIN_NOMBRE, ADMIN_APELLIDO
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const sql = require('mssql');

const config = {
    server: process.env.DB_SERVIDOR || 'mssql',
    port: parseInt(process.env.DB_PUERTO) || 1433,
    user: process.env.DB_USUARIO || 'sa',
    password: process.env.DB_CONTRASENA || 'AppGalvis@2024',
    database: process.env.DB_NOMBRE || 'dinamedical',
    options: {
        encrypt: process.env.DB_OPCIONES_ENCRYPT === 'true',
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@dinamedical.com';
const ADMIN_CLAVE = process.env.ADMIN_CLAVE || 'Admin123!';
const ADMIN_NOMBRE = process.env.ADMIN_NOMBRE || 'Administrador';
const ADMIN_APELLIDO = process.env.ADMIN_APELLIDO || 'Dinamedical';

async function main() {
    try {
        const pool = await sql.connect(config);
        const existente = await pool.request()
            .input('email', ADMIN_EMAIL)
            .query('SELECT id FROM usuarios WHERE email = @email');

        if (existente.recordset.length > 0) {
            console.log('✓ Usuario administrador ya existe:', ADMIN_EMAIL);
            process.exit(0);
            return;
        }

        const rolAdmin = await pool.request()
            .query("SELECT id FROM roles WHERE codigo = 'admin_dinamedical'");
        const rolId = rolAdmin.recordset[0]?.id;
        if (!rolId) {
            console.error('Error: Rol admin_dinamedical no encontrado. Ejecuta primero la migración 001.');
            process.exit(1);
        }

        const claveHash = await bcrypt.hash(ADMIN_CLAVE, 10);

        const tienePersonas = await pool.request().query("SELECT 1 FROM sys.tables WHERE name = 'personas'");
        if (tienePersonas.recordset.length > 0) {
            const personaNueva = await pool.request()
                .input('primer_nombre', ADMIN_NOMBRE)
                .input('primer_apellido', ADMIN_APELLIDO)
                .query(`INSERT INTO personas (tipo_documento_codigo, primer_nombre, primer_apellido, activo) OUTPUT INSERTED.id_persona VALUES ('CC', @primer_nombre, @primer_apellido, 1)`);
            const personaId = personaNueva.recordset[0].id_persona;
            await pool.request()
                .input('email', ADMIN_EMAIL)
                .input('clave_hash', claveHash)
                .input('persona_id', personaId)
                .query(`INSERT INTO usuarios (email, clave_hash, persona_id, activo, ips_id) VALUES (@email, @clave_hash, @persona_id, 1, NULL)`);
        } else {
            await pool.request()
                .input('email', ADMIN_EMAIL)
                .input('clave_hash', claveHash)
                .input('nombre', ADMIN_NOMBRE)
                .input('apellido', ADMIN_APELLIDO)
                .query(`INSERT INTO usuarios (email, clave_hash, nombre, apellido, activo, ips_id) VALUES (@email, @clave_hash, @nombre, @apellido, 1, NULL)`);
        }

        const usuario = await pool.request()
            .input('email', ADMIN_EMAIL)
            .query('SELECT id FROM usuarios WHERE email = @email');
        const usuarioId = usuario.recordset[0].id;

        await pool.request()
            .input('usuario_id', usuarioId)
            .input('rol_id', rolId)
            .input('ips_id', null)
            .query('INSERT INTO usuario_rol (usuario_id, rol_id, ips_id) VALUES (@usuario_id, @rol_id, @ips_id)');

        console.log('');
        console.log('========================================');
        console.log('  USUARIO ADMINISTRADOR CREADO');
        console.log('========================================');
        console.log('  Email:', ADMIN_EMAIL);
        console.log('  Clave:', ADMIN_CLAVE);
        console.log('  Nombre:', ADMIN_NOMBRE, ADMIN_APELLIDO);
        console.log('');
        console.log('  IMPORTANTE: Cambia la clave después del primer login.');
        console.log('========================================');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();
