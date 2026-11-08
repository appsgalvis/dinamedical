-- ===========================================
-- MIGRACIÓN 030: Preguntas de la ficha CÁNCER EN MENORES DE 18 AÑOS
-- (evento 115, FOR-R02.4030-009 V:00 2026-08-06) en el formulario dinámico.
--
-- Fuente: dumps/vision/115_ca_menores_18_2026_vision.txt (página 2 = formulario,
-- verificada con visión; páginas 3-6 = instructivo -> dumps/extracto/115_CA_Menores_18_2026.txt).
--
-- Secciones sembradas: solo los DATOS COMPLEMENTARIOS (5-6). Las secciones 1-4
-- (datos básicos) ya viven en ficha_datos_basicos.
--
-- Decisiones:
--   - Opciones de 5.1 en el orden IMPRESO de la ficha (14 grupos de cáncer),
--     confirmadas por visión en p2.
--   - OBLIG confirmado con visión (p6): 5.1 SI, 5.2 SI, 5.3 SI, 5.4 SI, 5.5 NO;
--     6.1 SI, 6.1.1 NO, 6.1.2 NO, 6.2 SI, 6.2.1 NO, 6.2.2 NO.
--   - Regla dinámica: 5.5 fecha de diagnóstico inicial -> show_if='1',
--     padre_ref=115_segunda_neoplasia (instructivo: "depende de la respuesta en
--     la variable 5.3, opción 1 = Sí").
--
-- Erratas / supuestos documentados:
--   - Numeración impresa de la sección 5: 5.4 = recaída, 5.5 = fecha de
--     diagnóstico inicial. El instructivo duplica "5.4" al describir la fecha de
--     diagnóstico inicial; se usa el número IMPRESO (5.5).
--   - 6.2 Criterio de confirmación: la numeración impresa SALTA del 5 al 7 (no
--     existe opción "6"); errata del instructivo, que la lista como "6.
--     Citogenética". Se catalogan los valores tal como imprime: 1-5, 7, 8.
--   - 6.1 "consistente con el tipo de caso probable" y 6.2 "consistente con el
--     caso confirmado" dependen del clasificador (variables 3.6/4.1), no son
--     codificables como show_if -> preguntas siempre visibles.
--   - 5.2 >= fecha de diagnóstico inicial y 6.x.2 >= 6.x.1 son validaciones de
--     rango, no show_if.
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== OPCIONES (listas) para el evento 115 ==========
DECLARE @slugs TABLE (slug NVARCHAR(60), val NVARCHAR(50), label NVARCHAR(150), ord INT);

INSERT INTO @slugs (slug, val, label, ord) VALUES
 -- Sí / No (5.3, 5.4)
 ('si_no','1',N'Sí',1), ('si_no','2',N'No',2),
 -- 5.1 Tipo de cáncer (orden impreso de la ficha, 14 grupos)
 ('tipo_cancer','1',N'Leucemia linfoide aguda',1),
 ('tipo_cancer','2',N'Leucemia mieloide aguda',2),
 ('tipo_cancer','3',N'Otras leucemias',3),
 ('tipo_cancer','4',N'Linfomas y neoplasias reticuloendoteliales',4),
 ('tipo_cancer','5',N'Tumores del sistema nervioso central',5),
 ('tipo_cancer','6',N'Neuroblastoma y otros tumores de células nerviosas periféricas',6),
 ('tipo_cancer','7',N'Retinoblastoma',7),
 ('tipo_cancer','8',N'Tumores renales',8),
 ('tipo_cancer','9',N'Tumores hepáticos',9),
 ('tipo_cancer','10',N'Tumores óseos malignos',10),
 ('tipo_cancer','11',N'Sarcomas de tejidos blandos y extra óseos',11),
 ('tipo_cancer','12',N'Tumores germinales trofoblásticos y otros gonadales',12),
 ('tipo_cancer','13',N'Tumores epiteliales malignos y melanoma',13),
 ('tipo_cancer','14',N'Otras neoplasias malignas no especificadas',14),
 -- 6.1 Criterio diagnóstico probable (5 opciones)
 ('criterio_probable','1',N'Extendido de sangre periférica',1),
 ('criterio_probable','2',N'Radiología diagnóstica',2),
 ('criterio_probable','3',N'Gammagrafía',3),
 ('criterio_probable','4',N'Marcadores tumorales',4),
 ('criterio_probable','5',N'Clínica sin otra ayuda diagnóstica',5),
 -- 6.2 Criterio de confirmación (valores tal como imprime: 1-5, 7, 8; no existe el 6)
 ('criterio_confirmacion','1',N'Mielograma',1),
 ('criterio_confirmacion','2',N'Histopatología o citología de fluido corporal',2),
 ('criterio_confirmacion','3',N'Inmunotipificación',3),
 ('criterio_confirmacion','4',N'Criterio médico especializado',4),
 ('criterio_confirmacion','5',N'Certificado de defunción',5),
 ('criterio_confirmacion','7',N'Citogenética (impresso sin opción 6)',6),
 ('criterio_confirmacion','8',N'Radiología diagnóstica',7);

DELETE FROM listas WHERE formulario = 'evento_115';
INSERT INTO listas (label, value, ref, formulario, campo, indice)
SELECT s.label, s.val, '115_' + s.slug, 'evento_115', s.slug, s.ord
FROM @slugs s;
PRINT 'Listas evento_115 sembradas.';

-- ========== DEFINICIONES DE PREGUNTAS (evento 115) ==========
DECLARE @defs TABLE (
    numero NVARCHAR(10), slug NVARCHAR(60), lista_slug NVARCHAR(60), tipo NVARCHAR(20),
    obligatorio BIT, show_if NVARCHAR(50), padre_slug NVARCHAR(60), label NVARCHAR(200),
    seccion NVARCHAR(15), seccion_label NVARCHAR(120), indice INT
);

INSERT INTO @defs (numero, slug, lista_slug, tipo, obligatorio, show_if, padre_slug, label, seccion, seccion_label, indice) VALUES
 -- 5. TIPO DE CÁNCER
 ('5.1','tipo_cancer','tipo_cancer','select',1,NULL,NULL,N'Tipo de cáncer (grupo según presunción diagnóstica)','5','5. TIPO DE CÁNCER',1),
 ('5.2','fecha_inicio_tratamiento',NULL,'date',1,NULL,NULL,N'Fecha de inicio de tratamiento (>= fecha de diagnóstico inicial)','5','5. TIPO DE CÁNCER',2),
 ('5.3','segunda_neoplasia','si_no','select',1,NULL,NULL,N'¿Consulta actual por segunda neoplasia?','5','5. TIPO DE CÁNCER',3),
 ('5.4','recaida','si_no','select',1,NULL,NULL,N'¿Consulta actual por recaída?','5','5. TIPO DE CÁNCER',4),
 ('5.5','fecha_diagnostico_inicial',NULL,'date',0,'1','segunda_neoplasia',N'Fecha de diagnóstico inicial (solo si 5.3 = Sí)','5','5. TIPO DE CÁNCER',5),

 -- 6. DATOS DE LABORATORIO – MÉTODOS DIAGNÓSTICOS
 --    (6.1/6.2 visibles siempre: la consistencia con el tipo de caso depende del
 --     clasificador 3.6/4.1, no codificable como show_if)
 ('6.1','criterio_probable','criterio_probable','select',1,NULL,NULL,N'Criterio de diagnóstico probable','6','6. DATOS DE LABORATORIO - MÉTODOS DIAGNÓSTICOS',6),
 ('6.1.1','fecha_toma_probable',NULL,'date',0,NULL,NULL,N'6.1 Fecha de toma','6','6. DATOS DE LABORATORIO - MÉTODOS DIAGNÓSTICOS',7),
 ('6.1.2','fecha_resultado_probable',NULL,'date',0,NULL,NULL,N'6.1 Fecha de resultado (>= fecha de toma)','6','6. DATOS DE LABORATORIO - MÉTODOS DIAGNÓSTICOS',8),
 ('6.2','criterio_confirmacion','criterio_confirmacion','select',1,NULL,NULL,N'Criterio de confirmación del diagnóstico','6','6. DATOS DE LABORATORIO - MÉTODOS DIAGNÓSTICOS',9),
 ('6.2.1','fecha_toma_confirmacion',NULL,'date',0,NULL,NULL,N'6.2 Fecha de toma','6','6. DATOS DE LABORATORIO - MÉTODOS DIAGNÓSTICOS',10),
 ('6.2.2','fecha_resultado_confirmacion',NULL,'date',0,NULL,NULL,N'6.2 Fecha de resultado (>= fecha de toma)','6','6. DATOS DE LABORATORIO - MÉTODOS DIAGNÓSTICOS',11);

-- Re-sembrado idempotente (evita choque con UX_detalles_ref al re-ejecutar)
DELETE FROM detalle_eventos WHERE evento_codigo = '115';
DELETE FROM detalle_eventos_respuestas WHERE ref LIKE '115[_]%';

INSERT INTO detalle_eventos (evento_codigo, seccion, subs, numero, ref, tipo, lista_ref, obligatorio, show_if, padre_ref, seccion_label, label, indice)
SELECT '115', d.seccion, NULL, d.numero,
       '115_' + d.slug, d.tipo,
       CASE WHEN d.lista_slug IS NULL THEN NULL ELSE '115_' + d.lista_slug END,
       d.obligatorio, d.show_if,
       CASE WHEN d.padre_slug IS NULL THEN NULL ELSE '115_' + d.padre_slug END,
       d.seccion_label, d.label, d.indice
FROM @defs d;
PRINT 'Preguntas evento 115 (cáncer en menores de 18) sembradas.';
