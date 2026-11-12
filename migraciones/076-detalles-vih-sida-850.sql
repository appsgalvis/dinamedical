-- ===========================================
-- MIGRACIÓN 076: Ficha VIH / SIDA (evento 850)
-- FOR-R02.4030-053 V:00 2026-08-06 — complementarios p2.
--
-- Fuente: dumps/vision/850_vih_sida_2026_vision.txt + instructivo p6-p7.
--
-- Decisiones:
--   - 5.1 multiselect (grupos sexual / materno / parenteral en una lista codificada).
--   - Datos madre (bloque 5.2 impreso) show_if mecanismo contiene '4'; edad <=10 no codificable.
--   - 6.1.2 carga viral solo si prueba = 2 (instructivo también cita 6.2 obsoleto).
--   - 8.1 multiselect oportunistas; obligatorio=0 (aplica si estadio Sida/Muerto — cross 7.1).
--   - Erratas verbatim: "vias areas", "Coccidiodomicosis", "Sìndrome", seccion 8 titulo duplicado.
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

DECLARE @slugs TABLE (slug NVARCHAR(60), val NVARCHAR(50), label NVARCHAR(150), ord INT);

INSERT INTO @slugs (slug, val, label, ord) VALUES
 ('si_no','1',N'Sí',1), ('si_no','2',N'No',2),
 ('mecanismo_tx','1',N'Heterosexual',1),
 ('mecanismo_tx','2',N'Homosexual',2),
 ('mecanismo_tx','3',N'Bisexual',3),
 ('mecanismo_tx','4',N'Materno infantil (en menor de 10 años)',4),
 ('mecanismo_tx','5',N'Transfusión sanguínea',5),
 ('mecanismo_tx','6',N'Usos de drogas inyectables',6),
 ('mecanismo_tx','7',N'Accidente de trabajo',7),
 ('mecanismo_tx','9',N'Transplante de órganos',8),
 ('mecanismo_tx','10',N'Piercing',9),
 ('mecanismo_tx','11',N'Hemodiálisis',10),
 ('mecanismo_tx','12',N'Tatuajes',11),
 ('mecanismo_tx','13',N'Procedimientos estéticos',12),
 ('mecanismo_tx','14',N'Acupuntura',13),
 ('identidad_genero','M',N'M. Masculino',1),
 ('identidad_genero','F',N'F. Femenino',2),
 ('identidad_genero','T',N'T. Transgénero',3),
 ('tipo_prueba_vih','1',N'Western Blot',1),
 ('tipo_prueba_vih','2',N'Carga viral',2),
 ('tipo_prueba_vih','3',N'Prueba rápida',3),
 ('tipo_prueba_vih','4',N'Elisa',4),
 ('tipo_prueba_vih','5',N'Quimioluminiscencia',5),
 ('estadio_clinico','1',N'VIH',1),
 ('estadio_clinico','2',N'Sida',2),
 ('estadio_clinico','3',N'Muerto',3),
 ('enf_asoc','1',N'Candidiasis esofágica',1),
 ('enf_asoc','2',N'Candidiasis de las vías areas',2),
 ('enf_asoc','3',N'Tuberculosis pulmonar',3),
 ('enf_asoc','4',N'Cáncer cervical invasivo',4),
 ('enf_asoc','5',N'Tuberculosis extrapulmonar',5),
 ('enf_asoc','6',N'Coccidiodomicosis',6),
 ('enf_asoc','7',N'Citomegalovirosis',7),
 ('enf_asoc','8',N'Retinitis por citomegalovirus',8),
 ('enf_asoc','9',N'Encefalopatía por VIH',9),
 ('enf_asoc','10',N'Otras micobacterias',10),
 ('enf_asoc','11',N'Histoplasmosis extrapulmonar',11),
 ('enf_asoc','12',N'Isosporidiasis crónica',12),
 ('enf_asoc','13',N'Herpes zoster en múltiples dermatomas',13),
 ('enf_asoc','14',N'Histoplasmosis diseminada',14),
 ('enf_asoc','15',N'Linfoma de Burkitt',15),
 ('enf_asoc','16',N'Neumonía por Pneumocystis',16),
 ('enf_asoc','17',N'Neumonía recurrente (más de 2 episodios en un año)',17),
 ('enf_asoc','18',N'Linfoma inmunoblástico',18),
 ('enf_asoc','19',N'Criptosporidiasis crónica',19),
 ('enf_asoc','20',N'Criptococosis extrapulmonar',20),
 ('enf_asoc','21',N'Sarcoma de Kaposi',21),
 ('enf_asoc','22',N'Sìndrome de emaciación',22),
 ('enf_asoc','23',N'Leucoencefalopatía multifocal',23),
 ('enf_asoc','24',N'Septicemia recurrente por Salmonella',24),
 ('enf_asoc','25',N'Toxoplasmosis cerebral',25),
 ('enf_asoc','26',N'Hepatitis B',26),
 ('enf_asoc','27',N'Hepatitis C',27),
 ('enf_asoc','28',N'Meningitis',28);

DELETE FROM listas WHERE formulario = 'evento_850';
INSERT INTO listas (label, value, ref, formulario, campo, indice)
SELECT s.label, s.val, '850_' + s.slug, 'evento_850', s.slug, s.ord
FROM @slugs s;
PRINT 'Listas evento_850 sembradas.';

DECLARE @defs TABLE (
    numero NVARCHAR(10), subs NVARCHAR(2), slug NVARCHAR(60), lista_slug NVARCHAR(60),
    tipo NVARCHAR(20), obligatorio BIT, show_if NVARCHAR(50), padre_slug NVARCHAR(60),
    label NVARCHAR(200), seccion NVARCHAR(15), seccion_label NVARCHAR(120), indice INT
);

INSERT INTO @defs (numero, subs, slug, lista_slug, tipo, obligatorio, show_if, padre_slug, label, seccion, seccion_label, indice) VALUES
 ('5.1',NULL,'mecanismo_tx','mecanismo_tx','multiselect',1,NULL,NULL,N'Mecanismo probable de transmisión','5',N'5. ANTECEDENTES EPIDEMIOLÓGICOS',1),
 ('5.2',NULL,'madre_nombre',NULL,'text',1,'4','mecanismo_tx',N'Nombre de la madre (transmisión materno infantil)','5',N'5. ANTECEDENTES EPIDEMIOLÓGICOS',2),
 ('5.2',NULL,'madre_tipo_id',NULL,'text',1,'4','mecanismo_tx',N'Tipo de ID de la madre','5',N'5. ANTECEDENTES EPIDEMIOLÓGICOS',3),
 ('5.2',NULL,'madre_numero_id',NULL,'text',1,'4','mecanismo_tx',N'Número de identificación de la madre','5',N'5. ANTECEDENTES EPIDEMIOLÓGICOS',4),
 ('5.3',NULL,'identidad_genero','identidad_genero','select',1,NULL,NULL,N'Identidad de género','5',N'5. ANTECEDENTES EPIDEMIOLÓGICOS',5),
 ('5.4',NULL,'dono_sangre','si_no','select',1,NULL,NULL,N'¿Donó sangre en los 12 meses anteriores a esta notificación?','5',N'5. ANTECEDENTES EPIDEMIOLÓGICOS',6),

 ('6.1',NULL,'tipo_prueba','tipo_prueba_vih','select',1,NULL,NULL,N'Tipo de prueba con la cual se confirmó el diagnóstico','6',N'6. DIAGNÓSTICO DE LABORATORIO',7),
 ('6.1.1',NULL,'fecha_resultado',NULL,'date',1,NULL,NULL,N'Fecha de resultado (dd/mm/aaaa)','6',N'6. DIAGNÓSTICO DE LABORATORIO',8),
 ('6.1.2',NULL,'valor_carga_viral',NULL,'number',1,'2','tipo_prueba',N'Valor de la carga viral (N° de copias)','6',N'6. DIAGNÓSTICO DE LABORATORIO',9),

 ('7.1',NULL,'estadio_clinico','estadio_clinico','select',1,NULL,NULL,N'Estadio clínico','7',N'7. INFORMACIÓN CLÍNICA',10),

 ('8.1',NULL,'enfermedades_asoc','enf_asoc','multiselect',0,NULL,NULL,N'Enfermedades asociadas (oportunistas y/o coinfecciones — estadio Sida)','8',N'8. INFORMACIÓN CLÍNICA',11);

DELETE FROM detalle_eventos WHERE evento_codigo = '850';
DELETE FROM detalle_eventos_respuestas WHERE ref LIKE '850[_]%';

INSERT INTO detalle_eventos (evento_codigo, seccion, subs, numero, ref, tipo, lista_ref, obligatorio, show_if, padre_ref, seccion_label, label, indice)
SELECT '850', d.seccion, d.subs, d.numero,
       '850_' + d.slug, d.tipo,
       CASE WHEN d.lista_slug IS NULL THEN NULL ELSE '850_' + d.lista_slug END,
       d.obligatorio, d.show_if,
       CASE WHEN d.padre_slug IS NULL THEN NULL ELSE '850_' + d.padre_slug END,
       d.seccion_label, d.label, d.indice
FROM @defs d;
PRINT 'Preguntas evento 850 (VIH/Sida) sembradas.';

SELECT COUNT(*) AS defs_evento_850, SUM(CAST(obligatorio AS INT)) AS obligatorios
FROM detalle_eventos WHERE evento_codigo = '850';
SELECT COUNT(*) AS opciones_850 FROM listas WHERE formulario = 'evento_850';
