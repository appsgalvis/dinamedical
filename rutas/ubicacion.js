const express = require('express');
const { obtenerConexion } = require('../configuracion/baseDatos');
const router = express.Router();

// POST /api/ubicacion/actualizar - Público, actualiza lat/long por codigo (siempre válido)
router.post('/actualizar', async (req, res) => {
    try {
        const { codigo, latitud, longitud } = req.body;
        if (!codigo) return res.status(400).json({ error: 'Código requerido' });

        const pool = await obtenerConexion();
        const ub = await pool.request()
            .input('codigo', codigo)
            .query('SELECT id FROM ubicaciones WHERE link_codigo = @codigo');

        if (!ub.recordset[0]) return res.status(404).json({ error: 'Enlace no válido' });

        await pool.request()
            .input('id', ub.recordset[0].id)
            .input('latitud', latitud || null)
            .input('longitud', longitud || null)
            .query('UPDATE ubicaciones SET latitud = @latitud, longitud = @longitud WHERE id = @id');

        res.json({ mensaje: 'Ubicación actualizada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/ubicacion/validar/:codigo - Verificar si el codigo es válido
router.get('/validar/:codigo', async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const ub = await pool.request()
            .input('codigo', req.params.codigo)
            .query('SELECT ub.id, ub.direccion, p.primer_nombre, p.primer_apellido FROM ubicaciones ub JOIN personas p ON p.id_persona = ub.persona_id WHERE ub.link_codigo = @codigo');

        if (!ub.recordset[0]) return res.status(404).json({ error: 'Enlace no válido' });
        const l = ub.recordset[0];
        res.json({ valido: true, direccion: l.direccion, persona: l.primer_nombre + ' ' + l.primer_apellido });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
