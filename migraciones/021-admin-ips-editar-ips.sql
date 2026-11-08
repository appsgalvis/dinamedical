-- Admin IPS: ver y editar su IPS (incl. departamento/municipio ocurrencia)
SET QUOTED_IDENTIFIER ON;
GO
USE dinamedical;
GO

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.codigo = 'admin_ips'
AND p.codigo IN ('ips.ver', 'ips.editar')
AND NOT EXISTS (SELECT 1 FROM rol_permiso rp WHERE rp.rol_id = r.id AND rp.permiso_id = p.id);
GO

PRINT 'Migración 021 completada.';
