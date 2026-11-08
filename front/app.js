// Dinamedical - Cliente SPA
const API = '/api';
const TEMA_KEY = 'dinamedical_tema';
const TEMA_DEFAULT = 'oscuro-verde';

let usuarioActual = null;
let token = null;

function aplicarTema(tema) {
    const t = tema || TEMA_DEFAULT;
    document.documentElement.setAttribute('data-tema', t);
    localStorage.setItem(TEMA_KEY, t);
    document.querySelectorAll('.tema-btn').forEach(btn => {
        btn.classList.toggle('activo', btn.dataset.tema === t);
    });
}

const TEMAS_VALIDOS = ['oscuro-verde','oscuro-azul','oscuro-morado','oscuro-gris','oscuro-magenta','claro-verde','claro-azul','claro-morado','claro-gris','claro-blanco','claro-magenta'];
const TEMAS_LEGACY = { verde:'oscuro-verde', azul:'oscuro-azul', morado:'oscuro-morado', gris:'oscuro-gris', blanco:'claro-blanco', magenta:'oscuro-magenta' };

function cargarTemaGuardado() {
    let guardado = localStorage.getItem(TEMA_KEY) || TEMA_DEFAULT;
    if (TEMAS_LEGACY[guardado]) guardado = TEMAS_LEGACY[guardado];
    if (!TEMAS_VALIDOS.includes(guardado)) guardado = TEMA_DEFAULT;
    aplicarTema(guardado);
}

function obtenerToken() {
    return token || localStorage.getItem('dinamedical_token');
}

function guardarSesion(tok, usuario) {
    token = tok;
    usuarioActual = usuario;
    localStorage.setItem('dinamedical_token', tok);
    localStorage.setItem('dinamedical_usuario', JSON.stringify(usuario));
}

function cerrarSesion() {
    token = null;
    usuarioActual = null;
    localStorage.removeItem('dinamedical_token');
    localStorage.removeItem('dinamedical_usuario');
    mostrarVista('login');
}

function cargarSesion() {
    const tok = obtenerToken();
    if (!tok) return false;
    const u = localStorage.getItem('dinamedical_usuario');
    if (u) usuarioActual = JSON.parse(u);
    return !!tok;
}

async function peticion(ruta, opciones = {}) {
    const headers = { 'Content-Type': 'application/json', ...opciones.headers };
    const tok = obtenerToken();
    if (tok) headers['Authorization'] = `Bearer ${tok}`;
    const res = await fetch(API + ruta, { ...opciones, headers });
    if (res.status === 401) {
        cerrarSesion();
        throw new Error('Sesión expirada');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || data?.mensaje || `Error ${res.status}`);
    return data;
}

function tienePermiso(codigo) {
    if (!usuarioActual) return false;
    // admin_dinamedical tiene todos los permisos
    if (usuarioActual.roles?.some(r => r.codigo === 'admin_dinamedical')) return true;
    // admin_ips tiene permisos de usuarios y personas
    if (usuarioActual.roles?.some(r => r.codigo === 'admin_ips') && (
        codigo.startsWith('usuarios.') || codigo.startsWith('personas.') ||
        codigo.startsWith('citas.') || codigo.startsWith('consultas.') || codigo.startsWith('historias.') ||
        codigo.startsWith('ips.')
    )) return true;
    if (usuarioActual.roles?.some(r => r.codigo === 'facturador_ips') && (
        codigo.startsWith('citas.') || codigo.startsWith('facturacion.')
    )) return true;
    if (!usuarioActual.permisos || !Array.isArray(usuarioActual.permisos)) return false;
    return usuarioActual.permisos.includes(codigo);
}

// Vistas
function mostrarVista(vista) {
    document.querySelectorAll('[data-vista]').forEach(el => el.classList.add('oculto'));
    const el = document.getElementById('vista-' + vista);
    if (el) el.classList.remove('oculto');
}

async function init() {
    cargarTemaGuardado();
    document.getElementById('selector-tema')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.tema-btn');
        if (btn) aplicarTema(btn.dataset.tema);
    });
    if (cargarSesion()) {
        try {
            const datos = await peticion('/auth/yo');
            usuarioActual = datos.usuario;
            guardarSesion(obtenerToken(), usuarioActual);
            mostrarApp();
        } catch {
            cerrarSesion();
            mostrarLogin();
        }
    } else {
        mostrarLogin();
    }
}

function mostrarLogin() {
    mostrarVista('login');
    document.getElementById('form-login').reset();
    const err = document.getElementById('login-error');
    if (err) { err.classList.remove('visible'); err.classList.add('oculto'); }
    const errReg = document.getElementById('registro-error');
    if (errReg) { errReg.classList.remove('visible'); errReg.classList.add('oculto'); }
}

function mostrarApp() {
    mostrarVista('app');
    renderSidebar();
    const hash = (location.hash || '#/dashboard').slice(1);
    navegar(hash);
}

function renderSidebar() {
    const nav = document.getElementById('nav-menu');
    const esAdminDinamedical = usuarioActual.roles?.some(r => r.codigo === 'admin_dinamedical');
    const items = [
        { ruta: 'dashboard', icono: '📊', texto: 'Dashboard', permiso: 'sistema.ver', soloAdmin: false },
        { ruta: 'usuarios', icono: '👥', texto: 'Usuarios', permiso: 'usuarios.ver', soloAdmin: false },
        { ruta: 'personas', icono: '👤', texto: 'Personas', permiso: 'personas.ver', soloAdmin: false },
        { ruta: 'citas', icono: '📅', texto: 'Citas', permiso: 'citas.ver', soloAdmin: false },
        { ruta: 'consultas', icono: '📋', texto: 'Consultas', permiso: 'consultas.ver', soloAdmin: false },
        { ruta: 'historias', icono: '🩺', texto: 'Historia Clínica', permiso: 'historias.ver', soloAdmin: false },
        { ruta: 'ips', icono: '🏥', texto: 'IPS', permiso: 'ips.ver', soloAdmin: true },
        { ruta: 'roles', icono: '🔐', texto: 'Roles', permiso: 'roles.ver', soloAdmin: true },
        { ruta: 'permisos', icono: '⚙️', texto: 'Permisos', permiso: 'permisos.ver', soloAdmin: true }
    ];
    nav.innerHTML = items.filter(i => {
        if (i.soloAdmin && !esAdminDinamedical) return false;
        return tienePermiso(i.permiso);
    }).map(i => `
        <a href="#/${i.ruta}" class="nav-item" data-ruta="${i.ruta}">${i.icono} ${i.texto}</a>
    `).join('');

    const u = document.getElementById('usuario-actual-info');
    if (u) {
        u.innerHTML = `
            <div class="nombre">${usuarioActual.nombre} ${usuarioActual.apellido}</div>
            ${usuarioActual.cargo ? `<div class="email" style="font-size:0.8rem">${usuarioActual.cargo}</div>` : ''}
            <div class="email">${usuarioActual.email}</div>
            <button class="btn btn-secundario btn-sm" onclick="abrirModalClave()" style="margin-top:0.5rem;width:100%">Cambiar clave</button>
            <button class="btn btn-cerrar" onclick="cerrarSesion()">Cerrar sesión</button>
        `;
    }
}

const contenedores = {
    dashboard: 'contenido-dashboard',
    usuarios: 'contenido-usuarios',
    personas: 'contenido-personas',
    citas: 'contenido-citas',
    consultas: 'contenido-consultas',
    historias: 'contenido-historias',
    ips: 'contenido-ips',
    roles: 'contenido-roles',
    permisos: 'contenido-permisos'
};

function navegar(ruta) {
    const seccion = ruta.split('/').filter(Boolean)[0] || 'dashboard';
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('activo', el.dataset.ruta === seccion);
    });
    Object.entries(contenedores).forEach(([k, id]) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('oculto', k !== seccion);
    });
    if (seccion === 'dashboard') cargarDashboard();
    else if (seccion === 'usuarios') cargarUsuarios();
    else if (seccion === 'personas') cargarPersonas();
    else if (seccion === 'citas') cargarCitas();
    else if (seccion === 'consultas') cargarConsultas();
    else if (seccion === 'historias') cargarHistorias();
    else if (seccion === 'ips') cargarIps();
    else if (seccion === 'roles') cargarRoles();
    else if (seccion === 'permisos') cargarPermisos();
}

async function login(email, clave) {
    const datos = await peticion('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, clave })
    });
    guardarSesion(datos.token, datos.usuario);
    mostrarApp();
}

async function cargarDashboard() {
    const cont = document.getElementById('contenido-dashboard');
    if (!cont) return;
    try {
        const [usuarios, ips, roles] = await Promise.all([
            tienePermiso('usuarios.ver') ? peticion('/usuarios') : [],
            tienePermiso('ips.ver') ? peticion('/ips') : [],
            tienePermiso('roles.ver') ? peticion('/roles') : []
        ]);
        cont.innerHTML = `
            <div class="dashboard-grid">
                <div class="dashboard-stat"><div class="valor">${usuarios.length}</div><div class="etiqueta">Usuarios</div></div>
                <div class="dashboard-stat"><div class="valor">${ips.length}</div><div class="etiqueta">IPS</div></div>
                <div class="dashboard-stat"><div class="valor">${roles.length}</div><div class="etiqueta">Roles</div></div>
            </div>
            <div class="tarjeta" style="margin-top:1.5rem">
                <h3 style="margin-bottom:0.75rem">Bienvenido, ${usuarioActual.nombre}</h3>
                <p style="color:var(--texto-suave)">Sistema Dinamedical - Gestión de IPS</p>
            </div>
        `;
    } catch (e) {
        cont.innerHTML = `<p class="msg-error visible">${e.message}</p>`;
    }
}

async function cargarUsuarios() {
    const cont = document.getElementById('contenido-usuarios');
    if (!cont) return;
    try {
        const usuarios = await peticion('/usuarios');
        const puedeEditar = tienePermiso('usuarios.editar');
        const puedeCrear = tienePermiso('usuarios.crear');
        const puedeEliminar = tienePermiso('usuarios.eliminar');
        const puedeAsignarRoles = tienePermiso('usuarios.asignar_roles');
        const esAdminDinamedical = usuarioActual.roles?.some(r => r.codigo === 'admin_dinamedical');
        const mostrarColumnaIps = esAdminDinamedical;
        cont.innerHTML = `
            <div class="header-pagina">
                <h1>Usuarios</h1>
                <p>${esAdminDinamedical ? 'Gestionar usuarios de todas las IPS' : 'Gestionar usuarios de tu IPS'}</p>
            </div>
            <div class="tarjeta">
                ${puedeCrear ? '<button class="btn btn-primario btn-sm" onclick="abrirModalUsuario()" style="margin-bottom:1rem;width:auto">+ Nuevo usuario</button>' : ''}
                <div class="tabla-contenedor">
                    <table>
                        <thead><tr><th>Nombre</th><th>Email</th><th>Cargo</th>${mostrarColumnaIps ? '<th>IPS</th>' : ''}<th>Roles</th><th>Estado</th><th>Acciones</th></tr></thead>
                        <tbody>
                            ${usuarios.map(u => `
                                <tr>
                                    <td>${u.nombre} ${u.apellido}</td>
                                    <td>${u.email}</td>
                                    <td>${u.cargo || '—'}</td>
                                    ${mostrarColumnaIps ? `<td>${u.ips_nombre || '-'}</td>` : ''}
                                    <td>${u.roles || '-'}</td>
                                    <td>${u.activo ? 'Activo' : 'Inactivo'}</td>
                                    <td style="display:flex;gap:0.25rem;flex-wrap:wrap">
                                        ${puedeEditar ? `<button class="btn btn-secundario btn-sm" onclick="editarUsuario(${u.id})">Editar</button>` : ''}
                                        ${puedeEditar ? `<button class="btn btn-secundario btn-sm" onclick="abrirModalCambiarClave(${u.id}, '${(u.nombre + ' ' + u.apellido).replace(/'/g, "\\'")}')" title="Reescribir contraseña">Clave</button>` : ''}
                                        ${puedeAsignarRoles ? `<button class="btn btn-secundario btn-sm" onclick="editarRolesUsuario(${u.id})">Roles</button>` : ''}
                                        ${puedeEliminar && u.id !== usuarioActual.id ? `<button class="btn btn-peligro btn-sm" onclick="eliminarUsuario(${u.id}, '${(u.nombre + ' ' + u.apellido).replace(/'/g, "\\'")}')">Eliminar</button>` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (e) {
        cont.innerHTML = `<p class="msg-error visible">${e.message}</p>`;
    }
}

async function cargarPersonas(busqueda = '') {
    const cont = document.getElementById('contenido-personas');
    if (!cont) return;
    try {
        const url = busqueda ? '/personas?busqueda=' + encodeURIComponent(busqueda) : '/personas';
        const personas = await peticion(url);
        const puedeCrear = tienePermiso('personas.crear');
        const puedeEditar = tienePermiso('personas.editar');
        const puedeVerHistoria = tienePermiso('historias.ver');
        const esAdmin = usuarioActual.roles?.some(r => r.codigo === 'admin_dinamedical');
        const nombreCompleto = (p) => [p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ');
        const busquedaActual = document.getElementById('busqueda-personas')?.value?.trim() || '';
        cont.innerHTML = `
            <div class="header-pagina">
                <h1>Personas</h1>
                <p>${esAdmin ? 'Pacientes y funcionarios de todas las IPS' : 'Pacientes y funcionarios de tu IPS'}</p>
            </div>
            <div class="tarjeta">
                <div style="display:flex;flex-wrap:wrap;gap:0.75rem;align-items:center;margin-bottom:1rem">
                    ${puedeCrear ? '<button class="btn btn-primario btn-sm" onclick="abrirModalPersonaNueva()">+ Nueva persona</button>' : ''}
                    <div style="display:flex;align-items:center;gap:0.5rem;flex:1;min-width:280px">
                        <input type="text" id="busqueda-personas" placeholder="Buscar por cédula, nombres o teléfonos..." value="${(busquedaActual || busqueda).replace(/"/g, '&quot;')}" style="flex:1;padding:0.5rem 0.75rem;border-radius:8px;border:1px solid var(--borde);background:var(--input-fondo);color:var(--texto)" onkeypress="if(event.key==='Enter')cargarPersonas(this.value)">
                        <button type="button" class="btn btn-secundario btn-sm" onclick="cargarPersonas(document.getElementById(\'busqueda-personas\').value)">Buscar</button>
                        ${busquedaActual || busqueda ? '<button type="button" class="btn btn-secundario btn-sm" onclick="document.getElementById(\'busqueda-personas\').value=\'\';cargarPersonas()">Limpiar</button>' : ''}
                    </div>
                </div>
                <div class="tabla-contenedor">
                    <table>
                        <thead><tr><th>Nombre</th><th>Documento</th><th>Tipo</th><th>IPS</th><th>Usuario</th><th>Ubicaciones</th>${puedeVerHistoria ? '<th></th>' : ''}${puedeEditar ? '<th></th>' : ''}</tr></thead>
                        <tbody>
                            ${personas.map(p => `
                                <tr>
                                    <td>${nombreCompleto(p)}</td>
                                    <td>${(p.tipo_documento_codigo || '') + ' ' + (p.numero_documento || '-')}</td>
                                    <td><span class="badge ${p.tipo_persona === 'funcionario' ? 'badge-info' : 'badge-success'}">${p.tipo_persona === 'funcionario' ? 'Funcionario' : 'Paciente'}</span></td>
                                    <td>${p.ips_nombre || '-'}</td>
                                    <td>${p.usuario_id ? 'Sí' : 'No'}</td>
                                    <td>${p.cantidad_ubicaciones || 0}</td>
                                    ${puedeVerHistoria ? `<td><button class="btn btn-secundario btn-sm" onclick="verHistoriaClinica(${p.id_persona})" title="Ver historia clínica">🩺</button></td>` : ''}
                                    ${puedeEditar ? `<td><button class="btn btn-secundario btn-sm" onclick="editarPersona(${p.id_persona})">Editar</button></td>` : ''}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (e) {
        cont.innerHTML = `<p class="msg-error visible">${e.message}</p>`;
    }
}

async function etiquetasOcurrenciaIpsLista(ips) {
    const departamentos = await peticion('/catalogos/departamentos').catch(() => []);
    const mapDepto = Object.fromEntries(departamentos.map(d => [d.codigo_departamento, d.nombre_departamento]));
    const mapMuni = {};
    const codigosDepto = [...new Set(ips.map(i => i.departamento).filter(Boolean))];
    await Promise.all(codigosDepto.map(async (cod) => {
        const munis = await peticion('/catalogos/municipios?departamento=' + cod).catch(() => []);
        munis.forEach(m => { mapMuni[m.codigo_municipio] = m.nombre_municipio; });
    }));
    return ips.map(i => {
        const depto = i.departamento
            ? (mapDepto[i.departamento] || i.departamento)
            : '—';
        const muni = i.municipio
            ? (mapMuni[i.municipio] || i.municipio)
            : '—';
        return { ...i, etiqueta_departamento: depto, etiqueta_municipio: muni };
    });
}

async function cargarIps() {
    const cont = document.getElementById('contenido-ips');
    if (!cont) return;
    try {
        const ipsRaw = await peticion('/ips');
        const ips = await etiquetasOcurrenciaIpsLista(ipsRaw);
        const esAdmin = usuarioActual.roles?.some(r => r.codigo === 'admin_dinamedical');
        const puedeCrear = tienePermiso('ips.crear') && esAdmin;
        const puedeEditar = tienePermiso('ips.editar');
        const puedeEliminar = tienePermiso('ips.eliminar') && esAdmin;
        cont.innerHTML = `
            <div class="header-pagina">
                <h1>IPS</h1>
                <p>Instituciones Prestadoras de Salud</p>
            </div>
            <div class="tarjeta">
                ${puedeCrear ? '<button class="btn btn-primario btn-sm" onclick="abrirModalIps()" style="margin-bottom:1rem;width:auto">+ Nueva IPS</button>' : ''}
                <div class="tabla-contenedor">
                    <table>
                        <thead><tr><th>Nombre</th><th>NIT</th><th>Dirección</th><th>Departamento</th><th>Municipio</th><th>Estado</th>${(puedeEditar || puedeEliminar) ? '<th></th>' : ''}</tr></thead>
                        <tbody>
                            ${ips.map(i => `
                                <tr>
                                    <td>${i.nombre}</td>
                                    <td>${i.nit || '-'}</td>
                                    <td>${i.direccion || '-'}</td>
                                    <td>${i.etiqueta_departamento}</td>
                                    <td>${i.etiqueta_municipio}</td>
                                    <td>${i.activo ? 'Activo' : 'Inactivo'}</td>
                                    ${(puedeEditar || puedeEliminar) ? `<td style="display:flex;gap:0.25rem">
                                        ${puedeEditar ? `<button class="btn btn-secundario btn-sm" onclick="editarIps(${i.id})">Editar</button>` : ''}
                                        ${puedeEliminar ? `<button class="btn btn-peligro btn-sm" onclick="eliminarIps(${i.id}, '${(i.nombre||'').replace(/'/g,"\\'")}')">Eliminar</button>` : ''}
                                    </td>` : ''}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (e) {
        cont.innerHTML = `<p class="msg-error visible">${e.message}</p>`;
    }
}

function esAdminDinamedical() {
    return usuarioActual?.roles?.some(r => r.codigo === 'admin_dinamedical');
}

function escaparHtml(texto) {
    if (texto == null) return '';
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
}

async function cargarRoles() {
    const cont = document.getElementById('contenido-roles');
    if (!cont) return;
    try {
        const roles = await peticion('/roles');
        const puedeEditarPermisos = esAdminDinamedical();
        cont.innerHTML = `
            <div class="header-pagina">
                <h1>Roles</h1>
                <p>Roles y permisos del sistema</p>
            </div>
            <div class="tarjeta">
                ${puedeEditarPermisos ? '<p class="texto-ayuda">Use <strong>Editar permisos</strong> para definir qué puede hacer cada rol.</p>' : ''}
                <div class="tabla-contenedor">
                    <table>
                        <thead><tr><th>Código</th><th>Nombre</th><th>Descripción</th><th>Permisos</th>${puedeEditarPermisos ? '<th></th>' : ''}</tr></thead>
                        <tbody>
                            ${roles.map(r => `
                                <tr>
                                    <td>${escaparHtml(r.codigo)}</td>
                                    <td>${escaparHtml(r.nombre)}</td>
                                    <td>${escaparHtml(r.descripcion || '-')}</td>
                                    <td>${r.cantidad_permisos || 0}</td>
                                    ${puedeEditarPermisos ? `<td><button type="button" class="btn btn-secundario btn-sm" onclick="abrirModalPermisosRol(${r.id})">Editar permisos</button></td>` : ''}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (e) {
        cont.innerHTML = `<p class="msg-error visible">${e.message}</p>`;
    }
}

function marcarTodosPermisosModulo(modulo, activo) {
    document.querySelectorAll(`#rol-permisos-lista input[data-modulo="${modulo}"]`).forEach(cb => {
        cb.checked = activo;
    });
}

function htmlListaPermisosRol(permisosPorModulo, idsActivos) {
    const activos = new Set(idsActivos);
    return Object.keys(permisosPorModulo).sort().map(mod => {
        const items = permisosPorModulo[mod].map(p => {
            const checked = activos.has(p.id) ? 'checked' : '';
            return `<label><input type="checkbox" name="permiso_rol" value="${p.id}" data-modulo="${escaparHtml(mod)}" ${checked}>
                <code>${escaparHtml(p.codigo)}</code> — ${escaparHtml(p.nombre)}</label>`;
        }).join('');
        return `
            <section class="rol-permisos-modulo" data-modulo="${escaparHtml(mod)}">
                <h4>${escaparHtml(mod)}</h4>
                <div class="rol-permisos-modulo-acciones">
                    <button type="button" onclick="marcarTodosPermisosModulo('${mod.replace(/'/g, "\\'")}', true)">Marcar todos</button>
                    ·
                    <button type="button" onclick="marcarTodosPermisosModulo('${mod.replace(/'/g, "\\'")}', false)">Quitar todos</button>
                </div>
                ${items}
            </section>`;
    }).join('');
}

async function abrirModalPermisosRol(rolId) {
    if (!esAdminDinamedical()) return;
    const err = document.getElementById('modal-rol-permisos-error');
    err.classList.add('oculto');
    err.classList.remove('visible');
    document.getElementById('rol-permisos-id').value = String(rolId);
    try {
        const [rol, permisosPorModulo] = await Promise.all([
            peticion('/roles/' + rolId),
            peticion('/permisos')
        ]);
        document.getElementById('modal-rol-permisos-titulo').textContent =
            `Permisos: ${rol.nombre} (${rol.codigo})`;
        const ayuda = document.getElementById('modal-rol-permisos-ayuda');
        if (ayuda) {
            ayuda.textContent = rol.codigo === 'admin_dinamedical'
                ? 'Este rol tiene acceso total en la aplicación por diseño; aun así puede ajustar el catálogo en rol_permiso.'
                : 'Marque los permisos del rol. Los usuarios deben cerrar sesión y volver a entrar para aplicar cambios.';
        }
        const idsActivos = (rol.permisos || []).map(p => p.id);
        document.getElementById('rol-permisos-lista').innerHTML =
            htmlListaPermisosRol(permisosPorModulo, idsActivos);
        document.getElementById('modal-rol-permisos').classList.remove('oculto');
    } catch (ex) {
        err.textContent = ex.message || 'No se pudo cargar el rol';
        err.classList.remove('oculto');
        err.classList.add('visible');
    }
}

async function guardarPermisosRol(e) {
    e.preventDefault();
    const rolId = document.getElementById('rol-permisos-id').value;
    const err = document.getElementById('modal-rol-permisos-error');
    err.classList.add('oculto');
    err.classList.remove('visible');
    const permiso_ids = [...document.querySelectorAll('#rol-permisos-lista input[name="permiso_rol"]:checked')]
        .map(el => parseInt(el.value, 10))
        .filter(id => !Number.isNaN(id));
    try {
        await peticion('/roles/' + rolId + '/permisos', {
            method: 'PUT',
            body: JSON.stringify({ permiso_ids })
        });
        cerrarModal('modal-rol-permisos');
        cargarRoles();
    } catch (ex) {
        err.textContent = ex.message || 'No se pudieron guardar los permisos';
        err.classList.remove('oculto');
        err.classList.add('visible');
    }
    return false;
}

async function cargarPermisos() {
    const cont = document.getElementById('contenido-permisos');
    if (!cont) return;
    try {
        const permisos = await peticion('/permisos');
        const modulos = Object.keys(permisos);
        cont.innerHTML = `
            <div class="header-pagina">
                <h1>Permisos</h1>
                <p>Permisos por módulo</p>
            </div>
            ${modulos.map(mod => `
                <div class="tarjeta">
                    <h3 style="margin-bottom:0.75rem;color:var(--acento)">${mod}</h3>
                    <div class="tabla-contenedor">
                        <table>
                            <thead><tr><th>Código</th><th>Nombre</th><th>Descripción</th></tr></thead>
                            <tbody>
                                ${permisos[mod].map(p => `
                                    <tr>
                                        <td>${p.codigo}</td>
                                        <td>${p.nombre}</td>
                                        <td>${p.descripcion || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `).join('')}
        `;
    } catch (e) {
        cont.innerHTML = `<p class="msg-error visible">${e.message}</p>`;
    }
}

// Modales
function cerrarModal(id) {
    document.getElementById(id).classList.add('oculto');
}

function abrirModalClave() {
    document.getElementById('modal-clave-error').classList.add('oculto');
    document.getElementById('form-clave').reset();
    document.getElementById('modal-clave').classList.remove('oculto');
}

async function cambiarClave(e) {
    e.preventDefault();
    const actual = document.getElementById('clave-actual').value;
    const nueva = document.getElementById('clave-nueva').value;
    const confirmar = document.getElementById('clave-confirmar').value;
    const err = document.getElementById('modal-clave-error');
    err.classList.add('oculto');
    if (nueva !== confirmar) {
        err.textContent = 'La nueva clave y la confirmación no coinciden';
        err.classList.remove('oculto');
        return false;
    }
    try {
        await peticion('/auth/cambiar-clave', {
            method: 'PUT',
            body: JSON.stringify({ clave_actual: actual, clave_nueva: nueva })
        });
        cerrarModal('modal-clave');
    } catch (ex) {
        err.textContent = ex.message;
        err.classList.remove('oculto');
    }
    return false;
}

function actualizarBloqueTelefonosUbicaciones(telefonos, ubicaciones) {
    const cont = document.getElementById('usuario-telefonos-ubicaciones');
    if (!cont) return;
    const partes = [];
    if (telefonos && telefonos.length) {
        partes.push('<strong>Teléfonos:</strong> ' + telefonos.map(t => t.numero + (t.tipo ? ` (${t.tipo})` : '')).join(', '));
    }
    if (ubicaciones && ubicaciones.length) {
        partes.push('<strong>Direcciones:</strong> ' + ubicaciones.map(u => u.direccion || '').filter(Boolean).join('; '));
    }
    cont.innerHTML = partes.length ? partes.join('<br>') : '<em style="color:var(--texto-suave)">Sin teléfonos ni direcciones. Edite en la grilla de Personas.</em>';
}

async function abrirModalUsuario(usuarioId = null, opciones = {}) {
    const esEdicion = !!usuarioId;
    const personaPreseleccionada = opciones.personaId ? String(opciones.personaId) : '';
    const emailSugerido = opciones.emailSugerido || '';
    document.getElementById('modal-usuario-titulo').textContent = esEdicion ? 'Editar usuario' : 'Nuevo usuario';
    document.getElementById('usuario-id').value = usuarioId || '';
    document.getElementById('usuario-email').disabled = esEdicion;
    document.getElementById('grupo-clave').style.display = esEdicion ? 'none' : 'block';
    document.getElementById('usuario-clave').required = !esEdicion;
    document.getElementById('grupo-rol').style.display = esEdicion ? 'none' : 'block';
    document.getElementById('grupo-persona-usuario').style.display = esEdicion ? 'none' : 'block';
    document.getElementById('modal-usuario-error').classList.add('oculto');
    document.getElementById('form-usuario').reset();
    document.getElementById('usuario-id').value = usuarioId || '';

    const esAdminModal = usuarioActual.roles?.some(r => r.codigo === 'admin_dinamedical');
    document.getElementById('grupo-ips').style.display = esAdminModal ? 'block' : 'none';

    const [tiposDoc, sexos, ips, roles, personasSinUsuario, cargosLista] = await Promise.all([
        peticion('/catalogos/tipo-documento').catch(() => []),
        peticion('/catalogos/sexo').catch(() => []),
        esAdminModal ? peticion('/ips') : [],
        peticion('/roles'),
        !esEdicion ? peticion('/personas?sin_usuario=1') : [],
        peticion('/catalogos/listas?ref=cargo_usuario').catch(() => [])
    ]);
    const datalistCargos = document.getElementById('lista-cargos-usuario');
    if (datalistCargos) {
        datalistCargos.innerHTML = (cargosLista || []).map(c => `<option value="${c.label}"></option>`).join('');
    }

    document.getElementById('usuario-tipo-documento').innerHTML = tiposDoc.map(t => `<option value="${t.codigo}">${t.nombre}</option>`).join('');
    document.getElementById('usuario-sexo').innerHTML = '<option value="">-- Seleccionar --</option>' + sexos.map(s => `<option value="${s.codigo}">${s.nombre}</option>`).join('');

    if (!esEdicion) {
        const selPersona = document.getElementById('usuario-persona');
        const personas = personasSinUsuario || [];
        const textoVacio = personas.length ? '-- Seleccionar persona (sin usuario) --' : '-- No hay personas. Cree una persona primero. --';
        const opcionesPersonasHtml = personas.map(p => {
            const nom = [p.primer_nombre, p.segundo_nombre].filter(Boolean).join(' ');
            const ape = [p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ');
            const doc = p.numero_documento ? ` - ${p.numero_documento}` : '';
            return `<option value="${p.id_persona}">${nom} ${ape}${doc}</option>`;
        }).join('');
        selPersona.innerHTML = `<option value="">${textoVacio}</option>${opcionesPersonasHtml}`;
        selPersona.required = true;
        const onCambioPersonaUsuario = async () => {
            const idPersona = selPersona.value;
            const idsCampos = ['usuario-nombre', 'usuario-segundo-nombre', 'usuario-apellido', 'usuario-segundo-apellido', 'usuario-tipo-documento', 'usuario-numero-documento', 'usuario-fecha-nacimiento', 'usuario-sexo'];
            if (!idPersona) {
                idsCampos.forEach(campoId => {
                    const el = document.getElementById(campoId);
                    if (el) el.value = '';
                });
                document.getElementById('usuario-telefonos-ubicaciones').innerHTML = '<em style="color:var(--texto-suave)">Se editan en la grilla de Personas</em>';
                return;
            }
            const p = await peticion('/personas/' + idPersona);
            document.getElementById('usuario-nombre').value = p.primer_nombre ?? '';
            document.getElementById('usuario-segundo-nombre').value = p.segundo_nombre ?? '';
            document.getElementById('usuario-apellido').value = p.primer_apellido ?? '';
            document.getElementById('usuario-segundo-apellido').value = p.segundo_apellido ?? '';
            document.getElementById('usuario-tipo-documento').value = p.tipo_documento_codigo ?? 'CC';
            document.getElementById('usuario-numero-documento').value = p.numero_documento ?? '';
            document.getElementById('usuario-fecha-nacimiento').value = p.fecha_nacimiento ? p.fecha_nacimiento.split('T')[0] : '';
            document.getElementById('usuario-sexo').value = p.sexo_codigo ?? '';
            actualizarBloqueTelefonosUbicaciones(p.telefonos || [], p.ubicaciones || []);
        };
        selPersona.onchange = onCambioPersonaUsuario;
        if (personaPreseleccionada) {
            if (!personas.some(p => String(p.id_persona) === personaPreseleccionada)) {
                try {
                    const pExtra = await peticion('/personas/' + personaPreseleccionada);
                    const nom = [pExtra.primer_nombre, pExtra.segundo_nombre].filter(Boolean).join(' ');
                    const ape = [pExtra.primer_apellido, pExtra.segundo_apellido].filter(Boolean).join(' ');
                    const doc = pExtra.numero_documento ? ` - ${pExtra.numero_documento}` : '';
                    selPersona.insertAdjacentHTML('beforeend',
                        `<option value="${pExtra.id_persona}">${nom} ${ape}${doc}</option>`);
                } catch (_) { /* ignore */ }
            }
            selPersona.value = personaPreseleccionada;
            await onCambioPersonaUsuario();
        }
        if (emailSugerido) {
            document.getElementById('usuario-email').value = emailSugerido;
        }
    }

    if (esAdminModal && ips.length) {
        const sel = document.getElementById('usuario-ips');
        sel.innerHTML = '<option value="">-- Sin IPS (admin) --</option>' + ips.map(i => `<option value="${i.id}">${i.nombre}</option>`).join('');
    }
    const rolesIps = esAdminModal ? roles.filter(r => !r.nivel_sistema) : roles.filter(r => ['parametrizador_ips', 'profesional_ips', 'facturador_ips'].includes(r.codigo));
    document.getElementById('usuario-rol').innerHTML = rolesIps.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('');

    if (esEdicion) {
        const u = await peticion('/usuarios/' + usuarioId);
        document.getElementById('usuario-email').value = u.email;
        document.getElementById('usuario-nombre').value = u.primer_nombre ?? u.nombre ?? '';
        document.getElementById('usuario-segundo-nombre').value = u.segundo_nombre ?? '';
        document.getElementById('usuario-apellido').value = u.primer_apellido ?? u.apellido ?? '';
        document.getElementById('usuario-segundo-apellido').value = u.segundo_apellido ?? '';
        document.getElementById('usuario-tipo-documento').value = u.tipo_documento_codigo ?? 'CC';
        document.getElementById('usuario-numero-documento').value = u.numero_documento ?? '';
        document.getElementById('usuario-fecha-nacimiento').value = u.fecha_nacimiento ? u.fecha_nacimiento.split('T')[0] : '';
        document.getElementById('usuario-sexo').value = u.sexo_codigo ?? '';
        document.getElementById('usuario-activo').checked = !!u.activo;
        document.getElementById('usuario-cargo').value = u.cargo || '';
        if (esAdminModal && u.ips_id) document.getElementById('usuario-ips').value = u.ips_id;
        document.getElementById('grupo-activo').style.display = 'block';
        actualizarBloqueTelefonosUbicaciones(u.telefonos || [], u.ubicaciones || []);
    } else {
        document.getElementById('grupo-activo').style.display = 'none';
        document.getElementById('usuario-telefonos-ubicaciones').innerHTML = '<em style="color:var(--texto-suave)">Seleccione una persona para ver sus datos</em>';
    }
    document.getElementById('modal-usuario').classList.remove('oculto');
}

async function guardarUsuario(e) {
    e.preventDefault();
    const id = document.getElementById('usuario-id').value;
    const err = document.getElementById('modal-usuario-error');
    err.classList.add('oculto');
    try {
        if (id) {
            const body = {
                activo: document.getElementById('usuario-activo').checked,
                cargo: document.getElementById('usuario-cargo').value.trim() || null
            };
            const clave = document.getElementById('usuario-clave').value;
            if (clave) body.clave = clave;
            await peticion('/usuarios/' + id, { method: 'PUT', body: JSON.stringify(body) });
        } else {
            const personaId = document.getElementById('usuario-persona').value;
            if (!personaId) {
                err.textContent = 'Debe seleccionar una persona. Primero cree la persona en la sección Personas.';
                err.classList.remove('oculto');
                return false;
            }
            const body = {
                email: document.getElementById('usuario-email').value,
                clave: document.getElementById('usuario-clave').value,
                persona_id: parseInt(personaId, 10),
                rol_id: document.getElementById('usuario-rol').value || undefined,
                cargo: document.getElementById('usuario-cargo').value.trim() || null
            };
            if (usuarioActual.roles?.some(r => r.codigo === 'admin_dinamedical')) {
                body.ips_id = document.getElementById('usuario-ips').value || null;
            }
            await peticion('/usuarios', { method: 'POST', body: JSON.stringify(body) });
        }
        cerrarModal('modal-usuario');
        cargarUsuarios();
    } catch (ex) {
        err.textContent = ex.message;
        err.classList.remove('oculto');
    }
    return false;
}

async function editarUsuario(id) {
    await abrirModalUsuario(id);
}

function abrirModalCambiarClave(usuarioId, nombreCompleto) {
    document.getElementById('clave-usuario-id').value = usuarioId;
    document.getElementById('modal-clave-usuario-nombre').textContent = 'Usuario: ' + (nombreCompleto || '');
    document.getElementById('clave-nueva').value = '';
    document.getElementById('clave-confirmar').value = '';
    document.getElementById('modal-clave-error').classList.add('oculto');
    document.getElementById('modal-cambiar-clave').classList.remove('oculto');
}

async function guardarNuevaClave(e) {
    e.preventDefault();
    const nueva = document.getElementById('clave-nueva').value;
    const confirmar = document.getElementById('clave-confirmar').value;
    const err = document.getElementById('modal-clave-error');
    err.classList.add('oculto');
    if (nueva !== confirmar) {
        err.textContent = 'Las contraseñas no coinciden';
        err.classList.remove('oculto');
        return false;
    }
    if (nueva.length < 6) {
        err.textContent = 'La contraseña debe tener al menos 6 caracteres';
        err.classList.remove('oculto');
        return false;
    }
    try {
        await peticion('/usuarios/' + document.getElementById('clave-usuario-id').value, {
            method: 'PUT',
            body: JSON.stringify({ clave: nueva })
        });
        cerrarModal('modal-cambiar-clave');
        cargarUsuarios();
    } catch (ex) {
        err.textContent = ex.message;
        err.classList.remove('oculto');
    }
    return false;
}

async function editarRolesUsuario(id) {
    const u = await peticion('/usuarios/' + id);
    const roles = await peticion('/roles');
    const esAdmin = usuarioActual.roles?.some(r => r.codigo === 'admin_dinamedical');
    const rolesDisponibles = esAdmin ? roles.filter(r => !r.nivel_sistema) : roles.filter(r => ['parametrizador_ips', 'profesional_ips', 'facturador_ips'].includes(r.codigo));
    const ipsId = u.ips_id || usuarioActual.ips_id;
    const rolesActuales = u.roles || [];
    const html = rolesDisponibles.map(r => {
        const tiene = rolesActuales.some(ra => ra.id === r.id || ra.codigo === r.codigo);
        return `<label style="display:block;margin:0.5rem 0"><input type="checkbox" data-rol-id="${r.id}" ${tiene ? 'checked' : ''}> ${r.nombre}</label>`;
    }).join('');
    const modal = document.createElement('div');
    modal.id = 'modal-roles-usuario';
    modal.className = 'overlay';
    modal.innerHTML = `
        <div class="modal">
            <h2>Asignar roles a ${u.nombre} ${u.apellido}</h2>
            <div id="modal-roles-error" class="msg-error oculto"></div>
            <form id="form-roles-usuario">
                ${html}
                <div style="display:flex;gap:0.5rem;margin-top:1rem">
                    <button type="submit" class="btn btn-primario">Guardar</button>
                    <button type="button" class="btn btn-secundario" onclick="document.getElementById('modal-roles-usuario').remove()">Cancelar</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('form').onsubmit = async (e) => {
        e.preventDefault();
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]:checked');
        const rolesBody = Array.from(checkboxes).map(cb => ({ rol_id: parseInt(cb.dataset.rolId), ips_id: ipsId }));
        try {
            await peticion('/usuarios/' + id + '/roles', { method: 'PUT', body: JSON.stringify({ roles: rolesBody }) });
            modal.remove();
            cargarUsuarios();
        } catch (ex) {
            modal.querySelector('#modal-roles-error').textContent = ex.message;
            modal.querySelector('#modal-roles-error').classList.remove('oculto');
        }
        return false;
    };
}

async function eliminarUsuario(id, nombre) {
    if (!confirm('¿Eliminar al usuario "' + nombre + '"? Esta acción no se puede deshacer.')) return;
    try {
        await peticion('/usuarios/' + id, { method: 'DELETE' });
        cargarUsuarios();
    } catch (ex) {
        alert(ex.message);
    }
}

let personaActualModal = null;
let ubicacionesNuevas = [];
let ubicacionEditando = null;
let telefonosNuevos = [];
let telefonoEditando = null;
let personaMunicipiosResidencia = [];

async function cargarDepartamentosPersonaModal() {
    if (!window._personaDepartamentos) {
        window._personaDepartamentos = await peticion('/catalogos/departamentos').catch(() => []);
    }
    const sel = document.getElementById('persona-res-depto');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">-- Seleccionar --</option>' + (window._personaDepartamentos || []).map(dep =>
        `<option value="${dep.codigo_departamento}">${dep.nombre_departamento}</option>`
    ).join('');
    if (prev) sel.value = prev;
}

async function cambiarDeptoPersonaModal(municipioSeleccionado) {
    const cod = document.getElementById('persona-res-depto')?.value;
    const mSel = document.getElementById('persona-res-muni');
    if (!mSel) return;
    if (!cod) {
        mSel.innerHTML = '<option value="">-- Seleccionar --</option>';
        return;
    }
    personaMunicipiosResidencia = await peticion('/catalogos/municipios?departamento=' + cod).catch(() => []);
    mSel.innerHTML = '<option value="">-- Seleccionar --</option>' + personaMunicipiosResidencia.map(m =>
        `<option value="${m.codigo_municipio}">${m.nombre_municipio}</option>`
    ).join('');
    if (municipioSeleccionado) mSel.value = municipioSeleccionado;
}

async function poblarResidenciaPersonaModal(depto, municipio) {
    await cargarDepartamentosPersonaModal();
    const dSel = document.getElementById('persona-res-depto');
    const mSel = document.getElementById('persona-res-muni');
    if (dSel) dSel.value = depto || '';
    if (depto) await cambiarDeptoPersonaModal(municipio || '');
    else if (mSel) mSel.innerHTML = '<option value="">-- Seleccionar --</option>';
}

function actualizarUiVinculoUsuarioPersona(persona) {
    const wrapDes = document.getElementById('persona-desvincular-wrap');
    const wrapRev = document.getElementById('persona-revincular-wrap');
    const ayudaRev = document.getElementById('persona-revincular-ayuda');
    const inputInfo = document.getElementById('persona-usuario-info');
    const inputUid = document.getElementById('persona-usuario-id');
    const uid = persona?.usuario_id ? parseInt(persona.usuario_id, 10) : null;
    if (inputUid) inputUid.value = uid ? String(uid) : '';
    if (persona?.usuario_id) {
        const email = persona.usuario_email ? ` — ${persona.usuario_email}` : '';
        inputInfo.value = `Sí (usuario del sistema${email})`;
    } else {
        inputInfo.value = 'No';
    }
    const puedeDesvincular = uid
        && tienePermiso('usuarios.eliminar')
        && uid !== usuarioActual?.id;
    if (wrapDes) wrapDes.classList.toggle('oculto', !puedeDesvincular);

    const personaId = document.getElementById('persona-id')?.value;
    const puedeRevincular = !uid && personaId && tienePermiso('usuarios.crear');
    if (wrapRev) wrapRev.classList.toggle('oculto', !puedeRevincular);
    if (ayudaRev && puedeRevincular) {
        const emailPrev = persona?.email_cuenta_revincular;
        ayudaRev.textContent = emailPrev
            ? `Si vuelve a trabajar en la IPS, use el correo ${emailPrev} para reactivar la misma cuenta.`
            : 'Asigne correo, clave y rol (Usuarios). La persona debe aparecer en la lista sin usuario vinculado.';
    }
}

function vincularPersonaComoUsuario() {
    const personaId = document.getElementById('persona-id')?.value;
    if (!personaId || !tienePermiso('usuarios.crear')) return;
    const emailSugerido = personaActualModal?.email_cuenta_revincular || '';
    cerrarModal('modal-persona');
    abrirModalUsuario(null, { personaId: parseInt(personaId, 10), emailSugerido });
}

async function desvincularUsuarioPersona() {
    const personaId = document.getElementById('persona-id')?.value;
    const err = document.getElementById('modal-persona-error');
    if (!personaId) return;
    const email = document.getElementById('persona-usuario-info')?.value || '';
    const msg = '¿Desvincular la cuenta de usuario de esta persona?\n\n'
        + 'Perderá acceso al sistema. La ficha de persona (paciente) se conserva.\n\n'
        + (email.includes('@') ? email : 'Usuario vinculado');
    if (!confirm(msg)) return;
    err.classList.add('oculto');
    err.classList.remove('visible');
    const btn = document.getElementById('btn-desvincular-usuario-persona');
    if (btn) btn.disabled = true;
    try {
        const res = await peticion('/personas/' + personaId + '/desvincular-usuario', { method: 'POST' });
        personaActualModal = { ...personaActualModal, usuario_id: null, usuario_email: null };
        actualizarUiVinculoUsuarioPersona(personaActualModal);
        alert(res.mensaje || 'Usuario desvinculado');
        cargarPersonas(document.getElementById('busqueda-personas')?.value || '');
    } catch (ex) {
        err.textContent = ex.message || 'No se pudo desvincular';
        err.classList.remove('oculto');
        err.classList.add('visible');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function abrirModalPersonaNueva() {
    if (!tienePermiso('personas.crear')) return;
    const [tiposDoc, sexos, ips] = await Promise.all([
        peticion('/catalogos/tipo-documento').catch(() => []),
        peticion('/catalogos/sexo').catch(() => []),
        usuarioActual.roles?.some(r => r.codigo === 'admin_dinamedical') ? peticion('/ips') : []
    ]);
    personaActualModal = { id_persona: null, ubicaciones: [], telefonos: [] };
    ubicacionesNuevas = [];
    ubicacionEditando = null;
    telefonosNuevos = [];
    telefonoEditando = null;

    document.getElementById('persona-id').value = '';
    document.getElementById('persona-tipo-documento').innerHTML = tiposDoc.map(t => `<option value="${t.codigo}">${t.nombre}</option>`).join('');
    document.getElementById('persona-sexo').innerHTML = '<option value="">-- Seleccionar --</option>' + sexos.map(s => `<option value="${s.codigo}">${s.nombre}</option>`).join('');
    document.getElementById('persona-numero-documento').value = '';
    document.getElementById('persona-primer-nombre').value = '';
    document.getElementById('persona-segundo-nombre').value = '';
    document.getElementById('persona-primer-apellido').value = '';
    document.getElementById('persona-segundo-apellido').value = '';
    document.getElementById('persona-fecha-nacimiento').value = '';
    document.getElementById('persona-sexo').value = '';
    document.getElementById('persona-activo').checked = true;
    document.getElementById('persona-tipo-documento').value = 'CC';
    document.getElementById('grupo-persona-usuario').style.display = 'none';
    document.getElementById('modal-persona-error').classList.add('oculto');

    const esAdmin = usuarioActual.roles?.some(r => r.codigo === 'admin_dinamedical');
    document.getElementById('grupo-persona-ips').style.display = esAdmin ? 'block' : 'none';
    if (esAdmin && ips.length) {
        document.getElementById('persona-ips').innerHTML = '<option value="">-- Sin IPS --</option>' + ips.map(i => `<option value="${i.id}">${i.nombre}</option>`).join('');
        document.getElementById('persona-ips').value = usuarioActual.ips_id || '';
    }

    const tiposVia = await peticion('/catalogos/listas?ref=tipo_via').catch(() => []);
    const orientaciones = await peticion('/catalogos/listas?ref=orientacion').catch(() => []);
    window._listasUbicacion = { tiposVia, orientaciones };

    await poblarResidenciaPersonaModal('', '');
    renderUbicacionesPersona([]);
    renderTelefonosPersona([]);
    actualizarUiVinculoUsuarioPersona({});
    document.getElementById('modal-persona').classList.remove('oculto');
}

async function editarPersona(id) {
    const [persona, tiposDoc, sexos, ips] = await Promise.all([
        peticion('/personas/' + id),
        peticion('/catalogos/tipo-documento').catch(() => []),
        peticion('/catalogos/sexo').catch(() => []),
        usuarioActual.roles?.some(r => r.codigo === 'admin_dinamedical') ? peticion('/ips') : []
    ]);
    personaActualModal = persona;
    ubicacionesNuevas = [];
    ubicacionEditando = null;
    telefonosNuevos = [];
    telefonoEditando = null;

    document.getElementById('persona-id').value = id;
    document.getElementById('persona-tipo-documento').innerHTML = tiposDoc.map(t => `<option value="${t.codigo}">${t.nombre}</option>`).join('');
    document.getElementById('persona-sexo').innerHTML = '<option value="">-- Seleccionar --</option>' + sexos.map(s => `<option value="${s.codigo}">${s.nombre}</option>`).join('');
    document.getElementById('persona-numero-documento').value = persona.numero_documento || '';
    document.getElementById('persona-primer-nombre').value = persona.primer_nombre || '';
    document.getElementById('persona-segundo-nombre').value = persona.segundo_nombre || '';
    document.getElementById('persona-primer-apellido').value = persona.primer_apellido || '';
    document.getElementById('persona-segundo-apellido').value = persona.segundo_apellido || '';
    document.getElementById('persona-fecha-nacimiento').value = persona.fecha_nacimiento ? persona.fecha_nacimiento.split('T')[0] : '';
    document.getElementById('persona-sexo').value = persona.sexo_codigo || '';
    document.getElementById('persona-activo').checked = persona.activo !== false;
    document.getElementById('persona-tipo-documento').value = persona.tipo_documento_codigo || 'CC';
    document.getElementById('grupo-persona-usuario').style.display = 'block';
    actualizarUiVinculoUsuarioPersona(persona);
    document.getElementById('modal-persona-error').classList.add('oculto');

    const esAdmin = usuarioActual.roles?.some(r => r.codigo === 'admin_dinamedical');
    document.getElementById('grupo-persona-ips').style.display = esAdmin ? 'block' : 'none';
    if (esAdmin && ips.length) {
        document.getElementById('persona-ips').innerHTML = '<option value="">-- Sin IPS --</option>' + ips.map(i => `<option value="${i.id}">${i.nombre}</option>`).join('');
        document.getElementById('persona-ips').value = persona.ips_id || '';
    }

    const tiposVia = await peticion('/catalogos/listas?ref=tipo_via').catch(() => []);
    const orientaciones = await peticion('/catalogos/listas?ref=orientacion').catch(() => []);
    window._listasUbicacion = { tiposVia, orientaciones };

    await poblarResidenciaPersonaModal(persona.residencia_departamento, persona.residencia_municipio);

    const ubs = (persona.ubicaciones || []).sort((a, b) => (b.id || 0) - (a.id || 0));
    const tels = persona.telefonos || [];
    renderUbicacionesPersona(ubs);
    renderTelefonosPersona(tels);
    document.getElementById('modal-persona').classList.remove('oculto');
}

function obtenerTelefonosValidos() {
    const tels = personaActualModal?.telefonos || [];
    return tels.filter(t => telefonoValido(t.numero));
}

function renderTelefonosPersona(telefonos) {
    const cont = document.getElementById('persona-telefonos-lista');
    if (!cont) return;
    const personaId = personaActualModal?.id_persona ?? personaActualModal?.id;
    let html = '';
    (telefonos || []).forEach(t => {
        const tieneId = t.id != null && t.id !== '' && t.id !== 'nuevo';
        if (tieneId && telefonoEditando === t.id) {
            html += `<div class="telefono-item telefono-editando" data-id="${t.id}">
                <input type="text" placeholder="Ej: 3001234567" data-telefono-id="${t.id}" data-campo="numero" value="${(t.numero || '').replace(/"/g, '&quot;')}">
                <select data-telefono-id="${t.id}" data-campo="tipo">
                    <option value="celular" ${(t.tipo || '') === 'celular' ? 'selected' : ''}>Celular</option>
                    <option value="fijo" ${(t.tipo || '') === 'fijo' ? 'selected' : ''}>Fijo</option>
                </select>
                <button type="button" class="btn btn-primario btn-sm" onclick="guardarTelefonoEditado(${t.id})">Guardar</button>
                <button type="button" class="btn btn-secundario btn-sm" onclick="cancelarEdicionTelefono()">Cancelar</button>
            </div>`;
        } else {
            const etiqueta = (t.tipo || 'celular') === 'fijo' ? ' (fijo)' : '';
            html += `<div class="telefono-item" data-id="${t.id || 'nuevo'}">
                <span>${(t.numero || '').replace(/</g, '&lt;')}${etiqueta}</span>
                <div style="display:flex;gap:0.35rem">
                    ${tieneId ? `<button type="button" class="btn btn-secundario btn-sm" onclick="iniciarEdicionTelefono(${t.id})">✏️ Editar</button>` : ''}
                    ${tieneId ? `<button type="button" class="btn btn-peligro btn-sm" onclick="eliminarTelefonoPersona(${t.id})">Eliminar</button>` : ''}
                </div>
            </div>`;
        }
    });
    telefonosNuevos.forEach((t, i) => {
        html += `<div class="telefono-item telefono-nuevo" data-idx="${i}">
            <input type="text" placeholder="Ej: 3001234567" data-idx="${i}" data-campo="numero" value="${(t.numero || '').replace(/"/g, '&quot;')}">
            <select data-idx="${i}" data-campo="tipo">
                <option value="celular" ${(t.tipo || 'celular') === 'celular' ? 'selected' : ''}>Celular</option>
                <option value="fijo" ${(t.tipo || '') === 'fijo' ? 'selected' : ''}>Fijo</option>
            </select>
            <button type="button" class="btn btn-primario btn-sm" onclick="guardarTelefonoNuevo(${i})">Guardar</button>
            <button type="button" class="btn btn-peligro btn-sm" onclick="quitarTelefonoNuevo(${i})">Quitar</button>
        </div>`;
    });
    cont.innerHTML = html || '<p style="color:var(--texto-suave);font-size:0.9rem">Sin teléfonos registrados</p>';
}

function agregarTelefonoPersona() {
    telefonosNuevos.push({ numero: '', tipo: 'celular' });
    renderTelefonosPersona(personaActualModal?.telefonos || []);
}

function quitarTelefonoNuevo(idx) {
    telefonosNuevos.splice(idx, 1);
    renderTelefonosPersona(personaActualModal?.telefonos || []);
}

async function guardarTelefonoNuevo(idx) {
    const personaId = personaActualModal?.id_persona ?? personaActualModal?.id;
    if (!personaId) return;
    const t = telefonosNuevos[idx];
    const div = document.querySelector(`.telefono-nuevo[data-idx="${idx}"]`);
    if (!div) return;
    const numero = div.querySelector('[data-campo="numero"]')?.value?.trim();
    const tipo = div.querySelector('[data-campo="tipo"]')?.value || 'celular';
    if (!numero) {
        alert('Ingrese el número.');
        return;
    }
    try {
        const nuevo = await peticion(`/personas/${personaId}/telefonos`, {
            method: 'POST',
            body: JSON.stringify({ numero, tipo })
        });
        telefonosNuevos.splice(idx, 1);
        if (!personaActualModal.telefonos) personaActualModal.telefonos = [];
        personaActualModal.telefonos.push(nuevo);
        renderTelefonosPersona(personaActualModal.telefonos);
        renderUbicacionesPersona(personaActualModal?.ubicaciones || [], true);
    } catch (ex) {
        alert(ex.message);
    }
}

function iniciarEdicionTelefono(telefonoId) {
    telefonoEditando = telefonoId;
    renderTelefonosPersona(personaActualModal?.telefonos || []);
}

function cancelarEdicionTelefono() {
    telefonoEditando = null;
    renderTelefonosPersona(personaActualModal?.telefonos || []);
}

async function guardarTelefonoEditado(telefonoId) {
    const personaId = personaActualModal?.id_persona ?? personaActualModal?.id;
    if (!personaId) return;
    const div = document.querySelector(`.telefono-editando[data-id="${telefonoId}"]`);
    if (!div) return;
    const numero = div.querySelector(`[data-telefono-id="${telefonoId}"][data-campo="numero"]`)?.value?.trim();
    const tipo = div.querySelector(`[data-telefono-id="${telefonoId}"][data-campo="tipo"]`)?.value || 'celular';
    if (!numero) {
        alert('Ingrese el número.');
        return;
    }
    try {
        await peticion(`/personas/${personaId}/telefonos/${telefonoId}`, {
            method: 'PUT',
            body: JSON.stringify({ numero, tipo })
        });
        const t = personaActualModal.telefonos.find(x => x.id === telefonoId);
        if (t) { t.numero = numero; t.tipo = tipo; }
        telefonoEditando = null;
        renderTelefonosPersona(personaActualModal.telefonos);
        renderUbicacionesPersona(personaActualModal?.ubicaciones || [], true);
    } catch (ex) {
        alert(ex.message);
    }
}

async function eliminarTelefonoPersona(telefonoId) {
    const t = personaActualModal?.telefonos?.find(x => x.id === telefonoId);
    const num = t?.numero || 'este teléfono';
    if (!confirm(`¿Eliminar ${num}?`)) return;
    try {
        await peticion(`/personas/${personaActualModal.id_persona}/telefonos/${telefonoId}`, { method: 'DELETE' });
        personaActualModal.telefonos = personaActualModal.telefonos.filter(x => x.id !== telefonoId);
        renderTelefonosPersona(personaActualModal.telefonos);
        renderUbicacionesPersona(personaActualModal?.ubicaciones || [], true);
    } catch (ex) {
        alert(ex.message);
    }
}

function formatearDireccion(u) {
    let base = '';
    if (u.direccion) {
        base = u.direccion;
        if (u.descripcion_adicional && !base.includes(u.descripcion_adicional)) base += ' - ' + u.descripcion_adicional;
        return base;
    }
    const p = [];
    if (u.tipo_via && u.numero_via) p.push((u.tipo_via === 'CALLE' ? 'Calle' : u.tipo_via === 'CARRERA' ? 'Carrera' : u.tipo_via) + ' ' + u.numero_via + (u.complemento_via || ''));
    if (u.numero_orientacion || u.orientacion) {
        let ori = u.numero_orientacion ? String(u.numero_orientacion) : '';
        if (u.orientacion) ori = ori ? ori + ' ' + u.orientacion : u.orientacion;
        if (u.complemento_orientacion) ori += u.complemento_orientacion;
        if (ori) p.push(ori);
    }
    if (u.numero_placa) p.push('#' + u.numero_placa + (u.complemento_placa || ''));
    if (u.descripcion_adicional) p.push(u.descripcion_adicional);
    return p.length ? p.join(' - ') : '-';
}

function renderUbicacionesPersona(ubicaciones, mostrarTodas = false) {
    const cont = document.getElementById('persona-ubicaciones-lista');
    const listas = window._listasUbicacion || { tiposVia: [], orientaciones: [] };
    const optTipo = listas.tiposVia.map(t => `<option value="${t.value}">${t.label}</option>`).join('');
    const optOri = '<option value="">--</option>' + listas.orientaciones.map(o => `<option value="${o.value}">${o.label}</option>`).join('');

    const principal = ubicaciones[0];
    const resto = ubicaciones.slice(1);
    const mostrarResto = mostrarTodas || ubicaciones.length <= 3;
    let html = '';
    const personaId = personaActualModal?.id_persona ?? personaActualModal?.id;
    const telefonosValidos = obtenerTelefonosValidos();
    const tieneTelefonoValido = telefonosValidos.length > 0;
    const tieneId = (u) => u && (u.id != null && u.id !== '' && u.id !== 'nuevo');
    const renderFormularioEdicion = (u) => {
        const optTipoSel = listas.tiposVia.map(t => `<option value="${t.value}" ${(u.tipo_via || '') === t.value ? 'selected' : ''}>${t.label}</option>`).join('');
        const optOriSel = '<option value="">--</option>' + listas.orientaciones.map(o => `<option value="${o.value}" ${(u.orientacion || '') === o.value ? 'selected' : ''}>${o.label}</option>`).join('');
        return `<div class="fila-dir">
            <div class="form-grupo"><label style="font-size:0.8rem">Calle: Tipo</label><select data-ubicacion-id="${u.id}" data-campo="tipo_via"><option value="">--</option>${optTipoSel}</select></div>
            <div class="form-grupo"><label style="font-size:0.8rem">Nº</label><input type="text" placeholder="73" data-ubicacion-id="${u.id}" data-campo="numero_via" value="${u.numero_via || ''}"></div>
            <div class="form-grupo"><label style="font-size:0.8rem">A/B/C</label><input type="text" placeholder="A" data-ubicacion-id="${u.id}" data-campo="complemento_via" value="${u.complemento_via || ''}" maxlength="3"></div>
        </div>
        <div class="fila-dir">
            <div class="form-grupo"><label style="font-size:0.8rem">Orientación: Nº (entre)</label><input type="text" placeholder="25" data-ubicacion-id="${u.id}" data-campo="numero_orientacion" value="${u.numero_orientacion || ''}"></div>
            <div class="form-grupo"><label style="font-size:0.8rem">Sur/Norte/etc.</label><select data-ubicacion-id="${u.id}" data-campo="orientacion">${optOriSel}</select></div>
            <div class="form-grupo"></div>
        </div>
        <div class="fila-dir">
            <div class="form-grupo"><label style="font-size:0.8rem">Placa: #</label><input type="text" placeholder="113" data-ubicacion-id="${u.id}" data-campo="numero_placa" value="${u.numero_placa || ''}"></div>
            <div class="form-grupo"><label style="font-size:0.8rem">A/B/C</label><input type="text" placeholder="A" data-ubicacion-id="${u.id}" data-campo="complemento_placa" value="${u.complemento_placa || ''}" maxlength="3"></div>
            <div class="form-grupo"><label style="font-size:0.8rem">Piso, torre, etc.</label><input type="text" placeholder="Opcional" data-ubicacion-id="${u.id}" data-campo="descripcion_adicional" value="${u.descripcion_adicional || ''}"></div>
        </div>
        <div class="fila-dir">
            <div class="form-grupo" style="display:flex;align-items:flex-end;gap:0.35rem">
                <button type="button" class="btn btn-primario btn-sm" onclick="guardarUbicacionEditada(${u.id})">Guardar</button>
                <button type="button" class="btn btn-secundario btn-sm" onclick="cancelarEdicionUbicacion()">Cancelar</button>
            </div>
        </div>`;
    };
    if (principal) {
        if (tieneId(principal) && ubicacionEditando === principal.id) {
            html += `<div class="ubicacion-item ubicacion-editando" data-id="${principal.id}">${renderFormularioEdicion(principal)}</div>`;
        } else {
            const btnWhats = tieneId(principal) && personaId && tieneTelefonoValido ? (telefonosValidos.length > 1 ? `<button type="button" class="btn btn-sm" style="background:#25d366;color:#fff" onclick="mostrarSelectorTelefonoWhatsApp(${personaId}, ${principal.id})" title="Enviar link por WhatsApp">📱 WhatsApp</button>` : `<button type="button" class="btn btn-sm" style="background:#25d366;color:#fff" onclick="enviarLinkWhatsApp(${personaId}, ${principal.id}, ${telefonosValidos[0].id || 'null'})" title="Enviar link por WhatsApp">📱 WhatsApp</button>`) : '';
            const btnMapa = (principal.latitud != null && principal.longitud != null) ? `<button type="button" class="btn btn-sm" onclick="verUbicacionEnMapa(${principal.latitud},${principal.longitud})" title="Ver en mapa">🗺️</button>` : '';
            html += `<div class="ubicacion-item" data-id="${principal.id || 'nuevo'}">
                <div style="display:flex;justify-content:space-between;align-items:start;gap:0.5rem;flex-wrap:wrap">
                    <div><strong>${formatearDireccion(principal)}</strong>${(principal.latitud && principal.longitud) ? ` (${principal.latitud}, ${principal.longitud})` : ''}</div>
                    <div style="display:flex;gap:0.35rem">
                        ${btnMapa}
                        ${btnWhats}
                        ${tieneId(principal) ? `<button type="button" class="btn btn-secundario btn-sm" onclick="iniciarEdicionUbicacion(${principal.id})" title="Editar dirección">✏️ Editar</button>` : ''}
                        ${tieneId(principal) ? `<button type="button" class="btn btn-peligro btn-sm" onclick="eliminarUbicacionPersona(${principal.id})">Eliminar</button>` : ''}
                    </div>
                </div>
            </div>`;
        }
    }
    if (resto.length > 0) {
        if (mostrarResto) {
            resto.forEach(u => {
                if (tieneId(u) && ubicacionEditando === u.id) {
                    html += `<div class="ubicacion-item ubicacion-editando" data-id="${u.id}">${renderFormularioEdicion(u)}</div>`;
                } else {
                    const btnWhats = tieneId(u) && personaId && tieneTelefonoValido ? (telefonosValidos.length > 1 ? `<button type="button" class="btn btn-sm" style="background:#25d366;color:#fff" onclick="mostrarSelectorTelefonoWhatsApp(${personaId}, ${u.id})" title="Enviar link por WhatsApp">📱 WhatsApp</button>` : `<button type="button" class="btn btn-sm" style="background:#25d366;color:#fff" onclick="enviarLinkWhatsApp(${personaId}, ${u.id}, ${telefonosValidos[0].id || 'null'})" title="Enviar link por WhatsApp">📱 WhatsApp</button>`) : '';
                    const btnMapa = (u.latitud != null && u.longitud != null) ? `<button type="button" class="btn btn-sm" onclick="verUbicacionEnMapa(${u.latitud},${u.longitud})" title="Ver en mapa">🗺️</button>` : '';
                    html += `<div class="ubicacion-item" data-id="${u.id || 'nuevo'}">
                        <div style="display:flex;justify-content:space-between;align-items:start;gap:0.5rem;flex-wrap:wrap">
                            <div>${formatearDireccion(u)}${(u.latitud && u.longitud) ? ` (${u.latitud}, ${u.longitud})` : ''}</div>
                            <div style="display:flex;gap:0.35rem">
                                ${btnMapa}
                                ${btnWhats}
                                ${tieneId(u) ? `<button type="button" class="btn btn-secundario btn-sm" onclick="iniciarEdicionUbicacion(${u.id})" title="Editar dirección">✏️ Editar</button>` : ''}
                                ${tieneId(u) ? `<button type="button" class="btn btn-peligro btn-sm" onclick="eliminarUbicacionPersona(${u.id})">Eliminar</button>` : ''}
                            </div>
                        </div>
                    </div>`;
                }
            });
        } else {
            html += `<button type="button" class="btn btn-secundario btn-sm" onclick="renderUbicacionesPersona(personaActualModal.ubicaciones, true)" style="margin-top:0.5rem">Ver más (${resto.length})</button>`;
        }
    }
    ubicacionesNuevas.forEach((u, i) => {
        const optTipoSel = listas.tiposVia.map(t => `<option value="${t.value}" ${(u.tipo_via || '') === t.value ? 'selected' : ''}>${t.label}</option>`).join('');
        const optOriSel = '<option value="">--</option>' + listas.orientaciones.map(o => `<option value="${o.value}" ${(u.orientacion || '') === o.value ? 'selected' : ''}>${o.label}</option>`).join('');
        if (!u.id) html += `<div class="ubicacion-item ubicacion-nueva" data-idx="${i}">
            <div class="fila-dir">
                <div class="form-grupo">
                    <label style="font-size:0.8rem">Calle: Tipo</label>
                    <select data-idx="${i}" data-campo="tipo_via"><option value="">--</option>${optTipoSel}</select>
                </div>
                <div class="form-grupo">
                    <label style="font-size:0.8rem">Nº</label>
                    <input type="text" placeholder="73" data-idx="${i}" data-campo="numero_via" value="${u.numero_via || ''}">
                </div>
                <div class="form-grupo">
                    <label style="font-size:0.8rem">A/B/C</label>
                    <input type="text" placeholder="A" data-idx="${i}" data-campo="complemento_via" value="${u.complemento_via || ''}" maxlength="3">
                </div>
            </div>
            <div class="fila-dir">
                <div class="form-grupo">
                    <label style="font-size:0.8rem">Orientación: Nº (entre)</label>
                    <input type="text" placeholder="25" data-idx="${i}" data-campo="numero_orientacion" value="${u.numero_orientacion || ''}">
                </div>
                <div class="form-grupo">
                    <label style="font-size:0.8rem">Sur/Norte/etc.</label>
                    <select data-idx="${i}" data-campo="orientacion">${optOriSel}</select>
                </div>
                <div class="form-grupo"></div>
            </div>
            <div class="fila-dir">
                <div class="form-grupo">
                    <label style="font-size:0.8rem">Placa: #</label>
                    <input type="text" placeholder="113" data-idx="${i}" data-campo="numero_placa" value="${u.numero_placa || ''}">
                </div>
                <div class="form-grupo">
                    <label style="font-size:0.8rem">A/B/C</label>
                    <input type="text" placeholder="A" data-idx="${i}" data-campo="complemento_placa" value="${u.complemento_placa || ''}" maxlength="3">
                </div>
                <div class="form-grupo">
                    <label style="font-size:0.8rem">Piso, torre, etc.</label>
                    <input type="text" placeholder="Opcional" data-idx="${i}" data-campo="descripcion_adicional" value="${u.descripcion_adicional || ''}">
                </div>
            </div>
            <div class="fila-dir">
                <div class="form-grupo" style="display:flex;align-items:flex-end;gap:0.35rem">
                    ${personaId && tieneTelefonoValido ? (telefonosValidos.length > 1 ? `<button type="button" class="btn btn-sm" style="background:#25d366;color:#fff" onclick="enviarWhatsAppDesdeFormNuevaConSelector(${i})" title="Guardar y enviar link por WhatsApp">📱 WhatsApp</button>` : `<button type="button" class="btn btn-sm" style="background:#25d366;color:#fff" onclick="enviarWhatsAppDesdeFormNueva(${i}, ${telefonosValidos[0].id || 'null'})" title="Guardar y enviar link por WhatsApp">📱 WhatsApp</button>`) : ''}
                    <button type="button" class="btn btn-peligro btn-sm" onclick="quitarUbicacionNueva(${i})">Quitar</button>
                </div>
            </div>
        </div>`;
    });
    cont.innerHTML = html || '<p style="color:var(--texto-suave);font-size:0.9rem">Sin ubicaciones registradas</p>';
}

function agregarUbicacionPersona() {
    ubicacionesNuevas.push({ tipo_via: '', numero_via: '', complemento_via: '', numero_placa: '', complemento_placa: '', orientacion: '', numero_orientacion: '', complemento_orientacion: '', descripcion_adicional: '', latitud: null, longitud: null });
    renderUbicacionesPersona(personaActualModal?.ubicaciones || [], true);
}

function quitarUbicacionNueva(idx) {
    ubicacionesNuevas.splice(idx, 1);
    renderUbicacionesPersona(personaActualModal?.ubicaciones || [], true);
}

function iniciarEdicionUbicacion(ubicacionId) {
    ubicacionEditando = ubicacionId;
    renderUbicacionesPersona(personaActualModal?.ubicaciones || [], true);
}

function cancelarEdicionUbicacion() {
    ubicacionEditando = null;
    renderUbicacionesPersona(personaActualModal?.ubicaciones || [], true);
}

async function guardarUbicacionEditada(ubicacionId) {
    const personaId = personaActualModal?.id_persona ?? personaActualModal?.id;
    if (!personaId) return;
    const div = document.querySelector(`.ubicacion-editando[data-id="${ubicacionId}"]`);
    if (!div) return;
    let tipoVia = div.querySelector(`[data-ubicacion-id="${ubicacionId}"][data-campo="tipo_via"]`)?.value;
    const numeroVia = div.querySelector(`[data-ubicacion-id="${ubicacionId}"][data-campo="numero_via"]`)?.value?.trim();
    if (!tipoVia && numeroVia) tipoVia = 'CALLE';
    if (!tipoVia || !numeroVia) {
        alert('Complete al menos Tipo vía y Nº vía.');
        return;
    }
    try {
        const complementoVia = div.querySelector(`[data-ubicacion-id="${ubicacionId}"][data-campo="complemento_via"]`)?.value?.trim();
        const numeroPlaca = div.querySelector(`[data-ubicacion-id="${ubicacionId}"][data-campo="numero_placa"]`)?.value?.trim();
        const complementoPlaca = div.querySelector(`[data-ubicacion-id="${ubicacionId}"][data-campo="complemento_placa"]`)?.value?.trim();
        const orientacion = div.querySelector(`[data-ubicacion-id="${ubicacionId}"][data-campo="orientacion"]`)?.value;
        const numeroOrientacion = div.querySelector(`[data-ubicacion-id="${ubicacionId}"][data-campo="numero_orientacion"]`)?.value?.trim();
        const descripcionAdicional = div.querySelector(`[data-ubicacion-id="${ubicacionId}"][data-campo="descripcion_adicional"]`)?.value?.trim();
        await peticion(`/personas/${personaId}/ubicaciones/${ubicacionId}`, {
            method: 'PUT',
            body: JSON.stringify({
                tipo_via: tipoVia, numero_via: numeroVia, complemento_via: complementoVia || null,
                numero_placa: numeroPlaca || null, complemento_placa: complementoPlaca || null,
                orientacion: orientacion || null, numero_orientacion: numeroOrientacion || null,
                descripcion_adicional: descripcionAdicional || null
            })
        });
        const personaActualizada = await peticion('/personas/' + personaId);
        personaActualModal = personaActualizada;
        ubicacionEditando = null;
        renderUbicacionesPersona(personaActualModal.ubicaciones || [], true);
    } catch (ex) {
        alert(ex.message);
    }
}

async function enviarWhatsAppDesdeFormNueva(idx, telefonoId = null) {
    const personaId = personaActualModal?.id_persona ?? personaActualModal?.id;
    const validos = obtenerTelefonosValidos();
    if (!personaId || validos.length === 0) {
        alert('Ingrese un teléfono válido (mínimo 10 dígitos) para enviar por WhatsApp.');
        return;
    }
    const div = document.querySelector(`.ubicacion-nueva[data-idx="${idx}"]`);
    if (!div) return;
    let tipoVia = div.querySelector('[data-campo="tipo_via"]')?.value;
    let numeroVia = div.querySelector('[data-campo="numero_via"]')?.value?.trim();
    if (!tipoVia && numeroVia) tipoVia = 'CALLE';
    if (!tipoVia || !numeroVia) {
        tipoVia = 'CALLE';
        numeroVia = 'S/N';
    }
    try {
        const complementoVia = div.querySelector('[data-campo="complemento_via"]')?.value?.trim();
        const numeroPlaca = div.querySelector('[data-campo="numero_placa"]')?.value?.trim();
        const complementoPlaca = div.querySelector('[data-campo="complemento_placa"]')?.value?.trim();
        const orientacion = div.querySelector('[data-campo="orientacion"]')?.value;
        const numeroOrientacion = div.querySelector('[data-campo="numero_orientacion"]')?.value?.trim();
        const descripcionAdicional = div.querySelector('[data-campo="descripcion_adicional"]')?.value?.trim();
        const nueva = await peticion(`/personas/${personaId}/ubicaciones`, {
            method: 'POST',
            body: JSON.stringify({
                tipo_via: tipoVia, numero_via: numeroVia, complemento_via: complementoVia || null,
                numero_placa: numeroPlaca || null, complemento_placa: complementoPlaca || null,
                orientacion: orientacion || null, numero_orientacion: numeroOrientacion || null,
                descripcion_adicional: descripcionAdicional || null
            })
        });
        ubicacionesNuevas.splice(idx, 1);
        if (!personaActualModal.ubicaciones) personaActualModal.ubicaciones = [];
        personaActualModal.ubicaciones.unshift(nueva);
        const bodyEnviar = telefonoId ? { telefonoId } : {};
        const data = await peticion(`/personas/${personaId}/ubicaciones/${nueva.id}/enviar-link`, { method: 'POST', body: JSON.stringify(bodyEnviar) });
        if (data.urlWhatsApp) {
            window.open(data.urlWhatsApp, '_blank');
        } else {
            await navigator.clipboard.writeText(data.url);
            alert('Enlace copiado. Pegue el enlace donde desee enviarlo.');
        }
        renderUbicacionesPersona(personaActualModal.ubicaciones, true);
    } catch (ex) {
        alert(ex.message);
    }
}

function telefonoValido(tel) {
    if (!tel || typeof tel !== 'string') return false;
    const digitos = tel.replace(/\D/g, '');
    return digitos.length >= 10;
}

function verUbicacionEnMapa(lat, lon) {
    const iframe = document.getElementById('iframe-mapa');
    const modal = document.getElementById('modal-mapa');
    const bbox = `${lon-0.01},${lat-0.01},${lon+0.01},${lat+0.01}`;
    if (iframe && modal) {
        iframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lon}`;
        modal.classList.remove('oculto');
    } else {
        window.open(`https://www.google.com/maps?q=${lat},${lon}`, '_blank');
    }
}

async function enviarLinkWhatsApp(personaId, ubicacionId, telefonoId = null) {
    try {
        const bodyEnviar = telefonoId ? { telefonoId } : {};
        const data = await peticion(`/personas/${personaId}/ubicaciones/${ubicacionId}/enviar-link`, { method: 'POST', body: JSON.stringify(bodyEnviar) });
        if (data.urlWhatsApp) {
            window.open(data.urlWhatsApp, '_blank');
        } else {
            await navigator.clipboard.writeText(data.url);
            alert('Enlace copiado. La persona no tiene teléfono registrado. Pegue el enlace donde desee enviarlo.');
        }
    } catch (ex) {
        alert(ex.message);
    }
}

function mostrarSelectorTelefonoWhatsApp(personaId, ubicacionId) {
    const validos = obtenerTelefonosValidos();
    if (validos.length === 0) {
        alert('No hay teléfonos con 10 dígitos para enviar por WhatsApp.');
        return;
    }
    if (validos.length === 1) {
        enviarLinkWhatsApp(personaId, ubicacionId, validos[0].id);
        return;
    }
    const opciones = validos.map(t => {
        const val = t.id != null ? t.id : 'legacy';
        return `<option value="${val}">${(t.numero || '').replace(/</g, '&lt;')}${(t.tipo || '') === 'fijo' ? ' (fijo)' : ''}</option>`;
    }).join('');
    const modal = document.createElement('div');
    modal.id = 'modal-selector-telefono';
    modal.className = 'overlay';
    modal.innerHTML = `
        <div class="modal">
            <h3>Elegir teléfono para WhatsApp</h3>
            <p style="color:var(--texto-suave);font-size:0.9rem;margin-bottom:1rem">Hay varios teléfonos con 10 dígitos. Seleccione cuál usar:</p>
            <select id="selector-telefono-whatsapp" style="width:100%;padding:0.5rem;margin-bottom:1rem">
                ${opciones}
            </select>
            <div style="display:flex;gap:0.5rem">
                <button type="button" class="btn btn-primario" onclick="confirmarTelefonoWhatsApp(${personaId}, ${ubicacionId})">Enviar</button>
                <button type="button" class="btn btn-secundario" onclick="document.getElementById('modal-selector-telefono').remove()">Cancelar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function confirmarTelefonoWhatsApp(personaId, ubicacionId) {
    const sel = document.getElementById('selector-telefono-whatsapp');
    const raw = sel?.value;
    const telefonoId = (raw === 'legacy' || !raw) ? null : parseInt(raw, 10);
    document.getElementById('modal-selector-telefono')?.remove();
    enviarLinkWhatsApp(personaId, ubicacionId, telefonoId);
}

async function enviarWhatsAppDesdeFormNuevaConSelector(idx) {
    const validos = obtenerTelefonosValidos();
    if (validos.length === 0) {
        alert('Ingrese un teléfono válido (mínimo 10 dígitos) para enviar por WhatsApp.');
        return;
    }
    if (validos.length === 1) {
        enviarWhatsAppDesdeFormNueva(idx, validos[0].id);
        return;
    }
    const opciones = validos.map(t => {
        const val = t.id != null ? t.id : 'legacy';
        return `<option value="${val}">${(t.numero || '').replace(/</g, '&lt;')}${(t.tipo || '') === 'fijo' ? ' (fijo)' : ''}</option>`;
    }).join('');
    const modal = document.createElement('div');
    modal.id = 'modal-selector-telefono-form';
    modal.className = 'overlay';
    modal.innerHTML = `
        <div class="modal">
            <h3>Elegir teléfono para WhatsApp</h3>
            <p style="color:var(--texto-suave);font-size:0.9rem;margin-bottom:1rem">Hay varios teléfonos con 10 dígitos. Seleccione cuál usar:</p>
            <select id="selector-telefono-whatsapp-form" style="width:100%;padding:0.5rem;margin-bottom:1rem">
                ${opciones}
            </select>
            <div style="display:flex;gap:0.5rem">
                <button type="button" class="btn btn-primario" onclick="confirmarTelefonoWhatsAppForm(${idx})">Enviar</button>
                <button type="button" class="btn btn-secundario" onclick="document.getElementById('modal-selector-telefono-form').remove()">Cancelar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function confirmarTelefonoWhatsAppForm(idx) {
    const sel = document.getElementById('selector-telefono-whatsapp-form');
    const raw = sel?.value;
    const telefonoId = (raw === 'legacy' || !raw) ? null : parseInt(raw, 10);
    document.getElementById('modal-selector-telefono-form')?.remove();
    enviarWhatsAppDesdeFormNueva(idx, telefonoId);
}

async function eliminarUbicacionPersona(ubicacionId) {
    const dir = personaActualModal?.ubicaciones?.find(u => u.id === ubicacionId);
    const textoDir = dir ? formatearDireccion(dir) : 'esta dirección';
    if (!confirm(`¿Eliminar "${textoDir}"?\n\nSe borrará permanentemente de la base de datos.`)) return;
    try {
        await peticion(`/personas/${personaActualModal.id_persona}/ubicaciones/${ubicacionId}`, { method: 'DELETE' });
        personaActualModal.ubicaciones = personaActualModal.ubicaciones.filter(u => u.id !== ubicacionId);
        renderUbicacionesPersona(personaActualModal.ubicaciones, true);
    } catch (ex) {
        alert(ex.message);
    }
}

async function guardarPersona(e) {
    e.preventDefault();
    const id = document.getElementById('persona-id').value;
    const err = document.getElementById('modal-persona-error');
    const btnGuardar = document.querySelector('#form-persona .btn-primario');
    const textoOriginal = btnGuardar?.textContent;
    const primerNombre = document.getElementById('persona-primer-nombre').value?.trim();
    const primerApellido = document.getElementById('persona-primer-apellido').value?.trim();
    if (!primerNombre || !primerApellido) {
        err.textContent = 'Primer nombre y primer apellido son requeridos.';
        err.classList.remove('oculto');
        err.classList.add('visible');
        return false;
    }
    err.classList.add('oculto');
    if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.textContent = 'Guardando...';
    }
    try {
        const body = {
            tipo_documento_codigo: document.getElementById('persona-tipo-documento').value,
            numero_documento: document.getElementById('persona-numero-documento').value || undefined,
            primer_nombre: primerNombre,
            segundo_nombre: document.getElementById('persona-segundo-nombre').value || undefined,
            primer_apellido: primerApellido,
            segundo_apellido: document.getElementById('persona-segundo-apellido').value || undefined,
            fecha_nacimiento: document.getElementById('persona-fecha-nacimiento').value || undefined,
            sexo_codigo: document.getElementById('persona-sexo').value || undefined,
            residencia_departamento: document.getElementById('persona-res-depto')?.value || null,
            residencia_municipio: document.getElementById('persona-res-muni')?.value || null,
            activo: document.getElementById('persona-activo').checked
        };
        if (usuarioActual.roles?.some(r => r.codigo === 'admin_dinamedical')) {
            body.ips_id = document.getElementById('persona-ips').value || null;
        }
        let idFinal = id;
        if (!id) {
            const nueva = await peticion('/personas', { method: 'POST', body: JSON.stringify(body) });
            idFinal = nueva.id_persona;
            document.getElementById('persona-id').value = idFinal;
            personaActualModal = { ...personaActualModal, id_persona: idFinal };
            for (let i = 0; i < telefonosNuevos.length; i++) {
                const div = document.querySelector(`.telefono-nuevo[data-idx="${i}"]`);
                if (div) {
                    const numero = div.querySelector('[data-campo="numero"]')?.value?.trim();
                    const tipo = div.querySelector('[data-campo="tipo"]')?.value || 'celular';
                    if (numero) await peticion(`/personas/${idFinal}/telefonos`, { method: 'POST', body: JSON.stringify({ numero, tipo }) });
                }
            }
            cerrarModal('modal-persona');
            cargarPersonas(document.getElementById('busqueda-personas')?.value || '');
            return false;
        }
        await peticion('/personas/' + idFinal, { method: 'PUT', body: JSON.stringify(body) });

        const nuevasDivs = document.querySelectorAll('.ubicacion-nueva');
        for (const div of nuevasDivs) {
            let tipoVia = div.querySelector('[data-campo="tipo_via"]')?.value;
            const numeroVia = div.querySelector('[data-campo="numero_via"]')?.value?.trim();
            if (!tipoVia && numeroVia) tipoVia = 'CALLE';
            const complementoVia = div.querySelector('[data-campo="complemento_via"]')?.value?.trim();
            const numeroPlaca = div.querySelector('[data-campo="numero_placa"]')?.value?.trim();
            const complementoPlaca = div.querySelector('[data-campo="complemento_placa"]')?.value?.trim();
            const orientacion = div.querySelector('[data-campo="orientacion"]')?.value;
            const numeroOrientacion = div.querySelector('[data-campo="numero_orientacion"]')?.value?.trim();
            const descripcionAdicional = div.querySelector('[data-campo="descripcion_adicional"]')?.value?.trim();
            if (tipoVia && numeroVia) {
                await peticion(`/personas/${id}/ubicaciones`, {
                    method: 'POST',
                    body: JSON.stringify({
                        tipo_via: tipoVia, numero_via: numeroVia, complemento_via: complementoVia || null,
                        numero_placa: numeroPlaca || null, complemento_placa: complementoPlaca || null,
                        orientacion: orientacion || null, numero_orientacion: numeroOrientacion || null,
                        descripcion_adicional: descripcionAdicional || null
                    })
                });
            }
        }

        cerrarModal('modal-persona');
        cargarPersonas(document.getElementById('busqueda-personas')?.value || '');
    } catch (ex) {
        err.textContent = ex.message;
        err.classList.remove('oculto');
        err.classList.add('visible');
    } finally {
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.textContent = textoOriginal || 'Guardar';
        }
    }
    return false;
}

async function cargarDepartamentosIpsModal() {
    if (!window._ipsDepartamentos) {
        window._ipsDepartamentos = await peticion('/catalogos/departamentos').catch(() => []);
    }
    const sel = document.getElementById('ips-departamento');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">-- Seleccionar --</option>' + (window._ipsDepartamentos || []).map(dep =>
        `<option value="${dep.codigo_departamento}">${dep.nombre_departamento}</option>`
    ).join('');
    if (prev) sel.value = prev;
}

async function cambiarDeptoIpsModal(municipioSeleccionado) {
    const cod = document.getElementById('ips-departamento')?.value;
    const mSel = document.getElementById('ips-municipio');
    if (!mSel) return;
    if (!cod) {
        mSel.innerHTML = '<option value="">-- Seleccionar --</option>';
        return;
    }
    const munis = await peticion('/catalogos/municipios?departamento=' + cod).catch(() => []);
    mSel.innerHTML = '<option value="">-- Seleccionar --</option>' + munis.map(m =>
        `<option value="${m.codigo_municipio}">${m.nombre_municipio}</option>`
    ).join('');
    if (municipioSeleccionado) mSel.value = municipioSeleccionado;
}

async function poblarUbicacionIpsModal(depto, municipio) {
    await cargarDepartamentosIpsModal();
    const dSel = document.getElementById('ips-departamento');
    if (dSel) dSel.value = depto || '';
    if (depto) await cambiarDeptoIpsModal(municipio || '');
    else {
        const mSel = document.getElementById('ips-municipio');
        if (mSel) mSel.innerHTML = '<option value="">-- Seleccionar --</option>';
    }
}

async function abrirModalIps(ipsId = null) {
    const esEdicion = !!ipsId;
    document.getElementById('modal-ips-titulo').textContent = esEdicion ? 'Editar IPS' : 'Nueva IPS';
    document.getElementById('modal-ips-error').classList.add('oculto');
    document.getElementById('modal-ips-error').classList.remove('visible');
    const esAdmin = usuarioActual.roles?.some(r => r.codigo === 'admin_dinamedical');
    if (!esEdicion) {
        document.getElementById('form-ips').reset();
        document.getElementById('ips-id').value = '';
    } else {
        document.getElementById('ips-id').value = ipsId || '';
    }
    document.getElementById('grupo-ips-activo').style.display = esAdmin ? 'block' : 'none';
    if (esEdicion) {
        const ips = await peticion('/ips');
        const i = ips.find(x => x.id == ipsId);
        if (i) {
            document.getElementById('ips-nombre').value = i.nombre;
            document.getElementById('ips-nit').value = i.nit || '';
            document.getElementById('ips-direccion').value = i.direccion || '';
            document.getElementById('ips-telefono').value = i.telefono || '';
            document.getElementById('ips-activo').checked = !!i.activo;
            await poblarUbicacionIpsModal(i.departamento, i.municipio);
        }
    } else {
        await poblarUbicacionIpsModal('', '');
    }
    document.getElementById('modal-ips').classList.remove('oculto');
}

async function guardarIps(e) {
    e.preventDefault();
    const id = document.getElementById('ips-id').value;
    const err = document.getElementById('modal-ips-error');
    err.classList.add('oculto');
    err.classList.remove('visible');
    const btn = document.querySelector('#form-ips button[type="submit"]');
    const txtBtn = btn?.textContent;
    try {
        const depto = document.getElementById('ips-departamento')?.value?.trim() || null;
        const muni = document.getElementById('ips-municipio')?.value?.trim() || null;
        const body = {
            nombre: document.getElementById('ips-nombre').value,
            nit: document.getElementById('ips-nit').value || null,
            direccion: document.getElementById('ips-direccion').value || null,
            telefono: document.getElementById('ips-telefono').value || null,
            departamento: depto,
            municipio: muni
        };
        if (usuarioActual.roles?.some(r => r.codigo === 'admin_dinamedical')) {
            body.activo = document.getElementById('ips-activo').checked;
        }
        if (!id) {
            await peticion('/ips', { method: 'POST', body: JSON.stringify(body) });
        } else {
            const resp = await peticion('/ips/' + id, { method: 'PUT', body: JSON.stringify(body) });
            if (depto && !resp?.departamento) {
                throw new Error('El servidor no guardó departamento/municipio. Aplique migración 020 y reinicie la API en el servidor.');
            }
        }
        cerrarModal('modal-ips');
        cargarIps();
    } catch (ex) {
        err.textContent = ex.message || 'No se pudo guardar la IPS';
        err.classList.remove('oculto');
        err.classList.add('visible');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = txtBtn || 'Guardar';
        }
    }
    return false;
}

async function editarIps(id) {
    await abrirModalIps(id);
}

async function eliminarIps(id, nombre) {
    if (!confirm('¿Eliminar la IPS "' + nombre + '"? Esta acción no se puede deshacer.')) return;
    try {
        await peticion('/ips/' + id, { method: 'DELETE' });
        cargarIps();
    } catch (ex) {
        alert(ex.message);
    }
}

// Hash routing
window.addEventListener('hashchange', () => navegar((location.hash || '#/dashboard').slice(1)));
window.addEventListener('load', init);
