// Lesbord — spellen met telefoons, in stappen op één scherm. Werkt samen met live-host.js (api).
//  • bluf:  teams verzinnen een betekenis → alle betekenissen plus de echte, gehusseld → teams stemmen → onthullen.
//           Punten: 2 voor wie de echte kiest, 1 voor elke stem op je eigen verzinsel.
//  • proef: teams vinken smaken aan → onthullen. Punten: goede smaken min foute smaken (nooit minder dan 0).
//  • feiten: teams kiezen welke van A, B, C de onzin is → antwoorden dicht (de telefoons wachten) → het verhaal
//           wordt voorgelezen → punten toekennen: de stempels verschijnen, goed = 1 punt, de telefoons zien of het klopte.
// De stand van elk spel wordt in de browser bewaard, zodat herladen niets kapotmaakt.
// Zonder telefoons blijft de gewone inhoud van het blok staan (woord of drankje met verborgen antwoord).
const Spellen = (() => {
  const esc = Lesbord.esc;
  let staat = {}, geladenVoor = null, huidig = null; // huidig = { soort: "bluf" | "proef", def }
  const statisch = new WeakMap();

  const sleutel = (api) => `lesbord-spel-${api.lesId()}`;
  function laad(api) {
    if (geladenVoor === api.lesId()) return;
    geladenVoor = api.lesId();
    try { staat = JSON.parse(localStorage.getItem(sleutel(api)) || "{}") || {}; } catch (e) { staat = {}; }
  }
  const bewaar = (api) => { try { localStorage.setItem(sleutel(api), JSON.stringify(staat)); } catch (e) { /* geen opslag */ } };
  // Elke kamer (elke avond, elke les) begint met lege spellen: een oude uitslag hoort bij oude teams.
  function zelfdeKamer(api) {
    const code = api.code();
    if (code && staat._kamer !== code) { staat = { _kamer: code }; bewaar(api); }
  }
  const spel = (id) => staat[id] || (staat[id] = { fase: "begin", r: 0 });
  const letter = (i) => String.fromCharCode(65 + i);
  const schud = (lijst) => {
    const a = lijst.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const r = new Uint32Array(1); crypto.getRandomValues(r);
      const j = r[0] % (i + 1); [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const naamVan = (api, tid) => (api.spelers().find((t) => t.tid === tid) || {}).naam || "een team dat niet meer meedoet";

  // ---------- Gedeelde stukjes ----------
  const status = (lijst, klaarTekst) =>
    `<ul class="spel-status">${lijst.map((x) => `<li class="${x.antw ? "klaar" : ""}">${esc(x.naam)}<span>${x.antw ? klaarTekst : "bezig"}</span></li>`).join("") ||
      "<li>Nog geen teams</li>"}</ul>`;
  const knoppen = (lijst) => `<div class="spel-knoppen">${lijst.map(([actie, tekst, uit, hoofd]) =>
    `<button class="knop${hoofd ? " hoofd" : ""}" data-spel="${actie}"${uit ? " disabled" : ""}>${esc(tekst)}</button>`).join("")}</div>`;
  const punten = (api, p) => `<ul class="spel-punten">${api.spelers().map((t) =>
    `<li><span>${esc(t.naam)}</span><b>+${(p && p[t.tid]) || 0}</b></li>`).join("")}</ul>`;
  const voet = (links, rechts) => `<div class="spel-voet">${links}${rechts}</div>`;
  const geefKnop = (s) => (s.toegekend ? ["", "Punten toegekend", true] : ["geef", "Punten toekennen", false, true]);

  // ---------- Bluf ----------
  const blufIds = (def, s) => ({ def: `${def.id}-r${s.r}-def`, stem: `${def.id}-r${s.r}-stem` });
  function blufVraag(def, s) {
    const ids = blufIds(def, s);
    if (s.fase === "stemmen" || s.fase === "uitslag") {
      return { id: ids.stem, soort: "keuze", tekst: `Welke betekenis van “${def.woord}” is echt?`,
        opties: s.opties.map((o) => o.t), uitsluit: s.uitsluit || {}, open: s.fase === "stemmen" };
    }
    return { id: ids.def, soort: "tekst", tekst: `Verzin een betekenis voor “${def.woord}” die zo echt mogelijk klinkt.`, max: 160 };
  }
  function blufNaarStemmen(def, s, api) {
    const ids = blufIds(def, s);
    const ingezonden = api.antwoorden(ids.def).filter((x) => x.antw && String(x.antw).trim());
    s.opties = schud([{ t: def.betekenis, van: null }, ...ingezonden.map((x) => ({ t: String(x.antw).trim(), van: x.tid }))]);
    s.uitsluit = {};
    s.opties.forEach((o, i) => { if (o.van) s.uitsluit[o.van] = letter(i); });
    s.fase = "stemmen";
    bewaar(api); api.stuurVraag(blufVraag(def, s));
  }
  function blufOnthul(def, s, api) {
    const ids = blufIds(def, s);
    const echt = letter(s.opties.findIndex((o) => !o.van));
    const stemmen = {}, p = {};
    api.spelers().forEach((t) => { p[t.tid] = 0; });
    api.antwoorden(ids.stem).forEach((x) => { if (x.antw) stemmen[x.tid] = String(x.antw); });
    for (const [tid, l] of Object.entries(stemmen)) {
      if (l === echt) p[tid] = (p[tid] || 0) + 2;
      else {
        const o = s.opties[l.charCodeAt(0) - 65];
        if (o && o.van && o.van !== tid) p[o.van] = (p[o.van] || 0) + 1;
      }
    }
    s.stemmen = stemmen; s.punten = p; s.fase = "uitslag";
    bewaar(api); api.sluitVraag(ids.stem);
  }
  function blufHtml(def, s, api) {
    const ids = blufIds(def, s);
    const woord = `<p class="bluf-woord">${esc(def.woord)}</p>`;
    if (s.fase === "stemmen" || s.fase === "uitslag") {
      const uitslag = s.fase === "uitslag";
      const lang = s.opties.some((o) => o.t.length > 90);
      const opties = `<ol class="bluf-opties${lang ? " lang" : ""}">${s.opties.map((o, i) => {
        const kiezers = uitslag ? Object.entries(s.stemmen || {}).filter(([, l]) => l === letter(i)).map(([tid]) => naamVan(api, tid)) : [];
        const meta = uitslag ? `<span class="bluf-meta">${o.van ? `verzonnen door ${esc(naamVan(api, o.van))}` : "de echte betekenis"}${
          kiezers.length ? ` · gekozen door ${kiezers.map(esc).join(", ")}` : ""}</span>` : "";
        return `<li class="${uitslag ? (o.van ? "verzonnen" : "echt") : ""}"><span class="bluf-letter">${letter(i)}</span>` +
          `<span class="bluf-tekst">${esc(o.t)}${meta}</span></li>`;
      }).join("")}</ol>`;
      if (!uitslag) return woord + opties + voet(status(api.antwoorden(ids.stem), "gestemd"), knoppen([["onthul", "Onthul", false, true]]));
      return woord + opties + voet(punten(api, s.punten), knoppen([geefKnop(s), ["opnieuw", "Opnieuw"]]));
    }
    const lijst = api.antwoorden(ids.def);
    return woord + `<p class="spel-opdracht">Verzin op je telefoon een betekenis die zo echt mogelijk klinkt.</p>` +
      voet(status(lijst, "ingestuurd"), knoppen([["stemmen", "Naar het stemmen", !lijst.some((x) => x.antw), true]]));
  }

  // ---------- Proeven ----------
  const vlak = (def) => (def.groepen || []).flatMap((g) => g.items || []);
  const proefVraag = (def, s) => ({ id: `${def.id}-r${s.r}`, soort: "vinkjes", tekst: `${def.naam}: vink alle smaken aan die je proeft.`,
    groepen: def.groepen, open: s.fase !== "uitslag" });
  function proefOnthul(def, s, api) {
    const id = proefVraag(def, s).id, lijst = vlak(def), goed = new Set(def.goed || []), res = {};
    api.antwoorden(id).forEach((x) => {
      const gekozen = x.antw ? String(x.antw).split(",").filter(Boolean).map((i) => lijst[Number(i)]).filter(Boolean) : [];
      const g = gekozen.filter((n) => goed.has(n));
      res[x.tid] = { g, f: gekozen.length - g.length, p: Math.max(0, g.length - (gekozen.length - g.length)) };
    });
    s.res = res; s.punten = Object.fromEntries(Object.entries(res).map(([t, r]) => [t, r.p])); s.fase = "uitslag";
    bewaar(api); api.sluitVraag(id);
  }
  function proefHtml(def, s, api) {
    if (s.fase === "uitslag") {
      const teams = api.spelers().map((t) => {
        const r = (s.res || {})[t.tid] || { g: [], f: 0, p: 0 };
        return `<li><b>${esc(t.naam)}</b><span class="proef-uitleg">${r.g.length} goed${r.g.length ? `: ${r.g.map(esc).join(", ")}` : ""} · ${r.f} fout</span><span class="proef-p">+${r.p}</span></li>`;
      }).join("");
      return `<p class="proef-naam">${esc(def.naam)}${def.echteNaam ? ` <span class="proef-echt">${esc(def.echteNaam)}</span>` : ""}</p>` +
        `<div class="b-smaken">${(def.goed || []).map((n) => `<span>${esc(n)}</span>`).join("")}</div>` +
        `<ul class="proef-teams">${teams}</ul>` + voet("", knoppen([geefKnop(s), ["opnieuw", "Opnieuw"]]));
    }
    return `<p class="proef-naam">${esc(def.naam)}</p><p class="spel-opdracht">Proef rustig en vink op je telefoon alle smaken aan die je herkent. Elke goede smaak is een punt, elke foute kost er een.</p>` +
      voet(status(api.antwoorden(proefVraag(def, s).id), "ingestuurd"), knoppen([["onthul", "Onthul de smaken", false, true]]));
  }

  // ---------- Feiten: twee feiten en één onzin ----------
  // Fases: "begin" (teams kiezen), "dicht" (de telefoons wachten, het verhaal wordt voorgelezen), "uitslag".
  const feitenVraag = (def, s) => {
    const v = { id: `${def.id}-r${s.r}`, soort: "keuze", tekst: "Welke is de onzin?", opties: def.titels, wacht: true, open: s.fase === "begin" };
    if (s.fase === "uitslag") v.uitslag = { goed: letter(def.onzin) };
    return v;
  };
  function feitenPunten(def, s, api) {
    const goed = letter(def.onzin), res = {};
    api.antwoorden(feitenVraag(def, s).id).forEach((x) => { res[x.tid] = { k: x.antw ? String(x.antw) : "", p: x.antw === goed ? 1 : 0 }; });
    s.res = res; s.punten = Object.fromEntries(Object.entries(res).map(([t, r]) => [t, r.p]));
    s.fase = "uitslag"; s.toegekend = true;
    api.geefPunten(s.punten); bewaar(api); api.stuurVraag(feitenVraag(def, s));
  }
  function feitenHtml(def, s, api, basis) {
    // De kaarten zelf blijven zoals op het gewone bord; het antwoord (en daarmee de stempels) komt pas bij de uitslag.
    const t = document.createElement("template"); t.innerHTML = basis;
    const antw = t.content.querySelector(".antwoord-trigger");
    if (antw && s.fase === "uitslag") { antw.classList.remove("onthul"); antw.classList.add("zichtbaar"); }
    else if (antw) antw.remove();
    const id = feitenVraag(def, s).id;
    if (s.fase === "uitslag") {
      const teams = api.spelers().map((tm) => {
        const r = (s.res || {})[tm.tid] || { k: "", p: 0 };
        return `<li class="${r.p ? "klaar" : "mis"}">${esc(tm.naam)}<span>${r.k ? `koos ${esc(r.k)}` : "niet gekozen"}${r.p ? " · +1" : ""}</span></li>`;
      }).join("");
      return t.innerHTML + voet(`<ul class="spel-status">${teams || "<li>Nog geen teams</li>"}</ul>`, knoppen([["opnieuw", "Opnieuw"]]));
    }
    const lijst = api.antwoorden(id);
    if (s.fase === "dicht") return t.innerHTML + voet(status(lijst, "gekozen"), knoppen([["geef", "Punten toekennen", false, true], ["heropen", "Toch weer open"]]));
    return t.innerHTML + voet(status(lijst, "gekozen"), knoppen([["dicht", "Antwoorden dicht", !lijst.some((x) => x.antw), true]]));
  }

  // ---------- Koppeling met het bord ----------
  const SOORTEN = { bluf: "[data-bluf]", proef: "[data-proef]", feiten: "[data-feiten]" };
  const zoek = (dia) => {
    for (const [soort, sel] of Object.entries(SOORTEN)) {
      const el = dia.querySelector(sel);
      if (el) { const def = JSON.parse(el.dataset[soort]); if (def.id) return { soort, def }; }
    }
    return null;
  };
  const vraagVoor = (h) => {
    const s = spel(h.def.id);
    return h.soort === "bluf" ? blufVraag(h.def, s) : h.soort === "proef" ? proefVraag(h.def, s) : feitenVraag(h.def, s);
  };

  function bind(dia, api) {
    laad(api); zelfdeKamer(api);
    huidig = zoek(dia);
    if (huidig) api.stuurVraag(vraagVoor(huidig));
  }
  function teken(dia, api) {
    if (!huidig) return;
    const el = dia.querySelector(SOORTEN[huidig.soort]); if (!el) return;
    if (!statisch.has(el)) statisch.set(el, el.innerHTML);
    if (!api.actief()) { if (el.innerHTML !== statisch.get(el)) el.innerHTML = statisch.get(el); el.classList.remove("live"); return; }
    zelfdeKamer(api);
    el.classList.add("live");
    const s = spel(huidig.def.id);
    el.classList.toggle("uitslag", s.fase === "uitslag");
    el.innerHTML = huidig.soort === "bluf" ? blufHtml(huidig.def, s, api)
      : huidig.soort === "proef" ? proefHtml(huidig.def, s, api) : feitenHtml(huidig.def, s, api, statisch.get(el));
  }
  function klik(b, api) {
    if (!huidig) return;
    const { soort, def } = huidig, s = spel(def.id), actie = b.dataset.spel;
    if (actie === "stemmen" && soort === "bluf") blufNaarStemmen(def, s, api);
    else if (actie === "onthul") (soort === "bluf" ? blufOnthul : proefOnthul)(def, s, api);
    else if (actie === "dicht" && soort === "feiten") { s.fase = "dicht"; bewaar(api); api.sluitVraag(feitenVraag(def, s).id); }
    else if (actie === "heropen" && soort === "feiten") { s.fase = "begin"; bewaar(api); api.heropenVraag(feitenVraag(def, s).id); }
    else if (actie === "geef" && soort === "feiten" && !s.toegekend) feitenPunten(def, s, api);
    else if (actie === "geef" && !s.toegekend) { api.geefPunten(s.punten || {}); s.toegekend = true; bewaar(api); }
    else if (actie === "opnieuw") {
      if (!b.dataset.zeker) { b.dataset.zeker = "1"; b.textContent = "Zeker weten?"; setTimeout(() => { if (b.isConnected) { delete b.dataset.zeker; b.textContent = "Opnieuw"; } }, 3000); return; }
      staat[def.id] = { fase: "begin", r: (s.r || 0) + 1 }; bewaar(api); api.stuurVraag(vraagVoor(huidig));
    }
    api.teken();
  }
  return { bind, teken, klik };
})();
