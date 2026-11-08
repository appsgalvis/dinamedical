// Smoke test temporal: endpoints de detalles-eventos (se ejecuta dentro del contenedor)
const u = "http://localhost:3002";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    let token = null;
    for (let i = 0; i < 15; i++) {
        try {
            const r = await fetch(u + "/api/detalles-eventos/def/100");
            if (r.status === 401) {
                const l = await fetch(u + "/api/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: "admin@dinamedical.com", clave: "Admin123!" })
                });
                token = (await l.json()).token;
                break;
            }
        } catch (e) { /* app ainda no lista */ }
        await sleep(2000);
    }
    if (!token) { console.log("no hubo 401 - app no lista"); return; }

    const d = await fetch(u + "/api/detalles-eventos/def/100", { headers: { Authorization: "Bearer " + token } });
    const defs = await d.json();
    console.log("def status", d.status, "n=", Array.isArray(defs) ? defs.length : JSON.stringify(defs));
    console.log("primer def:", JSON.stringify(defs[0]));
    console.log("con opciones:", JSON.stringify(defs.find((x) => x.opciones && x.opciones.length)));

    const r2 = await fetch(u + "/api/detalles-eventos/respuestas?consulta_id=1", { headers: { Authorization: "Bearer " + token } });
    console.log("respuestas status", r2.status, JSON.stringify(await r2.json()));

    // POST de prueba con una respuesta
    const r3 = await fetch(u + "/api/detalles-eventos/respuestas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ consulta_id: 1, valores: { "100_fecha_accidente": "2026-01-15", "100_manilosist": ["2", "15"] } })
    });
    console.log("POST status", r3.status, JSON.stringify(await r3.json()));
})().catch((e) => console.error("ERR", e.message));
