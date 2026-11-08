const express = require('express');
const { obtenerConexion } = require('../configuracion/baseDatos');
const { requiereAuth, requierePermiso } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/detalles-eventos/def/100
 * Definiciones de preguntas del evento + opciones (desde listas) agrupadas por ref.
 */
router.get('/def/:evento', requiereAuth, requierePermiso('consultas.ver'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const evento = String(req.params.evento || '').trim();
        const defsR = await pool.request()
            .input('ev', evento)
            .query(`
                SELECT id, evento_codigo, seccion, subs, numero, ref, tipo, lista_ref,
                       obligatorio, show_if, padre_ref, seccion_label, label, indice
                FROM detalle_eventos
                WHERE evento_codigo = @ev AND activo = 1
                ORDER BY seccion, subs, indice
            `);
        const defs = defsR.recordset;
        const refs = [...new Set(defs.filter(d => d.lista_ref).map(d => d.lista_ref))];
        let opcionesPorRef = {};
        if (refs.length) {
            const inClause = refs.map((_, i) => `@r${i}`).join(',');
            const rq = pool.request();
            refs.forEach((r, i) => rq.input(`r${i}`, r));
            const opR = await rq.query(`
                SELECT ref, label, value, indice FROM listas
                WHERE activo = 1 AND ref IN (${inClause})
                ORDER BY ref, indice
            `);
            opcionesPorRef = {};
            for (const o of opR.recordset) {
                (opcionesPorRef[o.ref] = opcionesPorRef[o.ref] || []).push({ label: o.label, value: o.value });
            }
        }
        res.json(defs.map(d => ({
            ...d,
            opciones: d.lista_ref ? (opcionesPorRef[d.lista_ref] || []) : []
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/detalles-eventos/respuestas?consulta_id=1
 * Respuestas guardadas (valor; multiselect como array JSON).
 */
router.get('/respuestas', requiereAuth, requierePermiso('consultas.ver'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const cid = parseInt(req.query.consulta_id, 10);
        const pid = parseInt(req.query.persona_id, 10);
        if (!Number.isFinite(cid) && !Number.isFinite(pid)) {
            return res.status(400).json({ error: 'consulta_id o persona_id requerido' });
        }
        const rq = pool.request();
        let where;
        if (Number.isFinite(cid)) { rq.input('cid', cid); where = 'consulta_id = @cid'; }
        else { rq.input('pid', pid); where = 'persona_id = @pid'; }
        const r = await rq.query(`SELECT ref, valor FROM detalle_eventos_respuestas WHERE ${where}`);
        const val = {};
        for (const row of r.recordset) {
            let v = row.valor;
            if (typeof v === 'string' && v.startsWith('[')) { try { v = JSON.parse(v); } catch { /* string plano */ } }
            val[row.ref] = v;
        }
        res.json(val);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/detalles-eventos/respuestas
 * body: { consulta_id, valores: { ref: valor } }  (multiselect = array de values)
 */
router.post('/respuestas', requiereAuth, requierePermiso('consultas.editar'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const cid = parseInt(req.body.consulta_id, 10);
        const valores = req.body.valores || {};
        if (!Number.isFinite(cid)) return res.status(400).json({ error: 'consulta_id inválido' });

        // Stamps de vinculación directa: desde el body o resueltos desde la consulta/ficha
        let pid = req.body.persona_id == null ? null : parseInt(req.body.persona_id, 10);
        let uid = req.body.profesional_usuario_id == null ? null : parseInt(req.body.profesional_usuario_id, 10);
        let fichaId = req.body.ficha_id == null ? null : parseInt(req.body.ficha_id, 10);
        if (pid == null || uid == null) {
            const cR = await pool.request().input('cid', cid)
                .query('SELECT paciente_persona_id, profesional_usuario_id FROM consultas WHERE id = @cid');
            const c = cR.recordset[0];
            if (c) {
                if (pid == null) pid = c.paciente_persona_id;
                if (uid == null) uid = c.profesional_usuario_id;
            }
        }
        if (fichaId == null) {
            const fR = await pool.request().input('cid', cid)
                .query('SELECT TOP 1 id FROM ficha_datos_basicos WHERE consulta_id = @cid');
            const f = fR.recordset[0];
            if (f) fichaId = f.id;
        }

        for (const [ref, raw] of Object.entries(valores)) {
            const valor = Array.isArray(raw) ? JSON.stringify(raw) : (raw === '' || raw == null ? null : String(raw));
            const r = pool.request().input('cid', cid).input('ref', ref).input('val', valor);
            const exists = await r.query('SELECT 1 AS x FROM detalle_eventos_respuestas WHERE consulta_id = @cid AND ref = @ref');
            if (exists.recordset.length) {
                await pool.request().input('cid', cid).input('ref', ref).input('val', valor)
                    .query('UPDATE detalle_eventos_respuestas SET valor = @val, actualizado_en = GETDATE() WHERE consulta_id = @cid AND ref = @ref');
            } else {
                await pool.request().input('cid', cid).input('ref', ref).input('val', valor)
                    .input('pid', pid).input('uid', uid).input('fid', fichaId)
                    .query(`INSERT INTO detalle_eventos_respuestas (consulta_id, ref, valor, persona_id, profesional_usuario_id, ficha_id)
                            VALUES (@cid, @ref, @val, @pid, @uid, @fid)`);
            }
        }
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
