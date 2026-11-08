-- ===========================================
-- MIGRACIÓN 032: Preguntas de la ficha CÁNCER DE MAMA Y CUELLO UTERINO
-- (evento 155, FOR-R02.4030-010 V:00 2026-08-06) en el formulario dinámico.
--
-- Fuente: dumps/vision/155_ca_mama_y_cuello_ut_2026_vision.txt
-- (página 2 = formulario, verificada con visión; OBLIG confirmado visualmente
--  en la tabla de instructivo p6 por error de orden del extracto).
--
-- Secciones sembradas: solo DATOS ESPECÍFICOS (5). Las secciones 1-4
-- (datos básicos) ya viven en ficha_datos_basicos.
--
-- Decisiones:
--   - La forma impresa (p2) es la base del catálogo. El instructivo (p6) describe
--     masters Sí/No (5.3.3 exocervix, 5.3.4 endocervix, 5.3.4.1 resultado,
--     5.3.4.2 adenocarcinoma, 5.4.1 tipo de tratamiento) que la forma impresa NO
--     muestra como pregunta maestra; esas reglas de desactivación NO son
--     codificables como show_if (faltaría la pregunta padre). Se cataloga p2.
--   - 5.2.x aplica solo si 5.1 = 1 (CA Mama) o 3 (Ambos); 5.3.x solo si 5.1 = 2
--     o 3. show_if admite un solo valor concreto -> no codificable; preguntas
--     siempre visibles.
--   - Única regla codificable: 5.4.1 fecha de inicio de tratamiento ->
--     show_if='1', padre_ref='155_tratamiento' (si 5.4 = No, no se diligencia).
--   - OBLIG confirmado con visión p6: 5.1 SI, 5.4 SI; todo lo demás NO.
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== OPCIONES (listas) para el evento 155 ==========
DECLARE @slugs TABLE (slug NVARCHAR(60), val NVARCHAR(50), label NVARCHAR(150), ord INT);

INSERT INTO @slugs (slug, val, label, ord) VALUES
 -- Sí / No (5.4)
 ('si_no','1',N'Sí',1), ('si_no','2',N'No',2),
 -- 5.1 Tipo de cáncer
 ('tipo_cancer','1',N'CA Mama',1),
 ('tipo_cancer','2',N'CA Cuello uterino',2),
 ('tipo_cancer','3',N'Ambos',3),
 -- 5.2.3 Resultado biopsia mama
 ('mama_resultado_biopsia','1',N'Carcinoma ductal',1),
 ('mama_resultado_biopsia','2',N'Carcinoma lobulillar',2),
 -- 5.2.3.1 Grado histopatológico mama
 ('mama_grado_histopatologico','1',N'In-situ',1),
 ('mama_grado_histopatologico','2',N'Infiltrante',2),
 -- 5.3.3 Resultado biopsia cuello uterino
 ('cuello_resultado_biopsia','1',N'LEI AG NCIII / In situ',1),
 ('cuello_resultado_biopsia','2',N'Carcinoma escamocelular',2),
 ('cuello_resultado_biopsia','3',N'Adenocarcinoma o mixtos',3),
 -- 5.3.4 Grado histopatológico cuello uterino (impreso p2)
 ('cuello_grado_histopatologico','1',N'Invasor',1),
 ('cuello_grado_histopatologico','2',N'Invasante',2),
 ('cuello_grado_histopatologico','3',N'Infiltrante',3),
 ('cuello_grado_histopatologico','4',N'No indicado',4);

DELETE FROM listas WHERE formulario = 'evento_155';
INSERT INTO listas (label, value, ref, formulario, campo, indice)
SELECT s.label, s.val, '155_' + s.slug, 'evento_155', s.slug, s.ord
FROM @slugs s;
PRINT 'Listas evento_155 sembradas.';

-- ========== DEFINICIONES DE PREGUNTAS (evento 155) ==========
DECLARE @defs TABLE (
    numero NVARCHAR(10), slug NVARCHAR(60), lista_slug NVARCHAR(60), tipo NVARCHAR(20),
    obligatorio BIT, show_if NVARCHAR(50), padre_slug NVARCHAR(60), label NVARCHAR(200),
    seccion NVARCHAR(15), seccion_label NVARCHAR(120), indice INT
);

INSERT INTO @defs (numero, slug, lista_slug, tipo, obligatorio, show_if, padre_slug, label, seccion, seccion_label, indice) VALUES
 ('5.1','tipo_cancer','tipo_cancer','select',1,NULL,NULL,N'Tipo de cáncer','5','5. DATOS ESPECÍFICOS',1),
 ('5.2.1','mama_fecha_procedimiento',NULL,'date',0,NULL,NULL,N'5.2.1 Fecha de procedimiento (examen de confirmación diagnóstica de cáncer de mama; aplica si 5.1 = CA Mama o Ambos)','5','5. DATOS ESPECÍFICOS',2),
 ('5.2.2','mama_fecha_resultado',NULL,'date',0,NULL,NULL,N'5.2.2 Fecha de resultado (cáncer de mama)','5','5. DATOS ESPECÍFICOS',3),
 ('5.2.3','mama_resultado_biopsia','mama_resultado_biopsia','select',0,NULL,NULL,N'5.2.3 Resultado de la biopsia (cáncer de mama)','5','5. DATOS ESPECÍFICOS',4),
 ('5.2.3.1','mama_grado_histopatologico','mama_grado_histopatologico','select',0,NULL,NULL,N'5.2.3.1 Grado histopatológico (cáncer de mama)','5','5. DATOS ESPECÍFICOS',5),
 ('5.3.1','cuello_fecha_toma',NULL,'date',0,NULL,NULL,N'5.3.1 Fecha de toma de muestra (examen de confirmación diagnóstica de cáncer de cuello uterino; aplica si 5.1 = CA Cuello uterino o Ambos)','5','5. DATOS ESPECÍFICOS',6),
 ('5.3.2','cuello_fecha_resultado',NULL,'date',0,NULL,NULL,N'5.3.2 Fecha de resultado (cáncer de cuello uterino)','5','5. DATOS ESPECÍFICOS',7),
 ('5.3.3','cuello_resultado_biopsia','cuello_resultado_biopsia','select',0,NULL,NULL,N'5.3.3 Resultado de la biopsia (cáncer de cuello uterino)','5','5. DATOS ESPECÍFICOS',8),
 ('5.3.4','cuello_grado_histopatologico','cuello_grado_histopatologico','select',0,NULL,NULL,N'5.3.4 Grado histopatológico (cáncer de cuello uterino)','5','5. DATOS ESPECÍFICOS',9),
 ('5.4','tratamiento','si_no','select',1,NULL,NULL,N'Tratamiento','5','5. DATOS ESPECÍFICOS',10),
 ('5.4.1','fecha_inicio_tratamiento',NULL,'date',0,'1','tratamiento',N'5.4.1 Fecha de inicio del tratamiento (solo si 5.4 = Sí)','5','5. DATOS ESPECÍFICOS',11);

-- Re-sembrado idempotente (evita choque con UX_detalles_ref al re-ejecutar)
DELETE FROM detalle_eventos WHERE evento_codigo = '155';
DELETE FROM detalle_eventos_respuestas WHERE ref LIKE '155[_]%';

INSERT INTO detalle_eventos (evento_codigo, seccion, subs, numero, ref, tipo, lista_ref, obligatorio, show_if, padre_ref, seccion_label, label, indice)
SELECT '155', d.seccion, NULL, d.numero,
       '155_' + d.slug, d.tipo,
       CASE WHEN d.lista_slug IS NULL THEN NULL ELSE '155_' + d.lista_slug END,
       d.obligatorio, d.show_if,
       CASE WHEN d.padre_slug IS NULL THEN NULL ELSE '155_' + d.padre_slug END,
       d.seccion_label, d.label, d.indice
FROM @defs d;
PRINT 'Preguntas evento 155 (cáncer de mama y cuello uterino) sembradas.';
