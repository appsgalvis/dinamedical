-- ===========================================
-- MIGRACIÓN 002: NIT único en IPS
-- Evita que dos IPS tengan el mismo NIT
-- La API ya valida NIT único antes de insertar
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- Índice único en NIT (nivel base de datos)
-- La API ya valida NIT único antes de insertar
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UX_ips_nit' AND object_id = OBJECT_ID('ips'))
BEGIN
    CREATE UNIQUE INDEX UX_ips_nit ON ips(nit) WHERE nit IS NOT NULL;
    PRINT 'Índice único UX_ips_nit creado.';
END
GO
