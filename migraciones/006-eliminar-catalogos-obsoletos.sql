-- ===========================================
-- MIGRACIÓN 006: Eliminar tablas obsoletas
-- tipo_documento y sexo ya no se usan (reemplazadas por listas)
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== ELIMINAR FK DE PERSONAS A TIPO_DOCUMENTO Y SEXO ==========
DECLARE @nombre NVARCHAR(256);
DECLARE cur CURSOR LOCAL FOR
    SELECT fk.name
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
    WHERE fk.parent_object_id = OBJECT_ID('personas')
    AND fkc.referenced_object_id IN (OBJECT_ID('tipo_documento'), OBJECT_ID('sexo'));

OPEN cur;
FETCH NEXT FROM cur INTO @nombre;
WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC('ALTER TABLE personas DROP CONSTRAINT ' + @nombre);
    FETCH NEXT FROM cur INTO @nombre;
END
CLOSE cur;
DEALLOCATE cur;
PRINT 'Restricciones FK eliminadas de personas.';
GO

-- ========== ELIMINAR TABLA TIPO_DOCUMENTO ==========
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'tipo_documento')
BEGIN
    DROP TABLE tipo_documento;
    PRINT 'Tabla tipo_documento eliminada.';
END
GO

-- ========== ELIMINAR TABLA SEXO ==========
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'sexo')
BEGIN
    DROP TABLE sexo;
    PRINT 'Tabla sexo eliminada.';
END
GO

PRINT 'Migración 006 completada.';
