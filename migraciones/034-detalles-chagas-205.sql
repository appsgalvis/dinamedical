-- ===========================================
-- MIGRACIÓN 034: Preguntas de la ficha CHAGAS
-- (evento 205, FOR-R02.4030-012 V:00 2026-08-06) en el formulario dinámico.
--
-- Fuente: dumps/vision/205_chagas_2026_vision.txt
-- (página 2 = formulario, verificada con visión; OBLIG confirmado visualmente
--  en las tablas de instructivo p6 y p7 por error de orden del extracto).
--
-- Secciones sembradas: solo DATOS COMPLEMENTARIOS (5-7). Las secciones 1-4
-- (datos básicos) ya viven en ficha_datos_basicos.
--
-- Decisiones:
--   - 5.1 opciones tal como imprime p2 (1 Agudo, 2 Crónico); el instructivo
--     renumera como 5.1.1/5.1.2 (errata documentada en el volcado).
--   - 5.3 multiselect (marque con una X = selección individual), 14 opciones.
--   - 6.1-6.9: cada prueba es un select Positivo/Negativo/No se realizó,
--     OBLIG NO. El criterio "diligenciar si el tipo de caso es Chagas agudo"
--     depende del clasificador (sección 1), no es codificable como show_if.
--     El "Anote el resultado" de 6.5-6.9 (títulos IFI >= 1:32, rango real
--     1:8-1:512) no tiene campo en la forma impresa; documentado en el volcado.
--   - Regla codificable: bloque 7.1 (información de la madre) se habilita solo
--     cuando 7 = 3 (Congénita) => seis campos text con show_if='3',
--     padre_ref='205_via_transmision'.
--   - Erratas documentadas: el instructivo repite la definición de 5 = Trasplante
--     dos veces; 6 del instructivo dice "Accidente de laboratorio" y la forma
--     imprime "Accidente de trabajo" (se usa el impreso). Opción 7 Reactivación
--     confirmada con visión p7.
--   - OBLIG confirmado con visión: bloque datos básicos SI; p6: 5.1 SI, 5.2 SI,
--     5.3 SI, 6.1-6.7 NO; p7: 6.8 NO, 6.9 NO, 7 SI, 7.1 NO.
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== OPCIONES (listas) para el evento 205 ==========
DECLARE @slugs TABLE (slug NVARCHAR(60), val NVARCHAR(50), label NVARCHAR(150), ord INT);

INSERT INTO @slugs (slug, val, label, ord) VALUES
 -- Sí / No (5.2)
 ('si_no','1',N'Sí',1), ('si_no','2',N'No',2),
 -- 5.1 Clasificación del caso
 ('clasificacion','1',N'Agudo',1),
 ('clasificacion','2',N'Crónico',2),
 -- 5.3 Manifestaciones clínicas (multiselect, marque con una X)
 ('manifest_clinicas','1',N'Fiebre',1),
 ('manifest_clinicas','2',N'Disnea',2),
 ('manifest_clinicas','3',N'Edema facial',3),
 ('manifest_clinicas','4',N'Edema en miembros inferiores',4),
 ('manifest_clinicas','5',N'Derrame pericárdico',5),
 ('manifest_clinicas','6',N'Hepatoesplenomegalia',6),
 ('manifest_clinicas','7',N'Adenopatías',7),
 ('manifest_clinicas','8',N'Signo de Romaña',8),
 ('manifest_clinicas','9',N'Chagoma',9),
 ('manifest_clinicas','10',N'Falla cardíaca',10),
 ('manifest_clinicas','11',N'Disfagia',11),
 ('manifest_clinicas','12',N'Dolor torácico',12),
 ('manifest_clinicas','13',N'Bradicardia',13),
 ('manifest_clinicas','14',N'Arritmia cardíaca',14),
 -- Positivo / Negativo / No se realizó (6.1-6.9)
 ('pos_neg','1',N'Positivo',1),
 ('pos_neg','2',N'Negativo',2),
 ('pos_neg','3',N'No se realizó',3),
 -- 7. Posible vía de transmisión
 ('via_transmision','1',N'Vectorial',1),
 ('via_transmision','2',N'Transfusional',2),
 ('via_transmision','3',N'Congénita',3),
 ('via_transmision','4',N'Vía oral',4),
 ('via_transmision','5',N'Trasplante',5),
 ('via_transmision','6',N'Accidente de trabajo',6),
 ('via_transmision','7',N'Reactivación',7);

DELETE FROM listas WHERE formulario = 'evento_205';
INSERT INTO listas (label, value, ref, formulario, campo, indice)
SELECT s.label, s.val, '205_' + s.slug, 'evento_205', s.slug, s.ord
FROM @slugs s;
PRINT 'Listas evento_205 sembradas.';

-- ========== DEFINICIONES DE PREGUNTAS (evento 205) ==========
DECLARE @defs TABLE (
    numero NVARCHAR(10), slug NVARCHAR(60), lista_slug NVARCHAR(60), tipo NVARCHAR(20),
    obligatorio BIT, show_if NVARCHAR(50), padre_slug NVARCHAR(60), label NVARCHAR(200),
    seccion NVARCHAR(15), seccion_label NVARCHAR(120), indice INT
);

INSERT INTO @defs (numero, slug, lista_slug, tipo, obligatorio, show_if, padre_slug, label, seccion, seccion_label, indice) VALUES
 -- 5. INFORMACIÓN CLÍNICA
 ('5.1','clasificacion','clasificacion','select',1,NULL,NULL,N'Clasificación del caso','5','5. INFORMACIÓN CLÍNICA',1),
 ('5.2','reactivacion','si_no','select',1,NULL,NULL,N'Reactivación','5','5. INFORMACIÓN CLÍNICA',2),
 ('5.3','manifest_clinicas','manifest_clinicas','multiselect',1,NULL,NULL,N'Marque con una X las manifestaciones clínicas que presente el paciente','5','5. INFORMACIÓN CLÍNICA',3),

 -- 6. ESTUDIOS REALIZADOS (cada prueba: Positivo/Negativo/No se realizó; NO obligatorias,
 --    diligenciar según clasificador - no codificable como show_if)
 ('6.1','micrometodo','pos_neg','select',0,NULL,NULL,N'6.1 Micrométodo (prueba parasitológica)','6','6. ESTUDIOS REALIZADOS',4),
 ('6.2','gota_gruesa_frotis','pos_neg','select',0,NULL,NULL,N'6.2 Gota gruesa / frotis de sangre (prueba parasitológica)','6','6. ESTUDIOS REALIZADOS',5),
 ('6.3','microhematocrito','pos_neg','select',0,NULL,NULL,N'6.3 Microhematocrito / examen fresco (prueba parasitológica)','6','6. ESTUDIOS REALIZADOS',6),
 ('6.4','rt_pcr','pos_neg','select',0,NULL,NULL,N'6.4 RT-PCR chagas (prueba parasitológica)','6','6. ESTUDIOS REALIZADOS',7),
 ('6.5','elisa_totales','pos_neg','select',0,NULL,NULL,N'6.5 ELISA Ag totales (convencional, prueba serológica)','6','6. ESTUDIOS REALIZADOS',8),
 ('6.6','elisa_recombinantes','pos_neg','select',0,NULL,NULL,N'6.6 ELISA/CLIA Ag recombinantes / péptidos sintéticos (no convencional, prueba serológica)','6','6. ESTUDIOS REALIZADOS',9),
 ('6.7','ifi_igg_t_cruzi','pos_neg','select',0,NULL,NULL,N'6.7 IFI IgG T. cruzi (títulos >= 1:32; anotar el resultado, rango real 1:8-1:512)','6','6. ESTUDIOS REALIZADOS',10),
 ('6.8','pdr1','pos_neg','select',0,NULL,NULL,N'6.8 PDR 1 (prueba serológica)','6','6. ESTUDIOS REALIZADOS',11),
 ('6.9','pdr2','pos_neg','select',0,NULL,NULL,N'6.9 PDR 2 (prueba serológica)','6','6. ESTUDIOS REALIZADOS',12),

 -- 7. POSIBLE VÍA DE TRANSMISIÓN
 ('7','via_transmision','via_transmision','select',1,NULL,NULL,N'Probable vía de transmisión','7','7. POSIBLE VÍA DE TRANSMISIÓN',13),
 ('7.1.1','madre_primer_nombre',NULL,'text',0,'3','via_transmision',N'7.1 Primer nombre de la madre (solo si vía = Congénita)','7','7. POSIBLE VÍA DE TRANSMISIÓN',14),
 ('7.1.2','madre_segundo_nombre',NULL,'text',0,'3','via_transmision',N'7.1 Segundo nombre de la madre (solo si vía = Congénita)','7','7. POSIBLE VÍA DE TRANSMISIÓN',15),
 ('7.1.3','madre_primer_apellido',NULL,'text',0,'3','via_transmision',N'7.1 Primer apellido de la madre (solo si vía = Congénita)','7','7. POSIBLE VÍA DE TRANSMISIÓN',16),
 ('7.1.4','madre_segundo_apellido',NULL,'text',0,'3','via_transmision',N'7.1 Segundo apellido de la madre (solo si vía = Congénita)','7','7. POSIBLE VÍA DE TRANSMISIÓN',17),
 ('7.1.5','madre_tipo_documento',NULL,'text',0,'3','via_transmision',N'7.1 Tipo de documento de la madre (solo si vía = Congénita)','7','7. POSIBLE VÍA DE TRANSMISIÓN',18),
 ('7.1.6','madre_numero_identificacion',NULL,'text',0,'3','via_transmision',N'7.1 Número de identificación de la madre (solo si vía = Congénita)','7','7. POSIBLE VÍA DE TRANSMISIÓN',19);

-- Re-sembrado idempotente (evita choque con UX_detalles_ref al re-ejecutar)
DELETE FROM detalle_eventos WHERE evento_codigo = '205';
DELETE FROM detalle_eventos_respuestas WHERE ref LIKE '205[_]%';

INSERT INTO detalle_eventos (evento_codigo, seccion, subs, numero, ref, tipo, lista_ref, obligatorio, show_if, padre_ref, seccion_label, label, indice)
SELECT '205', d.seccion, NULL, d.numero,
       '205_' + d.slug, d.tipo,
       CASE WHEN d.lista_slug IS NULL THEN NULL ELSE '205_' + d.lista_slug END,
       d.obligatorio, d.show_if,
       CASE WHEN d.padre_slug IS NULL THEN NULL ELSE '205_' + d.padre_slug END,
       d.seccion_label, d.label, d.indice
FROM @defs d;
PRINT 'Preguntas evento 205 (Chagas) sembradas.';
