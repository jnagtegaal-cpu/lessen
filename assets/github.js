// Lesbord — opslaan en verwijderen in GitHub, rechtstreeks vanuit de browser.
// Werkt alleen met een persoonlijke sleutel (fine-grained token) die op dit apparaat is ingevuld.
const GitHub = (() => {
  const EIGENAAR = "jnagtegaal-cpu", REPO = "lessen", TAK = "main";
  const API = `https://api.github.com/repos/${EIGENAAR}/${REPO}`;
  const SLEUTEL_OPSLAG = "lesbord-github-sleutel";

  const sleutel = () => { try { return localStorage.getItem(SLEUTEL_OPSLAG) || ""; } catch { return ""; } };
  const zetSleutel = (s) => { try { s ? localStorage.setItem(SLEUTEL_OPSLAG, s.trim()) : localStorage.removeItem(SLEUTEL_OPSLAG); } catch {} };
  const heeftSleutel = () => !!sleutel();

  async function vraag(pad, opties = {}) {
    const r = await fetch(API + pad, {
      ...opties,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${sleutel()}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(opties.body ? { "Content-Type": "application/json" } : {}),
      },
      cache: "no-store",
    });
    if (r.status === 401) throw new Error("De sleutel klopt niet of is verlopen. Vul hem opnieuw in.");
    if (r.status === 403) throw new Error("De sleutel mag niet schrijven in 'lessen'. Geef hem schrijfrechten voor 'Contents'.");
    if (!r.ok && r.status !== 404) throw new Error(`GitHub gaf een fout (${r.status}).`);
    return r;
  }

  // Tekst <-> base64 met goede ondersteuning voor é, ë, → enzovoort.
  const naarBase64 = (tekst) => {
    const bytes = new TextEncoder().encode(tekst);
    let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  const vanBase64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, "")), (c) => c.charCodeAt(0)));

  async function test() {
    const r = await vraag("");
    if (r.status === 404) throw new Error("Repository 'lessen' niet gevonden met deze sleutel.");
    const info = await r.json();
    if (!info.permissions?.push) throw new Error("Deze sleutel mag alleen lezen. Geef hem schrijfrechten voor 'Contents'.");
    return true;
  }

  // Leest de nieuwste versie (niet de website-versie, die loopt soms een minuut achter).
  async function leesBestand(pad) {
    const r = await vraag(`/contents/${pad}?ref=${TAK}`);
    if (r.status === 404) return null;
    const j = await r.json();
    return { inhoud: vanBase64(j.content), sha: j.sha };
  }

  async function schrijfBestand(pad, base64, bericht) {
    const r0 = await vraag(`/contents/${pad}?ref=${TAK}`);
    const sha = r0.status === 404 ? undefined : (await r0.json()).sha;
    const r = await vraag(`/contents/${pad}`, { method: "PUT", body: JSON.stringify({ message: bericht, content: base64, branch: TAK, sha }) });
    if (!r.ok) throw new Error(`Opslaan van ${pad} mislukt (${r.status}).`);
  }

  const schrijfTekst = (pad, tekst, bericht) => schrijfBestand(pad, naarBase64(tekst), bericht);

  // Verwijdert een hele lesmap in één keer (les.json, PDF's, afbeeldingen).
  async function verwijderMap(map, bericht) {
    const ref = await (await vraag(`/git/ref/heads/${TAK}`)).json();
    const commit = await (await vraag(`/git/commits/${ref.object.sha}`)).json();
    const boom = await (await vraag(`/git/trees/${commit.tree.sha}?recursive=1`)).json();
    const weg = boom.tree.filter((t) => t.type === "blob" && t.path.startsWith(map + "/"));
    if (!weg.length) throw new Error("Deze les staat niet (meer) in GitHub.");
    const nieuweBoom = await (await vraag("/git/trees", {
      method: "POST",
      body: JSON.stringify({ base_tree: commit.tree.sha, tree: weg.map((t) => ({ path: t.path, mode: "100644", type: "blob", sha: null })) }),
    })).json();
    const nieuweCommit = await (await vraag("/git/commits", {
      method: "POST", body: JSON.stringify({ message: bericht, tree: nieuweBoom.sha, parents: [ref.object.sha] }),
    })).json();
    const r = await vraag(`/git/refs/heads/${TAK}`, { method: "PATCH", body: JSON.stringify({ sha: nieuweCommit.sha }) });
    if (!r.ok) throw new Error("Verwijderen mislukt. Probeer het opnieuw.");
  }

  // Het overzicht op de website loopt een paar minuten achter na opslaan of verwijderen.
  // Op dit apparaat onthouden we daarom 20 minuten wat er net veranderd is.
  const RECENT = "lesbord-recent", DUUR = 20 * 60 * 1000;
  const leesRecent = () => {
    try {
      const r = JSON.parse(localStorage.getItem(RECENT) || "{}");
      for (const id of Object.keys(r)) if (Date.now() - r[id].t > DUUR) delete r[id];
      return r;
    } catch { return {}; }
  };
  const schrijfRecent = (r) => { try { localStorage.setItem(RECENT, JSON.stringify(r)); } catch {} };
  const VELDEN = ["id", "titel", "groep", "vak", "blok", "onderwerp", "duur", "edi", "samenvatting", "trefwoorden", "gemaakt", "pdfs", "bijlagen"];
  function onthoudOpgeslagen(les) {
    const r = leesRecent();
    r[les.id] = { t: Date.now(), les: Object.fromEntries(VELDEN.filter((k) => k in les).map((k) => [k, les[k]])) };
    schrijfRecent(r);
  }
  function onthoudVerwijderd(id) { const r = leesRecent(); r[id] = { t: Date.now(), weg: true }; schrijfRecent(r); }
  function pasOverzichtAan(lessen) {
    const r = leesRecent();
    let uit = lessen.filter((l) => !r[l.id]);
    for (const [id, x] of Object.entries(r)) if (!x.weg && x.les) uit.push({ ...x.les, id, nieuw: true });
    return uit;
  }

  return { sleutel, zetSleutel, heeftSleutel, test, leesBestand, schrijfTekst, schrijfBestand, verwijderMap, naarBase64,
    onthoudOpgeslagen, onthoudVerwijderd, pasOverzichtAan };
})();
