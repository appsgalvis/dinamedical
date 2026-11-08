-- ===========================================
-- MIGRACIÓN 011: Quitar columna telefono de personas
-- Los teléfonos se gestionan en la tabla telefonos (persona_id)
-- Ejecutar DESPUÉS de la migración 010 (que migra los datos)
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('personas') AND name = 'telefono')
BEGIN
    ALTER TABLE personas DROP COLUMN telefono;
    PRINT 'Columna telefono eliminada de personas.';
END
GO

PRINT 'Migración 011 completada.';
