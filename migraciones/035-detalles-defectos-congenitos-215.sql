-- ===========================================
-- MIGRACIÓN 035: Preguntas de la ficha DEFECTOS CONGÉNITOS
-- (evento 215, FOR-R02.4030-014 V:00 2026-08-06) en el formulario dinámico.
--
-- Fuente: dumps/vision/215_defectos_congenitos_2026_vision.txt (p2 = formulario)
-- + criterios textuales del instructivo (extracto; columna OBLIG desordenada ->
-- se aplican criterios por entrada).
--
-- Decisiones:
--   - OBLIG: 5.1-5.5 SI, 5.5.1 NO, 5.6 NO, 6.1 SI, 6.2-6.5 NO, 7.1.1 SI (primer
--     defecto), 7.2.1 SI, 7.2.2 NO, 7.3.x NO, 8.1 SI, 8.2.x SI, 8.3.x NO.
--   - show_if codificables: 5.5.1 (padre 5.5='1', Prenatal), 5.6.1 (padre 5.6='1').
--   - 6.2 Nativivo depende de Condición final (datos básicos) -> no codificable.
--   - 8.3.x dependen de "si se realizó ALGUNO de los exámenes" (plural) -> no
--     codificable como show_if.
--   - Unidades fijas (grs, cm) se consignan en el label; tipo = number.
--   - Grupo de defectos (7.1/7.2/7.3): se catalogan solo los campos de
--     descripción, tal como la ficha.
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== OPCIONES (listas) para el evento 215 ==========
DECLARE @slugs TABLE (slug NVARCHAR(60), val NVARCHAR(50), label NVARCHAR(150), ord INT);

INSERT INTO @slugs (slug, val, label, ord) VALUES
 ('si_no','1',N'Sí',1), ('si_no','2',N'No',2),
 ('diagnostico','1',N'Prenatal',1), ('diagnostico','2',N'Postnatal',2),
 ('nativivo','1',N'Sí',1), ('nativivo','2',N'No',2), ('nativivo','3',N'No ha nacido',3),
 ('res_tsh','1',N'Alto',1), ('res_tsh','3',N'Normal',2),
 ('res_t4','2',N'Bajo',1), ('res_t4','3',N'Normal',2);

DELETE FROM listas WHERE formulario = 'evento_215';
INSERT INTO listas (label, value, ref, formulario, campo, indice)
SELECT s.label, s.val, '215_' + s.slug, 'evento_215', s.slug, s.ord
FROM @slugs s;
PRINT 'Listas evento_215 sembradas.';

-- ========== DEFINICIONES DE PREGUNTAS (evento 215) ==========
DECLARE @defs TABLE (
    numero NVARCHAR(10), slug NVARCHAR(60), lista_slug NVARCHAR(60), tipo NVARCHAR(20),
    obligatorio BIT, show_if NVARCHAR(50), padre_slug NVARCHAR(60), label NVARCHAR(200),
    seccion NVARCHAR(15), seccion_label NVARCHAR(120), indice INT
);

INSERT INTO @defs (numero, slug, lista_slug, tipo, obligatorio, show_if, padre_slug, label, seccion, seccion_label, indice) VALUES
 -- 5. INFORMACIÓN MATERNA
 ('5.1','numero_embarazos',NULL,'number',1,NULL,NULL,N'Número de embarazos totales (rango 1-30)','5','5. INFORMACIÓN MATERNA',1),
 ('5.2','nacidos_vivos',NULL,'number',1,NULL,NULL,N'Nacidos vivos (rango 0-20)','5','5. INFORMACIÓN MATERNA',2),
 ('5.3','abortos',NULL,'number',1,NULL,NULL,N'Abortos (menores de 22 semanas o 500 g)','5','5. INFORMACIÓN MATERNA',3),
 ('5.4','mortinatos',NULL,'number',1,NULL,NULL,N'Mortinatos (22 semanas o 500 g o más)','5','5. INFORMACIÓN MATERNA',4),
 ('5.5','diagnostico','diagnostico','select',1,NULL,NULL,N'Diagnóstico (1 Prenatal, 2 Postnatal)','5','5. INFORMACIÓN MATERNA',5),
 ('5.5.1','edad_gestacional_diag',NULL,'number',0,'1','diagnostico',N'Edad gestacional al diagnóstico (semanas; solo si 5.5 = Prenatal)','5','5. INFORMACIÓN MATERNA',6),
 ('5.6','patologia','si_no','select',0,NULL,NULL,N'Patología crónica adicional o complicaciones durante el embarazo','5','5. INFORMACIÓN MATERNA',7),
 ('5.6.1','patologia_cuales',NULL,'text',0,'1','patologia',N'¿Cuáles? (solo si hubo patología)','5','5. INFORMACIÓN MATERNA',8),

 -- 6. INFORMACIÓN COMPLEMENTARIA DEL NIÑO
 ('6.1','embarazo_multiple','si_no','select',1,NULL,NULL,N'¿Embarazo múltiple?','6','6. INFORMACIÓN COMPLEMENTARIA DEL NIÑO',9),
 ('6.2','nativivo','nativivo','select',0,NULL,NULL,N'Nativivo (depende de Condición final = Vivo en datos básicos)','6','6. INFORMACIÓN COMPLEMENTARIA DEL NIÑO',10),
 ('6.3','edad_gestacional_nacimiento',NULL,'number',0,NULL,NULL,N'Edad gestacional al nacimiento (rango 10-45 semanas)','6','6. INFORMACIÓN COMPLEMENTARIA DEL NIÑO',11),
 ('6.4','peso_nacer',NULL,'number',0,NULL,NULL,N'Peso al nacer (gramos, rango 50-6000)','6','6. INFORMACIÓN COMPLEMENTARIA DEL NIÑO',12),
 ('6.5','perimetro_cefalico',NULL,'number',0,NULL,NULL,N'Perímetro cefálico al nacer (cm)','6','6. INFORMACIÓN COMPLEMENTARIA DEL NIÑO',13),

 -- 7. DEFECTOS CONGÉNITOS
 ('7.1.1','desc_metabolico1',NULL,'text',1,NULL,NULL,N'7.1 Descripción defecto metabólico (obligatorio al menos un defecto)','7','7. DEFECTOS CONGÉNITOS',14),
 ('7.2.1','desc_sensorial1',NULL,'text',1,NULL,NULL,N'7.2 Descripción defecto sensorial (obligatorio el primero)','7','7. DEFECTOS CONGÉNITOS',15),
 ('7.2.2','desc_sensorial2',NULL,'text',0,NULL,NULL,N'7.2 Descripción defecto sensorial (segundo)','7','7. DEFECTOS CONGÉNITOS',16),
 ('7.3.1','desc_malformacion1',NULL,'text',0,NULL,NULL,N'Descripción malformación 1 (orden de gravedad)','7','7. DEFECTOS CONGÉNITOS',17),
 ('7.3.2','desc_malformacion2',NULL,'text',0,NULL,NULL,N'Descripción malformación 2','7','7. DEFECTOS CONGÉNITOS',18),
 ('7.3.3','desc_malformacion3',NULL,'text',0,NULL,NULL,N'Descripción malformación 3','7','7. DEFECTOS CONGÉNITOS',19),
 ('7.3.4','desc_malformacion4',NULL,'text',0,NULL,NULL,N'Descripción malformación 4','7','7. DEFECTOS CONGÉNITOS',20),
 ('7.3.5','desc_malformacion5',NULL,'text',0,NULL,NULL,N'Descripción malformación 5','7','7. DEFECTOS CONGÉNITOS',21),

 -- 8. DATOS DE LABORATORIO
 ('8.1','storch','si_no','select',1,NULL,NULL,N'STORCH en recién nacido (marque con X)','8','8. DATOS DE LABORATORIO',22),
 ('8.2.1','tsh_realizado','si_no','select',1,NULL,NULL,N'8.2 ¿Se realizó TSH?','8','8. DATOS DE LABORATORIO',23),
 ('8.2.2','t4_total_realizado','si_no','select',1,NULL,NULL,N'8.2 ¿Se realizó T4 Total suero?','8','8. DATOS DE LABORATORIO',24),
 ('8.2.3','t4_libre_realizado','si_no','select',1,NULL,NULL,N'8.2 ¿Se realizó T4 libre suero?','8','8. DATOS DE LABORATORIO',25),
 ('8.3.1','tsh_resultado','res_tsh','select',0,NULL,NULL,N'8.3 Resultado TSH (1 Alto, 3 Normal)','8','8. DATOS DE LABORATORIO',26),
 ('8.3.2','t4_total_resultado','res_t4','select',0,NULL,NULL,N'8.3 Resultado T4 Total suero (2 Bajo, 3 Normal)','8','8. DATOS DE LABORATORIO',27),
 ('8.3.3','t4_libre_resultado','res_t4','select',0,NULL,NULL,N'8.3 Resultado T4 Libre suero (2 Bajo, 3 Normal)','8','8. DATOS DE LABORATORIO',28);

-- Re-sembrado idempotente
DELETE FROM detalle_eventos WHERE evento_codigo = '215';
DELETE FROM detalle_eventos_respuestas WHERE ref LIKE '215[_]%';

INSERT INTO detalle_eventos (evento_codigo, seccion, subs, numero, ref, tipo, lista_ref, obligatorio, show_if, padre_ref, seccion_label, label, indice)
SELECT '215', d.seccion, NULL, d.numero,
       '215_' + d.slug, d.tipo,
       CASE WHEN d.lista_slug IS NULL THEN NULL ELSE '215_' + d.lista_slug END,
       d.obligatorio, d.show_if,
       CASE WHEN d.padre_slug IS NULL THEN NULL ELSE '215_' + d.padre_slug END,
       d.seccion_label, d.label, d.indice
FROM @defs d;
PRINT 'Preguntas evento 215 (defectos congénitos) sembradas.';
