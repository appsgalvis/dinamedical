const express = require('express');
const crypto = require('crypto');
const { obtenerConexion } = require('../configuracion/baseDatos');
const { requiereAuth, requierePermiso, requiereAlgunPermiso } = require('../middleware/auth');

async function desvincularUsuarioDePersona(pool, req, personaId) {
    const fila = await pool.request()
        .input('persona_id', personaId)
        .input('ips_id', req.esAdminDinamedical ? null : req.usuario.ips_id)
        .query(`
            SELECT u.id AS usuario_id, u.email
            FROM personas p
            INNER JOIN usuarios u ON u.persona_id = p.id_persona
            WHERE p.id_persona = @persona_id
              AND (@ips_id IS NULL OR p.ips_id = @ips_id)
        `);
    const usuario = fila.recordset[0];
    if (!usuario) {
        const err = new Error('Esta persona no tiene usuario vinculado');
        err.status = 404;
        throw err;
    }
    if (usuario.usuario_id === req.usuario.id) {
        const err = new Error('No puede desvincular su propia cuenta desde aquí');
        err.status = 400;
        throw err;
    }

    await pool.request()
        .input('usuario_id', usuario.usuario_id)
        .query('DELETE FROM usuario_rol WHERE usuario_id = @usuario_id');

    try {
        await pool.request()
            .input('id', usuario.usuario_id)
            .query('DELETE FROM usuarios WHERE id = @id');
        await pool.request()
            .input('persona_id', personaId)
            .query(`
                UPDATE personas SET ultimo_usuario_desvinculado_id = NULL
                WHERE id_persona = @persona_id
            `).catch(() => {});
        return {
            mensaje: 'Cuenta de usuario eliminada. La persona queda registrada solo como paciente.',
            modo: 'eliminado',
            email: usuario.email
        };
    } catch (error) {
        if (error.number !== 547) throw error;
        await pool.request()
            .input('id', usuario.usuario_id)
            .query(`
                UPDATE usuarios
                SET activo = 0, persona_id = NULL, actualizado_en = GETDATE()
                WHERE id = @id
            `);
        await pool.request()
            .input('persona_id', personaId)
            .input('uid', usuario.usuario_id)
            .query(`
                UPDATE personas SET ultimo_usuario_desvinculado_id = @uid
                WHERE id_persona = @persona_id
            `).catch(() => {});
        return {
            mensaje: 'La persona tiene atenciones asociadas a la cuenta. Se desactivó el acceso y se quitó el vínculo; la ficha de persona se mantiene como paciente.',
            modo: 'desactivado',
            email: usuario.email
        };
    }
}

const router = express.Router();

function aMayusculas(val) {
    return (val && typeof val === 'string') ? val.trim().toUpperCase() : val;
}

// Formato Colombia: Calle (A,B,C) - Orientación (vía generadora / entre) - Placa (A,B,C) - Descripción
function construirDireccion(d) {
    if (!d) return null;
    const partes = [];
    if (d.tipo_via && d.numero_via) {
        let via = aMayusculas(d.tipo_via) + ' ' + d.numero_via;
        if (d.complemento_via) via += aMayusculas(d.complemento_via);
        partes.push(via);
    }
    if (d.numero_orientacion || d.orientacion) {
        let ori = '';
        if (d.numero_orientacion) ori = String(d.numero_orientacion);
        if (d.orientacion) ori = ori ? ori + ' ' + aMayusculas(d.orientacion) : aMayusculas(d.orientacion);
        if (d.complemento_orientacion) ori += aMayusculas(d.complemento_orientacion);
        if (ori) partes.push(ori);
    }
    if (d.numero_placa) {
        let placa = '#' + d.numero_placa;
        if (d.complemento_placa) placa += aMayusculas(d.complemento_placa);
        partes.push(placa);
    }
    if (d.descripcion_adicional) partes.push(aMayusculas(d.descripcion_adicional));
    return partes.length ? partes.join(' - ') : null;
}

// Listar personas (usa vista v_personas, con búsqueda opcional por cédula, nombres, teléfonos)
router.get('/', requiereAuth, requierePermiso('personas.ver'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const esAdmin = req.esAdminDinamedical;
        const busqueda = (req.query.busqueda || '').trim();
        const sinUsuario = req.query.sin_usuario === '1' || req.query.sin_usuario === 'true';
        const patron = busqueda ? '%' + busqueda.replace(/\\/g,'\\\\').replace(/%/g,'\\%').replace(/_/g,'\\_') + '%' : null;

        let where = esAdmin ? '' : 'WHERE v.ips_id = @ips_id';
        if (sinUsuario) {
            const condSinUsuario = 'NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.persona_id = v.id_persona)';
            where = where ? where + ' AND ' + condSinUsuario : 'WHERE ' + condSinUsuario;
        }
        if (patron) {
            const condBusqueda = `(
                ISNULL(v.numero_documento,'') LIKE @patron ESCAPE '\\'
                OR ISNULL(v.primer_nombre,'') LIKE @patron ESCAPE '\\'
                OR ISNULL(v.segundo_nombre,'') LIKE @patron ESCAPE '\\'
                OR ISNULL(v.primer_apellido,'') LIKE @patron ESCAPE '\\'
                OR ISNULL(v.segundo_apellido,'') LIKE @patron ESCAPE '\\'
                OR EXISTS (SELECT 1 FROM telefonos t WHERE t.persona_id = v.id_persona AND t.numero LIKE @patron ESCAPE '\\')
            )`;
            where = where ? where + ' AND ' + condBusqueda : 'WHERE ' + condBusqueda;
        }

        const query = `SELECT * FROM v_personas v ${where} ORDER BY v.primer_apellido, v.primer_nombre`;
        const sqlReq = pool.request();
        if (!esAdmin) sqlReq.input('ips_id', req.usuario.ips_id);
        if (patron) sqlReq.input('patron', patron);
        const r = await sqlReq.query(query);
        res.json(r.recordset || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear persona
router.post('/', requiereAuth, requierePermiso('personas.crear'), async (req, res) => {
    try {
        const {
            tipo_documento_codigo, numero_documento, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
            fecha_nacimiento, sexo_codigo, ips_id, activo, residencia_departamento, residencia_municipio
        } = req.body;
        if (!primer_nombre?.trim() || !primer_apellido?.trim()) return res.status(400).json({ error: 'Primer nombre y primer apellido son requeridos' });
        const pool = await obtenerConexion();
        const esAdmin = req.esAdminDinamedical;
        const ipsFinal = (esAdmin && ips_id) ? ips_id : req.usuario.ips_id;
        if (!esAdmin && !ipsFinal) return res.status(400).json({ error: 'Debe pertenecer a una IPS para crear personas' });

        const r = await pool.request()
            .input('tipo_documento_codigo', tipo_documento_codigo || 'CC')
            .input('numero_documento', numero_documento || null)
            .input('primer_nombre', aMayusculas(primer_nombre))
            .input('segundo_nombre', aMayusculas(segundo_nombre) || null)
            .input('primer_apellido', aMayusculas(primer_apellido))
            .input('segundo_apellido', aMayusculas(segundo_apellido) || null)
            .input('fecha_nacimiento', fecha_nacimiento || null)
            .input('sexo_codigo', sexo_codigo || null)
            .input('residencia_departamento', residencia_departamento || null)
            .input('residencia_municipio', residencia_municipio || null)
            .input('ips_id', ipsFinal)
            .input('activo', activo !== false ? 1 : 0)
            .query(`
                INSERT INTO personas (tipo_documento_codigo, numero_documento, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                    fecha_nacimiento, sexo_codigo, residencia_departamento, residencia_municipio, ips_id, activo)
                OUTPUT INSERTED.id_persona
                VALUES (@tipo_documento_codigo, @numero_documento, @primer_nombre, @segundo_nombre, @primer_apellido, @segundo_apellido,
                    @fecha_nacimiento, @sexo_codigo, @residencia_departamento, @residencia_municipio, @ips_id, @activo)
            `);
        const idNuevo = r.recordset[0].id_persona;
        const nueva = await pool.request().input('id', idNuevo).query(`
            SELECT v.* FROM v_personas v WHERE v.id_persona = @id
        `);
        res.status(201).json(nueva.recordset[0]);
    } catch (error) {
        if (error.number === 2627) return res.status(400).json({ error: 'Ya existe una persona con ese documento' });
        res.status(500).json({ error: error.message });
    }
});

// Obtener una persona con sus ubicaciones
router.get('/:id', requiereAuth, requierePermiso('personas.ver'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const esAdmin = req.esAdminDinamedical;

        const persona = await pool.request()
            .input('id', req.params.id)
            .input('ips_id', req.usuario.ips_id)
            .query(`
                SELECT p.id_persona, p.tipo_documento_codigo, p.numero_documento,
                       p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido,
                       p.fecha_nacimiento, p.sexo_codigo, p.residencia_departamento, p.residencia_municipio,
                       p.ips_id, p.activo,
                       i.nombre as ips_nombre,
                       (SELECT TOP 1 u.id FROM usuarios u WHERE u.persona_id = p.id_persona) as usuario_id,
                       (SELECT TOP 1 u.email FROM usuarios u WHERE u.persona_id = p.id_persona) as usuario_email,
                       p.ultimo_usuario_desvinculado_id,
                       (SELECT u2.email FROM usuarios u2 WHERE u2.id = p.ultimo_usuario_desvinculado_id) AS email_cuenta_revincular
                FROM personas p
                LEFT JOIN ips i ON i.id = p.ips_id
                WHERE p.id_persona = @id AND (@ips_id IS NULL OR p.ips_id = @ips_id)
            `);

        if (!persona.recordset[0]) return res.status(404).json({ error: 'Persona no encontrada' });

        const p = persona.recordset[0];
        const tipo_persona = p.usuario_id ? 'funcionario' : 'paciente';

        const ubicaciones = await pool.request().input('persona_id', req.params.id).query(`SELECT id, direccion, tipo_via, numero_via, complemento_via, numero_placa, complemento_placa, orientacion, numero_orientacion, complemento_orientacion, descripcion_adicional, latitud, longitud FROM ubicaciones WHERE persona_id = @persona_id ORDER BY id DESC`);
        let telefonos = [];
        try {
            const r = await pool.request().input('persona_id', req.params.id).query(`SELECT id, numero, tipo FROM telefonos WHERE persona_id = @persona_id ORDER BY id`);
            telefonos = r.recordset || [];
        } catch (_) { /* tabla telefonos puede no existir aún */ }

        res.json({ ...p, tipo_persona, ubicaciones: ubicaciones.recordset, telefonos });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Quitar vínculo usuario ↔ persona (ex funcionario → solo paciente)
router.post('/:id/desvincular-usuario', requiereAuth, requierePermiso('usuarios.eliminar'), async (req, res) => {
    try {
        const personaId = parseInt(req.params.id, 10);
        if (Number.isNaN(personaId) || personaId < 1) {
            return res.status(400).json({ error: 'id de persona inválido' });
        }
        const pool = await obtenerConexion();
        const resultado = await desvincularUsuarioDePersona(pool, req, personaId);
        res.json(resultado);
    } catch (error) {
        const status = error.status || 500;
        if (status === 500) console.error('❌ desvincular-usuario:', error.message);
        res.status(status).json({ error: error.message || 'Error al desvincular' });
    }
});

// Actualizar persona
router.put('/:id', requiereAuth, requierePermiso('personas.editar'), async (req, res) => {
    try {
        const {
            ips_id, tipo_documento_codigo, numero_documento, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
            fecha_nacimiento, sexo_codigo, ubicaciones, activo, residencia_departamento, residencia_municipio
        } = req.body;
        const pool = await obtenerConexion();
        const esAdmin = req.esAdminDinamedical;

        const existente = await pool.request()
            .input('id', req.params.id)
            .input('ips_id', req.usuario.ips_id)
            .query('SELECT id_persona FROM personas WHERE id_persona = @id AND (@ips_id IS NULL OR ips_id = @ips_id)');

        if (!existente.recordset[0]) return res.status(404).json({ error: 'Persona no encontrada' });

        const updates = [];
        const request = pool.request().input('id', req.params.id);
        if (ips_id !== undefined && esAdmin) { updates.push('ips_id = @ips_id'); request.input('ips_id', ips_id || null); }
        if (tipo_documento_codigo !== undefined) { updates.push('tipo_documento_codigo = @tipo_documento_codigo'); request.input('tipo_documento_codigo', tipo_documento_codigo); }
        if (numero_documento !== undefined) { updates.push('numero_documento = @numero_documento'); request.input('numero_documento', numero_documento); }
        if (primer_nombre !== undefined) { updates.push('primer_nombre = @primer_nombre'); request.input('primer_nombre', aMayusculas(primer_nombre)); }
        if (segundo_nombre !== undefined) { updates.push('segundo_nombre = @segundo_nombre'); request.input('segundo_nombre', aMayusculas(segundo_nombre) || null); }
        if (primer_apellido !== undefined) { updates.push('primer_apellido = @primer_apellido'); request.input('primer_apellido', aMayusculas(primer_apellido)); }
        if (segundo_apellido !== undefined) { updates.push('segundo_apellido = @segundo_apellido'); request.input('segundo_apellido', aMayusculas(segundo_apellido) || null); }
        if (fecha_nacimiento !== undefined) { updates.push('fecha_nacimiento = @fecha_nacimiento'); request.input('fecha_nacimiento', fecha_nacimiento || null); }
        if (sexo_codigo !== undefined) { updates.push('sexo_codigo = @sexo_codigo'); request.input('sexo_codigo', sexo_codigo || null); }
        if (residencia_departamento !== undefined) {
            updates.push('residencia_departamento = @residencia_departamento');
            request.input('residencia_departamento', residencia_departamento || null);
        }
        if (residencia_municipio !== undefined) {
            updates.push('residencia_municipio = @residencia_municipio');
            request.input('residencia_municipio', residencia_municipio || null);
        }
        if (activo !== undefined) { updates.push('activo = @activo'); request.input('activo', activo ? 1 : 0); }

        if (updates.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
        updates.push('actualizado_en = GETDATE()');
        await request.query(`UPDATE personas SET ${updates.join(', ')} WHERE id_persona = @id`);

        const actualizado = await pool.request()
            .input('id', req.params.id)
            .query('SELECT p.*, i.nombre as ips_nombre FROM personas p LEFT JOIN ips i ON i.id = p.ips_id WHERE p.id_persona = @id');
        res.json(actualizado.recordset[0]);
    } catch (error) {
        console.error('PUT /personas/:id', error);
        res.status(500).json({ error: error.message });
    }
});

// Ubicaciones: agregar
router.post('/:id/ubicaciones', requiereAuth, requierePermiso('personas.editar'), async (req, res) => {
    try {
        const { tipo_via, numero_via, complemento_via, numero_placa, complemento_placa, orientacion, numero_orientacion, complemento_orientacion, descripcion_adicional, direccion, latitud, longitud } = req.body;
        const dirCompleta = aMayusculas(direccion) || construirDireccion({ tipo_via, numero_via, complemento_via, numero_placa, complemento_placa, orientacion, numero_orientacion, complemento_orientacion, descripcion_adicional });
        if (!dirCompleta && !tipo_via && !numero_via) return res.status(400).json({ error: 'Tipo de vía y número, o dirección requeridos' });

        const pool = await obtenerConexion();

        const persona = await pool.request()
            .input('id', req.params.id)
            .input('ips_id', req.usuario.ips_id)
            .query('SELECT id_persona FROM personas WHERE id_persona = @id AND (@ips_id IS NULL OR ips_id = @ips_id)');
        if (!persona.recordset[0]) return res.status(404).json({ error: 'Persona no encontrada' });

        await pool.request()
            .input('persona_id', req.params.id)
            .input('direccion', dirCompleta || null)
            .input('tipo_via', aMayusculas(tipo_via) || null)
            .input('numero_via', numero_via || null)
            .input('complemento_via', aMayusculas(complemento_via) || null)
            .input('numero_placa', numero_placa || null)
            .input('complemento_placa', aMayusculas(complemento_placa) || null)
            .input('orientacion', aMayusculas(orientacion) || null)
            .input('numero_orientacion', numero_orientacion || null)
            .input('complemento_orientacion', aMayusculas(complemento_orientacion) || null)
            .input('descripcion_adicional', aMayusculas(descripcion_adicional) || null)
            .input('latitud', latitud || null)
            .input('longitud', longitud || null)
            .query(`INSERT INTO ubicaciones (persona_id, direccion, tipo_via, numero_via, complemento_via, numero_placa, complemento_placa, orientacion, numero_orientacion, complemento_orientacion, descripcion_adicional, latitud, longitud) 
                VALUES (@persona_id, @direccion, @tipo_via, @numero_via, @complemento_via, @numero_placa, @complemento_placa, @orientacion, @numero_orientacion, @complemento_orientacion, @descripcion_adicional, @latitud, @longitud)`);

        const nueva = await pool.request()
            .input('persona_id', req.params.id)
            .query('SELECT TOP 1 id, direccion, tipo_via, numero_via, complemento_via, numero_placa, complemento_placa, orientacion, numero_orientacion, complemento_orientacion, descripcion_adicional, latitud, longitud FROM ubicaciones WHERE persona_id = @persona_id ORDER BY id DESC');
        res.status(201).json(nueva.recordset[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ubicaciones: actualizar
router.put('/:id/ubicaciones/:ubicacionId', requiereAuth, requierePermiso('personas.editar'), async (req, res) => {
    try {
        const { tipo_via, numero_via, complemento_via, numero_placa, complemento_placa, orientacion, numero_orientacion, complemento_orientacion, descripcion_adicional, direccion, latitud, longitud } = req.body;
        const pool = await obtenerConexion();

        const existente = await pool.request()
            .input('id', req.params.ubicacionId)
            .input('persona_id', req.params.id)
            .input('ips_id', req.usuario.ips_id)
            .query(`
                SELECT ub.id, ub.tipo_via, ub.numero_via, ub.complemento_via, ub.numero_placa, ub.complemento_placa, ub.orientacion, ub.numero_orientacion, ub.complemento_orientacion, ub.descripcion_adicional
                FROM ubicaciones ub
                JOIN personas p ON p.id_persona = ub.persona_id
                WHERE ub.id = @id AND ub.persona_id = @persona_id AND (@ips_id IS NULL OR p.ips_id = @ips_id)
            `);
        if (!existente.recordset[0]) return res.status(404).json({ error: 'Ubicación no encontrada' });

        const actual = existente.recordset[0];
        const merged = {
            tipo_via: tipo_via !== undefined ? aMayusculas(tipo_via) : actual.tipo_via,
            numero_via: numero_via !== undefined ? numero_via : actual.numero_via,
            complemento_via: complemento_via !== undefined ? aMayusculas(complemento_via) : actual.complemento_via,
            numero_placa: numero_placa !== undefined ? numero_placa : actual.numero_placa,
            complemento_placa: complemento_placa !== undefined ? aMayusculas(complemento_placa) : actual.complemento_placa,
            orientacion: orientacion !== undefined ? aMayusculas(orientacion) : actual.orientacion,
            numero_orientacion: numero_orientacion !== undefined ? numero_orientacion : actual.numero_orientacion,
            complemento_orientacion: complemento_orientacion !== undefined ? aMayusculas(complemento_orientacion) : actual.complemento_orientacion,
            descripcion_adicional: descripcion_adicional !== undefined ? aMayusculas(descripcion_adicional) : actual.descripcion_adicional
        };

        const updates = [];
        const sqlReq = pool.request().input('id', req.params.ubicacionId);
        if (tipo_via !== undefined) { updates.push('tipo_via = @tipo_via'); sqlReq.input('tipo_via', aMayusculas(tipo_via)); }
        if (numero_via !== undefined) { updates.push('numero_via = @numero_via'); sqlReq.input('numero_via', numero_via); }
        if (complemento_via !== undefined) { updates.push('complemento_via = @complemento_via'); sqlReq.input('complemento_via', aMayusculas(complemento_via)); }
        if (numero_placa !== undefined) { updates.push('numero_placa = @numero_placa'); sqlReq.input('numero_placa', numero_placa); }
        if (complemento_placa !== undefined) { updates.push('complemento_placa = @complemento_placa'); sqlReq.input('complemento_placa', aMayusculas(complemento_placa)); }
        if (orientacion !== undefined) { updates.push('orientacion = @orientacion'); sqlReq.input('orientacion', aMayusculas(orientacion)); }
        if (numero_orientacion !== undefined) { updates.push('numero_orientacion = @numero_orientacion'); sqlReq.input('numero_orientacion', numero_orientacion); }
        if (complemento_orientacion !== undefined) { updates.push('complemento_orientacion = @complemento_orientacion'); sqlReq.input('complemento_orientacion', aMayusculas(complemento_orientacion)); }
        if (descripcion_adicional !== undefined) { updates.push('descripcion_adicional = @descripcion_adicional'); sqlReq.input('descripcion_adicional', aMayusculas(descripcion_adicional)); }
        const camposDir = ['tipo_via', 'numero_via', 'complemento_via', 'numero_placa', 'complemento_placa', 'orientacion', 'numero_orientacion', 'complemento_orientacion', 'descripcion_adicional'];
        const hayCambioDir = camposDir.some(c => req.body[c] !== undefined);
        if (hayCambioDir) {
            const dirCompleta = construirDireccion(merged);
            updates.push('direccion = @direccion');
            sqlReq.input('direccion', dirCompleta || null);
        }
        if (direccion !== undefined && !hayCambioDir) { updates.push('direccion = @direccion'); sqlReq.input('direccion', aMayusculas(direccion)); }
        if (latitud !== undefined) { updates.push('latitud = @latitud'); sqlReq.input('latitud', latitud); }
        if (longitud !== undefined) { updates.push('longitud = @longitud'); sqlReq.input('longitud', longitud); }
        if (updates.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
        await sqlReq.query(`UPDATE ubicaciones SET ${updates.join(', ')} WHERE id = @id`);
        res.json({ mensaje: 'Ubicación actualizada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ubicaciones: generar link para enviar por WhatsApp (un solo uso)
router.post('/:id/ubicaciones/:ubicacionId/enviar-link', requiereAuth, requierePermiso('personas.editar'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const existente = await pool.request()
            .input('ubicacionId', req.params.ubicacionId)
            .input('persona_id', req.params.id)
            .input('ips_id', req.usuario.ips_id)
            .query(`
                SELECT ub.id FROM ubicaciones ub
                JOIN personas p ON p.id_persona = ub.persona_id
                WHERE ub.id = @ubicacionId AND ub.persona_id = @persona_id AND (@ips_id IS NULL OR p.ips_id = @ips_id)
            `);
        if (!existente.recordset[0]) return res.status(404).json({ error: 'Ubicación no encontrada' });

        const existenteConCodigo = await pool.request()
            .input('ubicacion_id', req.params.ubicacionId)
            .query('SELECT link_codigo FROM ubicaciones WHERE id = @ubicacion_id');
        let codigo = existenteConCodigo.recordset[0]?.link_codigo;
        if (!codigo) {
            codigo = crypto.randomBytes(8).toString('hex');
            await pool.request()
                .input('ubicacion_id', req.params.ubicacionId)
                .input('codigo', codigo)
                .query('UPDATE ubicaciones SET link_codigo = @codigo WHERE id = @ubicacion_id');
        }

        const baseUrl = (req.protocol || 'https') + '://' + (req.get('host') || 'dinamedical.solucion-digital.com');
        const urlActualizar = `${baseUrl}/actualizar-ubicacion.html?c=${codigo}`;

        const telefonoId = req.query.telefonoId || req.body?.telefonoId;
        let telefono = '';
        if (telefonoId) {
            const tel = await pool.request()
                .input('id', telefonoId)
                .input('persona_id', req.params.id)
                .query('SELECT numero FROM telefonos WHERE id = @id AND persona_id = @persona_id');
            telefono = tel.recordset[0]?.numero?.replace(/\D/g, '') || '';
        }
        if (!telefono) {
            try {
                const tels = await pool.request()
                    .input('persona_id', req.params.id)
                    .query('SELECT id, numero FROM telefonos WHERE persona_id = @persona_id');
                const con10 = (tels.recordset || []).filter(t => (t.numero?.replace(/\D/g, '') || '').length >= 10);
                telefono = con10[0]?.numero?.replace(/\D/g, '') || '';
            } catch (_) {}
        }
        if (telefono && !telefono.startsWith('57')) telefono = '57' + telefono;
        const urlWhatsApp = telefono
            ? `https://wa.me/${telefono}?text=${encodeURIComponent('Actualice su ubicación en tiempo real abriendo este enlace: ' + urlActualizar)}`
            : null;

        res.json({ url: urlActualizar, urlWhatsApp });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Teléfonos: listar (incluido en GET persona)
// Teléfonos: agregar
router.post('/:id/telefonos', requiereAuth, requiereAlgunPermiso('personas.editar', 'personas.crear'), async (req, res) => {
    try {
        const { numero, tipo } = req.body;
        if (!numero || !numero.trim()) return res.status(400).json({ error: 'Número requerido' });
        const personaId = parseInt(req.params.id, 10);
        if (isNaN(personaId)) return res.status(400).json({ error: 'ID de persona inválido' });
        const pool = await obtenerConexion();
        const persona = await pool.request()
            .input('id', personaId)
            .input('ips_id', req.usuario.ips_id ?? null)
            .query('SELECT id_persona FROM personas WHERE id_persona = @id AND (@ips_id IS NULL OR ips_id = @ips_id)');
        if (!persona.recordset[0]) return res.status(404).json({ error: 'Persona no encontrada' });
        await pool.request()
            .input('persona_id', personaId)
            .input('numero', numero.trim())
            .input('tipo', tipo || null)
            .query('INSERT INTO telefonos (persona_id, numero, tipo) VALUES (@persona_id, @numero, @tipo)');
        const nueva = await pool.request()
            .input('persona_id', personaId)
            .query('SELECT TOP 1 id, numero, tipo FROM telefonos WHERE persona_id = @persona_id ORDER BY id DESC');
        res.status(201).json(nueva.recordset[0]);
    } catch (error) {
        console.error('POST /personas/:id/telefonos', error);
        const msg = error.message || String(error);
        if (msg.includes('Invalid object name') && msg.includes('telefonos')) {
            return res.status(500).json({ error: 'Ejecute la migración 010 para crear la tabla telefonos en la base de datos.' });
        }
        res.status(500).json({ error: msg });
    }
});

// Teléfonos: actualizar
router.put('/:id/telefonos/:telefonoId', requiereAuth, requierePermiso('personas.editar'), async (req, res) => {
    try {
        const { numero, tipo } = req.body;
        const pool = await obtenerConexion();
        const existente = await pool.request()
            .input('id', req.params.telefonoId)
            .input('persona_id', req.params.id)
            .input('ips_id', req.usuario.ips_id)
            .query(`SELECT t.id FROM telefonos t JOIN personas p ON p.id_persona = t.persona_id WHERE t.id = @id AND t.persona_id = @persona_id AND (@ips_id IS NULL OR p.ips_id = @ips_id)`);
        if (!existente.recordset[0]) return res.status(404).json({ error: 'Teléfono no encontrado' });
        if (numero !== undefined) {
            if (!numero || !String(numero).trim()) return res.status(400).json({ error: 'Número requerido' });
            await pool.request()
                .input('id', req.params.telefonoId)
                .input('numero', String(numero).trim())
                .query('UPDATE telefonos SET numero = @numero WHERE id = @id');
        }
        if (tipo !== undefined) {
            await pool.request()
                .input('id', req.params.telefonoId)
                .input('tipo', tipo || null)
                .query('UPDATE telefonos SET tipo = @tipo WHERE id = @id');
        }
        const actualizado = await pool.request()
            .input('id', req.params.telefonoId)
            .query('SELECT id, numero, tipo FROM telefonos WHERE id = @id');
        res.json(actualizado.recordset[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Teléfonos: eliminar
router.delete('/:id/telefonos/:telefonoId', requiereAuth, requierePermiso('personas.editar'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const existente = await pool.request()
            .input('id', req.params.telefonoId)
            .input('persona_id', req.params.id)
            .input('ips_id', req.usuario.ips_id)
            .query(`SELECT t.id FROM telefonos t JOIN personas p ON p.id_persona = t.persona_id WHERE t.id = @id AND t.persona_id = @persona_id AND (@ips_id IS NULL OR p.ips_id = @ips_id)`);
        if (!existente.recordset[0]) return res.status(404).json({ error: 'Teléfono no encontrado' });
        await pool.request().input('id', req.params.telefonoId).query('DELETE FROM telefonos WHERE id = @id');
        res.json({ mensaje: 'Teléfono eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ubicaciones: eliminar (borrado físico)
router.delete('/:id/ubicaciones/:ubicacionId', requiereAuth, requierePermiso('personas.editar'), async (req, res) => {
    try {
        const pool = await obtenerConexion();

        const existente = await pool.request()
            .input('id', req.params.ubicacionId)
            .input('persona_id', req.params.id)
            .input('ips_id', req.usuario.ips_id)
            .query(`
                SELECT ub.id FROM ubicaciones ub
                JOIN personas p ON p.id_persona = ub.persona_id
                WHERE ub.id = @id AND ub.persona_id = @persona_id AND (@ips_id IS NULL OR p.ips_id = @ips_id)
            `);
        if (!existente.recordset[0]) return res.status(404).json({ error: 'Ubicación no encontrada' });

        await pool.request().input('id', req.params.ubicacionId).query('DELETE FROM ubicaciones WHERE id = @id');
        res.json({ mensaje: 'Ubicación eliminada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
