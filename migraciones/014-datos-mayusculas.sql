-- ===========================================
-- MIGRACIÓN 014: Convertir nombres y direcciones a mayúsculas
-- Actualiza datos existentes en personas y ubicaciones
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== PERSONAS: Nombres y apellidos a mayúsculas ==========
UPDATE personas SET
    primer_nombre = CASE WHEN primer_nombre IS NOT NULL THEN UPPER(LTRIM(RTRIM(primer_nombre))) ELSE NULL END,
    segundo_nombre = CASE WHEN segundo_nombre IS NOT NULL THEN UPPER(LTRIM(RTRIM(segundo_nombre))) ELSE NULL END,
    primer_apellido = CASE WHEN primer_apellido IS NOT NULL THEN UPPER(LTRIM(RTRIM(primer_apellido))) ELSE NULL END,
    segundo_apellido = CASE WHEN segundo_apellido IS NOT NULL THEN UPPER(LTRIM(RTRIM(segundo_apellido))) ELSE NULL END;
GO

PRINT 'Personas: nombres convertidos a mayúsculas.';
GO

-- ========== UBICACIONES: Dirección y campos de texto a mayúsculas ==========
UPDATE ubicaciones SET
    direccion = CASE WHEN direccion IS NOT NULL THEN UPPER(LTRIM(RTRIM(direccion))) ELSE NULL END,
    tipo_via = CASE WHEN tipo_via IS NOT NULL THEN UPPER(LTRIM(RTRIM(tipo_via))) ELSE NULL END,
    complemento_via = CASE WHEN complemento_via IS NOT NULL THEN UPPER(LTRIM(RTRIM(complemento_via))) ELSE NULL END,
    complemento_placa = CASE WHEN complemento_placa IS NOT NULL THEN UPPER(LTRIM(RTRIM(complemento_placa))) ELSE NULL END,
    orientacion = CASE WHEN orientacion IS NOT NULL THEN UPPER(LTRIM(RTRIM(orientacion))) ELSE NULL END,
    complemento_orientacion = CASE WHEN complemento_orientacion IS NOT NULL THEN UPPER(LTRIM(RTRIM(complemento_orientacion))) ELSE NULL END,
    descripcion_adicional = CASE WHEN descripcion_adicional IS NOT NULL THEN UPPER(LTRIM(RTRIM(descripcion_adicional))) ELSE NULL END;
GO

PRINT 'Ubicaciones: direcciones y campos de texto convertidos a mayúsculas.';
GO

PRINT 'Migración 014 completada.';
