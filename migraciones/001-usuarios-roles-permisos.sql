-- ===========================================
-- MIGRACIÓN 001: Usuarios, Roles, Permisos, IPS
-- Sistema multi-IPS escalable
-- ===========================================

SET QUOTED_IDENTIFIER ON;
GO

USE dinamedical;
GO

-- ========== IPS (Instituciones Prestadoras de Salud) ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ips')
BEGIN
    CREATE TABLE ips (
        id INT IDENTITY(1,1) PRIMARY KEY,
        nombre NVARCHAR(200) NOT NULL,
        nit NVARCHAR(20),
        direccion NVARCHAR(500),
        telefono NVARCHAR(50),
        activo BIT DEFAULT 1,
        creado_en DATETIME2 DEFAULT GETDATE(),
        actualizado_en DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Tabla ips creada.';
END
GO

-- ========== ROLES ==========
-- admin_dinamedical: administra todo el sistema
-- admin_ips: administra su IPS (usuarios bajo su IPS)
-- parametrizador_ips: parametriza lo autorizado por admin
-- profesional_ips: médicos, especialistas, atención
-- facturador_ips: ver migración 016
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'roles')
BEGIN
    CREATE TABLE roles (
        id INT IDENTITY(1,1) PRIMARY KEY,
        codigo NVARCHAR(50) NOT NULL UNIQUE,
        nombre NVARCHAR(100) NOT NULL,
        descripcion NVARCHAR(500),
        nivel_sistema BIT DEFAULT 0,  -- 1 = admin_dinamedical (sin IPS)
        activo BIT DEFAULT 1,
        creado_en DATETIME2 DEFAULT GETDATE(),
        actualizado_en DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Tabla roles creada.';
END
GO

-- ========== PERMISOS (editables y agregables) ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'permisos')
BEGIN
    CREATE TABLE permisos (
        id INT IDENTITY(1,1) PRIMARY KEY,
        codigo NVARCHAR(100) NOT NULL UNIQUE,
        nombre NVARCHAR(150) NOT NULL,
        descripcion NVARCHAR(500),
        modulo NVARCHAR(50) NOT NULL,  -- usuarios, ips, parametros, atencion, etc.
        activo BIT DEFAULT 1,
        creado_en DATETIME2 DEFAULT GETDATE(),
        actualizado_en DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Tabla permisos creada.';
END
GO

-- ========== ROL_PERMISO (qué puede hacer cada rol) ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'rol_permiso')
BEGIN
    CREATE TABLE rol_permiso (
        rol_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permiso_id INT NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
        PRIMARY KEY (rol_id, permiso_id)
    );
    PRINT 'Tabla rol_permiso creada.';
END
GO

-- ========== USUARIOS ==========
-- ips_id NULL = admin_dinamedical (administra todo)
-- ips_id NOT NULL = usuario pertenece a esa IPS
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'usuarios')
BEGIN
    CREATE TABLE usuarios (
        id INT IDENTITY(1,1) PRIMARY KEY,
        email NVARCHAR(255) NOT NULL UNIQUE,
        clave_hash NVARCHAR(255) NOT NULL,
        nombre NVARCHAR(100) NOT NULL,
        apellido NVARCHAR(100) NOT NULL,
        activo BIT DEFAULT 1,
        ips_id INT REFERENCES ips(id) ON DELETE SET NULL,
        creado_por_id INT NULL,
        creado_en DATETIME2 DEFAULT GETDATE(),
        actualizado_en DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Tabla usuarios creada.';
END
GO

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'usuarios')
AND NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_usuarios_creado_por')
BEGIN
    ALTER TABLE usuarios ADD CONSTRAINT FK_usuarios_creado_por 
        FOREIGN KEY (creado_por_id) REFERENCES usuarios(id);
END
GO

-- ========== USUARIO_ROL (roles asignados a cada usuario) ==========
-- ips_id NULL = rol de sistema (admin_dinamedical)
-- ips_id NOT NULL = rol en contexto de esa IPS
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'usuario_rol')
BEGIN
    CREATE TABLE usuario_rol (
        id INT IDENTITY(1,1) PRIMARY KEY,
        usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        rol_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        ips_id INT REFERENCES ips(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX UX_usuario_rol_sistema ON usuario_rol(usuario_id, rol_id) WHERE ips_id IS NULL;
    CREATE UNIQUE INDEX UX_usuario_rol_ips ON usuario_rol(usuario_id, rol_id, ips_id) WHERE ips_id IS NOT NULL;
    PRINT 'Tabla usuario_rol creada.';
END
GO

-- ========== SESIONES (para login/tokens) ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'sesiones')
BEGIN
    CREATE TABLE sesiones (
        id INT IDENTITY(1,1) PRIMARY KEY,
        usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        token NVARCHAR(500) NOT NULL UNIQUE,
        expira_en DATETIME2 NOT NULL,
        activa BIT DEFAULT 1,
        creado_en DATETIME2 DEFAULT GETDATE()
    );
    CREATE INDEX IX_sesiones_token ON sesiones(token);
    CREATE INDEX IX_sesiones_usuario ON sesiones(usuario_id);
    PRINT 'Tabla sesiones creada.';
END
GO

-- ========== DATOS INICIALES: ROLES ==========
IF NOT EXISTS (SELECT 1 FROM roles WHERE codigo = 'admin_dinamedical')
    INSERT INTO roles (codigo, nombre, descripcion, nivel_sistema) VALUES
        ('admin_dinamedical', 'Administrador Dinamedical', 'Administra todo el sistema: IPS, roles, permisos de todas las IPS', 1),
        ('admin_ips', 'Administrador IPS', 'Administra usuarios y parámetros de su IPS', 0),
        ('parametrizador_ips', 'Parametrizador IPS', 'Parametriza lo autorizado por el administrador de su IPS', 0),
        ('profesional_ips', 'Profesional IPS', 'Médicos, especialistas para atención de pacientes', 0);
GO

-- ========== DATOS INICIALES: PERMISOS ==========
IF NOT EXISTS (SELECT 1 FROM permisos WHERE codigo = 'sistema.ver')
INSERT INTO permisos (codigo, nombre, descripcion, modulo) VALUES
    -- Sistema
    ('sistema.ver', 'Ver sistema', 'Acceso al sistema', 'sistema'),
    ('sistema.configurar', 'Configurar sistema', 'Configuración global', 'sistema'),
    -- IPS
    ('ips.crear', 'Crear IPS', 'Crear instituciones', 'ips'),
    ('ips.editar', 'Editar IPS', 'Modificar IPS', 'ips'),
    ('ips.ver', 'Ver IPS', 'Ver listado de IPS', 'ips'),
    ('ips.eliminar', 'Eliminar IPS', 'Eliminar instituciones', 'ips'),
    -- Usuarios
    ('usuarios.crear', 'Crear usuarios', 'Agregar usuarios a su IPS', 'usuarios'),
    ('usuarios.editar', 'Editar usuarios', 'Modificar usuarios de su IPS', 'usuarios'),
    ('usuarios.ver', 'Ver usuarios', 'Ver listado de usuarios', 'usuarios'),
    ('usuarios.eliminar', 'Eliminar usuarios', 'Eliminar usuarios de su IPS', 'usuarios'),
    ('usuarios.asignar_roles', 'Asignar roles', 'Asignar roles a usuarios', 'usuarios'),
    -- Roles
    ('roles.crear', 'Crear roles', 'Crear nuevos roles', 'roles'),
    ('roles.editar', 'Editar roles', 'Modificar roles y permisos', 'roles'),
    ('roles.ver', 'Ver roles', 'Ver roles del sistema', 'roles'),
    ('roles.eliminar', 'Eliminar roles', 'Eliminar roles', 'roles'),
    -- Permisos
    ('permisos.crear', 'Crear permisos', 'Crear nuevos permisos', 'permisos'),
    ('permisos.editar', 'Editar permisos', 'Modificar permisos', 'permisos'),
    ('permisos.ver', 'Ver permisos', 'Ver permisos del sistema', 'permisos'),
    -- Parámetros
    ('parametros.crear', 'Crear parámetros', 'Crear parámetros de IPS', 'parametros'),
    ('parametros.editar', 'Editar parámetros', 'Modificar parámetros', 'parametros'),
    ('parametros.ver', 'Ver parámetros', 'Ver parámetros', 'parametros'),
    -- Atención
    ('atencion.crear', 'Crear atención', 'Registrar atención a pacientes', 'atencion'),
    ('atencion.editar', 'Editar atención', 'Modificar registros de atención', 'atencion'),
    ('atencion.ver', 'Ver atención', 'Consultar atención', 'atencion');
GO

-- ========== ASIGNAR PERMISOS A ROLES ==========
-- Admin Dinamedical: todos los permisos
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.codigo = 'admin_dinamedical'
AND NOT EXISTS (SELECT 1 FROM rol_permiso rp WHERE rp.rol_id = r.id AND rp.permiso_id = p.id);
GO

-- Admin IPS: ips (solo ver/editar la suya), usuarios, parametros, atencion
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.codigo = 'admin_ips'
AND p.codigo IN ('ips.ver', 'usuarios.crear', 'usuarios.editar', 'usuarios.ver', 'usuarios.eliminar', 'usuarios.asignar_roles', 
    'parametros.crear', 'parametros.editar', 'parametros.ver', 'atencion.ver', 'sistema.ver', 'roles.ver')
AND NOT EXISTS (SELECT 1 FROM rol_permiso rp WHERE rp.rol_id = r.id AND rp.permiso_id = p.id);
GO

-- Parametrizador IPS: parametros, atencion ver
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.codigo = 'parametrizador_ips'
AND p.codigo IN ('parametros.crear', 'parametros.editar', 'parametros.ver', 'atencion.ver', 'sistema.ver')
AND NOT EXISTS (SELECT 1 FROM rol_permiso rp WHERE rp.rol_id = r.id AND rp.permiso_id = p.id);
GO

-- Profesional IPS: atencion
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.codigo = 'profesional_ips'
AND p.codigo IN ('atencion.crear', 'atencion.editar', 'atencion.ver', 'sistema.ver')
AND NOT EXISTS (SELECT 1 FROM rol_permiso rp WHERE rp.rol_id = r.id AND rp.permiso_id = p.id);
GO

PRINT 'Migración 001 completada.';
