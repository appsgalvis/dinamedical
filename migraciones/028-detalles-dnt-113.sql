-- ===========================================
-- MIGRACIÓN 028: Preguntas de la ficha DESNUTRICIÓN AGUDA EN MENORES DE 5 AÑOS
-- (evento 113, FOR-R02.4030-007 V:00 2026-08-06) en el formulario dinámico.
--
-- Fuente: dinamedical/fichas/dumps/113_dnt_5_2026_dump.txt (página 2 = formulario,
-- página 6 = instructivo con criterios de sistematización y OBLIG).
--
-- Secciones sembradas: solo los DATOS COMPLEMENTARIOS (5-8). Las secciones 1-4
-- (datos básicos) ya viven en ficha_datos_basicos.
--
-- Regla dinámica única (del instructivo):
--   6.8.1 Referido por carné (opcional, OBLIG=NO) depende de la respuesta de la
--   pregunta 6.8 (¿Esquema de vacunación completo?). El instructivo dice literalmente
--   "depende de la respuesta en variable 6.7", pero 6.7 es "¿Asiste a valoración
--   integral?" y el carné corresponde a 6.8; se codificó con padre_ref = 6.8 y
--   show_if = '1' (mostrar cuando la respuesta del padre es Sí), decisión confirmada.
--
-- Erratas de la ficha impresa (se resuelven con los números del instructivo):
--   - La pregunta de diagnóstico está numerada '7.6' en el impreso pero 7.7 en el
--     instructivo (7.6 = Palidez palmar). Se usa 7.7.
--   - El impreso repite '8.2' para Escenario y Prescripción; el instructivo numera
--     8.1 Escenario de manejo y 8.2 Prescripción. Se usan 8.1 y 8.2.
--
-- Obligatorio según columna OBLIG del instructivo. Rango de valores admitidos
-- (instructivo, anotado en comentarios):
--   6.1 g 900-5000, 6.2 cm 30-55, 6.3 semanas 20-45, 6.4 meses 0-6, 6.5 meses 6-24,
--   6.9 kg 1-50, 6.10 cm 45-150 (el PDF dice "hasta 50", probable errata),
--   6.11 cm 6-30 (obligatoria de 6 a 59 meses), 6.12 aplica mayores de 6 meses.
-- 8.3 Diagnóstico médico: el sistema ofrece tabla de referencia CIE10; se cataloga
-- como texto (la tabla no vive en `listas`).
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== OPCIONES (listas) para el evento 113 ==========
DECLARE @slugs TABLE (slug NVARCHAR(60), val NVARCHAR(50), label NVARCHAR(150), ord INT);

INSERT INTO @slugs (slug, val, label, ord) VALUES
 -- Sí / No (dicotómicas 5.x, 6.7, 6.8.1, 7.1-7.6)
 ('si_no','1',N'Sí',1), ('si_no','2',N'No',2),
 -- 6.8 Esquema de vacunación (Sí / No / Desconocido)
 ('si_no_desconocido','1',N'Sí',1), ('si_no_desconocido','2',N'No',2), ('si_no_desconocido','3',N'Desconocido',3),
 -- 5.5 Tipo de ID (códigos del impreso)
 ('tipo_id','RC',N'Registro Civil',1),
 ('tipo_id','TI',N'Tarjeta de Identidad',2),
 ('tipo_id','CC',N'Cédula de Ciudadanía',3),
 ('tipo_id','CE',N'Cédula de Extranjería',4),
 ('tipo_id','PA',N'Pasaporte',5),
 ('tipo_id','MS',N'Menor sin identificación',6),
 ('tipo_id','AS',N'Adulto sin identificación',7),
 ('tipo_id','PE',N'Permiso Especial de Permanencia',8),
 ('tipo_id','PT',N'Permiso por Protección Temporal',9),
 -- 5.7 Nivel educativo
 ('nivel_educativo','1',N'Primaria',1),
 ('nivel_educativo','2',N'Secundaría',2),
 ('nivel_educativo','3',N'Técnica',3),
 ('nivel_educativo','4',N'Universitaria',4),
 ('nivel_educativo','5',N'Ninguno',5),
 -- 6.12 Prueba de apetito
 ('prueba_apetito','1',N'Positiva',1),
 ('prueba_apetito','2',N'Negativa',2),
 ('prueba_apetito','3',N'No se realizó',3),
 -- 7.7 Manifestaciones clínicas de DAS
 ('diagnostico_clinico','1',N'Marasmo',1),
 ('diagnostico_clinico','2',N'Kwashiorkor',2),
 ('diagnostico_clinico','3',N'Marasmo-kwashiorkor',3),
 ('diagnostico_clinico','4',N'Ninguna de las anteriores',4),
 -- 8.1 Escenario de manejo
 ('escenario_manejo','1',N'Hospitalaria',1),
 ('escenario_manejo','2',N'Ambulatoria',2),
 -- 8.2 Prescripción de productos
 ('prescripcion_productos','1',N'FTLC',1),
 ('prescripcion_productos','2',N'F75',2);

DELETE FROM listas WHERE formulario = 'evento_113';
INSERT INTO listas (label, value, ref, formulario, campo, indice)
SELECT s.label, s.val, '113_' + s.slug, 'evento_113', s.slug, s.ord
FROM @slugs s;
PRINT 'Listas evento_113 sembradas.';

-- ========== DEFINICIONES DE PREGUNTAS (evento 113) ==========
DECLARE @defs TABLE (
    numero NVARCHAR(10), slug NVARCHAR(60), lista_slug NVARCHAR(60), tipo NVARCHAR(20),
    obligatorio BIT, show_if NVARCHAR(50), padre_slug NVARCHAR(60), label NVARCHAR(200),
    seccion NVARCHAR(15), seccion_label NVARCHAR(120), indice INT
);

INSERT INTO @defs (numero, slug, lista_slug, tipo, obligatorio, show_if, padre_slug, label, seccion, seccion_label, indice) VALUES
 -- 5. DATOS DE LA MADRE O CUIDADOR
 ('5.1','primer_nombre',NULL,'text',1,NULL,NULL,N'Primer nombre de la madre o cuidador','5','5. DATOS DE LA MADRE O CUIDADOR',1),
 ('5.2','segundo_nombre',NULL,'text',1,NULL,NULL,N'Segundo nombre de la madre o cuidador','5','5. DATOS DE LA MADRE O CUIDADOR',2),
 ('5.3','primer_apellido',NULL,'text',1,NULL,NULL,N'Primer apellido de la madre o cuidador','5','5. DATOS DE LA MADRE O CUIDADOR',3),
 ('5.4','segundo_apellido',NULL,'text',1,NULL,NULL,N'Segundo apellido de la madre o cuidador','5','5. DATOS DE LA MADRE O CUIDADOR',4),
 ('5.5','tipo_id','tipo_id','select',1,NULL,NULL,N'Tipo de identificación de la madre o cuidador','5','5. DATOS DE LA MADRE O CUIDADOR',5),
 ('5.6','numero_identificacion',NULL,'text',1,NULL,NULL,N'Número de identificación de la madre o cuidador','5','5. DATOS DE LA MADRE O CUIDADOR',6),
 ('5.7','nivel_educativo','nivel_educativo','select',1,NULL,NULL,N'Nivel educativo de la madre o cuidador','5','5. DATOS DE LA MADRE O CUIDADOR',7),
 ('5.8','hijos_menores_de_5',NULL,'number',1,NULL,NULL,N'Número de hijos menores de 5 años (incluido el menor notificado)','5','5. DATOS DE LA MADRE O CUIDADOR',8),

 -- 6. IDENTIFICACIÓN DE FACTORES
 ('6.1','peso_nacer',NULL,'number',0,NULL,NULL,N'Peso al nacer (g, 900-5000)','6','6. IDENTIFICACIÓN DE FACTORES',9),
 ('6.2','talla_nacer',NULL,'number',0,NULL,NULL,N'Talla al nacer (cm, 30-55)','6','6. IDENTIFICACIÓN DE FACTORES',10),
 ('6.3','edad_gestacional',NULL,'number',0,NULL,NULL,N'Edad gestacional al nacer (semanas, 20-45)','6','6. IDENTIFICACIÓN DE FACTORES',11),
 ('6.4','lactancia_exclusiva',NULL,'number',0,NULL,NULL,N'Tiempo de lactancia materna exclusiva (meses, 0-6)','6','6. IDENTIFICACIÓN DE FACTORES',12),
 ('6.5','lactancia_total',NULL,'number',0,NULL,NULL,N'Tiempo de suministro de lactancia materna total (meses, 6-24)','6','6. IDENTIFICACIÓN DE FACTORES',13),
 ('6.6','edad_alimentacion_complementaria',NULL,'number',0,NULL,NULL,N'Edad de inicio de alimentación complementaria','6','6. IDENTIFICACIÓN DE FACTORES',14),
 ('6.7','valoracion_integral','si_no','select',1,NULL,NULL,N'¿Asiste a valoración integral?','6','6. IDENTIFICACIÓN DE FACTORES',15),
 ('6.8','esquema_vacunacion','si_no_desconocido','select',1,NULL,NULL,N'¿Esquema de vacunación completo a la edad? (verificar en carné)','6','6. IDENTIFICACIÓN DE FACTORES',16),
 ('6.8.1','referido_por_carnet','si_no','select',0,'1','esquema_vacunacion',N'Referido por carné de vacunación','6','6. IDENTIFICACIÓN DE FACTORES',17),
 ('6.9','peso_actual',NULL,'number',1,NULL,NULL,N'Peso actual (kg, 1-50; si edema, peso con edema)','6','6. IDENTIFICACIÓN DE FACTORES',18),
 ('6.10','talla_actual',NULL,'number',1,NULL,NULL,N'Talla actual (cm, 45-150)','6','6. IDENTIFICACIÓN DE FACTORES',19),
 ('6.11','circunferencia_brazo',NULL,'number',1,NULL,NULL,N'Circunferencia media del brazo (cm, 6-30; 6 a 59 meses)','6','6. IDENTIFICACIÓN DE FACTORES',20),
 ('6.12','prueba_apetito','prueba_apetito','select',1,NULL,NULL,N'Resultado de la prueba de apetito (mayores de 6 meses)','6','6. IDENTIFICACIÓN DE FACTORES',21),

 -- 7. SIGNOS CLÍNICOS
 ('7.1','edema','si_no','select',1,NULL,NULL,N'¿Edema? (edema bilateral, compatible con Kwashiorkor)','7','7. SIGNOS CLÍNICOS',22),
 ('7.2','emaciacion','si_no','select',1,NULL,NULL,N'¿Desnutrición, emaciación o delgadez visible?','7','7. SIGNOS CLÍNICOS',23),
 ('7.3','piel_reseca','si_no','select',1,NULL,NULL,N'¿Piel reseca o áspera?','7','7. SIGNOS CLÍNICOS',24),
 ('7.4','pigmentacion','si_no','select',1,NULL,NULL,N'¿Hipo o hiperpigmentación de la piel?','7','7. SIGNOS CLÍNICOS',25),
 ('7.5','cambios_cabello','si_no','select',1,NULL,NULL,N'¿Cambios en el cabello (signo bandera)?','7','7. SIGNOS CLÍNICOS',26),
 ('7.6','palidez','si_no','select',1,NULL,NULL,N'¿Palidez palmar o de mucosas?','7','7. SIGNOS CLÍNICOS',27),
 ('7.7','diagnostico_clinico','diagnostico_clinico','select',1,NULL,NULL,N'Diagnóstico de manifestaciones clínicas de desnutrición aguda severa','7','7. SIGNOS CLÍNICOS',28),

 -- 8. RUTA DE ATENCIÓN (TIPO DE ATENCIÓN)
 ('8.1','escenario_manejo','escenario_manejo','select',0,NULL,NULL,N'Escenario de manejo','8','8. TIPO DE ATENCIÓN',29),
 ('8.2','prescripcion_productos','prescripcion_productos','select',0,NULL,NULL,N'Prescripción de productos para manejo de la desnutrición','8','8. TIPO DE ATENCIÓN',30),
 ('8.3','diagnostico_medico',NULL,'text',0,NULL,NULL,N'Diagnóstico médico (CIE10, tabla de referencia del sistema)','8','8. TIPO DE ATENCIÓN',31);

-- Re-sembrado idempotente (evita choque con UX_detalles_ref al re-ejecutar)
DELETE FROM detalle_eventos WHERE evento_codigo = '113';
DELETE FROM detalle_eventos_respuestas WHERE ref LIKE '113[_]%';

INSERT INTO detalle_eventos (evento_codigo, seccion, subs, numero, ref, tipo, lista_ref, obligatorio, show_if, padre_ref, seccion_label, label, indice)
SELECT '113', d.seccion, NULL, d.numero,
       '113_' + d.slug, d.tipo,
       CASE WHEN d.lista_slug IS NULL THEN NULL ELSE '113_' + d.lista_slug END,
       d.obligatorio, d.show_if,
       CASE WHEN d.padre_slug IS NULL THEN NULL ELSE '113_' + d.padre_slug END,
       d.seccion_label, d.label, d.indice
FROM @defs d;
PRINT 'Preguntas evento 113 (desnutrición aguda < 5 años) sembradas.';
