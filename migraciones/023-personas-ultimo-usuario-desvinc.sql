-- Referencia opcional para revincular cuenta desactivada (sin borrar historial clínico)
SET QUOTED_IDENTIFIER ON;
GO
USE dinamedical;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('personas') AND name = 'ultimo_usuario_desvinculado_id'
)
BEGIN
    ALTER TABLE personas ADD ultimo_usuario_desvinculado_id INT NULL;
    PRINT 'Columna ultimo_usuario_desvinculado_id agregada a personas.';
END
GO

PRINT 'Migración 023 completada.';
GO
