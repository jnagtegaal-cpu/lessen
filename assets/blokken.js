// Lesbord — gedeelde functies: lessen laden en dia-blokken tekenen.
// Een dia bestaat uit "blokken". Zie LESFORMAAT.md voor alle bloktypes.

const Lesbord = (() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Eenvoudige opmaak in tekst: **vet**, *schuin*, ==markeren==
  const opmaak = (s) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/==(.+?)==/g, '<mark style="background:#d6f2e1;padding:0 .15em;border-radius:.2em">$1</mark>')
      .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
      .replace(/\n/g, "<br>");

  const blok = (b, lesmap) => {
    const html = blokInhoud(b, lesmap);
    return b.verborgen ? `<div class="onthul onthul-blok">${html}</div>` : html;
  };

  const blokInhoud = (b, lesmap) => {
    const stijl = b.stijl ? ` style="${esc(b.stijl)}"` : "";
    switch (b.type) {
      case "kop": return `<h1 class="b-kop"${stijl}>${opmaak(b.tekst)}</h1>`;
      case "subkop": return `<h2 class="b-subkop"${stijl}>${opmaak(b.tekst)}</h2>`;
      case "tekst": return `<p class="b-tekst"${stijl}>${opmaak(b.tekst)}</p>`;
      case "klein": return `<p class="b-klein"${stijl}>${opmaak(b.tekst)}</p>`;
      case "vraag": return `<p class="b-vraag"${stijl}>${opmaak(b.tekst)}</p>`;
      case "groot": return `<p class="b-groot"${stijl}>${opmaak(b.tekst)}</p>`;
      case "fase": return `<span class="b-fase-tag"${stijl}>${esc(b.tekst)}</span>`;
      case "lijst": {
        const tag = b.genummerd ? "ol" : "ul";
        const li = b.stapsgewijs ? '<li class="onthul">' : "<li>";
        return `<${tag} class="b-lijst"${stijl}>${(b.items || []).map((i) => `${li}<span>${opmaak(i)}</span></li>`).join("")}</${tag}>`;
      }
      case "stappen":
        return `<ol class="b-stappen"${stijl}>${(b.items || []).map((i) => `<li${b.stapsgewijs ? ' class="onthul"' : ""}><span>${opmaak(i)}</span></li>`).join("")}</ol>`;
      case "afbeelding": {
        const src = /^(https?:|data:|\/)/.test(b.src) ? b.src : `${lesmap}/${b.src}`;
        return `<img class="b-afbeelding" src="${esc(src)}" alt="${esc(b.alt || "")}"${stijl}>`;
      }
      case "tabel": {
        const [kop, ...rijen] = b.rijen || [];
        const th = b.kopRij !== false && kop ? `<tr>${kop.map((c) => `<th>${opmaak(c)}</th>`).join("")}</tr>` : "";
        const body = (b.kopRij !== false ? rijen : b.rijen || []).map((r) => `<tr>${r.map((c) => `<td>${opmaak(c)}</td>`).join("")}</tr>`).join("");
        return `<table class="b-tabel"${stijl}>${th}${body}</table>`;
      }
      case "schrijfvak":
        return `<div class="b-schrijfvak"${stijl}>${b.label ? `<div class="b-schrijfvak-label">${esc(b.label)}</div>` : ""}</div>`;
      case "kolommen": {
        const kol = b.kolommen || [];
        const breedtes = b.verhouding || kol.map(() => "1fr");
        return `<div class="b-kolommen" style="grid-template-columns:${breedtes.join(" ")}">${kol
          .map((k) => `<div class="b-kolom">${(k || []).map((x) => blok(x, lesmap)).join("")}</div>`)
          .join("")}</div>`;
      }
      case "stellingen": {
        // Quizkaart: drie stellingen (A, B, C) met een verborgen antwoord. Items: { titel, onzin?: true }.
        const items = b.items || [];
        const kaarten = items.map((it, i) => {
          const o = it.onzin ? "onzin" : "feit";
          return `<div class="stelling ${o}"><span class="stelling-letter">${String.fromCharCode(65 + i)}</span>` +
            `<span class="stelling-titel">${opmaak(it.titel)}</span>` +
            `<span class="stempel ${o}">${it.onzin ? "Onzin" : "Feit"}</span></div>`;
        }).join("");
        const antwoord = b.antwoord ? `<div class="onthul antwoord-trigger b-antwoord"><span>${opmaak(b.antwoord)}</span></div>` : "";
        return `<div class="b-stellingen"${stijl}>${kaarten}${antwoord}</div>`;
      }
      case "smaken": return `<div class="b-smaken"${stijl}>${(b.items || []).map((s) => `<span>${opmaak(s)}</span>`).join("")}</div>`;
      case "eindstand": return `<div class="b-eindstand" data-eindstand${stijl}></div>`; // wordt op het bord gevuld door score.js
      case "html": return b.html || ""; // maatwerk per les
      default: return `<p class="b-klein">[onbekend bloktype: ${esc(b.type)}]</p>`;
    }
  };

  const diaHtml = (scherm, lesmap) =>
    (scherm.blokken || []).map((b) => blok(b, lesmap)).join("") +
    (scherm.grap ? `<div class="grap">${opmaak(scherm.grap)}</div>` : ""); // grapje op een briefje in de hoek

  const diaKlassen = (scherm, thema) => {
    const k = ["dia"];
    if (/^[a-z-]+$/.test(thema || "")) k.push(`thema-${thema}`);
    if (scherm.achtergrond && scherm.achtergrond !== "leeg") k.push(`achtergrond-${scherm.achtergrond}`);
    if (scherm.uitlijning === "midden") k.push("b-titeldia");
    return k.join(" ");
  };

  const laadCatalogus = async () => {
    const r = await fetch("lessen/catalogus.json", { cache: "no-store" });
    if (!r.ok) throw new Error("Catalogus niet gevonden");
    return r.json();
  };

  const laadLes = async (id) => {
    if (!/^[a-z0-9-]+$/.test(id || "")) throw new Error("Ongeldige les");
    const r = await fetch(`lessen/${id}/les.json`, { cache: "no-store" });
    if (!r.ok) throw new Error("Les niet gevonden");
    return r.json();
  };

  const param = (naam) => new URLSearchParams(location.search).get(naam);

  return { esc, opmaak, diaHtml, diaKlassen, laadCatalogus, laadLes, param };
})();
