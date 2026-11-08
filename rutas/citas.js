const express = require('express');
const { obtenerConexion } = require('../configuracion/baseDatos');
const { requiereAuth, requierePermiso } = require('../middleware/auth');

const router = express.Router();

const HORA_INICIO = 7;
const HORA_FIN = 19;
const INTERVALO_MIN = 30;

function slotsPorDia() {
    return ((HORA_FIN - HORA_INICIO) * 60) / INTERVALO_MIN;
}

function codigosRolUsuario(req) {
    return (req.usuario.roles || []).map(r => r.codigo);
}

/** Admin IPS / facturación / admin global: eligen médico en agenda y al reprogramar */
function puedeElegirCualquierMedicoAgenda(req) {
    if (req.esAdminDinamedical) return true;
    const c = codigosRolUsuario(req);
    return c.includes('admin_ips') || c.includes('facturador_ips');
}

async function listarMedicosParaAgenda(pool, req) {
    const request = pool.request();
    let filtro = ' AND u.activo = 1';
    if (!req.esAdminDinamedical) {
        filtro += ' AND u.ips_id = @ips_id';
        request.input('ips_id', req.usuario.ips_id);
    }
    const r = await request.query(`
        SELECT DISTINCT u.id, u.cargo, u.ips_id,
            i.nombre AS ips_nombre,
            i.departamento AS ips_departamento,
            i.municipio AS ips_municipio,
            LTRIM(RTRIM(ISNULL(p.primer_nombre,'') + ' ' + ISNULL(p.segundo_nombre,''))) + ' ' +
            LTRIM(RTRIM(ISNULL(p.primer_apellido,'') + ' ' + ISNULL(p.segundo_apellido,''))) AS nombre_completo
        FROM usuarios u
        LEFT JOIN personas p ON p.id_persona = u.persona_id
        LEFT JOIN ips i ON i.id = u.ips_id
        INNER JOIN usuario_rol ur ON ur.usuario_id = u.id
        INNER JOIN roles ro ON ro.id = ur.rol_id
        WHERE ro.codigo = 'profesional_ips' ${filtro}
        ORDER BY nombre_completo
    `);
    let medicos = r.recordset;
    if (!puedeElegirCualquierMedicoAgenda(req)) {
        medicos = medicos.filter(m => m.id === req.usuario.id);
        if (!medicos.length && codigosRolUsuario(req).includes('profesional_ips')) {
            const nom = [req.usuario.nombre, req.usuario.apellido].filter(Boolean).join(' ').trim();
            medicos = [{
                id: req.usuario.id,
                cargo: req.usuario.cargo || null,
                ips_id: req.usuario.ips_id || null,
                ips_nombre: req.usuario.ips_nombre || null,
                ips_departamento: null,
                ips_municipio: null,
                nombre_completo: nom || req.usuario.email
            }];
        }
    }
    return medicos;
}

async function resolverIpsIdCita(pool, req, { ips_id, medico_usuario_id, paciente_persona_id }) {
    const candidatos = [];

    if (req.usuario.ips_id) candidatos.push(req.usuario.ips_id);
    if (ips_id) candidatos.push(parseInt(ips_id, 10));

    if (medico_usuario_id) {
        const med = await pool.request()
            .input('id', medico_usuario_id)
            .query('SELECT ips_id FROM usuarios WHERE id = @id AND activo = 1');
        if (med.recordset[0]?.ips_id) candidatos.push(med.recordset[0].ips_id);
    }

    if (paciente_persona_id) {
        const pac = await pool.request()
            .input('id', paciente_persona_id)
            .query('SELECT ips_id FROM personas WHERE id_persona = @id');
        if (pac.recordset[0]?.ips_id) candidatos.push(pac.recordset[0].ips_id);
    }

    const ipsId = candidatos.find(id => id != null && !Number.isNaN(id));
    if (!ipsId) return null;

    if (!req.esAdminDinamedical && req.usuario.ips_id && ipsId !== req.usuario.ips_id) {
        return { error: 'La cita debe pertenecer a su IPS' };
    }

    return { ipsId };
}

const SELECT_CITA = `
    SELECT c.id, c.ips_id,
           CONVERT(VARCHAR(10), c.fecha, 23) AS fecha,
           CONVERT(VARCHAR(5), c.hora, 108) AS hora,
           c.duracion_minutos, c.tipo_atencion, c.direccion_cita,
           c.observaciones, c.consulta_id, c.creado_en,
           i.nombre AS ips_nombre, i.direccion AS ips_direccion,
           c.paciente_persona_id, c.medico_usuario_id, c.registrado_por_usuario_id,
           LTRIM(RTRIM(ISNULL(pp.primer_nombre,'') + ' ' + ISNULL(pp.segundo_nombre,''))) + ' ' +
           LTRIM(RTRIM(ISNULL(pp.primer_apellido,'') + ' ' + ISNULL(pp.segundo_apellido,''))) AS paciente_nombre,
           LTRIM(RTRIM(ISNULL(pm.primer_nombre,'') + ' ' + ISNULL(pm.segundo_nombre,''))) + ' ' +
           LTRIM(RTRIM(ISNULL(pm.primer_apellido,'') + ' ' + ISNULL(pm.segundo_apellido,''))) AS medico_nombre,
           um.cargo AS medico_cargo,
           LTRIM(RTRIM(ISNULL(pr.primer_nombre,'') + ' ' + ISNULL(pr.segundo_nombre,''))) + ' ' +
           LTRIM(RTRIM(ISNULL(pr.primer_apellido,'') + ' ' + ISNULL(pr.segundo_apellido,''))) AS registrado_por_nombre
    FROM citas c
    INNER JOIN ips i ON i.id = c.ips_id
    INNER JOIN personas pp ON pp.id_persona = c.paciente_persona_id
    INNER JOIN usuarios um ON um.id = c.medico_usuario_id
    LEFT JOIN personas pm ON pm.id_persona = um.persona_id
    INNER JOIN usuarios ur ON ur.id = c.registrado_por_usuario_id
    LEFT JOIN personas pr ON pr.id_persona = ur.persona_id
    WHERE c.activo = 1
`;

// Ocupación por día (para colores del calendario)
router.get('/ocupacion', requiereAuth, requierePermiso('citas.ver'), async (req, res) => {
    try {
        const { anio, mes } = req.query;
        if (!anio || !mes) return res.status(400).json({ error: 'anio y mes requeridos' });

        const pool = await obtenerConexion();
        const request = pool.request()
            .input('anio', parseInt(anio, 10))
            .input('mes', parseInt(mes, 10));

        let filtro = '';
        if (!req.esAdminDinamedical) {
            filtro = ' AND c.ips_id = @ips_id';
            request.input('ips_id', req.usuario.ips_id);
        }

        const capacidad = slotsPorDia();
        const r = await request.query(`
            SELECT c.fecha, COUNT(*) AS ocupadas
            FROM citas c
            WHERE c.activo = 1
              AND YEAR(c.fecha) = @anio AND MONTH(c.fecha) = @mes
              ${filtro}
            GROUP BY c.fecha
        `);

        const dias = {};
        for (const row of r.recordset) {
            const f = row.fecha.toISOString?.().slice(0, 10) || String(row.fecha).slice(0, 10);
            const ratio = row.ocupadas / capacidad;
            let nivel = 'verde';
            if (ratio >= 1) nivel = 'rojo';
            else if (ratio >= 0.75) nivel = 'naranja';
            else if (ratio >= 0.5) nivel = 'amarillo';
            dias[f] = { ocupadas: row.ocupadas, capacidad, nivel };
        }
        res.json({ capacidad_dia: capacidad, dias });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Última fecha con citas activas (para abrir la agenda en un día con registros)
router.get('/ultima-fecha', requiereAuth, requierePermiso('citas.ver'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const request = pool.request();
        let filtro = ' AND c.fecha <= CAST(GETDATE() AS DATE)';
        if (!req.esAdminDinamedical) {
            filtro += ' AND c.ips_id = @ips_id';
            request.input('ips_id', req.usuario.ips_id);
        }
        if (!puedeElegirCualquierMedicoAgenda(req)) {
            filtro += ' AND c.medico_usuario_id = @medico_id';
            request.input('medico_id', req.usuario.id);
        }
        const r = await request.query(`
            SELECT MAX(c.fecha) AS fecha
            FROM citas c
            WHERE c.activo = 1 ${filtro}
        `);
        const fecha = r.recordset[0]?.fecha;
        const fechaStr = fecha ? (fecha.toISOString?.().slice(0, 10) || String(fecha).slice(0, 10)) : null;
        res.json({ fecha: fechaStr });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Citas de un día (matriz)
router.get('/dia', requiereAuth, requierePermiso('citas.ver'), async (req, res) => {
    try {
        const { fecha } = req.query;
        if (!fecha) return res.status(400).json({ error: 'fecha requerida (YYYY-MM-DD)' });

        const pool = await obtenerConexion();
        const request = pool.request().input('fecha', fecha);
        let filtro = '';
        if (!req.esAdminDinamedical) {
            filtro = ' AND c.ips_id = @ips_id';
            request.input('ips_id', req.usuario.ips_id);
        }

        const r = await request.query(`${SELECT_CITA} AND c.fecha = @fecha ${filtro} ORDER BY c.hora`);
        res.json(r.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/medicos', requiereAuth, requierePermiso('citas.ver'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const medicos = await listarMedicosParaAgenda(pool, req);
        res.json({
            medicos,
            puede_elegir_medico: puedeElegirCualquierMedicoAgenda(req)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id(\\d+)', requiereAuth, requierePermiso('citas.ver'), async (req, res) => {
    try {
        const citaId = parseInt(req.params.id, 10);
        const pool = await obtenerConexion();
        const request = pool.request().input('id', citaId);
        let filtro = '';
        if (!req.esAdminDinamedical) {
            filtro = ' AND c.ips_id = @ips_id';
            request.input('ips_id', req.usuario.ips_id);
        }
        const r = await request.query(`${SELECT_CITA} AND c.id = @id ${filtro}`);
        const row = r.recordset[0];
        if (!row) return res.status(404).json({ error: 'Cita no encontrada' });
        if (!puedeElegirCualquierMedicoAgenda(req) && row.medico_usuario_id !== req.usuario.id) {
            return res.status(403).json({ error: 'Sin acceso a esta cita' });
        }
        res.json(row);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/config-agenda', requiereAuth, requierePermiso('citas.ver'), (req, res) => {
    res.json({
        hora_inicio: HORA_INICIO,
        hora_fin: HORA_FIN,
        intervalo_minutos: INTERVALO_MIN,
        slots_por_dia: slotsPorDia()
    });
});

router.post('/', requiereAuth, requierePermiso('citas.crear'), async (req, res) => {
    try {
        const {
            paciente_persona_id, medico_usuario_id, fecha, hora,
            tipo_atencion, direccion_cita, ubicacion_id, observaciones, ips_id
        } = req.body;

        if (!paciente_persona_id || !medico_usuario_id || !fecha || !hora) {
            return res.status(400).json({ error: 'paciente, médico, fecha y hora son requeridos' });
        }

        const pool = await obtenerConexion();
        const resuelto = await resolverIpsIdCita(pool, req, {
            ips_id, medico_usuario_id, paciente_persona_id
        });
        if (!resuelto || resuelto.error) {
            return res.status(400).json({
                error: resuelto?.error || 'No se pudo determinar la IPS. Verifique que el médico o el paciente estén vinculados a una IPS.'
            });
        }
        const ipsId = resuelto.ipsId;

        const insert = await pool.request()
            .input('ips_id', ipsId)
            .input('paciente_persona_id', paciente_persona_id)
            .input('medico_usuario_id', medico_usuario_id)
            .input('registrado_por', req.usuario.id)
            .input('fecha', fecha)
            .input('hora', hora)
            .input('tipo_atencion', tipo_atencion || 'consultorio')
            .input('direccion_cita', direccion_cita || null)
            .input('ubicacion_id', ubicacion_id || null)
            .input('observaciones', observaciones || null)
            .query(`
                INSERT INTO citas (ips_id, paciente_persona_id, medico_usuario_id, registrado_por_usuario_id,
                    fecha, hora, tipo_atencion, direccion_cita, ubicacion_id, observaciones)
                OUTPUT INSERTED.id
                VALUES (@ips_id, @paciente_persona_id, @medico_usuario_id, @registrado_por,
                    @fecha, @hora, @tipo_atencion, @direccion_cita, @ubicacion_id, @observaciones)
            `);

        const id = insert.recordset[0].id;
        const det = await pool.request().input('id', id).query(`${SELECT_CITA} AND c.id = @id`);
        res.status(201).json(det.recordset[0]);
    } catch (error) {
        if (error.number === 2627 || error.message?.includes('UX_citas_medico_hora')) {
            return res.status(409).json({ error: 'Ese horario ya está ocupado para el médico' });
        }
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id(\\d+)', requiereAuth, requierePermiso('citas.editar'), async (req, res) => {
    try {
        const citaId = parseInt(req.params.id, 10);
        const pool = await obtenerConexion();
        const actual = await pool.request()
            .input('id', citaId)
            .query('SELECT * FROM citas WHERE id = @id AND activo = 1');

        const cita = actual.recordset[0];
        if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });
        if (!req.esAdminDinamedical && cita.ips_id !== req.usuario.ips_id) {
            return res.status(403).json({ error: 'Sin acceso a esta cita' });
        }
        if (!puedeElegirCualquierMedicoAgenda(req) && cita.medico_usuario_id !== req.usuario.id) {
            return res.status(403).json({ error: 'Solo puede editar sus propias citas' });
        }

        const {
            fecha, hora, tipo_atencion, direccion_cita, observaciones, activo,
            medico_usuario_id, paciente_persona_id
        } = req.body;

        if (medico_usuario_id !== undefined && !puedeElegirCualquierMedicoAgenda(req)) {
            return res.status(403).json({ error: 'No puede reasignar el médico de la cita' });
        }

        const request = pool.request().input('id', citaId);
        const updates = [];
        if (paciente_persona_id !== undefined) {
            updates.push('paciente_persona_id = @paciente_persona_id');
            request.input('paciente_persona_id', paciente_persona_id);
        }
        if (medico_usuario_id !== undefined) {
            updates.push('medico_usuario_id = @medico_usuario_id');
            request.input('medico_usuario_id', medico_usuario_id);
        }
        if (fecha !== undefined) { updates.push('fecha = @fecha'); request.input('fecha', fecha); }
        if (hora !== undefined) { updates.push('hora = @hora'); request.input('hora', hora); }
        if (tipo_atencion !== undefined) { updates.push('tipo_atencion = @tipo_atencion'); request.input('tipo_atencion', tipo_atencion); }
        if (direccion_cita !== undefined) { updates.push('direccion_cita = @direccion_cita'); request.input('direccion_cita', direccion_cita); }
        if (observaciones !== undefined) { updates.push('observaciones = @observaciones'); request.input('observaciones', observaciones); }
        if (activo !== undefined) { updates.push('activo = @activo'); request.input('activo', activo ? 1 : 0); }
        if (!updates.length) return res.status(400).json({ error: 'Nada que actualizar' });
        updates.push('actualizado_en = GETDATE()');

        await request.query(`UPDATE citas SET ${updates.join(', ')} WHERE id = @id`);
        const det = await pool.request().input('id', citaId).query(`${SELECT_CITA} AND c.id = @id`);
        res.json(det.recordset[0]);
    } catch (error) {
        if (error.number === 2627 || error.message?.includes('UX_citas_medico_hora')) {
            return res.status(409).json({ error: 'Ese horario ya está ocupado para el médico' });
        }
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
