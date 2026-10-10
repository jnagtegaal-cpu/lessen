// Lesbord — scorebord voor quizzen en spellen.
// Aan te zetten per les met "scorebord" in les.json (zie LESFORMAAT.md).
// De stand staat alleen in de browser van het apparaat waarmee je presenteert.
const Score = (() => {
  const $ = (id) => document.getElementById(id);
  const esc = Lesbord.esc;
  let st = null, sleutel = "", naWijziging = () => {}, naLayout = () => {}, nulWacht = null;

  const standaardNamen = (cfg) => {
    if (Array.isArray(cfg.teams)) return cfg.teams.map(String);
    const n = Math.max(2, Math.min(8, Number(cfg.teams) || 3));
    return Array.from({ length: n }, (_, i) => `Team ${i + 1}`);
  };
  const standaardNaam = (i) => `Team ${i + 1}`;

  // Opslag mag falen (privévenster, geblokkeerde opslag): het scorebord werkt dan gewoon door zonder bewaren.
  const opslaan = () => { try { localStorage.setItem(sleutel, JSON.stringify(st)); } catch (e) { /* geen opslag */ } };
  const inlezen = (n) => {
    try {
      const j = JSON.parse(localStorage.getItem(sleutel) || "null");
      if (j && Array.isArray(j.namen) && j.namen.length === n && Array.isArray(j.punten) && j.punten.length === n
          && j.punten.every(Number.isFinite)) {
        return { namen: j.namen.map(String), punten: j.punten, log: Array.isArray(j.log) ? j.log : [], ingesteld: !!j.ingesteld };
      }
    } catch (e) { /* kapotte opslag: begin opnieuw */ }
    return null;
  };

  const kruis = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function tekenBalk() {
    const top = Math.max(...st.punten);
    $("score-teams").innerHTML = st.namen.map((n, i) =>
      `<div class="score-team${top > 0 && st.punten[i] === top ? " kop" : ""}">` +
      `<span class="score-naam">${esc(n)}</span><span class="score-punten">${st.punten[i]}</span></div>`).join("");
    document.querySelectorAll("[data-pt]").forEach((el) => { el.textContent = st.punten[el.dataset.pt]; });
    document.querySelectorAll("[data-label]").forEach((el) => { el.textContent = st.namen[el.dataset.label]; });
  }

  function paneelBouwen() {
    $("scorepaneel").innerHTML = `
      <div class="score-kop"><h3>Punten</h3><button class="ikoon-knop" id="score-sluit" aria-label="Sluiten">${kruis}</button></div>
      <section><h4>Teamnamen</h4>
        <div class="score-namen">${st.namen.map((n, i) =>
          `<input type="text" data-naam="${i}" value="${esc(n)}" maxlength="24" aria-label="Naam van team ${i + 1}">`).join("")}</div>
      </section>
      <section><h4>Wie had het goed?</h4>
        <div class="score-keuze">${st.namen.map((n, i) =>
          `<label class="score-vink"><input type="checkbox" data-vink="${i}"><span data-label="${i}">${esc(n)}</span></label>`).join("")}</div>
        <div class="score-actie">
          <label>Punten per team <select id="score-aantal"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
          <button class="knop hoofd" id="score-tel">Optellen</button>
          <button class="knop" id="score-terug">Laatste ongedaan maken</button>
        </div>
        <p class="score-melding" id="score-melding" aria-live="polite"></p>
      </section>
      <section><h4>Corrigeren</h4>
        <div class="score-corr">${st.namen.map((n, i) =>
          `<div class="score-corr-rij"><span data-label="${i}">${esc(n)}</span>` +
          `<button class="knop" data-corr="${i}" data-delta="-1" aria-label="Eén punt eraf">−</button><b data-pt="${i}">${st.punten[i]}</b>` +
          `<button class="knop" data-corr="${i}" data-delta="1" aria-label="Eén punt erbij">+</button></div>`).join("")}</div>
      </section>
      <section class="score-voet"><button class="knop" id="score-nul">Alles op nul</button></section>`;
  }

  const melding = (t) => { $("score-melding").textContent = t; };
  const na = () => { opslaan(); tekenBalk(); naWijziging(); };

  function tel() {
    const gekozen = [...document.querySelectorAll("[data-vink]")].filter((c) => c.checked).map((c) => Number(c.dataset.vink));
    if (!gekozen.length) { melding("Vink eerst minstens één team aan."); return; }
    const n = Number($("score-aantal").value) || 1;
    gekozen.forEach((i) => { st.punten[i] += n; });
    st.log.push({ teams: gekozen, n });
    if (st.log.length > 100) st.log.shift();
    document.querySelectorAll("[data-vink]").forEach((c) => { c.checked = false; });
    melding(`+${n} voor ${gekozen.map((i) => st.namen[i]).join(", ")}`);
    na();
  }
  function terug() {
    const laatste = st.log.pop();
    if (!laatste) { melding("Er is niets om ongedaan te maken."); return; }
    laatste.teams.forEach((i) => { st.punten[i] -= laatste.n; });
    melding(`Teruggedraaid: −${laatste.n} voor ${laatste.teams.map((i) => st.namen[i]).join(", ")}`);
    na();
  }
  function nul(knop) {
    if (!nulWacht) {
      knop.textContent = "Zeker weten?";
      nulWacht = setTimeout(() => { nulWacht = null; knop.textContent = "Alles op nul"; }, 3000);
      return;
    }
    clearTimeout(nulWacht); nulWacht = null; knop.textContent = "Alles op nul";
    st.punten = st.punten.map(() => 0); st.log = [];
    melding("Alle punten staan weer op nul.");
    na();
  }

  function open() {
    $("scorepaneel").hidden = false;
    $("score-open").setAttribute("aria-expanded", "true");
    const eerste = $("scorepaneel").querySelector("input[data-naam]");
    if (eerste && !st.ingesteld) eerste.focus();
  }
  function sluit() {
    $("scorepaneel").hidden = true;
    $("score-open").setAttribute("aria-expanded", "false");
    if (!st.ingesteld) { st.ingesteld = true; opslaan(); }
    $("score-open").focus();
  }

  function koppel() {
    const p = $("scorepaneel");
    p.addEventListener("keydown", (e) => { // pijltjes en spatie mogen het bord niet verder laten gaan
      e.stopPropagation();
      if (e.key === "Escape") sluit();
    });
    p.addEventListener("input", (e) => {
      const i = e.target.dataset.naam;
      if (i === undefined) return;
      st.namen[i] = e.target.value.trim() || standaardNaam(Number(i));
      st.ingesteld = true;
      na();
    });
    p.addEventListener("click", (e) => {
      const k = e.target.closest("button");
      if (!k) return;
      if (k.id === "score-sluit") sluit();
      else if (k.id === "score-tel") tel();
      else if (k.id === "score-terug") terug();
      else if (k.id === "score-nul") nul(k);
      else if (k.dataset.corr !== undefined) {
        st.punten[Number(k.dataset.corr)] += Number(k.dataset.delta);
        st.log = []; // na een handmatige correctie klopt "laatste ongedaan maken" niet meer
        na();
      }
    });
  }

  // De eindstand-blokken op een dia (type "eindstand") vullen met de ranglijst.
  function vulEindstand(root) {
    root.querySelectorAll("[data-eindstand]").forEach((el) => {
      if (!st) { el.innerHTML = ""; return; }
      const rij = st.namen.map((n, i) => ({ n, p: st.punten[i] })).sort((a, b) => b.p - a.p);
      let plaats = 0, vorige = null;
      el.innerHTML = rij.map((r, i) => {
        if (r.p !== vorige) { plaats = i + 1; vorige = r.p; }
        return `<div class="eind-rij plaats-${plaats}"><span class="eind-plaats">${plaats}</span>` +
          `<span class="eind-naam">${esc(r.n)}</span><span class="eind-punten">${r.p}</span></div>`;
      }).join("");
    });
  }

  function init(les, id, wijzig, layout) {
    if (!les.scorebord) return;
    const cfg = les.scorebord === true ? {} : les.scorebord;
    naWijziging = wijzig || naWijziging; naLayout = layout || naLayout;
    sleutel = `lesbord-score-${id}`;
    const namen = standaardNamen(cfg);
    st = inlezen(namen.length) || { namen, punten: namen.map(() => 0), log: [], ingesteld: false };
    $("scorebalk").hidden = false;
    paneelBouwen(); koppel(); tekenBalk();
    $("score-open").onclick = () => ($("scorepaneel").hidden ? open() : sluit());
    if (!st.ingesteld) open(); // de eerste keer: meteen de teamnamen laten typen
    naLayout();
  }

  return { init, vulEindstand };
})();
