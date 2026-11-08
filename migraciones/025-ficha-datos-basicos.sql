-- ===========================================
-- MIGRACION 025: Ficha de datos basicos (SIVIGILA)
-- Una ficha por consulta (consulta_id UNIQUE), vinculada a persona,
-- medico (usuario que la llena) e IPS. Cada campo es una columna real.
-- Backfill desde consultas.datos_basicos (JSON) y eliminacion de esa columna.
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ficha_datos_basicos')
BEGIN
    CREATE TABLE ficha_datos_basicos (
        id INT IDENTITY(1,1) PRIMARY KEY,
        ips_id INT NOT NULL REFERENCES ips(id),
        persona_id INT NOT NULL REFERENCES personas(id_persona),
        usuario_id INT NOT NULL REFERENCES usuarios(id),          -- medico que llena la ficha
        consulta_id INT NOT NULL UNIQUE REFERENCES consultas(id) ON DELETE CASCADE,
        codigo_evento NVARCHAR(20) NULL,
        nombre_evento NVARCHAR(200) NULL,
        fecha_notificacion DATE NULL,
        razon_social_upgd NVARCHAR(200) NULL,
        tipo_documento NVARCHAR(50) NULL,
        numero_documento NVARCHAR(50) NULL,
        telefono NVARCHAR(60) NULL,
        fecha_nacimiento DATE NULL,
        edad INT NULL,
        unidad_medida_edad NVARCHAR(50) NULL,
        sexo NVARCHAR(50) NULL,
        nacionalidad NVARCHAR(100) NULL,
        procedencia_departamento NVARCHAR(50) NULL,
        procedencia_municipio NVARCHAR(50) NULL,
        area_procedencia NVARCHAR(50) NULL,
        fecha_inicio_sintomas DATE NULL,
        clasificacion_inicial NVARCHAR(50) NULL,
        fuente_notificacion NVARCHAR(50) NULL,
        condicion_final NVARCHAR(50) NULL,
        pertenencia_etnica NVARCHAR(50) NULL,
        identidad_genero NVARCHAR(50) NULL,
        orientacion_sexual NVARCHAR(50) NULL,
        grupos_poblacional NVARCHAR(50) NULL,
        regimen_salud NVARCHAR(50) NULL,
        residencia_departamento NVARCHAR(50) NULL,
        residencia_municipio NVARCHAR(50) NULL,
        direccion_residencia NVARCHAR(200) NULL,
        estado_notificacion NVARCHAR(20) NOT NULL DEFAULT 'borrador',
        creado_en DATETIME2 NOT NULL DEFAULT GETDATE(),
        actualizado_en DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX IX_ficha_datos_basicos_persona ON ficha_datos_basicos(persona_id);
    CREATE INDEX IX_ficha_datos_basicos_usuario ON ficha_datos_basicos(usuario_id);
    PRINT 'Tabla ficha_datos_basicos creada.';
END
ELSE
    PRINT 'Tabla ficha_datos_basicos ya existe, omitido.';
GO

-- ========== BACKFILL desde consultas.datos_basicos (JSON) ==========
-- Una ficha por consulta; se omite si la consulta ya tiene ficha.
INSERT INTO ficha_datos_basicos (
    ips_id, persona_id, usuario_id, consulta_id,
    codigo_evento, nombre_evento,
    fecha_notificacion, razon_social_upgd,
    tipo_documento, numero_documento, telefono,
    fecha_nacimiento, edad, unidad_medida_edad, sexo, nacionalidad,
    procedencia_departamento, procedencia_municipio, area_procedencia,
    fecha_inicio_sintomas, clasificacion_inicial, fuente_notificacion,
    regimen_salud, residencia_departamento, residencia_municipio, direccion_residencia,
    estado_notificacion
)
SELECT
    c.ips_id, c.paciente_persona_id, c.profesional_usuario_id, c.id,
    c.codigo_evento, c.nombre_evento,
    TRY_CONVERT(DATE, JSON_VALUE(c.datos_basicos, '$.fecha_notificacion')),
    JSON_VALUE(c.datos_basicos, '$.razon_social_upgd'),
    JSON_VALUE(c.datos_basicos, '$.tipo_documento'),
    JSON_VALUE(c.datos_basicos, '$.numero_documento'),
    JSON_VALUE(c.datos_basicos, '$.telefono'),
    TRY_CONVERT(DATE, JSON_VALUE(c.datos_basicos, '$.fecha_nacimiento')),
    TRY_CAST(JSON_VALUE(c.datos_basicos, '$.edad') AS INT),
    JSON_VALUE(c.datos_basicos, '$.unidad_medida_edad'),
    JSON_VALUE(c.datos_basicos, '$.sexo'),
    JSON_VALUE(c.datos_basicos, '$.nacionalidad'),
    JSON_VALUE(c.datos_basicos, '$.procedencia_departamento'),
    JSON_VALUE(c.datos_basicos, '$.procedencia_municipio'),
    JSON_VALUE(c.datos_basicos, '$.area_procedencia'),
    TRY_CONVERT(DATE, JSON_VALUE(c.datos_basicos, '$.fecha_inicio_sintomas')),
    JSON_VALUE(c.datos_basicos, '$.clasificacion_inicial'),
    JSON_VALUE(c.datos_basicos, '$.fuente'),
    JSON_VALUE(c.datos_basicos, '$.regimen_salud'),
    JSON_VALUE(c.datos_basicos, '$.residencia_departamento'),
    JSON_VALUE(c.datos_basicos, '$.residencia_municipio'),
    JSON_VALUE(c.datos_basicos, '$.direccion_residencia'),
    c.estado
FROM consultas c
WHERE c.datos_basicos IS NOT NULL
  AND ISJSON(c.datos_basicos) = 1
  AND NOT EXISTS (SELECT 1 FROM ficha_datos_basicos f WHERE f.consulta_id = c.id);
GO

-- ========== Quitar la columna JSON de consultas ==========
IF EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('consultas') AND name = 'datos_basicos'
)
BEGIN
    ALTER TABLE consultas DROP COLUMN datos_basicos;
    PRINT 'Columna consultas.datos_basicos eliminada (ahora en ficha_datos_basicos).';
END
GO

PRINT 'Migracion 025 completada.';
GO
