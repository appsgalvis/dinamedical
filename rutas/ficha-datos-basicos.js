const express = require('express');
const { obtenerConexion } = require('../configuracion/baseDatos');
const { requiereAuth, requierePermiso } = require('../middleware/auth');

const router = express.Router();

const SELECT_BASE = `
    SELECT f.id, f.ips_id, i.nombre AS ips_nombre, f.persona_id, f.usuario_id, f.consulta_id,
           f.codigo_evento, f.nombre_evento,
           CONVERT(VARCHAR(10), f.fecha_notificacion, 23) AS fecha_notificacion,
           f.razon_social_upgd, f.tipo_documento, f.numero_documento, f.telefono,
           CONVERT(VARCHAR(10), f.fecha_nacimiento, 23) AS fecha_nacimiento,
           f.edad, f.unidad_medida_edad, f.sexo, f.nacionalidad,
           f.procedencia_departamento, f.procedencia_municipio, f.area_procedencia,
           CONVERT(VARCHAR(10), f.fecha_inicio_sintomas, 23) AS fecha_inicio_sintomas,
           f.clasificacion_inicial, f.fuente_notificacion, f.condicion_final,
           f.pertenencia_etnica, f.identidad_genero, f.orientacion_sexual, f.grupos_poblacional,
           f.regimen_salud, f.residencia_departamento, f.residencia_municipio,
           f.direccion_residencia, f.estado_notificacion, f.creado_en, f.actualizado_en,
           LTRIM(RTRIM(ISNULL(pp.primer_nombre,'') + ' ' + ISNULL(pp.segundo_nombre,''))) + ' ' +
           LTRIM(RTRIM(ISNULL(pp.primer_apellido,'') + ' ' + ISNULL(pp.segundo_apellido,''))) AS persona_nombre,
           uf.email AS usuario_nombre
    FROM ficha_datos_basicos f
    INNER JOIN ips i ON i.id = f.ips_id
    INNER JOIN personas pp ON pp.id_persona = f.persona_id
    INNER JOIN usuarios uf ON uf.id = f.usuario_id
    WHERE 1=1
`;

function optStr(v) {
    return (v === '' || v == null) ? null : String(v);
}

function optNum(v) {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

const CAMPOS_FICHA = [
    'codigo_evento', 'nombre_evento', 'fecha_notificacion', 'razon_social_upgd',
    'tipo_documento', 'numero_documento', 'telefono', 'fecha_nacimiento', 'edad',
    'unidad_medida_edad', 'sexo', 'nacionalidad', 'procedencia_departamento',
    'procedencia_municipio', 'area_procedencia', 'fecha_inicio_sintomas',
    'clasificacion_inicial', 'fuente_notificacion', 'condicion_final',
    'pertenencia_etnica', 'identidad_genero', 'orientacion_sexual',
    'grupos_poblacional', 'regimen_salud', 'residencia_departamento',
    'residencia_municipio', 'direccion_residencia', 'estado_notificacion'
];

router.get('/', requiereAuth, requierePermiso('consultas.ver'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const request = pool.request();
        let q = SELECT_BASE;
        if (!req.esAdminDinamedical) {
            q += ' AND f.ips_id = @ips_id';
            request.input('ips_id', req.usuario.ips_id);
        }
        if (req.query.consulta_id) {
            q += ' AND f.consulta_id = @consulta_id';
            request.input('consulta_id', parseInt(req.query.consulta_id, 10));
        }
        if (req.query.persona_id) {
            q += ' AND f.persona_id = @persona_id';
            request.input('persona_id', parseInt(req.query.persona_id, 10));
        }
        q += ' ORDER BY f.actualizado_en DESC';
        const r = await request.query(q);
        res.json(r.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id(\\d+)', requiereAuth, requierePermiso('consultas.ver'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const r = await pool.request()
            .input('id', parseInt(req.params.id, 10))
            .query(`${SELECT_BASE} AND f.id = @id`);
        const row = r.recordset[0];
        if (!row) return res.status(404).json({ error: 'Ficha no encontrada' });
        if (!req.esAdminDinamedical && row.ips_id !== req.usuario.ips_id) {
            return res.status(403).json({ error: 'Sin acceso' });
        }
        res.json(row);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

async function leerFichaPorConsulta(pool, consultaId) {
    const r = await pool.request()
        .input('cid', consultaId)
        .query(`${SELECT_BASE} AND f.consulta_id = @cid`);
    return r.recordset[0];
}

/** Upsert por consulta: una ficha por consulta (consulta_id UNIQUE) */
router.post('/', requiereAuth, requierePermiso('consultas.crear'), async (req, res) => {
    try {
        const consultaId = parseInt(req.body.consulta_id, 10);
        if (!consultaId || Number.isNaN(consultaId)) {
            return res.status(400).json({ error: 'consulta_id requerido' });
        }

        const pool = await obtenerConexion();
        const cons = await pool.request()
            .input('cid', consultaId)
            .query('SELECT id, ips_id, paciente_persona_id FROM consultas WHERE id = @cid');
        const consulta = cons.recordset[0];
        if (!consulta) return res.status(400).json({ error: 'Consulta no encontrada' });
        if (!req.esAdminDinamedical && consulta.ips_id !== req.usuario.ips_id) {
            return res.status(403).json({ error: 'Sin acceso a esta consulta' });
        }

        const ipsId = req.esAdminDinamedical ? (req.body.ips_id || req.usuario.ips_id) : consulta.ips_id;
        const personaId = consulta.paciente_persona_id;
        const usuarioId = req.usuario.id;

        const existente = await leerFichaPorConsulta(pool, consulta.id);

        if (existente) {
            const request = pool.request().input('cid', consulta.id);
            const updates = [];
            for (const campo of CAMPOS_FICHA) {
                if (req.body[campo] !== undefined) {
                    updates.push(`${campo} = @${campo}`);
                    request.input(campo, campo === 'edad' ? optNum(req.body[campo]) : optStr(req.body[campo]));
                }
            }
            if (updates.length) {
                updates.push('actualizado_en = GETDATE()');
                await request.query(`UPDATE ficha_datos_basicos SET ${updates.join(', ')} WHERE consulta_id = @cid`);
            }
            res.json(await leerFichaPorConsulta(pool, consulta.id));
            return;
        }

        const request = pool.request()
            .input('ips_id', ipsId)
            .input('persona_id', personaId)
            .input('usuario_id', usuarioId)
            .input('consulta_id', consulta.id);
        const cols = ['ips_id', 'persona_id', 'usuario_id', 'consulta_id'];
        const vals = ['@ips_id', '@persona_id', '@usuario_id', '@consulta_id'];
        for (const campo of CAMPOS_FICHA) {
            if (req.body[campo] !== undefined) {
                cols.push(campo);
                vals.push(`@${campo}`);
                request.input(campo, campo === 'edad' ? optNum(req.body[campo]) : optStr(req.body[campo]));
            }
        }

        const ins = await request.query(`
            INSERT INTO ficha_datos_basicos (${cols.join(', ')})
            OUTPUT INSERTED.id
            VALUES (${vals.join(', ')})
        `);
        const nueva = await pool.request()
            .input('id', ins.recordset[0].id)
            .query(`${SELECT_BASE} AND f.id = @id`);
        res.status(201).json(nueva.recordset[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

