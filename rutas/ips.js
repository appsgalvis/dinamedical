const express = require('express');
const { obtenerConexion } = require('../configuracion/baseDatos');
const { requiereAuth, requierePermiso, requiereAdminDinamedical } = require('../middleware/auth');

const router = express.Router();

// Listar IPS
router.get('/', requiereAuth, requierePermiso('ips.ver'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        let resultado;
        if (req.esAdminDinamedical) {
            resultado = await pool.request().query(`
                SELECT id, nombre, nit, direccion, telefono, departamento, municipio, activo, creado_en
                FROM ips
                ORDER BY nombre
            `);
        } else {
            resultado = await pool.request()
                .input('ips_id', req.usuario.ips_id)
                .query('SELECT id, nombre, nit, direccion, telefono, departamento, municipio, activo FROM ips WHERE id = @ips_id');
        }
        res.json(resultado.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear IPS (solo admin dinamedical)
router.post('/', requiereAuth, requiereAdminDinamedical, async (req, res) => {
    try {
        const { nombre, nit, direccion, telefono, departamento, municipio } = req.body;
        if (!nombre) return res.status(400).json({ error: 'nombre requerido' });

        const pool = await obtenerConexion();
        await pool.request()
            .input('nombre', nombre)
            .input('nit', nit || null)
            .input('direccion', direccion || null)
            .input('telefono', telefono || null)
            .input('departamento', departamento || null)
            .input('municipio', municipio || null)
            .query(`INSERT INTO ips (nombre, nit, direccion, telefono, departamento, municipio)
                VALUES (@nombre, @nit, @direccion, @telefono, @departamento, @municipio)`);

        const nuevo = await pool.request()
            .input('nombre', nombre)
            .query('SELECT * FROM ips WHERE nombre = @nombre');
        res.status(201).json(nuevo.recordset[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actualizar IPS
router.put('/:id', requiereAuth, requierePermiso('ips.editar'), async (req, res) => {
    try {
        const ipsId = parseInt(req.params.id, 10);
        if (!req.esAdminDinamedical && ipsId !== req.usuario.ips_id) {
            return res.status(403).json({ error: 'Solo puede editar su IPS' });
        }
        const { nombre, nit, direccion, telefono, departamento, municipio, activo } = req.body;
        const pool = await obtenerConexion();
        const updates = [];
        const request = pool.request().input('id', ipsId);
        if (nombre !== undefined) { updates.push('nombre = @nombre'); request.input('nombre', nombre); }
        if (nit !== undefined) { updates.push('nit = @nit'); request.input('nit', nit); }
        if (direccion !== undefined) { updates.push('direccion = @direccion'); request.input('direccion', direccion); }
        if (telefono !== undefined) { updates.push('telefono = @telefono'); request.input('telefono', telefono); }
        if (departamento !== undefined) { updates.push('departamento = @departamento'); request.input('departamento', departamento || null); }
        if (municipio !== undefined) { updates.push('municipio = @municipio'); request.input('municipio', municipio || null); }
        if (activo !== undefined && req.esAdminDinamedical) { updates.push('activo = @activo'); request.input('activo', activo ? 1 : 0); }
        if (updates.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
        updates.push('actualizado_en = GETDATE()');
        await request.query(`UPDATE ips SET ${updates.join(', ')} WHERE id = @id`);
        const actualizado = await pool.request().input('id', ipsId).query(`
            SELECT id, nombre, nit, direccion, telefono, departamento, municipio, activo, creado_en, actualizado_en
            FROM ips WHERE id = @id
        `);
        res.json(actualizado.recordset[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar IPS (solo admin dinamedical)
router.delete('/:id', requiereAuth, requiereAdminDinamedical, async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const resultado = await pool.request()
            .input('id', req.params.id)
            .query('DELETE FROM ips WHERE id = @id; SELECT @@ROWCOUNT as eliminados');
        if (resultado.recordset[0].eliminados === 0) return res.status(404).json({ error: 'IPS no encontrada' });
        res.json({ mensaje: 'IPS eliminada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
