// Lesbord — lessen maken en bewerken in de app.
// Alles wat je hier invult wordt les.json in GitHub, precies hetzelfde formaat als lessen uit de chat.
(() => {
  const { esc } = Lesbord;
  const $ = (s, el = document) => el.querySelector(s);
  const inhoud = $("#inhoud");

  const BLOKTYPES = [
    ["kop", "Titel"], ["subkop", "Tussenkop"], ["tekst", "Tekst"], ["vraag", "Vraag / opdracht"],
    ["groot", "Heel groot (getal of woord)"], ["lijst", "Opsomming"], ["stappen", "Stappenplan"],
    ["tabel", "Tabel"], ["afbeelding", "Afbeelding"], ["schrijfvak", "Schrijfvak"], ["klein", "Kleine tekst"], ["fase", "Label op het scherm"],
  ];
  const NAAM = Object.fromEntries(BLOKTYPES);
  const TEKSTTYPES = ["kop", "subkop", "tekst", "vraag", "groot", "klein", "fase"];

  const st = { id: Lesbord.param("id"), nieuw: !Lesbord.param("id"), les: null, gekozen: 0, tab: "gegevens", vuil: false, uploads: {} };

  const nieuweLes = () => ({
    titel: "", groep: "", vak: "", lesdoel: "", lesdoelInHoek: false,
    schermen: [{ blokken: [{ type: "kop", tekst: "" }] }],
    voorbereiding: { benodigdheden: [], verloop: [] },
  });

  // ---------- Status en opslaan-knop ----------
  function status(tekst, soort = "") {
    const s = $("#status"); s.textContent = tekst; s.dataset.soort = soort;
  }
  function vuil() {
    st.vuil = true; $("#knop-opslaan").disabled = false; status("Niet opgeslagen");
  }
  window.addEventListener("beforeunload", (e) => { if (st.vuil) { e.preventDefault(); e.returnValue = ""; } });
  $("#terug").addEventListener("click", (e) => {
    if (st.vuil && !confirm("Je hebt wijzigingen die nog niet zijn opgeslagen. Toch teruggaan?")) e.preventDefault();
  });

  // ---------- Tabs ----------
  document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => { st.tab = t.dataset.tab; teken(); }));

  function teken() {
    document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", t.dataset.tab === st.tab));
    $("#kop-titel").textContent = st.les.titel || (st.nieuw ? "Nieuwe les" : "Les bewerken");
    if (st.tab === "gegevens") inhoud.innerHTML = tabGegevens();
    if (st.tab === "schermen") { inhoud.innerHTML = tabSchermen(); tekenVoorbeeld(); }
    if (st.tab === "voorbereiding") inhoud.innerHTML = tabVoorbereiding();
  }

  // ---------- Tab: gegevens ----------
  const veld = (label, html, uitleg = "") =>
    `<label class="veld"><span class="veld-label">${label}</span>${html}${uitleg ? `<span class="veld-uitleg">${uitleg}</span>` : ""}</label>`;
  const invoer = (sleutel, waarde, extra = "") => `<input data-les-veld="${sleutel}" value="${esc(waarde ?? "")}" ${extra}>`;

  function tabGegevens() {
    const l = st.les;
    return `<section class="paneel smal">
      <h2>Over deze les</h2>
      ${veld("Titel *", invoer("titel", l.titel, 'placeholder="Bijvoorbeeld: Breuken vergelijken"'))}
      <div class="veld-rij">
        ${veld("Groep *", invoer("groep", l.groep, 'placeholder="6"'), "Bijvoorbeeld 6, 7/8 of Bovenbouw")}
        ${veld("Vak *", invoer("vak", l.vak, 'placeholder="Rekenen" list="vakken"'))}
        ${veld("Duur (minuten)", invoer("duur", l.duur, 'type="number" min="1" max="300"'))}
      </div>
      <datalist id="vakken">${["Rekenen", "Taal", "Spelling", "Lezen", "Begrijpend lezen", "Wereldoriëntatie", "Engels", "Kanjer", "Muziek", "Overig"].map((v) => `<option value="${v}">`).join("")}</datalist>
      <div class="veld-rij">
        ${veld("Methode / blok", invoer("blok", l.blok, 'placeholder="Blok 3, les 2"'))}
        ${veld("Onderwerp", invoer("onderwerp", l.onderwerp, 'placeholder="Breuken"'))}
      </div>
      ${veld("Lesdoel", `<textarea data-les-veld="lesdoel" rows="2" placeholder="Ik kan …">${esc(l.lesdoel || "")}</textarea>`)}
      <label class="vink"><input type="checkbox" data-les-veld="lesdoelInHoek" ${l.lesdoelInHoek ? "checked" : ""}> Lesdoel klein in de hoek van elk scherm</label>
      <label class="vink"><input type="checkbox" data-les-veld="edi" ${l.edi ? "checked" : ""}> Deze les is in EDI-vorm</label>
      ${veld("Korte samenvatting", `<textarea data-les-veld="samenvatting" rows="2" placeholder="Eén zin voor het overzicht">${esc(l.samenvatting || "")}</textarea>`)}
      ${veld("Zoekwoorden", invoer("trefwoorden", (l.trefwoorden || []).join(", "), 'placeholder="breuken, vergelijken, kommagetallen"'), "Gescheiden door komma's")}
      ${st.nieuw ? "" : `<div class="gevaar"><button class="knop rood" data-actie="les-weg">Deze les verwijderen</button></div>`}
    </section>`;
  }

  // ---------- Tab: schermen ----------
  const schermNaam = (s, i) => {
    const kop = (s.blokken || []).find((b) => b.tekst);
    const naam = kop?.tekst || s.fase || ((s.blokken || []).length ? "Scherm" : "Leeg scherm");
    return `${i + 1}. ${esc(naam.replace(/[*=]/g, "").replace(/\n/g, " ").slice(0, 40))}`;
  };

  function tabSchermen() {
    const l = st.les, s = l.schermen[st.gekozen];
    const lijst = l.schermen.map((x, i) => `
      <button class="scherm-item" data-actie="scherm-kies" data-i="${i}" aria-current="${i === st.gekozen}">
        <span>${schermNaam(x, i)}</span>${x.fase ? `<small>${esc(x.fase)}</small>` : ""}
      </button>`).join("");
    return `<div class="schermen-raster">
      <aside class="paneel schermen-lijst">
        <h2>Schermen</h2>
        ${lijst}
        <button class="knop vol" data-actie="scherm-nieuw">+ Nieuw scherm</button>
      </aside>
      <section class="scherm-werk">
        <div class="voorbeeld-balk">
          <span>Voorbeeld scherm ${st.gekozen + 1} van ${l.schermen.length}</span>
          <span class="knoppen-rij">
            <button class="knop klein" data-actie="scherm-omhoog" ${st.gekozen === 0 ? "disabled" : ""} title="Naar voren">↑</button>
            <button class="knop klein" data-actie="scherm-omlaag" ${st.gekozen === l.schermen.length - 1 ? "disabled" : ""} title="Naar achteren">↓</button>
            <button class="knop klein" data-actie="scherm-dupliceer">Kopiëren</button>
            <button class="knop klein rood" data-actie="scherm-weg" ${l.schermen.length === 1 ? "disabled" : ""}>Verwijderen</button>
          </span>
        </div>
        <div class="voorbeeld" id="voorbeeld"><div class="dia" id="voorbeeld-dia"></div></div>
        <p class="veld-uitleg">Gestippelde delen zijn op het bord eerst verborgen en verschijnen als je ze aantikt.</p>

        <div class="paneel">
          <h2>Dit scherm</h2>
          <div class="veld-rij">
            ${veld("Lesfase (alleen voor jou)", `<input data-scherm-veld="fase" value="${esc(s.fase || "")}" placeholder="Bijvoorbeeld: Begeleide inoefening">`)}
            ${veld("Achtergrond", `<select data-scherm-veld="achtergrond">${["leeg", "ruitjes", "lijntjes"].map((a) => `<option value="${a}" ${(s.achtergrond || "leeg") === a ? "selected" : ""}>${a === "leeg" ? "Wit" : a[0].toUpperCase() + a.slice(1)}</option>`).join("")}</select>`)}
          </div>
          <label class="vink"><input type="checkbox" data-scherm-veld="uitlijning" ${s.uitlijning === "midden" ? "checked" : ""}> Inhoud in het midden van het scherm</label>
          ${l.lesdoelInHoek ? `<label class="vink"><input type="checkbox" data-scherm-veld="lesdoelVerbergen" ${s.lesdoelVerbergen ? "checked" : ""}> Lesdoel op dit scherm niet tonen</label>` : ""}
          ${veld("Notitie voor de leerkracht", `<textarea data-scherm-veld="notitie" rows="2" placeholder="Wat wil je hier zeggen of doen? (niet zichtbaar voor de klas)">${esc(s.notitie || "")}</textarea>`)}
        </div>

        <div class="paneel">
          <h2>Op het scherm</h2>
          <div id="blokken">${(s.blokken || []).map(blokEditor).join("") || '<p class="veld-uitleg">Nog leeg. Voeg hieronder iets toe.</p>'}</div>
          <div class="toevoegen">
            <select id="nieuw-blok">${BLOKTYPES.map(([t, n]) => `<option value="${t}">${n}</option>`).join("")}</select>
            <button class="knop" data-actie="blok-toevoegen">+ Toevoegen</button>
          </div>
        </div>
      </section>
    </div>`;
  }

  function blokEditor(b, i) {
    const n = (s.blokken || []).length;
    const kop = `<div class="blok-kop">
        <b>${esc(NAAM[b.type] || `Blok '${b.type}'`)}</b>
        <span class="knoppen-rij">
          <button class="knop klein" data-actie="blok-omhoog" data-i="${i}" ${i === 0 ? "disabled" : ""} title="Omhoog">↑</button>
          <button class="knop klein" data-actie="blok-omlaag" data-i="${i}" ${i === n - 1 ? "disabled" : ""} title="Omlaag">↓</button>
          <button class="knop klein rood" data-actie="blok-weg" data-i="${i}" title="Verwijderen">✕</button>
        </span>
      </div>`;
    const d = `data-blok="${i}"`;
    const verborgen = `<label class="vink"><input type="checkbox" ${d} data-veld="verborgen" ${b.verborgen ? "checked" : ""}> Eerst verborgen (tik om te tonen)</label>`;
    let velden;
    if (TEKSTTYPES.includes(b.type)) {
      velden = `<textarea ${d} data-veld="tekst" rows="${b.type === "tekst" ? 3 : 2}" placeholder="Tekst">${esc(b.tekst || "")}</textarea>
        <span class="veld-uitleg">**vet**, *schuin*, ==gemarkeerd==</span>${verborgen}`;
    } else if (b.type === "lijst" || b.type === "stappen") {
      velden = `<textarea ${d} data-veld="items" rows="4" placeholder="Eén regel per ${b.type === "lijst" ? "punt" : "stap"}">${esc((b.items || []).join("\n"))}</textarea>
        ${b.type === "lijst" ? `<label class="vink"><input type="checkbox" ${d} data-veld="genummerd" ${b.genummerd ? "checked" : ""}> Genummerd</label>` : ""}
        <label class="vink"><input type="checkbox" ${d} data-veld="stapsgewijs" ${b.stapsgewijs ? "checked" : ""}> Stap voor stap tonen (elke regel eerst verborgen)</label>`;
    } else if (b.type === "tabel") {
      velden = `<textarea ${d} data-veld="rijen" rows="4" placeholder="Eén rij per regel, cellen gescheiden door |&#10;T | E&#10;3 | 4">${esc((b.rijen || []).map((r) => r.join(" | ")).join("\n"))}</textarea>
        <label class="vink"><input type="checkbox" ${d} data-veld="kopRij" ${b.kopRij !== false ? "checked" : ""}> Eerste rij is de kop</label>${verborgen}`;
    } else if (b.type === "afbeelding") {
      velden = `<div class="afbeelding-kies">
          ${b.src ? `<span class="veld-uitleg">Bestand: ${esc(b.src)}</span>` : '<span class="veld-uitleg">Nog geen afbeelding gekozen.</span>'}
          <label class="knop klein">Afbeelding kiezen<input type="file" accept="image/*" ${d} data-veld="bestand" hidden></label>
        </div>
        ${veld("Omschrijving (voor wie de afbeelding niet ziet)", `<input ${d} data-veld="alt" value="${esc(b.alt || "")}">`)}${verborgen}`;
    } else if (b.type === "schrijfvak") {
      velden = `<input ${d} data-veld="label" value="${esc(b.label || "")}" placeholder="Tekst in de hoek van het vak (mag leeg)">${verborgen}`;
    } else {
      velden = `<span class="veld-uitleg">Dit blok is in de chat gemaakt. Je kunt het hier laten staan, verplaatsen of verwijderen. Wijzigen kan als code (voor gevorderden):</span>
        <textarea class="code" ${d} data-veld="json" rows="6" spellcheck="false">${esc(JSON.stringify(b, null, 2))}</textarea>`;
    }
    return `<div class="blok-kaart">${kop}${velden}</div>`;
  }
  let s; // het gekozen scherm, voor blokEditor
  const huidigScherm = () => (s = st.les.schermen[st.gekozen]);

  // ---------- Voorbeeld ----------
  function tekenVoorbeeld() {
    const vak = $("#voorbeeld"), dia = $("#voorbeeld-dia");
    if (!vak || !dia) return;
    const sch = structuredClone(st.les.schermen[st.gekozen]);
    for (const b of sch.blokken || []) if (b.type === "afbeelding" && st.uploads[b.src]) b.src = st.uploads[b.src].dataUrl;
    const lesmap = st.id ? `lessen/${st.id}` : "lessen";
    dia.className = Lesbord.diaKlassen(sch, st.les.thema);
    let html = Lesbord.diaHtml(sch, lesmap);
    if (st.les.lesdoel && st.les.lesdoelInHoek && !sch.lesdoelVerbergen)
      html += `<div class="lesdoel-hoek"><b>Lesdoel</b>${Lesbord.opmaak(st.les.lesdoel)}</div>`;
    dia.innerHTML = html;
    vak.classList.toggle(`thema-${st.les.thema}`, !!st.les.thema);
    const schaal = vak.clientWidth / 1600;
    vak.style.height = 900 * schaal + "px";
    dia.style.transform = `scale(${schaal})`;
  }
  window.addEventListener("resize", tekenVoorbeeld);
  let wacht;
  const straks = () => { clearTimeout(wacht); wacht = setTimeout(tekenVoorbeeld, 150); };

  // ---------- Tab: voorbereiding ----------
  function tabVoorbereiding() {
    const v = st.les.voorbereiding || (st.les.voorbereiding = {});
    const verloop = v.verloop || [];
    const secties = v.secties || [];
    return `<section class="paneel smal">
      <h2>Voorbereidingsformulier</h2>
      <p class="veld-uitleg">Dit komt in de PDF bij de les. Lege onderdelen worden weggelaten.</p>
      ${veld("Benodigdheden", `<textarea data-voorbereiding="benodigdheden" rows="3" placeholder="Eén per regel, bijvoorbeeld: wisbordjes">${esc((v.benodigdheden || []).join("\n"))}</textarea>`)}

      <h3>Verloop</h3>
      <div class="verloop-bewerk">
        ${verloop.length ? `<div class="verloop-kop"><span>Tijd</span><span>Lesfase</span><span>Wat er gebeurt</span><span></span></div>` : ""}
        ${verloop.map((r, i) => `<div class="verloop-rij">
          <input data-verloop="${i}" data-veld="tijd" value="${esc(r.tijd || "")}" placeholder="0–5 min">
          <input data-verloop="${i}" data-veld="fase" value="${esc(r.fase || "")}" placeholder="(mag leeg)">
          <textarea data-verloop="${i}" data-veld="wat" rows="2" placeholder="Wat er gebeurt">${esc(r.wat || "")}</textarea>
          <span class="knoppen-rij">
            <button class="knop klein" data-actie="verloop-omhoog" data-i="${i}" ${i === 0 ? "disabled" : ""}>↑</button>
            <button class="knop klein rood" data-actie="verloop-weg" data-i="${i}">✕</button>
          </span>
        </div>`).join("")}
      </div>
      <button class="knop" data-actie="verloop-nieuw">+ Rij toevoegen</button>

      <h3>Extra onderdelen</h3>
      ${secties.map((x, i) => `<div class="blok-kaart">
        <div class="blok-kop"><input data-sectie="${i}" data-veld="kop" value="${esc(x.kop || "")}" placeholder="Kop, bijvoorbeeld: Aandachtspunten">
          <button class="knop klein rood" data-actie="sectie-weg" data-i="${i}">✕</button></div>
        <textarea data-sectie="${i}" data-veld="inhoud" rows="3">${esc(x.items ? x.items.join("\n") : x.tekst || "")}</textarea>
        <label class="vink"><input type="checkbox" data-sectie="${i}" data-veld="lijst" ${x.items ? "checked" : ""}> Als opsomming (één punt per regel)</label>
      </div>`).join("")}
      <button class="knop" data-actie="sectie-nieuw">+ Onderdeel toevoegen</button>
    </section>`;
  }

  // ---------- Invoer verwerken ----------
  const regels = (t) => t.split("\n").map((x) => x.trim()).filter(Boolean);
  const zet = (obj, k, w) => { if (w === "" || w === false || w == null || (Array.isArray(w) && !w.length)) delete obj[k]; else obj[k] = w; };

  inhoud.addEventListener("input", (e) => {
    const el = e.target, l = st.les, d = el.dataset;
    const waarde = el.type === "checkbox" ? el.checked : el.value;
    if (d.lesVeld) {
      const k = d.lesVeld;
      if (k === "trefwoorden") zet(l, k, waarde.split(",").map((x) => x.trim()).filter(Boolean));
      else if (k === "duur") zet(l, k, waarde ? Number(waarde) : "");
      else if (k === "titel" || k === "groep" || k === "vak") l[k] = waarde;
      else zet(l, k, typeof waarde === "string" ? waarde.trim() && waarde : waarde);
      if (k === "titel") $("#kop-titel").textContent = waarde || "Nieuwe les";
    } else if (d.schermVeld) {
      const sch = l.schermen[st.gekozen], k = d.schermVeld;
      if (k === "uitlijning") zet(sch, k, waarde ? "midden" : "");
      else if (k === "achtergrond") zet(sch, k, waarde === "leeg" ? "" : waarde);
      else zet(sch, k, waarde);
      if (k === "fase") document.querySelectorAll(".scherm-item")[st.gekozen].innerHTML =
        `<span>${schermNaam(sch, st.gekozen)}</span>${sch.fase ? `<small>${esc(sch.fase)}</small>` : ""}`;
      straks();
    } else if (d.blok !== undefined) {
      const sch = l.schermen[st.gekozen], i = Number(d.blok), b = sch.blokken[i], k = d.veld;
      if (k === "bestand") return; // via change
      if (k === "json") {
        try { const nieuw = JSON.parse(waarde); if (!nieuw.type) throw 0; sch.blokken[i] = nieuw; el.classList.remove("fout"); }
        catch { el.classList.add("fout"); return; }
      } else if (k === "items") zet(b, k, regels(waarde));
      else if (k === "rijen") zet(b, k, regels(waarde).map((r) => r.split("|").map((c) => c.trim())));
      else if (k === "kopRij") { if (waarde) delete b.kopRij; else b.kopRij = false; }
      else if (k === "tekst") b.tekst = waarde;
      else zet(b, k, waarde);
      if (k === "tekst" && i === sch.blokken.findIndex((x) => x.tekst !== undefined))
        document.querySelectorAll(".scherm-item span")[st.gekozen].innerHTML = schermNaam(sch, st.gekozen);
      straks();
    } else if (d.voorbereiding) {
      zet(l.voorbereiding, d.voorbereiding, regels(waarde));
    } else if (d.verloop !== undefined) {
      const r = l.voorbereiding.verloop[Number(d.verloop)];
      zet(r, d.veld, waarde);
    } else if (d.sectie !== undefined) {
      const x = l.voorbereiding.secties[Number(d.sectie)];
      if (d.veld === "kop") x.kop = waarde;
      else {
        const lijst = d.veld === "lijst" ? waarde : !!x.items;
        const tekst = d.veld === "inhoud" ? waarde : (x.items ? x.items.join("\n") : x.tekst || "");
        delete x.items; delete x.tekst;
        if (lijst) x.items = regels(tekst); else x.tekst = tekst;
      }
    } else return;
    vuil();
  });

  // Afbeelding kiezen: verkleinen tot max. 1600 px breed en bewaren tot het opslaan.
  inhoud.addEventListener("change", async (e) => {
    const el = e.target;
    if (el.dataset.veld !== "bestand" || !el.files?.[0]) return;
    const bestand = el.files[0];
    const b = st.les.schermen[st.gekozen].blokken[Number(el.dataset.blok)];
    try {
      const { dataUrl, ext } = await verklein(bestand);
      const basis = bestand.name.toLowerCase().replace(/\.[a-z0-9]+$/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "afbeelding";
      let naam = `${basis}.${ext}`, n = 2;
      while (st.uploads[naam]) naam = `${basis}-${n++}.${ext}`;
      st.uploads[naam] = { dataUrl, base64: dataUrl.split(",")[1] };
      b.src = naam;
      if (!b.alt) b.alt = basis.replace(/-/g, " ");
      vuil(); teken();
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
          const max = 1600, f = Math.min(1, max / img.width);
          if (f === 1 && bestand.size < 1.5e6 && /image\/(png|jpeg)/.test(bestand.type))
            return klaar({ dataUrl: lezer.result, ext: png ? "png" : "jpg" });
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          klaar({ dataUrl: c.toDataURL(png ? "image/png" : "image/jpeg", 0.85), ext: png ? "png" : "jpg" });
        };
        img.src = lezer.result;
      };
      lezer.readAsDataURL(bestand);
    });
  }

  // ---------- Knoppen ----------
  const wissel = (lijst, a, b) => { [lijst[a], lijst[b]] = [lijst[b], lijst[a]]; };
  inhoud.addEventListener("click", async (e) => {
    const knop = e.target.closest("[data-actie]");
    if (!knop) return;
    const l = st.les, i = Number(knop.dataset.i), sch = l.schermen[st.gekozen];
    const v = l.voorbereiding || (l.voorbereiding = {});
    switch (knop.dataset.actie) {
      case "scherm-kies": st.gekozen = i; break;
      case "scherm-nieuw": l.schermen.splice(st.gekozen + 1, 0, { blokken: [{ type: "subkop", tekst: "" }] }); st.gekozen++; break;
      case "scherm-dupliceer": l.schermen.splice(st.gekozen + 1, 0, structuredClone(sch)); st.gekozen++; break;
      case "scherm-omhoog": wissel(l.schermen, st.gekozen, st.gekozen - 1); st.gekozen--; break;
      case "scherm-omlaag": wissel(l.schermen, st.gekozen, st.gekozen + 1); st.gekozen++; break;
      case "scherm-weg":
        if (!confirm(`Scherm ${st.gekozen + 1} verwijderen?`)) return;
        l.schermen.splice(st.gekozen, 1); st.gekozen = Math.max(0, st.gekozen - 1); break;
      case "blok-toevoegen": {
        const type = $("#nieuw-blok").value;
        const b = { type };
        if (TEKSTTYPES.includes(type)) b.tekst = "";
        if (type === "lijst" || type === "stappen") { b.items = []; b.stapsgewijs = true; }
        (sch.blokken ||= []).push(b); break;
      }
      case "blok-omhoog": wissel(sch.blokken, i, i - 1); break;
      case "blok-omlaag": wissel(sch.blokken, i, i + 1); break;
      case "blok-weg": sch.blokken.splice(i, 1); break;
      case "verloop-nieuw": (v.verloop ||= []).push({ tijd: "", wat: "" }); break;
      case "verloop-omhoog": wissel(v.verloop, i, i - 1); break;
      case "verloop-weg": v.verloop.splice(i, 1); break;
      case "sectie-nieuw": (v.secties ||= []).push({ kop: "", tekst: "" }); break;
      case "sectie-weg": v.secties.splice(i, 1); break;
      case "les-weg": return verwijder();
      default: return;
    }
    if (knop.dataset.actie !== "scherm-kies") vuil();
    huidigScherm(); teken();
  });

  async function verwijder() {
    if (!confirm(`"${st.les.titel}" verwijderen?\n\nDe les verdwijnt uit het overzicht. In GitHub is hij later nog terug te halen.`)) return;
    try {
      status("Verwijderen…");
      await GitHub.verwijderMap(`lessen/${st.id}`, `Les verwijderd: ${st.les.titel} (via de app)`);
      GitHub.onthoudVerwijderd(st.id);
      st.vuil = false;
      location.href = "./";
    } catch (err) { status(err.message, "fout"); }
  }

  // ---------- Opslaan ----------
  const slug = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");

  function schoon(obj) {
    // lege velden en tijdelijke dingen weghalen
    const les = structuredClone(obj);
    for (const k of Object.keys(les)) if (les[k] === "" || les[k] == null) delete les[k];
    const v = les.voorbereiding || {};
    if (v.verloop) v.verloop = v.verloop.filter((r) => (r.wat || "").trim() || (r.tijd || "").trim());
    if (v.secties) v.secties = v.secties.filter((x) => (x.kop || "").trim());
    for (const k of Object.keys(v)) if (Array.isArray(v[k]) && !v[k].length) delete v[k];
    if (!Object.keys(v).length) delete les.voorbereiding;
    return les;
  }

  async function opslaan() {
    const l = st.les;
    const mist = ["titel", "groep", "vak"].filter((k) => !String(l[k] || "").trim());
    if (mist.length) { st.tab = "gegevens"; teken(); return status(`Vul eerst in: ${mist.join(", ")}`, "fout"); }
    const knop = $("#knop-opslaan");
    knop.disabled = true; status("Opslaan…");
    try {
      const les = schoon(l);
      les.titel = les.titel.trim(); les.groep = String(les.groep).trim(); les.vak = les.vak.trim();
      let id = st.id;
      if (st.nieuw) {
        const basis = slug(`${/^\d/.test(les.groep) ? "g" + les.groep : les.groep}-${les.vak}-${les.titel}`) || "les";
        id = basis;
        for (let n = 2; await GitHub.leesBestand(`lessen/${id}/les.json`); n++) id = `${basis}-${n}`;
        les.gemaakt = new Date().toISOString().slice(0, 10);
      }
      les.id = id;
      const rest = Object.fromEntries(Object.entries(les).filter(([k]) => k !== "id"));
      const opTeSlaan = { id, ...rest };
      for (const [naam, u] of Object.entries(st.uploads))
        await GitHub.schrijfBestand(`lessen/${id}/${naam}`, u.base64, `Afbeelding voor ${les.titel} (via de app)`);
      await GitHub.schrijfTekst(`lessen/${id}/les.json`, JSON.stringify(opTeSlaan, null, 2) + "\n",
        `${st.nieuw ? "Nieuwe les" : "Les aangepast"}: ${les.titel} (via de app)`);
      GitHub.onthoudOpgeslagen(opTeSlaan);
      st.les = opTeSlaan; st.id = id; st.nieuw = false; st.uploads = {}; st.vuil = false;
      history.replaceState(null, "", `bewerk.html?id=${id}`);
      const bekijk = $("#knop-bekijk"); bekijk.hidden = false; bekijk.href = `les.html?id=${id}`;
      status("Opgeslagen ✓ Over een paar minuten staat hij online, met nieuwe PDF's.", "goed");
      huidigScherm(); teken();
    } catch (err) {
      knop.disabled = false; status(err.message || "Opslaan mislukt.", "fout");
    }
  }
  $("#knop-opslaan").onclick = opslaan;
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (st.vuil) opslaan(); }
  });

  // ---------- Start ----------
  async function start() {
    if (!GitHub.heeftSleutel()) {
      document.querySelector(".tabs").hidden = true;
      inhoud.innerHTML = `<section class="paneel smal"><h2>Eerst je sleutel invullen</h2>
        <p>Om lessen te maken, aan te passen of te verwijderen heeft dit apparaat eenmalig je persoonlijke GitHub-sleutel nodig.</p>
        <a class="knop hoofd" href="sleutel.html?terug=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}">Sleutel invullen</a></section>`;
      return;
    }
    try {
      if (st.nieuw) st.les = nieuweLes();
      else {
        const bestand = await GitHub.leesBestand(`lessen/${st.id}/les.json`);
        if (!bestand) throw new Error("Deze les bestaat niet (meer).");
        st.les = JSON.parse(bestand.inhoud);
        const bekijk = $("#knop-bekijk"); bekijk.hidden = false; bekijk.href = `les.html?id=${st.id}`;
      }
      if (!st.les.schermen?.length) st.les.schermen = [{ blokken: [] }];
      st.les.voorbereiding ||= {};
      if (st.nieuw) status("Nieuwe les, nog niet opgeslagen");
      huidigScherm(); teken();
    } catch (err) {
      inhoud.innerHTML = `<div class="leeg">${esc(err.message || "Laden mislukt.")}</div>`;
    }
  }
  start();
})();
