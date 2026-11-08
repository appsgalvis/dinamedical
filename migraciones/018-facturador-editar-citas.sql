-- ===========================================
-- MIGRACIÓN 018: Facturador puede crear/editar citas (reprogramar)
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.codigo = 'facturador_ips'
AND p.codigo IN ('citas.crear', 'citas.editar')
AND NOT EXISTS (SELECT 1 FROM rol_permiso rp WHERE rp.rol_id = r.id AND rp.permiso_id = p.id);
GO

PRINT 'Migración 018 completada.';
