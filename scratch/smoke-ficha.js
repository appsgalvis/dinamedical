// Smoke temporal: GET /api/ficha-datos-basicos?consulta_id=1 (corre dentro del contenedor)
const u = "http://localhost:3002";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    let token = null;
    for (let i = 0; i < 15; i++) {
        try {
            const l = await fetch(u + "/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: "admin@dinamedical.com", clave: "Admin123!" })
            });
            if (l.ok) { token = (await l.json()).token; break; }
        } catch (e) { /* app aún no lista */ }
        await sleep(2000);
    }
    if (!token) { console.log("login falló - app no lista"); return; }

    const r = await fetch(u + "/api/ficha-datos-basicos?consulta_id=1", { headers: { Authorization: "Bearer " + token } });
    const data = await r.json();
    console.log("ficha status", r.status);
    console.log("_ips_nombre:", data.ips_nombre, "| usuario_nombre:", data.usuario_nombre, "| persona_nombre:", data.persona_nombre);
    console.log("codigo_evento:", data.codigo_evento, "| nombre_evento:", data.nombre_evento);
})().catch((e) => console.error("ERR", e.message));
