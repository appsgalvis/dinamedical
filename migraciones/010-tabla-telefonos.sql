-- ===========================================
-- MIGRACIÓN 010: Tabla telefonos
-- Una persona puede tener varios teléfonos (celular, fijo)
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'telefonos')
BEGIN
    CREATE TABLE telefonos (
        id INT IDENTITY(1,1) PRIMARY KEY,
        persona_id INT NOT NULL REFERENCES personas(id_persona) ON DELETE CASCADE,
        numero NVARCHAR(20) NOT NULL,
        tipo NVARCHAR(20) NULL,
        creado_en DATETIME2 DEFAULT GETDATE()
    );
    CREATE INDEX IX_telefonos_persona ON telefonos(persona_id);
    PRINT 'Tabla telefonos creada.';
END
GO

-- Migrar teléfonos existentes de personas a la nueva tabla (solo si la columna existe)
IF COL_LENGTH('dbo.personas', 'telefono') IS NOT NULL
BEGIN
    INSERT INTO telefonos (persona_id, numero, tipo)
    SELECT p.id_persona, p.telefono, 'celular'
    FROM personas p
    WHERE p.telefono IS NOT NULL AND LTRIM(RTRIM(p.telefono)) != ''
      AND NOT EXISTS (SELECT 1 FROM telefonos t WHERE t.persona_id = p.id_persona);
    PRINT 'Teléfonos migrados desde personas.';
END
GO

PRINT 'Migración 010 completada.';
