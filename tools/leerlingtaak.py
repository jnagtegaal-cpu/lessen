#!/usr/bin/env python3
"""Leerlingtaken (leerlingopdrachten) klaarzetten, bekijken en afsluiten vanaf de commandoregel.

Doet hetzelfde als leerlingopdrachten.html, zodat Claude het vanuit een gesprek kan doen.
Zie LESFORMAAT.md ("Leerlingopdrachten").

  python3 tools/leerlingtaak.py lijst                         # wat staat klaar, en voor wie
  python3 tools/leerlingtaak.py klaar <opdracht-id>           # klaarzetten voor iedereen
  python3 tools/leerlingtaak.py klaar <opdracht-id> 7A 7B     # alleen voor deze letters
  python3 tools/leerlingtaak.py voor <kamer> 7A 7B 8C         # andere letters voor een opdracht die klaarstaat
  python3 tools/leerlingtaak.py voor <kamer> iedereen         # weer voor iedereen
  python3 tools/leerlingtaak.py af <kamer>                    # af en archiveren
  python3 tools/leerlingtaak.py --proef klaar <id> 7A         # alleen laten zien, niets opslaan

Letters (7A–7P, 8A–8F) staan in opdrachten/klas.json. Nooit namen in de database zetten.
"""
import json, re, secrets, sys, time, urllib.request
from pathlib import Path

MAP = Path(__file__).resolve().parent.parent
PLEK = "KLASTOETS"
TEKENS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def basis():
    t = (MAP / "assets/live-config.js").read_text(encoding="utf-8")
    m = re.search(r'databaseURL:\s*"([^"]*)"', t)
    if not m or not m.group(1):
        sys.exit("De live-functie staat uit (geen databaseURL in assets/live-config.js).")
    return m.group(1).rstrip("/")


PROEF = False


def db(methode, pad, waarde=None):
    url = f"{basis()}/rooms/{pad}.json"
    if PROEF and methode != "GET":
        print(f"  (proef) {methode} rooms/{pad} {json.dumps(waarde, ensure_ascii=False) if waarde is not None else ''}")
        return None
    data = None if methode in ("GET", "DELETE") else json.dumps(waarde).encode()
    req = urllib.request.Request(url, data=data, method=methode, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read() or b"null")


def klas_letters():
    k = json.loads((MAP / "opdrachten/klas.json").read_text(encoding="utf-8"))
    return [l for g in k["groepen"] for l in g["letters"]]


def opdrachten():
    o = json.loads((MAP / "opdrachten/overzicht.json").read_text(encoding="utf-8"))
    return {t["id"]: t for t in o.get("opdrachten", [])}


def check_letters(ruw):
    alle = klas_letters()
    letters = [l.strip().upper() for l in ruw if l.strip()]
    fout = [l for l in letters if l not in alle]
    if fout:
        sys.exit(f"Onbekende letter(s): {', '.join(fout)}. Bestaande letters: {', '.join(alle)}")
    return sorted(set(letters), key=alle.index)


def actief():
    a = db("GET", f"{PLEK}/actief") or {}
    if isinstance(a.get("kamer"), str):  # oud formaat
        a = {a["kamer"]: {"toets": a.get("toets"), "gestart": a.get("gestart")}}
    return a


def lijst():
    ops, a = opdrachten(), actief()
    if not a:
        print("Er staat nu niets klaar.")
        return
    for k, r in sorted(a.items(), key=lambda x: x[1].get("gestart") or 0):
        t = ops.get(r.get("toets"), {})
        kamer = db("GET", k) or {}
        ll = kamer.get("leerlingen") or {}
        klaar = sorted(l for l, d in ll.items() if d.get("ingeleverd"))
        voor = r.get("voor")
        print(f"{k}  {t.get('titel', r.get('toets'))} ({t.get('vak', '?')})"
              f" · {'voor ' + ', '.join(voor) if voor else 'voor iedereen'}"
              f" · ingeleverd: {', '.join(klaar) if klaar else 'nog niemand'}")


def klaar(opdracht_id, letters):
    ops = opdrachten()
    if opdracht_id not in ops:
        sys.exit(f"Onbekende opdracht '{opdracht_id}'. Bestaande: {', '.join(ops) or 'geen'}")
    k = "".join(secrets.choice(TEKENS) for _ in range(8))
    r = {"toets": opdracht_id, "gestart": int(time.time() * 1000)}
    if letters:
        r["voor"] = letters
    oud = db("GET", f"{PLEK}/actief") if not PROEF else None
    if isinstance(oud, dict) and isinstance(oud.get("kamer"), str):  # oud formaat eerst omzetten, net als de app
        db("PUT", f"{PLEK}/actief", {oud["kamer"]: {"toets": oud.get("toets"), "gestart": oud.get("gestart")}})
    db("PUT", f"{k}/info", r)
    db("PUT", f"{PLEK}/geschiedenis/{k}", r)
    db("PUT", f"{PLEK}/actief/{k}", r)
    print(f"✓ '{ops[opdracht_id]['titel']}' staat klaar {'voor ' + ', '.join(letters) if letters else 'voor iedereen'} (kamer {k}).")


def voor(k, letters):
    if k not in actief():
        sys.exit(f"Kamer {k} staat niet klaar. Kijk met 'lijst'.")
    for pad in (f"{k}/info/voor", f"{PLEK}/geschiedenis/{k}/voor", f"{PLEK}/actief/{k}/voor"):
        db("PUT", pad, letters) if letters else db("DELETE", pad)
    print(f"✓ Kamer {k} staat nu klaar {'voor ' + ', '.join(letters) if letters else 'voor iedereen'}.")


def af(k):
    if k not in actief():
        sys.exit(f"Kamer {k} staat niet klaar. Kijk met 'lijst'.")
    nu = int(time.time() * 1000)
    db("PUT", f"{k}/info/gesloten", nu)
    db("PUT", f"{PLEK}/geschiedenis/{k}/af", nu)
    db("DELETE", f"{PLEK}/actief/{k}")
    print(f"✓ Kamer {k} is afgesloten en staat in het archief.")


def main(a):
    global PROEF
    if a and a[0] == "--proef":
        PROEF, a = True, a[1:]
    if not a or a[0] in ("-h", "--help"):
        print(__doc__)
        return
    cmd, rest = a[0], a[1:]
    if cmd == "lijst":
        lijst()
    elif cmd == "klaar" and rest:
        klaar(rest[0], check_letters(rest[1:]))
    elif cmd == "voor" and len(rest) >= 2:
        voor(rest[0], None if rest[1].lower() == "iedereen" else check_letters(rest[1:]))
    elif cmd == "af" and rest:
        af(rest[0])
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1:])
