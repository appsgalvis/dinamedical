-- 30 personas ficticias para pruebas (listados sin paginación)
SET QUOTED_IDENTIFIER ON;
GO
USE dinamedical;
GO

DECLARE @ips_id INT = (SELECT TOP 1 id FROM ips ORDER BY id);
IF @ips_id IS NULL
BEGIN
    RAISERROR('No hay IPS en la base; cree una IPS antes.', 16, 1);
    RETURN;
END

;WITH datos AS (
    SELECT * FROM (VALUES
        (1,  'CC', '99001001', 'ANDRES',   'FELIPE',  'GOMEZ',     'LOPEZ',    '1990-03-15', 'M', '05', '05001'),
        (2,  'CC', '99001002', 'MARIA',    'CAMILA',  'RODRIGUEZ', 'PEREZ',    '1985-07-22', 'F', '05', '05001'),
        (3,  'CC', '99001003', 'CARLOS',   NULL,      'MARTINEZ',  'RUIZ',     '1978-11-08', 'M', '08', '08001'),
        (4,  'CC', '99001004', 'LAURA',    'SOFIA',   'HERRERA',   'DIAZ',     '1995-01-30', 'F', '11', '11001'),
        (5,  'CC', '99001005', 'JUAN',     'DAVID',   'CASTRO',    'MORENO',   '1982-09-12', 'M', '05', '05001'),
        (6,  'CC', '99001006', 'PAOLA',    NULL,      'VARGAS',    'SOTO',     '1992-04-05', 'F', '76', '76001'),
        (7,  'CC', '99001007', 'DIEGO',    'ALEJANDRO','RAMIREZ',  'TORRES',   '1988-12-19', 'M', '05', '05001'),
        (8,  'CC', '99001008', 'VALENTINA',NULL,      'MUNOZ',     'GIRALDO',  '2000-06-25', 'F', '05', '05001'),
        (9,  'CC', '99001009', 'SEBASTIAN',NULL,      'ORTIZ',     'CARDONA',  '1975-02-14', 'M', '05', '05001'),
        (10, 'CC', '99001010', 'CAMILA',   'ANDREA',  'RESTREPO',  'AGUDELO',  '1998-08-03', 'F', '05', '05001'),
        (11, 'CC', '99001011', 'NICOLAS',  NULL,      'ZAPATA',    'MEJIA',    '1991-10-11', 'M', '05', '05001'),
        (12, 'CC', '99001012', 'ISABELLA', 'MARIA',   'QUINTERO',  'VALENCIA', '1993-05-27', 'F', '05', '05001'),
        (13, 'CC', '99001013', 'SANTIAGO', NULL,      'ARBOLEDA',  'MONTOYA',  '1987-03-09', 'M', '05', '05001'),
        (14, 'CC', '99001014', 'DANIELA',  NULL,      'PALACIO',   'CORREA',   '1996-12-01', 'F', '05', '05001'),
        (15, 'CC', '99001015', 'MIGUEL',   'ANGEL',   'OSORIO',    'LONDOÑO',  '1980-07-18', 'M', '05', '05001'),
        (16, 'CC', '99001016', 'JULIANA',  NULL,      'BEDOYA',    'FRANCO',   '1994-09-21', 'F', '05', '05001'),
        (17, 'CC', '99001017', 'FELIPE',   NULL,      'GALLEGO',   'SALAZAR',  '1989-04-16', 'M', '05', '05001'),
        (18, 'CC', '99001018', 'NATALIA',  'PAOLA',   'MARIN',     'DUQUE',    '1997-11-30', 'F', '05', '05001'),
        (19, 'CC', '99001019', 'ESTEBAN',  NULL,      'RIOS',      'PARRA',    '1983-06-07', 'M', '05', '05001'),
        (20, 'CC', '99001020', 'ANDREA',   NULL,      'SUAREZ',    'VELASQUEZ','1999-02-28', 'F', '05', '05001'),
        (21, 'CC', '99001021', 'JORGE',    'LUIS',    'CANO',      'MESA',     '1976-08-22', 'M', '05', '05001'),
        (22, 'CC', '99001022', 'LUCIA',    NULL,      'HENAO',     'GUTIERREZ','2001-01-10', 'F', '05', '05001'),
        (23, 'CC', '99001023', 'RICARDO',  NULL,      'TOBON',     'ALVAREZ',  '1984-05-04', 'M', '05', '05001'),
        (24, 'CC', '99001024', 'CLAUDIA',  'PATRICIA','BETANCUR',  'LOAIZA',   '1990-10-15', 'F', '05', '05001'),
        (25, 'CC', '99001025', 'HERNAN',   NULL,      'ECHEVERRI', 'GARCES',   '1979-12-12', 'M', '05', '05001'),
        (26, 'CC', '99001026', 'MONICA',   NULL,      'LOPEZ',     'ARANGO',   '1986-03-03', 'F', '05', '05001'),
        (27, 'CC', '99001027', 'ALVARO',   'JAVIER',  'PINEDA',    'BOTERO',   '1992-07-07', 'M', '05', '05001'),
        (28, 'CC', '99001028', 'SANDRA',   'MILENA',  'CORTES',    'NIETO',    '1988-09-09', 'F', '05', '05001'),
        (29, 'CC', '99001029', 'RODRIGO',  NULL,      'VELASQUEZ', 'MOLINA',   '1995-04-20', 'M', '05', '05001'),
        (30, 'CC', '99001030', 'KAREN',    'DAYANA',  'OSPINA',    'JARAMILLO','1998-06-06', 'F', '05', '05001')
    ) AS t(n, tipo_doc, num_doc, pnom, snom, pap, sap, fnac, sexo, res_dep, res_mun)
)
INSERT INTO personas (
    tipo_documento_codigo, numero_documento, primer_nombre, segundo_nombre,
    primer_apellido, segundo_apellido, fecha_nacimiento, sexo_codigo,
    ips_id, activo, residencia_departamento, residencia_municipio
)
SELECT
    d.tipo_doc, d.num_doc, d.pnom, d.snom, d.pap, d.sap, d.fnac, d.sexo,
    @ips_id, 1, d.res_dep, d.res_mun
FROM datos d
WHERE NOT EXISTS (
    SELECT 1 FROM personas p
    WHERE p.tipo_documento_codigo = d.tipo_doc AND p.numero_documento = d.num_doc
);

PRINT CONCAT('Personas de prueba insertadas (IPS id=', @ips_id, '). Filas nuevas: ', @@ROWCOUNT);
GO

SELECT COUNT(*) AS total_personas FROM personas;
GO
