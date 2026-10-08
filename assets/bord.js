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
    strepen: new Map(), // schermsleutel -> [{gum, kleur, dikte, punten:[[x,y],...]}]
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
    dia.className = Lesbord.diaKlassen(s);
    let html = Lesbord.diaHtml(s, st.lesmap);
    if (!st.klad && st.les.lesdoel && st.les.lesdoelInHoek && !s.lesdoelVerbergen) {
      html += `<div class="lesdoel-hoek"><b>Lesdoel</b>${Lesbord.opmaak(st.les.lesdoel)}</div>`;
    }
    dia.innerHTML = html;
    $("teller").textContent = st.klad ? "Kladblad" : `${st.index + 1} / ${schermen.length}`;
    $("vorige").disabled = st.klad || st.index === 0;
    $("volgende").disabled = st.klad || st.index >= schermen.length - 1;
    const fase = !st.klad && s.fase;
    $("fase").hidden = !fase; $("fase").textContent = fase || "";
    $("notitie-tekst").textContent = (!st.klad && s.notitie) || "Geen notitie bij dit scherm.";
    $("knop-klad").setAttribute("aria-pressed", st.klad);
    hertekenen();
  }
  function ga(n) {
    const max = (st.les.schermen || []).length - 1;
    st.klad = false;
    st.index = Math.max(0, Math.min(max, n));
    toonScherm();
  }

  // ---------- Knoppen ----------
  $("vorige").onclick = () => ga(st.index - 1);
  $("volgende").onclick = () => ga(st.index + 1);
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
    if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); ga(st.index + 1); }
    else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); ga(st.index - 1); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); $("ongedaan").click(); }
    else if (e.key === "p") zetModus("pen");
    else if (e.key === "g") zetModus("gum");
    else if (e.key === "Escape") zetModus("aanwijzen");
  });
  window.addEventListener("resize", pasAan);
  document.addEventListener("fullscreenchange", pasAan);

  // ---------- Start ----------
  const id = Lesbord.param("id");
  Lesbord.laadLes(id).then((les) => {
    st.les = les; st.lesmap = `lessen/${id}`;
    document.title = `${les.titel} · Lesbord`;
    $("titel").textContent = les.titel;
    $("knop-lesdoel").hidden = !(les.lesdoel && les.lesdoelInHoek);
    const start = Number(Lesbord.param("scherm")) || 1;
    st.index = Math.max(0, Math.min((les.schermen || []).length - 1, start - 1));
    pasAan(); toonScherm();
  }).catch(() => {
    $("titel").textContent = "Deze les kon niet geladen worden";
    dia.innerHTML = `<h1 class="b-kop">Les niet gevonden</h1><p class="b-tekst">Ga terug naar het overzicht en kies een andere les.</p>`;
    pasAan();
  });
})();
