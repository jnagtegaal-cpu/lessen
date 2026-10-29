#!/usr/bin/env python3
"""Lesbord — bijwerken voor publicatie.

1. Leest alle lessen/<id>/les.json en controleert ze.
2. Schrijft lessen/catalogus.json (het overzicht op de site).
3. Maakt per les voorbereiding.pdf en presentatie.pdf.

Gebruik (vanuit de map van de repository):
    python3 tools/publiceer.py            # alle lessen
    python3 tools/publiceer.py <les-id>   # alleen PDF's van deze les opnieuw
    python3 tools/publiceer.py --catalogus  # alleen het overzicht
"""
import functools
import os
import http.server
import json
import pathlib
import re
import sys
import threading

ROOT = pathlib.Path(__file__).resolve().parent.parent
LESSEN = ROOT / "lessen"
VERPLICHT = ["id", "titel", "groep", "vak", "schermen"]


def lees_lessen():
    lessen, fouten = [], []
    for f in sorted(LESSEN.glob("*/les.json")):
        try:
            les = json.loads(f.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            fouten.append(f"{f}: geen geldige JSON ({e})")
            continue
        mist = [k for k in VERPLICHT if not les.get(k)]
        if mist:
            fouten.append(f"{f}: mist {', '.join(mist)}")
        if les.get("id") != f.parent.name:
            fouten.append(f"{f}: id '{les.get('id')}' moet gelijk zijn aan de mapnaam '{f.parent.name}'")
        if not re.fullmatch(r"[a-z0-9-]+", f.parent.name):
            fouten.append(f"{f}: mapnaam alleen kleine letters, cijfers en streepjes")
        lessen.append(les)
    return lessen, fouten


def schrijf_catalogus(lessen):
    velden = ["id", "titel", "groep", "vak", "blok", "onderwerp", "duur", "edi", "samenvatting", "trefwoorden", "gemaakt", "pdfs", "bijlagen"]
    cat = {"lessen": [{k: les[k] for k in velden if k in les} for les in lessen]}
    (LESSEN / "catalogus.json").write_text(json.dumps(cat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


class StilleHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def maak_pdfs(ids):
    from playwright.sync_api import sync_playwright

    handler = functools.partial(StilleHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    basis = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        with sync_playwright() as p:
            # LESBORD_CHROMIUM: pad naar een eigen Chromium, voor omgevingen waar Playwright geen eigen browser heeft
            browser = p.chromium.launch(executable_path=os.environ.get("LESBORD_CHROMIUM") or None)
            page = browser.new_page()
            for i in ids:
                page.goto(f"{basis}/voorbereiding.html?id={i}")
                page.wait_for_selector("body[data-klaar='1']", timeout=15000)
                page.pdf(path=str(LESSEN / i / "voorbereiding.pdf"), format="A4", print_background=True,
                         margin={"top": "14mm", "bottom": "14mm", "left": "14mm", "right": "14mm"})
                page.goto(f"{basis}/presentatie.html?id={i}")
                page.wait_for_selector("body[data-klaar='1']", timeout=15000)
                page.wait_for_timeout(300)
                page.pdf(path=str(LESSEN / i / "presentatie.pdf"), width="1600px", height="900px",
                         print_background=True, margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
                print(f"  PDF's gemaakt: {i}")
            browser.close()
    finally:
        server.shutdown()


def ververs_versies():
    """Zet achter elke assets/...js en .css een ?v=<inhoud> in de html-pagina's,
    zodat browsers na een wijziging meteen de nieuwe versie laden (geen oude kopie uit de cache)."""
    import hashlib
    def versie(m):
        pad = ROOT / m.group(1)
        if not pad.exists():
            return m.group(0)
        return f'{m.group(1)}?v={hashlib.sha1(pad.read_bytes()).hexdigest()[:8]}"'
    for html in ROOT.glob("*.html"):
        oud = html.read_text(encoding="utf-8")
        nieuw = re.sub(r'(assets/[\w./-]+\.(?:js|css))(?:\?v=[0-9a-f]+)?"', versie, oud)
        if nieuw != oud:
            html.write_text(nieuw, encoding="utf-8")


def main():
    ververs_versies()
    lessen, fouten = lees_lessen()
    if fouten:
        print("Er zijn problemen:\n  " + "\n  ".join(fouten))
        sys.exit(1)
    schrijf_catalogus(lessen)
    print(f"Catalogus bijgewerkt: {len(lessen)} les(sen)")
    args = sys.argv[1:]
    if args == ["--catalogus"]:
        return  # alleen het overzicht (bijv. na het verwijderen van een les)
    ids = args or [les["id"] for les in lessen]
    zonder_pdf = {les["id"] for les in lessen if les.get("pdfs") is False}  # lessen uit de app
    ids = [i for i in ids if (LESSEN / i / "les.json").exists() and i not in zonder_pdf]
    if ids:
        maak_pdfs(ids)


if __name__ == "__main__":
    main()
