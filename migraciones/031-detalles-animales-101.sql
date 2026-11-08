-- ===========================================
-- MIGRACIÓN 031: Preguntas de la ficha ACCIDENTES POR ANIMALES VENENOSOS
-- (evento 101, FOR-R02.4030-006 V:00 2026-08-06) en el formulario dinámico.
--
-- Fuente: dumps/vision/101_accidentes_animales_venenosos_2026_vision.txt
-- (página 2 = formulario, verificada con visión; OBLIG confirmado visualmente
--  en las tablas de instructivo p6/p7/p8 por error de orden del extracto).
--
-- Secciones sembradas: solo los DATOS COMPLEMENTARIOS (5-7). Las secciones 1-4
-- (datos básicos) ya viven en ficha_datos_basicos.
--
-- Decisiones:
--   - Opciones en el orden IMPRESO de la ficha, incluyendo las erratas de
--     numeración: 5.3 no tiene opción 4; 5.4 salta el 8; 5.5 no tiene opción 8.
--   - OBLIG confirmado con visión: sección 5 todas SI excepto 5.2 NO; sección 6
--     todas SI; 7.1 SI, 7.2-7.7 NO, 7.8 SI.
--   - Regla dinámica: 7.2-7.7 dependen de 7.1 = 1 (¿Empleó suero? Sí)
--     => show_if='1', padre_ref='101_empleo_suero'.
--   - 6.1-6.4 son multiselect (marque con una X = selección individual).
--   - Las subvariables "Otro ¿cuál?" no tienen campo de descripción codificable;
--     se catalogan como opción. Los subregistros por descripción de opciones de 5.x
--     (criterio de sistematización p6) no son codificables como show_if.
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== OPCIONES (listas) para el evento 101 ==========
DECLARE @slugs TABLE (slug NVARCHAR(60), val NVARCHAR(50), label NVARCHAR(150), ord INT);

INSERT INTO @slugs (slug, val, label, ord) VALUES
 -- Sí / No
 ('si_no','1',N'Sí',1), ('si_no','2',N'No',2),
 -- 5.3 Actividad (impreso tal cual, errata: falta opción 4)
 ('actividad','1',N'Recreación',1),
 ('actividad','2',N'Actividad agrícola',2),
 ('actividad','3',N'Oficios domésticos',3),
 ('actividad','5',N'Recolección de desechos',4),
 ('actividad','6',N'Actividad acuática',5),
 ('actividad','8',N'Caminar por senderos abiertos o trocha',6),
 ('actividad','7',N'Otro ¿cuál?',7),
 -- 5.4 Tipo de atención inicial (errata: salta el 8)
 ('atencion_inicial','1',N'Incisión',1),
 ('atencion_inicial','2',N'Punción',2),
 ('atencion_inicial','3',N'Sangría',3),
 ('atencion_inicial','4',N'Torniquete',4),
 ('atencion_inicial','5',N'Inmovilización del enfermo',5),
 ('atencion_inicial','6',N'Inmovilización del miembro',6),
 ('atencion_inicial','7',N'Otro ¿cuál?',7),
 ('atencion_inicial','9',N'Succión mecánica',8),
 -- 5.5 Localización de la agresión (errata: falta opción 8)
 ('localizacion','1',N'Cabeza (cara)',1),
 ('localizacion','2',N'Miembros superiores',2),
 ('localizacion','3',N'Miembros inferiores',3),
 ('localizacion','4',N'Tórax anterior',4),
 ('localizacion','5',N'Abdomen',5),
 ('localizacion','6',N'Espalda',6),
 ('localizacion','7',N'Cuello',7),
 ('localizacion','9',N'Genitales',8),
 ('localizacion','10',N'Glúteos',9),
 ('localizacion','11',N'Dedos de pie',10),
 ('localizacion','12',N'Dedos de mano',11),
 -- 5.9 Agente agresor
 ('agente_agresor','1',N'Escorpión',1),
 ('agente_agresor','2',N'Phoneutria (araña platanera)',2),
 ('agente_agresor','3',N'Loxosceles (araña violín)',3),
 ('agente_agresor','4',N'Latrodectus (araña viuda)',4),
 ('agente_agresor','7',N'Oruga / Lonomia',5),
 -- 6.1 Manifestaciones locales (multiselect)
 ('manifest_locales','1',N'Edema',1),
 ('manifest_locales','2',N'Dolor',2),
 ('manifest_locales','3',N'Flictenas',3),
 ('manifest_locales','4',N'Parestesias / hipoestesias',4),
 ('manifest_locales','5',N'Equimosis',5),
 ('manifest_locales','6',N'Otra ¿cuál?',6),
 -- 6.2 Manifestaciones sistémicas (multiselect)
 ('manifest_sistemicas','1',N'Náuseas',1),
 ('manifest_sistemicas','2',N'Hemorragias',2),
 ('manifest_sistemicas','3',N'Vómitos',3),
 ('manifest_sistemicas','4',N'Diarrea',4),
 ('manifest_sistemicas','5',N'Dolor abdominal',5),
 ('manifest_sistemicas','6',N'Otra ¿cuál?',6),
 -- 6.3 Complicaciones locales (multiselect)
 ('compl_locales','1',N'Celulitis',1),
 ('compl_locales','2',N'Absceso',2),
 ('compl_locales','3',N'Necrosis',3),
 ('compl_locales','4',N'Hipoperfusión',4),
 ('compl_locales','5',N'Síndrome compartimental',5),
 ('compl_locales','6',N'Otra ¿cuál?',6),
 -- 6.4 Complicaciones sistémicas (multiselect)
 ('compl_sistemicas','1',N'Neurológica',1),
 ('compl_sistemicas','2',N'Respiratoria',2),
 ('compl_sistemicas','3',N'Cardiovascular',3),
 ('compl_sistemicas','4',N'Hematológica',4),
 ('compl_sistemicas','5',N'Otra ¿cuál?',5),
 -- 6.5 Gravedad
 ('gravedad','1',N'Leve',1),
 ('gravedad','2',N'Moderado',2),
 ('gravedad','3',N'Grave',3),
 -- 7.2 Tipo de suero
 ('tipo_suero','1',N'Antiofídico',1),
 ('tipo_suero','2',N'Antialacrón',2),
 ('tipo_suero','3',N'Antiescorpión',3),
 ('tipo_suero','4',N'Antiaramídi (anti-arácnido, impreso así)',4),
 ('tipo_suero','5',N'Otro ¿cuál?',5),
 -- 7.5 Reacciones a la aplicación del suero
 ('reacciones_suero','1',N'Sí',1),
 ('reacciones_suero','2',N'No',2),
 ('reacciones_suero','3',N'Generalizada',3),
 ('reacciones_suero','4',N'Local',4);

DELETE FROM listas WHERE formulario = 'evento_101';
INSERT INTO listas (label, value, ref, formulario, campo, indice)
SELECT s.label, s.val, '101_' + s.slug, 'evento_101', s.slug, s.ord
FROM @slugs s;
PRINT 'Listas evento_101 sembradas.';

-- ========== DEFINICIONES DE PREGUNTAS (evento 101) ==========
DECLARE @defs TABLE (
    numero NVARCHAR(10), slug NVARCHAR(60), lista_slug NVARCHAR(60), tipo NVARCHAR(20),
    obligatorio BIT, show_if NVARCHAR(50), padre_slug NVARCHAR(60), label NVARCHAR(200),
    seccion NVARCHAR(15), seccion_label NVARCHAR(120), indice INT
);

INSERT INTO @defs (numero, slug, lista_slug, tipo, obligatorio, show_if, padre_slug, label, seccion, seccion_label, indice) VALUES
 -- 5. DATOS DEL ACCIDENTE
 ('5.1','fecha_accidente',NULL,'date',1,NULL,NULL,N'Fecha del accidente','5','5. DATOS DEL ACCIDENTE',1),
 ('5.2','direccion_lugar',NULL,'text',0,NULL,NULL,N'Dirección del lugar donde ocurrió el accidente','5','5. DATOS DEL ACCIDENTE',2),
 ('5.3','actividad','actividad','select',1,NULL,NULL,N'Actividad que realizaba al momento del accidente','5','5. DATOS DEL ACCIDENTE',3),
 ('5.4','atencion_inicial','atencion_inicial','select',1,NULL,NULL,N'Tipo de atención inicial','5','5. DATOS DEL ACCIDENTE',4),
 ('5.5','localizacion','localizacion','select',1,NULL,NULL,N'Localización de la agresión','5','5. DATOS DEL ACCIDENTE',5),
 ('5.6','evidencia_agresion','si_no','select',1,NULL,NULL,N'¿Hay evidencia/huella de la agresión?','5','5. DATOS DEL ACCIDENTE',6),
 ('5.7','vio_agresor','si_no','select',1,NULL,NULL,N'¿La persona vio al animal agresor?','5','5. DATOS DEL ACCIDENTE',7),
 ('5.8','animal_capturado','si_no','select',1,NULL,NULL,N'¿El animal fue capturado?','5','5. DATOS DEL ACCIDENTE',8),
 ('5.9','agente_agresor','agente_agresor','select',1,NULL,NULL,N'Agente agresor','5','5. DATOS DEL ACCIDENTE',9),

 -- 6. CUADRO CLÍNICO (marque con una X = selección individual)
 ('6.1','manifestaciones_locales','manifest_locales','multiselect',1,NULL,NULL,N'Manifestaciones locales','6','6. CUADRO CLÍNICO',10),
 ('6.2','manifestaciones_sistemicas','manifest_sistemicas','multiselect',1,NULL,NULL,N'Manifestaciones sistémicas','6','6. CUADRO CLÍNICO',11),
 ('6.3','complicaciones_locales','compl_locales','multiselect',1,NULL,NULL,N'Complicaciones locales','6','6. CUADRO CLÍNICO',12),
 ('6.4','complicaciones_sistemicas','compl_sistemicas','multiselect',1,NULL,NULL,N'Complicaciones sistémicas','6','6. CUADRO CLÍNICO',13),
 ('6.5','gravedad','gravedad','select',1,NULL,NULL,N'Gravedad del accidente','6','6. CUADRO CLÍNICO',14),

 -- 7. ATENCIÓN HOSPITALARIA
 ('7.1','empleo_suero','si_no','select',1,NULL,NULL,N'¿Empleó suero?','7','7. ATENCIÓN HOSPITALARIA',15),
 ('7.2','tipo_suero','tipo_suero','select',0,'1','empleo_suero',N'Tipo de suero (solo si 7.1 = Sí)','7','7. ATENCIÓN HOSPITALARIA',16),
 ('7.3','registro_invima',NULL,'number',0,'1','empleo_suero',N'Registro INVIMA (solo si 7.1 = Sí)','7','7. ATENCIÓN HOSPITALARIA',17),
 ('7.4','tiempo_accidente_tratamiento',NULL,'number_hrs_min',0,'1','empleo_suero',N'Tiempo transcurrido entre el accidente y el inicio de tratamiento (horas:min, solo si 7.1 = Sí)','7','7. ATENCIÓN HOSPITALARIA',18),
 ('7.5','reacciones_suero','reacciones_suero','select',0,'1','empleo_suero',N'Reacciones a la aplicación del suero (solo si 7.1 = Sí)','7','7. ATENCIÓN HOSPITALARIA',19),
 ('7.6','dosis_suero',NULL,'number',0,'1','empleo_suero',N'Dosis de suero (ampollas, solo si 7.1 = Sí)','7','7. ATENCIÓN HOSPITALARIA',20),
 ('7.7','tiempo_administracion',NULL,'number_hrs_min',0,'1','empleo_suero',N'Tiempo de administración de antiveneno (horas:min, solo si 7.1 = Sí)','7','7. ATENCIÓN HOSPITALARIA',21),
 ('7.8','remitido','si_no','select',1,NULL,NULL,N'¿Remitido a otra institución?','7','7. ATENCIÓN HOSPITALARIA',22);

-- Re-sembrado idempotente (evita choque con UX_detalles_ref al re-ejecutar)
DELETE FROM detalle_eventos WHERE evento_codigo = '101';
DELETE FROM detalle_eventos_respuestas WHERE ref LIKE '101[_]%';

INSERT INTO detalle_eventos (evento_codigo, seccion, subs, numero, ref, tipo, lista_ref, obligatorio, show_if, padre_ref, seccion_label, label, indice)
SELECT '101', d.seccion, NULL, d.numero,
       '101_' + d.slug, d.tipo,
       CASE WHEN d.lista_slug IS NULL THEN NULL ELSE '101_' + d.lista_slug END,
       d.obligatorio, d.show_if,
       CASE WHEN d.padre_slug IS NULL THEN NULL ELSE '101_' + d.padre_slug END,
       d.seccion_label, d.label, d.indice
FROM @defs d;
PRINT 'Preguntas evento 101 (accidentes por animales venenosos) sembradas.';
