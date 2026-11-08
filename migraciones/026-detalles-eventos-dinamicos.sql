-- ===========================================
-- MIGRACIÓN 026: Detalles de eventos dinámicos (fichas SIVIGILA por evento)
-- Catálogo de preguntas por evento + respuestas por consulta.
-- Preguntas solo del evento 100 (Accidente Ofídico) por ahora.
-- Cada pregunta se identifica con ref = '100_<slug>' (slug corta, apto para JSON).
-- Las opciones provienen de la tabla `listas` con formulario='evento_100' y
-- ref = '100_<slug>' (ref en detalles = lista en listas, editable desde catálogo).
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== TABLA DETALLE_EVENTOS (catálogo de preguntas) ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'detalle_eventos')
BEGIN
    CREATE TABLE detalle_eventos (
        id INT IDENTITY(1,1) PRIMARY KEY,
        evento_codigo NVARCHAR(10) NOT NULL,
        seccion NVARCHAR(15) NOT NULL,          -- '5','6','7'
        subs NVARCHAR(2) NULL,                  -- 'A','B' (ej. 7A tratamiento específico)
        numero NVARCHAR(10) NOT NULL,           -- '5.3' Número de variable en ficha impresa
        ref NVARCHAR(120) NOT NULL,             -- '100_actividad_accidente'
        tipo NVARCHAR(20) NOT NULL DEFAULT 'select',  -- select, multiselect, date, text, number, number_unit, number_hrs_min
        -- ref de la tabla listas para las respuestas posibles de la pregunta
        lista_ref NVARCHAR(60) NULL,
        obligatorio BIT NOT NULL DEFAULT 0,
        show_if NVARCHAR(50) NULL,              -- valor de la pregunta padre que habilita esta (ej. '70'=Otro)
        padre_ref NVARCHAR(120) NULL,
        activo BIT NOT NULL DEFAULT 1,
        seccion_label NVARCHAR(120) NULL,       -- usado para agrupar en UI
        label NVARCHAR(80) NULL,                -- texto de la pregunta como en la ficha
        indice INT NOT NULL DEFAULT 0,
        creado_en DATETIME2 DEFAULT GETDATE()
    );

    CREATE INDEX IX_detalles_evento ON detalle_eventos(evento_codigo, seccion, indice);
    CREATE UNIQUE INDEX UX_detalles_ref ON detalle_eventos(ref);
    PRINT 'Tabla detalle_eventos creada.';
END
GO

-- ========== TABLA DETALLE_EVENTOS_RESPUESTAS ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'detalle_eventos_respuestas')
BEGIN
    CREATE TABLE detalle_eventos_respuestas (
        id INT IDENTITY(1,1) PRIMARY KEY,
        consulta_id INT NOT NULL,
        ref NVARCHAR(120) NOT NULL,             -- detalle_eventos.ref
        valor NVARCHAR(MAX) NULL,               -- multiselect usa JSON array: ["3","70"]
        actualizado_en DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT UX_resp_consulta_ref UNIQUE (consulta_id, ref)
    );
    PRINT 'Tabla detalle_eventos_respuestas creada.';
END
GO

-- ========== LISTAS: respuestas posibles para preguntas con opciones ==========
-- Se usan desde el catálogo de listas UI; ref = '100_<slug>', form = 'evento_100'.

DECLARE @slugs TABLE (slug NVARCHAR(60), val NVARCHAR(50), label NVARCHAR(80), ord INT);

INSERT INTO @slugs (slug, val, label, ord) VALUES
 -- 5.7, 5.8, 7.1, 7.8, 7.9 (Sí/No)
 ('si_no','1','Sí',1), ('si_no','2','No',2),
 -- 5.3 Actividad que realizaba
 ('actividad_accidente','1','Recreación',1),
 ('actividad_accidente','2','Actividad agrícola',2),
 ('actividad_accidente','3','Oficios domésticos',3),
 ('actividad_accidente','5','Recolección de desechos',4),
 ('actividad_accidente','6','Actividad acuática',5),
 ('actividad_accidente','8','Caminar por senderos abiertos o trocha',6),
 ('actividad_accidente','70','Otro',7),
 -- 5.4 Tipo de atención inicial
 ('atencion_inicial','1','Incisión',1),
 ('atencion_inicial','2','Punción',2),
 ('atencion_inicial','3','Sangría',3),
 ('atencion_inicial','4','Torniquete',4),
 ('atencion_inicial','5','Inmovilización del enfermo',5),
 ('atencion_inicial','6','Inmovilización del miembro',6),
 ('atencion_inicial','7','Succión bucal',7),
 ('atencion_inicial','8','Succión mecánica',8),
 ('atencion_inicial','10','Otro',10),
 -- 5.5 Prácticas no médicas
 ('practicas_no_medicas','1','Pócimas',1),
 ('practicas_no_medicas','2','Rezos',2),
 ('practicas_no_medicas','3','Emplastos de hierbas',3),
 ('practicas_no_medicas','4','Ninguno',4),
 ('practicas_no_medicas','5','Otro',5),
 -- 5.6 Localización de la mordedura
 ('localizacion_mordedura','1','Cabeza (cara)',1),
 ('localizacion_mordedura','2','Miembros superiores',2),
 ('localizacion_mordedura','3','Miembros inferiores',3),
 ('localizacion_mordedura','4','Tórax anterior',4),
 ('localizacion_mordedura','5','Abdomen',5),
 ('localizacion_mordedura','6','Espalda',6),
 ('localizacion_mordedura','7','Cuello',7),
 ('localizacion_mordedura','8','Tórax posterior',8),
 ('localizacion_mordedura','9','Genitales',9),
 ('localizacion_mordedura','10','Glúteos',10),
 ('localizacion_mordedura','11','Dedos de pie y de mano',11),
 ('localizacion_mordedura','12','Dedos de mano',12),
 ('localizacion_mordedura','13','Otro',13),
 -- 5.9 ¿Se capturó la serpiente?
 ('capturo_serpiente','1','Serpiente',1),
 ('capturo_serpiente','2','No capturó',2),
 -- 5.10 Agente agresor, identificación género
 ('genero_agresor','1','Bothrops',1),
 ('genero_agresor','2','Crotalus',2),
 ('genero_agresor','3','Micrurus',3),
 ('genero_agresor','4','Lachesis',4),
 ('genero_agresor','7','Pelamis (serpiente de mar)',5),
 ('genero_agresor','8','Colubrido',6),
 ('genero_agresor','9','Sin identificar',7),
 ('genero_agresor','70','Otro',10),
 -- 5.11 Agente agresor, nombre común
 ('nombre_comun_agresor','1','Mapaná',1),
 ('nombre_comun_agresor','2','Equis',2),
 ('nombre_comun_agresor','3','Cuatro narices',3),
 ('nombre_comun_agresor','4','Cabeza de candado',4),
 ('nombre_comun_agresor','5','Rabo de chucha',5),
 ('nombre_comun_agresor','6','Verrugosa o riecka',6),
 ('nombre_comun_agresor','7','Víbora de pestaña',7),
 ('nombre_comun_agresor','8','Rabo de ají',8),
 ('nombre_comun_agresor','9','Veintricuatro',9),
 ('nombre_comun_agresor','10','Jergón',10),
 ('nombre_comun_agresor','11','Jararacá',11),
 ('nombre_comun_agresor','12','Cascabel',12),
 ('nombre_comun_agresor','13','Coral',13),
 ('nombre_comun_agresor','14','Boca dorada',14),
 ('nombre_comun_agresor','16','Patoco/patoquilla',15),
 ('nombre_comun_agresor','17','Desconocido',16),
 ('nombre_comun_agresor','15','Otro',20),
 -- 6.1 Manifestaciones locales
 ('manilocales','1','Edema',1),
 ('manilocales','2','Dolor',2),
 ('manilocales','3','Eritema',3),
 ('manilocales','4','Flictenas',4),
 ('manilocales','5','Parestesias/hipoestesias',5),
 ('manilocales','6','Equimosis',6),
 ('manilocales','7','Hematomas',7),
 ('manilocales','10','Otro',10),
 -- 6.2 Manifestaciones sistémicas
 ('manilosist','1','Náusea',1),
 ('manilosist','2','Hipotensión',2),
 ('manilosist','3','Debilidad muscular',3),
 ('manilosist','4','Hematemesis',4),
 ('manilosist','5','Dificultad para hablar',5),
 ('manilosist','6','Vómito',6),
 ('manilosist','7','Dolor abdominal',7),
 ('manilosist','8','Oliguria',8),
 ('manilosist','9','Hematuria',9),
 ('manilosist','10','Disfagia',10),
 ('manilosist','10','Sialorrea',11),
 ('manilosist','12','Fascies neurotóxica',12),
 ('manilosist','13','Cianosis',13),
 ('manilosist','14','Hematoquexia',14),
 ('manilosist','15','Otro',15),
 ('manilosist','16','Diarrea',16),
 ('manilosist','17','Alteraciones de la visión',17),
 ('manilosist','18','Epistaxis',18),
 ('manilosist','19','Vértigo',19),
 ('manilosist','20','Bradicardia',20),
 ('manilosist','21','Alteración sensorial',21),
 ('manilosist','22','Gingivorragia',22),
 ('manilosist','23','Ptosis palpebral',23),
 -- 6.3 Complicaciones locales
 ('complecal','1','Anemia aguda severa',1),
 ('complecal','2','Síndrome compartimental',2),
 ('complecal','3','Celulitis',3),
 ('complecal','4','Absceso',4),
 ('complecal','5','Necrosis',5),
 ('complecal','6','Mionecrosis',6),
 ('complecal','7','Fasceitis',7),
 ('complecal','8','Alteraciones en la circulación/perfusión',8),
 ('complecal','10','Otro',10),
 -- 6.4 Complicaciones sistémicas
 ('compersist','1','Anemia aguda severa',1),  -- duplicado en UI local; se mantiene
 ('compersist','2','Shock hipovolémico',2),
 ('compersist','3','Shock séptico',3),
 ('compersist','4','IRA',4),
 ('compersist','5','CID',5),
 ('compersist','10','Otro',10),
 ('compersist','11','Hemorragia intracraneana',11),
 ('compersist','12','Edema cerebral',12),
 ('compersist','13','Falla ventilatoria',13),
 ('compersist','14','Coma',14),
 -- 6.5 Gravedad del accidente
 ('gravedad','1','Leve',1),
 ('gravedad','2','Moderado',2),
 ('gravedad','3','Grave',3),
 ('gravedad','4','No envenenamiento',4),
 -- 7.3 Tipo de suero antiofídico
 ('tipo_suero','1','Antiviperídico (Bothrops, Lachesis, Crotalus)',1),
 ('tipo_suero','2','Anti-elapidídico (Micrurus sp: coral verdadera)',2),
 -- 7.4 Fabricante
 ('fabricante_suero','1','Probiol',1),
 ('fabricante_suero','2','Bioclon',2),
 ('fabricante_suero','3','INS (Instituto Nacional de Salud)',3),
 ('fabricante_suero','4','Otro',4),
 -- 7.5 Reacciones a la aplicación del suero
 ('reaccion_suero','1','Ninguna',1),
 ('reaccion_suero','2','Localizada',2),
 ('reaccion_suero','3','Generalizada',3),
 -- 7.2 Unidad tiempo transcurrido (Horas/Días)
 ('td_horas_dias','H','Horas',1),
 ('td_horas_dias','D','Días',2),
 -- 7.10 Tipo de tratamiento quirúrgico
 ('tipo_cirugia','1','Drenaje de absceso',1),
 ('tipo_cirugia','2','Limpieza quirúrgica',2),
 ('tipo_cirugia','3','Desbridamiento',3),
 ('tipo_cirugia','4','Fasciotomía',4),
 ('tipo_cirugia','5','Injerto de piel',5),
 ('tipo_cirugia','6','Amputación',6);

-- Re-sembrado idempotente (arregla mojibake de acentos al re-ejecutar con encoding UTF-8)
DELETE FROM listas WHERE formulario = 'evento_100';
INSERT INTO listas (label, value, ref, formulario, campo, indice)
SELECT s.label, s.val, '100_' + s.slug, 'evento_100', s.slug, s.ord
FROM @slugs s;
PRINT 'Listas evento_100 (re)sembradas.';
GO

-- ========== DEFINICIONES DE PREGUNTAS (evento 100) ==========
DECLARE @defs TABLE (
    seccion NVARCHAR(15), subs NVARCHAR(2), numero NVARCHAR(10), slug NVARCHAR(60),
    tipo NVARCHAR(20), obligatorio BIT, show_if NVARCHAR(50), padre_slug NVARCHAR(60),
    label NVARCHAR(80), indice INT
);

-- Códigos 'Otro' canónicos (deben coincidir con el valor 'Otro' de cada lista evento_100):
--   actividad=70, atencion=10, practicas=5, localizacion=13, genero=70, nombre_comun=15,
--   manilocales=10, manilosist=15, complecal=10, compersist=10, fabricante=4
INSERT INTO @defs (seccion, subs, numero, slug, tipo, obligatorio, show_if, padre_slug, label, indice) VALUES
 ('5',NULL,'5.1','fecha_accidente','date',1,NULL,NULL,'Fecha del accidente',1),
 ('5',NULL,'5.2','direccion_lugar','text',1,NULL,NULL,'Dirección del lugar donde ocurrió el accidente',2),
 ('5',NULL,'5.3','actividad_accidente','select',1,NULL,NULL,'Actividad que realizaba al momento del accidente',3),
 ('5',NULL,'5.3','cual_actividad','text',0,'70','actividad_accidente','¿Cuál otro?',4),

 ('5',NULL,'5.4','atencion_inicial','select',1,NULL,NULL,'Tipo de atención inicial',5),
 ('5',NULL,'5.4','cual_atencion','text',0,'10','atencion_inicial','¿Cuál otro?',6),

 ('5',NULL,'5.5','practicas_no_medicas','select',1,NULL,NULL,'¿La persona fue sometida a prácticas no médicas?',7),
 ('5',NULL,'5.5','cual_practicas','text',0,'5','practicas_no_medicas','¿Cuál otro?',8),

 ('5',NULL,'5.6','localizacion_mordedura','select',1,NULL,NULL,'Localización de la mordedura',9),
 ('5',NULL,'5.7','huellas_colmillos','select',1,NULL,NULL,'¿Hay evidencia de huellas de colmillos?',10),
 ('5',NULL,'5.8','vio_serpiente','select',1,NULL,NULL,'¿La persona vio la serpiente que la mordió?',11),
 ('5',NULL,'5.9','capturo_serpiente','select',1,NULL,NULL,'¿Se capturó la serpiente?',12),

 ('5',NULL,'5.10','genero_agresor','select',1,NULL,NULL,'Agente agresor, identificación género',13),
 ('5',NULL,'5.10','cual_genero','text',0,'70','genero_agresor','¿Cuál?',14),
 ('5',NULL,'5.11','nombre_comun_agresor','select',1,NULL,NULL,'Agente agresor, nombre común',15),
 ('5',NULL,'5.11','cual_nombre_comun','text',0,'15','nombre_comun_agresor','¿Cuál otro?',16),

 ('6',NULL,'6.1','manilocales','multiselect',1,NULL,NULL,'Manifestaciones locales (marque las que se presenten)',17),
 ('6',NULL,'6.1','manilocales_otro','text',0,'10','manilocales','¿Cuál otro?',18),
 ('6',NULL,'6.2','manilosist','multiselect',1,NULL,NULL,'Manifestaciones sistémicas (marque las que se presenten)',19),
 ('6',NULL,'6.2','manilosist_otro','text',0,'15','manilosist','¿Cuál otro?',20),
 ('6',NULL,'6.3','complecal','multiselect',1,NULL,NULL,'Complicaciones locales (marque las que se presenten)',21),
 ('6',NULL,'6.3','complecal_otro','text',0,'10','complecal','¿Cuál otro?',22),
 ('6',NULL,'6.4','compersist','multiselect',1,NULL,NULL,'Complicaciones sistémicas (marque las que se presenten)',23),
 ('6',NULL,'6.4','compersist_otro','text',0,'10','compersist','¿Cuál otro?',24),
 ('6',NULL,'6.5','gravedad','select',1,NULL,NULL,'Gravedad del accidente',25),

 ('7','A','7.1','empleo_suero','select',1,NULL,NULL,'¿Empleó Suero?',26),
 ('7','A','7.2','tiempo_transcurrido','number_unit',0,'1','empleo_suero','Tiempo transcurrido (días u horas)',27),
 ('7','A','7.3','tipo_suero','select',0,'1','empleo_suero','Tipo de suero antiofídico',28),
 ('7','A','7.4','fabricante_suero','select',0,'1','empleo_suero','Fabricante',29),
 ('7','A','7.4','fabricante_otro','text',0,'4','fabricante_suero','¿Cuál?',30),
 ('7','A','7.4','lote_suero','text',0,'1','empleo_suero','Lote',31),
 ('7','A','7.5','reaccion_suero','select',0,'1','empleo_suero','Reacciones a la aplicación del suero',32),
 ('7','A','7.6','dosis_suero','number',0,'1','empleo_suero','Dosis de suero (ampollas)',33),
 ('7','A','7.7','tiempo_admin_suero','number_hrs_min',0,'1','empleo_suero','Tiempo de administración de suero',34),
 ('7','B','7.8','remitido','select',1,NULL,NULL,'¿Remitido a otra institución?',35),
 ('7','B','7.9','cirugia','select',1,NULL,NULL,'Tratamiento quirúrgico',36),
 ('7','B','7.10','tipo_cirugia','multiselect',0,'1','cirugia','Tipo de tratamiento quirúrgico',37);

IF NOT EXISTS (SELECT 1 FROM detalle_eventos WHERE evento_codigo = '100')
BEGIN
    INSERT INTO detalle_eventos (evento_codigo, seccion, subs, numero, ref, tipo, lista_ref, obligatorio, show_if, padre_ref, seccion_label, label, indice)
    SELECT '100', d.seccion, d.subs, d.numero, '100_' + d.slug, d.tipo,
           CASE WHEN d.tipo IN ('select','multiselect','number_unit') THEN '100_' +
                CASE WHEN d.slug IN ('huellas_colmillos','vio_serpiente','empleo_suero','remitido','cirugia') THEN 'si_no' ELSE d.slug END
           ELSE NULL END, d.obligatorio, d.show_if,
           CASE WHEN d.padre_slug IS NULL THEN NULL ELSE '100_' + d.padre_slug END,
           CASE d.seccion WHEN '5' THEN 'DATOS DEL ACCIDENTE'
                          WHEN '6' THEN 'CUADRO CLÍNICO'
                          WHEN '7' THEN CASE d.subs WHEN 'A' THEN 'ATENCIÓN HOSPITALARIA — Tratamiento específico (suero antiofídico)'
                                                    WHEN 'B' THEN 'ATENCIÓN HOSPITALARIA — Otros tratamientos médicos'
                                                    ELSE 'ATENCIÓN HOSPITALARIA' END
           END,
           d.label,
           d.indice
    FROM @defs d;
    PRINT 'Preguntas evento 100 sembradas.';
END

-- Re-ejecucable: agrega label a tablas existentes y rellena para defs sembradas (mismo batch que @defs)
IF COL_LENGTH('detalle_eventos', 'label') IS NULL
    ALTER TABLE detalle_eventos ADD label NVARCHAR(80);
UPDATE e SET label = d.label
FROM detalle_eventos e JOIN @defs d ON e.ref = '100_' + d.slug
WHERE e.evento_codigo = '100';
-- Reparar defs Sí/No que apuntaban a grupos inexistentes (bug: slug propio vs grupo compartido si_no)
UPDATE detalle_eventos SET lista_ref = '100_si_no'
WHERE evento_codigo = '100' AND ref IN ('100_huellas_colmillos','100_vio_serpiente','100_empleo_suero','100_remitido','100_cirugia');
-- Reparar mojibake de seccion_label.insertado en corridas antiguas con encoding ANSI
UPDATE e SET seccion_label = CASE d.seccion
    WHEN N'5' THEN N'DATOS DEL ACCIDENTE'
    WHEN N'6' THEN N'CUADRO CLÍNICO'
    WHEN N'7' THEN CASE d.subs
        WHEN N'A' THEN N'ATENCIÓN HOSPITALARIA — Tratamiento específico (suero antiofídico)'
        WHEN N'B' THEN N'ATENCIÓN HOSPITALARIA — Otros tratamientos médicos'
        ELSE N'ATENCIÓN HOSPITALARIA' END
    END
FROM detalle_eventos e JOIN @defs d ON e.ref = '100_' + d.slug
WHERE e.evento_codigo = '100';
GO

-- ========== VINCULACIÓN DIRECTA (permite leer respuestas sin pasar por consultas) ==========
IF COL_LENGTH('detalle_eventos_respuestas', 'persona_id') IS NULL
    ALTER TABLE detalle_eventos_respuestas ADD persona_id INT NULL, profesional_usuario_id INT NULL, ficha_id INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_der_persona')
    ALTER TABLE detalle_eventos_respuestas ADD CONSTRAINT FK_der_persona FOREIGN KEY (persona_id) REFERENCES personas(id_persona);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_der_usuario')
    ALTER TABLE detalle_eventos_respuestas ADD CONSTRAINT FK_der_usuario FOREIGN KEY (profesional_usuario_id) REFERENCES usuarios(id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_der_ficha')
    ALTER TABLE detalle_eventos_respuestas ADD CONSTRAINT FK_der_ficha FOREIGN KEY (ficha_id) REFERENCES ficha_datos_basicos(id);

-- Sellar filas existentes desde su consulta (INSERT nuevos los recibe desde la ruta)
UPDATE r SET r.persona_id = c.paciente_persona_id, r.profesional_usuario_id = c.profesional_usuario_id, r.ficha_id = f.id
FROM detalle_eventos_respuestas r
JOIN consultas c ON c.id = r.consulta_id
LEFT JOIN ficha_datos_basicos f ON f.consulta_id = c.id;

PRINT 'Migración 026 completada.';
