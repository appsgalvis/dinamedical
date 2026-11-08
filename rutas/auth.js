const express = require('express');
const bcrypt = require('bcryptjs');
const { obtenerConexion } = require('../configuracion/baseDatos');
const { generarToken } = require('../utilidades/jwt');
const { requiereAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, clave } = req.body;
        if (!email || !clave) {
            return res.status(400).json({ error: 'Email y clave requeridos' });
        }

        const pool = await obtenerConexion();
        const usuario = await pool.request()
            .input('email', email)
            .query(`
                SELECT u.id, u.email, u.clave_hash, u.cargo, u.activo, u.ips_id, i.nombre as ips_nombre,
                       LTRIM(RTRIM(ISNULL(p.primer_nombre,'') + ' ' + ISNULL(p.segundo_nombre,''))) as nombre,
                       LTRIM(RTRIM(ISNULL(p.primer_apellido,'') + ' ' + ISNULL(p.segundo_apellido,''))) as apellido
                FROM usuarios u
                LEFT JOIN ips i ON i.id = u.ips_id
                LEFT JOIN personas p ON p.id_persona = u.persona_id
                WHERE u.email = @email
            `);

        const u = usuario.recordset[0];
        if (!u || !u.activo) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const claveValida = await bcrypt.compare(clave, u.clave_hash);
        if (!claveValida) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const roles = await pool.request()
            .input('usuario_id', u.id)
            .query(`
                SELECT r.codigo, r.nombre, ur.ips_id
                FROM usuario_rol ur
                JOIN roles r ON r.id = ur.rol_id
                WHERE ur.usuario_id = @usuario_id
            `);

        const permisos = await pool.request()
            .input('usuario_id', u.id)
            .query(`
                SELECT DISTINCT p.codigo
                FROM usuario_rol ur
                JOIN rol_permiso rp ON rp.rol_id = ur.rol_id
                JOIN permisos p ON p.id = rp.permiso_id
                WHERE ur.usuario_id = @usuario_id
            `);

        const token = generarToken({ usuario_id: u.id });
        res.json({
            token,
            usuario: {
                id: u.id,
                email: u.email,
                nombre: u.nombre,
                apellido: u.apellido,
                ips_id: u.ips_id,
                ips_nombre: u.ips_nombre,
                cargo: u.cargo || null,
                roles: roles.recordset,
                permisos: permisos.recordset.map(p => p.codigo)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/auth/registrar-ips - Registro público de IPS (crea IPS + usuario admin_ips)
router.post('/registrar-ips', async (req, res) => {
    try {
        const { nombre_ips, nit, direccion, telefono, email, clave, nombre, apellido } = req.body;
        if (!nombre_ips || !nit || !direccion || !telefono || !email || !clave || !nombre || !apellido) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }

        const pool = await obtenerConexion();
        const existenteEmail = await pool.request()
            .input('email', email)
            .query('SELECT id FROM usuarios WHERE email = @email');
        if (existenteEmail.recordset.length > 0) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }

        const existenteNit = await pool.request()
            .input('nit', nit.trim())
            .query('SELECT id FROM ips WHERE nit = @nit');
        if (existenteNit.recordset.length > 0) {
            return res.status(400).json({ error: 'Ya existe una IPS registrada con este NIT' });
        }

        await pool.request()
            .input('nombre', nombre_ips)
            .input('nit', nit.trim())
            .input('direccion', direccion)
            .input('telefono', telefono)
            .query('INSERT INTO ips (nombre, nit, direccion, telefono) VALUES (@nombre, @nit, @direccion, @telefono)');

        const ipsNueva = await pool.request()
            .input('nombre', nombre_ips)
            .query('SELECT id FROM ips WHERE nombre = @nombre');
        const ipsId = ipsNueva.recordset[0].id;

        const rolAdminIps = await pool.request()
            .query("SELECT id FROM roles WHERE codigo = 'admin_ips'");
        const rolId = rolAdminIps.recordset[0]?.id;
        if (!rolId) return res.status(500).json({ error: 'Rol admin_ips no configurado' });

        const claveHash = await bcrypt.hash(clave, 10);
        const personaNueva = await pool.request()
            .input('tipo_documento_codigo', 'CC')
            .input('primer_nombre', nombre)
            .input('primer_apellido', apellido)
            .query('INSERT INTO personas (tipo_documento_codigo, primer_nombre, primer_apellido, activo) OUTPUT INSERTED.id_persona VALUES (@tipo_documento_codigo, @primer_nombre, @primer_apellido, 1)');
        const personaId = personaNueva.recordset[0].id_persona;

        await pool.request()
            .input('email', email)
            .input('clave_hash', claveHash)
            .input('persona_id', personaId)
            .input('ips_id', ipsId)
            .query('INSERT INTO usuarios (email, clave_hash, persona_id, ips_id) VALUES (@email, @clave_hash, @persona_id, @ips_id)');

        const usuario = await pool.request()
            .input('email', email)
            .query(`
                SELECT u.id, u.email, u.ips_id, i.nombre as ips_nombre,
                       LTRIM(RTRIM(ISNULL(p.primer_nombre,'') + ' ' + ISNULL(p.segundo_nombre,''))) as nombre,
                       LTRIM(RTRIM(ISNULL(p.primer_apellido,'') + ' ' + ISNULL(p.segundo_apellido,''))) as apellido
                FROM usuarios u
                LEFT JOIN ips i ON i.id = u.ips_id
                LEFT JOIN personas p ON p.id_persona = u.persona_id
                WHERE u.email = @email
            `);
        const u = usuario.recordset[0];

        await pool.request()
            .input('usuario_id', u.id)
            .input('rol_id', rolId)
            .input('ips_id', ipsId)
            .query('INSERT INTO usuario_rol (usuario_id, rol_id, ips_id) VALUES (@usuario_id, @rol_id, @ips_id)');

        const roles = await pool.request()
            .input('usuario_id', u.id)
            .query('SELECT r.codigo, r.nombre, ur.ips_id FROM usuario_rol ur JOIN roles r ON r.id = ur.rol_id WHERE ur.usuario_id = @usuario_id');
        const permisos = await pool.request()
            .input('usuario_id', u.id)
            .query('SELECT DISTINCT p.codigo FROM usuario_rol ur JOIN rol_permiso rp ON rp.rol_id = ur.rol_id JOIN permisos p ON p.id = rp.permiso_id WHERE ur.usuario_id = @usuario_id');

        const token = generarToken({ usuario_id: u.id });
        res.status(201).json({
            token,
            usuario: {
                id: u.id,
                email: u.email,
                nombre: u.nombre,
                apellido: u.apellido,
                ips_id: u.ips_id,
                ips_nombre: u.ips_nombre,
                roles: roles.recordset,
                permisos: permisos.recordset.map(p => p.codigo)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/auth/cambiar-clave - cambiar clave del usuario actual
router.put('/cambiar-clave', requiereAuth, async (req, res) => {
    try {
        const { clave_actual, clave_nueva } = req.body;
        if (!clave_actual || !clave_nueva) {
            return res.status(400).json({ error: 'clave_actual y clave_nueva requeridos' });
        }
        const pool = await obtenerConexion();
        const usuario = await pool.request()
            .input('id', req.usuario.id)
            .query('SELECT clave_hash FROM usuarios WHERE id = @id');
        const u = usuario.recordset[0];
        if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
        const valida = await bcrypt.compare(clave_actual, u.clave_hash);
        if (!valida) return res.status(400).json({ error: 'Clave actual incorrecta' });
        const claveHash = await bcrypt.hash(clave_nueva, 10);
        await pool.request()
            .input('id', req.usuario.id)
            .input('clave_hash', claveHash)
            .query('UPDATE usuarios SET clave_hash = @clave_hash, actualizado_en = GETDATE() WHERE id = @id');
        res.json({ mensaje: 'Clave actualizada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/auth/yo - usuario actual (requiere token)
router.get('/yo', requiereAuth, (req, res) => {
    res.json({
        usuario: {
            id: req.usuario.id,
            email: req.usuario.email,
            nombre: req.usuario.nombre,
            apellido: req.usuario.apellido,
            ips_id: req.usuario.ips_id,
            ips_nombre: req.usuario.ips_nombre || null,
            cargo: req.usuario.cargo || null,
            roles: req.usuario.roles,
            permisos: req.usuario.permisos
        }
    });
});

module.exports = router;
