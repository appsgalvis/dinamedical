-- ===========================================
-- MIGRACIÓN 024: Consultas — variables de la pestaña "Consulta"
-- Check de evento de salud pública, signos vitales, fecha de consulta
-- y resumen de consulta como columnas reales.
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('consultas') AND name = 'evento_salud_publica'
)
BEGIN
    ALTER TABLE consultas ADD
        evento_salud_publica BIT NOT NULL CONSTRAINT DF_consultas_evento_salud DEFAULT 0,
        altura_cm DECIMAL(5,2) NULL,
        peso_kg DECIMAL(6,2) NULL,
        temperatura_c DECIMAL(4,1) NULL,
        frecuencia_cardiaca INT NULL,
        ta_sistolica INT NULL,
        ta_diastolica INT NULL,
        saturacion_o2 INT NULL,
        fecha_consulta DATE NULL,
        resumen_consulta NVARCHAR(MAX) NULL;
    PRINT 'Migración 024: columnas de consulta agregadas.';
END
ELSE
    PRINT 'Migración 024: columnas de consulta ya existen, omitido.';
GO

-- Backfill: resúmenes de historias clínicas existentes -> resumen_consulta
UPDATE c
SET c.resumen_consulta = h.resumen_clinico
FROM consultas c
JOIN historias_clinicas h ON h.consulta_id = c.id
WHERE c.resumen_consulta IS NULL
  AND h.resumen_clinico IS NOT NULL
  AND h.resumen_clinico <> '';
GO

PRINT 'Migración 024 completada.';
GO
