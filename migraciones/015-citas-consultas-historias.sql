-- ===========================================
-- MIGRACIÓN 015: Citas, consultas (datos básicos SIVIGILA), historias clínicas,
-- DIVIPOLA municipios, catálogo síntomas
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== DIVIPOLA (departamentos y municipios) ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'divipola')
BEGIN
    CREATE TABLE divipola (
        id INT IDENTITY(1,1) PRIMARY KEY,
        codigo_departamento NVARCHAR(2) NOT NULL,
        nombre_departamento NVARCHAR(100) NOT NULL,
        codigo_municipio NVARCHAR(5) NOT NULL,
        nombre_municipio NVARCHAR(150) NOT NULL,
        activo BIT DEFAULT 1,
        CONSTRAINT UX_divipola_municipio UNIQUE (codigo_municipio)
    );
    CREATE INDEX IX_divipola_departamento ON divipola(codigo_departamento);
    PRINT 'Tabla divipola creada.';
END
GO

-- Muestra inicial (ampliar con carga DIVIPOLA completa del DANE)
IF NOT EXISTS (SELECT 1 FROM divipola)
BEGIN
    INSERT INTO divipola (codigo_departamento, nombre_departamento, codigo_municipio, nombre_municipio) VALUES
        ('05', 'Antioquia', '05001', 'Medellín'),
        ('05', 'Antioquia', '05088', 'Bello'),
        ('05', 'Antioquia', '05360', 'Itagüí'),
        ('08', 'Atlántico', '08001', 'Barranquilla'),
        ('11', 'Bogotá D.C.', '11001', 'Bogotá D.C.'),
        ('13', 'Bolívar', '13001', 'Cartagena'),
        ('15', 'Boyacá', '15001', 'Tunja'),
        ('17', 'Caldas', '17001', 'Manizales'),
        ('19', 'Cauca', '19001', 'Popayán'),
        ('20', 'Cesar', '20001', 'Valledupar'),
        ('23', 'Córdoba', '23001', 'Montería'),
        ('25', 'Cundinamarca', '25001', 'Agua de Dios'),
        ('25', 'Cundinamarca', '25754', 'Soacha'),
        ('27', 'Chocó', '27001', 'Quibdó'),
        ('41', 'Huila', '41001', 'Neiva'),
        ('44', 'La Guajira', '44001', 'Riohacha'),
        ('47', 'Magdalena', '47001', 'Santa Marta'),
        ('50', 'Meta', '50001', 'Villavicencio'),
        ('52', 'Nariño', '52001', 'Pasto'),
        ('54', 'Norte de Santander', '54001', 'Cúcuta'),
        ('63', 'Quindío', '63001', 'Armenia'),
        ('66', 'Risaralda', '66001', 'Pereira'),
        ('68', 'Santander', '68001', 'Bucaramanga'),
        ('70', 'Sucre', '70001', 'Sincelejo'),
        ('73', 'Tolima', '73001', 'Ibagué'),
        ('76', 'Valle del Cauca', '76001', 'Cali'),
        ('81', 'Arauca', '81001', 'Arauca'),
        ('85', 'Casanare', '85001', 'Yopal'),
        ('86', 'Putumayo', '86001', 'Mocoa'),
        ('88', 'San Andrés', '88001', 'San Andrés'),
        ('91', 'Amazonas', '91001', 'Leticia'),
        ('94', 'Guainía', '94001', 'Inírida'),
        ('95', 'Guaviare', '95001', 'San José del Guaviare'),
        ('97', 'Vaupés', '97001', 'Mitú'),
        ('99', 'Vichada', '99001', 'Puerto Carreño');
    PRINT 'Datos iniciales divipola insertados.';
END
GO

-- ========== CATÁLOGO SÍNTOMAS ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'catalogo_sintomas')
BEGIN
    CREATE TABLE catalogo_sintomas (
        id INT IDENTITY(1,1) PRIMARY KEY,
        codigo NVARCHAR(20) NULL,
        nombre NVARCHAR(200) NOT NULL,
        ips_id INT NULL REFERENCES ips(id) ON DELETE CASCADE,
        activo BIT DEFAULT 1,
        creado_en DATETIME2 DEFAULT GETDATE()
    );
    CREATE INDEX IX_catalogo_sintomas_ips ON catalogo_sintomas(ips_id);
    PRINT 'Tabla catalogo_sintomas creada.';
END
GO

IF NOT EXISTS (SELECT 1 FROM catalogo_sintomas WHERE ips_id IS NULL)
BEGIN
    INSERT INTO catalogo_sintomas (codigo, nombre, ips_id) VALUES
        ('FIE', 'Fiebre', NULL),
        ('TOS', 'Tos', NULL),
        ('CEF', 'Cefalea', NULL),
        ('DIS', 'Disnea', NULL),
        ('NAU', 'Náuseas', NULL),
        ('VOM', 'Vómito', NULL),
        ('DIA', 'Diarrea', NULL),
        ('RASH', 'Erupción cutánea', NULL),
        ('MAL', 'Malestar general', NULL),
        ('OTR', 'Otros síntomas', NULL);
END
GO

-- ========== CONSULTAS (ficha datos básicos — campos variables en JSON) ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'consultas')
BEGIN
    CREATE TABLE consultas (
        id INT IDENTITY(1,1) PRIMARY KEY,
        ips_id INT NOT NULL REFERENCES ips(id),
        paciente_persona_id INT NOT NULL REFERENCES personas(id_persona),
        profesional_usuario_id INT NOT NULL REFERENCES usuarios(id),
        cita_id INT NULL,
        codigo_evento NVARCHAR(20) NULL,
        nombre_evento NVARCHAR(200) NULL,
        datos_basicos NVARCHAR(MAX) NULL,
        estado NVARCHAR(30) DEFAULT 'borrador',
        creado_en DATETIME2 DEFAULT GETDATE(),
        actualizado_en DATETIME2 DEFAULT GETDATE()
    );
    CREATE INDEX IX_consultas_ips ON consultas(ips_id);
    CREATE INDEX IX_consultas_paciente ON consultas(paciente_persona_id);
    PRINT 'Tabla consultas creada.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'consulta_sintomas')
BEGIN
    CREATE TABLE consulta_sintomas (
        consulta_id INT NOT NULL REFERENCES consultas(id) ON DELETE CASCADE,
        sintoma_id INT NOT NULL REFERENCES catalogo_sintomas(id),
        PRIMARY KEY (consulta_id, sintoma_id)
    );
    PRINT 'Tabla consulta_sintomas creada.';
END
GO

-- ========== HISTORIAS CLÍNICAS ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'historias_clinicas')
BEGIN
    CREATE TABLE historias_clinicas (
        id INT IDENTITY(1,1) PRIMARY KEY,
        ips_id INT NOT NULL REFERENCES ips(id),
        paciente_persona_id INT NOT NULL REFERENCES personas(id_persona),
        profesional_usuario_id INT NOT NULL REFERENCES usuarios(id),
        consulta_id INT NULL REFERENCES consultas(id) ON DELETE SET NULL,
        sintomas_texto NVARCHAR(MAX) NULL,
        resumen_clinico NVARCHAR(MAX) NULL,
        creado_en DATETIME2 DEFAULT GETDATE(),
        actualizado_en DATETIME2 DEFAULT GETDATE()
    );
    CREATE INDEX IX_historias_paciente ON historias_clinicas(paciente_persona_id);
    PRINT 'Tabla historias_clinicas creada.';
END
GO

-- ========== CITAS ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'citas')
BEGIN
    CREATE TABLE citas (
        id INT IDENTITY(1,1) PRIMARY KEY,
        ips_id INT NOT NULL REFERENCES ips(id),
        paciente_persona_id INT NOT NULL REFERENCES personas(id_persona),
        medico_usuario_id INT NOT NULL REFERENCES usuarios(id),
        registrado_por_usuario_id INT NOT NULL REFERENCES usuarios(id),
        fecha DATE NOT NULL,
        hora TIME(0) NOT NULL,
        duracion_minutos INT NOT NULL DEFAULT 30,
        tipo_atencion NVARCHAR(20) NOT NULL DEFAULT 'consultorio',
        direccion_cita NVARCHAR(500) NULL,
        ubicacion_id INT NULL REFERENCES ubicaciones(id) ON DELETE SET NULL,
        consulta_id INT NULL,
        observaciones NVARCHAR(500) NULL,
        activo BIT DEFAULT 1,
        creado_en DATETIME2 DEFAULT GETDATE(),
        actualizado_en DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT CK_citas_tipo CHECK (tipo_atencion IN ('consultorio', 'domicilio'))
    );
    CREATE INDEX IX_citas_fecha ON citas(ips_id, fecha);
    CREATE UNIQUE INDEX UX_citas_medico_hora ON citas(medico_usuario_id, fecha, hora) WHERE activo = 1;
    PRINT 'Tabla citas creada.';
END
GO

-- FK consulta <-> cita (después de crear citas)
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_consultas_cita')
BEGIN
    ALTER TABLE consultas ADD CONSTRAINT FK_consultas_cita
        FOREIGN KEY (cita_id) REFERENCES citas(id) ON DELETE SET NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_citas_consulta')
BEGIN
    ALTER TABLE citas ADD CONSTRAINT FK_citas_consulta
        FOREIGN KEY (consulta_id) REFERENCES consultas(id) ON DELETE SET NULL;
END
GO

-- ========== PERMISOS ==========
IF NOT EXISTS (SELECT 1 FROM permisos WHERE codigo = 'citas.ver')
BEGIN
    INSERT INTO permisos (codigo, nombre, descripcion, modulo) VALUES
        ('citas.ver', 'Ver citas', 'Ver agenda y citas de la IPS', 'citas'),
        ('citas.crear', 'Crear citas', 'Agendar citas', 'citas'),
        ('citas.editar', 'Editar citas', 'Modificar o cancelar citas', 'citas'),
        ('consultas.ver', 'Ver consultas', 'Ver fichas de consulta', 'consultas'),
        ('consultas.crear', 'Crear consultas', 'Diligenciar consultas', 'consultas'),
        ('consultas.editar', 'Editar consultas', 'Modificar consultas', 'consultas'),
        ('historias.ver', 'Ver historias clínicas', 'Ver historias clínicas', 'historias'),
        ('historias.crear', 'Crear historias clínicas', 'Registrar historias clínicas', 'historias'),
        ('historias.editar', 'Editar historias clínicas', 'Modificar historias clínicas', 'historias'),
        ('listas.editar', 'Editar listas maestras', 'Administrar opciones de formularios', 'catalogos');
END
GO

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.codigo = 'admin_dinamedical'
AND p.codigo IN ('citas.ver','citas.crear','citas.editar','consultas.ver','consultas.crear','consultas.editar',
    'historias.ver','historias.crear','historias.editar','listas.editar')
AND NOT EXISTS (SELECT 1 FROM rol_permiso rp WHERE rp.rol_id = r.id AND rp.permiso_id = p.id);
GO

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.codigo = 'admin_ips'
AND p.codigo IN ('citas.ver','citas.crear','citas.editar','consultas.ver','consultas.crear','consultas.editar',
    'historias.ver','historias.crear','historias.editar','listas.editar','personas.ver','personas.editar')
AND NOT EXISTS (SELECT 1 FROM rol_permiso rp WHERE rp.rol_id = r.id AND rp.permiso_id = p.id);
GO

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.codigo = 'parametrizador_ips'
AND p.codigo IN ('citas.ver','consultas.ver','historias.ver','listas.editar','parametros.ver','parametros.editar')
AND NOT EXISTS (SELECT 1 FROM rol_permiso rp WHERE rp.rol_id = r.id AND rp.permiso_id = p.id);
GO

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.codigo = 'profesional_ips'
AND p.codigo IN ('citas.ver','citas.crear','citas.editar','consultas.ver','consultas.crear','consultas.editar',
    'historias.ver','historias.crear','historias.editar','personas.ver','personas.editar','atencion.ver','atencion.crear','atencion.editar')
AND NOT EXISTS (SELECT 1 FROM rol_permiso rp WHERE rp.rol_id = r.id AND rp.permiso_id = p.id);
GO

-- ========== LISTAS SIVIGILA (datos básicos — seleccionables) ==========
IF NOT EXISTS (SELECT 1 FROM listas WHERE formulario = 'datos_basicos' AND ref = 'tipo_documento_sivigila')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice) VALUES
        ('Registro civil', 'RC', 'tipo_documento_sivigila', 'datos_basicos', 'tipo_documento', 1),
        ('Tarjeta identidad', 'TI', 'tipo_documento_sivigila', 'datos_basicos', 'tipo_documento', 2),
        ('Cédula ciudadanía', 'CC', 'tipo_documento_sivigila', 'datos_basicos', 'tipo_documento', 3),
        ('Cédula extranjería', 'CE', 'tipo_documento_sivigila', 'datos_basicos', 'tipo_documento', 4),
        ('Pasaporte', 'PA', 'tipo_documento_sivigila', 'datos_basicos', 'tipo_documento', 5),
        ('Menor sin ID', 'MS', 'tipo_documento_sivigila', 'datos_basicos', 'tipo_documento', 6),
        ('Adulto sin ID', 'AS', 'tipo_documento_sivigila', 'datos_basicos', 'tipo_documento', 7),
        ('Permiso especial permanencia', 'PE', 'tipo_documento_sivigila', 'datos_basicos', 'tipo_documento', 8),
        ('Certificado nacido vivo', 'CN', 'tipo_documento_sivigila', 'datos_basicos', 'tipo_documento', 9),
        ('Carné diplomático', 'CD', 'tipo_documento_sivigila', 'datos_basicos', 'tipo_documento', 10),
        ('Salvoconducto', 'SC', 'tipo_documento_sivigila', 'datos_basicos', 'tipo_documento', 11),
        ('Documento extranjero', 'DE', 'tipo_documento_sivigila', 'datos_basicos', 'tipo_documento', 12),
        ('Permiso protección temporal', 'PT', 'tipo_documento_sivigila', 'datos_basicos', 'tipo_documento', 13);
END
GO

IF NOT EXISTS (SELECT 1 FROM listas WHERE ref = 'unidad_medida_edad')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice) VALUES
        ('No aplica', '0', 'unidad_medida_edad', 'datos_basicos', 'unidad_medida_edad', 1),
        ('Años', '1', 'unidad_medida_edad', 'datos_basicos', 'unidad_medida_edad', 2),
        ('Meses', '2', 'unidad_medida_edad', 'datos_basicos', 'unidad_medida_edad', 3),
        ('Días', '3', 'unidad_medida_edad', 'datos_basicos', 'unidad_medida_edad', 4),
        ('Horas', '4', 'unidad_medida_edad', 'datos_basicos', 'unidad_medida_edad', 5),
        ('Minutos', '5', 'unidad_medida_edad', 'datos_basicos', 'unidad_medida_edad', 6);
END
GO

IF NOT EXISTS (SELECT 1 FROM listas WHERE ref = 'sexo_sivigila')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice) VALUES
        ('Hombre', 'M', 'sexo_sivigila', 'datos_basicos', 'sexo', 1),
        ('Mujer', 'F', 'sexo_sivigila', 'datos_basicos', 'sexo', 2),
        ('Indeterminado', 'I', 'sexo_sivigila', 'datos_basicos', 'sexo', 3);
END
GO

IF NOT EXISTS (SELECT 1 FROM listas WHERE ref = 'area_procedencia')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice) VALUES
        ('Cabecera municipal', '1', 'area_procedencia', 'datos_basicos', 'area_procedencia', 1),
        ('Centro poblado', '2', 'area_procedencia', 'datos_basicos', 'area_procedencia', 2),
        ('Rural disperso', '3', 'area_procedencia', 'datos_basicos', 'area_procedencia', 3);
END
GO

IF NOT EXISTS (SELECT 1 FROM listas WHERE ref = 'regimen_salud')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice) VALUES
        ('Excepción', 'P', 'regimen_salud', 'datos_basicos', 'regimen_salud', 1),
        ('Especial', 'E', 'regimen_salud', 'datos_basicos', 'regimen_salud', 2),
        ('Contributivo', 'C', 'regimen_salud', 'datos_basicos', 'regimen_salud', 3),
        ('Subsidiado', 'S', 'regimen_salud', 'datos_basicos', 'regimen_salud', 4),
        ('No asegurado', 'N', 'regimen_salud', 'datos_basicos', 'regimen_salud', 5),
        ('Indeterminado/pendiente', 'I', 'regimen_salud', 'datos_basicos', 'regimen_salud', 6);
END
GO

IF NOT EXISTS (SELECT 1 FROM listas WHERE ref = 'pertenencia_etnica')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice) VALUES
        ('Indígena', '1', 'pertenencia_etnica', 'datos_basicos', 'pertenencia_etnica', 1),
        ('Rom, Gitano', '2', 'pertenencia_etnica', 'datos_basicos', 'pertenencia_etnica', 2),
        ('Raizal', '3', 'pertenencia_etnica', 'datos_basicos', 'pertenencia_etnica', 3),
        ('Palenquero', '4', 'pertenencia_etnica', 'datos_basicos', 'pertenencia_etnica', 4),
        ('Negro, mulato, afrocolombiano', '5', 'pertenencia_etnica', 'datos_basicos', 'pertenencia_etnica', 5),
        ('Otro', '6', 'pertenencia_etnica', 'datos_basicos', 'pertenencia_etnica', 6);
END
GO

IF NOT EXISTS (SELECT 1 FROM listas WHERE ref = 'fuente_notificacion')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice) VALUES
        ('Notificación rutinaria', '1', 'fuente_notificacion', 'datos_basicos', 'fuente', 1),
        ('Búsqueda activa institucional', '2', 'fuente_notificacion', 'datos_basicos', 'fuente', 2),
        ('Vigilancia intensificada', '3', 'fuente_notificacion', 'datos_basicos', 'fuente', 3),
        ('Búsqueda activa comunitaria', '4', 'fuente_notificacion', 'datos_basicos', 'fuente', 4),
        ('Investigaciones', '5', 'fuente_notificacion', 'datos_basicos', 'fuente', 5);
END
GO

IF NOT EXISTS (SELECT 1 FROM listas WHERE ref = 'clasificacion_inicial_caso')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice) VALUES
        ('Sospechoso', '1', 'clasificacion_inicial_caso', 'datos_basicos', 'clasificacion_inicial', 1),
        ('Probable', '2', 'clasificacion_inicial_caso', 'datos_basicos', 'clasificacion_inicial', 2),
        ('Conf. por laboratorio', '3', 'clasificacion_inicial_caso', 'datos_basicos', 'clasificacion_inicial', 3),
        ('Conf. clínica', '4', 'clasificacion_inicial_caso', 'datos_basicos', 'clasificacion_inicial', 4),
        ('Conf. nexo epidemiológico', '5', 'clasificacion_inicial_caso', 'datos_basicos', 'clasificacion_inicial', 5);
END
GO

IF NOT EXISTS (SELECT 1 FROM listas WHERE ref = 'condicion_final')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice) VALUES
        ('No sabe / no responde', '0', 'condicion_final', 'datos_basicos', 'condicion_final', 1),
        ('Vivo', '1', 'condicion_final', 'datos_basicos', 'condicion_final', 2),
        ('Muerto', '2', 'condicion_final', 'datos_basicos', 'condicion_final', 3);
END
GO

IF NOT EXISTS (SELECT 1 FROM listas WHERE ref = 'identidad_genero')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice) VALUES
        ('Hombre', '1', 'identidad_genero', 'datos_basicos', 'identidad_genero', 1),
        ('Mujer', '2', 'identidad_genero', 'datos_basicos', 'identidad_genero', 2),
        ('Hombre trans', '3', 'identidad_genero', 'datos_basicos', 'identidad_genero', 3),
        ('Mujer trans', '4', 'identidad_genero', 'datos_basicos', 'identidad_genero', 4),
        ('Otra', '5', 'identidad_genero', 'datos_basicos', 'identidad_genero', 5);
END
GO

IF NOT EXISTS (SELECT 1 FROM listas WHERE ref = 'orientacion_sexual')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice) VALUES
        ('Heterosexual', '1', 'orientacion_sexual', 'datos_basicos', 'orientacion_sexual', 1),
        ('Gay/Lesbiana', '2', 'orientacion_sexual', 'datos_basicos', 'orientacion_sexual', 2),
        ('Bisexual', '3', 'orientacion_sexual', 'datos_basicos', 'orientacion_sexual', 3),
        ('Otra', '4', 'orientacion_sexual', 'datos_basicos', 'orientacion_sexual', 4);
END
GO

IF NOT EXISTS (SELECT 1 FROM listas WHERE ref = 'grupos_poblacionales')
BEGIN
    INSERT INTO listas (label, value, ref, formulario, campo, indice) VALUES
        ('Personas en condición de discapacidad', 'discapacidad', 'grupos_poblacionales', 'datos_basicos', 'grupos_poblacionales', 1),
        ('Desplazados', 'desplazados', 'grupos_poblacionales', 'datos_basicos', 'grupos_poblacionales', 2),
        ('Migrantes', 'migrantes', 'grupos_poblacionales', 'datos_basicos', 'grupos_poblacionales', 3),
        ('Personas privadas de la libertad', 'ppl', 'grupos_poblacionales', 'datos_basicos', 'grupos_poblacionales', 4),
        ('Gestantes', 'gestantes', 'grupos_poblacionales', 'datos_basicos', 'grupos_poblacionales', 5),
        ('Habitantes de la calle', 'calle', 'grupos_poblacionales', 'datos_basicos', 'grupos_poblacionales', 6),
        ('Población infantil a cargo del ICBF', 'icbf', 'grupos_poblacionales', 'datos_basicos', 'grupos_poblacionales', 7),
        ('Madres comunitarias', 'madres_com', 'grupos_poblacionales', 'datos_basicos', 'grupos_poblacionales', 8),
        ('Desmovilizados', 'desmovilizados', 'grupos_poblacionales', 'datos_basicos', 'grupos_poblacionales', 9),
        ('Centros psiquiátricos', 'psiquiatricos', 'grupos_poblacionales', 'datos_basicos', 'grupos_poblacionales', 10),
        ('Víctimas de violencia armada', 'victimas', 'grupos_poblacionales', 'datos_basicos', 'grupos_poblacionales', 11),
        ('Otros grupos poblacionales', 'otros', 'grupos_poblacionales', 'datos_basicos', 'grupos_poblacionales', 12);
END
GO

PRINT 'Migración 015 completada.';
