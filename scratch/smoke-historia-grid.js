// Smoke temporal: GET /api/consultas/historia-grid y /api/historias/vista
const u = "http://localhost:3002";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
        await sleep(2000);
    }
    return null;
}

(async () => {
    const token = await login();
    if (!token) { console.log("login falló - app no lista"); return; }
    const H = { Authorization: "Bearer " + token };

    const pidRow = await (await fetch(u + "/api/historias/vista", { headers: H })).json();
    console.log("historias/vista status ok, filas:", Array.isArray(pidRow) ? pidRow.length : JSON.stringify(pidRow));
    const pid = Array.isArray(pidRow) && pidRow[0] ? pidRow[0].id_persona : 1;

    const g = await fetch(u + "/api/consultas/historia-grid?paciente_persona_id=" + pid, { headers: H });
    const gd = await g.json();
    console.log("historia-grid status", g.status, "| primera fila:", JSON.stringify(Array.isArray(gd) ? gd[0] : gd));
    if (Array.isArray(gd) && gd.length) console.log("profesional_nombre:", gd[0].profesional_nombre);
})().catch((e) => console.error("ERR", e.message));
