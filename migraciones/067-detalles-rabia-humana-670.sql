-- ===========================================
-- MIGRACIÓN 067: Rabia humana (evento 670)
-- FOR-R02.4030-042 V:00 2026-08-06 — complementarios p2.
--
-- Fuente: dumps/vision/670_rabia_humana_2026_vision.txt + instructivo p6-p8.
--
-- Decisiones:
--   - 5.1.1 area: show_if solo 5.1='1' (motor); aplica tambien a 2 arañazo (documentado).
--   - 5.8-5.10 vacunacion: visibles siempre; etiqueta indica perro/gato (5.7=1|2).
--   - 5.11-5.13 propietario NO oblig (instructivo p7).
--   - 8.x signos: multiselect sin oblig (instructivo sin bloqueo).
--   - 9.x: show_if hay_info_lab='1'; seccion 9 completa condicionada.
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

DECLARE @slugs TABLE (slug NVARCHAR(60), val NVARCHAR(50), label NVARCHAR(150), ord INT);

INSERT INTO @slugs (slug, val, label, ord) VALUES
 ('si_no','1',N'Sí',1), ('si_no','2',N'No',2),
 ('si_no_desc','1',N'Sí',1), ('si_no_desc','2',N'No',2), ('si_no_desc','3',N'Desconocido',3),
 ('si_no_ns','1',N'Sí',1), ('si_no_ns','2',N'No',2), ('si_no_ns','3',N'No sabe',3),
 ('tipo_agresion','1',N'Mordedura',1),('tipo_agresion','2',N'Arañazo o rasguño',2),
 ('tipo_agresion','3',N'Contacto mucosa/piel lesionada con saliva o baba infectada',3),
 ('tipo_agresion','6',N'Contacto mucosa/piel con tejido nervioso o secreciones infectadas',4),
 ('tipo_agresion','7',N'Inhalación en ambientes con virus rábico (aerosoles)',5),
 ('tipo_agresion','8',N'Trasplante de órganos o tejidos infectados',6),
 ('area_mordedura','1',N'En área cubierta del cuerpo',1),('area_mordedura','2',N'En área descubierta del cuerpo',2),
 ('tipo_lesion_rab','1',N'Única',1),('tipo_lesion_rab','2',N'Múltiple',2),
 ('profundidad_lesion','1',N'Superficial',1),('profundidad_lesion','2',N'Profunda',2),
 ('localizacion_lesion','1',N'Cabeza, cara, cuello',1),('localizacion_lesion','2',N'Manos, dedos',2),
 ('localizacion_lesion','3',N'Tronco',3),('localizacion_lesion','4',N'Miembros superiores',4),
 ('localizacion_lesion','5',N'Miembros inferiores',5),('localizacion_lesion','6',N'Pies, dedos',6),
 ('localizacion_lesion','7',N'Genitales externos',7),
 ('especie_agresora','1',N'Perro',1),('especie_agresora','2',N'Gato',2),('especie_agresora','3',N'Bovino - Bufalino',3),
 ('especie_agresora','4',N'Équidos',4),('especie_agresora','5',N'Porcino (cerdo)',5),('especie_agresora','7',N'Murciélago',6),
 ('especie_agresora','8',N'Zorro',7),('especie_agresora','9',N'Mico',8),('especie_agresora','10',N'Humano',9),
 ('especie_agresora','12',N'Otros silvestres',10),('especie_agresora','13',N'Ovino-Caprino',11),('especie_agresora','14',N'Grandes roedores',12),
 ('estado_animal_agresion','1',N'Con signos de rabia',1),('estado_animal_agresion','2',N'Sin signos de rabia',2),('estado_animal_agresion','3',N'Desconocido',3),
 ('estado_animal_consulta','1',N'Vivo',1),('estado_animal_consulta','2',N'Muerto',2),('estado_animal_consulta','3',N'Desconocido',3),
 ('ubicacion_animal','1',N'Observable',1),('ubicacion_animal','2',N'Perdido',2),
 ('signos_rabia','1',N'Fiebre',1),('signos_rabia','2',N'Hiperoxia',2),('signos_rabia','3',N'Paresias',3),('signos_rabia','4',N'Odinofagia',4),
 ('signos_rabia','5',N'Arreflexia',5),('signos_rabia','6',N'Aerofobia',6),('signos_rabia','7',N'Hiperexit',7),
 ('signos_rabia','8',N'Cefalea',8),('signos_rabia','9',N'Fascies',9),('signos_rabia','10',N'Paralisis',10),
 ('signos_rabia','11',N'Vomito',11),('signos_rabia','12',N'Sialorrea',12),('signos_rabia','13',N'Convulsión',13),
 ('signos_rabia','14',N'Parestesia',14),('signos_rabia','15',N'Hidrofobia',15),('signos_rabia','16',N'Crisis respiratoria',16),
 ('signos_rabia','17',N'Alucinación',17),('signos_rabia','18',N'Tranquilidad /excitación',18),('signos_rabia','19',N'Depresión',19),
 ('signos_rabia','20',N'Agresividad',20),('signos_rabia','21',N'Disfagia',21),('signos_rabia','22',N'Coma',22),('signos_rabia','23',N'Paro respiratorio',23),
 ('hay_laboratorio','1',N'Sí hay información de laboratorio',1),('hay_laboratorio','2',N'No hay información de laboratorio',2),
 ('prueba_diag_rab','1',N'IFD',1),('prueba_diag_rab','2',N'Prueba Biológica',2),('prueba_diag_rab','3',N'Histopatología',3),
 ('prueba_diag_rab','4',N'Inmunohistoquímica',4),('prueba_diag_rab','5',N'Titulación anticuerpos antirrábicos',5),
 ('resultado_lab','1',N'Positivo',1),('resultado_lab','2',N'Negativo',2),('resultado_lab','3',N'Pendiente',3),
 ('id_variante','1',N'Sí',1),('id_variante','2',N'No',2),('id_variante','3',N'Pendiente',3),
 ('variante_rab','0',N'Otro',1),('variante_rab','1',N'Uno',2),('variante_rab','3',N'Tres',3),('variante_rab','4',N'Cuatro',4),
 ('variante_rab','5',N'Cinco',5),('variante_rab','8',N'Ocho',6),('variante_rab','9',N'Atípica',7);

DELETE FROM listas WHERE formulario = 'evento_670';
INSERT INTO listas (label, value, ref, formulario, campo, indice)
SELECT s.label, s.val, '670_' + s.slug, 'evento_670', s.slug, s.ord
FROM @slugs s;
PRINT 'Listas evento_670 sembradas.';

DECLARE @defs TABLE (
    numero NVARCHAR(10), subs NVARCHAR(2), slug NVARCHAR(60), lista_slug NVARCHAR(60),
    tipo NVARCHAR(20), obligatorio BIT, show_if NVARCHAR(50), padre_slug NVARCHAR(60),
    label NVARCHAR(200), seccion NVARCHAR(15), seccion_label NVARCHAR(120), indice INT
);

INSERT INTO @defs (numero, subs, slug, lista_slug, tipo, obligatorio, show_if, padre_slug, label, seccion, seccion_label, indice) VALUES
 ('5.1',NULL,'tipo_agresion','tipo_agresion','select',1,NULL,NULL,N'Tipo de agresión o contacto','5',N'5. DATOS DE LA AGRESION O CONTACTO',1),
 ('5.1.1',NULL,'area_mordedura','area_mordedura','select',1,'1','tipo_agresion',N'Si marcó mordedura/arañazo: área cubierta o descubierta','5',N'5. DATOS DE LA AGRESION O CONTACTO',2),
 ('5.2',NULL,'agresion_provocada','si_no','select',1,NULL,NULL,N'¿Agresión provocada?','5',N'5. DATOS DE LA AGRESION O CONTACTO',3),
 ('5.3',NULL,'tipo_lesion','tipo_lesion_rab','select',1,NULL,NULL,N'Tipo de lesión','5',N'5. DATOS DE LA AGRESION O CONTACTO',4),
 ('5.4',NULL,'profundidad_lesion','profundidad_lesion','select',1,NULL,NULL,N'Profundidad','5',N'5. DATOS DE LA AGRESION O CONTACTO',5),
 ('5.5',NULL,'localizacion_lesion','localizacion_lesion','multiselect',1,NULL,NULL,N'Localización anatómica de la lesión','5',N'5. DATOS DE LA AGRESION O CONTACTO',6),
 ('5.6',NULL,'fecha_agresion',NULL,'date',1,NULL,NULL,N'Fecha de la agresión o contacto (dd/mm/aaaa)','5',N'5. DATOS DE LA AGRESION O CONTACTO',7),
 ('5.7',NULL,'especie_agresora','especie_agresora','select',1,NULL,NULL,N'Especie agresora','5',N'5. DATOS DE LA AGRESION O CONTACTO',8),
 ('5.8',NULL,'animal_vacunado','si_no_desc','select',0,NULL,NULL,N'Animal vacunado (perro o gato)','5',N'5. DATOS DE LA AGRESION O CONTACTO',9),
 ('5.9',NULL,'carne_vacunacion','si_no','select',0,NULL,NULL,N'¿Presentó carné de vacunación antirrábica? (perro o gato)','5',N'5. DATOS DE LA AGRESION O CONTACTO',10),
 ('5.10',NULL,'fecha_vacuna_animal',NULL,'date',0,'1','animal_vacunado',N'Fecha de vacunación animal (dd/mm/aaaa)','5',N'5. DATOS DE LA AGRESION O CONTACTO',11),
 ('5.11',NULL,'propietario_nombre',NULL,'text',0,NULL,NULL,N'Nombre del propietario o responsable del agresor','5',N'5. DATOS DE LA AGRESION O CONTACTO',12),
 ('5.12',NULL,'propietario_direccion',NULL,'text',0,NULL,NULL,N'Dirección del propietario o responsable del agresor','5',N'5. DATOS DE LA AGRESION O CONTACTO',13),
 ('5.13',NULL,'propietario_telefono',NULL,'text',0,NULL,NULL,N'Teléfono del propietario o responsable','5',N'5. DATOS DE LA AGRESION O CONTACTO',14),
 ('5.14',NULL,'estado_animal_agresion','estado_animal_agresion','select',1,NULL,NULL,N'Estado del animal al momento de la agresión o contacto','5',N'5. DATOS DE LA AGRESION O CONTACTO',15),
 ('5.15',NULL,'estado_animal_consulta','estado_animal_consulta','select',1,NULL,NULL,N'Estado del animal al momento de la consulta','5',N'5. DATOS DE LA AGRESION O CONTACTO',16),
 ('5.16',NULL,'ubicacion_animal','ubicacion_animal','select',1,NULL,NULL,N'Ubicación del animal agresor','5',N'5. DATOS DE LA AGRESION O CONTACTO',17),

 ('6.1',NULL,'suero_previo','si_no_ns','select',1,NULL,NULL,N'Suero antirrábico (antes de la consulta actual)','6',N'6. ANTECEDENTES DE INMUNIZACION DEL PACIENTE',18),
 ('6.2',NULL,'fecha_suero_previo',NULL,'date',1,'1','suero_previo',N'Fecha de aplicación del suero (dd/mm/aaaa)','6',N'6. ANTECEDENTES DE INMUNIZACION DEL PACIENTE',19),
 ('6.3',NULL,'vacuna_previa','si_no_ns','select',1,NULL,NULL,N'Vacuna antirrábica (antes de la consulta actual)','6',N'6. ANTECEDENTES DE INMUNIZACION DEL PACIENTE',20),
 ('6.4',NULL,'dosis_vacuna_previa',NULL,'number',1,'1','vacuna_previa',N'Número de dosis de vacuna antirrábica','6',N'6. ANTECEDENTES DE INMUNIZACION DEL PACIENTE',21),
 ('6.5',NULL,'fecha_ultima_dosis',NULL,'date',1,'1','vacuna_previa',N'Fecha de última dosis (dd/mm/aaaa)','6',N'6. ANTECEDENTES DE INMUNIZACION DEL PACIENTE',22),

 ('7.1',NULL,'ordeno_suero','si_no','select',1,NULL,NULL,N'¿Ordenó suero antirrábico?','7',N'7. DATOS DEL TRATAMIENTO ORDENADO EN LA ACTUALIDAD',23),
 ('7.2',NULL,'ordeno_vacuna','si_no','select',1,NULL,NULL,N'¿Ordenó aplicación vacuna?','7',N'7. DATOS DEL TRATAMIENTO ORDENADO EN LA ACTUALIDAD',24),
 ('7.3',NULL,'ordeno_otros_med','si_no','select',1,NULL,NULL,N'¿Ordenó aplicación otros medicamentos?','7',N'7. DATOS DEL TRATAMIENTO ORDENADO EN LA ACTUALIDAD',25),

 ('8',NULL,'signos_clinicos','signos_rabia','multiselect',0,NULL,NULL,N'Datos clínicos — signos y síntomas','8',N'8. DATOS CLINICOS',26),

 ('9.1',NULL,'hay_laboratorio','hay_laboratorio','select',1,NULL,NULL,N'¿Información de laboratorio?','9',N'9. DATOS DE LABORATORIO',27),
 ('9.2',NULL,'prueba_diagnostica','prueba_diag_rab','multiselect',1,'1','hay_laboratorio',N'Prueba diagnóstica','9',N'9. DATOS DE LABORATORIO',28),
 ('9.3',NULL,'resultado_lab','resultado_lab','select',1,'1','hay_laboratorio',N'Resultado','9',N'9. DATOS DE LABORATORIO',29),
 ('9.4',NULL,'identifica_variante','id_variante','select',1,'1','hay_laboratorio',N'Identificación a variante','9',N'9. DATOS DE LABORATORIO',30),
 ('9.5',NULL,'variante_identificada','variante_rab','select',1,'1','hay_laboratorio',N'Variante identificada','9',N'9. DATOS DE LABORATORIO',31),
 ('9.5.1',NULL,'variante_otra',NULL,'text',1,'0','variante_identificada',N'Otra ¿Cuál?','9',N'9. DATOS DE LABORATORIO',32),
 ('9.6',NULL,'fecha_resultado_lab',NULL,'date',1,'1','hay_laboratorio',N'Fecha Resultado (dd/mm/aaaa)','9',N'9. DATOS DE LABORATORIO',33);

DELETE FROM detalle_eventos WHERE evento_codigo = '670';
DELETE FROM detalle_eventos_respuestas WHERE ref LIKE '670[_]%';

INSERT INTO detalle_eventos (evento_codigo, seccion, subs, numero, ref, tipo, lista_ref, obligatorio, show_if, padre_ref, seccion_label, label, indice)
SELECT '670', d.seccion, d.subs, d.numero,
       '670_' + d.slug, d.tipo,
       CASE WHEN d.lista_slug IS NULL THEN NULL ELSE '670_' + d.lista_slug END,
       d.obligatorio, d.show_if,
       CASE WHEN d.padre_slug IS NULL THEN NULL ELSE '670_' + d.padre_slug END,
       d.seccion_label, d.label, d.indice
FROM @defs d;
PRINT 'Preguntas evento 670 (Rabia humana) sembradas.';

SELECT COUNT(*) AS defs_evento_670, SUM(CAST(obligatorio AS INT)) AS obligatorios
FROM detalle_eventos WHERE evento_codigo = '670';
SELECT COUNT(*) AS opciones_670 FROM listas WHERE formulario = 'evento_670';
