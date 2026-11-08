-- ===========================================
-- MIGRACIÓN 033: Preguntas de la ficha CÓLERA
-- (evento 200, FOR-R02.4030-011 V:00 2026-08-06) en el formulario dinámico.
--
-- Fuente: dumps/vision/200_colera_2026_vision.txt
-- (página 2 = formulario, verificada con visión; OBLIG confirmado visualmente
--  en la tabla de instructivo p6).
--
-- Secciones sembradas: solo DATOS COMPLEMENTARIOS (5-7). Las secciones 1-4
-- (datos básicos) ya viven en ficha_datos_basicos.
--
-- Decisiones:
--   - Los bloques de viaje de 5.1 (País/Departamento/Municipio + fechas, hasta 6
--     bloques si 5.1 = Sí) no son codificables como preguntas; se cataloga solo
--     5.1 (select Sí/No). Documentado en el volcado de visión.
--   - Regla codificable: 5.2.1 ¿Con quién? -> show_if='1',
--     padre_ref='200_contacto_sintomaticos'.
--   - OBLIG confirmado con visión p6: 5.1 SI, 5.2 SI, 5.2.1 NO, 6.1 SI, 6.2 SI,
--     7.1 NO.
--   - 7.1 valores según códigos SICRO/INS impresos en p2 (errata del instructivo
--     p6, que muestra subnumeros 1, 2, 78, 79, 77 y menciona la opción 85 "Otras"
--     del sistema; prioridad a la forma impresa).
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== OPCIONES (listas) para el evento 200 ==========
DECLARE @slugs TABLE (slug NVARCHAR(60), val NVARCHAR(50), label NVARCHAR(150), ord INT);

INSERT INTO @slugs (slug, val, label, ord) VALUES
 -- Sí / No (5.1, 5.2, 6.1)
 ('si_no','1',N'Sí',1), ('si_no','2',N'No',2),
 -- 6.2 Caso captado por
 ('captado_por','1',N'UPGD',1),
 ('captado_por','2',N'Búsqueda activa institucional',2),
 ('captado_por','3',N'Vigilancia intensificada',3),
 ('captado_por','4',N'Búsqueda activa comunitaria',4),
 -- 7.1 Agente identificado (códigos tal como imprime p2)
 ('agente_identificado','10',N'Vibrio cholerae',1),
 ('agente_identificado','17',N'Vibrio spp',2),
 ('agente_identificado','80',N'Vibrio cholerae O1 toxigénico',3),
 ('agente_identificado','81',N'Vibrio cholerae O1 no toxigénico',4),
 ('agente_identificado','82',N'Vibrio cholerae no O1, no O139 toxigénico',5),
 ('agente_identificado','83',N'Vibrio cholerae no O1, no O139 no toxigénico',6),
 ('agente_identificado','84',N'Vibrio cholerae O139',7),
 ('agente_identificado','78',N'Pendiente',8),
 ('agente_identificado','79',N'No detectado',9),
 ('agente_identificado','77',N'Otro',10);

DELETE FROM listas WHERE formulario = 'evento_200';
INSERT INTO listas (label, value, ref, formulario, campo, indice)
SELECT s.label, s.val, '200_' + s.slug, 'evento_200', s.slug, s.ord
FROM @slugs s;
PRINT 'Listas evento_200 sembradas.';

-- ========== DEFINICIONES DE PREGUNTAS (evento 200) ==========
DECLARE @defs TABLE (
    numero NVARCHAR(10), slug NVARCHAR(60), lista_slug NVARCHAR(60), tipo NVARCHAR(20),
    obligatorio BIT, show_if NVARCHAR(50), padre_slug NVARCHAR(60), label NVARCHAR(200),
    seccion NVARCHAR(15), seccion_label NVARCHAR(120), indice INT
);

INSERT INTO @defs (numero, slug, lista_slug, tipo, obligatorio, show_if, padre_slug, label, seccion, seccion_label, indice) VALUES
 -- 5. DATOS DE DESPLAZAMIENTO Y CONTACTOS
 ('5.1','desplazamiento','si_no','select',1,NULL,NULL,N'Desplazamiento en los últimos cinco días','5','5. DATOS DE DESPLAZAMIENTO Y CONTACTOS',1),
 ('5.2','contacto_sintomaticos','si_no','select',1,NULL,NULL,N'¿Ha estado en contacto con personas que presenten los mismos signos y síntomas?','5','5. DATOS DE DESPLAZAMIENTO Y CONTACTOS',2),
 ('5.2.1','contacto_con_quien',NULL,'text',0,'1','contacto_sintomaticos',N'5.2.1 ¿Con quién? (solo si 5.2 = Sí)','5','5. DATOS DE DESPLAZAMIENTO Y CONTACTOS',3),

 -- 6. ASOCIACIÓN CON BROTE
 ('6.1','asociado_brote','si_no','select',1,NULL,NULL,N'¿Caso asociado a un brote?','6','6. ASOCIACIÓN CON BROTE',4),
 ('6.2','caso_captado_por','captado_por','select',1,NULL,NULL,N'Caso captado por','6','6. ASOCIACIÓN CON BROTE',5),

 -- 7. LABORATORIO
 ('7.1','agente_identificado','agente_identificado','select',0,NULL,NULL,N'Agente identificado','7','7. LABORATORIO',6);

-- Re-sembrado idempotente (evita choque con UX_detalles_ref al re-ejecutar)
DELETE FROM detalle_eventos WHERE evento_codigo = '200';
DELETE FROM detalle_eventos_respuestas WHERE ref LIKE '200[_]%';

INSERT INTO detalle_eventos (evento_codigo, seccion, subs, numero, ref, tipo, lista_ref, obligatorio, show_if, padre_ref, seccion_label, label, indice)
SELECT '200', d.seccion, NULL, d.numero,
       '200_' + d.slug, d.tipo,
       CASE WHEN d.lista_slug IS NULL THEN NULL ELSE '200_' + d.lista_slug END,
       d.obligatorio, d.show_if,
       CASE WHEN d.padre_slug IS NULL THEN NULL ELSE '200_' + d.padre_slug END,
       d.seccion_label, d.label, d.indice
FROM @defs d;
PRINT 'Preguntas evento 200 (cólera) sembradas.';
