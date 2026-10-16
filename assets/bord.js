// Lesbord — presentatie met tekenlaag (pen, gum, ongedaan maken, wissen).
// Aantekeningen leven alleen in het geheugen: herladen of de les sluiten = schoon bord.
(() => {
  const B = 1600, H = 900; // vaste maat van een scherm; alles schaalt mee
  const $ = (id) => document.getElementById(id);
  const podium = $("podium"), houder = $("houder"), dia = $("dia"), laag = $("laag");
  const ctx = laag.getContext("2d");

  const st = {
    les: null, lesmap: "", index: 0, klad: false,
    modus: "aanwijzen", kleur: "#1d2b24", dikte: 8,
    strepen: new Map(), onthuld: new Map(), // schermsleutel -> Set van getoonde stappen
    // schermsleutel -> [{gum, kleur, dikte, punten:[[x,y],...]}]
    schaal: 1, bezig: null,
  };
  const sleutel = () => (st.klad ? "klad" : String(st.index));
  const strepenNu = () => {
    if (!st.strepen.has(sleutel())) st.strepen.set(sleutel(), []);
    return st.strepen.get(sleutel());
  };

  // ---------- Schalen ----------
  function pasAan() {
    const r = podium.getBoundingClientRect();
    const marge = window.innerWidth < 700 ? 8 : 24;
    st.schaal = Math.min((r.width - marge * 2) / B, (r.height - marge * 2) / H);
    const w = Math.round(B * st.schaal), h = Math.round(H * st.schaal);
    houder.style.width = w + "px"; houder.style.height = h + "px";
    dia.style.transform = `scale(${st.schaal})`;
    const dpr = window.devicePixelRatio || 1;
    laag.width = Math.round(w * dpr); laag.height = Math.round(h * dpr);
    laag.style.width = w + "px"; laag.style.height = h + "px";
    hertekenen();
  }

  // ---------- Tekenen ----------
  function zetTransform() {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(st.schaal * dpr, 0, 0, st.schaal * dpr, 0, 0);
  }
  function streep(s) {
    const p = s.punten;
    if (!p.length) return;
    ctx.save();
    ctx.globalCompositeOperation = s.gum ? "destination-out" : "source-over";
    ctx.strokeStyle = s.kleur; ctx.fillStyle = s.kleur;
    ctx.lineWidth = s.dikte; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (p.length === 1) {
      ctx.beginPath(); ctx.arc(p[0][0], p[0][1], s.dikte / 2, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length - 1; i++) {
        const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
        ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my);
      }
      const l = p[p.length - 1]; ctx.lineTo(l[0], l[1]); ctx.stroke();
    }
    ctx.restore();
  }
  function hertekenen() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, laag.width, laag.height);
    zetTransform();
    for (const s of strepenNu()) streep(s);
    if (st.bezig) streep(st.bezig);
  }
  function punt(e) {
    const r = laag.getBoundingClientRect();
    return [(e.clientX - r.left) / st.schaal, (e.clientY - r.top) / st.schaal];
  }

  laag.addEventListener("pointerdown", (e) => {
    if (st.modus === "aanwijzen") return;
    if (st.bezig) return; // één streep tegelijk
    e.preventDefault();
    laag.setPointerCapture(e.pointerId);
    const gum = st.modus === "gum" || e.button === 5 || (e.buttons & 32); // gumknop van de pen
    st.bezig = { id: e.pointerId, gum, kleur: st.kleur, dikte: gum ? Math.max(40, st.dikte * 4) : st.dikte, punten: [punt(e)] };
    hertekenen();
  });
  laag.addEventListener("pointermove", (e) => {
    if (!st.bezig || e.pointerId !== st.bezig.id) return;
    e.preventDefault();
    const lijst = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of lijst) st.bezig.punten.push(punt(ev));
    hertekenen();
  });
  const einde = (e) => {
    if (!st.bezig || e.pointerId !== st.bezig.id) return;
    strepenNu().push(st.bezig); st.bezig = null; hertekenen();
  };
  laag.addEventListener("pointerup", einde);
  laag.addEventListener("pointercancel", einde);

  // ---------- Schermen ----------
  function toonScherm() {
    const schermen = st.les.schermen || [];
    const s = st.klad ? { blokken: [], achtergrond: "leeg" } : schermen[st.index];
    dia.className = Lesbord.diaKlassen(s, st.les.thema);
    let html = Lesbord.diaHtml(s, st.lesmap);
    if (!st.klad && st.les.lesdoel && st.les.lesdoelInHoek && !s.lesdoelVerbergen) {
      html += `<div class="lesdoel-hoek"><b>Lesdoel</b>${Lesbord.opmaak(st.les.lesdoel)}</div>`;
    }
    dia.innerHTML = html;
    if (typeof Score !== "undefined") Score.vulEindstand(dia);
    if (typeof LiveHost !== "undefined") LiveHost.bindScherm(dia);
    const getoond = st.onthuld.get(sleutel()) || new Set();
    dia.querySelectorAll(".onthul").forEach((el, i) => el.classList.toggle("zichtbaar", getoond.has(i)));
    vulInvulvakken();
    $("teller").textContent = st.klad ? "Kladblad" : `${st.index + 1} / ${schermen.length}`;
    $("vorige").disabled = st.klad || st.index === 0;
    $("volgende").disabled = st.klad || ((st.index >= schermen.length - 1 || isKeuze()) && !dia.querySelector(".onthul:not(.zichtbaar)"));
    const fase = !st.klad && s.fase;
    $("fase").hidden = !fase; $("fase").textContent = fase || "";
    $("notitie-tekst").textContent = (!st.klad && s.notitie) || "Geen notitie bij dit scherm.";
    $("knop-klad").setAttribute("aria-pressed", st.klad);
    if (!st.klad) { // schermnummer in het adres: per ongeluk herladen brengt je terug op hetzelfde scherm
      try {
        const u = new URL(location.href);
        if (u.searchParams.get("scherm") !== String(st.index + 1)) { u.searchParams.set("scherm", st.index + 1); history.replaceState(null, "", u); }
      } catch (e) { /* geen adresbalk (bijv. in een voorbeeld) */ }
    }
    hertekenen();
  }
  // Invulvakken (textarea/input in een html-blok): wat je typt blijft alleen op dit apparaat bewaard, niet op de site.
  const invulSleutel = (i) => `lesbord-invul:${st.lesmap}:${sleutel()}:${i}`;
  function vulInvulvakken() {
    dia.querySelectorAll("textarea, input[type=text]").forEach((el, i) => {
      try { const w = localStorage.getItem(invulSleutel(i)); if (w != null) el.value = w; } catch (e) {}
    });
  }
  dia.addEventListener("input", (e) => {
    const el = e.target.closest("textarea, input[type=text]"); if (!el) return;
    const i = [...dia.querySelectorAll("textarea, input[type=text]")].indexOf(el);
    try { localStorage.setItem(invulSleutel(i), el.value); } catch (err) {}
  });
  // Stap voor stap: tik op een verborgen stap, of druk op "volgende" om de eerstvolgende te tonen.
  function onthul(el) {
    const alle = [...dia.querySelectorAll(".onthul")];
    const i = alle.indexOf(el); if (i < 0) return;
    if (!st.onthuld.has(sleutel())) st.onthuld.set(sleutel(), new Set());
    const set = st.onthuld.get(sleutel());
    if (set.has(i)) { set.delete(i); el.classList.remove("zichtbaar"); }
    else { set.add(i); el.classList.add("zichtbaar"); }
  }
  dia.addEventListener("click", (e) => {
    const naar = e.target.closest("[data-naar]");
    if (naar) { springNaar(naar.dataset.naar); return; }
    const el = e.target.closest(".onthul"); if (el) onthul(el);
  });
  // ---------- Slepen (stand Aanwijzen) ----------
  // data-sleep="bron": slepen maakt een kopie, zodat je er zoveel neerlegt als je wilt (bijv. schaallijnen).
  // Een kopie die je terugsleept op de bron verdwijnt. Kopieën die tegen elkaar aan komen, klikken netjes aan elkaar.
  // data-sleep (zonder waarde): het element zelf schuift mee.
  let sleep = null, netGesleept = false;
  const SNAP = 18;
  dia.addEventListener("pointerdown", (e) => {
    if (st.modus !== "aanwijzen" || st.klad) return;
    let el = e.target.closest("[data-sleep]"); if (!el) return;
    const omhul = el.closest(".onthul");
    if (omhul && !omhul.classList.contains("zichtbaar")) return; // eerst tonen, dan slepen
    e.preventDefault(); e.stopPropagation();
    const d = dia.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (el.dataset.sleep === "bron") {
      const k = el.cloneNode(true);
      k.dataset.sleep = "kopie"; k.classList.add("sleep-kopie");
      Object.assign(k.style, { position: "absolute", margin: "0", zIndex: "6",
        left: `${(r.left - d.left) / st.schaal}px`, top: `${(r.top - d.top) / st.schaal}px` });
      dia.appendChild(k); el = k;
    }
    const kopie = el.classList.contains("sleep-kopie");
    sleep = { el, kopie, id: e.pointerId, x: e.clientX, y: e.clientY,
      l: parseFloat(el.style.left) || 0, t: parseFloat(el.style.top) || 0,
      dx: Number(el.dataset.dx || 0), dy: Number(el.dataset.dy || 0) };
    netGesleept = true;
    el.setPointerCapture?.(e.pointerId);
  });
  dia.addEventListener("pointermove", (e) => {
    if (!sleep || e.pointerId !== sleep.id) return;
    e.preventDefault();
    const mx = (e.clientX - sleep.x) / st.schaal, my = (e.clientY - sleep.y) / st.schaal;
    if (sleep.kopie) { sleep.el.style.left = `${sleep.l + mx}px`; sleep.el.style.top = `${sleep.t + my}px`; }
    else {
      sleep.el.dataset.dx = sleep.dx + mx; sleep.el.dataset.dy = sleep.dy + my;
      sleep.el.style.transform = `translate(${sleep.dx + mx}px, ${sleep.dy + my}px)`;
    }
  });
  const sleepEinde = (e) => {
    if (!sleep || e.pointerId !== sleep.id) return;
    const { el, kopie } = sleep; sleep = null;
    if (!kopie) return;
    const box = (x) => { const d = dia.getBoundingClientRect(), r = x.getBoundingClientRect();
      return { l: (r.left - d.left) / st.schaal, t: (r.top - d.top) / st.schaal, w: r.width / st.schaal, h: r.height / st.schaal }; };
    const b = box(el);
    const bron = dia.querySelector('[data-sleep="bron"]');
    if (bron) { const o = box(bron); // terug op de stapel = weg
      if (b.l + b.w / 2 > o.l && b.l + b.w / 2 < o.l + o.w && b.t + b.h / 2 > o.t && b.t + b.h / 2 < o.t + o.h) { el.remove(); return; } }
    for (const ander of dia.querySelectorAll(".sleep-kopie")) {
      if (ander === el) continue;
      const o = box(ander);
      if (Math.abs(b.t - o.t) > SNAP * 1.5) continue;
      if (Math.abs(b.l - (o.l + o.w)) < SNAP) { el.style.left = `${o.l + o.w}px`; el.style.top = `${o.t}px`; break; }
      if (Math.abs(b.l + b.w - o.l) < SNAP) { el.style.left = `${o.l - b.w}px`; el.style.top = `${o.t}px`; break; }
    }
  };
  dia.addEventListener("pointerup", sleepEinde);
  dia.addEventListener("pointercancel", sleepEinde);
  dia.addEventListener("click", (e) => { // na slepen geen tik doorgeven (anders klapt een blok weer dicht)
    if (netGesleept) { netGesleept = false; e.stopPropagation(); }
  }, true);
  dia.addEventListener("pointerdown", () => { if (!sleep) netGesleept = false; }, true);

  // Een keuzescherm (blok "keuze") is een splitsing: daar ga je verder met een van de knoppen, niet met "volgende".
  const isKeuze = () => !st.klad && !!dia.querySelector("[data-naar]");
  function springNaar(anker) {
    const i = (st.les.schermen || []).findIndex((s) => s.anker === anker);
    if (i >= 0) ga(i);
  }
  function volgende() {
    const verborgen = dia.querySelector(".onthul:not(.zichtbaar)");
    if (verborgen && !st.klad) onthul(verborgen);
    else if (!isKeuze()) ga(st.index + 1);
  }

  // ---------- Schermkiezer: tik op het schermnummer om naar een ander scherm te gaan ----------
  const lijst = $("schermlijst");
  const schermNaam = (s, i) => s.fase || ((s.blokken || []).find((b) => b.type === "kop") || {}).tekst || `Scherm ${i + 1}`;
  function toonLijst(open) {
    if (!lijst || !st.les) return;
    lijst.hidden = !open;
    $("teller").setAttribute("aria-expanded", String(open));
    if (!open) return;
    lijst.innerHTML = `<h3>Ga naar scherm</h3><ol>${(st.les.schermen || []).map((s, i) =>
      `<li><button data-scherm="${i}"${i === st.index && !st.klad ? ' aria-current="true"' : ""}><span>${i + 1}</span>${Lesbord.esc(schermNaam(s, i))}</button></li>`).join("")}</ol>`;
    const nu = lijst.querySelector("[aria-current]") || lijst.querySelector("button");
    if (nu) { nu.scrollIntoView({ block: "center" }); nu.focus(); }
  }
  if (lijst) {
    $("teller").onclick = () => toonLijst(lijst.hidden);
    lijst.addEventListener("click", (e) => {
      const b = e.target.closest("[data-scherm]"); if (!b) return;
      toonLijst(false); ga(Number(b.dataset.scherm));
    });
    lijst.addEventListener("keydown", (e) => { // pijltjes en spatie mogen het bord hier niet verder laten gaan
      e.stopPropagation();
      if (e.key === "Escape") { toonLijst(false); $("teller").focus(); }
    });
    document.addEventListener("pointerdown", (e) => {
      if (!lijst.hidden && !lijst.contains(e.target) && !$("teller").contains(e.target)) toonLijst(false);
    });
  }

  function ga(n) {
    const max = (st.les.schermen || []).length - 1;
    st.klad = false;
    st.index = Math.max(0, Math.min(max, n));
    toonScherm();
  }

  // ---------- Knoppen ----------
  $("vorige").onclick = () => ga(st.index - 1);
  $("volgende").onclick = volgende;
  $("knop-klad").onclick = () => { st.klad = !st.klad; toonScherm(); };
  $("knop-lesdoel").onclick = () => {
    const uit = houder.classList.toggle("lesdoel-uit");
    $("knop-lesdoel").setAttribute("aria-pressed", !uit);
  };
  $("knop-notities").onclick = () => {
    const open = $("notities").classList.toggle("open");
    $("knop-notities").setAttribute("aria-pressed", open);
  };
  $("knop-scherm").onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  function zetModus(m) {
    st.modus = m;
    document.querySelectorAll("[data-modus]").forEach((k) => k.setAttribute("aria-pressed", k.dataset.modus === m));
    laag.classList.toggle("aanwijzen", m === "aanwijzen");
  }
  document.querySelectorAll("[data-modus]").forEach((k) => (k.onclick = () => zetModus(k.dataset.modus)));
  document.querySelectorAll("[data-kleur]").forEach((k) => (k.onclick = () => {
    st.kleur = k.dataset.kleur;
    document.querySelectorAll("[data-kleur]").forEach((x) => x.setAttribute("aria-pressed", x === k));
    zetModus("pen");
  }));
  document.querySelectorAll("[data-dikte]").forEach((k) => (k.onclick = () => {
    st.dikte = Number(k.dataset.dikte);
    document.querySelectorAll("[data-dikte]").forEach((x) => x.setAttribute("aria-pressed", x === k));
    if (st.modus === "aanwijzen") zetModus("pen");
  }));
  $("ongedaan").onclick = () => { strepenNu().pop(); hertekenen(); };
  $("wissen").onclick = () => { st.strepen.set(sleutel(), []); hertekenen(); };

  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea")) return;
    if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); volgende(); }
    else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); ga(st.index - 1); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); $("ongedaan").click(); }
    else if (e.key === "p") zetModus("pen");
    else if (e.key === "g") zetModus("gum");
    else if (e.key === "Escape") { zetModus("aanwijzen"); toonLijst(false); }
  });
  window.addEventListener("resize", pasAan);
  document.addEventListener("fullscreenchange", pasAan);

  // ---------- Start ----------
  // Een tv die de randen afsnijdt (overscan): ?rand=4 laat rondom 4% ruimte. Onthouden op dit apparaat; ?rand=0 zet het uit.
  (() => {
    let rand = Lesbord.param("rand");
    try { if (rand !== null) localStorage.setItem("lesbord-rand", rand); else rand = localStorage.getItem("lesbord-rand"); } catch (e) { /* geen opslag */ }
    const n = Math.max(0, Math.min(15, Number(rand) || 0));
    document.documentElement.style.setProperty("--rand-x", `${n}vw`);
    document.documentElement.style.setProperty("--rand-y", `${n}vh`);
  })();
  const id = Lesbord.param("id");
  Lesbord.laadLes(id).then((les) => {
    st.les = les; st.lesmap = `lessen/${id}`;
    if (/^[a-z-]+$/.test(les.thema || "")) document.body.classList.add(`thema-${les.thema}`);
    if (les.thema === "pub") { // zwart is onzichtbaar op een krijtbord: de eerste pen wordt krijtwit
      const k = document.querySelector("[data-kleur]");
      k.dataset.kleur = "#f4efe2"; k.style.background = "#f4efe2"; k.title = "Krijt"; k.setAttribute("aria-label", "Krijt");
      st.kleur = "#f4efe2";
    }
    document.title = `${les.titel} · Lesbord`;
    $("titel").textContent = les.titel;
    $("knop-lesdoel").hidden = !(les.lesdoel && les.lesdoelInHoek);
    const start = Number(Lesbord.param("scherm")) || 1;
    st.index = Math.max(0, Math.min((les.schermen || []).length - 1, start - 1));
    if (typeof Score !== "undefined") Score.init(les, id, () => Score.vulEindstand(dia), pasAan);
    if (les.live && typeof LiveHost !== "undefined") LiveHost.init(les, id, { onTeams: (t) => typeof Score !== "undefined" && Score.zetTeams(t), geefPunten: (p) => typeof Score !== "undefined" && Score.geefPunten(p), plek: (tid) => (typeof Score !== "undefined" ? Score.plekVan(tid) : -1) });
    pasAan(); toonScherm();
  }).catch(() => {
    $("titel").textContent = "Deze les kon niet geladen worden";
    dia.innerHTML = `<h1 class="b-kop">Les niet gevonden</h1><p class="b-tekst">Ga terug naar het overzicht en kies een andere les.</p>`;
    pasAan();
  });
})();
