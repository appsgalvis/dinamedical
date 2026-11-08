-- ===========================================
-- MIGRACIÓN 039: Preguntas de la ficha CEGUERA POR TRACOMA
-- (evento 305, FOR-R02.4030-018 V:00 2026-08-06) en el formulario dinámico.
--
-- Fuente: dumps/vision/305_tracoma_2026_vision.txt (p2 = formulario) +
-- extracto (instructivo). Mapeo OBLIG confirmado con recheck visual p6.
--
-- Decisiones:
--   - OBLIG: 5.1 SI, 5.2 SI, 5.3 NO, 5.4 NO, 5.5 NO; 6.1 SI, 6.1.1 NO,
--     6.2 SI, 6.3-6.9 SI.
--   - 6.2 es una tabla signos × ojo (derecho/izquierdo) con escala 0-4. Se
--     descompone en 10 selects (5 signos por ojo), números 6.2.1-6.2.10,
--     todos obligatorios (block OBLIG de 6.2 = SI).
--   - Condicionales codificables: 5.3/5.4/5.5 (padre 5.2='1'),
--     6.1.1 (padre 6.1='1').
--   - 6.8/6.9 agudeza visual: number (formato "20/__", permitido 20-200),
--     unit en el label.
--   - Errata verbatim: la ficha imprime "Historia de cirugía de triquiasis"
--     (el instructivo dice "Historia previa de triquiasis"); se mantiene verbatim.
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== OPCIONES (listas) para el evento 305 ==========
DECLARE @slugs TABLE (slug NVARCHAR(60), val NVARCHAR(50), label NVARCHAR(150), ord INT);

INSERT INTO @slugs (slug, val, label, ord) VALUES
 ('si_no','1',N'Sí',1), ('si_no','2',N'No',2),
 ('tiempo_residencia','1',N'Menor de 5 años',1), ('tiempo_residencia','2',N'Entre 5 y 15 años',2), ('tiempo_residencia','3',N'15 y más',3),
 ('ojo3','1',N'Derecho',1), ('ojo3','2',N'Izquierdo',2), ('ojo3','3',N'Ambos',3),
 ('parpado3','1',N'Párpado superior',1), ('parpado3','2',N'Párpado inferior',2), ('parpado3','3',N'Ambos',3),
 ('ojo4_np','1',N'Derecho',1), ('ojo4_np','2',N'Izquierdo',2), ('ojo4_np','3',N'Ambos',3), ('ojo4_np','4',N'No presenta',4),
 ('evidencia','0',N'No hay evidencia',1), ('evidencia','1',N'De 1 a 5 pestañas',2), ('evidencia','2',N'De 6 a 10 pestañas',3),
 ('evidencia','3',N'De 11 a 20 pestañas',4), ('evidencia','4',N'Más de 20 pestañas',5);

DELETE FROM listas WHERE formulario = 'evento_305';
INSERT INTO listas (label, value, ref, formulario, campo, indice)
SELECT s.label, s.val, '305_' + s.slug, 'evento_305', s.slug, s.ord
FROM @slugs s;
PRINT 'Listas evento_305 sembradas.';

-- ========== DEFINICIONES DE PREGUNTAS (evento 305) ==========
DECLARE @defs TABLE (
    numero NVARCHAR(10), slug NVARCHAR(60), lista_slug NVARCHAR(60), tipo NVARCHAR(20),
    obligatorio BIT, show_if NVARCHAR(50), padre_slug NVARCHAR(60), label NVARCHAR(200),
    seccion NVARCHAR(15), seccion_label NVARCHAR(120), indice INT
);

INSERT INTO @defs (numero, slug, lista_slug, tipo, obligatorio, show_if, padre_slug, label, seccion, seccion_label, indice) VALUES
 -- 5. DATOS ESPECÍFICOS
 ('5.1','tiempo_residencia','tiempo_residencia','select',1,NULL,NULL,N'Tiempo en la residencia actual','5','5. DATOS ESPECÍFICOS',1),
 ('5.2','cirugia_triquiasis','si_no','select',1,NULL,NULL,N'Historia de cirugía de triquiasis','5','5. DATOS ESPECÍFICOS',2),
 ('5.3','ojo_cirugia','ojo3','select',0,'1','cirugia_triquiasis',N'¿En cuál ojo? (solo si 5.2 = Sí)','5','5. DATOS ESPECÍFICOS',3),
 ('5.4','parpado_ojo_derecho','parpado3','select',0,'1','cirugia_triquiasis',N'Párpado ojo derecho (solo si 5.2 = Sí)','5','5. DATOS ESPECÍFICOS',4),
 ('5.5','parpado_ojo_izquierdo','parpado3','select',0,'1','cirugia_triquiasis',N'Párpado ojo izquierdo (solo si 5.2 = Sí)','5','5. DATOS ESPECÍFICOS',5),

 -- 6. CUADRO CLÍNICO, EXAMEN OCULAR EXTERNO
 ('6.1','cicatrices_tarsal','si_no','select',1,NULL,NULL,N'¿Cicatrices en mucosa tarsal?','6','6. CUADRO CLÍNICO, EXAMEN OCULAR EXTERNO',6),
 ('6.1.1','ojo_cicatrices','ojo3','select',0,'1','cicatrices_tarsal',N'¿En cuál ojo? (solo si 6.1 = Sí)','6','6. CUADRO CLÍNICO, EXAMEN OCULAR EXTERNO',7),
 -- 6.2 tabla signos/síntomas por ojo (marque X): descompuesta en select por signo y ojo, escala 0-4
 ('6.2.1','depilacion_sup_dcho','evidencia','select',1,NULL,NULL,N'6.2 Tabla - Depilación párpado superior (ojo derecho)','6','6. CUADRO CLÍNICO, EXAMEN OCULAR EXTERNO',8),
 ('6.2.2','depilacion_sup_izq','evidencia','select',1,NULL,NULL,N'6.2 Tabla - Depilación párpado superior (ojo izquierdo)','6','6. CUADRO CLÍNICO, EXAMEN OCULAR EXTERNO',9),
 ('6.2.3','depilacion_inf_dcho','evidencia','select',1,NULL,NULL,N'6.2 Tabla - Depilación párpado inferior (ojo derecho)','6','6. CUADRO CLÍNICO, EXAMEN OCULAR EXTERNO',10),
 ('6.2.4','depilacion_inf_izq','evidencia','select',1,NULL,NULL,N'6.2 Tabla - Depilación párpado inferior (ojo izquierdo)','6','6. CUADRO CLÍNICO, EXAMEN OCULAR EXTERNO',11),
 ('6.2.5','contacto_globo_sup_dcho','evidencia','select',1,NULL,NULL,N'6.2 Tabla - ¿Pestañas en contacto con el globo ocular en párpado superior? (ojo derecho)','6','6. CUADRO CLÍNICO, EXAMEN OCULAR EXTERNO',12),
 ('6.2.6','contacto_globo_sup_izq','evidencia','select',1,NULL,NULL,N'6.2 Tabla - ¿Pestañas en contacto con el globo ocular en párpado superior? (ojo izquierdo)','6','6. CUADRO CLÍNICO, EXAMEN OCULAR EXTERNO',13),
 ('6.2.7','contacto_globo_inf_dcho','evidencia','select',1,NULL,NULL,N'6.2 Tabla - ¿Pestañas en contacto con el globo ocular en párpado inferior? (ojo derecho)','6','6. CUADRO CLÍNICO, EXAMEN OCULAR EXTERNO',14),
 ('6.2.8','contacto_globo_inf_izq','evidencia','select',1,NULL,NULL,N'6.2 Tabla - ¿Pestañas en contacto con el globo ocular en párpado inferior? (ojo izquierdo)','6','6. CUADRO CLÍNICO, EXAMEN OCULAR EXTERNO',15),
 ('6.2.9','pestanas_tocando_cornea_dcho','evidencia','select',1,NULL,NULL,N'6.2 Tabla - ¿Hay pestaña tocando la córnea? (ojo derecho)','6','6. CUADRO CLÍNICO, EXAMEN OCULAR EXTERNO',16),
 ('6.2.10','pestanas_tocando_cornea_izq','evidencia','select',1,NULL,NULL,N'6.2 Tabla - ¿Hay pestaña tocando la córnea? (ojo izquierdo)','6','6. CUADRO CLÍNICO, EXAMEN OCULAR EXTERNO',17),
 ('6.3','opacidad_corneal','ojo4_np','select',1,NULL,NULL,N'¿Hay opacidad corneal?','6','6. CUADRO CLÍNICO, EXAMEN OCULAR EXTERNO',18),
 ('6.4','engrosamiento_parpado','ojo4_np','select',1,NULL,NULL,N'¿Engrosamiento del párpado?','6','6. CUADRO CLÍNICO, EXAMEN OCULAR EXTERNO',19),
 ('6.5','pestanas_mal_posicionadas','ojo4_np','select',1,NULL,NULL,N'¿Pestañas mal posicionadas?','6','6. CUADRO CLÍNICO, EXAMEN OCULAR EXTERNO',20),
 ('6.6','sensacion_cuerpo_extrano','ojo4_np','select',1,NULL,NULL,N'¿Sensación de cuerpo extraño?','6','6. CUADRO CLÍNICO, EXAMEN OCULAR EXTERNO',21),
 ('6.7','fotofobia','ojo4_np','select',1,NULL,NULL,N'¿Fotofobia?','6','6. CUADRO CLÍNICO, EXAMEN OCULAR EXTERNO',22),
 ('6.8','agudeza_visual_dcho',NULL,'number',1,NULL,NULL,N'Medida agudeza visual ojo derecho (20/ __, permitido 20-200)','6','6. CUADRO CLÍNICO, EXAMEN OCULAR EXTERNO',23),
 ('6.9','agudeza_visual_izq',NULL,'number',1,NULL,NULL,N'Medida agudeza visual ojo izquierdo (20/ __, permitido 20-200)','6','6. CUADRO CLÍNICO, EXAMEN OCULAR EXTERNO',24);

-- Re-sembrado idempotente
DELETE FROM detalle_eventos WHERE evento_codigo = '305';
DELETE FROM detalle_eventos_respuestas WHERE ref LIKE '305[_]%';

INSERT INTO detalle_eventos (evento_codigo, seccion, subs, numero, ref, tipo, lista_ref, obligatorio, show_if, padre_ref, seccion_label, label, indice)
SELECT '305', d.seccion, NULL, d.numero,
       '305_' + d.slug, d.tipo,
       CASE WHEN d.lista_slug IS NULL THEN NULL ELSE '305_' + d.lista_slug END,
       d.obligatorio, d.show_if,
       CASE WHEN d.padre_slug IS NULL THEN NULL ELSE '305_' + d.padre_slug END,
       d.seccion_label, d.label, d.indice
FROM @defs d;
PRINT 'Preguntas evento 305 (ceguera por tracoma) sembradas.';
