// Smoke: PUT /api/consultas/1 con sintoma_ids duplicados (escenario que causaba PK violation)
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

    // ids duplicados, como los que producían los dos paneles
    const r = await fetch(u + "/api/consultas/1", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ sintoma_ids: [3, 3, 1, 3], estado: "completa" })
    });
    const d = await r.json();
    console.log("PUT status", r.status);
    console.log("error:", d.error || "(ninguno)");
    console.log("sintomas tras PUT:", JSON.stringify(d.sintomas));
})().catch((e) => console.error("ERR", e.message));
