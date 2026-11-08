-- ===========================================
-- MIGRACIÓN 017: Catálogo TipoEvento (SIVIGILA)
-- Datos: ejecutar scripts/sincronizar-tipo-evento-desde-sivigila.js
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tipo_evento')
BEGIN
    CREATE TABLE tipo_evento (
        id INT IDENTITY(1,1) PRIMARY KEY,
        codigo NVARCHAR(10) NOT NULL,
        nombre NVARCHAR(255) NOT NULL,
        notificacion_inmediata BIT NOT NULL DEFAULT 0,
        tipo_notificacion NVARCHAR(5) NULL,
        id_formulario INT NULL,
        version NVARCHAR(10) NULL,
        estado NVARCHAR(50) NULL,
        activo BIT NOT NULL DEFAULT 1,
        sincronizado_en DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT UX_tipo_evento_codigo UNIQUE (codigo)
    );
    CREATE INDEX IX_tipo_evento_nombre ON tipo_evento(nombre);
    PRINT 'Tabla tipo_evento creada.';
END
GO

PRINT 'Migración 017 completada (estructura). Ejecute sincronización desde SIVIGILA.';
