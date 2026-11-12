-- ===========================================
-- MIGRACIÓN 045: Ficha colectiva ETA y cólera (evento 349)
-- FOR-R02.4030-058 V:00 2026-08-06 — toda la ficha en p1 (colectiva).
--
-- Fuente: dumps/vision/349_eta_colectivo_2026_vision.txt + instructivo p2-p3.
--
-- Decisiones:
--   - 1.1–1.3 (evento, razón social, código UNM) no se catalogan: se asumen desde
--     el contexto de notificación / caracterización UPGD del aplicativo.
--   - Sección 4: matriz 7 grupos edad × 6 contadores; obligatorio=0 (puede ser 0).
--   - 5.AI: 10 filas alimentos (nombre + enfermos/expuestos); obligatorio=0 en filas.
--   - Catálogo agentes 5.4: campos numéricos (códigos pie de ficha), no lista 86 ítems.
--   - 5.3.1 nombre + 5.3.2 dirección (impreso); instructivo mezcla etiquetas.
--   - Erratas impreso: TRANSMISIÒN, Condicion final — labels en ASCII.
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

DECLARE @slugs TABLE (slug NVARCHAR(60), val NVARCHAR(50), label NVARCHAR(200), ord INT);

INSERT INTO @slugs (slug, val, label, ord) VALUES
 ('si_no','1',N'Sí',1), ('si_no','2',N'No',2),
 ('fuente_tx','1',N'Agua',1),
 ('fuente_tx','2',N'Alimentos',2),
 ('fuente_tx','3',N'Persona a persona',3),
 ('fuente_tx','4',N'Contaminacion medio ambiental',4),
 ('fuente_tx','5',N'Otro diferente de agua y alimento',5),
 ('fuente_tx','6',N'Desconocido',6),
 ('estado_brote','1',N'Abierto',1),
 ('estado_brote','2',N'Cerrado con identificacion del agente',2),
 ('estado_brote','3',N'Cerrado sin identificacion del agente',3),
 ('lugar_cons','1',N'Hogar',1),
 ('lugar_cons','2',N'Establecimiento educativo',2),
 ('lugar_cons','3',N'Establecimiento militar',3),
 ('lugar_cons','4',N'Restaurante',4),
 ('lugar_cons','5',N'Casino',5),
 ('lugar_cons','6',N'Establecimiento penitenciario',6),
 ('lugar_cons','8',N'Hotel',7),
 ('lugar_cons','9',N'Otros',8),
 ('lugar_cons','10',N'Hogar geriatrico',9),
 ('lugar_cons','11',N'Venta ambulante',10),
 ('lugar_cons','12',N'Institucion de salud',11),
 ('lugar_cons','13',N'Panaderia/Pasteleria',12);

DELETE FROM listas WHERE formulario = 'evento_349';
INSERT INTO listas (label, value, ref, formulario, campo, indice)
SELECT s.label, s.val, '349_' + s.slug, 'evento_349', s.slug, s.ord
FROM @slugs s;
PRINT 'Listas evento_349 sembradas.';

DECLARE @defs TABLE (
    numero NVARCHAR(10), subs NVARCHAR(2), slug NVARCHAR(60), lista_slug NVARCHAR(60),
    tipo NVARCHAR(20), obligatorio BIT, show_if NVARCHAR(50), padre_slug NVARCHAR(60),
    label NVARCHAR(200), seccion NVARCHAR(15), seccion_label NVARCHAR(120), indice INT
);

INSERT INTO @defs (numero, subs, slug, lista_slug, tipo, obligatorio, show_if, padre_slug, label, seccion, seccion_label, indice) VALUES
 ('1.4',NULL,'fecha_notificacion',NULL,'date',0,NULL,NULL,N'Fecha de Notificacion (dd/mm/aaaa)','1',N'1. INFORMACION GENERAL',1),
 ('1.5',NULL,'semana_epi',NULL,'number',0,NULL,NULL,N'Semana epidemiologica','1',N'1. INFORMACION GENERAL',2),
 ('1.6',NULL,'anio_epi',NULL,'number',0,NULL,NULL,N'Anio (semana epidemiologica)','1',N'1. INFORMACION GENERAL',3),
 ('1.7',NULL,'depto_procedencia',NULL,'text',0,NULL,NULL,N'Departamento de procedencia (notificacion)','1',N'1. INFORMACION GENERAL',4),
 ('1.7',NULL,'muni_procedencia',NULL,'text',0,NULL,NULL,N'Municipio de procedencia (notificacion)','1',N'1. INFORMACION GENERAL',5),

 ('2',NULL,'fuente_transmision','fuente_tx','select',1,NULL,NULL,N'Fuente de transmision','2',N'2. FUENTE DE TRANSMISION',6),
 ('2.1',NULL,'estado_brote','estado_brote','select',1,NULL,NULL,N'Estado del brote','2',N'2. FUENTE DE TRANSMISION',7),

 ('3.1',NULL,'modo_oral','si_no','select',1,NULL,NULL,N'Modo de transmision — Oral','3',N'3. MODO DE TRANSMISION',8),
 ('3.2',NULL,'modo_oral_fecal','si_no','select',1,NULL,NULL,N'Modo de transmision — Oral fecal','3',N'3. MODO DE TRANSMISION',9),
 ('3.3',NULL,'modo_cruzada','si_no','select',1,NULL,NULL,N'Modo de transmision — Cruzada','3',N'3. MODO DE TRANSMISION',10),

 ('5.1',NULL,'fecha_primer_caso',NULL,'date',0,NULL,NULL,N'Fecha del primer caso (dd/mm/aaaa)','5',N'5. INFORMACION COMPLEMENTARIA',11),

('4','01','char_enf_g01',NULL,'number',0,NULL,NULL,N'Enfermos — grupo edad <1','4',N'4. CARACTERIZACION',20),
 ('4','01','char_exp_g01',NULL,'number',0,NULL,NULL,N'Expuestos — grupo edad <1','4',N'4. CARACTERIZACION',21),
 ('4','01','char_hom_g01',NULL,'number',0,NULL,NULL,N'Hombres — grupo edad <1','4',N'4. CARACTERIZACION',22),
 ('4','01','char_muj_g01',NULL,'number',0,NULL,NULL,N'Mujeres — grupo edad <1','4',N'4. CARACTERIZACION',23),
 ('4','01','char_viv_g01',NULL,'number',0,NULL,NULL,N'Vivos — grupo edad <1','4',N'4. CARACTERIZACION',24),
 ('4','01','char_muer_g01',NULL,'number',0,NULL,NULL,N'Muertos — grupo edad <1','4',N'4. CARACTERIZACION',25),
 ('4','02','char_enf_g02',NULL,'number',0,NULL,NULL,N'Enfermos — grupo edad 1-4 anios','4',N'4. CARACTERIZACION',26),
 ('4','02','char_exp_g02',NULL,'number',0,NULL,NULL,N'Expuestos — grupo edad 1-4 anios','4',N'4. CARACTERIZACION',27),
 ('4','02','char_hom_g02',NULL,'number',0,NULL,NULL,N'Hombres — grupo edad 1-4 anios','4',N'4. CARACTERIZACION',28),
 ('4','02','char_muj_g02',NULL,'number',0,NULL,NULL,N'Mujeres — grupo edad 1-4 anios','4',N'4. CARACTERIZACION',29),
 ('4','02','char_viv_g02',NULL,'number',0,NULL,NULL,N'Vivos — grupo edad 1-4 anios','4',N'4. CARACTERIZACION',30),
 ('4','02','char_muer_g02',NULL,'number',0,NULL,NULL,N'Muertos — grupo edad 1-4 anios','4',N'4. CARACTERIZACION',31),
 ('4','03','char_enf_g03',NULL,'number',0,NULL,NULL,N'Enfermos — grupo edad 5-9 anios','4',N'4. CARACTERIZACION',32),
 ('4','03','char_exp_g03',NULL,'number',0,NULL,NULL,N'Expuestos — grupo edad 5-9 anios','4',N'4. CARACTERIZACION',33),
 ('4','03','char_hom_g03',NULL,'number',0,NULL,NULL,N'Hombres — grupo edad 5-9 anios','4',N'4. CARACTERIZACION',34),
 ('4','03','char_muj_g03',NULL,'number',0,NULL,NULL,N'Mujeres — grupo edad 5-9 anios','4',N'4. CARACTERIZACION',35),
 ('4','03','char_viv_g03',NULL,'number',0,NULL,NULL,N'Vivos — grupo edad 5-9 anios','4',N'4. CARACTERIZACION',36),
 ('4','03','char_muer_g03',NULL,'number',0,NULL,NULL,N'Muertos — grupo edad 5-9 anios','4',N'4. CARACTERIZACION',37),
 ('4','04','char_enf_g04',NULL,'number',0,NULL,NULL,N'Enfermos — grupo edad 10-19 anios','4',N'4. CARACTERIZACION',38),
 ('4','04','char_exp_g04',NULL,'number',0,NULL,NULL,N'Expuestos — grupo edad 10-19 anios','4',N'4. CARACTERIZACION',39),
 ('4','04','char_hom_g04',NULL,'number',0,NULL,NULL,N'Hombres — grupo edad 10-19 anios','4',N'4. CARACTERIZACION',40),
 ('4','04','char_muj_g04',NULL,'number',0,NULL,NULL,N'Mujeres — grupo edad 10-19 anios','4',N'4. CARACTERIZACION',41),
 ('4','04','char_viv_g04',NULL,'number',0,NULL,NULL,N'Vivos — grupo edad 10-19 anios','4',N'4. CARACTERIZACION',42),
 ('4','04','char_muer_g04',NULL,'number',0,NULL,NULL,N'Muertos — grupo edad 10-19 anios','4',N'4. CARACTERIZACION',43),
 ('4','05','char_enf_g05',NULL,'number',0,NULL,NULL,N'Enfermos — grupo edad 20-49 anios','4',N'4. CARACTERIZACION',44),
 ('4','05','char_exp_g05',NULL,'number',0,NULL,NULL,N'Expuestos — grupo edad 20-49 anios','4',N'4. CARACTERIZACION',45),
 ('4','05','char_hom_g05',NULL,'number',0,NULL,NULL,N'Hombres — grupo edad 20-49 anios','4',N'4. CARACTERIZACION',46),
 ('4','05','char_muj_g05',NULL,'number',0,NULL,NULL,N'Mujeres — grupo edad 20-49 anios','4',N'4. CARACTERIZACION',47),
 ('4','05','char_viv_g05',NULL,'number',0,NULL,NULL,N'Vivos — grupo edad 20-49 anios','4',N'4. CARACTERIZACION',48),
 ('4','05','char_muer_g05',NULL,'number',0,NULL,NULL,N'Muertos — grupo edad 20-49 anios','4',N'4. CARACTERIZACION',49),
 ('4','06','char_enf_g06',NULL,'number',0,NULL,NULL,N'Enfermos — grupo edad 50-74 anios','4',N'4. CARACTERIZACION',50),
 ('4','06','char_exp_g06',NULL,'number',0,NULL,NULL,N'Expuestos — grupo edad 50-74 anios','4',N'4. CARACTERIZACION',51),
 ('4','06','char_hom_g06',NULL,'number',0,NULL,NULL,N'Hombres — grupo edad 50-74 anios','4',N'4. CARACTERIZACION',52),
 ('4','06','char_muj_g06',NULL,'number',0,NULL,NULL,N'Mujeres — grupo edad 50-74 anios','4',N'4. CARACTERIZACION',53),
 ('4','06','char_viv_g06',NULL,'number',0,NULL,NULL,N'Vivos — grupo edad 50-74 anios','4',N'4. CARACTERIZACION',54),
 ('4','06','char_muer_g06',NULL,'number',0,NULL,NULL,N'Muertos — grupo edad 50-74 anios','4',N'4. CARACTERIZACION',55),
 ('4','07','char_enf_g07',NULL,'number',0,NULL,NULL,N'Enfermos — grupo edad >=75 anios','4',N'4. CARACTERIZACION',56),
 ('4','07','char_exp_g07',NULL,'number',0,NULL,NULL,N'Expuestos — grupo edad >=75 anios','4',N'4. CARACTERIZACION',57),
 ('4','07','char_hom_g07',NULL,'number',0,NULL,NULL,N'Hombres — grupo edad >=75 anios','4',N'4. CARACTERIZACION',58),
 ('4','07','char_muj_g07',NULL,'number',0,NULL,NULL,N'Mujeres — grupo edad >=75 anios','4',N'4. CARACTERIZACION',59),
 ('4','07','char_viv_g07',NULL,'number',0,NULL,NULL,N'Vivos — grupo edad >=75 anios','4',N'4. CARACTERIZACION',60),
 ('4','07','char_muer_g07',NULL,'number',0,NULL,NULL,N'Muertos — grupo edad >=75 anios','4',N'4. CARACTERIZACION',61),
 ('5.2','01','sint_01',NULL,'number',1,NULL,NULL,N'Ninguna (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',62),
 ('5.2','02','sint_02',NULL,'number',1,NULL,NULL,N'Deshidratacion (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',63),
 ('5.2','03','sint_03',NULL,'number',1,NULL,NULL,N'Parestesias (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',64),
 ('5.2','04','sint_04',NULL,'number',1,NULL,NULL,N'Sialorrea (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',65),
 ('5.2','05','sint_05',NULL,'number',1,NULL,NULL,N'Nauseas (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',66),
 ('5.2','06','sint_06',NULL,'number',1,NULL,NULL,N'Cianosis (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',67),
 ('5.2','07','sint_07',NULL,'number',1,NULL,NULL,N'Ictericia (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',68),
 ('5.2','08','sint_08',NULL,'number',1,NULL,NULL,N'Miosis (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',69),
 ('5.2','09','sint_09',NULL,'number',1,NULL,NULL,N'Vomito (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',70),
 ('5.2','10','sint_10',NULL,'number',1,NULL,NULL,N'Mialgias (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',71),
 ('5.2','11','sint_11',NULL,'number',1,NULL,NULL,N'Acolia (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',72),
 ('5.2','12','sint_12',NULL,'number',1,NULL,NULL,N'Diarrea (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',73),
 ('5.2','13','sint_13',NULL,'number',1,NULL,NULL,N'Artralgias (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',74),
 ('5.2','14','sint_14',NULL,'number',1,NULL,NULL,N'Coluria (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',75),
 ('5.2','15','sint_15',NULL,'number',1,NULL,NULL,N'Fiebre (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',76),
 ('5.2','16','sint_16',NULL,'number',1,NULL,NULL,N'Mareo (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',77),
 ('5.2','17','sint_17',NULL,'number',1,NULL,NULL,N'Lesiones maculopapulares (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',78),
 ('5.2','18','sint_18',NULL,'number',1,NULL,NULL,N'Dolor abdominal (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',79),
 ('5.2','19','sint_19',NULL,'number',1,NULL,NULL,N'Estrenimiento (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',80),
 ('5.2','20','sint_20',NULL,'number',1,NULL,NULL,N'Anorexia (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',81),
 ('5.2','21','sint_21',NULL,'number',1,NULL,NULL,N'Cefalea (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',82),
 ('5.2','22','sint_22',NULL,'number',1,NULL,NULL,N'Escalofrios (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',83),
 ('5.2','23','sint_23',NULL,'number',1,NULL,NULL,N'Bradicardia relativa (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',84),
 ('5.2','24','sint_24',NULL,'number',1,NULL,NULL,N'Otros (numero de casos)','5',N'5. INFORMACION COMPLEMENTARIA',85),
 ('5.AI','01','ali_nom_01',NULL,'text',0,NULL,NULL,N'Alimento implicado — fila 1','5',N'5. INFORMACION COMPLEMENTARIA',86),
 ('5.AI','01','ali_enf_01',NULL,'number',0,NULL,NULL,N'Enfermos — alimento fila 1','5',N'5. INFORMACION COMPLEMENTARIA',87),
 ('5.AI','01','ali_exp_01',NULL,'number',0,NULL,NULL,N'Expuestos — alimento fila 1','5',N'5. INFORMACION COMPLEMENTARIA',88),
 ('5.AI','02','ali_nom_02',NULL,'text',0,NULL,NULL,N'Alimento implicado — fila 2','5',N'5. INFORMACION COMPLEMENTARIA',89),
 ('5.AI','02','ali_enf_02',NULL,'number',0,NULL,NULL,N'Enfermos — alimento fila 2','5',N'5. INFORMACION COMPLEMENTARIA',90),
 ('5.AI','02','ali_exp_02',NULL,'number',0,NULL,NULL,N'Expuestos — alimento fila 2','5',N'5. INFORMACION COMPLEMENTARIA',91),
 ('5.AI','03','ali_nom_03',NULL,'text',0,NULL,NULL,N'Alimento implicado — fila 3','5',N'5. INFORMACION COMPLEMENTARIA',92),
 ('5.AI','03','ali_enf_03',NULL,'number',0,NULL,NULL,N'Enfermos — alimento fila 3','5',N'5. INFORMACION COMPLEMENTARIA',93),
 ('5.AI','03','ali_exp_03',NULL,'number',0,NULL,NULL,N'Expuestos — alimento fila 3','5',N'5. INFORMACION COMPLEMENTARIA',94),
 ('5.AI','04','ali_nom_04',NULL,'text',0,NULL,NULL,N'Alimento implicado — fila 4','5',N'5. INFORMACION COMPLEMENTARIA',95),
 ('5.AI','04','ali_enf_04',NULL,'number',0,NULL,NULL,N'Enfermos — alimento fila 4','5',N'5. INFORMACION COMPLEMENTARIA',96),
 ('5.AI','04','ali_exp_04',NULL,'number',0,NULL,NULL,N'Expuestos — alimento fila 4','5',N'5. INFORMACION COMPLEMENTARIA',97),
 ('5.AI','05','ali_nom_05',NULL,'text',0,NULL,NULL,N'Alimento implicado — fila 5','5',N'5. INFORMACION COMPLEMENTARIA',98),
 ('5.AI','05','ali_enf_05',NULL,'number',0,NULL,NULL,N'Enfermos — alimento fila 5','5',N'5. INFORMACION COMPLEMENTARIA',99),
 ('5.AI','05','ali_exp_05',NULL,'number',0,NULL,NULL,N'Expuestos — alimento fila 5','5',N'5. INFORMACION COMPLEMENTARIA',100),
 ('5.AI','06','ali_nom_06',NULL,'text',0,NULL,NULL,N'Alimento implicado — fila 6','5',N'5. INFORMACION COMPLEMENTARIA',101),
 ('5.AI','06','ali_enf_06',NULL,'number',0,NULL,NULL,N'Enfermos — alimento fila 6','5',N'5. INFORMACION COMPLEMENTARIA',102),
 ('5.AI','06','ali_exp_06',NULL,'number',0,NULL,NULL,N'Expuestos — alimento fila 6','5',N'5. INFORMACION COMPLEMENTARIA',103),
 ('5.AI','07','ali_nom_07',NULL,'text',0,NULL,NULL,N'Alimento implicado — fila 7','5',N'5. INFORMACION COMPLEMENTARIA',104),
 ('5.AI','07','ali_enf_07',NULL,'number',0,NULL,NULL,N'Enfermos — alimento fila 7','5',N'5. INFORMACION COMPLEMENTARIA',105),
 ('5.AI','07','ali_exp_07',NULL,'number',0,NULL,NULL,N'Expuestos — alimento fila 7','5',N'5. INFORMACION COMPLEMENTARIA',106),
 ('5.AI','08','ali_nom_08',NULL,'text',0,NULL,NULL,N'Alimento implicado — fila 8','5',N'5. INFORMACION COMPLEMENTARIA',107),
 ('5.AI','08','ali_enf_08',NULL,'number',0,NULL,NULL,N'Enfermos — alimento fila 8','5',N'5. INFORMACION COMPLEMENTARIA',108),
 ('5.AI','08','ali_exp_08',NULL,'number',0,NULL,NULL,N'Expuestos — alimento fila 8','5',N'5. INFORMACION COMPLEMENTARIA',109),
 ('5.AI','09','ali_nom_09',NULL,'text',0,NULL,NULL,N'Alimento implicado — fila 9','5',N'5. INFORMACION COMPLEMENTARIA',110),
 ('5.AI','09','ali_enf_09',NULL,'number',0,NULL,NULL,N'Enfermos — alimento fila 9','5',N'5. INFORMACION COMPLEMENTARIA',111),
 ('5.AI','09','ali_exp_09',NULL,'number',0,NULL,NULL,N'Expuestos — alimento fila 9','5',N'5. INFORMACION COMPLEMENTARIA',112),
 ('5.AI','10','ali_nom_10',NULL,'text',0,NULL,NULL,N'Alimento implicado — fila 10','5',N'5. INFORMACION COMPLEMENTARIA',113),
 ('5.AI','10','ali_enf_10',NULL,'number',0,NULL,NULL,N'Enfermos — alimento fila 10','5',N'5. INFORMACION COMPLEMENTARIA',114),
 ('5.AI','10','ali_exp_10',NULL,'number',0,NULL,NULL,N'Expuestos — alimento fila 10','5',N'5. INFORMACION COMPLEMENTARIA',115),

 ('5.2','25','sint_otros_cual',NULL,'text',0,NULL,NULL,N'Cuales otros signos/sintomas?','5',N'5. INFORMACION COMPLEMENTARIA',116),

 ('5.3',NULL,'lugar_consumo','lugar_cons','select',1,NULL,NULL,N'Lugar de consumo implicado','5',N'5. INFORMACION COMPLEMENTARIA',117),
 ('5.3.1',NULL,'lugar_nombre',NULL,'text',1,NULL,NULL,N'Nombre del lugar del consumo implicado','5',N'5. INFORMACION COMPLEMENTARIA',118),
 ('5.3.2',NULL,'lugar_direccion',NULL,'text',1,NULL,NULL,N'Direccion del lugar de consumo','5',N'5. INFORMACION COMPLEMENTARIA',119),
 ('5.3',NULL,'lugar_otros_cuales',NULL,'text',1,'9','lugar_consumo',N'Cuales? (lugar Otros)','5',N'5. INFORMACION COMPLEMENTARIA',120),

 ('5.4',NULL,'agente_1',NULL,'number',0,NULL,NULL,N'Agente identificado 1 (codigo pie de ficha)','5',N'5. INFORMACION COMPLEMENTARIA',121),
 ('5.4',NULL,'agente_2',NULL,'number',0,NULL,NULL,N'Agente identificado 2','5',N'5. INFORMACION COMPLEMENTARIA',122),
 ('5.4',NULL,'agente_3',NULL,'number',0,NULL,NULL,N'Agente identificado 3','5',N'5. INFORMACION COMPLEMENTARIA',123),
 ('5.4',NULL,'agente_4',NULL,'number',0,NULL,NULL,N'Agente identificado 4','5',N'5. INFORMACION COMPLEMENTARIA',124),
 ('5.4',NULL,'agente_5',NULL,'number',0,NULL,NULL,N'Agente identificado 5','5',N'5. INFORMACION COMPLEMENTARIA',125);

DELETE FROM detalle_eventos WHERE evento_codigo = '349';
DELETE FROM detalle_eventos_respuestas WHERE ref LIKE '349[_]%';

INSERT INTO detalle_eventos (evento_codigo, seccion, subs, numero, ref, tipo, lista_ref, obligatorio, show_if, padre_ref, seccion_label, label, indice)
SELECT '349', d.seccion, d.subs, d.numero,
       '349_' + d.slug, d.tipo,
       CASE WHEN d.lista_slug IS NULL THEN NULL ELSE '349_' + d.lista_slug END,
       d.obligatorio, d.show_if,
       CASE WHEN d.padre_slug IS NULL THEN NULL ELSE '349_' + d.padre_slug END,
       d.seccion_label, d.label, d.indice
FROM @defs d;
PRINT 'Preguntas evento 349 (ETA colectivo) sembradas.';

SELECT COUNT(*) AS defs_evento_349, SUM(CAST(obligatorio AS INT)) AS obligatorios
FROM detalle_eventos WHERE evento_codigo = '349';
SELECT COUNT(*) AS opciones_349 FROM listas WHERE formulario = 'evento_349';
