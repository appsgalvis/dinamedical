// Smoke test: catálogo Dengue 210 / 220 / 580 del formulario dinámico
const u = "http://127.0.0.1:3002";

(async () => {
    const l = await fetch(u + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@dinamedical.com", clave: "Admin123!" })
    });
    const j = await l.json();
    if (!j.token) { console.log("login falló:", JSON.stringify(j)); return; }

    for (const ev of ["210", "220", "580"]) {
        const r = await fetch(u + "/api/detalles-eventos/def/" + ev, { headers: { Authorization: "Bearer " + j.token } });
        const defs = await r.json();
        console.log(`\n=== evento ${ev} (${defs.length} preguntas) ===`);
        for (const d of defs) {
            const reglas = d.show_if ? `  [descargue: se muestra si ${d.padre_ref} = ${d.show_if}]` : '';
            console.log(`${d.seccion}${d.subs ? '-' + d.subs : ''} ${d.numero} ${d.tipo.padEnd(11)} ${d.ref}  obl=${d.obligatorio}  opciones=${(d.opciones || []).length}${reglas}`);
        }
        const grupo6 = defs.filter(d => d.seccion === '6');
        for (const g of grupo6) console.log(`  bloque6 ${(g.opciones || []).map(o => o.value + ':' + o.label).join(' | ')}`);
    }
})().catch(e => console.error("ERR", e.message));
