const { verificarToken } = require('../utilidades/jwt');
const { obtenerConexion } = require('../configuracion/baseDatos');

async function requiereAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: 'Token requerido' });
    }

    const payload = verificarToken(token);
    if (!payload) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    try {
        const pool = await obtenerConexion();
        const usuario = await pool.request()
            .input('id', payload.usuario_id)
            .query(`
                SELECT u.id, u.email, u.cargo, u.activo, u.ips_id, i.nombre AS ips_nombre,
                       LTRIM(RTRIM(ISNULL(p.primer_nombre,'') + ' ' + ISNULL(p.segundo_nombre,''))) as nombre,
                       LTRIM(RTRIM(ISNULL(p.primer_apellido,'') + ' ' + ISNULL(p.segundo_apellido,''))) as apellido
                FROM usuarios u
                LEFT JOIN personas p ON p.id_persona = u.persona_id
                LEFT JOIN ips i ON i.id = u.ips_id
                WHERE u.id = @id
            `);
        
        const u = usuario.recordset[0];
        if (!u || !u.activo) {
            return res.status(401).json({ error: 'Usuario inactivo' });
        }

        const roles = await pool.request()
            .input('usuario_id', payload.usuario_id)
            .query(`
                SELECT r.id, r.codigo, r.nombre, r.nivel_sistema, ur.ips_id
                FROM usuario_rol ur
                JOIN roles r ON r.id = ur.rol_id
                WHERE ur.usuario_id = @usuario_id
            `);

        const permisos = await pool.request()
            .input('usuario_id', payload.usuario_id)
            .query(`
                SELECT DISTINCT p.codigo
                FROM usuario_rol ur
                JOIN rol_permiso rp ON rp.rol_id = ur.rol_id
                JOIN permisos p ON p.id = rp.permiso_id
                WHERE ur.usuario_id = @usuario_id
            `);

        req.usuario = {
            ...u,
            roles: roles.recordset,
            permisos: permisos.recordset.map(p => p.codigo)
        };
        req.esAdminDinamedical = req.usuario.roles.some(r => r.codigo === 'admin_dinamedical');
        next();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

function requierePermiso(codigoPermiso) {
    return (req, res, next) => {
        if (req.esAdminDinamedical) return next();
        if (req.usuario.permisos.includes(codigoPermiso)) return next();
        res.status(403).json({ error: 'Sin permiso para esta acción' });
    };
}

/** Al menos uno de los permisos listados (admin Dinamedical siempre pasa). */
function requiereAlgunPermiso(...codigosPermiso) {
    return (req, res, next) => {
        if (req.esAdminDinamedical) return next();
        if (codigosPermiso.some(c => req.usuario.permisos.includes(c))) return next();
        res.status(403).json({ error: 'Sin permiso para esta acción' });
    };
}

function requiereAdminDinamedical(req, res, next) {
    if (req.esAdminDinamedical) return next();
    res.status(403).json({ error: 'Se requiere rol Administrador Dinamedical' });
}

module.exports = { requiereAuth, requierePermiso, requiereAlgunPermiso, requiereAdminDinamedical };
