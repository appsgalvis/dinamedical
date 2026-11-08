const express = require('express');
const { obtenerConexion } = require('../configuracion/baseDatos');
const { requiereAuth, requierePermiso, requiereAdminDinamedical } = require('../middleware/auth');

const router = express.Router();

// Listar roles
router.get('/', requiereAuth, requierePermiso('roles.ver'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const resultado = await pool.request().query(`
            SELECT r.id, r.codigo, r.nombre, r.descripcion, r.nivel_sistema, r.activo,
                   (SELECT COUNT(*) FROM rol_permiso WHERE rol_id = r.id) as cantidad_permisos
            FROM roles r
            ORDER BY r.nivel_sistema DESC, r.nombre
        `);
        res.json(resultado.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener rol con permisos
router.get('/:id', requiereAuth, requierePermiso('roles.ver'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const rol = await pool.request()
            .input('id', req.params.id)
            .query('SELECT * FROM roles WHERE id = @id');
        if (!rol.recordset[0]) return res.status(404).json({ error: 'Rol no encontrado' });

        const permisos = await pool.request()
            .input('rol_id', req.params.id)
            .query(`
                SELECT p.id, p.codigo, p.nombre, p.modulo
                FROM rol_permiso rp
                JOIN permisos p ON p.id = rp.permiso_id
                WHERE rp.rol_id = @rol_id
            `);
        res.json({ ...rol.recordset[0], permisos: permisos.recordset });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear rol (solo admin dinamedical)
router.post('/', requiereAuth, requiereAdminDinamedical, async (req, res) => {
    try {
        const { codigo, nombre, descripcion, nivel_sistema } = req.body;
        if (!codigo || !nombre) return res.status(400).json({ error: 'codigo y nombre requeridos' });

        const pool = await obtenerConexion();
        await pool.request()
            .input('codigo', codigo)
            .input('nombre', nombre)
            .input('descripcion', descripcion || null)
            .input('nivel_sistema', nivel_sistema ? 1 : 0)
            .query('INSERT INTO roles (codigo, nombre, descripcion, nivel_sistema) VALUES (@codigo, @nombre, @descripcion, @nivel_sistema)');

        const nuevo = await pool.request()
            .input('codigo', codigo)
            .query('SELECT * FROM roles WHERE codigo = @codigo');
        res.status(201).json(nuevo.recordset[0]);
    } catch (error) {
        if (error.number === 2627) res.status(400).json({ error: 'El código de rol ya existe' });
        else res.status(500).json({ error: error.message });
    }
});

// Actualizar permisos del rol (solo admin dinamedical)
router.put('/:id/permisos', requiereAuth, requiereAdminDinamedical, async (req, res) => {
    try {
        const { permiso_ids } = req.body;
        if (!Array.isArray(permiso_ids)) return res.status(400).json({ error: 'permiso_ids debe ser un array' });

        const pool = await obtenerConexion();
        await pool.request().input('rol_id', req.params.id).query('DELETE FROM rol_permiso WHERE rol_id = @rol_id');

        for (const permisoId of permiso_ids) {
            await pool.request()
                .input('rol_id', req.params.id)
                .input('permiso_id', permisoId)
                .query('INSERT INTO rol_permiso (rol_id, permiso_id) VALUES (@rol_id, @permiso_id)');
        }
        res.json({ mensaje: 'Permisos actualizados' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
