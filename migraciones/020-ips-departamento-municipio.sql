-- ===========================================
-- MIGRACIÓN 020: Ubicación DANE de la IPS (ocurrencia / procedencia)
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ips') AND name = 'departamento')
BEGIN
    ALTER TABLE ips ADD departamento NVARCHAR(5) NULL;
    PRINT 'Columna departamento agregada a ips.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ips') AND name = 'municipio')
BEGIN
    ALTER TABLE ips ADD municipio NVARCHAR(10) NULL;
    PRINT 'Columna municipio agregada a ips.';
END
GO

PRINT 'Migración 020 completada.';
