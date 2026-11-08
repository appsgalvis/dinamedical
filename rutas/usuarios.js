const express = require('express');
const bcrypt = require('bcryptjs');
const { obtenerConexion } = require('../configuracion/baseDatos');
const { requiereAuth, requierePermiso, requiereAdminDinamedical } = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 10;

// Listar usuarios (filtrado por IPS si no es admin_dinamedical)
router.get('/', requiereAuth, requierePermiso('usuarios.ver'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        let resultado;
        const camposPersona = `LTRIM(RTRIM(ISNULL(p.primer_nombre,'') + ' ' + ISNULL(p.segundo_nombre,''))) as nombre, LTRIM(RTRIM(ISNULL(p.primer_apellido,'') + ' ' + ISNULL(p.segundo_apellido,''))) as apellido`;
        if (req.esAdminDinamedical) {
            resultado = await pool.request().query(`
                SELECT u.id, u.email, u.cargo, ${camposPersona}, u.activo, u.ips_id, u.creado_en,
                       i.nombre as ips_nombre,
                       (SELECT STRING_AGG(r.nombre, ', ') WITHIN GROUP (ORDER BY r.nombre) FROM usuario_rol ur JOIN roles r ON r.id = ur.rol_id WHERE ur.usuario_id = u.id) as roles
                FROM usuarios u
                LEFT JOIN ips i ON i.id = u.ips_id
                LEFT JOIN personas p ON p.id_persona = u.persona_id
                ORDER BY p.primer_apellido, p.primer_nombre
            `);
        } else {
            resultado = await pool.request()
                .input('ips_id', req.usuario.ips_id)
                .query(`
                    SELECT u.id, u.email, u.cargo, ${camposPersona}, u.activo, u.ips_id, u.creado_en,
                           i.nombre as ips_nombre,
                           (SELECT STRING_AGG(r.nombre, ', ') WITHIN GROUP (ORDER BY r.nombre) FROM usuario_rol ur JOIN roles r ON r.id = ur.rol_id WHERE ur.usuario_id = u.id) as roles
                    FROM usuarios u
                    LEFT JOIN ips i ON i.id = u.ips_id
                    LEFT JOIN personas p ON p.id_persona = u.persona_id
                    WHERE u.ips_id = @ips_id
                    ORDER BY p.primer_apellido, p.primer_nombre
                `);
        }
        res.json(resultado.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear usuario (requiere persona existente sin usuario vinculado)
router.post('/', requiereAuth, requierePermiso('usuarios.crear'), async (req, res) => {
    try {
        const { email, clave, persona_id, ips_id, rol_id, cargo } = req.body;
        const personaId = persona_id != null ? parseInt(persona_id, 10) : NaN;
        if (!email || !clave || !persona_id) {
            return res.status(400).json({ error: 'email, clave y persona son requeridos. Debe seleccionar una persona creada previamente.' });
        }
        if (isNaN(personaId) || personaId < 1) {
            return res.status(400).json({ error: 'persona_id inválido. Seleccione una persona de la lista.' });
        }

        const ipsFinal = req.esAdminDinamedical ? (ips_id ? parseInt(ips_id, 10) || null : null) : req.usuario.ips_id;
        if (!req.esAdminDinamedical && !ipsFinal) {
            return res.status(400).json({ error: 'Usuario debe pertenecer a una IPS' });
        }

        const pool = await obtenerConexion();
        const ipsIdValidacion = req.esAdminDinamedical ? null : (req.usuario.ips_id ?? null);

        const personaValida = await pool.request()
            .input('persona_id', personaId)
            .input('ips_id', ipsIdValidacion)
            .query(`
                SELECT p.id_persona, p.ips_id FROM personas p
                WHERE p.id_persona = @persona_id
                  AND (@ips_id IS NULL OR p.ips_id = @ips_id)
                  AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.persona_id = p.id_persona)
            `);
        if (!personaValida.recordset[0]) {
            return res.status(400).json({ error: 'Persona no encontrada, ya tiene usuario vinculado o no pertenece a su IPS' });
        }

        const ipsPersona = personaValida.recordset[0].ips_id;
        const ipsFinal2 = req.esAdminDinamedical ? (ipsFinal ?? ipsPersona) : ipsFinal;
        const claveHash = await bcrypt.hash(clave, SALT_ROUNDS);
        const emailNorm = String(email).trim().toLowerCase();

        const existenteEmail = await pool.request()
            .input('email', emailNorm)
            .query('SELECT id, persona_id, activo FROM usuarios WHERE LOWER(LTRIM(RTRIM(email))) = @email');

        let usuarioId;
        let revinculado = false;

        const previo = existenteEmail.recordset[0];
        if (previo) {
            if (previo.persona_id != null && previo.persona_id !== personaId) {
                return res.status(400).json({ error: 'El email ya está en uso por otra cuenta activa' });
            }
            if (previo.persona_id === personaId) {
                return res.status(400).json({ error: 'Esta persona ya tiene ese usuario vinculado' });
            }
            // Cuenta desvinculada (sin persona): reactivar y revincular
            if (previo.persona_id == null) {
                await pool.request()
                    .input('id', previo.id)
                    .input('persona_id', personaId)
                    .input('clave_hash', claveHash)
                    .input('ips_id', ipsFinal2)
                    .input('cargo', cargo ? String(cargo).trim() : null)
                    .query(`
                        UPDATE usuarios SET
                            persona_id = @persona_id,
                            clave_hash = @clave_hash,
                            ips_id = @ips_id,
                            cargo = @cargo,
                            activo = 1,
                            actualizado_en = GETDATE()
                        WHERE id = @id
                    `);
                usuarioId = previo.id;
                revinculado = true;
                await pool.request()
                    .input('usuario_id', usuarioId)
                    .query('DELETE FROM usuario_rol WHERE usuario_id = @usuario_id');
            } else {
                return res.status(400).json({ error: 'El email ya existe' });
            }
        } else {
            await pool.request()
                .input('email', emailNorm)
                .input('clave_hash', claveHash)
                .input('persona_id', personaId)
                .input('ips_id', ipsFinal2)
                .input('creado_por_id', req.usuario.id)
                .input('cargo', cargo ? String(cargo).trim() : null)
                .query(`
                    INSERT INTO usuarios (email, clave_hash, persona_id, ips_id, creado_por_id, cargo)
                    VALUES (@email, @clave_hash, @persona_id, @ips_id, @creado_por_id, @cargo)
                `);
            const nuevo = await pool.request()
                .input('email', emailNorm)
                .query('SELECT id FROM usuarios WHERE LOWER(LTRIM(RTRIM(email))) = @email');
            usuarioId = nuevo.recordset[0].id;
        }

        const rolId = rol_id || (await pool.request().query("SELECT id FROM roles WHERE codigo = 'profesional_ips'")).recordset[0]?.id;

        if (rolId) {
            await pool.request()
                .input('usuario_id', usuarioId)
                .input('rol_id', rolId)
                .input('ips_id', ipsFinal2 ?? ipsFinal)
                .query('INSERT INTO usuario_rol (usuario_id, rol_id, ips_id) VALUES (@usuario_id, @rol_id, @ips_id)');
        }

        await pool.request()
            .input('persona_id', personaId)
            .query(`
                UPDATE personas SET ultimo_usuario_desvinculado_id = NULL
                WHERE id_persona = @persona_id
            `).catch(() => {});

        const usuarioResp = await pool.request()
            .input('id', usuarioId)
            .query(`
                SELECT u.id, u.email, u.activo, u.ips_id, u.creado_en,
                       LTRIM(RTRIM(ISNULL(p.primer_nombre,'') + ' ' + ISNULL(p.segundo_nombre,''))) as nombre,
                       LTRIM(RTRIM(ISNULL(p.primer_apellido,'') + ' ' + ISNULL(p.segundo_apellido,''))) as apellido
                FROM usuarios u
                LEFT JOIN personas p ON p.id_persona = u.persona_id
                WHERE u.id = @id
            `);

        res.status(revinculado ? 200 : 201).json({
            ...usuarioResp.recordset[0],
            revinculado
        });
    } catch (error) {
        if (error.number === 2627) res.status(400).json({ error: 'El email ya existe' });
        else res.status(500).json({ error: error.message });
    }
});

// Obtener un usuario
router.get('/:id', requiereAuth, requierePermiso('usuarios.ver'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const usuario = await pool.request()
            .input('id', req.params.id)
            .input('ips_id', req.usuario.ips_id)
            .query(`
                SELECT u.id, u.email, u.cargo, u.activo, u.ips_id, u.creado_en, u.persona_id,
                       i.nombre as ips_nombre,
                       p.tipo_documento_codigo, p.numero_documento, p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido, p.fecha_nacimiento, p.sexo_codigo, p.ubicaciones,
                       LTRIM(RTRIM(ISNULL(p.primer_nombre,'') + ' ' + ISNULL(p.segundo_nombre,''))) as nombre,
                       LTRIM(RTRIM(ISNULL(p.primer_apellido,'') + ' ' + ISNULL(p.segundo_apellido,''))) as apellido
                FROM usuarios u
                LEFT JOIN ips i ON i.id = u.ips_id
                LEFT JOIN personas p ON p.id_persona = u.persona_id
                WHERE u.id = @id AND (@ips_id IS NULL OR u.ips_id = @ips_id)
            `);

        if (!usuario.recordset[0]) return res.status(404).json({ error: 'Usuario no encontrado' });

        const u = usuario.recordset[0];
        let telefonos = [];
        let ubicaciones = [];
        if (u.persona_id) {
            try {
                const [tel, ub] = await Promise.all([
                    pool.request().input('persona_id', u.persona_id).query('SELECT id, numero, tipo FROM telefonos WHERE persona_id = @persona_id ORDER BY id'),
                    pool.request().input('persona_id', u.persona_id).query('SELECT id, direccion FROM ubicaciones WHERE persona_id = @persona_id ORDER BY id DESC')
                ]);
                telefonos = tel.recordset || [];
                ubicaciones = ub.recordset || [];
            } catch (_) { /* tablas pueden no existir */ }
        }

        const roles = await pool.request()
            .input('usuario_id', req.params.id)
            .query(`
                SELECT r.id, r.codigo, r.nombre, ur.ips_id
                FROM usuario_rol ur
                JOIN roles r ON r.id = ur.rol_id
                WHERE ur.usuario_id = @usuario_id
            `);

        res.json({ ...u, roles: roles.recordset, telefonos, ubicaciones });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actualizar usuario
router.put('/:id', requiereAuth, requierePermiso('usuarios.editar'), async (req, res) => {
    try {
        const { primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, tipo_documento_codigo, numero_documento, fecha_nacimiento, sexo_codigo, activo, clave, cargo } = req.body;
        const nombre = primer_nombre ?? req.body.nombre;
        const apellido = primer_apellido ?? req.body.apellido;
        const pool = await obtenerConexion();

        const existente = await pool.request()
            .input('id', req.params.id)
            .input('ips_id', req.usuario.ips_id)
            .query('SELECT id, persona_id FROM usuarios WHERE id = @id AND (@ips_id IS NULL OR ips_id = @ips_id)');

        if (!existente.recordset[0]) return res.status(404).json({ error: 'Usuario no encontrado' });

        const personaId = existente.recordset[0].persona_id;

        if (personaId && (nombre !== undefined || apellido !== undefined || segundo_nombre !== undefined || segundo_apellido !== undefined || tipo_documento_codigo !== undefined || numero_documento !== undefined || fecha_nacimiento !== undefined || sexo_codigo !== undefined)) {
            const updatesPersona = [];
            const reqPersona = pool.request().input('persona_id', personaId);
            if (nombre !== undefined) { updatesPersona.push('primer_nombre = @primer_nombre'); reqPersona.input('primer_nombre', nombre); }
            if (segundo_nombre !== undefined) { updatesPersona.push('segundo_nombre = @segundo_nombre'); reqPersona.input('segundo_nombre', segundo_nombre); }
            if (apellido !== undefined) { updatesPersona.push('primer_apellido = @primer_apellido'); reqPersona.input('primer_apellido', apellido); }
            if (segundo_apellido !== undefined) { updatesPersona.push('segundo_apellido = @segundo_apellido'); reqPersona.input('segundo_apellido', segundo_apellido); }
            if (tipo_documento_codigo !== undefined) { updatesPersona.push('tipo_documento_codigo = @tipo_documento_codigo'); reqPersona.input('tipo_documento_codigo', tipo_documento_codigo); }
            if (numero_documento !== undefined) { updatesPersona.push('numero_documento = @numero_documento'); reqPersona.input('numero_documento', numero_documento); }
            if (fecha_nacimiento !== undefined) { updatesPersona.push('fecha_nacimiento = @fecha_nacimiento'); reqPersona.input('fecha_nacimiento', fecha_nacimiento); }
            if (sexo_codigo !== undefined) { updatesPersona.push('sexo_codigo = @sexo_codigo'); reqPersona.input('sexo_codigo', sexo_codigo); }
            if (updatesPersona.length > 0) {
                updatesPersona.push('actualizado_en = GETDATE()');
                await reqPersona.query(`UPDATE personas SET ${updatesPersona.join(', ')} WHERE id_persona = @persona_id`);
            }
        }

        const updates = [];
        const request = pool.request().input('id', req.params.id);
        if (activo !== undefined) { updates.push('activo = @activo'); request.input('activo', activo ? 1 : 0); }
        if (cargo !== undefined) { updates.push('cargo = @cargo'); request.input('cargo', cargo ? String(cargo).trim() : null); }
        if (clave) {
            const hash = await bcrypt.hash(clave, SALT_ROUNDS);
            updates.push('clave_hash = @clave_hash');
            request.input('clave_hash', hash);
        }
        const huboActualizacionPersona = personaId && (nombre !== undefined || apellido !== undefined || segundo_nombre !== undefined || segundo_apellido !== undefined || tipo_documento_codigo !== undefined || numero_documento !== undefined || fecha_nacimiento !== undefined || sexo_codigo !== undefined);
        if (updates.length === 0 && !huboActualizacionPersona) return res.status(400).json({ error: 'Nada que actualizar' });

        if (updates.length > 0) {
            updates.push('actualizado_en = GETDATE()');
            await request.query(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = @id`);
        }

        const actualizado = await pool.request()
            .input('id', req.params.id)
            .query(`
                SELECT u.id, u.email, u.activo, u.ips_id,
                       LTRIM(RTRIM(ISNULL(p.primer_nombre,'') + ' ' + ISNULL(p.segundo_nombre,''))) as nombre,
                       LTRIM(RTRIM(ISNULL(p.primer_apellido,'') + ' ' + ISNULL(p.segundo_apellido,''))) as apellido
                FROM usuarios u
                LEFT JOIN personas p ON p.id_persona = u.persona_id
                WHERE u.id = @id
            `);
        res.json(actualizado.recordset[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar usuario
router.delete('/:id', requiereAuth, requierePermiso('usuarios.eliminar'), async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const usuario = await pool.request()
            .input('id', req.params.id)
            .input('ips_id', req.usuario.ips_id)
            .query('SELECT id FROM usuarios WHERE id = @id AND (@ips_id IS NULL OR ips_id = @ips_id)');
        if (!usuario.recordset[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (parseInt(req.params.id) === req.usuario.id) {
            return res.status(400).json({ error: 'No puede eliminarse a sí mismo' });
        }
        await pool.request().input('id', req.params.id).query('DELETE FROM usuarios WHERE id = @id');
        res.json({ mensaje: 'Usuario eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Asignar roles a usuario
router.put('/:id/roles', requiereAuth, requierePermiso('usuarios.asignar_roles'), async (req, res) => {
    try {
        const { roles } = req.body; // [{ rol_id, ips_id }]
        if (!Array.isArray(roles)) return res.status(400).json({ error: 'roles debe ser un array' });

        const pool = await obtenerConexion();
        const usuario = await pool.request()
            .input('id', req.params.id)
            .input('ips_id', req.usuario.ips_id)
            .query('SELECT id, ips_id FROM usuarios WHERE id = @id AND (@ips_id IS NULL OR ips_id = @ips_id)');

        if (!usuario.recordset[0]) return res.status(404).json({ error: 'Usuario no encontrado' });

        const ipsUsuario = usuario.recordset[0].ips_id;
        if (!req.esAdminDinamedical && ipsUsuario !== req.usuario.ips_id) {
            return res.status(403).json({ error: 'No puede asignar roles a usuarios de otra IPS' });
        }

        await pool.request().input('usuario_id', req.params.id).query('DELETE FROM usuario_rol WHERE usuario_id = @usuario_id');

        for (const r of roles) {
            const rolId = r.rol_id;
            const ipsId = r.ips_id ?? ipsUsuario;
            const rol = await pool.request().input('rol_id', rolId).query('SELECT nivel_sistema FROM roles WHERE id = @rol_id');
            const ipsIdFinal = rol.recordset[0]?.nivel_sistema ? null : ipsId;
            await pool.request()
                .input('usuario_id', req.params.id)
                .input('rol_id', rolId)
                .input('ips_id', ipsIdFinal)
                .query('INSERT INTO usuario_rol (usuario_id, rol_id, ips_id) VALUES (@usuario_id, @rol_id, @ips_id)');
        }

        res.json({ mensaje: 'Roles actualizados' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
