-- ===========================================
-- MIGRACIÓN 008: Link permanente en ubicaciones
-- Codigo de enlace: siempre válido, actualiza lat/long en tiempo real
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- Teléfono en personas (para WhatsApp)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('personas') AND name = 'telefono')
BEGIN
    ALTER TABLE personas ADD telefono NVARCHAR(20) NULL;
    PRINT 'Columna telefono agregada a personas.';
END
GO

-- Código permanente del enlace (identificador en la URL, siempre válido)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ubicaciones') AND name = 'link_codigo')
BEGIN
    ALTER TABLE ubicaciones ADD link_codigo NVARCHAR(64) NULL;
    PRINT 'Columna link_codigo agregada a ubicaciones.';
END
GO

-- Migrar link_token a link_codigo si existía
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ubicaciones') AND name = 'link_token')
BEGIN
    UPDATE ubicaciones SET link_codigo = link_token WHERE link_token IS NOT NULL AND (link_codigo IS NULL OR link_codigo = '');
    ALTER TABLE ubicaciones DROP COLUMN link_token;
    PRINT 'Columna link_token migrada a link_codigo.';
END
GO

-- Quitar link_usado si existía (ya no se usa)
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ubicaciones') AND name = 'link_usado')
BEGIN
    ALTER TABLE ubicaciones DROP COLUMN link_usado;
    PRINT 'Columna link_usado eliminada.';
END
GO

-- Índice para buscar por codigo
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ubicaciones_link_codigo' AND object_id = OBJECT_ID('ubicaciones'))
BEGIN
    CREATE UNIQUE INDEX IX_ubicaciones_link_codigo ON ubicaciones(link_codigo) WHERE link_codigo IS NOT NULL;
    PRINT 'Índice IX_ubicaciones_link_codigo creado.';
END
GO

-- Eliminar índice viejo si existe
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ubicaciones_link_token' AND object_id = OBJECT_ID('ubicaciones'))
BEGIN
    DROP INDEX IX_ubicaciones_link_token ON ubicaciones;
    PRINT 'Índice IX_ubicaciones_link_token eliminado.';
END
GO

PRINT 'Migración 008 completada.';
