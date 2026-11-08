# Dinamedical - Software IPS

Sistema para Institución Prestadora de Salud. API + Frontend en contenedor separado.

## Estructura

- **API**: `dinamedical/` - Express + MSSQL (puerto 3002)
- **Frontend**: `dinamedical/front/` - Página estática (carpeta interna)
- **Contenedor**: `dinamedical-web-api`
- **Base de datos**: `dinamedical` en MSSQL (contenedor compartido mssql_web-api)

## Subdominio

`https://dinamedical.solucion-digital.com`

## Crear base de datos en MSSQL

1. Base inicial (configuracion):
```powershell
.\scripts\ejecutar-dinamedical-sql.ps1
```

2. Migración 001 (usuarios, roles, permisos, IPS) + admin inicial:
```powershell
.\scripts\ejecutar-migracion-001-dinamedical.ps1
```

3. Migración 003 (personas - entidad centralizada para datos de usuario):
```powershell
.\scripts\ejecutar-migracion-003-dinamedical.ps1
```

4. Migración 004 (listas - opciones de formularios: tipo documento, sexo, etc.):
```powershell
.\scripts\ejecutar-migracion-004-dinamedical.ps1
```

5. Migración 005 (ubicaciones, vista personas - tipo paciente/funcionario):
```powershell
.\scripts\ejecutar-migracion-005-dinamedical.ps1
```

6. Migración 006 (eliminar tablas obsoletas: tipo_documento, sexo - ahora se usa listas):
```powershell
.\scripts\ejecutar-migracion-006-dinamedical.ps1
```

## Usuario administrador inicial

- **Email**: admin@dinamedical.com
- **Clave**: Admin123!
- **Rol**: Administrador Dinamedical (acceso total)

Cambiar la clave después del primer login.

## Levantar

```bash
docker compose up -d --build dinamedical
```

## Certificado SSL para el subdominio

Si usas Let's Encrypt con certificado wildcard `*.solucion-digital.com`, ya está cubierto. Si no, agrega el subdominio al certbot:

```bash
certbot certonly --expand -d solucion-digital.com -d dinamedical.solucion-digital.com ...
```
