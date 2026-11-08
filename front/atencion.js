// Módulo: Citas, consultas (datos básicos), historias clínicas

const estadoCitas = {
    anio: new Date().getFullYear(),
    mesCentral: new Date().getMonth(),
    fechaSeleccionada: null,
    ocupacionCache: {},
    configAgenda: null,
    pacientesCita: [],
    timerBusquedaPaciente: null,
    medicosAgenda: [],
    medicoAgendaId: null,
    citasDiaActual: [],
    fechaAgendaCargada: null,
    puedeElegirMedico: false
};

const estadoConsulta = {
    id: null,
    datos: {},
    listas: {},
    departamentos: [],
    municipiosResidencia: [],
    municipiosProcedencia: [],
    medicoConsultasId: null,
    medicosConsultas: [],
    citasProgramadas: [],
    citaAtencionId: null,
    puedeElegirMedico: false,
    personasList: []
};

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_SEM = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

function formatearFechaLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Hora desde API (HH:mm) o legacy Date/ISO de SQL Server */
function formatearHoraCita(hora) {
    if (hora == null || hora === '') return '';
    if (typeof hora === 'string') {
        const iso = hora.match(/T(\d{2}):(\d{2})/);
        if (iso) return `${iso[1]}:${iso[2]}`;
        const hm = hora.match(/^(\d{1,2}):(\d{2})/);
        if (hm) return `${hm[1].padStart(2, '0')}:${hm[2]}`;
        return hora.slice(0, 5);
    }
    if (typeof hora === 'object' && typeof hora.toISOString === 'function') {
        const d = new Date(hora);
        const h = d.getUTCHours();
        const m = d.getUTCMinutes();
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return String(hora);
}

function parseHoraCita(horaStr) {
    const part = formatearHoraCita(horaStr);
    if (!part) return null;
    const [h, min] = part.split(':').map(Number);
    if (Number.isNaN(h)) return null;
    const d = new Date();
    d.setHours(h, min || 0, 0, 0);
    return d;
}

function claseProximidadCita(fechaStr, horaStr) {
    const hoy = formatearFechaLocal(new Date());
    if (fechaStr < hoy) return 'slot-pasada';
    if (fechaStr > hoy) return 'slot-lejano';

    const ahora = new Date();
    const slot = parseHoraCita(horaStr);
    if (!slot) return 'slot-lejano';
    const diffMin = (slot - ahora) / 60000;
    if (diffMin < 0) return 'slot-pasada';

    if (diffMin <= 5) return 'slot-urgente';
    if (diffMin <= 30) return 'slot-cerca';
    if (diffMin <= 60) return 'slot-medio';
    return 'slot-lejano';
}

function horaSlot(indice, config) {
    const minutos = config.hora_inicio * 60 + indice * config.intervalo_minutos;
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function cargarCitas() {
    const cont = document.getElementById('contenido-citas');
    if (!cont || !tienePermiso('citas.ver')) return;

    if (!estadoCitas.configAgenda) {
        estadoCitas.configAgenda = await peticion('/citas/config-agenda');
    }

    // Abrir siempre en el último día que tuvo citas (evita la agenda vacía)
    if (!estadoCitas.fechaSeleccionada) {
        try {
            const { fecha } = await peticion('/citas/ultima-fecha');
            if (fecha) {
                const [y, m] = fecha.split('-').map(Number);
                estadoCitas.anio = y;
                estadoCitas.mesCentral = m - 1;
                estadoCitas.fechaSeleccionada = fecha;
            }
        } catch {
            // Si falla, se queda en el calendario actual sin selección
        }
    }

    cont.innerHTML = `
        <div class="pagina-encabezado">
            <h1>Citas</h1>
            ${tienePermiso('citas.crear') ? '<button type="button" class="btn btn-primario btn-sm" onclick="abrirModalCita()">+ Nueva cita</button>' : ''}
        </div>
        <div class="citas-anios" id="citas-anios"></div>
        <div class="citas-calendario-nav">
            <button type="button" class="btn btn-secundario btn-sm" onclick="moverCalendarioCitas(-3)">◀ Meses anteriores</button>
            <button type="button" class="btn btn-secundario btn-sm" onclick="moverCalendarioCitas(3)">Meses siguientes ▶</button>
        </div>
        <div class="citas-tres-meses" id="citas-tres-meses"></div>
        <div id="citas-detalle-dia" class="citas-detalle-dia oculto"></div>
    `;

    renderSelectorAniosCitas();
    await renderTresMesesCitas();
}

function renderSelectorAniosCitas() {
    const el = document.getElementById('citas-anios');
    if (!el) return;
    const actual = new Date().getFullYear();
    const anios = [estadoCitas.anio - 2, estadoCitas.anio - 1, estadoCitas.anio, estadoCitas.anio + 1, estadoCitas.anio + 2];
    el.innerHTML = anios.map(a => `
        <button type="button" class="citas-anio-btn ${a === estadoCitas.anio ? 'activo' : ''} ${a === actual ? 'actual' : ''}"
            onclick="seleccionarAnioCitas(${a})">${a}</button>
    `).join('');
}

async function seleccionarAnioCitas(anio) {
    estadoCitas.anio = anio;
    renderSelectorAniosCitas();
    await renderTresMesesCitas();
}

async function moverCalendarioCitas(deltaMeses) {
    let m = estadoCitas.mesCentral + deltaMeses;
    let y = estadoCitas.anio;
    while (m < 0) { m += 12; y--; }
    while (m > 11) { m -= 12; y++; }
    estadoCitas.mesCentral = m;
    estadoCitas.anio = y;
    renderSelectorAniosCitas();
    await renderTresMesesCitas();
}

async function obtenerOcupacionMes(anio, mes) {
    const clave = `${anio}-${mes}`;
    if (estadoCitas.ocupacionCache[clave]) return estadoCitas.ocupacionCache[clave];
    const data = await peticion(`/citas/ocupacion?anio=${anio}&mes=${mes + 1}`);
    estadoCitas.ocupacionCache[clave] = data;
    return data;
}

function htmlMiniCalendario(anio, mes, ocupacion, mesCentral) {
    const primerDia = new Date(anio, mes, 1);
    const ultimoDia = new Date(anio, mes + 1, 0).getDate();
    const offset = primerDia.getDay();
    let celdas = DIAS_SEM.map(d => `<div class="cal-dia-nom">${d}</div>`).join('');
    for (let i = 0; i < offset; i++) celdas += '<div class="cal-dia vacio"></div>';
    const hoy = formatearFechaLocal(new Date());
    for (let d = 1; d <= ultimoDia; d++) {
        const fecha = formatearFechaLocal(new Date(anio, mes, d));
        const info = ocupacion?.dias?.[fecha];
        const nivel = info?.nivel || '';
        const sel = estadoCitas.fechaSeleccionada === fecha ? ' seleccionado' : '';
        const esHoy = fecha === hoy ? ' hoy' : '';
        celdas += `<button type="button" class="cal-dia ${nivel}${sel}${esHoy}" data-fecha="${fecha}" onclick="seleccionarDiaCita('${fecha}')">${d}</button>`;
    }
    const esCentral = mes === mesCentral;
    return `
        <div class="cal-tarjeta ${esCentral ? 'central' : ''}">
            <h3>${MESES[mes]} ${anio}</h3>
            <div class="cal-grilla">${celdas}</div>
            <div class="cal-leyenda">
                <span class="ley verde"></span> Disponible
                <span class="ley amarillo"></span> 50%
                <span class="ley naranja"></span> 75%
                <span class="ley rojo"></span> Completo
            </div>
        </div>
    `;
}

async function renderTresMesesCitas() {
    const cont = document.getElementById('citas-tres-meses');
    if (!cont) return;
    const meses = [
        { y: estadoCitas.anio, m: estadoCitas.mesCentral - 1 },
        { y: estadoCitas.anio, m: estadoCitas.mesCentral },
        { y: estadoCitas.anio, m: estadoCitas.mesCentral + 1 }
    ].map(({ y, m }) => {
        let ym = y, mm = m;
        while (mm < 0) { mm += 12; ym--; }
        while (mm > 11) { mm -= 12; ym++; }
        return { y: ym, m: mm };
    });

    const ocupaciones = await Promise.all(meses.map(({ y, m }) => obtenerOcupacionMes(y, m)));
    cont.innerHTML = meses.map(({ y, m }, i) => htmlMiniCalendario(y, m, ocupaciones[i], estadoCitas.mesCentral)).join('');

    if (estadoCitas.fechaSeleccionada) {
        await cargarDetalleDiaCita(estadoCitas.fechaSeleccionada);
    }
}

async function seleccionarDiaCita(fecha) {
    estadoCitas.fechaSeleccionada = fecha;
    await renderTresMesesCitas();
}

function resolverMedicoAgendaInicial(citas, medicos) {
    const idsValidos = new Set(medicos.map(m => m.id));
    if (estadoCitas.medicoAgendaId != null && idsValidos.has(estadoCitas.medicoAgendaId)) {
        return estadoCitas.medicoAgendaId;
    }
    const idsConCita = new Set(citas.map(c => c.medico_usuario_id));
    const conCita = medicos.find(m => idsConCita.has(m.id));
    return conCita?.id ?? medicos[0]?.id ?? null;
}

async function cargarMedicosAgenda() {
    const data = await peticion('/citas/medicos');
    return normalizarMedicosAgenda(data);
}

function normalizarMedicosAgenda(data) {
    if (Array.isArray(data)) {
        return { medicos: data, puede_elegir_medico: data.length > 1 };
    }
    return {
        medicos: data.medicos || [],
        puede_elegir_medico: !!data.puede_elegir_medico
    };
}

function htmlSelectorMedicosAgenda(medicos) {
    if (!medicos.length) {
        return '<p class="texto-ayuda">No hay médicos disponibles para agendar en su IPS.</p>';
    }
    const medico = medicos.find(m => m.id === estadoCitas.medicoAgendaId) || medicos[0];
    if (!estadoCitas.puedeElegirMedico || medicos.length === 1) {
        const cargo = medico?.cargo ? ` — ${medico.cargo}` : '';
        return `<p class="citas-medico-fijo"><span class="citas-medicos-etiqueta">Médico</span> ${escHtml((medico?.nombre_completo || '') + cargo)}</p>`;
    }
    return `
        <p class="citas-medicos-etiqueta">Médico</p>
        <div class="citas-medicos citas-anios" role="tablist" aria-label="Agenda por médico">
            ${medicos.map(m => {
                const activo = m.id === estadoCitas.medicoAgendaId;
                const cargo = m.cargo ? ` · ${m.cargo}` : '';
                return `<button type="button" role="tab" aria-selected="${activo}"
                    class="citas-anio-btn citas-medico-btn ${activo ? 'activo' : ''}"
                    title="${escHtml(m.nombre_completo + cargo)}"
                    onclick="seleccionarMedicoAgenda(${m.id})">${escHtml(m.nombre_completo)}</button>`;
            }).join('')}
        </div>`;
}

function pintarGrillaAgendaDia(cont, fecha) {
    const cfg = estadoCitas.configAgenda;
    const medicos = estadoCitas.medicosAgenda;
    const citasDia = estadoCitas.citasDiaActual;
    const medicoId = estadoCitas.medicoAgendaId;
    const medico = medicos.find(m => m.id === medicoId);
    const citasMedico = medicoId
        ? citasDia.filter(c => c.medico_usuario_id === medicoId)
        : [];

    const mapaHora = {};
    citasMedico.forEach(c => {
        const h = formatearHoraCita(c.hora);
        if (h) mapaHora[h] = c;
    });

    let filasSlots = '';
    let citasEnGrilla = 0;
    for (let i = 0; i < cfg.slots_por_dia; i++) {
        const h = horaSlot(i, cfg);
        const c = mapaHora[h];
        const clase = c ? claseProximidadCita(fecha, h) : 'slot-vacio';
        if (c) citasEnGrilla++;
        const lugar = c
            ? (c.tipo_atencion === 'domicilio' ? 'Domicilio' : 'Consultorio (IPS)')
            : '—';
        const direccion = c
            ? (c.tipo_atencion === 'domicilio'
                ? (c.direccion_cita || '—')
                : (c.ips_direccion || c.ips_nombre || '—'))
            : '—';
        const registro = c && c.creado_en
            ? new Date(c.creado_en).toLocaleString('es-CO') + (c.registrado_por_nombre ? ` · ${c.registrado_por_nombre}` : '')
            : '—';
        const acciones = c && typeof tienePermiso === 'function' && tienePermiso('citas.editar')
            ? `<button type="button" class="btn btn-secundario btn-sm" onclick="abrirModalEditarCita(${c.id})">Editar</button>`
            : '—';
        filasSlots += `
            <tr class="${clase}${c ? ' fila-con-cita' : ''}">
                <td class="col-hora">${h}</td>
                <td>${c ? escHtml(c.paciente_nombre) : '—'}</td>
                <td>${c ? escHtml(c.ips_nombre || '') + '<br><small>' + escHtml(lugar) + '</small>' : '—'}</td>
                <td>${c ? escHtml(direccion) : '—'}</td>
                <td class="col-registro-cita">${c ? escHtml(registro) : '—'}</td>
                ${tienePermiso('citas.editar') ? `<td class="col-accion-cita">${acciones}</td>` : ''}
            </tr>`;
    }

    const citasFueraHorario = citasMedico.filter(c => !mapaHora[formatearHoraCita(c.hora)]);
    let avisoExtra = '';
    if (citasFueraHorario.length) {
        avisoExtra = `<p class="msg-error visible" style="margin-top:0.75rem">Hay ${citasFueraHorario.length} cita(s) de este médico fuera del horario ${cfg.hora_inicio}:00–${cfg.hora_fin}:00: ${citasFueraHorario.map(c => formatearHoraCita(c.hora)).join(', ')}</p>`;
    }

    const tituloMedico = medico
        ? escHtml(medico.nombre_completo + (medico.cargo ? ` — ${medico.cargo}` : ''))
        : '—';
    const resumenCitas = medicoId
        ? `${citasEnGrilla} cita(s) de ${citasMedico.length} en el día para este médico`
        : 'Seleccione un médico';

    // Con médico fijo el selector ya muestra el nombre; el h3 solo va en modo tabs (varios médicos)
    const tituloMostrado = estadoCitas.puedeElegirMedico && medicos.length > 1
        ? `<h3 class="citas-agenda-medico-titulo">${tituloMedico}</h3>`
        : '';

    cont.innerHTML = `
        <h2>Agenda del ${fecha}</h2>
        ${htmlSelectorMedicosAgenda(medicos)}
        ${tituloMostrado}
        <p class="texto-ayuda">${resumenCitas} · Hoy: verde &lt;1 h; naranja &lt;30 min; salmón ≤5 min · Gris = ya pasó</p>
        <div class="tabla-contenedor citas-agenda-wrap">
            <table class="tabla-datos citas-grilla-horas citas-agenda">
                <thead><tr>
                    <th>Hora</th><th>Paciente</th><th>IPS / lugar</th><th>Dirección</th><th>Registro</th>
                    ${tienePermiso('citas.editar') ? '<th></th>' : ''}
                </tr></thead>
                <tbody>${filasSlots}</tbody>
            </table>
        </div>
        ${avisoExtra}
    `;
}

function seleccionarMedicoAgenda(medicoId) {
    estadoCitas.medicoAgendaId = medicoId;
    const cont = document.getElementById('citas-detalle-dia');
    const fecha = estadoCitas.fechaSeleccionada;
    if (cont && fecha) {
        pintarGrillaAgendaDia(cont, fecha);
    }
}

async function cargarDetalleDiaCita(fecha) {
    const cont = document.getElementById('citas-detalle-dia');
    if (!cont) return;
    cont.classList.remove('oculto');

    if (estadoCitas.fechaAgendaCargada !== fecha) {
        estadoCitas.medicoAgendaId = null;
        estadoCitas.fechaAgendaCargada = fecha;
    }

    const [citas, medData] = await Promise.all([
        peticion(`/citas/dia?fecha=${fecha}`),
        cargarMedicosAgenda()
    ]);
    estadoCitas.citasDiaActual = citas;
    estadoCitas.medicosAgenda = medData.medicos;
    estadoCitas.puedeElegirMedico = medData.puede_elegir_medico;
    const medicos = medData.medicos;
    estadoCitas.medicoAgendaId = resolverMedicoAgendaInicial(citas, medicos);
    pintarGrillaAgendaDia(cont, fecha);
}

function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function nombreCompletoPersona(p) {
    return [p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ');
}

function etiquetaPacienteCita(p) {
    const doc = [p.tipo_documento_codigo, p.numero_documento].filter(Boolean).join(' ');
    const nom = nombreCompletoPersona(p);
    return doc ? `${doc} — ${nom}` : nom;
}

function renderSelectPacientesCita(personas, idSeleccionado) {
    const sel = document.getElementById('cita-paciente');
    if (!sel) return;
    const lista = personas || [];
    if (!lista.length) {
        sel.innerHTML = '<option value="">— Sin resultados —</option>';
        return;
    }
    sel.innerHTML = lista.map(p => {
        const selAttr = String(p.id_persona) === String(idSeleccionado) ? ' selected' : '';
        return `<option value="${p.id_persona}"${selAttr}>${escHtml(etiquetaPacienteCita(p))}</option>`;
    }).join('');
}

function filtrarPacientesCitaLocal(termino) {
    const t = (termino || '').trim().toLowerCase();
    if (!t) return estadoCitas.pacientesCita;
    return estadoCitas.pacientesCita.filter(p => {
        const nom = nombreCompletoPersona(p).toLowerCase();
        const doc = String(p.numero_documento || '').toLowerCase();
        const tipo = String(p.tipo_documento_codigo || '').toLowerCase();
        return nom.includes(t) || doc.includes(t) || `${tipo} ${doc}`.includes(t);
    });
}

async function filtrarPacientesCita() {
    const input = document.getElementById('cita-paciente-buscar');
    const sel = document.getElementById('cita-paciente');
    const termino = input?.value?.trim() || '';
    const idPrevio = sel?.value || '';

    clearTimeout(estadoCitas.timerBusquedaPaciente);
    estadoCitas.timerBusquedaPaciente = setTimeout(async () => {
        try {
            let lista;
            if (termino.length >= 2) {
                lista = await peticion('/personas?busqueda=' + encodeURIComponent(termino));
            } else {
                lista = filtrarPacientesCitaLocal(termino);
            }
            renderSelectPacientesCita(lista, idPrevio);
        } catch (ex) {
            renderSelectPacientesCita(filtrarPacientesCitaLocal(termino), idPrevio);
        }
    }, termino.length >= 2 ? 280 : 0);
}

function configurarSelectMedicoCita(medicos) {
    const selMed = document.getElementById('cita-medico');
    if (!selMed) return;
    selMed.innerHTML = medicos.map(m => `<option value="${m.id}">${escHtml(m.nombre_completo + (m.cargo ? ' — ' + m.cargo : ''))}</option>`).join('');
    selMed.disabled = !estadoCitas.puedeElegirMedico && medicos.length <= 1;
}

async function abrirModalCita() {
    const modal = document.getElementById('modal-cita');
    if (!modal) return;
    document.getElementById('form-cita').reset();
    document.getElementById('cita-id').value = '';
    const titulo = document.getElementById('modal-cita-titulo');
    if (titulo) titulo.textContent = 'Nueva cita';
    const btnCancelar = document.getElementById('btn-cancelar-cita');
    if (btnCancelar) btnCancelar.classList.add('oculto');
    const errCita = document.getElementById('modal-cita-error');
    if (errCita) {
        errCita.classList.add('oculto');
        errCita.classList.remove('visible');
        errCita.textContent = '';
    }
    const fecha = estadoCitas.fechaSeleccionada || formatearFechaLocal(new Date());
    document.getElementById('cita-fecha').value = fecha;

    const buscarPac = document.getElementById('cita-paciente-buscar');
    if (buscarPac) {
        buscarPac.value = '';
        buscarPac.oninput = () => filtrarPacientesCita();
    }

    const [medData, personas] = await Promise.all([
        cargarMedicosAgenda(),
        peticion('/personas')
    ]);
    estadoCitas.pacientesCita = personas;
    estadoCitas.medicosAgenda = medData.medicos;
    estadoCitas.puedeElegirMedico = medData.puede_elegir_medico;
    configurarSelectMedicoCita(medData.medicos);
    const selMed = document.getElementById('cita-medico');
    if (estadoCitas.medicoAgendaId && medData.medicos.some(m => m.id === estadoCitas.medicoAgendaId)) {
        selMed.value = String(estadoCitas.medicoAgendaId);
    } else if (typeof usuarioActual !== 'undefined' && usuarioActual?.id) {
        const propio = medData.medicos.find(m => m.id === usuarioActual.id);
        if (propio) selMed.value = String(propio.id);
    }
    renderSelectPacientesCita(personas, '');

    const cfg = estadoCitas.configAgenda || await peticion('/citas/config-agenda');
    const selHora = document.getElementById('cita-hora');
    selHora.innerHTML = Array.from({ length: cfg.slots_por_dia }, (_, i) => {
        const h = horaSlot(i, cfg);
        return `<option value="${h}">${h}</option>`;
    }).join('');

    toggleDireccionCita();
    modal.classList.remove('oculto');
}

async function abrirModalEditarCita(citaId) {
    let cita = estadoCitas.citasDiaActual.find(c => c.id === citaId);
    if (!cita) cita = await peticion(`/citas/${citaId}`);

    const modal = document.getElementById('modal-cita');
    if (!modal) return;
    document.getElementById('cita-id').value = String(cita.id);
    const titulo = document.getElementById('modal-cita-titulo');
    if (titulo) titulo.textContent = 'Editar cita';
    const btnCancelar = document.getElementById('btn-cancelar-cita');
    if (btnCancelar) btnCancelar.classList.remove('oculto');

    const errCita = document.getElementById('modal-cita-error');
    if (errCita) {
        errCita.classList.add('oculto');
        errCita.classList.remove('visible');
        errCita.textContent = '';
    }

    const [medData, personas] = await Promise.all([
        cargarMedicosAgenda(),
        peticion('/personas')
    ]);
    estadoCitas.pacientesCita = personas;
    estadoCitas.puedeElegirMedico = medData.puede_elegir_medico;
    configurarSelectMedicoCita(medData.medicos);
    document.getElementById('cita-medico').value = String(cita.medico_usuario_id);
    document.getElementById('cita-fecha').value = cita.fecha;
    renderSelectPacientesCita(personas, String(cita.paciente_persona_id));

    const cfg = estadoCitas.configAgenda || await peticion('/citas/config-agenda');
    const selHora = document.getElementById('cita-hora');
    const horaCita = formatearHoraCita(cita.hora);
    selHora.innerHTML = Array.from({ length: cfg.slots_por_dia }, (_, i) => {
        const h = horaSlot(i, cfg);
        return `<option value="${h}">${h}</option>`;
    }).join('');
    selHora.value = horaCita;

    document.getElementById('cita-tipo').value = cita.tipo_atencion || 'consultorio';
    document.getElementById('cita-direccion').value = cita.direccion_cita || '';
    document.getElementById('cita-obs').value = cita.observaciones || '';
    toggleDireccionCita();
    modal.classList.remove('oculto');
}

async function cancelarCitaAgenda() {
    const id = document.getElementById('cita-id')?.value;
    if (!id || !confirm('¿Cancelar esta cita? (quedará inactiva en la agenda)')) return;
    const err = document.getElementById('modal-cita-error');
    try {
        await peticion(`/citas/${id}`, { method: 'PUT', body: JSON.stringify({ activo: false }) });
        cerrarModal('modal-cita');
        estadoCitas.ocupacionCache = {};
        await cargarCitas();
    } catch (ex) {
        err.textContent = ex.message;
        err.classList.remove('oculto');
        err.classList.add('visible');
    }
}

function toggleDireccionCita() {
    const tipo = document.getElementById('cita-tipo')?.value;
    const g = document.getElementById('grupo-direccion-cita');
    if (g) g.classList.toggle('oculto', tipo !== 'domicilio');
}

async function guardarCita(e) {
    e.preventDefault();
    const err = document.getElementById('modal-cita-error');
    err.classList.add('oculto');
    err.classList.remove('visible');
    try {
        const body = {
            paciente_persona_id: parseInt(document.getElementById('cita-paciente').value, 10),
            medico_usuario_id: parseInt(document.getElementById('cita-medico').value, 10),
            fecha: document.getElementById('cita-fecha').value,
            hora: document.getElementById('cita-hora').value,
            tipo_atencion: document.getElementById('cita-tipo').value,
            direccion_cita: document.getElementById('cita-direccion').value || null,
            observaciones: document.getElementById('cita-obs').value || null
        };
        if (typeof usuarioActual !== 'undefined' && usuarioActual?.ips_id) {
            body.ips_id = usuarioActual.ips_id;
        }
        const citaId = document.getElementById('cita-id')?.value;
        if (citaId) {
            await peticion(`/citas/${citaId}`, { method: 'PUT', body: JSON.stringify(body) });
        } else {
            await peticion('/citas', { method: 'POST', body: JSON.stringify(body) });
        }
        cerrarModal('modal-cita');
        estadoCitas.ocupacionCache = {};
        estadoCitas.fechaSeleccionada = body.fecha;
        await cargarCitas();
    } catch (ex) {
        err.textContent = ex.message || 'No se pudo agendar la cita';
        err.classList.remove('oculto');
        err.classList.add('visible');
        err.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    return false;
}

async function cargarListasConsulta() {
    const refs = [
        'tipo_documento_sivigila', 'unidad_medida_edad', 'sexo_sivigila', 'area_procedencia',
        'regimen_salud', 'pertenencia_etnica', 'fuente_notificacion', 'clasificacion_inicial_caso',
        'condicion_final', 'identidad_genero', 'orientacion_sexual', 'grupos_poblacionales'
    ];
    const listas = {};
    await Promise.all(refs.map(async ref => {
        listas[ref] = await peticion(`/catalogos/listas?ref=${ref}`);
    }));
    estadoConsulta.listas = listas;
    estadoConsulta.departamentos = await peticion('/catalogos/departamentos');
    estadoConsulta.eventos = await peticion('/catalogos/tipo-evento');
}

function optionsLista(ref, valActual) {
    const items = estadoConsulta.listas[ref] || [];
    return items.map(o => `<option value="${escHtml(o.value)}" ${o.value === valActual ? 'selected' : ''}>${escHtml(o.label)}</option>`).join('');
}

function fechaPersonaParaInput(fecha) {
    if (fecha == null || fecha === '') return '';
    if (typeof fecha === 'string') {
        const iso = fecha.match(/^(\d{4}-\d{2}-\d{2})/);
        if (iso) return iso[1];
    }
    const d = new Date(fecha);
    if (!Number.isNaN(d.getTime())) return formatearFechaLocal(d);
    return '';
}

/** Edad SIVIGILA (unidad 1=años … 5=minutos) respecto a fecha de consulta o hoy */
function calcularEdadSivigila(fechaNacimiento, fechaReferencia) {
    if (!fechaNacimiento) return null;
    const refStr = fechaReferencia || document.getElementById('qc-fecha-consulta')?.value || document.getElementById('db-fecha-consulta')?.value || formatearFechaLocal(new Date());
    const ref = new Date(refStr + 'T12:00:00');
    const nac = new Date(fechaNacimiento + 'T12:00:00');
    if (Number.isNaN(nac.getTime()) || Number.isNaN(ref.getTime()) || nac > ref) return null;

    const diffMs = ref - nac;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return { edad: Math.max(diffMin, 0), unidad_medida_edad: '5' };
    const diffHoras = Math.floor(diffMin / 60);
    if (diffHoras < 24) return { edad: diffHoras, unidad_medida_edad: '4' };
    const diffDias = Math.floor(diffMs / 86400000);
    if (diffDias < 30) return { edad: diffDias, unidad_medida_edad: '3' };

    let anios = ref.getFullYear() - nac.getFullYear();
    let meses = ref.getMonth() - nac.getMonth();
    let dias = ref.getDate() - nac.getDate();
    if (dias < 0) {
        meses -= 1;
        const ultimoDiaMesPrev = new Date(ref.getFullYear(), ref.getMonth(), 0).getDate();
        dias += ultimoDiaMesPrev;
    }
    if (meses < 0) {
        anios -= 1;
        meses += 12;
    }
    const totalMeses = anios * 12 + meses;
    if (anios >= 1) return { edad: anios, unidad_medida_edad: '1' };
    if (totalMeses >= 1) return { edad: totalMeses, unidad_medida_edad: '2' };
    return { edad: Math.max(diffDias, 0), unidad_medida_edad: '3' };
}

function recalcularEdadConsulta() {
    const fn = document.getElementById('db-fecha-nacimiento')?.value;
    const r = calcularEdadSivigila(fn);
    const edadEl = document.getElementById('db-edad');
    const unidadEl = document.getElementById('db-unidad-edad');
    if (!r) {
        if (edadEl && !edadEl.dataset.manual) edadEl.value = '';
        document.getElementById('qc-edad').value = edadEl ? edadEl.value : '';
        return;
    }
    if (edadEl) {
        edadEl.value = String(r.edad);
        edadEl.dataset.auto = '1';
    }
    if (unidadEl) unidadEl.value = r.unidad_medida_edad;
    const qcEdad = document.getElementById('qc-edad');
    if (qcEdad) qcEdad.value = edadEl ? edadEl.value : '';
}

async function repoblarMunicipiosResidenciaConsulta(municipioCodigo, soloVacios) {
    const deptoEl = document.getElementById('db-res-depto');
    const muniEl = document.getElementById('db-res-muni');
    if (!deptoEl?.value || !muniEl) return;
    const munis = await peticion('/catalogos/municipios?departamento=' + deptoEl.value);
    estadoConsulta.municipiosResidencia = munis;
    muniEl.innerHTML = '<option value="">--</option>' + munis.map(m =>
        `<option value="${m.codigo_municipio}">${escHtml(m.nombre_municipio)}</option>`
    ).join('');
    if (municipioCodigo && (!soloVacios || !muniEl.value)) muniEl.value = municipioCodigo;
}

async function aplicarDatosPacienteConsulta(personaId, soloVacios = false) {
    if (!personaId) return;
    const p = estadoConsulta.personasList.find(x => String(x.id_persona) === String(personaId));
    if (!p) return;

    const asignar = (id, valor) => {
        const el = document.getElementById(id);
        if (!el || valor == null || valor === '') return;
        if (soloVacios && el.value) return;
        el.value = valor;
    };

    asignar('db-tipo-documento', p.tipo_documento_codigo);
    asignar('db-numero-documento', p.numero_documento);
    const fn = fechaPersonaParaInput(p.fecha_nacimiento);
    if (fn) {
        asignar('db-fecha-nacimiento', fn);
        recalcularEdadConsulta();
    }
    if (p.sexo_codigo) asignar('db-sexo', p.sexo_codigo);

    let deptoRes = p.residencia_departamento;
    let muniRes = p.residencia_municipio;

    try {
        const det = await peticion(`/personas/${personaId}`);
        const tel = (det.telefonos || []).map(t => t.numero).find(n => n && String(n).trim());
        if (tel) asignar('db-telefono', String(tel).trim());
        deptoRes = deptoRes || det.residencia_departamento;
        muniRes = muniRes || det.residencia_municipio;
    } catch {
        /* sin detalle */
    }

    if (deptoRes) {
        asignar('db-res-depto', deptoRes);
        await repoblarMunicipiosResidenciaConsulta(muniRes, soloVacios);
    }
    espejarFichaDesdeConsulta();
}

function enlazarPacienteConsultaForm() {
    const sel = document.getElementById('consulta-paciente');
    if (!sel || sel.dataset.enlazado === '1') return;
    sel.dataset.enlazado = '1';
    // El paciente ya no es selector: viene fijado desde la cita (hidden). Si algún día vuelve a ser select, se reactiva el change.
    if (sel.tagName === 'SELECT') sel.addEventListener('change', () => aplicarDatosPacienteConsulta(sel.value, false));
    document.getElementById('db-fecha-nacimiento')?.addEventListener('change', recalcularEdadConsulta);
    document.getElementById('db-fecha-consulta')?.addEventListener('change', recalcularEdadConsulta);
    if (sel.value) aplicarDatosPacienteConsulta(sel.value, true);
}

/** UPGD = razón social de la IPS del médico que atiende en esta sección */
function razonSocialUpgdConsulta(d, consultaExistente) {
    const medicoId = estadoConsulta.medicoConsultasId
        ?? consultaExistente?.profesional_usuario_id
        ?? (typeof usuarioActual !== 'undefined' ? usuarioActual.id : null);
    const med = (estadoConsulta.medicosConsultas || []).find(m => m.id === medicoId);
    if (med?.ips_nombre) return med.ips_nombre;
    if (consultaExistente?.ips_nombre) return consultaExistente.ips_nombre;
    if (d?.razon_social_upgd) return d.razon_social_upgd;
    if (medicoId && typeof usuarioActual !== 'undefined' && usuarioActual.id === medicoId && usuarioActual.ips_nombre) {
        return usuarioActual.ips_nombre;
    }
    return (typeof usuarioActual !== 'undefined' && usuarioActual?.ips_nombre) ? usuarioActual.ips_nombre : '';
}

function actualizarCampoUpgdConsulta(consultaExistente = null) {
    const el = document.getElementById('db-razon-social-upgd');
    if (!el) return;
    el.value = razonSocialUpgdConsulta(estadoConsulta.datos, consultaExistente);
}

async function obtenerUbicacionIpsMedicoConsulta() {
    const medicoId = estadoConsulta.medicoConsultasId
        ?? (typeof usuarioActual !== 'undefined' ? usuarioActual.id : null);
    const med = (estadoConsulta.medicosConsultas || []).find(m => m.id === medicoId);
    if (med?.ips_departamento) {
        return { depto: med.ips_departamento, muni: med.ips_municipio };
    }
    const ipsId = med?.ips_id || (typeof usuarioActual !== 'undefined' ? usuarioActual.ips_id : null);
    if (ipsId && typeof tienePermiso === 'function' && tienePermiso('ips.ver')) {
        try {
            const ipsList = await peticion('/ips');
            const ips = ipsList.find(i => i.id === ipsId);
            if (ips?.departamento) return { depto: ips.departamento, muni: ips.municipio };
        } catch { /* ignore */ }
    }
    return { depto: null, muni: null };
}

async function repoblarMunicipiosProcedenciaConsulta(municipioCodigo, soloVacios) {
    const deptoEl = document.getElementById('db-proc-depto');
    const muniEl = document.getElementById('db-proc-muni');
    if (!deptoEl?.value || !muniEl) return;
    const munis = await peticion('/catalogos/municipios?departamento=' + deptoEl.value);
    estadoConsulta.municipiosProcedencia = munis;
    muniEl.innerHTML = '<option value="">--</option>' + munis.map(m =>
        `<option value="${m.codigo_municipio}">${escHtml(m.nombre_municipio)}</option>`
    ).join('');
    if (municipioCodigo && (!soloVacios || !muniEl.value)) muniEl.value = municipioCodigo;
}

async function actualizarProcedenciaOcurrenciaConsulta(consultaExistente = null, soloVacios = true) {
    const d = estadoConsulta.datos || {};
    if (soloVacios && d.procedencia_departamento) return;

    const procDeptoEl = document.getElementById('db-proc-depto');
    if (!procDeptoEl) return;
    if (soloVacios && procDeptoEl.value) return;

    const { depto, muni } = await obtenerUbicacionIpsMedicoConsulta();
    if (!depto) return;

    procDeptoEl.value = depto;
    await repoblarMunicipiosProcedenciaConsulta(muni, soloVacios);
}

function resolverMedicoConsultasInicial(medicos) {
    const ids = new Set(medicos.map(m => m.id));
    if (estadoConsulta.medicoConsultasId != null && ids.has(estadoConsulta.medicoConsultasId)) {
        return estadoConsulta.medicoConsultasId;
    }
    if (typeof usuarioActual !== 'undefined' && usuarioActual?.id && ids.has(usuarioActual.id)) {
        return usuarioActual.id;
    }
    return medicos[0]?.id ?? null;
}

function htmlSelectorMedicosConsultas(medicos) {
    if (!medicos.length) {
        return '<p class="texto-suave">No hay médicos en la IPS para filtrar citas.</p>';
    }
    const medico = medicos.find(m => m.id === estadoConsulta.medicoConsultasId) || medicos[0];
    if (!estadoConsulta.puedeElegirMedico || medicos.length === 1) {
        return `<p class="citas-medico-fijo"><span class="citas-medicos-etiqueta">Médico</span> ${escHtml(medico?.nombre_completo || '')}</p>`;
    }
    return `
        <p class="citas-medicos-etiqueta">Médico</p>
        <div class="citas-medicos citas-anios consultas-medicos" role="tablist">
            ${medicos.map(m => {
                const activo = m.id === estadoConsulta.medicoConsultasId;
                return `<button type="button" role="tab" aria-selected="${activo}"
                    class="citas-anio-btn citas-medico-btn ${activo ? 'activo' : ''}"
                    onclick="seleccionarMedicoConsultas(${m.id})">${escHtml(m.nombre_completo)}</button>`;
            }).join('')}
        </div>`;
}

function htmlListaCitasProgramadas(citas) {
    if (!estadoConsulta.medicoConsultasId) {
        return '<li class="texto-suave">Seleccione un médico</li>';
    }
    if (!citas.length) {
        return '<li class="texto-suave">Sin citas pendientes de atención</li>';
    }
    const hoy = formatearFechaLocal(new Date());
    return citas.map(c => {
        const hora = formatearHoraCita(c.hora);
        const pasada = c.fecha < hoy;
        return `<li>
            <button type="button" class="consulta-item cita-programada-item ${pasada ? 'cita-prog-pasada' : ''}"
                onclick="atenderCitaProgramada(${c.id})">
                <span class="cita-prog-hora">${escHtml(hora)}</span>
                <span class="cita-prog-fecha">${escHtml(c.fecha)}</span><br>
                ${escHtml(c.paciente_nombre)}
                <small>${c.tipo_atencion === 'domicilio' ? 'Domicilio' : 'Consultorio'}</small>
            </button>
        </li>`;
    }).join('');
}

async function obtenerMedicosParaConsultas() {
    if (tienePermiso('citas.ver')) {
        try {
            const medData = await cargarMedicosAgenda();
            // En consultas solo aparece el médico que inició sesión (no todos los médicos de la IPS)
            const yo = (medData.medicos || []).filter(m => typeof usuarioActual !== 'undefined' && m.id === usuarioActual.id);
            if (yo.length) return { medicos: yo, puede_elegir_medico: false };
        } catch {
            /* continuar con fallback */
        }
    }
    if (typeof usuarioActual !== 'undefined' && usuarioActual?.id) {
        const nom = [usuarioActual.nombre, usuarioActual.apellido].filter(Boolean).join(' ');
        return {
            medicos: [{
                id: usuarioActual.id,
                nombre_completo: nom || usuarioActual.email,
                cargo: usuarioActual.cargo,
                ips_id: usuarioActual.ips_id,
                ips_nombre: usuarioActual.ips_nombre,
                ips_departamento: null,
                ips_municipio: null
            }],
            puede_elegir_medico: false
        };
    }
    return { medicos: [], puede_elegir_medico: false };
}

async function seleccionarMedicoConsultas(medicoId) {
    estadoConsulta.medicoConsultasId = medicoId;
    const consultaAbierta = estadoConsulta.id;
    await cargarConsultas();
    if (consultaAbierta) await abrirConsulta(consultaAbierta);
}

async function cargarConsultas() {
    const cont = document.getElementById('contenido-consultas');
    if (!cont || !tienePermiso('consultas.ver')) return;

    await cargarListasConsulta();
    const medData = await obtenerMedicosParaConsultas();
    const medicos = medData.medicos;
    estadoConsulta.medicosConsultas = medicos;
    estadoConsulta.puedeElegirMedico = medData.puede_elegir_medico;
    estadoConsulta.medicoConsultasId = resolverMedicoConsultasInicial(medicos);

    let citasProgramadas = [];
    let consultas = [];
    if (estadoConsulta.medicoConsultasId) {
        [citasProgramadas, consultas] = await Promise.all([
            peticion(`/consultas/citas-programadas?medico_usuario_id=${estadoConsulta.medicoConsultasId}`),
            peticion(`/consultas?profesional_usuario_id=${estadoConsulta.medicoConsultasId}`)
        ]);
    } else {
        consultas = await peticion('/consultas');
    }
    estadoConsulta.citasProgramadas = citasProgramadas;

    const sintomas = await peticion('/catalogos/sintomas');
    const medico = medicos.find(m => m.id === estadoConsulta.medicoConsultasId);
    const subtituloMedico = medico
        ? `<p class="texto-ayuda consultas-subtitulo-medico">Atención: <strong>${escHtml(medico.nombre_completo)}</strong></p>`
        : '';

    cont.innerHTML = `
        <div class="pagina-encabezado">
            <h1>Consultas — Datos básicos</h1>
            ${tienePermiso('consultas.crear') ? '<button type="button" class="btn btn-primario btn-sm" onclick="nuevaConsulta()">+ Nueva consulta</button>' : ''}
        </div>
        ${subtituloMedico}
        <div class="consultas-layout">
            <aside class="consultas-lista">
                ${htmlSelectorMedicosConsultas(medicos)}
                <h3 class="consultas-seccion-titulo">Citas programadas</h3>
                <p class="texto-ayuda consultas-ayuda-citas">Desde agenda · sin consulta aún</p>
                <ul class="lista-consultas lista-citas-programadas" id="lista-citas-programadas">
                    ${htmlListaCitasProgramadas(citasProgramadas)}
                </ul>
                <h3 class="consultas-seccion-titulo">Registros de consulta</h3>
                <ul class="lista-consultas" id="lista-consultas">
                    ${consultas.map(c => `
                        <li><button type="button" class="consulta-item ${estadoConsulta.id === c.id ? 'activo' : ''}"
                            onclick="abrirConsulta(${c.id})">${escHtml(c.paciente_nombre)}<br><small>${escHtml(c.nombre_evento || 'Sin evento')} — ${c.estado}</small></button></li>
                    `).join('') || '<li class="texto-suave">Sin consultas</li>'}
                </ul>
            </aside>
            <section class="consultas-formulario" id="panel-consulta-form">
                <p class="texto-suave">Seleccione una cita programada, un registro o cree una nueva consulta.</p>
            </section>
        </div>
    `;
    window._catalogoSintomas = sintomas;
}

async function atenderCitaProgramada(citaId) {
    const cita = estadoConsulta.citasProgramadas.find(c => c.id === citaId);
    if (!cita) return;
    estadoConsulta.citaAtencionId = cita.id;
    await nuevaConsultaDesdeCita(cita);
}

async function nuevaConsultaDesdeCita(cita) {
    estadoConsulta.id = null;
    estadoConsulta.datos = {
        fecha_consulta: cita.fecha,
        tipo_documento: cita.tipo_documento_codigo || undefined,
        numero_documento: cita.numero_documento || undefined
    };
    estadoConsulta.municipiosResidencia = [];
    estadoConsulta.municipiosProcedencia = [];
    if (!estadoConsulta.eventos?.length) {
        estadoConsulta.eventos = await peticion('/catalogos/tipo-evento');
    }
    const personas = await peticion('/personas');
    renderFormularioConsulta(personas, null, cita);
}

async function nuevaConsulta() {
    estadoConsulta.id = null;
    estadoConsulta.citaAtencionId = null;
    estadoConsulta.datos = {};
    estadoConsulta.municipiosResidencia = [];
    estadoConsulta.municipiosProcedencia = [];
    if (!estadoConsulta.eventos?.length) {
        estadoConsulta.eventos = await peticion('/catalogos/tipo-evento');
    }
    const personas = await peticion('/personas');
    renderFormularioConsulta(personas);
}

async function abrirConsulta(id) {
    const c = await peticion('/consultas/' + id);
    estadoConsulta.id = c.id;
    if (c.profesional_usuario_id && estadoConsulta.medicosConsultas.some(m => m.id === c.profesional_usuario_id)) {
        estadoConsulta.medicoConsultasId = c.profesional_usuario_id;
    }
    const fichas = await peticion('/ficha-datos-basicos?consulta_id=' + id);
    estadoConsulta.datos = fichas[0] || {};
    if (estadoConsulta.datos.residencia_departamento) {
        estadoConsulta.municipiosResidencia = await peticion('/catalogos/municipios?departamento=' + estadoConsulta.datos.residencia_departamento);
    }
    if (estadoConsulta.datos.procedencia_departamento) {
        estadoConsulta.municipiosProcedencia = await peticion('/catalogos/municipios?departamento=' + estadoConsulta.datos.procedencia_departamento);
    }
    if (!estadoConsulta.eventos?.length) {
        estadoConsulta.eventos = await peticion('/catalogos/tipo-evento');
    }
    const personas = await peticion('/personas');
    renderFormularioConsulta(personas, c);
}

function renderFormularioConsulta(personas, consultaExistente = null, citaOrigen = null) {
    const panel = document.getElementById('panel-consulta-form');
    if (!panel) return;
    estadoConsulta.personasList = personas || [];
    const d = estadoConsulta.datos;
    const hoy = formatearFechaLocal(new Date());
    const fechaNotificacion = d.fecha_notificacion || hoy;
    const fechaConsultaVal = consultaExistente?.fecha_consulta || d.fecha_consulta || hoy;
    const pacienteId = consultaExistente?.paciente_persona_id || citaOrigen?.paciente_persona_id || '';
    const citaId = consultaExistente?.cita_id || citaOrigen?.id || estadoConsulta.citaAtencionId || '';
    const sintomasSel = (consultaExistente?.sintomas || []).map(s => s.id);
    const pSel = (personas || []).find(p => String(p.id_persona) === String(pacienteId));
    const nombrePaciente = pSel
        ? [pSel.primer_nombre, pSel.segundo_nombre, pSel.primer_apellido, pSel.segundo_apellido].filter(Boolean).join(' ')
        : (consultaExistente?.paciente_nombre || '');
    const avisoCita = citaOrigen
        ? `<p class="msg-info consulta-desde-cita">Atendiendo cita del ${escHtml(citaOrigen.fecha)} ${escHtml(formatearHoraCita(citaOrigen.hora))}</p>`
        : '';
    const esSP = Boolean(consultaExistente?.evento_salud_publica);

    panel.innerHTML = `
        ${avisoCita}
        <div class="tabs-consulta">
            <button type="button" class="tab-consulta activo" data-tab="consulta">Consulta</button>
            <button type="button" class="tab-consulta" id="tab-boton-ficha" data-tab="datos-basicos" ${esSP ? '' : 'disabled'}>Datos básicos</button>
            <button type="button" class="tab-consulta" id="tab-boton-detalles" data-tab="detalles" disabled>Detalles del evento</button>
            <button type="button" class="tab-consulta" data-tab="historia">Historia clínica</button>
        </div>
        <form id="form-consulta" onsubmit="return guardarConsulta(event)">
            <input type="hidden" id="consulta-id" value="${estadoConsulta.id || ''}">
            <input type="hidden" id="consulta-cita-id" value="${citaId || ''}">
            <div id="tab-consulta" class="tab-panel-consulta">
                <div class="form-grupo form-grupo-ancho-completo">
                    <label><input type="checkbox" id="qc-evento-salud" ${esSP ? 'checked' : ''} onchange="toggleFichaDatosBasicos()"> Evento de salud pública</label>
                    <p class="texto-ayuda">Al marcarlo se habilita la pestaña "Datos básicos" (ficha SIVIGILA).</p>
                </div>
                <h3>Datos de la persona (solo lectura)</h3>
                <div class="form-grupo form-grupo-ancho-completo"><label>Paciente</label>
                    <input type="text" class="input-readonly" id="qc-paciente-nombre" readonly value="${escHtml(nombrePaciente)}"
                        placeholder="El paciente se fija desde la cita que se atiende">
                    <input type="hidden" id="consulta-paciente" value="${pacienteId || ''}">
                </div>
                <div class="form-fila form-fila-3">
                    <div class="form-grupo"><label>Tipo documento</label>
                        <input type="text" class="input-readonly" id="qc-tipo-documento" readonly></div>
                    <div class="form-grupo"><label>Número</label>
                        <input type="text" class="input-readonly" id="qc-numero-documento" readonly></div>
                    <div class="form-grupo"><label>Teléfono</label>
                        <input type="text" class="input-readonly" id="qc-telefono" readonly></div>
                </div>
                <div class="form-fila form-fila-3">
                    <div class="form-grupo"><label>Fecha nacimiento</label>
                        <input type="text" class="input-readonly" id="qc-fecha-nacimiento" readonly></div>
                    <div class="form-grupo"><label>Edad</label>
                        <input type="text" class="input-readonly" id="qc-edad" readonly></div>
                    <div class="form-grupo"><label>Nacionalidad</label>
                        <input type="text" class="input-readonly" id="qc-nacionalidad" readonly></div>
                </div>
                <div class="form-fila form-fila-2">
                    <div class="form-grupo"><label>Depto. residencia</label>
                        <input type="text" class="input-readonly" id="qc-res-depto" readonly value="${escHtml(nombreResDepto(d.residencia_departamento))}"></div>
                    <div class="form-grupo"><label>Municipio residencia</label>
                        <input type="text" class="input-readonly" id="qc-res-muni" readonly value="${escHtml(nombreResMuni(d.residencia_municipio))}"></div>
                </div>
                <div class="form-fila form-fila-2">
                    <div class="form-grupo"><label>Depto. ocurrencia (IPS)</label>
                        <input type="text" class="input-readonly" id="qc-ocur-depto" readonly value="${escHtml(nombreResDepto(d.procedencia_departamento))}"></div>
                    <div class="form-grupo"><label>Municipio ocurrencia (IPS)</label>
                        <input type="text" class="input-readonly" id="qc-ocur-muni" readonly value="${escHtml(nombreResMuni(d.procedencia_municipio, 'procedencia'))}"></div>
                </div>
                <div class="form-grupo"><label>Área</label>
                    <input type="text" class="input-readonly" id="qc-area" readonly></div>
                <div class="form-grupo"><label>Dirección residencia</label>
                    <input type="text" class="input-readonly" id="qc-direccion" readonly></div>

                <h3>Preguntas de la consulta</h3>
                <div class="form-fila form-fila-2">
                    <div class="form-grupo"><label>Fecha de consulta</label>
                        <input type="date" id="qc-fecha-consulta" value="${escHtml(consultaExistente?.fecha_consulta || d.fecha_consulta || hoy)}"></div>
                </div>
                <div class="form-fila form-fila-3">
                    <div class="form-grupo"><label>Altura (cm)</label>
                        <input type="number" id="qc-altura" min="0" step="0.01" value="${consultaExistente?.altura_cm ?? ''}"></div>
                    <div class="form-grupo"><label>Peso (kg)</label>
                        <input type="number" id="qc-peso" min="0" step="0.01" value="${consultaExistente?.peso_kg ?? ''}"></div>
                    <div class="form-grupo"><label>Temperatura (°C)</label>
                        <input type="number" id="qc-temperatura" min="0" step="0.1" value="${consultaExistente?.temperatura_c ?? ''}"></div>
                </div>
                <div class="form-fila form-fila-3">
                    <div class="form-grupo"><label>Frecuencia cardíaca</label>
                        <input type="number" id="qc-frecuencia" min="0" value="${consultaExistente?.frecuencia_cardiaca ?? ''}"></div>
                    <div class="form-grupo"><label>TA sistólica</label>
                        <input type="number" id="qc-ta-sistolica" min="0" value="${consultaExistente?.ta_sistolica ?? ''}"></div>
                    <div class="form-grupo"><label>TA diastólica</label>
                        <input type="number" id="qc-ta-diastolica" min="0" value="${consultaExistente?.ta_diastolica ?? ''}"></div>
                </div>
                <div class="form-fila form-fila-2">
                    <div class="form-grupo"><label>Saturación O₂ (%)</label>
                        <input type="number" id="qc-saturacion" min="0" max="100" value="${consultaExistente?.saturacion_o2 ?? ''}"></div>
                </div>
                <div class="form-grupo"><label>Síntomas (catálogo)</label>
                    <div class="checkbox-grid">
                        ${(window._catalogoSintomas || []).map(s => `
                            <label><input type="checkbox" name="sintoma" value="${s.id}" ${sintomasSel.includes(s.id) ? 'checked' : ''}> ${escHtml(s.nombre)}</label>
                        `).join('')}
                    </div>
                </div>
                <div class="form-grupo form-grupo-ancho-completo"><label>Resumen de consulta</label>
                    <textarea id="qc-resumen" rows="6" placeholder=" Hallazgos, evolución, impresión diagnóstica...">${escHtml(consultaExistente?.resumen_consulta || '')}</textarea></div>
            </div>
            <div id="tab-datos-basicos" class="tab-panel-consulta oculto">
                <h3>1. Información general</h3>
                <div class="form-grupo form-grupo-ancho-completo">
                    <label>Evento (catálogo SIVIGILA — TipoEvento)</label>
                    <input type="search" class="filtro-evento" id="db-evento-filtro" placeholder="Filtrar por código o nombre (ej. 210, dengue)..." oninput="filtrarSelectEventos()">
                    <select id="db-evento-select" class="select-evento-sivigila" size="7" onchange="seleccionarEventoConsulta()"></select>
                    <input type="hidden" id="db-codigo-evento" value="${escHtml(consultaExistente?.codigo_evento || '')}">
                    <input type="hidden" id="db-nombre-evento" value="${escHtml(consultaExistente?.nombre_evento || '')}">
                    <p class="texto-ayuda" id="db-evento-resumen">${escHtml(
                        consultaExistente?.codigo_evento
                            ? `${consultaExistente.codigo_evento} — ${consultaExistente.nombre_evento || ''}`
                            : 'Seleccione un evento de la lista'
                    )}</p>
                </div>
                <div class="form-fila form-fila-2">
                    <div class="form-grupo"><label>Fecha notificación</label>
                        <input type="date" id="db-fecha-notificacion" value="${fechaNotificacion}"></div>
                    <div class="form-grupo"><label>UPGD / Razón social (IPS)</label>
                        <input type="text" id="db-razon-social-upgd" class="input-readonly" readonly
                            value="${escHtml(razonSocialUpgdConsulta(d, consultaExistente))}"
                            title="Nombre de la IPS en sesión">
                        <p class="texto-ayuda">IPS del médico seleccionado arriba (UPGD que notifica).</p></div>
                </div>
                <h3>2. Identificación del paciente</h3>
                <p class="texto-ayuda">El paciente se selecciona en la pestaña Consulta; aquí solo se completan los campos de la ficha.</p>
                <div class="form-fila form-fila-3">
                    <div class="form-grupo"><label>Tipo documento</label>
                        <select id="db-tipo-documento">${optionsLista('tipo_documento_sivigila', d.tipo_documento)}</select></div>
                    <div class="form-grupo"><label>Número</label>
                        <input type="text" id="db-numero-documento" value="${escHtml(d.numero_documento || '')}"></div>
                    <div class="form-grupo"><label>Teléfono</label>
                        <input type="text" id="db-telefono" value="${escHtml(d.telefono || '')}"></div>
                </div>
                <div class="form-fila form-fila-2">
                    <div class="form-grupo"><label>Fecha nacimiento</label>
                        <input type="date" id="db-fecha-nacimiento" value="${d.fecha_nacimiento || ''}"></div>
                    <div class="form-grupo"><label>Edad</label>
                        <input type="number" id="db-edad" min="0" class="input-readonly" readonly
                            value="${d.edad ?? ''}" title="Se calcula desde la fecha de nacimiento">
                        <p class="texto-ayuda">Calculada al elegir paciente o cambiar fecha de nacimiento/consulta.</p></div>
                </div>
                <div class="form-fila form-fila-3">
                    <div class="form-grupo"><label>Unidad edad</label>
                        <select id="db-unidad-edad">${optionsLista('unidad_medida_edad', d.unidad_medida_edad)}</select></div>
                    <div class="form-grupo"><label>Sexo</label>
                        <select id="db-sexo">${optionsLista('sexo_sivigila', d.sexo)}</select></div>
                    <div class="form-grupo"><label>Nacionalidad</label>
                        <input type="text" id="db-nacionalidad" value="${escHtml(d.nacionalidad || 'Colombia')}"></div>
                </div>
                <h3>Procedencia / ocurrencia</h3>
                <p class="texto-ayuda">Departamento y municipio de ocurrencia: se sugieren desde la IPS del médico (editable).</p>
                <div class="form-fila form-fila-2">
                    <div class="form-grupo"><label>Departamento</label>
                        <select id="db-proc-depto" onchange="cambiarDeptoConsulta('procedencia')">
                            <option value="">--</option>
                            ${estadoConsulta.departamentos.map(dep => `
                                <option value="${dep.codigo_departamento}" ${dep.codigo_departamento === d.procedencia_departamento ? 'selected' : ''}>${escHtml(dep.nombre_departamento)}</option>
                            `).join('')}
                        </select></div>
                    <div class="form-grupo"><label>Municipio</label>
                        <select id="db-proc-muni">
                            <option value="">--</option>
                            ${estadoConsulta.municipiosProcedencia.map(m => `
                                <option value="${m.codigo_municipio}" ${m.codigo_municipio === d.procedencia_municipio ? 'selected' : ''}>${escHtml(m.nombre_municipio)}</option>
                            `).join('')}
                        </select></div>
                </div>
                <div class="form-grupo"><label>Área</label>
                    <select id="db-area">${optionsLista('area_procedencia', d.area_procedencia)}</select></div>
                <h3>3. Notificación clínica</h3>
                <div class="form-fila form-fila-2">
                    <div class="form-grupo"><label>Fecha consulta</label>
                        <input type="date" id="db-fecha-consulta" value="${fechaConsultaVal}"></div>
                    <div class="form-grupo"><label>Inicio síntomas</label>
                        <input type="date" id="db-fecha-sintomas" value="${d.fecha_inicio_sintomas || ''}"></div>
                </div>
                <div class="form-grupo"><label>Síntomas (catálogo)</label>
                    <div class="checkbox-grid">
                        ${(window._catalogoSintomas || []).map(s => `
                            <label><input type="checkbox" name="sintoma" value="${s.id}" ${sintomasSel.includes(s.id) ? 'checked' : ''}> ${escHtml(s.nombre)}</label>
                        `).join('')}
                    </div>
                </div>
                <div class="form-fila form-fila-3">
                    <div class="form-grupo"><label>Condición final</label>
                        <select id="db-condicion">${optionsLista('condicion_final', d.condicion_final)}</select></div>
                    <div class="form-grupo"><label>Grupos poblacionales</label>
                        <select id="db-grupos">${optionsLista('grupos_poblacionales', d.grupos_poblacional)}</select></div>
                </div>
                <div class="form-fila form-fila-2">
                    <div class="form-grupo"><label>Clasificación inicial</label>
                        <select id="db-clasificacion">${optionsLista('clasificacion_inicial_caso', d.clasificacion_inicial)}</select></div>
                    <div class="form-grupo"><label>Fuente</label>
                        <select id="db-fuente">${optionsLista('fuente_notificacion', d.fuente_notificacion)}</select></div>
                </div>
                <div class="form-fila form-fila-3">
                    <div class="form-grupo"><label>Etnia</label>
                        <select id="db-pertenencia">${optionsLista('pertenencia_etnica', d.pertenencia_etnica)}</select></div>
                    <div class="form-grupo"><label>Identidad de género</label>
                        <select id="db-genero">${optionsLista('identidad_genero', d.identidad_genero)}</select></div>
                </div>
                <div class="form-fila form-fila-2">
                    <div class="form-grupo"><label>Orientación sexual</label>
                        <select id="db-orientacion">${optionsLista('orientacion_sexual', d.orientacion_sexual)}</select></div>
                    <div class="form-grupo"><label>Estado notificación</label>
                        <select id="db-estado-not">
                            <option value="borrador" ${(d.estado_notificacion || 'borrador') === 'borrador' ? 'selected' : ''}>Borrador</option>
                            <option value="notificado" ${d.estado_notificacion === 'notificado' ? 'selected' : ''}>Notificado</option>
                        </select></div>
                </div>
                <h3>Residencia</h3>
                <div class="form-fila form-fila-2">
                    <div class="form-grupo"><label>Depto residencia</label>
                        <select id="db-res-depto" onchange="cambiarDeptoConsulta('residencia')">
                            <option value="">--</option>
                            ${estadoConsulta.departamentos.map(dep => `
                                <option value="${dep.codigo_departamento}" ${dep.codigo_departamento === d.residencia_departamento ? 'selected' : ''}>${escHtml(dep.nombre_departamento)}</option>
                            `).join('')}
                        </select></div>
                    <div class="form-grupo"><label>Municipio residencia</label>
                        <select id="db-res-muni">
                            <option value="">--</option>
                            ${estadoConsulta.municipiosResidencia.map(m => `
                                <option value="${m.codigo_municipio}" ${m.codigo_municipio === d.residencia_municipio ? 'selected' : ''}>${escHtml(m.nombre_municipio)}</option>
                            `).join('')}
                        </select></div>
                </div>
                <div class="form-grupo"><label>Dirección residencia</label>
                    <input type="text" id="db-direccion-residencia" value="${escHtml(d.direccion_residencia || '')}"></div>
                <div class="form-grupo"><label>Régimen</label>
                    <select id="db-regimen">${optionsLista('regimen_salud', d.regimen_salud)}</select></div>
            </div>
            <div id="tab-detalles" class="tab-panel-consulta oculto">
                <div id="grid-detalles"></div>
            </div>
            <div id="tab-historia" class="tab-panel-consulta oculto">
                <h3>Historia clínica</h3>
                <p class="texto-ayuda">Resúmenes de todas las consultas del paciente (solo lectura).</p>
                <div id="grid-historia" class="tabla-contenedor"></div>
            </div>
            ${tienePermiso('consultas.editar') || tienePermiso('consultas.crear') ? `
                <div style="margin-top:1rem;display:flex;gap:0.5rem">
                    <button type="submit" class="btn btn-primario">Guardar consulta</button>
                    <select id="consulta-estado">
                        <option value="borrador" ${consultaExistente?.estado === 'borrador' ? 'selected' : ''}>Borrador</option>
                        <option value="completa" ${consultaExistente?.estado === 'completa' ? 'selected' : ''}>Completa</option>
                    </select>
                </div>` : ''}
        </form>
    `;

    panel.querySelectorAll('.tab-consulta').forEach(tab => {
        tab.addEventListener('click', () => {
            panel.querySelectorAll('.tab-consulta').forEach(t => t.classList.remove('activo'));
            tab.classList.add('activo');
            panel.querySelectorAll('.tab-panel-consulta').forEach(p => p.classList.add('oculto'));
            document.getElementById('tab-' + tab.dataset.tab)?.classList.remove('oculto');
        });
    });

    poblarSelectEventos(consultaExistente?.codigo_evento || null);
    enlazarPacienteConsultaForm();
    actualizarCampoUpgdConsulta(consultaExistente);
    actualizarProcedenciaOcurrenciaConsulta(consultaExistente, true);
    if (document.getElementById('db-fecha-nacimiento')?.value) recalcularEdadConsulta();
    toggleFichaDatosBasicos();
    espejarFichaDesdeConsulta();
    if (pacienteId) pintarGrillaHistoria(pacienteId);
}

function filtrarSelectEventos() {
    poblarSelectEventos(document.getElementById('db-codigo-evento')?.value || null);
}

function poblarSelectEventos(codigoSeleccionado) {
    const sel = document.getElementById('db-evento-select');
    if (!sel) return;
    const filtro = (document.getElementById('db-evento-filtro')?.value || '').trim().toLowerCase();
    const eventos = estadoConsulta.eventos || [];
    const items = eventos.filter(e => {
        if (!filtro) return true;
        return e.codigo.toLowerCase().includes(filtro) || String(e.nombre).toLowerCase().includes(filtro);
    });
    sel.innerHTML = items.map(e => {
        const label = `${e.codigo} — ${e.nombre}`;
        return `<option value="${escHtml(e.codigo)}" ${e.codigo === codigoSeleccionado ? 'selected' : ''}>${escHtml(label)}</option>`;
    }).join('') || '<option value="">— Sin coincidencias —</option>';
    if (codigoSeleccionado && items.some(e => e.codigo === codigoSeleccionado)) {
        sel.value = codigoSeleccionado;
        seleccionarEventoConsulta();
    }
}

function seleccionarEventoConsulta() {
    const sel = document.getElementById('db-evento-select');
    const cod = sel?.value;
    const ev = (estadoConsulta.eventos || []).find(e => e.codigo === cod);
    const inpCod = document.getElementById('db-codigo-evento');
    const inpNom = document.getElementById('db-nombre-evento');
    const resumen = document.getElementById('db-evento-resumen');
    if (inpCod) inpCod.value = ev?.codigo || '';
    if (inpNom) inpNom.value = ev?.nombre || '';
    if (resumen) {
        resumen.textContent = ev ? `${ev.codigo} — ${ev.nombre}` : 'Seleccione un evento de la lista';
    }
    cargarDetallesEvento(cod);
}

// ── Detalles dinámicos por evento (pestaña "Detalles del evento") ─────────
const estadoDetalles = { evento: null, defs: [], valores: {}, sucios: new Set() };

async function cargarDetallesEvento(codigo) {
    const cont = document.getElementById('grid-detalles');
    const boton = document.getElementById('tab-boton-detalles');
    estadoDetalles.evento = codigo || null;
    estadoDetalles.defs = [];
    estadoDetalles.valores = {};
    estadoDetalles.sucios = new Set();
    if (!cont) return;
    if (!codigo) {
        if (boton) boton.disabled = true;
        cont.innerHTML = '<p class="texto-ayuda">Seleccione un evento en la pestaña "Datos básicos" para ver las preguntas de detalle de ese evento.</p>';
        return;
    }
    try {
        const defs = await peticion('/detalles-eventos/def/' + encodeURIComponent(codigo));
        estadoDetalles.defs = Array.isArray(defs) ? defs : [];
        const cid = estadoConsulta.id || parseInt(document.getElementById('consulta-id')?.value, 10);
        if (Number.isFinite(cid)) {
            const resp = await peticion('/detalles-eventos/respuestas?consulta_id=' + cid);
            estadoDetalles.valores = (resp && typeof resp === 'object') ? resp : {};
        }
        if (boton) boton.disabled = estadoDetalles.defs.length === 0;
        pintarTabDetalles();
    } catch (ex) {
        cont.innerHTML = `<p class="msg-error visible">${escHtml(ex.message)}</p>`;
    }
}

function mostrarDefDetalle(d) {
    if (!d.show_if) return true;
    const padre = estadoDetalles.defs.find(x => x.ref === d.padre_ref);
    if (!padre) return true;
    const cur = estadoDetalles.valores[padre.ref];
    // Padre multiselect (ej. hallazgos de Dengue): la regla se cumple si contiene el valor.
    if (Array.isArray(cur)) return cur.map(String).includes(String(d.show_if));
    return String(cur ?? '') === String(d.show_if);
}

function pintarTabDetalles() {
    const cont = document.getElementById('grid-detalles');
    if (!cont) return;
    const defs = estadoDetalles.defs;
    if (!defs.length) {
        cont.innerHTML = `<p class="texto-ayuda">El evento ${escHtml(estadoDetalles.evento || '')} no tiene preguntas de detalle definidas.</p>`;
        return;
    }
    const editable = tienePermiso('consultas.editar') || tienePermiso('consultas.crear');
    estadoDetalles.sucios = new Set();
    const secciones = {};
    const orden = [];
    for (const d of defs) {
        const key = d.subs ? `${d.seccion}-${d.subs}` : d.seccion;
        if (!secciones[key]) { secciones[key] = { label: d.seccion_label || `Sección ${d.seccion}`, items: [] }; orden.push(key); }
        secciones[key].items.push(d);
    }
    let html = '';
    for (const key of orden) {
        const sec = secciones[key];
        html += `<div class="ficha-seccion"><h4 class="ficha-seccion-titulo">${escHtml(sec.label)}</h4>`;
        for (const d of sec.items) {
            const oculto = mostrarDefDetalle(d) ? '' : ' oculto';
            html += `<div class="ficha-pregunta${d.show_if ? ' ficha-sub' : ''}${oculto}" data-ref="${d.ref}">
                <div class="ficha-pregunta-cab">
                    <span class="ficha-num">${escHtml(d.numero || '')}</span>
                    <span class="ficha-label">${escHtml(d.label || d.ref)}${d.obligatorio ? ' <em class="ficha-oblig">*</em>' : ''}</span>
                </div>`;
            const cur = estadoDetalles.valores[d.ref];
            if (d.tipo === 'select' || d.tipo === 'multiselect') {
                const multi = d.tipo === 'multiselect';
                const tipoInput = multi ? 'checkbox' : 'radio';
                html += `<div class="opciones-ficha ${multi ? 'opciones-cuadrados' : 'opciones-circulos'}">`;
                for (const op of (d.opciones || [])) {
                    const checked = multi ? (Array.isArray(cur) && cur.includes(op.value)) : String(cur ?? '') === op.value;
                    html += `<label class="opcion-ficha"><input type="${tipoInput}" name="${d.ref}" data-ref="${d.ref}" ${multi ? 'data-multi="1" ' : ''}value="${escHtml(op.value)}" ${checked ? 'checked ' : ''}${editable ? '' : 'disabled '}>${escHtml(op.label)}</label>`;
                }
                html += '</div>';
            } else if (d.tipo === 'number_unit') {
                const arr = Array.isArray(cur) ? cur : [cur ?? '', ''];
                html += `<div class="fila-unit">
                    <input type="number" min="0" data-ref="${d.ref}" data-kind="unit-num" value="${escHtml(arr[0] ?? '')}" ${editable ? '' : 'disabled'}>
                    <div class="opciones-ficha opciones-circulos">`;
                for (const op of (d.opciones || [])) {
                    html += `<label class="opcion-ficha"><input type="radio" name="${d.ref}_unidad" data-ref="${d.ref}" data-kind="unit" value="${escHtml(op.value)}" ${(Array.isArray(cur) && cur[1] === op.value) ? 'checked ' : ''}${editable ? '' : 'disabled '}>${escHtml(op.label)}</label>`;
                }
                html += '</div></div>';
            } else if (d.tipo === 'number_hrs_min') {
                const arr = Array.isArray(cur) ? cur : [cur ?? '', ''];
                html += `<div class="fila-unit">
                    <input type="number" min="0" data-ref="${d.ref}" data-kind="hrs" placeholder="horas" value="${escHtml(arr[0] ?? '')}" ${editable ? '' : 'disabled'}>
                    <input type="number" min="0" max="59" data-ref="${d.ref}" data-kind="min" placeholder="min" value="${escHtml(arr[1] ?? '')}" ${editable ? '' : 'disabled'}>
                </div>`;
            } else if (d.tipo === 'date') {
                html += `<input type="date" data-ref="${d.ref}" value="${escHtml(cur ?? '')}" ${editable ? '' : 'disabled'}>`;
            } else if (d.tipo === 'number') {
                html += `<input type="number" min="0" step="0.01" data-ref="${d.ref}" value="${escHtml(cur ?? '')}" ${editable ? '' : 'disabled'}>`;
            } else {
                html += `<input type="text" data-ref="${d.ref}" value="${escHtml(cur ?? '')}" ${editable ? '' : 'disabled'}>`;
            }
            html += '</div>';
        }
        html += '</div>';
    }
    cont.innerHTML = html;
    enlazarDetallesInputs(cont);
}

function enlazarDetallesInputs(cont) {
    cont.querySelectorAll('input[data-ref]').forEach(inp => {
        inp.addEventListener('change', () => {
            const ref = inp.dataset.ref;
            estadoDetalles.sucios.add(ref);
            if (inp.dataset.multi) {
                estadoDetalles.valores[ref] = [...cont.querySelectorAll(`input[data-ref="${ref}"]:checked`)].map(el => el.value);
            } else if (inp.dataset.kind === 'unit') {
                const numInput = cont.querySelector(`input[data-ref="${ref}"][data-kind="unit-num"]`);
                estadoDetalles.valores[ref] = [numInput?.value ?? '', inp.value];
            } else if (inp.dataset.kind === 'unit-num') {
                const cur = estadoDetalles.valores[ref];
                estadoDetalles.valores[ref] = [inp.value, Array.isArray(cur) ? cur[1] : ''];
            } else if (inp.dataset.kind === 'hrs' || inp.dataset.kind === 'min') {
                const hrsEl = cont.querySelector(`input[data-ref="${ref}"][data-kind="hrs"]`);
                const minEl = cont.querySelector(`input[data-ref="${ref}"][data-kind="min"]`);
                estadoDetalles.valores[ref] = [hrsEl?.value ?? '', minEl?.value ?? ''];
            } else {
                estadoDetalles.valores[ref] = inp.value;
            }
            cont.querySelectorAll('.ficha-pregunta[data-ref]').forEach(el => {
                const d = estadoDetalles.defs.find(x => x.ref === el.dataset.ref);
                if (d) el.classList.toggle('oculto', !mostrarDefDetalle(d));
            });
        });
    });
}

async function guardarDetalles() {
    const cid = estadoConsulta.id;
    if (!Number.isFinite(cid) || !estadoDetalles.defs.length) return;
    const valores = {};
    for (const d of estadoDetalles.defs) {
        if (!mostrarDefDetalle(d) || !estadoDetalles.sucios.has(d.ref)) continue;
        const v = estadoDetalles.valores[d.ref];
        const vacio = v == null || v === '' || (Array.isArray(v) && !v.filter(x => x !== '').length);
        valores[d.ref] = vacio ? null : v;
    }
    if (!Object.keys(valores).length) return;
    await peticion('/detalles-eventos/respuestas', { method: 'POST', body: JSON.stringify({ consulta_id: cid, valores }) });
}

/** Pares espejo (7): bloque de lectura de la consulta (qc-*) ↔ ficha editable (db-*). La edad se sincroniza aparte (recalcularEdadConsulta). */
const ESPEJO_FICHA_CONSULTA = [
    ['qc-tipo-documento', 'db-tipo-documento'],
    ['qc-numero-documento', 'db-numero-documento'],
    ['qc-telefono', 'db-telefono'],
    ['qc-fecha-nacimiento', 'db-fecha-nacimiento'],
    ['qc-nacionalidad', 'db-nacionalidad'],
    ['qc-area', 'db-area'],
    ['qc-direccion', 'db-direccion-residencia'],
];

/** Pares que muestran el NOMBRE (label) del catálogo, no el código: residence + ocurrencia (IPS) */
const ESPEJO_LABEL_CONSULTA = [
    ['qc-res-depto', 'db-res-depto'],
    ['qc-res-muni', 'db-res-muni'],
    ['qc-ocur-depto', 'db-proc-depto'],
    ['qc-ocur-muni', 'db-proc-muni'],
];

function nombreResDepto(codigo) {
    return (estadoConsulta.departamentos || []).find(x => x.codigo_departamento === codigo)?.nombre_departamento || '';
}

function nombreResMuni(codigo, tipo) {
    const lista = tipo === 'procedencia' ? (estadoConsulta.municipiosProcedencia || []) : (estadoConsulta.municipiosResidencia || []);
    return lista.find(x => x.codigo_municipio === codigo)?.nombre_municipio || '';
}

function espejarFichaDesdeConsulta() {
    for (const [qcId, dbId] of ESPEJO_FICHA_CONSULTA) {
        const qc = document.getElementById(qcId);
        const db = document.getElementById(dbId);
        if (!qc || !db) continue;
        if (!db.dataset.espejoEnlazado) {
            db.dataset.espejoEnlazado = '1';
            db.addEventListener('change', () => { qc.value = db.value; });
        }
        const valor = db.value || qc.value;
        if (valor) { qc.value = valor; db.value = valor; }
    }
    for (const [qcId, dbId] of ESPEJO_LABEL_CONSULTA) {
        const qc = document.getElementById(qcId);
        const db = document.getElementById(dbId);
        if (!qc || !db) continue;
        const refrescar = () => {
            const name = dbId === 'db-res-depto' || dbId === 'db-proc-depto'
                ? nombreResDepto(db.value)
                : nombreResMuni(db.value, dbId === 'db-proc-muni' ? 'procedencia' : 'residencia');
            if (name) qc.value = name;
        };
        if (!db.dataset.labelEspejoEnlazado) {
            db.dataset.labelEspejoEnlazado = '1';
            db.addEventListener('change', refrescar);
        }
        refrescar();
    }
}

function toggleFichaDatosBasicos() {
    const activo = document.getElementById('qc-evento-salud')?.checked;
    const boton = document.getElementById('tab-boton-ficha');
    if (!boton) return;
    boton.disabled = !activo;
    if (!activo && boton.classList.contains('activo')) {
        document.querySelector('#panel-consulta-form .tab-consulta[data-tab="consulta"]')?.click();
    }
    espejarFichaDesdeConsulta();
}

async function pintarGrillaHistoria(pacienteId) {
    const cont = document.getElementById('grid-historia');
    if (!cont || !pacienteId) return;
    try {
        const filas = await peticion('/consultas/historia-grid?paciente_persona_id=' + encodeURIComponent(pacienteId));
        if (!filas.length) {
            cont.innerHTML = '<p class="texto-ayuda">Sin consultas registradas para este paciente.</p>';
            return;
        }
        cont.innerHTML = `
            <table>
                <thead><tr><th>Fecha</th><th>Profesional</th><th>Evento</th><th>Síntomas</th><th>Resumen</th><th>Estado</th></tr></thead>
                <tbody>
                    ${filas.map(f => `
                        <tr>
                            <td>${escHtml(f.fecha || '')}</td>
                            <td>${escHtml(f.profesional_nombre || '—')}</td>
                            <td>${escHtml([f.codigo_evento, f.nombre_evento].filter(Boolean).join(' — ') || '—')}</td>
                            <td>${escHtml(f.sintomas || '—')}</td>
                            <td>${escHtml(f.resumen_consulta || '—')}</td>
                            <td>${escHtml(f.estado || '')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
    } catch (ex) {
        cont.innerHTML = `<p class="texto-ayuda">Error al cargar historia: ${escHtml(ex.message)}</p>`;
    }
}

async function cambiarDeptoConsulta(tipo) {
    const sel = document.getElementById(tipo === 'residencia' ? 'db-res-depto' : 'db-proc-depto');
    const cod = sel?.value;
    if (!cod) return;
    const munis = await peticion('/catalogos/municipios?departamento=' + cod);
    if (tipo === 'residencia') {
        estadoConsulta.municipiosResidencia = munis;
        const mSel = document.getElementById('db-res-muni');
        mSel.innerHTML = '<option value="">--</option>' + munis.map(m =>
            `<option value="${m.codigo_municipio}">${escHtml(m.nombre_municipio)}</option>`).join('');
    } else {
        estadoConsulta.municipiosProcedencia = munis;
        const mSel = document.getElementById('db-proc-muni');
        mSel.innerHTML = '<option value="">--</option>' + munis.map(m =>
            `<option value="${m.codigo_municipio}">${escHtml(m.nombre_municipio)}</option>`).join('');
    }
    espejarFichaDesdeConsulta();
}

function recogerFichaForm() {
    const val = id => document.getElementById(id)?.value || null;
    return {
        codigo_evento: val('db-codigo-evento'),
        nombre_evento: val('db-nombre-evento'),
        fecha_notificacion: val('db-fecha-notificacion'),
        razon_social_upgd: val('db-razon-social-upgd'),
        tipo_documento: val('db-tipo-documento'),
        numero_documento: val('db-numero-documento'),
        telefono: val('db-telefono'),
        fecha_nacimiento: val('db-fecha-nacimiento'),
        edad: val('db-edad') ? parseInt(val('db-edad'), 10) : null,
        unidad_medida_edad: val('db-unidad-edad'),
        sexo: val('db-sexo'),
        nacionalidad: val('db-nacionalidad'),
        procedencia_departamento: val('db-proc-depto'),
        procedencia_municipio: val('db-proc-muni'),
        area_procedencia: val('db-area'),
        fecha_inicio_sintomas: val('db-fecha-sintomas'),
        clasificacion_inicial: val('db-clasificacion'),
        fuente_notificacion: val('db-fuente'),
        condicion_final: val('db-condicion'),
        pertenencia_etnica: val('db-pertenencia'),
        identidad_genero: val('db-genero'),
        orientacion_sexual: val('db-orientacion'),
        grupos_poblacional: val('db-grupos'),
        regimen_salud: val('db-regimen'),
        residencia_departamento: val('db-res-depto'),
        residencia_municipio: val('db-res-muni'),
        direccion_residencia: val('db-direccion-residencia'),
        estado_notificacion: val('db-estado-not')
    };
}

async function guardarFichaDatosBasicos() {
    if (!estadoConsulta.id) { alert('Guarda primero la consulta antes de la ficha de datos básicos.'); return; }
    const body = { consulta_id: estadoConsulta.id, ...recogerFichaForm() };
    await peticion('/ficha-datos-basicos', { method: 'POST', body: JSON.stringify(body) });
}

async function guardarConsulta(e) {
    e.preventDefault();
    const id = document.getElementById('consulta-id')?.value;
    // Los síntomas se renderizan en dos paneles (consulta y ficha): dedup para no insertar el mismo id dos veces
    const sintoma_ids = [...new Set([...document.querySelectorAll('#form-consulta input[name="sintoma"]:checked')].map(el => parseInt(el.value, 10)))];
    const citaIdEl = document.getElementById('consulta-cita-id')?.value;
    const pacienteIdRaw = document.getElementById('consulta-paciente')?.value;
    if (!pacienteIdRaw) { alert('Falta el paciente: atienda una cita programada para fijarlo.'); return false; }
    const body = {
        paciente_persona_id: parseInt(pacienteIdRaw, 10),
        codigo_evento: document.getElementById('db-codigo-evento').value || null,
        nombre_evento: document.getElementById('db-nombre-evento').value || null,
        evento_salud_publica: document.getElementById('qc-evento-salud')?.checked ? 1 : 0,
        fecha_consulta: document.getElementById('qc-fecha-consulta')?.value || null,
        resumen_consulta: document.getElementById('qc-resumen')?.value || null,
        altura_cm: document.getElementById('qc-altura')?.value || null,
        peso_kg: document.getElementById('qc-peso')?.value || null,
        temperatura_c: document.getElementById('qc-temperatura')?.value || null,
        frecuencia_cardiaca: document.getElementById('qc-frecuencia')?.value || null,
        ta_sistolica: document.getElementById('qc-ta-sistolica')?.value || null,
        ta_diastolica: document.getElementById('qc-ta-diastolica')?.value || null,
        saturacion_o2: document.getElementById('qc-saturacion')?.value || null,
        sintoma_ids,
        estado: document.getElementById('consulta-estado')?.value || 'borrador'
    };
    if (citaIdEl) body.cita_id = parseInt(citaIdEl, 10);
    try {
        if (id) {
            await peticion('/consultas/' + id, { method: 'PUT', body: JSON.stringify(body) });
            estadoConsulta.id = parseInt(id, 10);
        } else {
            const c = await peticion('/consultas', { method: 'POST', body: JSON.stringify(body) });
            estadoConsulta.id = c.id;
        }
        if (document.getElementById('qc-evento-salud')?.checked) await guardarFichaDatosBasicos();
        await guardarDetalles();
        estadoConsulta.citaAtencionId = null;
        await cargarConsultas();
        if (estadoConsulta.id) await abrirConsulta(estadoConsulta.id);
        alert('Consulta guardada');
    } catch (ex) {
        alert(ex.message);
    }
    return false;
}

// ── Historia Clínica (matriz: consultas + resumen clínico) ────────────────────
const estadoHistorias = { filas: [], consultaActual: null, personaActual: null, personaData: null, consultas: [], filtro: '', fechaDesde: '', fechaHasta: '' };
const HISTORIA_ANCHO_KEY = 'dinamedical_historia_ancho';

function setHistoriaAncho(ancho) {
    localStorage.setItem(HISTORIA_ANCHO_KEY, ancho);
    const overlay = document.getElementById('modal-historia-clinica');
    if (overlay) overlay.setAttribute('data-ancho', ancho);
    document.querySelectorAll('#modal-historia-clinica .selector-ancho-modal input').forEach(r => { r.checked = r.value === ancho; });
}

async function cargarHistorias() {
    const cont = document.getElementById('contenido-historias');
    if (!cont || !tienePermiso('historias.ver')) return;
    try {
        const filas = await peticion('/historias/vista');
        estadoHistorias.filas = filas;
        pintarMatrizHistorias(cont);
    } catch (ex) {
        cont.innerHTML = `<p class="msg-error visible">${escHtml(ex.message)}</p>`;
    }
}

function filasHistoriasHtml() {
    const filtro = estadoHistorias.filtro.toLowerCase();
    return estadoHistorias.filas.filter(f => {
        if (!filtro) return true;
        const txt = [f.paciente_nombre, f.numero_documento, f.profesional_nombre, f.resumen_consulta, f.sintomas, f.fecha]
            .map(v => (v || '').toLowerCase()).join(' ');
        return txt.includes(filtro);
    }).map(f => `
        <tr class="fila-historia-clinica" onclick="verHistoriaClinica(${f.id_persona})">
            <td>${escHtml([f.tipo_documento_codigo, f.numero_documento].filter(Boolean).join(' ') || '—')}</td>
            <td>${escHtml(f.paciente_nombre || '—')}</td>
            <td>${escHtml(f.fecha_nacimiento || '—')}</td>
            <td>${escHtml([f.residencia_departamento, f.residencia_municipio].filter(Boolean).join(' / ') || '—')}</td>
            <td>${escHtml(f.fecha || '—')}</td>
            <td>${escHtml(f.sintomas || '—')}</td>
            <td>${escHtml(f.resumen_consulta || '—')}</td>
            <td>${escHtml(f.cantidad_consultas || 0)}</td>
            <td><button type="button" class="btn btn-secundario btn-sm" onclick="event.stopPropagation();verHistoriaClinica(${f.id_persona})">Ver</button></td>
        </tr>
    `).join('');
}

function pintarMatrizHistorias(cont) {
    const filasHtml = filasHistoriasHtml();
    const tbody = document.getElementById('historias-tbody');
    if (tbody) { tbody.innerHTML = filasHtml; return; }
    cont.innerHTML = `
        <div class="header-pagina">
            <h1>Historia Clínica</h1>
            <p>Un registro por paciente con su última consulta. Haz clic en la fila para ver el historial completo.</p>
        </div>
        <div class="tarjeta">
            <div style="display:flex;gap:0.5rem;margin-bottom:1rem">
                <input type="text" id="filtro-historias" placeholder="Buscar paciente, documento o resumen..."
                    value="${escHtml(estadoHistorias.filtro)}" style="flex:1;padding:0.5rem 0.75rem;border-radius:8px;border:1px solid var(--borde);background:var(--input-fondo);color:var(--texto)"
                    oninput="estadoHistorias.filtro=this.value;pintarMatrizHistorias(document.getElementById('contenido-historias'))">
                <button type="button" class="btn btn-secundario btn-sm" onclick="cargarHistorias()">Actualizar</button>
            </div>
            <div class="tabla-contenedor">
                <table>
                    <thead><tr><th>Documento</th><th>Paciente</th><th>Nacimiento</th><th>Residencia</th><th>Última consulta</th><th>Síntomas</th><th>Resumen</th><th>Consultas</th><th></th></tr></thead>
                    <tbody id="historias-tbody">${filasHtml}</tbody>
                </table>
                ${filasHtml ? '' : '<p class="texto-ayuda">Sin registros de historia clínica.</p>'}
            </div>
        </div>
    `;
}

function filaDatoHistoria(etiqueta, valor) {
    const v = (valor == null || valor === '') ? '—' : escHtml(valor);
    return `<div class="fila-dato-historia"><span class="etiqueta-dato">${escHtml(etiqueta)}</span><span class="valor-dato">${v}</span></div>`;
}

function filaResumenHistoria(etiqueta, valor) {
    const v = (valor == null || valor === '') ? '—' : escHtml(valor);
    return `<div class="fila-dato-historia fila-resumen"><span class="etiqueta-dato">${escHtml(etiqueta)}</span><span class="valor-dato">${v}</span></div>`;
}

function bloqueDatoHistoria(titulo, filasHtml) {
    return `<div class="bloque-historia"><h3>${escHtml(titulo)}</h3>${filasHtml}</div>`;
}

function consultasFiltradasHistorial() {
    return estadoHistorias.consultas.filter(c =>
        (!estadoHistorias.fechaDesde || c.fecha >= estadoHistorias.fechaDesde) &&
        (!estadoHistorias.fechaHasta || c.fecha <= estadoHistorias.fechaHasta));
}

function aplicarFiltroHistorialFecha(desde, hasta) {
    estadoHistorias.fechaDesde = desde || '';
    estadoHistorias.fechaHasta = hasta || '';
    pintarHistorialModal();
    const visibles = consultasFiltradasHistorial();
    if (!visibles.some(c => c.consulta_id === estadoHistorias.consultaActual)) {
        estadoHistorias.consultaActual = visibles[0]?.consulta_id || null;
    }
    const panel = document.getElementById('historia-consulta-panel');
    const btn = document.getElementById('btn-historia-abrir-consulta');
    if (btn) btn.classList.toggle('oculto', !estadoHistorias.consultaActual);
    if (estadoHistorias.consultaActual) verConsultaEnHistorial(estadoHistorias.consultaActual);
    else if (panel) panel.innerHTML = '<p class="texto-ayuda">Sin consultas en el rango seleccionado.</p>';
}

function pintarHistorialModal() {
    const cont = document.getElementById('historia-clinica-detalle');
    if (!cont || !estadoHistorias.personaData) return;
    const p = estadoHistorias.personaData;
    const visibles = consultasFiltradasHistorial();

    const personaHtml = bloqueDatoHistoria('Datos de la persona', [
        filaDatoHistoria('Documento', [p.tipo_documento_codigo, p.numero_documento].filter(Boolean).join(' ') || '—'),
        filaDatoHistoria('Nombre', p.paciente_nombre),
        filaDatoHistoria('Sexo', p.sexo_codigo),
        filaDatoHistoria('Fecha nacimiento', p.fecha_nacimiento),
        filaDatoHistoria('Residencia', [p.residencia_departamento, p.residencia_municipio].filter(Boolean).join(' / ')),
        filaDatoHistoria('IPS', p.ips_nombre),
        filaDatoHistoria('Estado', p.activo ? 'Activo' : 'Inactivo')
    ].join(''));

    const gridHtml = visibles.length ? `
        <div class="tabla-contenedor">
            <table>
                <thead><tr><th>Fecha</th><th>Profesional</th><th>Síntomas</th><th>Resumen de la consulta</th></tr></thead>
                <tbody>
                    ${visibles.map(c => `
                        <tr class="fila-historia-clinica${c.consulta_id === estadoHistorias.consultaActual ? ' activo' : ''}" data-c="${c.consulta_id}" onclick="verConsultaEnHistorial(${c.consulta_id})">
                            <td>${escHtml(c.fecha || '—')}</td>
                            <td>${escHtml(c.profesional_nombre || '—')}</td>
                            <td>${escHtml(c.sintomas || '—')}</td>
                            <td>${escHtml(c.resumen_consulta || '—')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>` : '<p class="texto-ayuda">Sin consultas en el rango seleccionado.</p>';

    cont.innerHTML = `
        <div class="historia-split">
            <div class="historia-panel-persona">${personaHtml}</div>
            <div class="historia-panel-historial">
                <div class="filtro-fecha-historial">
                    <label>Desde <input type="date" id="hist-filtro-desde" value="${escHtml(estadoHistorias.fechaDesde)}" onchange="aplicarFiltroHistorialFecha(this.value, document.getElementById('hist-filtro-hasta').value)"></label>
                    <label>Hasta <input type="date" id="hist-filtro-hasta" value="${escHtml(estadoHistorias.fechaHasta)}" onchange="aplicarFiltroHistorialFecha(document.getElementById('hist-filtro-desde').value, this.value)"></label>
                    <button type="button" class="btn btn-secundario btn-sm" onclick="aplicarFiltroHistorialFecha('', '')">Limpiar</button>
                </div>
                ${bloqueDatoHistoria(`Consultas (${visibles.length} de ${estadoHistorias.consultas.length})`, gridHtml)}
                <div id="historia-consulta-panel"></div>
            </div>
        </div>
    `;
}

async function verHistoriaClinica(personaId) {
    const cont = document.getElementById('historia-clinica-detalle');
    if (!cont || !personaId) return;
    estadoHistorias.personaActual = personaId;
    const overlay = document.getElementById('modal-historia-clinica');
    overlay.classList.remove('oculto');
    setHistoriaAncho(localStorage.getItem(HISTORIA_ANCHO_KEY) || 'medio');
    cont.innerHTML = '<p class="texto-ayuda">Cargando…</p>';
    try {
        const d = await peticion('/historias/historial/' + personaId);
        estadoHistorias.personaData = d.persona;
        estadoHistorias.consultas = d.consultas || [];
        estadoHistorias.fechaDesde = '';
        estadoHistorias.fechaHasta = '';
        estadoHistorias.consultaActual = consultasFiltradasHistorial()[0]?.consulta_id || null;
        pintarHistorialModal();
        const btn = document.getElementById('btn-historia-abrir-consulta');
        btn.classList.toggle('oculto', !estadoHistorias.consultaActual);
        if (estadoHistorias.consultaActual) await verConsultaEnHistorial(estadoHistorias.consultaActual);
    } catch (ex) {
        cont.innerHTML = `<p class="msg-error visible">${escHtml(ex.message)}</p>`;
    }
}

async function verConsultaEnHistorial(consultaId) {
    const panel = document.getElementById('historia-consulta-panel');
    const btn = document.getElementById('btn-historia-abrir-consulta');
    if (!panel || !consultaId) return;
    estadoHistorias.consultaActual = consultaId;
    if (btn) btn.classList.remove('oculto');
    document.querySelectorAll('#historia-clinica-detalle .fila-historia-clinica')
        .forEach(tr => tr.classList.toggle('activo', tr.dataset.c === String(consultaId)));
    panel.innerHTML = '<p class="texto-ayuda">Cargando consulta…</p>';
    try {
        const d = await peticion(`/historias/detalle/${consultaId}`);
        const c = d.consulta || {};
        const f = d.ficha;
        const sintomas = (d.sintomas || []).map(s => s.nombre).filter(Boolean);

        const vitales = [
            filaDatoHistoria('Altura (cm)', c.altura_cm),
            filaDatoHistoria('Peso (kg)', c.peso_kg),
            filaDatoHistoria('Temperatura (°C)', c.temperatura_c),
            filaDatoHistoria('Frecuencia cardíaca', c.frecuencia_cardiaca),
            filaDatoHistoria('TA (sistólica/diastólica)', [c.ta_sistolica, c.ta_diastolica].filter(v => v != null && v !== '').join(' / ')),
            filaDatoHistoria('Saturación O₂', c.saturacion_o2)
        ].join('');

        const bloqueFicha = f ? bloqueDatoHistoria('Datos básicos', [
            filaDatoHistoria('Notificación', f.estado_notificacion),
            filaDatoHistoria('Razón social UPGD', f.razon_social_upgd),
            filaDatoHistoria('Documento', [f.tipo_documento, f.numero_documento].filter(Boolean).join(' ')),
            filaDatoHistoria('Fecha nacimiento', f.fecha_nacimiento),
            filaDatoHistoria('Edad', [f.edad, f.unidad_medida_edad].filter(Boolean).join(' ')),
            filaDatoHistoria('Sexo', f.sexo),
            filaDatoHistoria('Procedencia', [f.procedencia_departamento, f.procedencia_municipio].filter(Boolean).join(' / ')),
            filaDatoHistoria('Residencia', [f.residencia_departamento, f.residencia_municipio].filter(Boolean).join(' / ')),
            filaDatoHistoria('Dirección residencia', f.direccion_residencia),
            filaDatoHistoria('Clasificación inicial', f.clasificacion_inicial),
            filaDatoHistoria('Condición final', f.condicion_final)
        ].join('')) : '';

        panel.innerHTML = `
            ${bloqueDatoHistoria('Consulta seleccionada', [
                filaDatoHistoria('IPS', c.ips_nombre),
                filaDatoHistoria('Fecha', c.fecha_consulta),
                filaDatoHistoria('Profesional', c.profesional_nombre),
                filaDatoHistoria('Evento', [c.codigo_evento, c.nombre_evento].filter(Boolean).join(' — ')),
                filaDatoHistoria('Estado', c.estado),
                filaDatoHistoria('Síntomas', sintomas.join(', '))
            ].join('') + vitales + filaResumenHistoria('Resumen de consulta', c.resumen_consulta))}
            ${bloqueFicha}
        `;
    } catch (ex) {
        panel.innerHTML = `<p class="msg-error visible">${escHtml(ex.message)}</p>`;
    }
}

async function abrirConsultaDesdeHistoria() {
    const id = estadoHistorias.consultaActual;
    if (!id) return;
    cerrarModal('modal-historia-clinica');
    location.hash = '#/consultas';
    await navegar('consultas');
    await abrirConsulta(id);
}


