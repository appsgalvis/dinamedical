-- ===========================================
-- MIGRACIÓN 013: Vista v_personas con tipo_persona calculado
-- tipo_persona = 'funcionario' si tiene usuario vinculado, sino 'paciente'
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
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
    p.ips_id,
    p.activo,
    i.nombre AS ips_nombre,
    (SELECT TOP 1 u.id FROM usuarios u WHERE u.persona_id = p.id_persona) AS usuario_id,
    (SELECT COUNT(*) FROM ubicaciones ub WHERE ub.persona_id = p.id_persona) AS cantidad_ubicaciones,
    CASE WHEN EXISTS (SELECT 1 FROM usuarios u WHERE u.persona_id = p.id_persona) THEN 'funcionario' ELSE 'paciente' END AS tipo_persona
FROM personas p
LEFT JOIN ips i ON i.id = p.ips_id;
GO

PRINT 'Vista v_personas creada.';
