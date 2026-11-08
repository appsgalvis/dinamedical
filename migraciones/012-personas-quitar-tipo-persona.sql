-- ===========================================
-- MIGRACIÓN 012: Quitar columna tipo_persona de personas
-- El tipo (paciente/funcionario) se deduce por usuario_id
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

IF COL_LENGTH('dbo.personas', 'tipo_persona') IS NOT NULL
BEGIN
    DECLARE @nombreConstraint NVARCHAR(200);
    SELECT @nombreConstraint = dc.name
    FROM sys.default_constraints dc
    JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
    WHERE c.object_id = OBJECT_ID('dbo.personas') AND c.name = 'tipo_persona';
    IF @nombreConstraint IS NOT NULL
        EXEC('ALTER TABLE personas DROP CONSTRAINT ' + @nombreConstraint);
    ALTER TABLE personas DROP COLUMN tipo_persona;
    PRINT 'Columna tipo_persona eliminada de personas.';
END
GO

PRINT 'Migración 012 completada.';
