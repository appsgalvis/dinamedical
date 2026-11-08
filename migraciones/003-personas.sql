-- ===========================================
-- MIGRACIÓN 003: Personas (entidad centralizada)
-- Centraliza datos de persona para usuarios y futuras entidades
-- Elimina campos repetidos (nombre, apellido) de usuarios
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== CATÁLOGO: Tipo de documento ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tipo_documento')
BEGIN
    CREATE TABLE tipo_documento (
        codigo NVARCHAR(10) PRIMARY KEY,
        nombre NVARCHAR(50) NOT NULL
    );
    INSERT INTO tipo_documento (codigo, nombre) VALUES
        ('CC', 'Cédula de ciudadanía'),
        ('CE', 'Cédula de extranjería'),
        ('TI', 'Tarjeta de identidad'),
        ('PA', 'Pasaporte'),
        ('RC', 'Registro civil');
    PRINT 'Tabla tipo_documento creada.';
END
GO

-- ========== CATÁLOGO: Sexo ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'sexo')
BEGIN
    CREATE TABLE sexo (
        codigo NVARCHAR(10) PRIMARY KEY,
        nombre NVARCHAR(30) NOT NULL
    );
    INSERT INTO sexo (codigo, nombre) VALUES
        ('M', 'Masculino'),
        ('F', 'Femenino'),
        ('I', 'Intersexual'),
        ('O', 'Otro');
    PRINT 'Tabla sexo creada.';
END
GO

-- ========== PERSONAS ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'personas')
BEGIN
    CREATE TABLE personas (
        id_persona INT IDENTITY(1,1) PRIMARY KEY,
        tipo_documento_codigo NVARCHAR(10) REFERENCES tipo_documento(codigo),
        numero_documento NVARCHAR(30),
        primer_nombre NVARCHAR(100) NOT NULL,
        segundo_nombre NVARCHAR(100),
        primer_apellido NVARCHAR(100) NOT NULL,
        segundo_apellido NVARCHAR(100),
        fecha_nacimiento DATE,
        sexo_codigo NVARCHAR(10) REFERENCES sexo(codigo),
        ubicaciones NVARCHAR(500),
        activo BIT DEFAULT 1,
        creado_en DATETIME2 DEFAULT GETDATE(),
        actualizado_en DATETIME2 DEFAULT GETDATE()
    );
    CREATE UNIQUE INDEX UX_personas_documento ON personas(tipo_documento_codigo, numero_documento) 
        WHERE tipo_documento_codigo IS NOT NULL AND numero_documento IS NOT NULL AND numero_documento <> '';
    PRINT 'Tabla personas creada.';
END
GO

-- ========== VINCULAR USUARIOS A PERSONAS ==========
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'persona_id')
BEGIN
    ALTER TABLE usuarios ADD persona_id INT NULL REFERENCES personas(id_persona) ON DELETE SET NULL;
    PRINT 'Columna persona_id agregada a usuarios.';
END
GO

-- ========== MIGRAR: crear persona por cada usuario y vincular ==========
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'nombre')
AND EXISTS (SELECT 1 FROM usuarios WHERE persona_id IS NULL)
BEGIN
    DECLARE @uid INT, @nom NVARCHAR(100), @ape NVARCHAR(100);
    DECLARE usuario_cursor CURSOR LOCAL FOR 
        SELECT id, ISNULL(nombre,''), ISNULL(apellido,'') FROM usuarios WHERE persona_id IS NULL;
    
    OPEN usuario_cursor;
    FETCH NEXT FROM usuario_cursor INTO @uid, @nom, @ape;
    
    WHILE @@FETCH_STATUS = 0
    BEGIN
        DECLARE @pid INT;
        INSERT INTO personas (tipo_documento_codigo, primer_nombre, primer_apellido, activo)
        VALUES ('CC', LTRIM(RTRIM(@nom)), LTRIM(RTRIM(@ape)), 1);
        SET @pid = SCOPE_IDENTITY();
        
        UPDATE usuarios SET persona_id = @pid WHERE id = @uid;
        
        FETCH NEXT FROM usuario_cursor INTO @uid, @nom, @ape;
    END
    
    CLOSE usuario_cursor;
    DEALLOCATE usuario_cursor;
    PRINT 'Migración de usuarios a personas completada.';
END
GO

-- ========== ELIMINAR CAMPOS REPETIDOS DE USUARIOS ==========
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'nombre')
BEGIN
    ALTER TABLE usuarios DROP COLUMN nombre;
    PRINT 'Columna nombre eliminada de usuarios.';
END
GO

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'apellido')
BEGIN
    ALTER TABLE usuarios DROP COLUMN apellido;
    PRINT 'Columna apellido eliminada de usuarios.';
END
GO

PRINT 'Migración 003 completada.';
