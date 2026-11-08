-- ===========================================
-- MIGRACIÓN 029: Preguntas de la ficha RIESGO POR DESNUTRICIÓN
-- (evento 114, FOR-R02.4030-008 V:00 2026-08-06) en el formulario dinámico.
--
-- Fuente: dinamedical/fichas/dumps/114_riesgo_dnt_5_2026_dump.txt (página 2 = formulario,
-- páginas 6-7 = instructivo con criterios de sistematización, OBLIG y reglas).
--
-- Secciones sembradas: solo los DATOS COMPLEMENTARIOS (5-9). Las secciones 1-4
-- (datos básicos) ya viven en ficha_datos_basicos.
--
-- Conflicto Forma vs Instructivo (decisión confirmada por el usuario):
--   - La forma impresa numera como sección 7 los FACTORES DE RIESGO (22 dicotómicas
--     Sí/No). El instructivo reserva el 7 para SIGNOS CLÍNICOS. Se respeta la forma
--     impresa: 7 = Factores de riesgo, signos clínicos -> sección 8, ruta de
--     atención -> sección 9. Las reglas se conservan vía padre_ref (no dependen de
--     la numeración).
--   - Dentro de la sección 6 se mantienen los números del instructivo (6.1-6.10),
--     porque la regla 6.7.1 referencia la variable 6.7. La forma impresa muestra los
--     campos antropométricos como 6.3/6.4/6.5 (peso/talla/circunf. actuales), que
--     corresponden a 6.8/6.9/6.10 del instructivo.
--
-- Reglas dinámicas (del instructivo):
--   6.7.1 Referido por carné (OBLIG=NO): "depende de la respuesta en variable 6.7"
--     sin valor concreto; se espeja la decisión del 113 -> show_if = '1' (visible
--     cuando 6.7 = Sí), padre_ref = 114_esquema_vacunacion. Decision confirmada.
--   9.3 Diagnóstico médico (OBLIG=NO): depende de la opción Intrahospitalaria en
--     9.2 (8.2 del instructivo) -> show_if = '1', padre_ref = 114_tipo_atencion
--     (1 Intrahospitalaria, 2 Comunitaria, según orden del instructivo).
--
-- Erratas / supuestos documentados:
--   - 6.9 Talla actual: el instructivo dice "45 cm hasta 50", probable errata.
--   - 5.7 Nivel educativo de la madre: la forma impresa no lo muestra ni lista
--     opciones; se reutilizan las 5 opciones estándar del evento 113 (decisión
--     confirmada).
--   - 9.1 Activación ruta de atención: la ficha no lista opciones; se asume
--     dicotómica Sí(1)/No(2), estándar Sivigila.
--   - Los 22 factores de riesgo no tienen columna OBLIG en el instructivo ->
--     obligatorio = 0.
--   - Tipo de ID: códigos del impreso del 114 (8 códigos, sin PT, a diferencia del
--     113 que incluye PT).
-- Rango de valores admitidos (instructivo, anotado en los labels):
--   6.1 g 900-5000, 6.2 cm 30-55, 6.3 semanas 20-45, 6.8 kg 1-50,
--   6.9 cm 45-"50" (errata), 6.10 cm 6-30 (de 6 a 59 meses).
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== OPCIONES (listas) para el evento 114 ==========
DECLARE @slugs TABLE (slug NVARCHAR(60), val NVARCHAR(50), label NVARCHAR(150), ord INT);

INSERT INTO @slugs (slug, val, label, ord) VALUES
 -- Sí / No (todas las dicotómicas 6.x, 7.x, 8.x, 9.1)
 ('si_no','1',N'Sí',1), ('si_no','2',N'No',2),
 -- 5.5 Tipo de ID (códigos del impreso del 114; no incluye PT)
 ('tipo_id','RC',N'Registro Civil',1),
 ('tipo_id','TI',N'Tarjeta de Identidad',2),
 ('tipo_id','CC',N'Cédula de Ciudadanía',3),
 ('tipo_id','CE',N'Cédula de Extranjería',4),
 ('tipo_id','PA',N'Pasaporte',5),
 ('tipo_id','MS',N'Menor sin identificación',6),
 ('tipo_id','AS',N'Adulto sin identificación',7),
 ('tipo_id','PE',N'Permiso Especial de Permanencia',8),
 -- 5.7 Nivel educativo (opciones heredadas del evento 113, decisión confirmada)
 ('nivel_educativo','1',N'Primaria',1),
 ('nivel_educativo','2',N'Secundaría',2),
 ('nivel_educativo','3',N'Técnica',3),
 ('nivel_educativo','4',N'Universitaria',4),
 ('nivel_educativo','5',N'Ninguno',5),
 -- 9.2 Tipo de atención suministrada (orden del instructivo)
 ('tipo_atencion','1',N'Intrahospitalaria',1),
 ('tipo_atencion','2',N'Comunitaria',2);

DELETE FROM listas WHERE formulario = 'evento_114';
INSERT INTO listas (label, value, ref, formulario, campo, indice)
SELECT s.label, s.val, '114_' + s.slug, 'evento_114', s.slug, s.ord
FROM @slugs s;
PRINT 'Listas evento_114 sembradas.';

-- ========== DEFINICIONES DE PREGUNTAS (evento 114) ==========
DECLARE @defs TABLE (
    numero NVARCHAR(10), slug NVARCHAR(60), lista_slug NVARCHAR(60), tipo NVARCHAR(20),
    obligatorio BIT, show_if NVARCHAR(50), padre_slug NVARCHAR(60), label NVARCHAR(200),
    seccion NVARCHAR(15), seccion_label NVARCHAR(120), indice INT
);

INSERT INTO @defs (numero, slug, lista_slug, tipo, obligatorio, show_if, padre_slug, label, seccion, seccion_label, indice) VALUES
 -- 5. DATOS DE LA MADRE O CUIDADOR
 ('5.1','primer_nombre',NULL,'text',1,NULL,NULL,N'Primer nombre de la madre','5','5. DATOS DE LA MADRE O CUIDADOR',1),
 ('5.2','segundo_nombre',NULL,'text',1,NULL,NULL,N'Segundo nombre de la madre','5','5. DATOS DE LA MADRE O CUIDADOR',2),
 ('5.3','primer_apellido',NULL,'text',1,NULL,NULL,N'Primer apellido de la madre','5','5. DATOS DE LA MADRE O CUIDADOR',3),
 ('5.4','segundo_apellido',NULL,'text',1,NULL,NULL,N'Segundo apellido de la madre','5','5. DATOS DE LA MADRE O CUIDADOR',4),
 ('5.5','tipo_id','tipo_id','select',1,NULL,NULL,N'Tipo de identificación de la madre','5','5. DATOS DE LA MADRE O CUIDADOR',5),
 ('5.6','numero_identificacion',NULL,'text',1,NULL,NULL,N'Número de identificación de la madre','5','5. DATOS DE LA MADRE O CUIDADOR',6),
 ('5.7','nivel_educativo','nivel_educativo','select',1,NULL,NULL,N'Nivel educativo de la madre','5','5. DATOS DE LA MADRE O CUIDADOR',7),
 ('5.8','hijos_menores_de_5',NULL,'number',1,NULL,NULL,N'Número de niños menores de 5 años en el hogar','5','5. DATOS DE LA MADRE O CUIDADOR',8),

 -- 6. IDENTIFICACIÓN DE FACTORES (numeración del instructivo; la regla 6.7.1 referencia 6.7)
 ('6.1','peso_nacer',NULL,'number',0,NULL,NULL,N'Peso al nacer (g, 900-5000)','6','6. IDENTIFICACIÓN DE FACTORES',9),
 ('6.2','talla_nacer',NULL,'number',0,NULL,NULL,N'Talla al nacer (cm, 30-55)','6','6. IDENTIFICACIÓN DE FACTORES',10),
 ('6.3','edad_gestacional',NULL,'number',0,NULL,NULL,N'Edad gestacional al nacer (semanas, 20-45)','6','6. IDENTIFICACIÓN DE FACTORES',11),
 ('6.4','tiempo_leche_materna',NULL,'number',1,NULL,NULL,N'Tiempo que recibió leche materna (meses)','6','6. IDENTIFICACIÓN DE FACTORES',12),
 ('6.5','edad_inicio_alimentacion',NULL,'number',1,NULL,NULL,N'Edad de inicio de alimentación complementaria (meses o años)','6','6. IDENTIFICACIÓN DE FACTORES',13),
 ('6.6','inscrito_crecimiento','si_no','select',1,NULL,NULL,N'¿Inscrito al programa de crecimiento y desarrollo?','6','6. IDENTIFICACIÓN DE FACTORES',14),
 ('6.7','esquema_vacunacion','si_no','select',1,NULL,NULL,N'¿Esquema de vacunación completo para la edad? (verificar en carné)','6','6. IDENTIFICACIÓN DE FACTORES',15),
 ('6.7.1','referido_por_carnet','si_no','select',0,'1','esquema_vacunacion',N'Referido por carné de vacunación','6','6. IDENTIFICACIÓN DE FACTORES',16),
 ('6.8','peso_actual',NULL,'number',1,NULL,NULL,N'Peso actual (kg, 1-50)','6','6. IDENTIFICACIÓN DE FACTORES',17),
 ('6.9','talla_actual',NULL,'number',1,NULL,NULL,N'Talla actual (cm, 45-150; el PDF dice "hasta 50", probable errata)','6','6. IDENTIFICACIÓN DE FACTORES',18),
 ('6.10','circunferencia_brazo',NULL,'number',1,NULL,NULL,N'Circunferencia media del brazo (cm, 6-30; de 6 a 59 meses)','6','6. IDENTIFICACIÓN DE FACTORES',19),

 -- 7. FACTORES DE RIESGO IDENTIFICADOS (numeración de la forma impresa, decisión confirmada; dicotómicas Sí/No, OBLIG no indicado -> 0)
 ('7.1','ganancia_peso_insuficiente','si_no','select',0,NULL,NULL,N'Ganancia de peso insuficiente (menores de 6 meses)','7','7. FACTORES DE RIESGO IDENTIFICADOS',20),
 ('7.2.1','curva_crecimiento','si_no','select',0,NULL,NULL,N'Aplanamiento o descenso en la curva de crecimiento (0-2 años)','7','7. FACTORES DE RIESGO IDENTIFICADOS',21),
 ('7.2.2','no_recuperacion_peso','si_no','select',0,NULL,NULL,N'No recuperación del peso al nacer en la tercera semana de vida (0-6 meses)','7','7. FACTORES DE RIESGO IDENTIFICADOS',22),
 ('7.3.1','anemia','si_no','select',0,NULL,NULL,N'Anemia','7','7. FACTORES DE RIESGO IDENTIFICADOS',23),
 ('7.3.2','antecedente_dnt','si_no','select',0,NULL,NULL,N'Antecedentes de desnutrición aguda con nuevo descenso de peso','7','7. FACTORES DE RIESGO IDENTIFICADOS',24),
 ('7.3.3','ira_eda','si_no','select',0,NULL,NULL,N'Episodios de IRA o EDA recientes','7','7. FACTORES DE RIESGO IDENTIFICADOS',25),
 ('7.3.4','dificultades_alimentacion','si_no','select',0,NULL,NULL,N'Dificultades en la alimentación (menores de 6 meses)','7','7. FACTORES DE RIESGO IDENTIFICADOS',26),
 ('7.3.5','practicas_alimentacion','si_no','select',0,NULL,NULL,N'Prácticas de alimentación inadecuadas (6-59 meses)','7','7. FACTORES DE RIESGO IDENTIFICADOS',27),
 ('7.3.6','perimetro_braquial','si_no','select',0,NULL,NULL,N'Perímetro braquial menor de 12,5 cm (6-59 meses)','7','7. FACTORES DE RIESGO IDENTIFICADOS',28),
 ('7.3.7','infecciones','si_no','select',0,NULL,NULL,N'Infecciones recurrentes o persistentes (6-59 meses)','7','7. FACTORES DE RIESGO IDENTIFICADOS',29),
 ('7.4.1','ausencia_madre','si_no','select',0,NULL,NULL,N'Ausencia permanente de la madre','7','7. FACTORES DE RIESGO IDENTIFICADOS',30),
 ('7.4.2','salud_cuidador','si_no','select',0,NULL,NULL,N'Problemas de salud física o mental del cuidador','7','7. FACTORES DE RIESGO IDENTIFICADOS',31),
 ('7.4.3','madre_adolescente','si_no','select',0,NULL,NULL,N'Madre adolescente sin red de apoyo','7','7. FACTORES DE RIESGO IDENTIFICADOS',32),
 ('7.5.1','vulnerabilidad_socioeconomica','si_no','select',0,NULL,NULL,N'Vulnerabilidad socioeconómica','7','7. FACTORES DE RIESGO IDENTIFICADOS',33),
 ('7.5.2','acceso_salud','si_no','select',0,NULL,NULL,N'Dificultad de acceso a los servicios de salud','7','7. FACTORES DE RIESGO IDENTIFICADOS',34),
 ('7.5.3','dos_mas_menores_inseguridad','si_no','select',0,NULL,NULL,N'Dos o más niños menores de 5 años en hogares con inseguridad alimentaria','7','7. FACTORES DE RIESGO IDENTIFICADOS',35),
 ('7.5.4','zona_riesgo_nutricional','si_no','select',0,NULL,NULL,N'Residencia en zona de riesgo nutricional','7','7. FACTORES DE RIESGO IDENTIFICADOS',36),
 ('7.6.1','prematurez','si_no','select',0,NULL,NULL,N'Antecedente de prematurez (0-2 años)','7','7. FACTORES DE RIESGO IDENTIFICADOS',37),
 ('7.6.2','bajo_peso_al_nacer','si_no','select',0,NULL,NULL,N'Antecedente de bajo peso al nacer (0-2 años)','7','7. FACTORES DE RIESGO IDENTIFICADOS',38),
 ('7.6.3','pequeno_para_edad_gestacional','si_no','select',0,NULL,NULL,N'Pequeño para la edad gestacional (0-2 años)','7','7. FACTORES DE RIESGO IDENTIFICADOS',39),

 -- 8. SIGNOS CLÍNICOS (7.1-7.6 del instructivo, renumerado, decisión confirmada)
 ('8.1','edema','si_no','select',1,NULL,NULL,N'¿Edema? (bilateral, inicia en miembros inferiores, compatible con Kwashiorkor)','8','8. SIGNOS CLÍNICOS',40),
 ('8.2','emaciacion','si_no','select',1,NULL,NULL,N'¿Desnutrición, emaciación o delgadez visible? (peso bajo para la talla)','8','8. SIGNOS CLÍNICOS',41),
 ('8.3','piel_reseca','si_no','select',1,NULL,NULL,N'¿Piel reseca o áspera?','8','8. SIGNOS CLÍNICOS',42),
 ('8.4','pigmentacion','si_no','select',1,NULL,NULL,N'¿Hipo o hiperpigmentación de la piel?','8','8. SIGNOS CLÍNICOS',43),
 ('8.5','cambios_cabello','si_no','select',1,NULL,NULL,N'¿Cambios en el cabello (signo bandera)?','8','8. SIGNOS CLÍNICOS',44),
 ('8.6','anemia_palidez','si_no','select',1,NULL,NULL,N'¿Anemia detectada por palidez palmar o de mucosas?','8','8. SIGNOS CLÍNICOS',45),

 -- 9. RUTA DE ATENCIÓN (8.1-8.3 del instructivo, renumerado, decisión confirmada)
 ('9.1','activacion_ruta','si_no','select',1,NULL,NULL,N'Activación de la ruta de atención','9','9. RUTA DE ATENCIÓN',46),
 ('9.2','tipo_atencion','tipo_atencion','select',0,NULL,NULL,N'Tipo de atención suministrada','9','9. RUTA DE ATENCIÓN',47),
 ('9.3','diagnostico_medico',NULL,'text',0,'1','tipo_atencion',N'Diagnóstico médico (CIE10), solo si la atención fue intrahospitalaria','9','9. RUTA DE ATENCIÓN',48);

-- Re-sembrado idempotente (evita choque con UX_detalles_ref al re-ejecutar)
DELETE FROM detalle_eventos WHERE evento_codigo = '114';
DELETE FROM detalle_eventos_respuestas WHERE ref LIKE '114[_]%';

INSERT INTO detalle_eventos (evento_codigo, seccion, subs, numero, ref, tipo, lista_ref, obligatorio, show_if, padre_ref, seccion_label, label, indice)
SELECT '114', d.seccion, NULL, d.numero,
       '114_' + d.slug, d.tipo,
       CASE WHEN d.lista_slug IS NULL THEN NULL ELSE '114_' + d.lista_slug END,
       d.obligatorio, d.show_if,
       CASE WHEN d.padre_slug IS NULL THEN NULL ELSE '114_' + d.padre_slug END,
       d.seccion_label, d.label, d.indice
FROM @defs d;
PRINT 'Preguntas evento 114 (riesgo por desnutrición) sembradas.';
