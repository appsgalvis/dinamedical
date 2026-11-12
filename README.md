# Dinamedical - Software IPS

Sistema para Institución Prestadora de Salud. API + Frontend en contenedor separado.

## Contexto académico (prototipo)

Este software forma parte del **prototipo** del entregable **Fase 4 — Componente práctico (práctica simulada)** del **proyecto de grado** (curso 202016907), programa **Ingeniería de Sistemas**, **UNAD** (ECBTI).

| Rol | Nombre |
|-----|--------|
| Investigador principal | Cristian Johan Galvis Bernal |
| Coinvestigador | Santiago Andrés Riaño Mogollón |

El aviso también aparece en el frontend (pantalla de inicio de sesión y esquina de la aplicación) para dejar claro el carácter académico del sistema.

## Arquitectura

```text
Navegador (SPA estática)
    │
    ▼
nginx (solucion-digital.com) ──► dinamedical:3002
    │                              ├── /api/*  Express + JWT + permisos por rol
    │                              └── /       archivos en front/
    ▼
MSSQL (base dinamedical, contenedor compartido mssql_web-api)
```

- **Capa de presentación:** SPA sin framework (`front/index.html`, `app.js`, `atencion.js`, `fichas-sivigila.js`), tema configurable y vistas por módulo (personas, citas, consultas, historias, fichas SIVIGILA).
- **Capa de API:** Node.js + Express (`servidor.js`), rutas por dominio en `rutas/`, autenticación JWT y middleware `requierePermiso` en `middleware/auth.js`.
- **Capa de datos:** Azure SQL Edge / MSSQL, pool en `configuracion/baseDatos.js`, esquema versionado con scripts numerados en `migraciones/`.
- **Multi-IPS:** cada usuario pertenece a una IPS (`ips`); los roles del sistema (`roles`, `permisos`, `rol_permiso`) limitan qué módulos y acciones ve cada perfil (administrador, médico, facturador, etc.).
- **Despliegue:** imagen Docker del servicio `dinamedical` en el compose del stack; tráfico público vía `https://dinamedical.solucion-digital.com` (proxy SSL en nginx).

## Organización de la base de datos

Las migraciones se aplican en orden (`migraciones/001-…` hasta `043-…`). Agrupadas por dominio:

| Dominio | Tablas / objetos principales | Migraciones (referencia) |
|--------|------------------------------|---------------------------|
| Seguridad y tenancy | `ips`, `usuarios`, `roles`, `permisos`, `rol_permiso`, `usuario_rol` | 001, 016, 021–023 |
| Personas y ubicación | `personas`, `ubicaciones`, `telefonos`, vistas de apoyo | 003, 005–013, 019–020 |
| Catálogos editables | `listas` (opciones de formularios: documento, sexo, campos de eventos, etc.) | 004, 006 |
| Atención clínica | `citas`, `consultas`, `historias_clinicas`, signos vitales | 015, 024 |
| Vigilancia en salud pública | `tipo_evento`, `ficha_datos_basicos`, `detalle_eventos`, `detalle_eventos_respuestas` | 017, 025, 026, 027–043 |

Convenciones relevantes:

- **`personas`** centraliza datos demográficos; pacientes y funcionarios se distinguen por relación con la IPS y el contexto de uso.
- **`listas`** alimenta selects y multiselects; muchas opciones de fichas SIVIGILA referencian `lista_ref` en lugar de valores fijos en código.
- **`ficha_datos_basicos`** guarda la notificación estándar (una fila por `consulta_id`, columnas por campo de la ficha impresa).
- Los scripts en `scripts/` (p. ej. `sincronizar-tipo-evento-desde-sivigila.js`) cargan o actualizan catálogos desde fuentes externas después de crear las tablas.

## Cargue dinámico de eventos en salud pública (SIVIGILA)

El sistema no codifica cada ficha en el frontend de forma rígida. El flujo es **metadatos en base de datos + formulario generado en tiempo de ejecución**:

1. **Catálogo de eventos** (`tipo_evento`): códigos y nombres de eventos de notificación (p. ej. dengue `210`, cólera `200`, hepatitis B `340`). Se sincroniza con herramientas en `scripts/`.
2. **Datos básicos** (`ficha_datos_basicos`): al atender una consulta, se persisten los campos comunes de la notificación (identificación del caso, UPGD, fechas, clasificación inicial, etc.).
3. **Definición del evento** (`detalle_eventos`): por cada `evento_codigo`, filas que describen preguntas (sección, etiqueta, `tipo` de control, obligatoriedad, visibilidad condicional `show_if` / `padre_ref`, enlace a `listas`).
4. **Respuestas** (`detalle_eventos_respuestas`): valores por `consulta_id` y `ref` de pregunta (multiselect como JSON).

**API (ejemplos):**

- `GET /api/detalles-eventos/def/:evento` — estructura del formulario + opciones resueltas desde `listas`.
- `GET/POST /api/detalles-eventos/respuestas` — lectura y guardado por consulta.

**Frontend:**

- En **Consultas / atención** (`atencion.js`), al elegir el tipo de evento se llama `cargarDetallesEvento(codigo)`, que pinta el panel lateral con preguntas dinámicas y persiste con POST.
- En **Fichas SIVIGILA** (`fichas-sivigila.js`), la grilla lista fichas de datos básicos y el modal combina la ficha con los detalles del evento cargados por la misma API.

**Ampliar un evento nuevo:** añadir migración `migraciones/0XX-detalles-<evento>-<codigo>.sql` que inserte filas en `detalle_eventos` y, si aplica, opciones en `listas`. Sin cambiar la lógica del cliente salvo etiquetas o reglas de negocio nuevas. El evento `100` (accidente ofídico) y decenas de códigos INS están modelados en migraciones `027`–`043` y documentados en `RECORDATORIOS-POR-EVENTO.md`.

## Estructura del repositorio

- **API**: `dinamedical/` - Express + MSSQL (puerto 3002)
- **Frontend**: `dinamedical/front/` - Página estática (carpeta interna)
- **Migraciones**: `migraciones/`
- **Scripts SQL / datos**: `scripts/`
- **Fichas y referencias**: `fichas/`, `protocolos/`
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
