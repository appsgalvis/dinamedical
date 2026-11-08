-- ===========================================
-- MIGRACIÓN 036: Preguntas de la ficha CHIKUNGUNYA
-- (evento 217, FOR-R02.4030-015 V:00 2026-08-06) en el formulario dinámico.
--
-- Fuente: dumps/vision/217_chikungunya_2026_vision.txt (p2 = formulario)
-- + instructivo (extracto).
--
-- Decisiones:
--   - Solo dos variables catalogables: 5.1 síntomas (multiselect, OBLIG por
--     criterio textual) y 6.1 muestras (multiselect, NO oblig).
--   - Opciones verbatim de la página impresa.
--   - 6.1 debe ser consistente con Condición final = Muerto (datos básicos) ->
--     no codificable como show_if; campo siempre visible.
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== OPCIONES (listas) para el evento 217 ==========
DECLARE @slugs TABLE (slug NVARCHAR(60), val NVARCHAR(50), label NVARCHAR(150), ord INT);

INSERT INTO @slugs (slug, val, label, ord) VALUES
 -- 5.1 Síntomas (marque con X, multiselect)
 ('sintomas','1',N'Fiebre',1), ('sintomas','2',N'Artralgia',2), ('sintomas','3',N'Cefalea',3),
 ('sintomas','4',N'Rash o brote',4), ('sintomas','5',N'Vómito y diarrea',5),
 -- 6.1 Muestras (marque con X, multiselect)
 ('muestras','1',N'Piel',1), ('muestras','2',N'Higado',2), ('muestras','3',N'Bazo',3),
 ('muestras','4',N'Pulmón',4), ('muestras','5',N'Médula',5), ('muestras','6',N'Riñón',6),
 ('muestras','7',N'Cerebro',7), ('muestras','8',N'Miocardio',8);

DELETE FROM listas WHERE formulario = 'evento_217';
INSERT INTO listas (label, value, ref, formulario, campo, indice)
SELECT s.label, s.val, '217_' + s.slug, 'evento_217', s.slug, s.ord
FROM @slugs s;
PRINT 'Listas evento_217 sembradas.';

-- ========== DEFINICIONES DE PREGUNTAS (evento 217) ==========
DECLARE @defs TABLE (
    numero NVARCHAR(10), slug NVARCHAR(60), lista_slug NVARCHAR(60), tipo NVARCHAR(20),
    obligatorio BIT, show_if NVARCHAR(50), padre_slug NVARCHAR(60), label NVARCHAR(200),
    seccion NVARCHAR(15), seccion_label NVARCHAR(120), indice INT
);

INSERT INTO @defs (numero, slug, lista_slug, tipo, obligatorio, show_if, padre_slug, label, seccion, seccion_label, indice) VALUES
 ('5.1','sintomas','sintomas','multiselect',1,NULL,NULL,N'Síntomas (marque los que se presenten)','5','5. DATOS COMPLEMENTARIOS',1),
 ('6.1','muestras','muestras','multiselect',0,NULL,NULL,N'Muestras tomadas (consistente con Condición final = Muerto, datos básicos)','6','6. EN CASO DE MORTALIDAD POR CHIKUNGUNYA',2);

-- Re-sembrado idempotente
DELETE FROM detalle_eventos WHERE evento_codigo = '217';
DELETE FROM detalle_eventos_respuestas WHERE ref LIKE '217[_]%';

INSERT INTO detalle_eventos (evento_codigo, seccion, subs, numero, ref, tipo, lista_ref, obligatorio, show_if, padre_ref, seccion_label, label, indice)
SELECT '217', d.seccion, NULL, d.numero,
       '217_' + d.slug, d.tipo,
       CASE WHEN d.lista_slug IS NULL THEN NULL ELSE '217_' + d.lista_slug END,
       d.obligatorio, d.show_if,
       CASE WHEN d.padre_slug IS NULL THEN NULL ELSE '217_' + d.padre_slug END,
       d.seccion_label, d.label, d.indice
FROM @defs d;
PRINT 'Preguntas evento 217 (chikungunya) sembradas.';
