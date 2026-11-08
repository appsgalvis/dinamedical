-- ===========================================
-- MIGRACIÓN 027: Preguntas de la ficha Dengue (210), Dengue grave (220)
-- y Mortalidad por Dengue (580) en el formulario dinámico.
--
-- Fuente: dinamedical/fichas/210_220_580_Dengue_2026.pdf (FOR-R02.0000-001 V:11 2026-08-06),
-- leído por bloques con coordenadas para conservar la estructura visual
-- (secciones, subíndices, códigos de opción y reglas de descargue).
--
-- Secciones sembradas: solo los DATOS COMPLEMENTARIOS (5-9). Las secciones 1-4
-- (datos básicos) ya viven en ficha_datos_basicos.
--
-- Reglas de descargue (del instructivo, codificadas con show_if + padre_ref):
--   5.1.1 depende de 5.1 = '1' (Sí)
--   9.8   depende de 9.6 = '6' (Valor registrado)
--   Códigos '0 = No aplica' de 7.1 y 7.2 solo son admisibles para el evento 580.
--   Muestra '4 Tejido' de 9.3 solo es admisible para el evento 580.
--   Bloques de hallazgos (sección 6): 210 = solo Dengue sin signos de alarma,
--   220 = solo Dengue grave, 580 = los tres bloques (su clasificación final
--   puede ser 1, 2 o 3). Sección 8 (muestras) solo para 580.
--
-- Los números de pregunta ('numero') son los de la ficha impresa. Los códigos de
-- opción vienen del instructivo cuando existen; donde la ficha solo dice
-- "marque con una X" se usan códigos internos de la UI (se anotan en la lista).
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== OPCIONES (listas) por evento ==========
DECLARE @slugs TABLE (evento NVARCHAR(5), slug NVARCHAR(60), val NVARCHAR(50), label NVARCHAR(150), ord INT);

INSERT INTO @slugs (evento, slug, val, label, ord) VALUES
 -- Sí / No (5.1)
 ('210','si_no','1',N'Sí',1), ('210','si_no','2',N'No',2),
 ('220','si_no','1',N'Sí',1), ('220','si_no','2',N'No',2),
 ('580','si_no','1',N'Sí',1), ('580','si_no','2',N'No',2),
 -- Sí / No / Desconocido (5.2)
 ('210','si_no_desconocido','1',N'Sí',1), ('210','si_no_desconocido','2',N'No',2), ('210','si_no_desconocido','3',N'Desconocido',3),
 ('220','si_no_desconocido','1',N'Sí',1), ('220','si_no_desconocido','2',N'No',2), ('220','si_no_desconocido','3',N'Desconocido',3),
 ('580','si_no_desconocido','1',N'Sí',1), ('580','si_no_desconocido','2',N'No',2), ('580','si_no_desconocido','3',N'Desconocido',3),

 -- 6-A Hallazgos Dengue sin signos de alarma (FIEBRE + 2 o más; códigos internos de UI,
 -- el PDF no los numera; orden visual del impreso)
 ('210','hallazgos_sin_signos','1',N'Fiebre',1),
 ('210','hallazgos_sin_signos','2',N'Cefalea',2),
 ('210','hallazgos_sin_signos','3',N'Dolor retroocular',3),
 ('210','hallazgos_sin_signos','4',N'Mialgias',4),
 ('210','hallazgos_sin_signos','5',N'Artralgias',5),
 ('210','hallazgos_sin_signos','6',N'Erupción o rash',6),
 ('580','hallazgos_sin_signos','1',N'Fiebre',1),
 ('580','hallazgos_sin_signos','2',N'Cefalea',2),
 ('580','hallazgos_sin_signos','3',N'Dolor retroocular',3),
 ('580','hallazgos_sin_signos','4',N'Mialgias',4),
 ('580','hallazgos_sin_signos','5',N'Artralgias',5),
 ('580','hallazgos_sin_signos','6',N'Erupción o rash',6),

 -- 6-B Hallazgos Dengue con signos de alarma (codes internos de UI, orden visual del impreso)
 ('580','hallazgos_con_signos','1',N'Dolor abdominal intenso y continuo',1),
 ('580','hallazgos_con_signos','2',N'Vómito persistente',2),
 ('580','hallazgos_con_signos','3',N'Diarrea',3),
 ('580','hallazgos_con_signos','4',N'Somnolencia o irritabilidad',4),
 ('580','hallazgos_con_signos','5',N'Hipotensión postural',5),
 ('580','hallazgos_con_signos','6',N'Hepatomegalia dolorosa > 2 cm',6),
 ('580','hallazgos_con_signos','7',N'Disminución de la diuresis',7),
 ('580','hallazgos_con_signos','8',N'Hemorragias importantes en mucosas',8),
 ('580','hallazgos_con_signos','9',N'Hipotermia',9),
 ('580','hallazgos_con_signos','10',N'Aumento de hematocrito',10),
 ('580','hallazgos_con_signos','11',N'Caída de plaquetas (<100.000)',11),
 ('580','hallazgos_con_signos','12',N'Acumulación de líquidos',12),

 -- 6-C Dengue grave (códigos del instructivo: 1-4)
 ('220','hallazgos_grave','1',N'Extravasación severa de plasma (choque por dengue o acumulación de líquidos con dificultad respiratoria)',1),
 ('220','hallazgos_grave','2',N'Hemorragia con compromiso hemodinámico',2),
 ('220','hallazgos_grave','3',N'Shock por dengue',3),
 ('220','hallazgos_grave','4',N'Daño grave de órganos (miocarditis, encefalitis, hepatitis con transaminasas >1.000, colecistitis alitiásica, IRA)',4),
 ('580','hallazgos_grave','1',N'Extravasación severa de plasma (choque por dengue o acumulación de líquidos con dificultad respiratoria)',1),
 ('580','hallazgos_grave','2',N'Hemorragia con compromiso hemodinámico',2),
 ('580','hallazgos_grave','3',N'Shock por dengue',3),
 ('580','hallazgos_grave','4',N'Daño grave de órganos (miocarditis, encefalitis, hepatitis con transaminasas >1.000, colecistitis alitiásica, IRA)',4),

 -- 7.1 Clasificación final. '0 No aplica' solo es admisible para el evento 580
 ('210','clasificacion_final','1',N'Dengue sin signos de alarma',1),
 ('210','clasificacion_final','2',N'Dengue con signos de alarma',2),
 ('210','clasificacion_final','3',N'Dengue grave',3),
 ('220','clasificacion_final','1',N'Dengue sin signos de alarma',1),
 ('220','clasificacion_final','2',N'Dengue con signos de alarma',2),
 ('220','clasificacion_final','3',N'Dengue grave',3),
 ('580','clasificacion_final','0',N'No aplica (solo admisible para mortalidad por dengue)',0),
 ('580','clasificacion_final','1',N'Dengue sin signos de alarma',1),
 ('580','clasificacion_final','2',N'Dengue con signos de alarma',2),
 ('580','clasificacion_final','3',N'Dengue grave',3),

 -- 7.2 Conducta. '0 No aplica' solo es admisible para el evento 580
 ('210','conducta','1',N'Ambulatoria',1),
 ('210','conducta','2',N'Hospitalización en piso',2),
 ('210','conducta','3',N'Unidad de cuidados intensivos (UCI)',3),
 ('210','conducta','4',N'Observación',4),
 ('210','conducta','5',N'Remisión para hospitalización',5),
 ('220','conducta','1',N'Ambulatoria',1),
 ('220','conducta','2',N'Hospitalización en piso',2),
 ('220','conducta','3',N'Unidad de cuidados intensivos (UCI)',3),
 ('220','conducta','4',N'Observación',4),
 ('220','conducta','5',N'Remisión para hospitalización',5),
 ('580','conducta','0',N'No aplica (solo admisible para mortalidad por dengue)',0),
 ('580','conducta','1',N'Ambulatoria',1),
 ('580','conducta','2',N'Hospitalización en piso',2),
 ('580','conducta','3',N'Unidad de cuidados intensivos (UCI)',3),
 ('580','conducta','4',N'Observación',4),
 ('580','conducta','5',N'Remisión para hospitalización',5),

 -- 8.1 Muestras (solo evento 580). Códigos internos de UI; 4 = Tejido coincide con la lista de laboratorio
 ('580','muestras','4',N'Tejido',1), ('580','muestras','5',N'Bazo',2), ('580','muestras','6',N'Cerebro',3),
 ('580','muestras','7',N'Médula',4), ('580','muestras','8',N'Pulmón',5), ('580','muestras','9',N'Hígado',6),
 ('580','muestras','10',N'Miocardio',7), ('580','muestras','11',N'Riñón',8),

 -- 9.3 Muestra de laboratorio (Tejido solo admisible para 580)
 ('210','muestra_lab','13',N'Suero',1),
 ('220','muestra_lab','13',N'Suero',1),
 ('580','muestra_lab','4',N'Tejido',1), ('580','muestra_lab','13',N'Suero',2),
 -- 9.4 Prueba
 ('210','prueba_lab','4',N'PCR',1), ('210','prueba_lab','0',N'Elisa NS1',2), ('210','prueba_lab','2',N'IgM',3),
 ('210','prueba_lab','3',N'IgG',4), ('210','prueba_lab','5',N'Aislamiento viral',5),
 ('220','prueba_lab','4',N'PCR',1), ('220','prueba_lab','0',N'Elisa NS1',2), ('220','prueba_lab','2',N'IgM',3),
 ('220','prueba_lab','3',N'IgG',4), ('220','prueba_lab','5',N'Aislamiento viral',5),
 ('580','prueba_lab','4',N'PCR',1), ('580','prueba_lab','0',N'Elisa NS1',2), ('580','prueba_lab','2',N'IgM',3),
 ('580','prueba_lab','3',N'IgG',4), ('580','prueba_lab','5',N'Aislamiento viral',5),
 -- 9.5 Agente
 ('210','agente_lab','3',N'Dengue',1), ('220','agente_lab','3',N'Dengue',1), ('580','agente_lab','3',N'Dengue',1),
 -- 9.6 Resultado
 ('210','resultado_lab','1',N'Positivo',1), ('210','resultado_lab','2',N'Negativo',2),
 ('210','resultado_lab','3',N'No procesado',3), ('210','resultado_lab','4',N'Inadecuado',4),
 ('210','resultado_lab','6',N'Valor registrado',5),
 ('220','resultado_lab','1',N'Positivo',1), ('220','resultado_lab','2',N'Negativo',2),
 ('220','resultado_lab','3',N'No procesado',3), ('220','resultado_lab','4',N'Inadecuado',4),
 ('220','resultado_lab','6',N'Valor registrado',5),
 ('580','resultado_lab','1',N'Positivo',1), ('580','resultado_lab','2',N'Negativo',2),
 ('580','resultado_lab','3',N'No procesado',3), ('580','resultado_lab','4',N'Inadecuado',4),
 ('580','resultado_lab','6',N'Valor registrado',5);

DELETE FROM listas WHERE formulario IN ('evento_210', 'evento_220', 'evento_580');
INSERT INTO listas (label, value, ref, formulario, campo, indice)
SELECT s.label, s.val, s.evento + '_' + s.slug, 'evento_' + s.evento, s.slug, s.ord
FROM @slugs s;
PRINT 'Listas evento_210 / evento_220 / evento_580 sembradas.';

-- Las preguntas de Dengue tienen enunciados largos (el instructivo los transcribe
-- completos); ensanchar label para poder guardarlos tal cual salen en la ficha.
IF COL_LENGTH('detalle_eventos', 'label') IS NOT NULL
    ALTER TABLE detalle_eventos ALTER COLUMN label NVARCHAR(200);

-- ========== DEFINICIONES DE PREGUNTAS ==========
DECLARE @defs TABLE (
    evento NVARCHAR(5), seccion NVARCHAR(15), subs NVARCHAR(2), numero NVARCHAR(10),
    slug NVARCHAR(60), lista_slug NVARCHAR(60), tipo NVARCHAR(20), obligatorio BIT,
    show_if NVARCHAR(50), padre_slug NVARCHAR(60), label NVARCHAR(200),
    seccion_label NVARCHAR(120), indice INT
);

INSERT INTO @defs (evento, seccion, subs, numero, slug, lista_slug, tipo, obligatorio, show_if, padre_slug, label, seccion_label, indice) VALUES
 -- 210 DENGUE
 ('210','5',NULL,'5.1','desplazamiento_15_dias','si_no','select',1,NULL,NULL,N'¿Desplazamiento en los últimos 15 días?',N'5. DATOS ESPECÍFICOS',1),
 ('210','5',NULL,'5.1.1','lugar_desplazamiento',NULL,'text',0,'1','desplazamiento_15_dias',N'País / departamento / municipio al que se desplazó',N'5. DATOS ESPECÍFICOS',2),
 ('210','5',NULL,'5.2','familiar_sintomatologia','si_no_desconocido','select',1,NULL,NULL,N'¿Algún familiar o conviviente ha tenido sintomatología de dengue en los últimos 15 días?',N'5. DATOS ESPECÍFICOS',3),
 ('210','5',NULL,'5.3','establecimiento_trabajo',NULL,'text',0,NULL,NULL,N'Nombre del establecimiento donde estudia o trabaja',N'5. DATOS ESPECÍFICOS',4),
 ('210','6','A','6.1','hallazgos_sin_signos','hallazgos_sin_signos','multiselect',1,NULL,NULL,N'Hallazgos (marque los que se presenten): FIEBRE + 2 o más de cefalea, dolor retroocular, mialgias, artralgias, erupción o rash',N'6. CLASIFICACIÓN — Dengue sin signos de alarma',5),
 ('210','7',NULL,'7.1','clasificacion_final','clasificacion_final','select',1,NULL,NULL,N'Clasificación final',N'7. CLASIFICACIÓN FINAL Y ATENCIÓN DEL CASO',6),
 ('210','7',NULL,'7.2','conducta','conducta','select',1,NULL,NULL,N'Conducta',N'7. CLASIFICACIÓN FINAL Y ATENCIÓN DEL CASO',7),
 ('210','9',NULL,'9.1','fecha_toma_examen',NULL,'date',1,NULL,NULL,N'Fecha toma de examen',N'9. DATOS DE LABORATORIO',8),
 ('210','9',NULL,'9.2','fecha_recepcion_examen',NULL,'date',1,NULL,NULL,N'Fecha de recepción',N'9. DATOS DE LABORATORIO',9),
 ('210','9',NULL,'9.3','muestra_lab','muestra_lab','select',0,NULL,NULL,N'Muestra',N'9. DATOS DE LABORATORIO',10),
 ('210','9',NULL,'9.4','prueba_lab','prueba_lab','select',0,NULL,NULL,N'Prueba',N'9. DATOS DE LABORATORIO',11),
 ('210','9',NULL,'9.5','agente_lab','agente_lab','select',0,NULL,NULL,N'Agente',N'9. DATOS DE LABORATORIO',12),
 ('210','9',NULL,'9.6','resultado_lab','resultado_lab','select',0,NULL,NULL,N'Resultado',N'9. DATOS DE LABORATORIO',13),
 ('210','9',NULL,'9.7','fecha_resultado',NULL,'date',1,NULL,NULL,N'Fecha de resultado',N'9. DATOS DE LABORATORIO',14),
 ('210','9',NULL,'9.8','valor_resultado',NULL,'text',1,'6','resultado_lab',N'Valor registrado',N'9. DATOS DE LABORATORIO',15),

 -- 220 DENGUE GRAVE
 ('220','5',NULL,'5.1','desplazamiento_15_dias','si_no','select',1,NULL,NULL,N'¿Desplazamiento en los últimos 15 días?',N'5. DATOS ESPECÍFICOS',1),
 ('220','5',NULL,'5.1.1','lugar_desplazamiento',NULL,'text',0,'1','desplazamiento_15_dias',N'País / departamento / municipio al que se desplazó',N'5. DATOS ESPECÍFICOS',2),
 ('220','5',NULL,'5.2','familiar_sintomatologia','si_no_desconocido','select',1,NULL,NULL,N'¿Algún familiar o conviviente ha tenido sintomatología de dengue en los últimos 15 días?',N'5. DATOS ESPECÍFICOS',3),
 ('220','5',NULL,'5.3','establecimiento_trabajo',NULL,'text',0,NULL,NULL,N'Nombre del establecimiento donde estudia o trabaja',N'5. DATOS ESPECÍFICOS',4),
 ('220','6','C','6.1','hallazgos_grave','hallazgos_grave','multiselect',1,NULL,NULL,N'Dengue grave (marque los criterios que presenta): Extravasación severa de plasma, Hemorragia con compromiso hemodinámico, Shock por dengue, Daño grave de órganos',N'6. CLASIFICACIÓN — Dengue grave',5),
 ('220','7',NULL,'7.1','clasificacion_final','clasificacion_final','select',1,NULL,NULL,N'Clasificación final',N'7. CLASIFICACIÓN FINAL Y ATENCIÓN DEL CASO',6),
 ('220','7',NULL,'7.2','conducta','conducta','select',1,NULL,NULL,N'Conducta',N'7. CLASIFICACIÓN FINAL Y ATENCIÓN DEL CASO',7),
 ('220','9',NULL,'9.1','fecha_toma_examen',NULL,'date',1,NULL,NULL,N'Fecha toma de examen',N'9. DATOS DE LABORATORIO',8),
 ('220','9',NULL,'9.2','fecha_recepcion_examen',NULL,'date',1,NULL,NULL,N'Fecha de recepción',N'9. DATOS DE LABORATORIO',9),
 ('220','9',NULL,'9.3','muestra_lab','muestra_lab','select',0,NULL,NULL,N'Muestra',N'9. DATOS DE LABORATORIO',10),
 ('220','9',NULL,'9.4','prueba_lab','prueba_lab','select',0,NULL,NULL,N'Prueba',N'9. DATOS DE LABORATORIO',11),
 ('220','9',NULL,'9.5','agente_lab','agente_lab','select',0,NULL,NULL,N'Agente',N'9. DATOS DE LABORATORIO',12),
 ('220','9',NULL,'9.6','resultado_lab','resultado_lab','select',0,NULL,NULL,N'Resultado',N'9. DATOS DE LABORATORIO',13),
 ('220','9',NULL,'9.7','fecha_resultado',NULL,'date',1,NULL,NULL,N'Fecha de resultado',N'9. DATOS DE LABORATORIO',14),
 ('220','9',NULL,'9.8','valor_resultado',NULL,'text',1,'6','resultado_lab',N'Valor registrado',N'9. DATOS DE LABORATORIO',15),

 -- 580 MORTALIDAD POR DENGUE (los tres bloques de hallazgos + sección 8)
 ('580','5',NULL,'5.1','desplazamiento_15_dias','si_no','select',1,NULL,NULL,N'¿Desplazamiento en los últimos 15 días?',N'5. DATOS ESPECÍFICOS',1),
 ('580','5',NULL,'5.1.1','lugar_desplazamiento',NULL,'text',0,'1','desplazamiento_15_dias',N'País / departamento / municipio al que se desplazó',N'5. DATOS ESPECÍFICOS',2),
 ('580','5',NULL,'5.2','familiar_sintomatologia','si_no_desconocido','select',1,NULL,NULL,N'¿Algún familiar o conviviente ha tenido sintomatología de dengue en los últimos 15 días?',N'5. DATOS ESPECÍFICOS',3),
 ('580','5',NULL,'5.3','establecimiento_trabajo',NULL,'text',0,NULL,NULL,N'Nombre del establecimiento donde estudia o trabaja',N'5. DATOS ESPECÍFICOS',4),
 ('580','6','A','6.1','hallazgos_sin_signos','hallazgos_sin_signos','multiselect',1,NULL,NULL,N'Hallazgos (marque los que se presenten): FIEBRE + 2 o más de cefalea, dolor retroocular, mialgias, artralgias, erupción o rash',N'6. CLASIFICACIÓN — Dengue sin signos de alarma',5),
 ('580','6','B','6.1','hallazgos_con_signos','hallazgos_con_signos','multiselect',1,NULL,NULL,N'Dengue con signos de alarma (marque los que se presenten)',N'6. CLASIFICACIÓN — Dengue con signos de alarma',6),
 ('580','6','C','6.1','hallazgos_grave','hallazgos_grave','multiselect',1,NULL,NULL,N'Dengue grave (marque los criterios que presenta)',N'6. CLASIFICACIÓN — Dengue grave',7),
 ('580','7',NULL,'7.1','clasificacion_final','clasificacion_final','select',1,NULL,NULL,N'Clasificación final',N'7. CLASIFICACIÓN FINAL Y ATENCIÓN DEL CASO',8),
 ('580','7',NULL,'7.2','conducta','conducta','select',1,NULL,NULL,N'Conducta',N'7. CLASIFICACIÓN FINAL Y ATENCIÓN DEL CASO',9),
 ('580','8',NULL,'8.1','muestras','muestras','multiselect',1,NULL,NULL,N'Muestras tomadas (marque con una X)',N'8. EN CASO DE MORTALIDAD POR DENGUE',10),
 ('580','9',NULL,'9.1','fecha_toma_examen',NULL,'date',1,NULL,NULL,N'Fecha toma de examen',N'9. DATOS DE LABORATORIO',11),
 ('580','9',NULL,'9.2','fecha_recepcion_examen',NULL,'date',1,NULL,NULL,N'Fecha de recepción',N'9. DATOS DE LABORATORIO',12),
 ('580','9',NULL,'9.3','muestra_lab','muestra_lab','select',0,NULL,NULL,N'Muestra',N'9. DATOS DE LABORATORIO',13),
 ('580','9',NULL,'9.4','prueba_lab','prueba_lab','select',0,NULL,NULL,N'Prueba',N'9. DATOS DE LABORATORIO',14),
 ('580','9',NULL,'9.5','agente_lab','agente_lab','select',0,NULL,NULL,N'Agente',N'9. DATOS DE LABORATORIO',15),
 ('580','9',NULL,'9.6','resultado_lab','resultado_lab','select',0,NULL,NULL,N'Resultado',N'9. DATOS DE LABORATORIO',16),
 ('580','9',NULL,'9.7','fecha_resultado',NULL,'date',1,NULL,NULL,N'Fecha de resultado',N'9. DATOS DE LABORATORIO',17),
 ('580','9',NULL,'9.8','valor_resultado',NULL,'text',1,'6','resultado_lab',N'Valor registrado',N'9. DATOS DE LABORATORIO',18);

-- Re-sembrado idempotente (evita choque con UX_detalles_ref al re-ejecutar)
DELETE FROM detalle_eventos WHERE evento_codigo IN ('210', '220', '580');
DELETE FROM detalle_eventos_respuestas WHERE ref LIKE '210[_]%' OR ref LIKE '220[_]%' OR ref LIKE '580[_]%';

INSERT INTO detalle_eventos (evento_codigo, seccion, subs, numero, ref, tipo, lista_ref, obligatorio, show_if, padre_ref, seccion_label, label, indice)
SELECT d.evento, d.seccion, d.subs, d.numero,
       d.evento + '_' + d.slug, d.tipo,
       CASE WHEN d.lista_slug IS NULL THEN NULL ELSE d.evento + '_' + d.lista_slug END,
       d.obligatorio, d.show_if,
       CASE WHEN d.padre_slug IS NULL THEN NULL ELSE d.evento + '_' + d.padre_slug END,
       d.seccion_label, d.label, d.indice
FROM @defs d;
PRINT 'Preguntas Dengue 210 / 220 / 580 sembradas.';
