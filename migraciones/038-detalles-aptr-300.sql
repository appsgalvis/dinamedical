-- ===========================================
-- MIGRACIÓN 038: Preguntas de la ficha AGRESIONES ANIMALES / APTR
-- (evento 300, FOR-R02.4030-017 V:00 2026-08-06) en el formulario dinámico.
--
-- Fuente: dumps/vision/300_aptr_2026_vision.txt (p2 = formulario) +
-- criterios textuales del instructivo (extracto).
--
-- Decisiones:
--   - OBLIG: 5.1, 5.2, 5.3, 5.4, 5.6, 5.14, 5.15, 5.16, 5.17, 6.1, 6.3, 7.3, 7.4
--     = SI; 5.5, 5.7-5.13, 5.8, 5.9, 5.10, 6.2, 6.4, 6.5, 7.1, 7.2 = NO.
--   - 5.1 multiselect con números verbatim (1,2,3,6,7,8); no se re-numera.
--   - Reglas NO codificables (documentadas en el volcado): área corporal según
--     5.1=1; bloqueo de 5.8/5.9/5.10 según especie (multivalor); 7.1/7.2 según
--     tipo de agresión.
--   - show_if codificables: 6.2 (padre 6.1='1'), 6.4 y 6.5 (padre 6.3='1').
--   - 5.10 depende de 5.7 (Perro/Gato) y 5.8='1' (dos padres) -> no codificable,
--     siempre visible.
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== OPCIONES (listas) para el evento 300 ==========
DECLARE @slugs TABLE (slug NVARCHAR(60), val NVARCHAR(50), label NVARCHAR(150), ord INT);

INSERT INTO @slugs (slug, val, label, ord) VALUES
 ('si_no','1',N'Sí',1), ('si_no','2',N'No',2),
 ('si_no_desconocido','1',N'Sí',1), ('si_no_desconocido','2',N'No',2), ('si_no_desconocido','3',N'Desconocido',3),
 ('si_no_sabe','1',N'Sí',1), ('si_no_sabe','2',N'No',2), ('si_no_sabe','3',N'No sabe',3),
 -- 5.1 tipo de agresión (verbatim, valores 1,2,3,6,7,8)
 ('tipo_agresion','1',N'Mordedura',1),
 ('tipo_agresion','2',N'Arañazo o rasguño',2),
 ('tipo_agresion','3',N'Contacto de mucosa o piel lesionada con saliva infectada con virus rábico',3),
 ('tipo_agresion','6',N'Contacto de mucosa o piel lesionada, con tejido nervioso, material biológico o secreciones infectadas con virus rábico',4),
 ('tipo_agresion','7',N'Inhalación en ambientes cargados con virus rábico (aerosoles)',5),
 ('tipo_agresion','8',N'Trasplante de órganos o tejidos infectados con virus rábico',6),
 -- 5.3 tipo de lesión
 ('tipo_lesion','1',N'Única',1), ('tipo_lesion','2',N'Múltiple',2),
 -- 5.4 profundidad
 ('profundidad','1',N'Superficial',1), ('profundidad','2',N'Profunda',2),
 -- 5.5 localización anatómica (multiselect)
 ('localizacion','1',N'Cabeza, cara, cuello',1), ('localizacion','2',N'Manos, dedos',2),
 ('localizacion','3',N'Tronco',3), ('localizacion','4',N'Miembros superiores',4),
 ('localizacion','5',N'Miembros inferiores',5), ('localizacion','6',N'Pies, dedos',6),
 ('localizacion','7',N'Genitales externos',7),
 -- 5.7 especie agresora (verbatim, con huecos)
 ('especie','1',N'Perro',1), ('especie','2',N'Gato',2), ('especie','3',N'Bovino-Bufalino',3),
 ('especie','4',N'Equidos',4), ('especie','5',N'Porcino (cerdo)',5), ('especie','7',N'Murciélago',6),
 ('especie','8',N'Zorro',7), ('especie','9',N'Mico',8), ('especie','10',N'Humano',9),
 ('especie','12',N'Otros silvestres',10), ('especie','13',N'Ovino-Caprino',11), ('especie','14',N'Grandes roedores',12),
 -- 5.14 estado del animal al momento de la agresión
 ('estado_agresion','1',N'Con signos de rabia',1), ('estado_agresion','2',N'Sin signos de rabia',2), ('estado_agresion','3',N'Desconocido',3),
 -- 5.15 estado del animal al momento de la consulta
 ('estado_consulta','1',N'Vivo',1), ('estado_consulta','2',N'Muerto',2), ('estado_consulta','3',N'Desconocido',3),
 -- 5.16 ubicación del animal agreso
 ('ubicacion','1',N'Observable',1), ('ubicacion','2',N'Perdido',2),
 -- 5.17 tipo de exposición
 ('exposicion','0',N'No exposición',1), ('exposicion','1',N'Exposición leve',2), ('exposicion','2',N'Exposición grave',3);

DELETE FROM listas WHERE formulario = 'evento_300';
INSERT INTO listas (label, value, ref, formulario, campo, indice)
SELECT s.label, s.val, '300_' + s.slug, 'evento_300', s.slug, s.ord
FROM @slugs s;
PRINT 'Listas evento_300 sembradas.';

-- ========== DEFINICIONES DE PREGUNTAS (evento 300) ==========
DECLARE @defs TABLE (
    numero NVARCHAR(10), slug NVARCHAR(60), lista_slug NVARCHAR(60), tipo NVARCHAR(20),
    obligatorio BIT, show_if NVARCHAR(50), padre_slug NVARCHAR(60), label NVARCHAR(200),
    seccion NVARCHAR(15), seccion_label NVARCHAR(120), indice INT
);

INSERT INTO @defs (numero, slug, lista_slug, tipo, obligatorio, show_if, padre_slug, label, seccion, seccion_label, indice) VALUES
 -- 5. DATOS DE LA AGRESIÓN O CONTACTO, DE LA ESPECIE AGRESORA Y DE LA CLASIFICACIÓN DE LA EXPOSICIÓN
 ('5.1','tipo_agresion','tipo_agresion','multiselect',1,NULL,NULL,N'Tipo de agresión o contacto (marque con X)','5','5. DATOS DE LA AGRESIÓN O CONTACTO, DE LA ESPECIE AGRESORA Y DE LA CLASIFICACIÓN DE LA EXPOSICIÓN',1),
 ('5.2','agresion_provocada','si_no','select',1,NULL,NULL,N'¿Agresión provocada?','5','5. DATOS DE LA AGRESIÓN O CONTACTO, DE LA ESPECIE AGRESORA Y DE LA CLASIFICACIÓN DE LA EXPOSICIÓN',2),
 ('5.3','tipo_lesion','tipo_lesion','select',1,NULL,NULL,N'Tipo de lesión','5','5. DATOS DE LA AGRESIÓN O CONTACTO, DE LA ESPECIE AGRESORA Y DE LA CLASIFICACIÓN DE LA EXPOSICIÓN',3),
 ('5.4','profundidad','profundidad','select',1,NULL,NULL,N'Profundidad','5','5. DATOS DE LA AGRESIÓN O CONTACTO, DE LA ESPECIE AGRESORA Y DE LA CLASIFICACIÓN DE LA EXPOSICIÓN',4),
 ('5.5','localizacion','localizacion','multiselect',0,NULL,NULL,N'Localización anatómica de la lesión (señale más de una en caso necesario)','5','5. DATOS DE LA AGRESIÓN O CONTACTO, DE LA ESPECIE AGRESORA Y DE LA CLASIFICACIÓN DE LA EXPOSICIÓN',5),
 ('5.6','fecha_agresion',NULL,'date',1,NULL,NULL,N'Fecha de la agresión o contacto','5','5. DATOS DE LA AGRESIÓN O CONTACTO, DE LA ESPECIE AGRESORA Y DE LA CLASIFICACIÓN DE LA EXPOSICIÓN',6),
 ('5.7','especie','especie','select',0,NULL,NULL,N'Especie agresora (solo Perro/Gato activan 5.8-5.10, no codificable)','5','5. DATOS DE LA AGRESIÓN O CONTACTO, DE LA ESPECIE AGRESORA Y DE LA CLASIFICACIÓN DE LA EXPOSICIÓN',7),
 ('5.8','animal_vacunado','si_no_desconocido','select',0,NULL,NULL,N'Animal vacunado (solo aplica si especie = Perro o Gato)','5','5. DATOS DE LA AGRESIÓN O CONTACTO, DE LA ESPECIE AGRESORA Y DE LA CLASIFICACIÓN DE LA EXPOSICIÓN',8),
 ('5.9','carne_antirrabica','si_no','select',0,NULL,NULL,N'¿Presentó carné de vacunación antirrábica? (solo Perro/Gato)','5','5. DATOS DE LA AGRESIÓN O CONTACTO, DE LA ESPECIE AGRESORA Y DE LA CLASIFICACIÓN DE LA EXPOSICIÓN',9),
 ('5.10','fecha_vacunacion',NULL,'date',0,NULL,NULL,N'Fecha de vacunación (solo Perro/Gato y animal vacunado)','5','5. DATOS DE LA AGRESIÓN O CONTACTO, DE LA ESPECIE AGRESORA Y DE LA CLASIFICACIÓN DE LA EXPOSICIÓN',10),
 ('5.11','nombre_propietario',NULL,'text',0,NULL,NULL,N'Nombre del propietario o responsable del agresor','5','5. DATOS DE LA AGRESIÓN O CONTACTO, DE LA ESPECIE AGRESORA Y DE LA CLASIFICACIÓN DE LA EXPOSICIÓN',11),
 ('5.12','direccion_propietario',NULL,'text',0,NULL,NULL,N'Dirección del propietario o responsable del agresor','5','5. DATOS DE LA AGRESIÓN O CONTACTO, DE LA ESPECIE AGRESORA Y DE LA CLASIFICACIÓN DE LA EXPOSICIÓN',12),
 ('5.13','telefono_propietario',NULL,'text',0,NULL,NULL,N'Teléfono del propietario','5','5. DATOS DE LA AGRESIÓN O CONTACTO, DE LA ESPECIE AGRESORA Y DE LA CLASIFICACIÓN DE LA EXPOSICIÓN',13),
 ('5.14','estado_animal_agresion','estado_agresion','select',1,NULL,NULL,N'Estado del animal al momento de la agresión o contacto','5','5. DATOS DE LA AGRESIÓN O CONTACTO, DE LA ESPECIE AGRESORA Y DE LA CLASIFICACIÓN DE LA EXPOSICIÓN',14),
 ('5.15','estado_animal_consulta','estado_consulta','select',1,NULL,NULL,N'Estado del animal al momento de la consulta','5','5. DATOS DE LA AGRESIÓN O CONTACTO, DE LA ESPECIE AGRESORA Y DE LA CLASIFICACIÓN DE LA EXPOSICIÓN',15),
 ('5.16','ubicacion_animal','ubicacion','select',1,NULL,NULL,N'Ubicación del animal agreso','5','5. DATOS DE LA AGRESIÓN O CONTACTO, DE LA ESPECIE AGRESORA Y DE LA CLASIFICACIÓN DE LA EXPOSICIÓN',16),
 ('5.17','tipo_exposicion','exposicion','select',1,NULL,NULL,N'Tipo de exposición','5','5. DATOS DE LA AGRESIÓN O CONTACTO, DE LA ESPECIE AGRESORA Y DE LA CLASIFICACIÓN DE LA EXPOSICIÓN',17),

 -- 6. ANTECEDENTES DE INMUNIZACIÓN DEL PACIENTE
 ('6.1','suero','si_no_sabe','select',1,NULL,NULL,N'Suero antirrábico (antes de la consulta actual)','6','6. ANTECEDENTES DE INMUNIZACIÓN DEL PACIENTE',18),
 ('6.2','fecha_aplicacion_suero',NULL,'date',0,'1','suero',N'Fecha de aplicación (solo si recibió suero)','6','6. ANTECEDENTES DE INMUNIZACIÓN DEL PACIENTE',19),
 ('6.3','vacuna','si_no_sabe','select',1,NULL,NULL,N'Vacuna antirrábica (antes de la consulta actual)','6','6. ANTECEDENTES DE INMUNIZACIÓN DEL PACIENTE',20),
 ('6.4','numero_dosis',NULL,'number',0,'1','vacuna',N'Número de dosis (solo si recibió vacuna)','6','6. ANTECEDENTES DE INMUNIZACIÓN DEL PACIENTE',21),
 ('6.5','fecha_ultima_dosis',NULL,'date',0,'1','vacuna',N'Fecha de última dosis (solo si recibió vacuna)','6','6. ANTECEDENTES DE INMUNIZACIÓN DEL PACIENTE',22),

 -- 7. DATOS DEL TRATAMIENTO ORDENADO EN LA ACTUALIDAD
 ('7.1','lavado_herida','si_no','select',0,NULL,NULL,N'¿Lavado de herida con agua y jabón? (solo mordedura/arañazo/rasguño, no codificable)','7','7. DATOS DEL TRATAMIENTO ORDENADO EN LA ACTUALIDAD',23),
 ('7.2','sutura','si_no','select',0,NULL,NULL,N'¿Sutura de la herida?','7','7. DATOS DEL TRATAMIENTO ORDENADO EN LA ACTUALIDAD',24),
 ('7.3','ordeno_suero','si_no','select',1,NULL,NULL,N'¿Ordenó suero antirrábico?','7','7. DATOS DEL TRATAMIENTO ORDENADO EN LA ACTUALIDAD',25),
 ('7.4','ordeno_vacuna','si_no','select',1,NULL,NULL,N'¿Ordenó aplicación vacuna?','7','7. DATOS DEL TRATAMIENTO ORDENADO EN LA ACTUALIDAD',26);

-- Re-sembrado idempotente
DELETE FROM detalle_eventos WHERE evento_codigo = '300';
DELETE FROM detalle_eventos_respuestas WHERE ref LIKE '300[_]%';

INSERT INTO detalle_eventos (evento_codigo, seccion, subs, numero, ref, tipo, lista_ref, obligatorio, show_if, padre_ref, seccion_label, label, indice)
SELECT '300', d.seccion, NULL, d.numero,
       '300_' + d.slug, d.tipo,
       CASE WHEN d.lista_slug IS NULL THEN NULL ELSE '300_' + d.lista_slug END,
       d.obligatorio, d.show_if,
       CASE WHEN d.padre_slug IS NULL THEN NULL ELSE '300_' + d.padre_slug END,
       d.seccion_label, d.label, d.indice
FROM @defs d;
PRINT 'Preguntas evento 300 (APTR) sembradas.';
