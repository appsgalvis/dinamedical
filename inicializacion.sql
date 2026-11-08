-- ===========================================
-- INICIALIZACIÓN DINAMEDICAL EN MSSQL
-- ===========================================
-- Crear base de datos y tabla de configuración
-- Ejecutar: .\scripts\ejecutar-dinamedical-sql.ps1
-- ===========================================

-- Crear base de datos si no existe
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'dinamedical')
BEGIN
    CREATE DATABASE dinamedical;
    PRINT 'Base de datos dinamedical creada.';
END
ELSE
BEGIN
    PRINT 'Base de datos dinamedical ya existe.';
END
GO

USE dinamedical;
GO

-- Tabla de configuración
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'configuracion')
BEGIN
    CREATE TABLE configuracion (
        id INT IDENTITY(1,1) PRIMARY KEY,
        clave NVARCHAR(100) NOT NULL UNIQUE,
        valor NVARCHAR(MAX),
        creado_en DATETIME2 DEFAULT GETDATE(),
        actualizado_en DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Tabla configuracion creada.';
END
GO

-- Datos iniciales
IF NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'nombre_ips')
    INSERT INTO configuracion (clave, valor) VALUES ('nombre_ips', 'Dinamedical');
IF NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'version')
    INSERT INTO configuracion (clave, valor) VALUES ('version', '1.0.0');
GO

PRINT 'Inicialización Dinamedical completada.';
