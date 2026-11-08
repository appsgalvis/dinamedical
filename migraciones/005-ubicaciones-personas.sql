-- ===========================================
-- MIGRACIÓN 005: Ubicaciones y vista Personas
-- Tabla ubicaciones: direcciones vinculadas a persona (lat, long, indice)
-- Personas: tipo_persona (paciente/funcionario), ips_id
-- Permisos: personas.ver, personas.editar
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== TABLA UBICACIONES ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ubicaciones')
BEGIN
    CREATE TABLE ubicaciones (
        id INT IDENTITY(1,1) PRIMARY KEY,
        persona_id INT NOT NULL REFERENCES personas(id_persona) ON DELETE CASCADE,
        direccion NVARCHAR(500) NOT NULL,
        latitud DECIMAL(10, 7),
        longitud DECIMAL(10, 7),
        indice INT DEFAULT 0,
        activo BIT DEFAULT 1,
        creado_en DATETIME2 DEFAULT GETDATE()
    );
    CREATE INDEX IX_ubicaciones_persona ON ubicaciones(persona_id);
    PRINT 'Tabla ubicaciones creada.';
END
GO

-- ========== AGREGAR CAMPOS A PERSONAS ==========
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('personas') AND name = 'tipo_persona')
BEGIN
    ALTER TABLE personas ADD tipo_persona NVARCHAR(20) DEFAULT 'paciente';
    PRINT 'Columna tipo_persona agregada a personas.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('personas') AND name = 'ips_id')
BEGIN
    ALTER TABLE personas ADD ips_id INT NULL REFERENCES ips(id) ON DELETE SET NULL;
    PRINT 'Columna ips_id agregada a personas.';
END
GO

-- Actualizar ips_id y tipo_persona de personas vinculadas a usuarios (funcionarios)
UPDATE p SET p.ips_id = u.ips_id, p.tipo_persona = 'funcionario'
FROM personas p
INNER JOIN usuarios u ON u.persona_id = p.id_persona;
GO

-- ========== PERMISOS PERSONAS ==========
IF NOT EXISTS (SELECT 1 FROM permisos WHERE codigo = 'personas.ver')
    INSERT INTO permisos (codigo, nombre, descripcion, modulo) VALUES
        ('personas.ver', 'Ver personas', 'Ver listado de personas (pacientes y funcionarios)', 'personas'),
        ('personas.editar', 'Editar personas', 'Editar datos de personas de su IPS', 'personas');
GO

-- Admin Dinamedical: personas (ya tiene todos por el INSERT de 001)
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.codigo = 'admin_dinamedical' AND p.codigo IN ('personas.ver', 'personas.editar')
AND NOT EXISTS (SELECT 1 FROM rol_permiso rp WHERE rp.rol_id = r.id AND rp.permiso_id = p.id);
GO

-- Admin IPS: personas
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.codigo = 'admin_ips' AND p.codigo IN ('personas.ver', 'personas.editar')
AND NOT EXISTS (SELECT 1 FROM rol_permiso rp WHERE rp.rol_id = r.id AND rp.permiso_id = p.id);
GO

PRINT 'Migración 005 completada.';
