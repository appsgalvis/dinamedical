-- ===========================================
-- MIGRACIÓN 016: Rol facturador_ips + campo cargo en usuarios
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== CARGO (especialidad / función del usuario) ==========
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'cargo')
BEGIN
    ALTER TABLE usuarios ADD cargo NVARCHAR(200) NULL;
    PRINT 'Columna cargo agregada a usuarios.';
END
GO

-- ========== ROL FACTURADOR IPS ==========
IF NOT EXISTS (SELECT 1 FROM roles WHERE codigo = 'facturador_ips')
BEGIN
    INSERT INTO roles (codigo, nombre, descripcion, nivel_sistema) VALUES
        ('facturador_ips', 'Facturador IPS', 'Facturación, cuentas médicas y soporte administrativo de la IPS', 0);
    PRINT 'Rol facturador_ips creado.';
END
GO

-- ========== PERMISOS FACTURACIÓN ==========
IF NOT EXISTS (SELECT 1 FROM permisos WHERE codigo = 'facturacion.ver')
BEGIN
    INSERT INTO permisos (codigo, nombre, descripcion, modulo) VALUES
        ('facturacion.ver', 'Ver facturación', 'Consultar información para facturación', 'facturacion'),
        ('facturacion.crear', 'Crear facturación', 'Registrar facturas y cargos', 'facturacion'),
        ('facturacion.editar', 'Editar facturación', 'Modificar registros de facturación', 'facturacion');
    PRINT 'Permisos facturacion insertados.';
END
GO

-- Admin Dinamedical: todos los permisos nuevos (ya los tiene por INSERT global en 001, pero por si acaso)
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.codigo = 'admin_dinamedical'
AND p.codigo IN ('facturacion.ver', 'facturacion.crear', 'facturacion.editar')
AND NOT EXISTS (SELECT 1 FROM rol_permiso rp WHERE rp.rol_id = r.id AND rp.permiso_id = p.id);
GO

-- Admin IPS: facturación + asignación de rol facturador
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.codigo = 'admin_ips'
AND p.codigo IN ('facturacion.ver', 'facturacion.crear', 'facturacion.editar')
AND NOT EXISTS (SELECT 1 FROM rol_permiso rp WHERE rp.rol_id = r.id AND rp.permiso_id = p.id);
GO

-- Facturador IPS
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.codigo = 'facturador_ips'
AND p.codigo IN (
    'sistema.ver', 'ips.ver', 'personas.ver',
    'citas.ver', 'consultas.ver',
    'facturacion.ver', 'facturacion.crear', 'facturacion.editar'
)
AND NOT EXISTS (SELECT 1 FROM rol_permiso rp WHERE rp.rol_id = r.id AND rp.permiso_id = p.id);
GO

-- ========== LISTA MAESTRA: cargos / especialidades sugeridos ==========
IF NOT EXISTS (SELECT 1 FROM listas WHERE ref = 'cargo_usuario')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice) VALUES
        ('Medicina general', 'MED_GENERAL', 'cargo_usuario', 'usuario', 'cargo', 1),
        ('Medicina interna', 'MED_INTERNA', 'cargo_usuario', 'usuario', 'cargo', 2),
        ('Pediatría', 'PEDIATRIA', 'cargo_usuario', 'usuario', 'cargo', 3),
        ('Ginecología y obstetricia', 'GINECO_OBST', 'cargo_usuario', 'usuario', 'cargo', 4),
        ('Cirugía general', 'CIRUGIA', 'cargo_usuario', 'usuario', 'cargo', 5),
        ('Odontología', 'ODONTOLOGIA', 'cargo_usuario', 'usuario', 'cargo', 6),
        ('Enfermería', 'ENFERMERIA', 'cargo_usuario', 'usuario', 'cargo', 7),
        ('Psicología', 'PSICOLOGIA', 'cargo_usuario', 'usuario', 'cargo', 8),
        ('Trabajo social', 'TRABAJO_SOCIAL', 'cargo_usuario', 'usuario', 'cargo', 9),
        ('Ingeniero de sistemas', 'ING_SISTEMAS', 'cargo_usuario', 'usuario', 'cargo', 10),
        ('Facturación / cuentas médicas', 'FACTURACION', 'cargo_usuario', 'usuario', 'cargo', 11),
        ('Auxiliar administrativo', 'AUX_ADMIN', 'cargo_usuario', 'usuario', 'cargo', 12),
        ('Otro (especificar en texto)', 'OTRO', 'cargo_usuario', 'usuario', 'cargo', 99);
    PRINT 'Lista cargo_usuario insertada.';
END
GO

PRINT 'Migración 016 completada.';
