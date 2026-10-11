# Lesbord

Lessen voor het digibord, met pen, gum, ongedaan maken en wissen. Bij elke les horen een voorbereidingsformulier en een presentatie om te downloaden (PDF).

**Gebruiken:** open de website, zoek een les en klik op *Open op bord*.

Op het bord:
- **Pijltjes** (of de pijltjestoetsen, spatie of een presenter) om naar het volgende scherm te gaan.
- **Aanwijzen / Pen / Gum**. Aanwijzen schrijft niet.
- **Vier kleuren en drie diktes.**
- **Ongedaan maken** en **alles op dit scherm wissen**.
- **Kladblad**: een leeg scherm tussendoor.
- **Notities**: aanwijzingen voor de leerkracht bij elk scherm.
- **Volledig scherm.**

Aantekeningen worden niet bewaard. Herlaad je de pagina of open je de les opnieuw, dan begin je met een schoon bord.

## Lessen maken, aanpassen en verwijderen

Op een apparaat met je persoonlijke sleutel (zie *Lessen beheren* op de startpagina) verschijnen:
- **+ Nieuwe les** bovenaan
- bij elke les een **potlood** (bewerken) en een **prullenbak** (verwijderen)

De bewerkpagina werkt zoals Prowise: je zet tekstvakken op het scherm (verslepen, groter maken, lettertype, grootte, kleur, vet/schuin/onderstreept), en er zijn bouwstenen als **verstopte tekst** (komt tevoorschijn als je erop tikt), een **afdekblok** (verdwijnt als je erop tikt) en een **afbeelding**.

Na het opslaan of verwijderen werkt GitHub het overzicht binnen een paar minuten automatisch bij. Voor lessen uit de app worden geen PDF's gemaakt.

---

Voor onderhoud: lessen staan in `lessen/<id>/les.json` (zie [LESFORMAAT.md](LESFORMAAT.md)). Na een wijziging draai je `python3 tools/publiceer.py`.
