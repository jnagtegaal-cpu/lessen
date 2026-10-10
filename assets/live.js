// Lesbord Live — verbinding met de Firebase Realtime Database (via de gewone webinterface, zonder bibliotheek).
// Een "kamer" is een stukje database onder rooms/<CODE>. Wie de code kent, kan erin lezen en schrijven.
// Zie LESFORMAAT.md ("Live: telefoons laten meedoen") en de regels die in de database moeten staan.
const Live = (() => {
  const basis = () => {
    let u = (window.LESBORD_LIVE && window.LESBORD_LIVE.databaseURL) || "";
    const dev = new URLSearchParams(location.search).get("live"); // alleen om lokaal te testen
    if (dev && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) u = dev;
    return u.replace(/\/+$/, "");
  };
  const beschikbaar = () => !!basis();

  const TEKENS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // zonder 0/O en 1/I, makkelijker over te typen
  const maakCode = () => {
    const b = new Uint8Array(6); crypto.getRandomValues(b);
    return [...b].map((x) => TEKENS[x % TEKENS.length]).join("");
  };
  const geldigeCode = (c) => /^[A-Z0-9]{6,10}$/.test(c || "");
  const url = (code, sub = "") => `${basis()}/rooms/${code}${sub ? "/" + sub : ""}.json`;

  async function schrijf(code, sub, waarde, methode = "PUT") {
    const r = await fetch(url(code, sub), {
      method: methode, headers: { "Content-Type": "application/json" },
      body: methode === "DELETE" ? undefined : JSON.stringify(waarde),
    });
    if (!r.ok) throw new Error(`Live ${methode} ${sub || "/"}: ${r.status}`);
    return r.json().catch(() => null);
  }
  async function lees(code, sub) {
    const r = await fetch(url(code, sub), { cache: "no-store" });
    if (!r.ok) throw new Error(`Live GET ${sub || "/"}: ${r.status}`);
    return r.json();
  }

  // Luistert naar een stukje van de kamer. cb krijgt telkens de volledige actuele waarde (of null).
  // Gebruikt een open verbinding (EventSource); lukt dat niet, dan vragen we elke 2 seconden opnieuw.
  function luister(code, sub, cb, bijStatus) {
    let cache = null, es = null, timer = null, gestopt = false;
    const status = (s) => bijStatus && bijStatus(s);
    const geef = () => cb(cache === null ? null : JSON.parse(JSON.stringify(cache)));
    const zetPad = (pad, data) => {
      const d = pad.split("/").filter(Boolean);
      if (!d.length) { cache = data; return; }
      if (cache === null || typeof cache !== "object") cache = {};
      let o = cache;
      for (let i = 0; i < d.length - 1; i++) {
        if (o[d[i]] === undefined || o[d[i]] === null || typeof o[d[i]] !== "object") o[d[i]] = {};
        o = o[d[i]];
      }
      const l = d[d.length - 1];
      if (data === null) delete o[l]; else o[l] = data;
    };
    const naarPollen = () => {
      if (gestopt || timer) return;
      if (es) { es.close(); es = null; }
      status("pollen");
      const tik = () => lees(code, sub).then((w) => { cache = w; geef(); status("ok"); }).catch(() => status("fout"));
      tik(); timer = setInterval(tik, 2000);
    };
    try {
      es = new EventSource(url(code, sub));
      es.addEventListener("put", (e) => { const d = JSON.parse(e.data); zetPad(d.path, d.data); geef(); status("ok"); });
      es.addEventListener("patch", (e) => {
        const d = JSON.parse(e.data);
        for (const [k, v] of Object.entries(d.data || {})) zetPad(`${d.path}/${k}`, v);
        geef(); status("ok");
      });
      es.addEventListener("keep-alive", () => status("ok"));
      es.onopen = () => status("ok");
      es.onerror = () => { if (es && es.readyState === 2) naarPollen(); else status("opnieuw"); };
    } catch (e) { naarPollen(); }
    return () => { gestopt = true; if (es) es.close(); if (timer) clearInterval(timer); };
  }

  return { beschikbaar, maakCode, geldigeCode, schrijf, lees, luister };
})();
