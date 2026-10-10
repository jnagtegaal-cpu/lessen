// Lesbord — spellen met telefoons, in stappen op één scherm. Werkt samen met live-host.js (api).
//  • bluf:  teams verzinnen een betekenis → alle betekenissen plus de echte, gehusseld → teams stemmen → onthullen.
//           Punten: 2 voor wie de echte kiest, 1 voor elke stem op je eigen verzinsel.
//  • proef: teams vinken smaken aan → onthullen. Punten: goede smaken min foute smaken (nooit minder dan 0).
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

  // ---------- Koppeling met het bord ----------
  const zoek = (dia) => {
    const b = dia.querySelector("[data-bluf]"); if (b) return { soort: "bluf", def: JSON.parse(b.dataset.bluf), el: b };
    const p = dia.querySelector("[data-proef]"); if (p) return { soort: "proef", def: JSON.parse(p.dataset.proef), el: p };
    return null;
  };
  const vraagVoor = (h) => (h.soort === "bluf" ? blufVraag(h.def, spel(h.def.id)) : proefVraag(h.def, spel(h.def.id)));

  function bind(dia, api) {
    laad(api);
    huidig = zoek(dia);
    if (huidig) api.stuurVraag(vraagVoor(huidig));
  }
  function teken(dia, api) {
    if (!huidig) return;
    const el = dia.querySelector(huidig.soort === "bluf" ? "[data-bluf]" : "[data-proef]"); if (!el) return;
    if (!statisch.has(el)) statisch.set(el, el.innerHTML);
    if (!api.actief()) { if (el.innerHTML !== statisch.get(el)) el.innerHTML = statisch.get(el); el.classList.remove("live"); return; }
    el.classList.add("live");
    const s = spel(huidig.def.id);
    el.classList.toggle("uitslag", s.fase === "uitslag");
    el.innerHTML = huidig.soort === "bluf" ? blufHtml(huidig.def, s, api) : proefHtml(huidig.def, s, api);
  }
  function klik(b, api) {
    if (!huidig) return;
    const { soort, def } = huidig, s = spel(def.id), actie = b.dataset.spel;
    if (actie === "stemmen" && soort === "bluf") blufNaarStemmen(def, s, api);
    else if (actie === "onthul") (soort === "bluf" ? blufOnthul : proefOnthul)(def, s, api);
    else if (actie === "geef" && !s.toegekend) { api.geefPunten(s.punten || {}); s.toegekend = true; bewaar(api); }
    else if (actie === "opnieuw") {
      if (!b.dataset.zeker) { b.dataset.zeker = "1"; b.textContent = "Zeker weten?"; setTimeout(() => { if (b.isConnected) { delete b.dataset.zeker; b.textContent = "Opnieuw"; } }, 3000); return; }
      staat[def.id] = { fase: "begin", r: (s.r || 0) + 1 }; bewaar(api); api.stuurVraag(vraagVoor(huidig));
    }
    api.teken();
  }
  return { bind, teken, klik };
})();
