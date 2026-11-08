const express = require('express');
const { obtenerConexion } = require('../configuracion/baseDatos');
const { requiereAuth, requierePermiso } = require('../middleware/auth');

const router = express.Router();

const SELECT_BASE = `
    SELECT h.id, h.ips_id, h.paciente_persona_id, h.profesional_usuario_id, h.consulta_id,
           h.sintomas_texto, h.resumen_clinico, h.creado_en, h.actualizado_en,
           LTRIM(RTRIM(ISNULL(pp.primer_nombre,'') + ' ' + ISNULL(pp.segundo_nombre,''))) + ' ' +
           LTRIM(RTRIM(ISNULL(pp.primer_apellido,'') + ' ' + ISNULL(pp.segundo_apellido,''))) AS paciente_nombre,
           LTRIM(RTRIM(ISNULL(pf.primer_nombre,'') + ' ' + ISNULL(pf.segundo_nombre,''))) + ' ' +
           LTRIM(RTRIM(ISNULL(pf.primer_apellido,'') + ' ' + ISNULL(pf.segundo_apellido,''))) AS profesional_nombre
    FROM historias_clinicas h
    INNER JOIN personas pp ON pp.id_persona = h.paciente_persona_id
    INNER JOIN usuarios uf ON uf.id = h.profesional_usuario_id
    LEFT JOIN personas pf ON pf.id_persona = uf.persona_id
    WHERE 1=1
`;

const NOM = (a) => `LTRIM(RTRIM(ISNULL(${a}.primer_nombre,'') + ' ' + ISNULL(${a}.segundo_nombre,''))) + ' ' + `
    + `LTRIM(RTRIM(ISNULL(${a}.primer_apellido,'') + ' ' + ISNULL(${a}.segundo_apellido,'')))`;

const SELECT_VISTA = `
    SELECT co.id AS consulta_id, h.id AS historia_id, co.ips_id,
           co.paciente_persona_id, i.nombre AS ips_nombre,
           ${NOM('pp')} AS paciente_nombre, ${NOM('pf')} AS profesional_nombre,
           CONVERT(VARCHAR(10), ISNULL(co.fecha_consulta, CAST(co.creado_en AS DATE)), 23) AS fecha,
           co.codigo_evento, co.nombre_evento, co.estado, co.resumen_consulta,
           h.sintomas_texto, h.resumen_clinico,
           ISNULL((SELECT STRING_AGG(s.nombre, ', ')
                   FROM consulta_sintomas cs
                   INNER JOIN catalogo_sintomas s ON s.id = cs.sintoma_id
                   WHERE cs.consulta_id = co.id), '') AS sintomas
    FROM consultas co
    INNER JOIN ips i ON i.id = co.ips_id
    INNER JOIN personas pp ON pp.id_persona = co.paciente_persona_id
    INNER JOIN usuarios uf ON uf.id = co.profesional_usuario_id
    LEFT JOIN personas pf ON pf.id_persona = uf.persona_id
    LEFT JOIN historias_clinicas h ON h.consulta_id = co.id
    WHERE 1=1
`;

const SELECT_CONSULTA = `
    SELECT co.id, i.nombre AS ips_nombre, co.paciente_persona_id, co.cita_id,
           co.codigo_evento, co.nombre_evento, co.evento_salud_publica, co.estado,
           co.altura_cm, co.peso_kg, co.temperatura_c, co.frecuencia_cardiaca,
           co.ta_sistolica, co.ta_diastolica, co.saturacion_o2,
           CONVERT(VARCHAR(10), co.fecha_consulta, 23) AS fecha_consulta,
           co.resumen_consulta,
           co.creado_en,
           ${NOM('pp')} AS paciente_nombre, ${NOM('pf')} AS profesional_nombre
    FROM consultas co
    INNER JOIN ips i ON i.id = co.ips_id
    INNER JOIN personas pp ON pp.id_persona = co.paciente_persona_id
    INNER JOIN usuarios uf ON uf.id = co.profesional_usuario_id
    LEFT JOIN personas pf ON pf.id_persona = uf.persona_id
    WHERE co.id = @consulta_id
`;

async function sintomasDeConsulta(pool, consultaId) {
    const r = await pool.request()
        .input('id', consultaId)
        .query(`
            SELECT s.id, s.codigo, s.nombre
            FROM consulta_sintomas cs
            INNER JOIN catalogo_sintomas s ON s.id = cs.sintoma_id
            WHERE cs.consulta_id = @id
            ORDER BY s.nombre
        `);
    return r.recordset;
}

const SINTOMAS_CONSULTA = `(SELECT ISNULL(STRING_AGG(s.nombre, ', '), '') FROM consulta_sintomas cs INNER JOIN catalogo_sintomas s ON s.id = cs.sintoma_id WHERE cs.consulta_id = co.id)`;

/** Matriz Historia Clínica: una fila por persona con su última consulta */
router.get('/vista', requiereAuth, requierePermiso('historias.ver'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const request = pool.request();
        const filtroPersona = req.esAdminDinamedical ? '' : ' AND p.ips_id = @ips_id';
        const filtroConsulta = req.esAdminDinamedical ? '' : ' AND co.ips_id = @ips_id';
        if (!req.esAdminDinamedical) request.input('ips_id', req.usuario.ips_id);
        if (req.query.paciente_persona_id) {
            request.input('pid', parseInt(req.query.paciente_persona_id, 10));
        }
        const filtroPersonax = req.query.paciente_persona_id ? ' AND p.id_persona = @pid' : '';
        const r = await request.query(`
            SELECT p.id_persona,
                   ${NOM('p')} AS paciente_nombre, p.tipo_documento_codigo, p.numero_documento,
                   p.sexo_codigo, CONVERT(VARCHAR(10), p.fecha_nacimiento, 23) AS fecha_nacimiento,
                   p.residencia_departamento, p.residencia_municipio, p.ips_id, i.nombre AS ips_nombre,
                   lc.consulta_id, lc.fecha, lc.profesional_nombre, lc.codigo_evento, lc.nombre_evento,
                   lc.estado, lc.resumen_consulta, lc.sintomas_last AS sintomas, lc.cantidad_consultas
            FROM personas p
            INNER JOIN ips i ON i.id = p.ips_id
            CROSS APPLY (
                SELECT TOP 1 co.id AS consulta_id,
                       CONVERT(VARCHAR(10), ISNULL(co.fecha_consulta, CAST(co.creado_en AS DATE)), 23) AS fecha,
                       ${NOM('pf')} AS profesional_nombre, co.codigo_evento, co.nombre_evento, co.estado,
                       co.resumen_consulta, ${SINTOMAS_CONSULTA} AS sintomas_last,
                       (SELECT COUNT(*) FROM consultas ca WHERE ca.paciente_persona_id = p.id_persona ${filtroConsulta}) AS cantidad_consultas
                FROM consultas co
                INNER JOIN usuarios uf ON uf.id = co.profesional_usuario_id
                LEFT JOIN personas pf ON pf.id_persona = uf.persona_id
                WHERE co.paciente_persona_id = p.id_persona ${filtroConsulta}
                ORDER BY ISNULL(co.fecha_consulta, CAST(co.creado_en AS DATE)) DESC, co.id DESC
            ) lc
            WHERE 1=1 ${filtroPersona}${filtroPersonax}
            ORDER BY ISNULL(lc.fecha, '') DESC, lc.cantidad_consultas DESC, p.id_persona
        `);
        res.json(r.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/** Historial completo de una persona: datos de la persona + todas sus consultas */
router.get('/historial/:personaId(\\d+)', requiereAuth, requierePermiso('historias.ver'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const pid = parseInt(req.params.personaId, 10);
        if (!pid || Number.isNaN(pid)) return res.status(400).json({ error: 'personaId requerido' });

        const rqP = pool.request().input('pid', pid);
        const filtroPersona = req.esAdminDinamedical ? '' : ' AND p.ips_id = @ips_id';
        if (!req.esAdminDinamedical) rqP.input('ips_id', req.usuario.ips_id);
        const persona = (await rqP.query(`
            SELECT p.id_persona, ${NOM('p')} AS paciente_nombre, p.tipo_documento_codigo, p.numero_documento,
                   p.sexo_codigo, CONVERT(VARCHAR(10), p.fecha_nacimiento, 23) AS fecha_nacimiento,
                   p.residencia_departamento, p.residencia_municipio, p.activo, i.nombre AS ips_nombre
            FROM personas p
            INNER JOIN ips i ON i.id = p.ips_id
            WHERE p.id_persona = @pid ${filtroPersona}
        `)).recordset[0];
        if (!persona) return res.status(404).json({ error: 'Persona no encontrada' });

        const rqC = pool.request().input('pid', pid);
        const filtroConsulta = req.esAdminDinamedical ? '' : ' AND co.ips_id = @ips_id';
        if (!req.esAdminDinamedical) rqC.input('ips_id', req.usuario.ips_id);
        const consultas = (await rqC.query(`
            SELECT co.id AS consulta_id, CONVERT(VARCHAR(10), ISNULL(co.fecha_consulta, CAST(co.creado_en AS DATE)), 23) AS fecha,
                   ${NOM('pf')} AS profesional_nombre, co.codigo_evento, co.nombre_evento, co.estado, co.resumen_consulta,
                   ISNULL((SELECT STRING_AGG(s.nombre, ', ') FROM consulta_sintomas cs INNER JOIN catalogo_sintomas s ON s.id = cs.sintoma_id WHERE cs.consulta_id = co.id), '') AS sintomas
            FROM consultas co
            INNER JOIN usuarios uf ON uf.id = co.profesional_usuario_id
            LEFT JOIN personas pf ON pf.id_persona = uf.persona_id
            WHERE co.paciente_persona_id = @pid ${filtroConsulta}
            ORDER BY ISNULL(co.fecha_consulta, CAST(co.creado_en AS DATE)) DESC, co.id DESC
        `)).recordset;

        res.json({ persona, consultas });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/** Todo lo registrado sobre una consulta (consulta + ficha + síntomas + historia) */
router.get('/detalle/:consultaId(\\d+)', requiereAuth, requierePermiso('historias.ver'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const consultaId = parseInt(req.params.consultaId, 10);
        const reqC = pool.request().input('consulta_id', consultaId);
        if (!req.esAdminDinamedical) {
            reqC.input('ips_id', req.usuario.ips_id);
        }
        const filtroIps = req.esAdminDinamedical ? '' : ' AND co.ips_id = @ips_id';
        const consulta = (await reqC.query(`${SELECT_CONSULTA}${filtroIps}`)).recordset[0];
        if (!consulta) return res.status(404).json({ error: 'Consulta no encontrada' });

        const reqH = pool.request().input('cid', consultaId);
        if (!req.esAdminDinamedical) reqH.input('ips_h', req.usuario.ips_id);
        const historia = (await reqH.query(
            `SELECT id AS historia_id, ips_id, paciente_persona_id, profesional_usuario_id,
                    sintomas_texto, resumen_clinico, creado_en, actualizado_en
             FROM historias_clinicas WHERE consulta_id = @cid ${req.esAdminDinamedical ? '' : ' AND ips_id = @ips_h'}`
        )).recordset[0] || null;

        const reqF = pool.request().input('cid', consultaId);
        if (!req.esAdminDinamedical) reqF.input('ips_f', req.usuario.ips_id);
        const ficha = (await reqF.query(
            `SELECT * FROM ficha_datos_basicos WHERE consulta_id = @cid ${req.esAdminDinamedical ? '' : ' AND ips_id = @ips_f'}`
        )).recordset[0] || null;

        res.json({ consulta, historia, ficha, sintomas: await sintomasDeConsulta(pool, consultaId) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/', requiereAuth, requierePermiso('historias.ver'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const request = pool.request();
        let q = SELECT_BASE;
        const { paciente_persona_id } = req.query;
        if (paciente_persona_id) {
            q += ' AND h.paciente_persona_id = @paciente_persona_id';
            request.input('paciente_persona_id', paciente_persona_id);
        }
        if (!req.esAdminDinamedical) {
            q += ' AND h.ips_id = @ips_id';
            request.input('ips_id', req.usuario.ips_id);
        }
        q += ' ORDER BY h.creado_en DESC';
        const r = await request.query(q);
        res.json(r.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', requiereAuth, requierePermiso('historias.crear'), async (req, res) => {
    try {
        const { paciente_persona_id, consulta_id, sintomas_texto, resumen_clinico, ips_id } = req.body;
        if (!paciente_persona_id) return res.status(400).json({ error: 'paciente requerido' });

        const ipsId = req.esAdminDinamedical ? (ips_id || req.usuario.ips_id) : req.usuario.ips_id;
        if (!ipsId) return res.status(400).json({ error: 'ips_id requerido' });

        const pool = await obtenerConexion();
        const ins = await pool.request()
            .input('ips_id', ipsId)
            .input('paciente_persona_id', paciente_persona_id)
            .input('profesional_usuario_id', req.usuario.id)
            .input('consulta_id', consulta_id || null)
            .input('sintomas_texto', sintomas_texto || null)
            .input('resumen_clinico', resumen_clinico || null)
            .query(`
                INSERT INTO historias_clinicas (ips_id, paciente_persona_id, profesional_usuario_id, consulta_id,
                    sintomas_texto, resumen_clinico)
                OUTPUT INSERTED.id
                VALUES (@ips_id, @paciente_persona_id, @profesional_usuario_id, @consulta_id,
                    @sintomas_texto, @resumen_clinico)
            `);

        const id = ins.recordset[0].id;
        const det = await pool.request().input('id', id).query(`${SELECT_BASE} AND h.id = @id`);
        res.status(201).json(det.recordset[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', requiereAuth, requierePermiso('historias.editar'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const prev = await pool.request()
            .input('id', req.params.id)
            .query('SELECT ips_id FROM historias_clinicas WHERE id = @id');
        const row = prev.recordset[0];
        if (!row) return res.status(404).json({ error: 'Historia no encontrada' });
        if (!req.esAdminDinamedical && row.ips_id !== req.usuario.ips_id) {
            return res.status(403).json({ error: 'Sin acceso' });
        }

        const { sintomas_texto, resumen_clinico, consulta_id } = req.body;
        const request = pool.request().input('id', req.params.id);
        const updates = [];
        if (sintomas_texto !== undefined) { updates.push('sintomas_texto = @sintomas_texto'); request.input('sintomas_texto', sintomas_texto); }
        if (resumen_clinico !== undefined) { updates.push('resumen_clinico = @resumen_clinico'); request.input('resumen_clinico', resumen_clinico); }
        if (consulta_id !== undefined) { updates.push('consulta_id = @consulta_id'); request.input('consulta_id', consulta_id || null); }
        if (!updates.length) return res.status(400).json({ error: 'Nada que actualizar' });
        updates.push('actualizado_en = GETDATE()');
        await request.query(`UPDATE historias_clinicas SET ${updates.join(', ')} WHERE id = @id`);

        const det = await pool.request().input('id', req.params.id).query(`${SELECT_BASE} AND h.id = @id`);
        res.json(det.recordset[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
