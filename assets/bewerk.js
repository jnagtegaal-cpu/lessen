// Lesbord — lessen maken en bewerken, zoals in Prowise:
// tekstvakken op het scherm zetten, verslepen en opmaken, plus bouwstenen om iets te verstoppen.
// Lessen uit de chat kun je hier ook openen: hun onderdelen blijven staan, en je kunt er tekstvakken bij zetten.
(() => {
  const $ = (s) => document.querySelector(s);
  const B = 1600, H = 900, MINI = 176 / B;
  const GROOTTES = [["Klein", 32], ["Normaal", 48], ["Groot", 64], ["Heel groot", 96], ["Enorm", 140]];
  const LETTERNAMEN = [["standaard", "Standaard"], ["school", "Schoolschrift"], ["hand", "Handgeschreven"], ["klassiek", "Klassiek"], ["rond", "Rond"]];
  const TEKSTKLEUREN = [["#1d2b24", "Zwart"], ["#1f7a4a", "Groen"], ["#2e6fd1", "Blauw"], ["#d6453d", "Rood"], ["#e07b00", "Oranje"], ["#ffffff", "Wit"]];
  const VULLINGEN = [["", "Geen"], ["#e3f4ea", "Lichtgroen"], ["#fff3b0", "Geel"], ["#dbe9fb", "Lichtblauw"], ["#fbe0e0", "Roze"], ["#2f9e63", "Groen"], ["#2e6fd1", "Blauw"], ["#c9d4ce", "Grijs"]];

  const st = {
    id: Lesbord.param("id"), nieuw: !Lesbord.param("id"), les: null, gekozen: 0,
    sel: null, bewerken: false, vuil: false, uploads: {}, terug: [], vooruit: [], schaal: 1,
  };
  const scherm = () => st.les.schermen[st.gekozen];
  const els = () => (scherm().elementen ||= []);
  const lesmap = () => (st.id ? `lessen/${st.id}` : "lessen");
  const laag = $("#laag"), dia = $("#ed-dia"), houder = $("#houder");
  const rond = (v) => Math.round(v / 5) * 5;
  const tussen = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- Status ----------
  function status(t, soort = "") { const s = $("#status"); s.textContent = t; s.dataset.soort = soort; }
  function vuil() { st.vuil = true; $("#knop-opslaan").disabled = false; status("Niet opgeslagen"); }
  window.addEventListener("beforeunload", (e) => { if (st.vuil) { e.preventDefault(); e.returnValue = ""; } });
  $("#terug").addEventListener("click", (e) => {
    if (st.vuil && !confirm("Je hebt wijzigingen die nog niet zijn opgeslagen. Toch teruggaan?")) e.preventDefault();
  });

  // ---------- Ongedaan maken ----------
  function bewaarStap() {
    st.terug.push(JSON.stringify(st.les.schermen));
    if (st.terug.length > 80) st.terug.shift();
    st.vooruit = [];
  }
  function herstel(van, naar) {
    if (!van.length) return;
    stopBewerken(true);
    naar.push(JSON.stringify(st.les.schermen));
    st.les.schermen = JSON.parse(van.pop());
    st.gekozen = Math.min(st.gekozen, st.les.schermen.length - 1);
    st.sel = null; vuil(); tekenAlles();
  }
  $("#ongedaan").onclick = () => herstel(st.terug, st.vooruit);
  $("#opnieuw").onclick = () => herstel(st.vooruit, st.terug);

  // ---------- Tekenen ----------
  const metUploads = (s) => {
    const k = structuredClone(s);
    for (const x of [...(k.blokken || []), ...(k.elementen || [])])
      if ((x.type === "afbeelding" || x.soort === "afbeelding") && st.uploads[x.src]) x.src = st.uploads[x.src].dataUrl;
    return k;
  };
  const lesdoelHoek = (s) => (st.les.lesdoel && st.les.lesdoelInHoek && !s.lesdoelVerbergen
    ? `<div class="lesdoel-hoek"><b>Lesdoel</b>${Lesbord.opmaak(st.les.lesdoel)}</div>` : "");

  function pasSchaal() {
    const podium = $("#podium");
    const ruimteH = Math.max(320, window.innerHeight - podium.getBoundingClientRect().top - window.scrollY - 70);
    st.schaal = Math.max(0.15, Math.min(podium.clientWidth / B, ruimteH / H));
    houder.style.width = B * st.schaal + "px"; houder.style.height = H * st.schaal + "px";
    dia.style.transform = laag.style.transform = `scale(${st.schaal})`;
  }

  function tekenDia() {
    const s = metUploads(scherm());
    dia.className = Lesbord.diaKlassen(s, st.les.thema);
    dia.innerHTML = Lesbord.diaHtml({ ...s, elementen: [] }, lesmap(), { padden: true }) + lesdoelHoek(s);
    houder.classList.toggle("ed-heeft-blokken", !!(s.blokken || []).length);
  }

  function elHtml(e, i) {
    const k = ["vrij", `vrij-${e.soort}`, "ed-el"];
    if (i === st.sel) k.push("gekozen");
    if (e.verstopt && e.soort !== "afdek") k.push("verstopt");
    if (i === st.sel && st.bewerken) k.push("bewerken");
    let binnen;
    if (e.soort === "afbeelding") {
      const src = st.uploads[e.src]?.dataUrl || (/^(https?:|data:|\/)/.test(e.src || "") ? e.src : `${lesmap()}/${e.src}`);
      binnen = `<img src="${Lesbord.esc(src)}" alt="" draggable="false">`;
    } else if (e.soort === "afdek") binnen = `<span class="ed-badge">Afdekblok · verdwijnt bij tikken</span>`;
    else binnen = `<div class="vrij-inhoud">${Lesbord.schoonHtml(e.html)}</div>`;
    const badge = e.verstopt && e.soort !== "afdek" ? `<span class="ed-badge">Verstopt · komt tevoorschijn bij tikken</span>` : "";
    return `<div class="${k.join(" ")}" data-i="${i}" style="${Lesbord.vrijStijl(e)}">${binnen}${badge}<span class="ed-verplaats" title="Verslepen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg></span><span class="ed-greep" title="Groter of kleiner"></span></div>`;
  }
  function tekenLaag() { laag.innerHTML = els().map(elHtml).join(""); }
  const laagEl = (i) => laag.querySelector(`[data-i="${i}"]`);
  const zetStijl = (i) => { const d = laagEl(i); if (d) d.style.cssText = Lesbord.vrijStijl(els()[i]); };

  function tekenStrip() {
    const n = st.les.schermen.length;
    $("#strip").innerHTML = `
      <div class="ed-strip-kop"><b>Schermen</b>
        <span class="knoppen-rij">
          <button class="knop klein" data-scherm="omhoog" title="Scherm naar voren" ${st.gekozen === 0 ? "disabled" : ""}>↑</button>
          <button class="knop klein" data-scherm="omlaag" title="Scherm naar achteren" ${st.gekozen === n - 1 ? "disabled" : ""}>↓</button>
          <button class="knop klein" data-scherm="kopie" title="Scherm kopiëren">⧉</button>
          <button class="knop klein rood" data-scherm="weg" title="Scherm verwijderen" ${n === 1 ? "disabled" : ""}>✕</button>
        </span></div>
      ${st.les.schermen.map((s, i) => `
        <button class="ed-mini-knop" data-kies="${i}" aria-current="${i === st.gekozen}" aria-label="Scherm ${i + 1}">
          <span class="ed-mini-nr">${i + 1}</span>
          <div class="ed-mini alles-zichtbaar"><div class="${Lesbord.diaKlassen(s, st.les.thema)}" style="transform:scale(${MINI})">${Lesbord.diaHtml(metUploads(s), lesmap())}${lesdoelHoek(s)}</div></div>
        </button>`).join("")}
      <button class="knop vol" data-scherm="nieuw">+ Nieuw scherm</button>`;
  }
  let stripTimer;
  const straksStrip = () => { clearTimeout(stripTimer); stripTimer = setTimeout(tekenStrip, 400); };

  function tekenEigenschappen() {
    const bar = $("#eigenschappen"), e = st.sel != null ? els()[st.sel] : null;
    bar.hidden = !e;
    if (!e) return;
    const kleurKnoppen = (veld, lijst, huidig) => lijst.map(([k, n]) =>
      `<button class="ed-kleur${k ? "" : " geen"}" data-eig="${veld}" data-waarde="${k}" title="${n}" aria-label="${n}" aria-pressed="${(huidig || "") === k}" style="${k ? `background:${k}` : ""}"></button>`).join("");
    let h = "";
    if (e.soort === "tekst") {
      const g = e.grootte || 48;
      const groottes = GROOTTES.some(([, v]) => v === g) ? GROOTTES : [...GROOTTES, [`Eigen (${g})`, g]];
      h += `<div class="ed-groep">
        <select data-eig="letter" aria-label="Lettertype">${LETTERNAMEN.map(([k, n]) => `<option value="${k}" ${(e.letter || "standaard") === k ? "selected" : ""}>${n}</option>`).join("")}</select>
        <select data-eig="grootte" aria-label="Lettergrootte">${groottes.map(([n, v]) => `<option value="${v}" ${v === g ? "selected" : ""}>${n}</option>`).join("")}</select>
      </div>
      <div class="ed-groep">
        <button class="ikoon-knop" data-opmaak="bold" title="Vet (Ctrl+B)"><b>B</b></button>
        <button class="ikoon-knop" data-opmaak="italic" title="Schuin (Ctrl+I)"><i style="font-family:Georgia,serif">I</i></button>
        <button class="ikoon-knop" data-opmaak="underline" title="Onderstrepen (Ctrl+U)"><u>O</u></button>
        <button class="ikoon-knop" data-opmaak="insertUnorderedList" title="Opsomming">•≡</button>
      </div>
      <div class="ed-groep">${[["left", "Links", "M4 6h16M4 12h10M4 18h14"], ["center", "Midden", "M4 6h16M7 12h10M5 18h14"], ["right", "Rechts", "M4 6h16M10 12h10M6 18h14"]].map(([k, n, d]) =>
        `<button class="ikoon-knop" data-eig="uitlijning" data-waarde="${k}" title="${n}" aria-pressed="${(e.uitlijning || "left") === k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="${d}"/></svg></button>`).join("")}</div>
      <div class="ed-groep"><span class="ed-balk-label">Tekst</span>${kleurKnoppen("kleur", TEKSTKLEUREN, e.kleur || "#1d2b24")}</div>`;
    }
    if (e.soort !== "afbeelding")
      h += `<div class="ed-groep"><span class="ed-balk-label">${e.soort === "afdek" ? "Kleur" : "Vlak"}</span>${kleurKnoppen("vulling", e.soort === "afdek" ? VULLINGEN.slice(1) : VULLINGEN, e.vulling || (e.soort === "afdek" ? "#2f9e63" : ""))}</div>`;
    if (e.soort !== "afdek")
      h += `<div class="ed-groep"><label class="vink"><input type="checkbox" data-eig="verstopt" ${e.verstopt ? "checked" : ""}> Verstopt tot je tikt</label></div>`;
    h += `<div class="ed-groep">
      <button class="knop klein" data-el="voor" title="Naar voren">Naar voren</button>
      <button class="knop klein" data-el="achter" title="Naar achteren">Naar achteren</button>
      <button class="knop klein" data-el="kopie" title="Kopiëren (Ctrl+D)">Kopiëren</button>
      <button class="knop klein rood" data-el="weg" title="Verwijderen (Delete)">Verwijderen</button></div>`;
    bar.innerHTML = h;
  }

  function tekenAlles() {
    const s = scherm();
    $("#titel").value = st.les.titel || ""; $("#groep").value = st.les.groep || ""; $("#vak").value = st.les.vak || "";
    $("#achtergrond").value = s.achtergrond || "leeg";
    $("#notitie").value = s.notitie || "";
    pasSchaal(); tekenDia(); tekenLaag(); tekenEigenschappen(); tekenStrip();
  }

  // ---------- Kiezen, slepen, groter maken ----------
  function kies(i) {
    if (st.sel === i) return;
    stopBewerken(true);
    st.sel = i; tekenLaag(); tekenEigenschappen();
  }

  laag.addEventListener("pointerdown", (ev) => {
    const d = ev.target.closest(".ed-el");
    if (!d) {
      stopBewerken(true); st.sel = null; tekenLaag(); tekenEigenschappen();
      if (st.tekstModus) { ev.preventDefault(); pasTekstAan(ev.clientX, ev.clientY); }
      return;
    }
    const i = Number(d.dataset.i);
    const greep = ev.target.closest(".ed-greep, .ed-verplaats");
    if (st.bewerken && st.sel === i && greep) { // tijdens het typen: alleen via de grepen slepen
      bewaarStap();
      return slepen(ev, i, greep.classList.contains("ed-greep") ? "groot" : "verplaats", false, true);
    }
    if (st.bewerken && st.sel === i) return; // aan het typen
    const alGekozen = st.sel === i && !st.bewerken;
    let doel = i;
    if (st.bewerken) {
      const weg = stopBewerken(true); // een leeg tekstvak verdwijnt, de nummers schuiven dan op
      if (weg === i) return;
      if (weg != null && weg < i) doel = i - 1;
    }
    if (st.sel !== doel) kies(doel);
    slepen(ev, doel, ev.target.closest(".ed-greep") ? "groot" : "verplaats", alGekozen);
  });

  function slepen(ev, i, modus, alGekozen, tijdensTypen = false) {
    ev.preventDefault();
    const e = els()[i];
    const start = { x: ev.clientX, y: ev.clientY, ex: e.x, ey: e.y, eb: e.b, eh: e.h || laagEl(i)?.offsetHeight || 200 };
    let bewogen = false;
    laag.setPointerCapture(ev.pointerId);
    const beweeg = (m) => {
      const dx = (m.clientX - start.x) / st.schaal, dy = (m.clientY - start.y) / st.schaal;
      if (!bewogen && Math.hypot(dx, dy) < 4) return;
      if (!bewogen) { if (!tijdensTypen) bewaarStap(); bewogen = true; }
      if (modus === "verplaats") {
        e.x = tussen(rond(start.ex + dx), 40 - e.b, B - 40);
        e.y = tussen(rond(start.ey + dy), -40, H - 40);
      } else {
        e.b = tussen(rond(start.eb + dx), 60, B * 1.2);
        if (e.soort === "afdek") e.h = tussen(rond(start.eh + dy), 30, H * 1.2);
      }
      if (tijdensTypen) { const d = laagEl(i); d.style.left = e.x + "px"; d.style.top = e.y + "px"; d.style.width = e.b + "px"; }
      else zetStijl(i);
    };
    const klaar = () => {
      laag.removeEventListener("pointermove", beweeg);
      laag.removeEventListener("pointerup", klaar);
      laag.removeEventListener("pointercancel", klaar);
      if (bewogen) { vuil(); straksStrip(); }
      else if (alGekozen && e.soort === "tekst") startBewerken(i); // nog eens tikken = typen
    };
    laag.addEventListener("pointermove", beweeg);
    laag.addEventListener("pointerup", klaar);
    laag.addEventListener("pointercancel", klaar);
  }

  laag.addEventListener("dblclick", (ev) => {
    const d = ev.target.closest(".ed-el.vrij-tekst");
    if (d && !st.bewerken) startBewerken(Number(d.dataset.i));
    else if (!ev.target.closest(".ed-el") && !st.tekstModus) pasTekstAan(ev.clientX, ev.clientY);
  });

  // ---------- Tekst van de les zelf aanpassen (ook in lessen uit de chat) ----------
  // Tik (of dubbelklik) op een tekst: je past precies dat stukje tekst aan, zonder de opmaak eromheen.
  st.tekstModus = false;
  $("#knop-tekst").onclick = () => {
    st.tekstModus = !st.tekstModus;
    $("#knop-tekst").setAttribute("aria-pressed", st.tekstModus);
    houder.classList.toggle("ed-tekstmodus", st.tekstModus);
    status(st.tekstModus ? "Tik op een tekst in de les om hem aan te passen." : (st.vuil ? "Niet opgeslagen" : ""));
  };
  function tekstOpPunt(x, y) {
    laag.style.pointerEvents = "none"; dia.style.pointerEvents = "auto";
    let knoop = null;
    try {
      const r = document.caretRangeFromPoint?.(x, y);
      if (r?.startContainer?.nodeType === 3) knoop = r.startContainer;
      if (!knoop) { const p = document.caretPositionFromPoint?.(x, y); if (p?.offsetNode?.nodeType === 3) knoop = p.offsetNode; }
      if (!knoop) {
        const el = document.elementFromPoint(x, y);
        if (el && dia.contains(el)) knoop = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim()) || null;
      }
    } finally { laag.style.pointerEvents = ""; dia.style.pointerEvents = ""; }
    if (!knoop || !dia.contains(knoop) || !knoop.textContent.trim()) return null;
    const r = document.createRange(); r.selectNodeContents(knoop); // echt op de tekst getikt, niet ernaast?
    const m = 6 * st.schaal + 4;
    return [...r.getClientRects()].some((b) => x >= b.left - m && x <= b.right + m && y >= b.top - m && y <= b.bottom + m) ? knoop : null;
  }
  const naarHtml = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\u00a0/g, "&nbsp;");
  const NIET_DOORZOEKEN = new Set(["type", "stijl", "src", "id", "soort", "verhouding", "naar", "anker", "groepen", "goed"]);
  // Alle plekken (in volgorde) waar een stukje tekst in de tekstvelden van een blok staat.
  function vindPlekken(obj, stukje, isHtml) {
    const uit = [];
    const loop = (o, k) => {
      if (typeof o[k] === "string") {
        for (const zoek of isHtml ? [stukje, naarHtml(stukje)] : [stukje]) {
          let i = o[k].indexOf(zoek);
          if (i < 0) continue;
          for (; i >= 0; i = o[k].indexOf(zoek, i + zoek.length)) uit.push({ o, k, i, zoek });
          break;
        }
      } else if (o[k] && typeof o[k] === "object") for (const kk of Object.keys(o[k])) if (!NIET_DOORZOEKEN.has(kk)) loop(o[k], kk);
    };
    for (const k of Object.keys(obj)) if (!NIET_DOORZOEKEN.has(k)) loop(obj, k);
    return uit;
  }
  function vraagTekst(oud) {
    return new Promise((klaar) => {
      const d = document.createElement("dialog");
      d.className = "ed-tekstdialoog";
      d.innerHTML = `<form method="dialog"><h3>Tekst aanpassen</h3>
        <textarea rows="3" aria-label="Tekst"></textarea>
        <p class="veld-uitleg">Daarna nog op <b>Opslaan</b> drukken (rechtsboven).</p>
        <div class="knoppen-rij"><button class="knop" value="nee">Annuleren</button><button class="knop hoofd" value="ja">Aanpassen</button></div></form>`;
      document.body.appendChild(d);
      const ta = d.querySelector("textarea"); ta.value = oud;
      ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); d.close("ja"); } });
      d.addEventListener("close", () => { const w = d.returnValue === "ja" ? ta.value : null; d.remove(); klaar(w); });
      d.showModal(); ta.focus(); ta.select();
    });
  }
  async function pasTekstAan(x, y) {
    const knoop = tekstOpPunt(x, y);
    if (!knoop) { if (st.tekstModus) status("Tik precies op een tekst van de les.", "fout"); return; }
    const vol = knoop.textContent, kern = vol.trim();
    const voor = vol.slice(0, vol.indexOf(kern)), na = vol.slice(vol.indexOf(kern) + kern.length);
    const el = knoop.parentElement;
    let plek = null;
    if (el.closest(".lesdoel-hoek")) {
      const p = vindPlekken(st.les, kern, false).filter((p) => p.o === st.les && p.k === "lesdoel");
      plek = p[0];
    } else {
      const omhul = el.closest("[data-pad]");
      if (omhul) {
        const b = omhul.dataset.pad.split(".").reduce((o, k) => o?.[k], scherm().blokken);
        const w = document.createTreeWalker(omhul, NodeFilter.SHOW_TEXT);
        const zelfde = []; for (let n; (n = w.nextNode());) if (n.textContent === vol) zelfde.push(n);
        const plekken = b ? vindPlekken(b, vol, b.type === "html") : [];
        const nr = Math.max(0, zelfde.indexOf(knoop));
        plek = plekken[Math.min(nr, plekken.length - 1)];
      }
    }
    if (!plek) { status("Deze tekst hoort bij het bord zelf en kun je hier niet aanpassen.", "fout"); return; }
    const nieuw = await vraagTekst(kern);
    if (nieuw == null || nieuw.trim() === kern) return;
    bewaarStap();
    const html = plek.zoek !== vol && plek.zoek !== kern; // in een html-blok staat de tekst met &amp; enz.
    const vervang = html ? naarHtml(voor + nieuw.trim() + na) : voor + nieuw.trim() + na;
    plek.o[plek.k] = plek.o[plek.k].slice(0, plek.i) + vervang + plek.o[plek.k].slice(plek.i + plek.zoek.length);
    // Staat dezelfde tekst ook in het voorbereidingsformulier? Dan daar ook aanpassen.
    let ookVb = false;
    // (alleen als de tekst maar één keer op het scherm staat, anders weet je niet welke bedoeld is)
    const w = document.createTreeWalker(dia, NodeFilter.SHOW_TEXT);
    let opScherm = 0; for (let n; (n = w.nextNode());) if (n.textContent.includes(kern)) opScherm++;
    if (kern.length >= 4 && opScherm === 1 && st.les.voorbereiding) {
      const loop = (o) => { for (const k of Object.keys(o)) {
        if (typeof o[k] === "string" && o[k].includes(kern)) { o[k] = o[k].split(kern).join(nieuw.trim()); ookVb = true; }
        else if (o[k] && typeof o[k] === "object") loop(o[k]);
      } };
      loop(st.les.voorbereiding);
    }
    vuil(); tekenDia(); straksStrip();
    status(`Aangepast${ookVb ? ", ook in het voorbereidingsformulier" : ""}. Vergeet niet op te slaan.`);
  }

  // ---------- Typen in een tekstvak ----------
  function startBewerken(i, allesSelecteren = false, zonderStap = false) {
    if (!zonderStap) bewaarStap();
    st.sel = i; st.bewerken = true; tekenLaag(); tekenEigenschappen();
    const div = laagEl(i)?.querySelector(".vrij-inhoud");
    if (!div) return;
    div.contentEditable = "true"; div.focus();
    const r = document.createRange(); r.selectNodeContents(div);
    if (!allesSelecteren) r.collapse(false);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  }
  // Stopt met typen. Geeft het nummer terug van een leeg tekstvak dat daarbij is weggehaald.
  function stopBewerken(stil = false) {
    if (!st.bewerken) return null;
    const e = els()[st.sel], div = laagEl(st.sel)?.querySelector(".vrij-inhoud");
    let weg = null;
    st.bewerken = false;
    if (e && div) {
      e.html = Lesbord.schoonHtml(div.innerHTML);
      if (!div.textContent.trim()) { weg = st.sel; els().splice(st.sel, 1); st.sel = null; vuil(); }
    }
    tekenLaag();
    if (!stil || weg != null) tekenEigenschappen();
    straksStrip();
    return weg;
  }
  laag.addEventListener("input", (ev) => {
    const div = ev.target.closest(".vrij-inhoud");
    if (!div) return;
    els()[Number(div.parentElement.dataset.i)].html = div.innerHTML;
    vuil(); straksStrip();
  });
  // Plakken altijd als platte tekst (geen rommel uit Word of websites)
  laag.addEventListener("paste", (ev) => {
    if (!ev.target.closest(".vrij-inhoud")) return;
    ev.preventDefault();
    document.execCommand("insertText", false, ev.clipboardData.getData("text/plain"));
  });

  // ---------- Eigenschappenbalk ----------
  const balk = $("#eigenschappen");
  balk.addEventListener("mousedown", (ev) => { if (ev.target.closest("[data-opmaak]")) ev.preventDefault(); }); // selectie in de tekst bewaren
  balk.addEventListener("click", (ev) => {
    const e = els()[st.sel]; if (!e) return;
    const opm = ev.target.closest("[data-opmaak]");
    if (opm) {
      const wasBezig = st.bewerken;
      if (!wasBezig) startBewerken(st.sel, true);
      const sel = getSelection(), div0 = laagEl(st.sel)?.querySelector(".vrij-inhoud");
      if (wasBezig && sel.isCollapsed && div0) { const r = document.createRange(); r.selectNodeContents(div0); sel.removeAllRanges(); sel.addRange(r); }
      document.execCommand(opm.dataset.opmaak);
      const div = laagEl(st.sel)?.querySelector(".vrij-inhoud");
      if (div) e.html = div.innerHTML;
      if (!wasBezig) stopBewerken();
      vuil(); straksStrip(); return;
    }
    const knop = ev.target.closest("[data-eig][data-waarde]");
    if (knop) { wijzigEig(knop.dataset.eig, knop.dataset.waarde); return; }
    const actie = ev.target.closest("[data-el]");
    if (actie) elementActie(actie.dataset.el);
  });
  balk.addEventListener("change", (ev) => {
    const el = ev.target; if (!el.dataset.eig) return;
    wijzigEig(el.dataset.eig, el.type === "checkbox" ? el.checked : el.value);
  });
  function wijzigEig(k, w) {
    const e = els()[st.sel]; if (!e) return;
    const bezig = st.bewerken;
    if (bezig && stopBewerken(true) != null) return;
    bewaarStap();
    if (k === "grootte") w = Number(w);
    if (w === "" || w === false) delete e[k]; else e[k] = w;
    if (k === "kleur" && w === "#1d2b24") delete e.kleur;
    vuil(); tekenLaag(); tekenEigenschappen(); straksStrip();
    if (bezig && st.sel != null) startBewerken(st.sel, false, true);
  }
  function elementActie(a) {
    const lijst = els(), i = st.sel; if (i == null) return;
    stopBewerken(true);
    if (st.sel == null) { tekenEigenschappen(); return; }
    bewaarStap();
    if (a === "weg") { lijst.splice(i, 1); st.sel = null; }
    if (a === "kopie") { const k = structuredClone(lijst[i]); k.x += 30; k.y += 30; lijst.push(k); st.sel = lijst.length - 1; }
    if (a === "voor" && i < lijst.length - 1) { lijst.push(lijst.splice(i, 1)[0]); st.sel = lijst.length - 1; }
    if (a === "achter" && i > 0) { lijst.unshift(lijst.splice(i, 1)[0]); st.sel = 0; }
    vuil(); tekenLaag(); tekenEigenschappen(); straksStrip();
  }

  // ---------- Bouwstenen toevoegen ----------
  function voegToe(e) {
    stopBewerken(true);
    const n = els().length % 6;
    e.x += n * 30; e.y += n * 30;
    bewaarStap(); els().push(e); st.sel = els().length - 1;
    vuil(); tekenLaag(); tekenEigenschappen(); straksStrip();
  }
  document.querySelectorAll("[data-nieuw]").forEach((k) => (k.onclick = () => {
    const soort = k.dataset.nieuw;
    if (soort === "afdek") return voegToe({ soort: "afdek", x: 500, y: 300, b: 600, h: 200, vulling: "#2f9e63" });
    voegToe({ soort: "tekst", x: 400, y: 340, b: 800, html: "", grootte: 56, ...(soort === "verstopt" ? { verstopt: true } : {}) });
    startBewerken(st.sel, false, true);
  }));
  $("#nieuw-afbeelding").addEventListener("change", async (ev) => {
    const bestand = ev.target.files?.[0]; ev.target.value = "";
    if (!bestand) return;
    try {
      const { dataUrl, ext, breed, hoog } = await verklein(bestand);
      const basis = bestand.name.toLowerCase().replace(/\.[a-z0-9]+$/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "afbeelding";
      const naam = `${basis}-${Date.now().toString(36)}.${ext}`;
      st.uploads[naam] = { dataUrl, base64: dataUrl.split(",")[1] };
      const b = Math.min(700, Math.round(700 * Math.min(1, (breed / hoog) * 0.8)));
      voegToe({ soort: "afbeelding", x: 450, y: 150, b, src: naam, alt: basis.replace(/-/g, " ") });
    } catch { alert("Deze afbeelding kon niet worden gelezen."); }
  });
  function verklein(bestand) {
    return new Promise((klaar, fout) => {
      const lezer = new FileReader();
      lezer.onerror = fout;
      lezer.onload = () => {
        const img = new Image();
        img.onerror = fout;
        img.onload = () => {
          const png = bestand.type === "image/png" || bestand.type === "image/gif";
          const f = Math.min(1, 1600 / img.width);
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          klaar({ dataUrl: c.toDataURL(png ? "image/png" : "image/jpeg", 0.85), ext: png ? "png" : "jpg", breed: c.width, hoog: c.height });
        };
        img.src = lezer.result;
      };
      lezer.readAsDataURL(bestand);
    });
  }

  // ---------- Schermen ----------
  $("#strip").addEventListener("click", (ev) => {
    const kies = ev.target.closest("[data-kies]");
    if (kies) { stopBewerken(true); st.gekozen = Number(kies.dataset.kies); st.sel = null; tekenAlles(); return; }
    const k = ev.target.closest("[data-scherm]"); if (!k) return;
    stopBewerken(true);
    const l = st.les.schermen, i = st.gekozen;
    const a = k.dataset.scherm;
    if (a === "weg" && !confirm(`Scherm ${i + 1} verwijderen?`)) return;
    bewaarStap();
    if (a === "nieuw") { l.splice(i + 1, 0, { elementen: [] }); st.gekozen = i + 1; }
    if (a === "kopie") { l.splice(i + 1, 0, structuredClone(l[i])); st.gekozen = i + 1; }
    if (a === "omhoog" && i > 0) { [l[i - 1], l[i]] = [l[i], l[i - 1]]; st.gekozen = i - 1; }
    if (a === "omlaag" && i < l.length - 1) { [l[i + 1], l[i]] = [l[i], l[i + 1]]; st.gekozen = i + 1; }
    if (a === "weg") { l.splice(i, 1); st.gekozen = Math.max(0, i - 1); }
    st.sel = null; vuil(); tekenAlles();
  });
  $("#achtergrond").addEventListener("change", (ev) => {
    bewaarStap();
    if (ev.target.value === "leeg") delete scherm().achtergrond; else scherm().achtergrond = ev.target.value;
    vuil(); tekenDia(); straksStrip();
  });
  $("#notitie").addEventListener("input", (ev) => {
    if (ev.target.value.trim()) scherm().notitie = ev.target.value; else delete scherm().notitie;
    vuil();
  });
  for (const k of ["titel", "groep", "vak"]) $("#" + k).addEventListener("input", (ev) => { st.les[k] = ev.target.value; vuil(); });

  // ---------- Toetsenbord ----------
  document.addEventListener("keydown", (ev) => {
    const ctrl = ev.ctrlKey || ev.metaKey, t = ev.key.toLowerCase();
    if (ctrl && t === "s") { ev.preventDefault(); if (st.vuil) opslaan(); return; }
    if (st.bewerken) { if (ev.key === "Escape") stopBewerken(); return; } // typen: gewone toetsen
    if (ev.target.closest("input, textarea, select")) return;
    if (ctrl && t === "z" && !ev.shiftKey) { ev.preventDefault(); return herstel(st.terug, st.vooruit); }
    if (ctrl && (t === "y" || (t === "z" && ev.shiftKey))) { ev.preventDefault(); return herstel(st.vooruit, st.terug); }
    if (st.sel == null) return;
    const e = els()[st.sel];
    if (ctrl && t === "d") { ev.preventDefault(); return elementActie("kopie"); }
    if (ev.key === "Delete" || ev.key === "Backspace") { ev.preventDefault(); return elementActie("weg"); }
    if (ev.key === "Enter" && e.soort === "tekst") { ev.preventDefault(); return startBewerken(st.sel); }
    if (ev.key === "Escape") { st.sel = null; tekenLaag(); tekenEigenschappen(); return; }
    const stap = ev.shiftKey ? 1 : 10;
    const d = { ArrowLeft: [-stap, 0], ArrowRight: [stap, 0], ArrowUp: [0, -stap], ArrowDown: [0, stap] }[ev.key];
    if (d) { ev.preventDefault(); bewaarStap(); e.x += d[0]; e.y += d[1]; zetStijl(st.sel); vuil(); straksStrip(); }
  });
  window.addEventListener("resize", pasSchaal);

  // ---------- Opslaan ----------
  const slug = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");

  async function opslaan() {
    stopBewerken();
    const l = st.les;
    const mist = ["titel", "groep", "vak"].find((k) => !String(l[k] || "").trim());
    if (mist) { $("#" + mist).focus(); return status(`Vul eerst de ${mist} in (bovenaan).`, "fout"); }
    const knop = $("#knop-opslaan");
    knop.disabled = true; status("Opslaan…");
    try {
      const les = structuredClone(l);
      les.titel = les.titel.trim(); les.groep = String(les.groep).trim(); les.vak = les.vak.trim();
      for (const s of les.schermen) {
        for (const e of s.elementen || []) if (e.soort === "tekst") e.html = Lesbord.schoonHtml(e.html);
        if (s.elementen && !s.elementen.length) delete s.elementen;
      }
      let id = st.id;
      if (st.nieuw) {
        const basis = slug(`${/^\d/.test(les.groep) ? "g" + les.groep : les.groep}-${les.vak}-${les.titel}`) || "les";
        id = basis;
        for (let n = 2; await GitHub.leesBestand(`lessen/${id}/les.json`); n++) id = `${basis}-${n}`;
        les.gemaakt = new Date().toISOString().slice(0, 10);
      }
      delete les.id;
      const opTeSlaan = { id, ...les };
      for (const [naam, u] of Object.entries(st.uploads))
        if (JSON.stringify(opTeSlaan).includes(naam))
          await GitHub.schrijfBestand(`lessen/${id}/${naam}`, u.base64, `Afbeelding voor ${les.titel} (via de app)`);
      await GitHub.schrijfTekst(`lessen/${id}/les.json`, JSON.stringify(opTeSlaan, null, 2) + "\n",
        `${st.nieuw ? "Nieuwe les" : "Les aangepast"}: ${les.titel} (via de app)`);
      GitHub.onthoudOpgeslagen(opTeSlaan);
      st.les = opTeSlaan; st.id = id; st.nieuw = false; st.uploads = {}; st.vuil = false;
      history.replaceState(null, "", `bewerk.html?id=${id}`);
      const bekijk = $("#knop-bekijk"); bekijk.hidden = false; bekijk.href = `les.html?id=${id}`;
      status("Opgeslagen ✓ Binnen een paar minuten staat hij online.", "goed");
      tekenAlles();
    } catch (err) {
      knop.disabled = false; status(err.message || "Opslaan mislukt.", "fout");
    }
  }
  $("#knop-opslaan").onclick = opslaan;

  // ---------- Start ----------
  async function start() {
    if (!GitHub.heeftSleutel()) {
      document.body.classList.add("ed-zonder-sleutel");
      $("#werk").innerHTML = `<section class="paneel smal" style="margin:24px auto"><h2>Eerst je sleutel invullen</h2>
        <p>Om lessen te maken, aan te passen of te verwijderen heeft dit apparaat eenmalig je persoonlijke GitHub-sleutel nodig.</p>
        <a class="knop hoofd" href="sleutel.html?terug=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}">Sleutel invullen</a></section>`;
      return;
    }
    try {
      if (st.nieuw) {
        st.les = { titel: "", groep: "", vak: "", pdfs: false, schermen: [{ elementen: [] }] };
        status("Nieuwe les");
      } else {
        const bestand = await GitHub.leesBestand(`lessen/${st.id}/les.json`);
        if (!bestand) throw new Error("Deze les bestaat niet (meer).");
        st.les = JSON.parse(bestand.inhoud);
        const bekijk = $("#knop-bekijk"); bekijk.hidden = false; bekijk.href = `les.html?id=${st.id}`;
      }
      if (!st.les.schermen?.length) st.les.schermen = [{ elementen: [] }];
      tekenAlles();
      if (st.nieuw) $("#titel").focus();
    } catch (err) {
      $("#werk").innerHTML = `<div class="leeg" style="margin:24px">${Lesbord.esc(err.message || "Laden mislukt.")}</div>`;
    }
  }
  start();
})();
