-- ===========================================
-- MIGRACIÓN 040: Preguntas de la ficha FIEBRE AMARILLA
-- (evento 310, FOR-R02.4030-019? V:00 2026-08-06) en el formulario dinámico.
--
-- Fuente: dumps/vision/310_f_amarilla_2026_vision.txt (p2 = formulario) +
-- criterios del catálogo (extracto, p6).
--
-- Decisiones:
--   - OBLIG solo 7.2 y 7.3 (criterio literal del catálogo: "marque la casilla
--     únicamente si la respuesta es SÍ..."). Resto NO oblig.
--   - 7.1: opciones reales SEGÚN el instructivo p6 (Selvático / Urbano) + la
--     p2 imprime "3. Desconocido"; se cataloga con las 3 opciones (asunción
--     documentada en el volcado de visión).
--   - 7.1.1: el instructivo NO define condición para mostrarla -> show_if NULL
--     (siempre visible), decisión cerrada.
--   - 7.3.1 condicional solo si 7.3 = 1; 5.3 condicional solo si 5.2 = 1.
--   - Sección 8 (laboratorio) fuera del catálogo: se ingresa por módulo de
--     laboratorios de SIVIGILA, no se cataloga.
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== OPCIONES (listas) para el evento 310 ==========
DECLARE @slugs TABLE (slug NVARCHAR(60), val NVARCHAR(50), label NVARCHAR(150), ord INT);

INSERT INTO @slugs (slug, val, label, ord) VALUES
 ('si_no','1',N'Sí',1), ('si_no','2',N'No',2),
 ('tipo_caso_fa','1',N'Selvático',1), ('tipo_caso_fa','2',N'Urbano',2), ('tipo_caso_fa','3',N'Desconocido',3),
 ('hallazgos','1',N'Fiebre',1), ('hallazgos','2',N'Mialgias',2), ('hallazgos','3',N'Artralgias',3),
 ('hallazgos','4',N'Cefalea',4), ('hallazgos','5',N'Vómito',5), ('hallazgos','6',N'Ictericia',6),
 ('hallazgos','7',N'S Faget',7), ('hallazgos','8',N'Oliguria',8), ('hallazgos','9',N'Choque por Shock',9),
 ('hallazgos','10',N'Bradicardia',10), ('hallazgos','11',N'Falla renal',11), ('hallazgos','12',N'Falla hepática',12),
 ('hallazgos','13',N'Hepatomegalia',13), ('hallazgos','14',N'Hemoptisis',14), ('hallazgos','15',N'Hiperemia conjuntival',15),
 ('hallazgos','16',N'Hematemesis',16), ('hallazgos','17',N'Petequias',17), ('hallazgos','18',N'Metrorragia',18),
 ('hallazgos','19',N'Melenas',19), ('hallazgos','20',N'Equimosis',20), ('hallazgos','21',N'Epistaxis',21),
 ('hallazgos','22',N'Hematuria',22), ('hallazgos','23',N'Dolor abdominal',23), ('hallazgos','24',N'Diarrea',24),
 ('hallazgos','25',N'Nauseas',25);

DELETE FROM listas WHERE formulario = 'evento_310';
INSERT INTO listas (label, value, ref, formulario, campo, indice)
SELECT s.label, s.val, '310_' + s.slug, 'evento_310', s.slug, s.ord
FROM @slugs s;
PRINT 'Listas evento_310 sembradas.';

-- ========== DEFINICIONES DE PREGUNTAS (evento 310) ==========
DECLARE @defs TABLE (
    numero NVARCHAR(10), slug NVARCHAR(60), lista_slug NVARCHAR(60), tipo NVARCHAR(20),
    obligatorio BIT, show_if NVARCHAR(50), padre_slug NVARCHAR(60), label NVARCHAR(200),
    seccion NVARCHAR(15), seccion_label NVARCHAR(120), indice INT
);

INSERT INTO @defs (numero, slug, lista_slug, tipo, obligatorio, show_if, padre_slug, label, seccion, seccion_label, indice) VALUES
 -- 5. ANTECEDENTES VACUNALES
 ('5.1','carne','si_no','select',0,NULL,NULL,N'¿Tiene carné de vacunación?','5','5. ANTECEDENTES VACUNALES',1),
 ('5.2','vacuna_fa','si_no','select',0,NULL,NULL,N'Vacuna fiebre amarilla','5','5. ANTECEDENTES VACUNALES',2),
 ('5.3','fecha_aplicacion',NULL,'date',0,'1','vacuna_fa',N'Fecha de aplicación (solo si 5.2 = Sí)','5','5. ANTECEDENTES VACUNALES',3),

 -- 6. DATOS CLÍNICOS
 ('6.1','hallazgos','hallazgos','multiselect',0,NULL,NULL,N'Hallazgos semiológicos (marque con X; grupos: signos hemorrágicos 14-22, otros 23-25)','6','6. DATOS CLÍNICOS',4),

 -- 7. DATOS ESPECÍFICOS
 ('7.1','tipo_caso_fa','tipo_caso_fa','select',0,NULL,NULL,N'Caso fiebre amarilla (1 Selvático / 2 Urbano / 3 Desconocido)','7','7. DATOS ESPECÍFICOS',5),
 ('7.1.1','sitio_probable',NULL,'text',0,NULL,NULL,N'Sitio probable de infección (País/Departamento/Municipio)','7','7. DATOS ESPECÍFICOS',6),
 ('7.2','familiar_sintomas','si_no','select',1,NULL,NULL,N'Familiar o conviviente con sintomatología similar en los últimos 15 días (OBLIG: marque solo si SÍ)','7','7. DATOS ESPECÍFICOS',7),
 ('7.3','desplazamiento','si_no','select',1,NULL,NULL,N'Desplazamiento en los últimos 15 días (OBLIG: marque solo si SÍ)','7','7. DATOS ESPECÍFICOS',8),
 ('7.3.1','sitio_desplazamiento',NULL,'text',0,'1','desplazamiento',N'Sitio desplazamiento los últimos 15 días (país/depto/municipio/vereda, solo si 7.3 = Sí)','7','7. DATOS ESPECÍFICOS',9);

-- Re-sembrado idempotente
DELETE FROM detalle_eventos WHERE evento_codigo = '310';
DELETE FROM detalle_eventos_respuestas WHERE ref LIKE '310[_]%';

INSERT INTO detalle_eventos (evento_codigo, seccion, subs, numero, ref, tipo, lista_ref, obligatorio, show_if, padre_ref, seccion_label, label, indice)
SELECT '310', d.seccion, NULL, d.numero,
       '310_' + d.slug, d.tipo,
       CASE WHEN d.lista_slug IS NULL THEN NULL ELSE '310_' + d.lista_slug END,
       d.obligatorio, d.show_if,
       CASE WHEN d.padre_slug IS NULL THEN NULL ELSE '310_' + d.padre_slug END,
       d.seccion_label, d.label, d.indice
FROM @defs d;
PRINT 'Preguntas evento 310 (fiebre amarilla) sembradas.';
