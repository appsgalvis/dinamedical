-- ===========================================
-- MIGRACIÓN 019: Residencia DANE en personas
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('personas') AND name = 'residencia_departamento')
BEGIN
    ALTER TABLE personas ADD residencia_departamento NVARCHAR(5) NULL;
    PRINT 'Columna residencia_departamento agregada a personas.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('personas') AND name = 'residencia_municipio')
BEGIN
    ALTER TABLE personas ADD residencia_municipio NVARCHAR(10) NULL;
    PRINT 'Columna residencia_municipio agregada a personas.';
END
GO

IF OBJECT_ID('dbo.v_personas', 'V') IS NOT NULL
    DROP VIEW dbo.v_personas;
GO

CREATE VIEW dbo.v_personas AS
SELECT
    p.id_persona,
    p.tipo_documento_codigo,
    p.numero_documento,
    p.primer_nombre,
    p.segundo_nombre,
    p.primer_apellido,
    p.segundo_apellido,
    p.fecha_nacimiento,
    p.sexo_codigo,
    p.residencia_departamento,
    p.residencia_municipio,
    p.ips_id,
    p.activo,
    i.nombre AS ips_nombre,
    (SELECT TOP 1 u.id FROM usuarios u WHERE u.persona_id = p.id_persona) AS usuario_id,
    (SELECT COUNT(*) FROM ubicaciones ub WHERE ub.persona_id = p.id_persona) AS cantidad_ubicaciones,
    CASE WHEN EXISTS (SELECT 1 FROM usuarios u WHERE u.persona_id = p.id_persona) THEN 'funcionario' ELSE 'paciente' END AS tipo_persona
FROM personas p
LEFT JOIN ips i ON i.id = p.ips_id;
GO

PRINT 'Migración 019 completada.';
