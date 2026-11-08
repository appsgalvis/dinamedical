const express = require('express');
const { obtenerConexion } = require('../configuracion/baseDatos');
const { requiereAuth, requierePermiso } = require('../middleware/auth');

const router = express.Router();

const SELECT_BASE = `
    SELECT co.id, co.ips_id, i.nombre AS ips_nombre, co.paciente_persona_id, co.profesional_usuario_id, co.cita_id,
           co.codigo_evento, co.nombre_evento, co.evento_salud_publica,
           co.altura_cm, co.peso_kg, co.temperatura_c, co.frecuencia_cardiaca,
           co.ta_sistolica, co.ta_diastolica, co.saturacion_o2,
           CONVERT(VARCHAR(10), co.fecha_consulta, 23) AS fecha_consulta,
           co.resumen_consulta, co.estado, co.creado_en, co.actualizado_en,
           LTRIM(RTRIM(ISNULL(pp.primer_nombre,'') + ' ' + ISNULL(pp.segundo_nombre,''))) + ' ' +
           LTRIM(RTRIM(ISNULL(pp.primer_apellido,'') + ' ' + ISNULL(pp.segundo_apellido,''))) AS paciente_nombre,
           LTRIM(RTRIM(ISNULL(pf.primer_nombre,'') + ' ' + ISNULL(pf.segundo_nombre,''))) + ' ' +
           LTRIM(RTRIM(ISNULL(pf.primer_apellido,'') + ' ' + ISNULL(pf.segundo_apellido,''))) AS profesional_nombre
    FROM consultas co
    INNER JOIN ips i ON i.id = co.ips_id
    INNER JOIN personas pp ON pp.id_persona = co.paciente_persona_id
    INNER JOIN usuarios uf ON uf.id = co.profesional_usuario_id
    LEFT JOIN personas pf ON pf.id_persona = uf.persona_id
    WHERE 1=1
`;

function optNum(v) {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function optStr(v) {
    return (v === '' || v == null) ? null : String(v);
}

async function sintomasDeConsulta(pool, consultaId) {
    const r = await pool.request()
        .input('id', consultaId)
        .query(`
            SELECT s.id, s.codigo, s.nombre
            FROM consulta_sintomas cs
            INNER JOIN catalogo_sintomas s ON s.id = cs.sintoma_id
            WHERE cs.consulta_id = @id
        `);
    return r.recordset;
}

router.get('/', requiereAuth, requierePermiso('consultas.ver'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const request = pool.request();
        let q = SELECT_BASE;
        if (!req.esAdminDinamedical) {
            q += ' AND co.ips_id = @ips_id';
            request.input('ips_id', req.usuario.ips_id);
        }
        if (req.query.profesional_usuario_id) {
            q += ' AND co.profesional_usuario_id = @profesional_usuario_id';
            request.input('profesional_usuario_id', parseInt(req.query.profesional_usuario_id, 10));
        }
        if (req.query.paciente_persona_id) {
            q += ' AND co.paciente_persona_id = @paciente_persona_id';
            request.input('paciente_persona_id', parseInt(req.query.paciente_persona_id, 10));
        }
        q += ' ORDER BY co.actualizado_en DESC';
        const r = await request.query(q);
        res.json(r.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/** Grilla de historia clínica: resúmenes de todas las consultas del paciente (solo lectura) */
router.get('/historia-grid', requiereAuth, requierePermiso('consultas.ver'), async (req, res) => {
    try {
        const pacienteId = parseInt(req.query.paciente_persona_id, 10);
        if (!pacienteId || Number.isNaN(pacienteId)) {
            return res.status(400).json({ error: 'paciente_persona_id requerido' });
        }

        const pool = await obtenerConexion();
        const request = pool.request().input('pid', pacienteId);
        let filtroIps = '';
        if (!req.esAdminDinamedical) {
            filtroIps = ' AND co.ips_id = @ips_id';
            request.input('ips_id', req.usuario.ips_id);
        }

        const r = await request.query(`
            SELECT co.id,
                   CONVERT(VARCHAR(10), ISNULL(co.fecha_consulta, CAST(co.creado_en AS DATE)), 23) AS fecha,
                   LTRIM(RTRIM(ISNULL(pf.primer_nombre,'') + ' ' + ISNULL(pf.segundo_nombre,''))) + ' ' +
                   LTRIM(RTRIM(ISNULL(pf.primer_apellido,'') + ' ' + ISNULL(pf.segundo_apellido,''))) AS profesional_nombre,
                   co.codigo_evento, co.nombre_evento, co.estado, co.resumen_consulta,
                   ISNULL(STRING_AGG(s.nombre, ', '), '') AS sintomas
            FROM consultas co
            INNER JOIN personas pp ON pp.id_persona = co.paciente_persona_id
            INNER JOIN usuarios uf ON uf.id = co.profesional_usuario_id
            LEFT JOIN personas pf ON pf.id_persona = uf.persona_id
            LEFT JOIN consulta_sintomas cs ON cs.consulta_id = co.id
            LEFT JOIN catalogo_sintomas s ON s.id = cs.sintoma_id
            WHERE co.paciente_persona_id = @pid ${filtroIps}
            GROUP BY co.id, co.fecha_consulta, co.creado_en,
                     LTRIM(RTRIM(ISNULL(pf.primer_nombre,'') + ' ' + ISNULL(pf.segundo_nombre,''))) + ' ' +
                     LTRIM(RTRIM(ISNULL(pf.primer_apellido,'') + ' ' + ISNULL(pf.segundo_apellido,''))),
                     co.codigo_evento, co.nombre_evento, co.estado, co.resumen_consulta
            ORDER BY ISNULL(co.fecha_consulta, CAST(co.creado_en AS DATE)) DESC
        `);
        res.json(r.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/** Citas agendadas sin consulta vinculada (para atención del médico) */
router.get('/citas-programadas', requiereAuth, requierePermiso('consultas.ver'), async (req, res) => {
    try {
        let medicoId = req.query.medico_usuario_id ? parseInt(req.query.medico_usuario_id, 10) : null;
        if (!medicoId || Number.isNaN(medicoId)) {
            return res.status(400).json({ error: 'medico_usuario_id requerido' });
        }

        const pool = await obtenerConexion();
        const request = pool.request().input('medico_id', medicoId);

        let filtroIps = '';
        if (!req.esAdminDinamedical) {
            filtroIps = ' AND c.ips_id = @ips_id';
            request.input('ips_id', req.usuario.ips_id);
        }

        const r = await request.query(`
            SELECT c.id, c.ips_id,
                   CONVERT(VARCHAR(10), c.fecha, 23) AS fecha,
                   CONVERT(VARCHAR(5), c.hora, 108) AS hora,
                   c.tipo_atencion, c.direccion_cita, c.observaciones,
                   c.paciente_persona_id, c.medico_usuario_id,
                   LTRIM(RTRIM(ISNULL(pp.primer_nombre,'') + ' ' + ISNULL(pp.segundo_nombre,''))) + ' ' +
                   LTRIM(RTRIM(ISNULL(pp.primer_apellido,'') + ' ' + ISNULL(pp.segundo_apellido,''))) AS paciente_nombre,
                   pp.numero_documento, pp.tipo_documento_codigo
            FROM citas c
            INNER JOIN personas pp ON pp.id_persona = c.paciente_persona_id
            WHERE c.activo = 1
              AND c.medico_usuario_id = @medico_id
              AND c.consulta_id IS NULL
              AND NOT EXISTS (SELECT 1 FROM consultas co WHERE co.cita_id = c.id)
              AND c.fecha >= DATEADD(day, -14, CAST(GETDATE() AS DATE))
              AND c.fecha <= DATEADD(day, 120, CAST(GETDATE() AS DATE))
              ${filtroIps}
            ORDER BY c.fecha, c.hora
        `);
        res.json(r.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id(\\d+)', requiereAuth, requierePermiso('consultas.ver'), async (req, res) => {
    try {
        const consultaId = parseInt(req.params.id, 10);
        const pool = await obtenerConexion();
        const r = await pool.request()
            .input('id', consultaId)
            .query(`${SELECT_BASE} AND co.id = @id`);

        const row = r.recordset[0];
        if (!row) return res.status(404).json({ error: 'Consulta no encontrada' });
        if (!req.esAdminDinamedical && row.ips_id !== req.usuario.ips_id) {
            return res.status(403).json({ error: 'Sin acceso' });
        }
        row.sintomas = await sintomasDeConsulta(pool, row.id);
        res.json(row);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', requiereAuth, requierePermiso('consultas.crear'), async (req, res) => {
    try {
        const {
            paciente_persona_id, ips_id, cita_id, codigo_evento, nombre_evento,
            sintoma_ids, estado, evento_salud_publica,
            fecha_consulta, resumen_consulta,
            altura_cm, peso_kg, temperatura_c, frecuencia_cardiaca,
            ta_sistolica, ta_diastolica, saturacion_o2
        } = req.body;

        if (!paciente_persona_id) return res.status(400).json({ error: 'paciente requerido' });

        const ipsId = req.esAdminDinamedical ? (ips_id || req.usuario.ips_id) : req.usuario.ips_id;
        if (!ipsId) return res.status(400).json({ error: 'ips_id requerido' });

        const pool = await obtenerConexion();

        let profesionalId = req.usuario.id;
        if (cita_id) {
            const citaRow = await pool.request()
                .input('id', cita_id)
                .query('SELECT medico_usuario_id, ips_id FROM citas WHERE id = @id AND activo = 1');
            const cita = citaRow.recordset[0];
            if (!cita) return res.status(400).json({ error: 'Cita no encontrada' });
            if (!req.esAdminDinamedical && cita.ips_id !== req.usuario.ips_id) {
                return res.status(403).json({ error: 'Sin acceso a esta cita' });
            }
            profesionalId = cita.medico_usuario_id;
        }

        const ins = await pool.request()
            .input('ips_id', ipsId)
            .input('paciente_persona_id', paciente_persona_id)
            .input('profesional_usuario_id', profesionalId)
            .input('cita_id', cita_id || null)
            .input('codigo_evento', codigo_evento || null)
            .input('nombre_evento', nombre_evento || null)
            .input('evento_salud_publica', evento_salud_publica ? 1 : 0)
            .input('fecha_consulta', optStr(fecha_consulta))
            .input('resumen_consulta', optStr(resumen_consulta))
            .input('altura_cm', optNum(altura_cm))
            .input('peso_kg', optNum(peso_kg))
            .input('temperatura_c', optNum(temperatura_c))
            .input('frecuencia_cardiaca', optNum(frecuencia_cardiaca))
            .input('ta_sistolica', optNum(ta_sistolica))
            .input('ta_diastolica', optNum(ta_diastolica))
            .input('saturacion_o2', optNum(saturacion_o2))
            .input('estado', estado || 'borrador')
            .query(`
                INSERT INTO consultas (ips_id, paciente_persona_id, profesional_usuario_id, cita_id,
                    codigo_evento, nombre_evento, evento_salud_publica, fecha_consulta, resumen_consulta,
                    altura_cm, peso_kg, temperatura_c, frecuencia_cardiaca, ta_sistolica, ta_diastolica,
                    saturacion_o2, estado)
                OUTPUT INSERTED.id
                VALUES (@ips_id, @paciente_persona_id, @profesional_usuario_id, @cita_id,
                    @codigo_evento, @nombre_evento, @evento_salud_publica, @fecha_consulta, @resumen_consulta,
                    @altura_cm, @peso_kg, @temperatura_c, @frecuencia_cardiaca, @ta_sistolica, @ta_diastolica,
                    @saturacion_o2, @estado)
            `);

        const consultaId = ins.recordset[0].id;
        if (cita_id) {
            await pool.request()
                .input('consulta_id', consultaId)
                .input('cita_id', cita_id)
                .query(`
                    UPDATE citas SET consulta_id = @consulta_id, actualizado_en = GETDATE()
                    WHERE id = @cita_id AND activo = 1 AND consulta_id IS NULL
                `);
        }
        if (Array.isArray(sintoma_ids)) {
            for (const sid of new Set(sintoma_ids.map(Number))) {
                await pool.request()
                    .input('consulta_id', consultaId)
                    .input('sintoma_id', sid)
                    .query('IF NOT EXISTS (SELECT 1 FROM consulta_sintomas WHERE consulta_id = @consulta_id AND sintoma_id = @sintoma_id) INSERT INTO consulta_sintomas (consulta_id, sintoma_id) VALUES (@consulta_id, @sintoma_id)');
            }
        }

        const det = await pool.request().input('id', consultaId).query(`${SELECT_BASE} AND co.id = @id`);
        const out = det.recordset[0];
        out.sintomas = await sintomasDeConsulta(pool, consultaId);
        res.status(201).json(out);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id(\\d+)', requiereAuth, requierePermiso('consultas.editar'), async (req, res) => {
    try {
        const consultaId = parseInt(req.params.id, 10);
        const pool = await obtenerConexion();
        const prev = await pool.request()
            .input('id', consultaId)
            .query('SELECT ips_id FROM consultas WHERE id = @id');
        const row = prev.recordset[0];
        if (!row) return res.status(404).json({ error: 'Consulta no encontrada' });
        if (!req.esAdminDinamedical && row.ips_id !== req.usuario.ips_id) {
            return res.status(403).json({ error: 'Sin acceso' });
        }

        const { codigo_evento, nombre_evento, sintoma_ids, estado, cita_id, evento_salud_publica,
                fecha_consulta, resumen_consulta, altura_cm, peso_kg, temperatura_c,
                frecuencia_cardiaca, ta_sistolica, ta_diastolica, saturacion_o2 } = req.body;
        const request = pool.request().input('id', consultaId);
        const updates = [];
        if (codigo_evento !== undefined) { updates.push('codigo_evento = @codigo_evento'); request.input('codigo_evento', codigo_evento); }
        if (nombre_evento !== undefined) { updates.push('nombre_evento = @nombre_evento'); request.input('nombre_evento', nombre_evento); }
        if (evento_salud_publica !== undefined) { updates.push('evento_salud_publica = @esp'); request.input('esp', evento_salud_publica ? 1 : 0); }
        if (fecha_consulta !== undefined) { updates.push('fecha_consulta = @fecha_consulta'); request.input('fecha_consulta', optStr(fecha_consulta)); }
        if (resumen_consulta !== undefined) { updates.push('resumen_consulta = @resumen_consulta'); request.input('resumen_consulta', optStr(resumen_consulta)); }
        for (const [col, val] of Object.entries({
            altura_cm, peso_kg, temperatura_c, frecuencia_cardiaca, ta_sistolica, ta_diastolica, saturacion_o2
        })) {
            if (val !== undefined) { updates.push(`${col} = @${col}`); request.input(col, optNum(val)); }
        }
        if (estado !== undefined) { updates.push('estado = @estado'); request.input('estado', estado); }
        if (cita_id !== undefined) { updates.push('cita_id = @cita_id'); request.input('cita_id', cita_id || null); }

        if (updates.length) {
            updates.push('actualizado_en = GETDATE()');
            await request.query(`UPDATE consultas SET ${updates.join(', ')} WHERE id = @id`);
        }

        if (Array.isArray(sintoma_ids)) {
            await pool.request().input('id', consultaId).query('DELETE FROM consulta_sintomas WHERE consulta_id = @id');
            for (const sid of new Set(sintoma_ids.map(Number))) {
                await pool.request()
                    .input('consulta_id', consultaId)
                    .input('sintoma_id', sid)
                    .query('INSERT INTO consulta_sintomas (consulta_id, sintoma_id) VALUES (@consulta_id, @sintoma_id)');
            }
        }

        const det = await pool.request().input('id', consultaId).query(`${SELECT_BASE} AND co.id = @id`);
        const out = det.recordset[0];
        out.sintomas = await sintomasDeConsulta(pool, consultaId);
        res.json(out);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
