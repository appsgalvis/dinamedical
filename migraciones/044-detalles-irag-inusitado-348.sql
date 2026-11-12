-- ===========================================
-- MIGRACIÓN 044: Preguntas ficha IRAG INUSITADA
-- (evento 348, FOR-R02.4030-023 V:00 2026-08-06) en el formulario dinámico.
--
-- Fuente: dumps/vision/348_irag_inusitado_2026_vision.txt (p2) + instructivo p6-p7.
--
-- Decisiones:
--   - Sección 5 exclusiva de IRAG inusitada (motivos + viaje + tos/fiebre).
--   - Subpreguntas de viaje show_if motivo_irag multiselect contiene '5' (¿Viajó?).
--   - Vacunación: solo Influenza (6.1/6.1.1) y COVID (6.2.x); sin matriz neumococo.
--   - 7.1 incluye Trombocitopenia + HTA (14 opciones); 7.1.1 plaquetas si trombo='12'.
--   - 8.1 solo radiografía de tórax (impreso 2026); 8.2 solo Sí/No (sin Desconocido).
--   - 8.4 obligatorio=0 (hospitalización en datos básicos 3.7); 8.5 obligatorio=0.
--   - 8.3.1 padre 8.3 (corrige typo instructivo que citaba 7.3).
--   - Sección 9 laboratorio fuera del catálogo.
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

DECLARE @slugs TABLE (slug NVARCHAR(60), val NVARCHAR(50), label NVARCHAR(200), ord INT);

INSERT INTO @slugs (slug, val, label, ord) VALUES
 ('si_no','1',N'Sí',1), ('si_no','2',N'No',2),
 ('si_no_desc','1',N'Sí',1), ('si_no_desc','2',N'No',2), ('si_no_desc','3',N'Desconocido',3),
 ('motivo_irag','1',N'Es trabajador del área de la salud',1),
 ('motivo_irag','2',N'Tuvo contacto con aves o cerdos enfermos o muertos (14 días previos)',2),
 ('motivo_irag','3',N'Presenta deterioro clínico sin etiología determinada, con evolución rápida (vasopresores y/o ventilación mecánica) desde el inicio de síntomas',3),
 ('motivo_irag','4',N'Caso asociado a un brote o conglomerado',4),
 ('motivo_irag','5',N'¿Viajó?',5),
 ('motivo_irag','6',N'Tuvo contacto estrecho con personas enfermas o que hallan fallecido de IRAG (14 días previos a los síntomas)',6),
 ('signos_oblig','1',N'Paciente con tos',1),
 ('signos_oblig','2',N'Paciente con fiebre',2),
 ('hallazgos_rx','1',N'Infiltrado alveolar o neumonía',1),
 ('hallazgos_rx','2',N'Infiltrados intersticiales',2),
 ('hallazgos_rx','3',N'Ninguno',3),
 ('servicio_hosp','1',N'Hospitalización general',1),
 ('servicio_hosp','2',N'Unidad de cuidados intermedios',2),
 ('servicio_hosp','3',N'UCI – Unidad de cuidados intensivos',3),
 ('antecedentes_clin','1',N'Asma',1),
 ('antecedentes_clin','2',N'EPOC',2),
 ('antecedentes_clin','3',N'Diabetes',3),
 ('antecedentes_clin','4',N'VIH',4),
 ('antecedentes_clin','5',N'Enfermedad cardiaca',5),
 ('antecedentes_clin','6',N'Cancer',6),
 ('antecedentes_clin','7',N'Malnutrición',7),
 ('antecedentes_clin','8',N'Obesidad',8),
 ('antecedentes_clin','9',N'Insuficiencia renal',9),
 ('antecedentes_clin','10',N'Toma medicamentos inmunosupresores',10),
 ('antecedentes_clin','11',N'Fumador',11),
 ('antecedentes_clin','12',N'Trombocitopenia',12),
 ('antecedentes_clin','13',N'HTA',13),
 ('antecedentes_clin','14',N'Otros',14),
 ('complicaciones_irag','1',N'Derrame pleural',1),
 ('complicaciones_irag','2',N'Derrame pericárdico',2),
 ('complicaciones_irag','3',N'Miocarditis',3),
 ('complicaciones_irag','4',N'Septicemia',4),
 ('complicaciones_irag','5',N'Falla Respiratoria',5),
 ('complicaciones_irag','6',N'Otro',6);

DELETE FROM listas WHERE formulario = 'evento_348';
INSERT INTO listas (label, value, ref, formulario, campo, indice)
SELECT s.label, s.val, '348_' + s.slug, 'evento_348', s.slug, s.ord
FROM @slugs s;
PRINT 'Listas evento_348 sembradas.';

DECLARE @defs TABLE (
    numero NVARCHAR(10), slug NVARCHAR(60), lista_slug NVARCHAR(60),
    tipo NVARCHAR(20), obligatorio BIT, show_if NVARCHAR(50), padre_slug NVARCHAR(60),
    label NVARCHAR(200), seccion NVARCHAR(15), seccion_label NVARCHAR(120), indice INT
);

INSERT INTO @defs (numero, slug, lista_slug, tipo, obligatorio, show_if, padre_slug, label, seccion, seccion_label, indice) VALUES
 ('5.1','motivo_irag','motivo_irag','multiselect',1,NULL,NULL,N'Seleccione una o varias de las siguientes opciones','5',N'5. ¿POR QUÉ SE NOTIFICA EL CASO COMO IRAG INUSITADO?',1),
 ('5.1.1','viaje_nacional','si_no','select',1,'5','motivo_irag',N'¿El viaje fue en el territorio Nacional?','5',N'5. ¿POR QUÉ SE NOTIFICA EL CASO COMO IRAG INUSITADO?',2),
 ('5.1.1.1','viaje_nacional_donde',NULL,'text',1,'1','viaje_nacional',N'¿Dónde? (departamento y municipio — viaje nacional)','5',N'5. ¿POR QUÉ SE NOTIFICA EL CASO COMO IRAG INUSITADO?',3),
 ('5.1.1.1','viaje_nacional_codigo',NULL,'text',1,'1','viaje_nacional',N'Código (viaje nacional)','5',N'5. ¿POR QUÉ SE NOTIFICA EL CASO COMO IRAG INUSITADO?',4),
 ('5.1.2','viaje_internacional','si_no','select',1,'5','motivo_irag',N'¿El viaje fue Internacional?','5',N'5. ¿POR QUÉ SE NOTIFICA EL CASO COMO IRAG INUSITADO?',5),
 ('5.1.2.1','viaje_internacional_donde',NULL,'text',1,'1','viaje_internacional',N'¿Dónde? (viaje internacional)','5',N'5. ¿POR QUÉ SE NOTIFICA EL CASO COMO IRAG INUSITADO?',6),
 ('5.1.2.1','viaje_internacional_codigo',NULL,'text',1,'1','viaje_internacional',N'Código (viaje internacional)','5',N'5. ¿POR QUÉ SE NOTIFICA EL CASO COMO IRAG INUSITADO?',7),
 ('5.2','signos_oblig','signos_oblig','multiselect',1,NULL,NULL,N'Recuerde que los casos de IRAG inusitado siempre deben tener tos y fiebre','5',N'5. ¿POR QUÉ SE NOTIFICA EL CASO COMO IRAG INUSITADO?',8),

 ('6.1','vac_influenza','si_no_desc','select',1,NULL,NULL,N'Influenza estacional','6',N'6. ANTECEDENTES VACUNALES',9),
 ('6.1.1','vac_influenza_dosis',NULL,'number',1,'1','vac_influenza',N'Dosis — Influenza estacional','6',N'6. ANTECEDENTES VACUNALES',10),
 ('6.2','vac_covid','si_no_desc','select',1,NULL,NULL,N'COVID-19','6',N'6. ANTECEDENTES VACUNALES',11),
 ('6.2.1','vac_covid_dosis',NULL,'number',1,'1','vac_covid',N'Dosis — COVID-19','6',N'6. ANTECEDENTES VACUNALES',12),
 ('6.2.2','vac_covid_fecha',NULL,'date',1,'1','vac_covid',N'Fecha última dosis (dd/mm/aaaa) — COVID-19','6',N'6. ANTECEDENTES VACUNALES',13),
 ('6.2.3','vac_covid_nombre',NULL,'text',1,'1','vac_covid',N'Nombre de la vacuna — COVID-19','6',N'6. ANTECEDENTES VACUNALES',14),

 ('7.1','antecedentes_clin','antecedentes_clin','multiselect',1,NULL,NULL,N'¿Reporta alguno de los siguientes antecedentes clínicos?','7',N'7. DATOS CLÍNICOS',15),
 ('7.1.1','conteo_plaquetas',NULL,'number',1,'12','antecedentes_clin',N'Conteo de plaquetas','7',N'7. DATOS CLÍNICOS',16),
 ('7.2','antecedentes_otros',NULL,'text',1,'14','antecedentes_clin',N'¿Cuáles otros?','7',N'7. DATOS CLÍNICOS',17),

 ('8.1','hallazgos_rx','hallazgos_rx','select',1,NULL,NULL,N'Si se tomó de radiografía de tórax ¿qué hallazgos se presentaron?','8',N'8. DIAGNÓSTICO Y TRATAMIENTO',18),
 ('8.2','uso_antibioticos','si_no','select',1,NULL,NULL,N'¿Usó antibiótico en la última semana?','8',N'8. DIAGNÓSTICO Y TRATAMIENTO',19),
 ('8.3','uso_antivirales','si_no','select',1,NULL,NULL,N'¿Usó antivirales en la última semana?','8',N'8. DIAGNÓSTICO Y TRATAMIENTO',20),
 ('8.3.1','fecha_inicio_antiviral',NULL,'date',1,'1','uso_antivirales',N'Fecha de inicio de antiviral (dd/mm/aaaa)','8',N'8. DIAGNÓSTICO Y TRATAMIENTO',21),
 ('8.4','servicio_hosp','servicio_hosp','select',0,NULL,NULL,N'Servicio en el que se hospitalizó','8',N'8. DIAGNÓSTICO Y TRATAMIENTO',22),
 ('8.4.1','fecha_ingreso_uci',NULL,'date',1,'3','servicio_hosp',N'Fecha de ingreso a UCI (dd/mm/aaaa)','8',N'8. DIAGNÓSTICO Y TRATAMIENTO',23),
 ('8.5','complicaciones','complicaciones_irag','multiselect',0,NULL,NULL,N'Si hubo complicaciones, ¿Cuáles se presentaron?','8',N'8. DIAGNÓSTICO Y TRATAMIENTO',24),
 ('8.5.1','complicaciones_otros',NULL,'text',1,'6','complicaciones',N'Otro — ¿cuáles?','8',N'8. DIAGNÓSTICO Y TRATAMIENTO',25);

DELETE FROM detalle_eventos WHERE evento_codigo = '348';
DELETE FROM detalle_eventos_respuestas WHERE ref LIKE '348[_]%';

INSERT INTO detalle_eventos (evento_codigo, seccion, subs, numero, ref, tipo, lista_ref, obligatorio, show_if, padre_ref, seccion_label, label, indice)
SELECT '348', d.seccion, NULL, d.numero,
       '348_' + d.slug, d.tipo,
       CASE WHEN d.lista_slug IS NULL THEN NULL ELSE '348_' + d.lista_slug END,
       d.obligatorio, d.show_if,
       CASE WHEN d.padre_slug IS NULL THEN NULL ELSE '348_' + d.padre_slug END,
       d.seccion_label, d.label, d.indice
FROM @defs d;
PRINT 'Preguntas evento 348 (IRAG inusitada) sembradas.';

SELECT COUNT(*) AS defs_evento_348, SUM(CAST(obligatorio AS INT)) AS obligatorios
FROM detalle_eventos WHERE evento_codigo = '348';
SELECT COUNT(*) AS opciones_348 FROM listas WHERE formulario = 'evento_348';
