// Smoke: upsert de respuestas de detalles — ¿sobreescribe o conserva?
const u = "http://localhost:3002";

async function login() {
    for (let i = 0; i < 15; i++) {
        try {
            const l = await fetch(u + "/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: "admin@dinamedical.com", clave: "Admin123!" })
            });
            if (l.ok) return (await l.json()).token;
        } catch (e) { /* app aún no lista */ }
        await new Promise((r) => setTimeout(r, 2000));
    }
    return null;
}

(async () => {
    const token = await login();
    if (!token) { console.log("login falló"); return; }
    const H = { "Content-Type": "application/json", Authorization: "Bearer " + token };

    console.log("--- 1) POST con valores (debe insertar o actualizar)");
    let r = await fetch(u + "/api/detalles-eventos/respuestas", {
        method: "POST", headers: H,
        body: JSON.stringify({ consulta_id: 1, valores: { "100_fecha_accidente": "2026-11-01", "100_actividad_accidente": "3" } })
    });
    console.log("status", r.status, JSON.stringify(await r.json()));

    console.log("--- 2) GET tras el POST");
    r = await fetch(u + "/api/detalles-eventos/respuestas?consulta_id=1", { headers: { Authorization: "Bearer " + token } });
    console.log("status", r.status, JSON.stringify(await r.json()));

    console.log("--- 3) POST con valor VACÍO para 100_actividad_accidente (¿lo borra o lo conserva?)");
    r = await fetch(u + "/api/detalles-eventos/respuestas", {
        method: "POST", headers: H,
        body: JSON.stringify({ consulta_id: 1, valores: { "100_actividad_accidente": "" } })
    });
    console.log("status", r.status, JSON.stringify(await r.json()));

    console.log("--- 4) GET final");
    r = await fetch(u + "/api/detalles-eventos/respuestas?consulta_id=1", { headers: { Authorization: "Bearer " + token } });
    console.log("status", r.status, JSON.stringify(await r.json()));
})().catch((e) => console.error("ERR", e.message));
