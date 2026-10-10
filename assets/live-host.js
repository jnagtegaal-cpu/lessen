// Lesbord Live — kant van de presentator: kamer starten, QR-code tonen, teams zien binnenkomen (en verwijderen),
// vragen naar de telefoons sturen en de antwoorden laten zien. Gebruikt Live (live.js).
// Spellen met meerdere stappen (bluf, proeven) staan in spellen.js en krijgen via `api` toegang tot de kamer.
const LiveHost = (() => {
  const $ = (id) => document.getElementById(id);
  const esc = Lesbord.esc;
  const st = {
    lesId: "", les: null, code: null, kamer: null, stop: null, status: "uit", maxTeams: 3, huidig: null,
    toon: new Set(), onTeams: () => {}, geefPunten: () => false, plek: () => -1, fout: "",
  };
  const sleutel = () => `lesbord-live-kamer-${st.lesId}`;
  const bewaar = (c) => { try { c ? localStorage.setItem(sleutel(), c) : localStorage.removeItem(sleutel()); } catch (e) { /* geen opslag */ } };
  const opgeslagen = () => { try { return localStorage.getItem(sleutel()); } catch (e) { return null; } };

  const link = () => new URL(`doe.html?k=${st.code}`, location.href).href;
  const qrSvg = (tekst) => {
    const q = qrcode(0, "M"); q.addData(tekst); q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  };
  const teams = () => {
    const t = (st.kamer && st.kamer.teams) || {};
    return Object.entries(t).map(([tid, v]) => ({ tid, naam: String(v.naam || "?"), ts: v.ts || 0 })).sort((a, b) => a.ts - b.ts);
  };
  // De teams die meedoen (de eerste die aansloten), in de volgorde van het scorebord.
  const spelers = () => {
    const p = (t) => { const i = st.plek(t.tid); return i < 0 ? 99 : i; };
    return teams().slice(0, st.maxTeams).sort((a, b) => p(a) - p(b));
  };
  const vlak = (def) => (def.groepen ? def.groepen.flatMap((g) => g.items || []) : def.opties || []);
  const kruis = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  // ---------- Kamer ----------
  async function start() {
    st.fout = "";
    try {
      const code = Live.maakCode();
      await Live.schrijf(code, "meta", { gemaakt: Date.now(), maxTeams: st.maxTeams, titel: st.les.titel || "", thema: st.les.thema || "" });
      bewaar(code); verbind(code);
    } catch (e) { st.fout = "De kamer kon niet gemaakt worden. Controleer het webadres en de regels van de database."; teken(); }
  }
  function verbind(code) {
    if (st.stop) st.stop();
    st.code = code; st.kamer = null; st.status = "verbinden";
    st.stop = Live.luister(code, "", (w) => {
      if (w === null) { // kamer is weg (gewist of verlopen)
        if (st.kamer !== null) { st.code = null; bewaar(null); if (st.stop) st.stop(); st.stop = null; }
        st.kamer = null;
      } else st.kamer = w;
      bijwerken();
    }, (s) => { st.status = s; teken(); });
    teken();
    bindScherm($("dia"));
  }
  async function stopKamer() {
    const code = st.code; if (!code) return;
    if (st.stop) st.stop(); st.stop = null; st.code = null; st.kamer = null; bewaar(null);
    try { await Live.schrijf(code, "", null, "DELETE"); } catch (e) { /* al weg */ }
    teken(); bijwerken();
  }
  async function verwijderTeam(tid) {
    if (!st.code) return;
    try { await Live.schrijf(st.code, `teams/${tid}`, null, "DELETE"); } catch (e) { st.fout = "Het team kon niet verwijderd worden."; teken(); }
  }

  // ---------- Vragen ----------
  async function stuurVraag(def) {
    if (!st.code) return;
    const huidigeVraag = st.kamer && st.kamer.vraag;
    if (huidigeVraag && huidigeVraag.id === def.id && def.open !== false) return;
    const v = { id: def.id, soort: def.soort, tekst: def.tekst || "", open: def.open !== false };
    for (const k of ["opties", "groepen", "uitsluit", "max"]) if (def[k] !== undefined) v[k] = def[k];
    try { await Live.schrijf(st.code, "vraag", v); } catch (e) { st.fout = "De vraag kon niet verstuurd worden."; teken(); }
  }
  async function zetOpen(open) {
    if (!st.code) return;
    try { await Live.schrijf(st.code, "vraag/open", open); } catch (e) { /* volgende poging */ }
  }
  const vraagOpen = (id) => !(st.kamer && st.kamer.vraag && st.kamer.vraag.id === id && st.kamer.vraag.open === false);
  const antwoorden = (id) => {
    const a = (st.kamer && st.kamer.antw && st.kamer.antw[id]) || {};
    return spelers().map((t) => ({ ...t, antw: a[t.tid] ? a[t.tid].w : null }));
  };
  const toonAntwoord = (def, w) => {
    if (w === null || w === undefined) return "";
    if (def.soort === "vinkjes") {
      const lijst = vlak(def);
      return String(w).split(",").filter(Boolean).map((i) => lijst[Number(i)]).filter(Boolean).join(", ");
    }
    return String(w);
  };

  // Wat spellen.js mag gebruiken.
  const api = {
    actief: () => !!st.code && !!st.kamer,
    lesId: () => st.lesId,
    code: () => st.code,
    spelers, antwoorden, stuurVraag, vraagOpen,
    sluitVraag: (id) => { if (st.kamer && st.kamer.vraag && st.kamer.vraag.id === id) zetOpen(false); },
    geefPunten: (p) => st.geefPunten(p),
    teken: () => tekenBlokken(),
  };

  // ---------- Tekenen ----------
  function bijwerken() {
    teken();
    st.onTeams(spelers().map((t) => ({ tid: t.tid, naam: t.naam })));
    tekenBlokken();
  }
  function teken() {
    const p = $("livepaneel"); if (!p) return;
    const t = teams();
    let h = `<div class="live-kop"><h3>Telefoons</h3><button class="ikoon-knop" id="live-sluit" aria-label="Sluiten">${kruis}</button></div>`;
    if (!Live.beschikbaar()) {
      h += `<p class="live-uitleg">De live-functie is nog niet ingesteld. Vul het webadres van de database in <code>assets/live-config.js</code> in.</p>`;
    } else if (!st.code) {
      h += `<p class="live-uitleg">Laat de teams met hun telefoon meedoen: ze scannen een QR-code en kiezen een teamnaam.</p>
        <button class="knop hoofd" id="live-start">Start telefoons</button>`;
    } else {
      h += `<div class="live-qr">${qrSvg(link())}</div>
        <p class="live-link">Lukt scannen niet? Ga naar<br>${esc(link())}</p>
        <p class="live-status ${st.status}">${{ ok: "Verbonden", verbinden: "Verbinden…", opnieuw: "Opnieuw verbinden…", pollen: "Verbonden (vertraagd)", fout: "Geen verbinding" }[st.status] || ""}</p>
        <h4>Teams (${Math.min(t.length, st.maxTeams)} van ${st.maxTeams})</h4>
        <ul class="live-teams">${t.map((x, i) => `<li${i >= st.maxTeams ? ' class="extra"' : ""}><span>${esc(x.naam)}</span>` +
          `<button class="live-weg" data-weg="${esc(x.tid)}" aria-label="${esc(x.naam)} verwijderen" title="Verwijderen">${kruis}</button></li>`).join("") ||
          "<li class='leeg'>Nog niemand.</li>"}</ul>
        <button class="knop" id="live-stop">Stop en wis kamer</button>`;
    }
    if (st.fout) h += `<p class="live-fout">${esc(st.fout)}</p>`;
    p.innerHTML = h;
  }
  const aansluitHtml = () => {
    if (!Live.beschikbaar()) return `<p class="b-klein">De live-functie is nog niet ingesteld.</p>`;
    if (!st.code) return `<button class="knop hoofd live-groot" data-live-start>Start telefoons</button>`;
    const t = spelers();
    return `<div class="aansluit-qr">${qrSvg(link())}</div>
      <div class="aansluit-tekst"><p class="aansluit-stap">Scan de code met je telefoon en kies een teamnaam.</p>
      <ul class="aansluit-teams">${t.map((x) => `<li>${esc(x.naam)}</li>`).join("") || "<li class='leeg'>Wachten op de eerste…</li>"}</ul></div>`;
  };
  function blokHtml(def) {
    if (!st.code) return `<div class="live-blok-uit">Telefoons zijn niet gestart. Tik op het telefoon-icoon bovenin.</div>`;
    const lijst = antwoorden(def.id);
    const klaar = lijst.filter((x) => x.antw !== null).length;
    const open = vraagOpen(def.id);
    const toon = st.toon.has(def.id);
    return `<div class="live-blok-kop"><b>${klaar} van ${lijst.length}</b> teams hebben geantwoord${open ? "" : " · gesloten"}</div>
      <ul class="live-antw">${lijst.map((x) => `<li class="${x.antw !== null ? "klaar" : ""}"><span class="naam">${esc(x.naam)}</span>${
        toon && x.antw !== null ? `<span class="inhoud">${esc(toonAntwoord(def, x.antw))}</span>` : `<span class="vink">${x.antw !== null ? "✓" : "…"}</span>`}</li>`).join("")}</ul>
      <div class="live-blok-knoppen"><button class="knop" data-live-toon>${toon ? "Verberg antwoorden" : "Toon antwoorden"}</button>
      <button class="knop" data-live-open>${open ? "Sluit de vraag" : "Open de vraag weer"}</button></div>`;
  }
  function tekenBlokken() {
    const dia = $("dia"); if (!dia) return;
    dia.querySelectorAll("[data-aansluiten]").forEach((el) => { el.innerHTML = aansluitHtml(); });
    if (st.huidig) dia.querySelectorAll("[data-live]").forEach((el) => { el.innerHTML = blokHtml(st.huidig); });
    if (typeof Spellen !== "undefined") Spellen.teken(dia, api);
  }
  // Wordt aangeroepen na elke wisseling van scherm.
  function bindScherm(dia) {
    if (!st.lesId || !dia) return;
    const el = dia.querySelector("[data-live]");
    st.huidig = el ? JSON.parse(el.dataset.live) : null;
    if (st.huidig && st.code) stuurVraag(st.huidig);
    if (typeof Spellen !== "undefined") Spellen.bind(dia, api);
    tekenBlokken();
  }

  function init(les, id, opties = {}) {
    st.lesId = id; st.les = les;
    st.onTeams = opties.onTeams || st.onTeams; st.geefPunten = opties.geefPunten || st.geefPunten; st.plek = opties.plek || st.plek;
    st.maxTeams = les.scorebord && les.scorebord.teams ? (Array.isArray(les.scorebord.teams) ? les.scorebord.teams.length : Number(les.scorebord.teams)) : 3;
    const knop = $("knop-live"), p = $("livepaneel"); if (!knop || !p) return;
    knop.hidden = false;
    knop.onclick = () => { p.hidden = !p.hidden; knop.setAttribute("aria-pressed", String(!p.hidden)); if (!p.hidden) teken(); };
    p.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") { p.hidden = true; knop.setAttribute("aria-pressed", "false"); } });
    p.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const tweeKeer = (tekst, doe) => { // gevaarlijke knoppen: eerst "Zeker weten?"
        if (b.dataset.zeker) return doe();
        b.dataset.zeker = "1"; const oud = b.innerHTML; b.textContent = tekst;
        setTimeout(() => { if (b.isConnected) { delete b.dataset.zeker; b.innerHTML = oud; } }, 3000);
      };
      if (b.id === "live-sluit") { p.hidden = true; knop.setAttribute("aria-pressed", "false"); }
      else if (b.id === "live-start") start();
      else if (b.id === "live-stop") tweeKeer("Zeker weten?", stopKamer);
      else if (b.dataset.weg) tweeKeer("Zeker?", () => verwijderTeam(b.dataset.weg));
    });
    $("dia").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.hasAttribute("data-live-start")) start();
      else if (b.hasAttribute("data-live-toon") && st.huidig) { st.toon.has(st.huidig.id) ? st.toon.delete(st.huidig.id) : st.toon.add(st.huidig.id); tekenBlokken(); }
      else if (b.hasAttribute("data-live-open")) {
        const v = st.kamer && st.kamer.vraag; zetOpen(!!(v && v.open === false)); // gesloten? dan openen, anders sluiten
      } else if (b.dataset.spel && typeof Spellen !== "undefined") Spellen.klik(b, api);
    });
    teken();
    const eerder = Live.beschikbaar() ? opgeslagen() : null;
    if (eerder && Live.geldigeCode(eerder)) {
      Live.lees(eerder, "meta").then((m) => { if (m) verbind(eerder); else bewaar(null); }).catch(() => verbind(eerder));
    }
  }
  return { init, bindScherm, teams };
})();
