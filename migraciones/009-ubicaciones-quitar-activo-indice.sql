-- ===========================================
-- MIGRACIÓN 009: Quitar activo e indice de ubicaciones
-- Borrado físico (DELETE) en lugar de lógico.
-- Orden por id (última agregada = primera en lista).
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- Quitar columna activo
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ubicaciones') AND name = 'activo')
BEGIN
    ALTER TABLE ubicaciones DROP COLUMN activo;
    PRINT 'Columna activo eliminada de ubicaciones.';
END
GO

-- Quitar columna indice
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ubicaciones') AND name = 'indice')
BEGIN
    ALTER TABLE ubicaciones DROP COLUMN indice;
    PRINT 'Columna indice eliminada de ubicaciones.';
END
GO

PRINT 'Migración 009 completada.';
