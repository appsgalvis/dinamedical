const express = require('express');
const { obtenerConexion } = require('../configuracion/baseDatos');
const { requiereAuth, requierePermiso } = require('../middleware/auth');

const router = express.Router();

// GET /api/catalogos/listas?ref=tipo_documento | ?formulario=persona&campo=tipo_documento
router.get('/listas', requiereAuth, async (req, res) => {
    try {
        const { ref, formulario, campo } = req.query;
        const pool = await obtenerConexion();

        let query = 'SELECT id, label, value, ref, formulario, campo, indice FROM listas WHERE activo = 1';
        const request = pool.request();

        if (ref) {
            query += ' AND ref = @ref';
            request.input('ref', ref);
        }
        if (formulario) {
            query += ' AND formulario = @formulario';
            request.input('formulario', formulario);
        }
        if (campo) {
            query += ' AND campo = @campo';
            request.input('campo', campo);
        }

        query += ' ORDER BY indice, label';
        const r = await request.query(query);
        res.json(r.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/catalogos/tipo-documento (compatibilidad - usa listas)
router.get('/tipo-documento', requiereAuth, async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const r = await pool.request()
            .input('ref', 'tipo_documento')
            .query('SELECT value as codigo, label as nombre FROM listas WHERE ref = @ref AND activo = 1 ORDER BY indice, label');
        res.json(r.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/catalogos/sexo (compatibilidad - usa listas)
router.get('/sexo', requiereAuth, async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const r = await pool.request()
            .input('ref', 'sexo')
            .query('SELECT value as codigo, label as nombre FROM listas WHERE ref = @ref AND activo = 1 ORDER BY indice, label');
        res.json(r.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/catalogos/tipo-evento?busqueda=deng
router.get('/tipo-evento', requiereAuth, async (req, res) => {
    try {
        const { busqueda } = req.query;
        const pool = await obtenerConexion();
        const request = pool.request();
        let q = `
            SELECT codigo, nombre, notificacion_inmediata, tipo_notificacion, id_formulario, version, estado
            FROM tipo_evento WHERE activo = 1
        `;
        if (busqueda && String(busqueda).trim()) {
            q += ' AND (codigo LIKE @q OR nombre LIKE @q)';
            request.input('q', '%' + String(busqueda).trim() + '%');
        }
        q += ' ORDER BY codigo';
        const r = await request.query(q);
        res.json(r.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET departamentos DIVIPOLA
router.get('/departamentos', requiereAuth, async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const r = await pool.request().query(`
            SELECT DISTINCT codigo_departamento, nombre_departamento
            FROM divipola WHERE activo = 1
            ORDER BY nombre_departamento
        `);
        res.json(r.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET municipios por departamento
router.get('/municipios', requiereAuth, async (req, res) => {
    try {
        const { departamento } = req.query;
        if (!departamento) return res.status(400).json({ error: 'departamento (código) requerido' });
        const pool = await obtenerConexion();
        const r = await pool.request()
            .input('dep', departamento)
            .query(`
                SELECT codigo_municipio, nombre_municipio, codigo_departamento, nombre_departamento
                FROM divipola WHERE activo = 1 AND codigo_departamento = @dep
                ORDER BY nombre_municipio
            `);
        res.json(r.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Catálogo síntomas
router.get('/sintomas', requiereAuth, async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const request = pool.request();
        let q = 'SELECT id, codigo, nombre, ips_id FROM catalogo_sintomas WHERE activo = 1 AND (ips_id IS NULL';
        if (!req.esAdminDinamedical && req.usuario.ips_id) {
            q += ' OR ips_id = @ips_id';
            request.input('ips_id', req.usuario.ips_id);
        }
        q += ') ORDER BY nombre';
        const r = await request.query(q);
        res.json(r.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CRUD listas maestras (parametrización)
router.post('/listas', requiereAuth, requierePermiso('listas.editar'), async (req, res) => {
    try {
        const { label, value, ref, formulario, campo, indice } = req.body;
        if (!label || !value || !ref || !formulario || !campo) {
            return res.status(400).json({ error: 'label, value, ref, formulario y campo requeridos' });
        }
        const pool = await obtenerConexion();
        const r = await pool.request()
            .input('label', label)
            .input('value', value)
            .input('ref', ref)
            .input('formulario', formulario)
            .input('campo', campo)
            .input('indice', indice ?? 0)
            .query(`
                INSERT INTO listas (label, value, ref, formulario, campo, indice)
                OUTPUT INSERTED.*
                VALUES (@label, @value, @ref, @formulario, @campo, @indice)
            `);
        res.status(201).json(r.recordset[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/listas/:id', requiereAuth, requierePermiso('listas.editar'), async (req, res) => {
    try {
        const { label, value, indice, activo } = req.body;
        const pool = await obtenerConexion();
        const request = pool.request().input('id', req.params.id);
        const updates = [];
        if (label !== undefined) { updates.push('label = @label'); request.input('label', label); }
        if (value !== undefined) { updates.push('value = @value'); request.input('value', value); }
        if (indice !== undefined) { updates.push('indice = @indice'); request.input('indice', indice); }
        if (activo !== undefined) { updates.push('activo = @activo'); request.input('activo', activo ? 1 : 0); }
        if (!updates.length) return res.status(400).json({ error: 'Nada que actualizar' });
        await request.query(`UPDATE listas SET ${updates.join(', ')} WHERE id = @id`);
        const r = await pool.request().input('id', req.params.id).query('SELECT * FROM listas WHERE id = @id');
        res.json(r.recordset[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
