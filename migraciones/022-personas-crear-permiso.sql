-- Permiso personas.crear: solo roles que registran pacientes/personas nuevas
SET QUOTED_IDENTIFIER ON;
GO
USE dinamedical;
GO

IF NOT EXISTS (SELECT 1 FROM permisos WHERE codigo = 'personas.crear')
BEGIN
    INSERT INTO permisos (codigo, nombre, descripcion, modulo, activo)
    VALUES (
        'personas.crear',
        'Crear personas',
        'Registrar nuevas personas (pacientes) en la IPS',
        'personas',
        1
    );
    PRINT 'Permiso personas.crear creado.';
END
GO

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE p.codigo = 'personas.crear'
AND r.codigo IN ('admin_dinamedical', 'admin_ips', 'facturador_ips', 'profesional_ips')
AND NOT EXISTS (
    SELECT 1 FROM rol_permiso rp WHERE rp.rol_id = r.id AND rp.permiso_id = p.id
);
GO

PRINT 'Migración 022 completada.';
GO
