-- ===========================================
-- MIGRACIÓN 007: Direcciones estructuradas en ubicaciones
-- Campos: tipo_via, numero, complemento, orientacion, descripcion_adicional
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== LISTAS: Tipo de vía ==========
IF NOT EXISTS (SELECT 1 FROM listas WHERE ref = 'tipo_via')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice) VALUES
        ('Calle', 'CALLE', 'tipo_via', 'ubicacion', 'tipo_via', 1),
        ('Carrera', 'CARRERA', 'tipo_via', 'ubicacion', 'tipo_via', 2),
        ('Transversal', 'TRANSVERSAL', 'tipo_via', 'ubicacion', 'tipo_via', 3),
        ('Diagonal', 'DIAGONAL', 'tipo_via', 'ubicacion', 'tipo_via', 4),
        ('Avenida', 'AVENIDA', 'tipo_via', 'ubicacion', 'tipo_via', 5),
        ('Autopista', 'AUTOPISTA', 'tipo_via', 'ubicacion', 'tipo_via', 6),
        ('Circular', 'CIRCULAR', 'tipo_via', 'ubicacion', 'tipo_via', 7),
        ('Manzana', 'MANZANA', 'tipo_via', 'ubicacion', 'tipo_via', 8);
    PRINT 'Lista tipo_via insertada.';
END
GO

-- ========== LISTAS: Orientación ==========
IF NOT EXISTS (SELECT 1 FROM listas WHERE ref = 'orientacion')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice) VALUES
        ('Norte', 'Norte', 'orientacion', 'ubicacion', 'orientacion', 1),
        ('Sur', 'Sur', 'orientacion', 'ubicacion', 'orientacion', 2),
        ('Este', 'Este', 'orientacion', 'ubicacion', 'orientacion', 3),
        ('Oeste', 'Oeste', 'orientacion', 'ubicacion', 'orientacion', 4);
    PRINT 'Lista orientacion insertada.';
END
GO

-- ========== AGREGAR CAMPOS A UBICACIONES ==========
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ubicaciones') AND name = 'tipo_via')
    ALTER TABLE ubicaciones ADD tipo_via NVARCHAR(20) NULL;
GO
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ubicaciones') AND name = 'numero_via')
    ALTER TABLE ubicaciones ADD numero_via NVARCHAR(20) NULL;
GO
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ubicaciones') AND name = 'complemento_via')
    ALTER TABLE ubicaciones ADD complemento_via NVARCHAR(5) NULL;
GO
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ubicaciones') AND name = 'numero_placa')
    ALTER TABLE ubicaciones ADD numero_placa NVARCHAR(20) NULL;
GO
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ubicaciones') AND name = 'complemento_placa')
    ALTER TABLE ubicaciones ADD complemento_placa NVARCHAR(5) NULL;
GO
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ubicaciones') AND name = 'orientacion')
    ALTER TABLE ubicaciones ADD orientacion NVARCHAR(20) NULL;
GO
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ubicaciones') AND name = 'numero_orientacion')
    ALTER TABLE ubicaciones ADD numero_orientacion NVARCHAR(20) NULL;
GO
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ubicaciones') AND name = 'complemento_orientacion')
    ALTER TABLE ubicaciones ADD complemento_orientacion NVARCHAR(5) NULL;
GO
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ubicaciones') AND name = 'descripcion_adicional')
    ALTER TABLE ubicaciones ADD descripcion_adicional NVARCHAR(300) NULL;
GO

-- ========== Hacer direccion nullable para permitir solo campos estructurados ==========
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ubicaciones') AND name = 'direccion')
BEGIN
    ALTER TABLE ubicaciones ALTER COLUMN direccion NVARCHAR(500) NULL;
END
GO

PRINT 'Migración 007 completada.';
