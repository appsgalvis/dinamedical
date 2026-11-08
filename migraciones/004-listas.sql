-- ===========================================
-- MIGRACIÓN 004: Listas (opciones de formularios)
-- Tabla unificada para almacenar listas desplegables:
-- tipos de documento, sexo, y todas las listas de formularios
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== TABLA LISTAS ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'listas')
BEGIN
    CREATE TABLE listas (
        id INT IDENTITY(1,1) PRIMARY KEY,
        label NVARCHAR(150) NOT NULL,
        value NVARCHAR(50) NOT NULL,
        ref NVARCHAR(50) NOT NULL,
        formulario NVARCHAR(50) NOT NULL,
        campo NVARCHAR(50) NOT NULL,
        indice INT DEFAULT 0,
        activo BIT DEFAULT 1,
        creado_en DATETIME2 DEFAULT GETDATE()
    );
    CREATE INDEX IX_listas_ref ON listas(ref);
    CREATE INDEX IX_listas_formulario_campo ON listas(formulario, campo);
    PRINT 'Tabla listas creada.';
END
GO

-- ========== DATOS INICIALES: Tipos de documento ==========
IF NOT EXISTS (SELECT 1 FROM listas WHERE ref = 'tipo_documento')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice) VALUES
        ('Cédula de ciudadanía', 'CC', 'tipo_documento', 'persona', 'tipo_documento', 1),
        ('Cédula de extranjería', 'CE', 'tipo_documento', 'persona', 'tipo_documento', 2),
        ('Tarjeta de identidad', 'TI', 'tipo_documento', 'persona', 'tipo_documento', 3),
        ('Pasaporte', 'PA', 'tipo_documento', 'persona', 'tipo_documento', 4),
        ('Registro civil', 'RC', 'tipo_documento', 'persona', 'tipo_documento', 5);
    PRINT 'Lista tipo_documento insertada.';
END
GO

-- ========== DATOS INICIALES: Sexo ==========
IF NOT EXISTS (SELECT 1 FROM listas WHERE ref = 'sexo')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice) VALUES
        ('Masculino', 'M', 'sexo', 'persona', 'sexo', 1),
        ('Femenino', 'F', 'sexo', 'persona', 'sexo', 2),
        ('Intersexual', 'I', 'sexo', 'persona', 'sexo', 3),
        ('Otro', 'O', 'sexo', 'persona', 'sexo', 4);
    PRINT 'Lista sexo insertada.';
END
GO

-- ========== DATOS INICIALES: Otras listas comunes para formularios ==========
IF NOT EXISTS (SELECT 1 FROM listas WHERE ref = 'estado_civil')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice) VALUES
        ('Soltero(a)', 'S', 'estado_civil', 'persona', 'estado_civil', 1),
        ('Casado(a)', 'C', 'estado_civil', 'persona', 'estado_civil', 2),
        ('Unión libre', 'U', 'estado_civil', 'persona', 'estado_civil', 3),
        ('Divorciado(a)', 'D', 'estado_civil', 'persona', 'estado_civil', 4),
        ('Viudo(a)', 'V', 'estado_civil', 'persona', 'estado_civil', 5);
    PRINT 'Lista estado_civil insertada.';
END
GO

IF NOT EXISTS (SELECT 1 FROM listas WHERE ref = 'tipo_sangre')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice) VALUES
        ('O+', 'O+', 'tipo_sangre', 'persona', 'tipo_sangre', 1),
        ('O-', 'O-', 'tipo_sangre', 'persona', 'tipo_sangre', 2),
        ('A+', 'A+', 'tipo_sangre', 'persona', 'tipo_sangre', 3),
        ('A-', 'A-', 'tipo_sangre', 'persona', 'tipo_sangre', 4),
        ('B+', 'B+', 'tipo_sangre', 'persona', 'tipo_sangre', 5),
        ('B-', 'B-', 'tipo_sangre', 'persona', 'tipo_sangre', 6),
        ('AB+', 'AB+', 'tipo_sangre', 'persona', 'tipo_sangre', 7),
        ('AB-', 'AB-', 'tipo_sangre', 'persona', 'tipo_sangre', 8);
    PRINT 'Lista tipo_sangre insertada.';
END
GO

IF NOT EXISTS (SELECT 1 FROM listas WHERE ref = 'nivel_escolaridad')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice) VALUES
        ('Ninguno', 'NINGUNO', 'nivel_escolaridad', 'persona', 'escolaridad', 1),
        ('Primaria', 'PRIMARIA', 'nivel_escolaridad', 'persona', 'escolaridad', 2),
        ('Secundaria', 'SECUNDARIA', 'nivel_escolaridad', 'persona', 'escolaridad', 3),
        ('Técnico', 'TECNICO', 'nivel_escolaridad', 'persona', 'escolaridad', 4),
        ('Tecnólogo', 'TECNOLOGO', 'nivel_escolaridad', 'persona', 'escolaridad', 5),
        ('Universitario', 'UNIVERSITARIO', 'nivel_escolaridad', 'persona', 'escolaridad', 6),
        ('Posgrado', 'POSGRADO', 'nivel_escolaridad', 'persona', 'escolaridad', 7);
    PRINT 'Lista nivel_escolaridad insertada.';
END
GO

-- ========== Migrar datos existentes de tipo_documento y sexo si existen ==========
-- (Solo si no se insertaron ya por ref)
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'tipo_documento')
AND NOT EXISTS (SELECT 1 FROM listas WHERE ref = 'tipo_documento')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice)
    SELECT nombre, codigo, 'tipo_documento', 'persona', 'tipo_documento', ROW_NUMBER() OVER (ORDER BY nombre)
    FROM tipo_documento;
    PRINT 'Datos migrados de tipo_documento a listas.';
END
GO

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'sexo')
AND NOT EXISTS (SELECT 1 FROM listas WHERE ref = 'sexo')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice)
    SELECT nombre, codigo, 'sexo', 'persona', 'sexo', ROW_NUMBER() OVER (ORDER BY nombre)
    FROM sexo;
    PRINT 'Datos migrados de sexo a listas.';
END
GO

PRINT 'Migración 004 completada.';
