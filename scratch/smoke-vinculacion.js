// Smoke: vinculación directa — POST inserta stamps y GET por persona_id funciona
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

    console.log("--- POST ref NUEVO (100_direccion_lugar): debe insertar con stamps");
    let r = await fetch(u + "/api/detalles-eventos/respuestas", {
        method: "POST", headers: H,
        body: JSON.stringify({ consulta_id: 1, valores: { "100_direccion_lugar": "Calle 10 #3-45" } })
    });
    console.log("status", r.status, JSON.stringify(await r.json()));

    console.log("--- GET directo por persona_id=3 (sin pasar por consulta)");
    r = await fetch(u + "/api/detalles-eventos/respuestas?persona_id=3", { headers: { Authorization: "Bearer " + token } });
    console.log("status", r.status, JSON.stringify(await r.json()));

    console.log("--- GET por consulta_id (sigue funcionando)");
    r = await fetch(u + "/api/detalles-eventos/respuestas?consulta_id=1", { headers: { Authorization: "Bearer " + token } });
    console.log("status", r.status, JSON.stringify(await r.json()));
})().catch((e) => console.error("ERR", e.message));
