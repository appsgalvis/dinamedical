-- ===========================================
-- MIGRACIÓN 037: Preguntas de la ficha DIFTERIA
-- (evento 230, FOR-R02.4030-016 V:00 2026-08-06) en el formulario dinámico.
--
-- Fuente: dumps/vision/230_difteria_2026_vision.txt (p2 = formulario) +
-- criterios textuales del instructivo (extracto).
--
-- Decisiones:
--   - OBLIG: 5.1-5.4 SI, 5.4.1 NO, 5.5 NO; 6.1-6.7 SI (criterio grupal de la
--     página de preguntas); 7.1-7.7 SI, 7.8 NO.
--   - "3. Desconocido" pertenece solo a 5.1 y 6.1-6.6 (confirmado con visión
--     p02); 5.3 (0-5) y 5.4 (1-4) no lo incluyen.
--   - show_if codificable: 6.7 (padre 6.6='1') y 5.4.1 (padre 5.4='3', Otra).
--   - 7.x laboratorio se cataloga tal como lo muestra la ficha (el módulo de
--     laboratorios de SIVIGILA alimenta el mismo formulario dinámico).
--   - Erratas verbatim: "Traquetomía" (6.7) se mantiene tal como imprime.
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== OPCIONES (listas) para el evento 230 ==========
DECLARE @slugs TABLE (slug NVARCHAR(60), val NVARCHAR(50), label NVARCHAR(150), ord INT);

INSERT INTO @slugs (slug, val, label, ord) VALUES
 ('si_no','1',N'Sí',1), ('si_no','2',N'No',2),
 ('si_no_desconocido','1',N'Sí',1), ('si_no_desconocido','2',N'No',2), ('si_no_desconocido','3',N'Desconocido',3),
 ('dosis','0',N'Ninguna',1), ('dosis','1',N'Una',2), ('dosis','2',N'Dos',3),
 ('dosis','3',N'Tres o más',4), ('dosis','4',N'Primer Refuerzo',5), ('dosis','5',N'Segundo Refuerzo',6),
 ('tipo_vacuna','1',N'DPT',1), ('tipo_vacuna','2',N'Pentavalente',2), ('tipo_vacuna','3',N'Otra',3), ('tipo_vacuna','4',N'TD',4),
 ('tipo_complicacion','1',N'Neurológica',1), ('tipo_complicacion','2',N'Renal',2), ('tipo_complicacion','3',N'Cardíaca',3),
 ('tipo_complicacion','4',N'Traquetomía',4), ('tipo_complicacion','5',N'Otro',5);

DELETE FROM listas WHERE formulario = 'evento_230';
INSERT INTO listas (label, value, ref, formulario, campo, indice)
SELECT s.label, s.val, '230_' + s.slug, 'evento_230', s.slug, s.ord
FROM @slugs s;
PRINT 'Listas evento_230 sembradas.';

-- ========== DEFINICIONES DE PREGUNTAS (evento 230) ==========
DECLARE @defs TABLE (
    numero NVARCHAR(10), slug NVARCHAR(60), lista_slug NVARCHAR(60), tipo NVARCHAR(20),
    obligatorio BIT, show_if NVARCHAR(50), padre_slug NVARCHAR(60), label NVARCHAR(200),
    seccion NVARCHAR(15), seccion_label NVARCHAR(120), indice INT
);

INSERT INTO @defs (numero, slug, lista_slug, tipo, obligatorio, show_if, padre_slug, label, seccion, seccion_label, indice) VALUES
 -- 5. ANTECEDENTES
 ('5.1','contacto_confirmado','si_no_desconocido','select',1,NULL,NULL,N'¿Contacto de un caso confirmado?','5','5. ANTECEDENTES',1),
 ('5.2','carne','si_no','select',1,NULL,NULL,N'¿Tiene carné de vacunación?','5','5. ANTECEDENTES',2),
 ('5.3','dosis','dosis','select',1,NULL,NULL,N'Dosis aplicadas de vacuna antidiftérica','5','5. ANTECEDENTES',3),
 ('5.4','tipo_vacuna','tipo_vacuna','select',1,NULL,NULL,N'Tipo de vacuna','5','5. ANTECEDENTES',4),
 ('5.4.1','tipo_vacuna_otra',NULL,'text',0,'3','tipo_vacuna',N'¿Cuál otra? (solo si tipo de vacuna = Otra)','5','5. ANTECEDENTES',5),
 ('5.5','fecha_ultima_dosis',NULL,'date',0,NULL,NULL,N'Fecha de última dosis','5','5. ANTECEDENTES',6),

 -- 6. DATOS CLÍNICOS (todas con opciones 1 Sí / 2 No / 3 Desconocido)
 ('6.1','fiebre','si_no_desconocido','select',1,NULL,NULL,N'Fiebre','6','6. DATOS CLÍNICOS',7),
 ('6.2','amigdalitis','si_no_desconocido','select',1,NULL,NULL,N'Amigdalitis','6','6. DATOS CLÍNICOS',8),
 ('6.3','faringitis','si_no_desconocido','select',1,NULL,NULL,N'Faringitis','6','6. DATOS CLÍNICOS',9),
 ('6.4','laringitis','si_no_desconocido','select',1,NULL,NULL,N'Laringitis','6','6. DATOS CLÍNICOS',10),
 ('6.5','membranas','si_no_desconocido','select',1,NULL,NULL,N'Presencia de membranas','6','6. DATOS CLÍNICOS',11),
 ('6.6','complicaciones','si_no_desconocido','select',1,NULL,NULL,N'Complicaciones','6','6. DATOS CLÍNICOS',12),
 ('6.7','tipo_complicacion','tipo_complicacion','select',1,'1','complicaciones',N'Tipo de complicación (solo si hubo complicaciones)','6','6. DATOS CLÍNICOS',13),

 -- 7. DATOS DE LABORATORIO
 ('7.1','fecha_toma',NULL,'date',1,NULL,NULL,N'Fecha toma de examen','7','7. DATOS DE LABORATORIO',14),
 ('7.2','fecha_recepcion',NULL,'date',1,NULL,NULL,N'Fecha de recepción','7','7. DATOS DE LABORATORIO',15),
 ('7.3','muestra',NULL,'text',1,NULL,NULL,N'Muestra','7','7. DATOS DE LABORATORIO',16),
 ('7.4','prueba',NULL,'text',1,NULL,NULL,N'Prueba','7','7. DATOS DE LABORATORIO',17),
 ('7.5','agente',NULL,'text',1,NULL,NULL,N'Agente','7','7. DATOS DE LABORATORIO',18),
 ('7.6','resultado',NULL,'text',1,NULL,NULL,N'Resultado','7','7. DATOS DE LABORATORIO',19),
 ('7.7','fecha_resultado',NULL,'date',1,NULL,NULL,N'Fecha de resultado','7','7. DATOS DE LABORATORIO',20),
 ('7.8','valor',NULL,'text',0,NULL,NULL,N'Valor','7','7. DATOS DE LABORATORIO',21);

-- Re-sembrado idempotente
DELETE FROM detalle_eventos WHERE evento_codigo = '230';
DELETE FROM detalle_eventos_respuestas WHERE ref LIKE '230[_]%';

INSERT INTO detalle_eventos (evento_codigo, seccion, subs, numero, ref, tipo, lista_ref, obligatorio, show_if, padre_ref, seccion_label, label, indice)
SELECT '230', d.seccion, NULL, d.numero,
       '230_' + d.slug, d.tipo,
       CASE WHEN d.lista_slug IS NULL THEN NULL ELSE '230_' + d.lista_slug END,
       d.obligatorio, d.show_if,
       CASE WHEN d.padre_slug IS NULL THEN NULL ELSE '230_' + d.padre_slug END,
       d.seccion_label, d.label, d.indice
FROM @defs d;
PRINT 'Preguntas evento 230 (difteria) sembradas.';
