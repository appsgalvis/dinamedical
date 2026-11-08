const express = require('express');
const { obtenerConexion } = require('../configuracion/baseDatos');
const { requiereAuth, requierePermiso, requiereAdminDinamedical } = require('../middleware/auth');

const router = express.Router();

// Listar permisos (agrupados por módulo)
router.get('/', requiereAuth, requierePermiso('permisos.ver'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const resultado = await pool.request().query(`
            SELECT id, codigo, nombre, descripcion, modulo, activo
            FROM permisos
            WHERE activo = 1
            ORDER BY modulo, codigo
        `);
        const porModulo = {};
        resultado.recordset.forEach(p => {
            if (!porModulo[p.modulo]) porModulo[p.modulo] = [];
            porModulo[p.modulo].push(p);
        });
        res.json(porModulo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear permiso (solo admin dinamedical)
router.post('/', requiereAuth, requiereAdminDinamedical, async (req, res) => {
    try {
        const { codigo, nombre, descripcion, modulo } = req.body;
        if (!codigo || !nombre || !modulo) return res.status(400).json({ error: 'codigo, nombre y modulo requeridos' });

        const pool = await obtenerConexion();
        await pool.request()
            .input('codigo', codigo)
            .input('nombre', nombre)
            .input('descripcion', descripcion || null)
            .input('modulo', modulo)
            .query('INSERT INTO permisos (codigo, nombre, descripcion, modulo) VALUES (@codigo, @nombre, @descripcion, @modulo)');

        const nuevo = await pool.request()
            .input('codigo', codigo)
            .query('SELECT * FROM permisos WHERE codigo = @codigo');
        res.status(201).json(nuevo.recordset[0]);
    } catch (error) {
        if (error.number === 2627) res.status(400).json({ error: 'El código de permiso ya existe' });
        else res.status(500).json({ error: error.message });
    }
});

// Editar permiso
router.put('/:id', requiereAuth, requiereAdminDinamedical, async (req, res) => {
    try {
        const { nombre, descripcion, modulo, activo } = req.body;
        const pool = await obtenerConexion();
        const updates = [];
        const request = pool.request().input('id', req.params.id);
        if (nombre !== undefined) { updates.push('nombre = @nombre'); request.input('nombre', nombre); }
        if (descripcion !== undefined) { updates.push('descripcion = @descripcion'); request.input('descripcion', descripcion); }
        if (modulo !== undefined) { updates.push('modulo = @modulo'); request.input('modulo', modulo); }
        if (activo !== undefined) { updates.push('activo = @activo'); request.input('activo', activo ? 1 : 0); }
        if (updates.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
        updates.push('actualizado_en = GETDATE()');
        await request.query(`UPDATE permisos SET ${updates.join(', ')} WHERE id = @id`);
        const actualizado = await pool.request().input('id', req.params.id).query('SELECT * FROM permisos WHERE id = @id');
        res.json(actualizado.recordset[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
