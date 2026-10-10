# Lesformaat van het Lesbord

Elke les staat in een eigen map: `lessen/<les-id>/`. De mapnaam bevat alleen kleine letters, cijfers en streepjes, bijvoorbeeld `g6-rekenen-breuken-vergelijken`.

In die map staan:

| Bestand | Wat |
|---|---|
| `les.json` | De les zelf: gegevens, schermen en voorbereiding |
| `voorbereiding.pdf` | Wordt gemaakt door `tools/publiceer.py` |
| `presentatie.pdf` | Wordt gemaakt door `tools/publiceer.py` |
| afbeeldingen | Optioneel, en vanuit een blok aan te roepen met alleen de bestandsnaam |

Na elke wijziging draai je `python3 tools/publiceer.py`. Dat controleert de lessen, werkt `lessen/catalogus.json` bij (het overzicht op de site) en maakt de PDF's.

## les.json

```json
{
  "id": "g5-rekenen-afronden",          // gelijk aan de mapnaam
  "titel": "Afronden op tientallen",
  "groep": "5",                          // tekst: "5", "5/6", "7-8"
  "vak": "Rekenen",
  "blok": "Blok 3, les 2",               // optioneel: methode, blok of week
  "onderwerp": "Afronden",               // optioneel
  "duur": 30,                            // optioneel, in minuten
  "edi": true,                           // alleen als de les in EDI-vorm is ontworpen
  "samenvatting": "Eén zin voor het overzicht.",
  "trefwoorden": ["afronden", "tiental"],
  "gemaakt": "2026-10-08",
  "lesdoel": "Ik kan …",                 // optioneel
  "lesdoelInHoek": true,                 // lesdoel klein in de hoek van elk scherm
  "schermen": [ … ],
  "voorbereiding": { … }
}
```

## Schermen

Een scherm is 1600 × 900 en schaalt mee op elk bord.

```json
{
  "fase": "Begeleide inoefening",   // optioneel: label bovenin (alleen voor de leerkracht zichtbaar in de balk)
  "achtergrond": "leeg",            // "leeg", "ruitjes" of "lijntjes"
  "uitlijning": "midden",           // optioneel: inhoud verticaal in het midden
  "lesdoelVerbergen": true,         // optioneel: geen lesdoel in de hoek op dit scherm
  "notitie": "Alleen voor de leerkracht (knop met tekstballon).",
  "blokken": [ … ]
}
```

### Bloktypes

| type | velden | gebruik |
|---|---|---|
| `kop` | `tekst` | Grote titel |
| `subkop` | `tekst` | Groene tussenkop |
| `tekst` | `tekst` | Gewone tekst |
| `klein` | `tekst` | Kleine grijze tekst |
| `vraag` | `tekst` | Vraag of opdracht in een groen kader |
| `groot` | `tekst` | Heel groot (een getal of woord) |
| `fase` | `tekst` | Klein label op het scherm zelf |
| `lijst` | `items`, `genummerd` | Opsomming |
| `stappen` | `items` | Genummerde stappen in kaartjes |
| `tabel` | `rijen`, `kopRij` | Eerste rij is kop, tenzij `kopRij: false` |
| `afbeelding` | `src`, `alt` | Bestand in de lesmap of een URL |
| `schrijfvak` | `label` | Gestippeld vak om in te schrijven |
| `kolommen` | `kolommen` (lijst van lijsten met blokken), `verhouding` | Naast elkaar, bijv. `["2fr","1fr"]` |
| `html` | `html` | Maatwerk, zoals een getallenlijn of liniaal in SVG |
| `stellingen` | `items` (`titel`, `onzin`), `antwoord` | Quizkaart met A, B, C. Na een tik komt het antwoord en krijgt elke kaart een stempel *feit* of *onzin* |
| `smaken` | `items` | Smaken als kaartjes (proefronde), meestal met `"verborgen": true` |
| `eindstand` | – | Ranglijst van het scorebord (alleen met `scorebord` in de les, zie hieronder) |

### Stap voor stap tonen

Op het bord verschijnt informatie pas als je hem nodig hebt:

- `"stapsgewijs": true` bij `lijst` of `stappen`: elk item is eerst verborgen, en verschijnt als je het aantikt.
- `"verborgen": true` bij elk ander blok (bijvoorbeeld een antwoord): het hele blok is verborgen tot je het aantikt.

Je kunt ook op **volgende** drukken (knop, pijltje of presenter): eerst verschijnt dan het volgende verborgen item, en pas als alles zichtbaar is, ga je naar het volgende scherm. Aantikken werkt in de stand *Aanwijzen*. Nog eens tikken verbergt het weer. In de presentatie-PDF is alles zichtbaar.

Elk blok mag ook `stijl` hebben (extra CSS), bijvoorbeeld `"stijl": "color:#d6453d"`.

Opmaak in tekst: `**vet**`, `*schuin*`, `==gemarkeerd==`. Een nieuwe regel maak je met `\n`.

## Voorbereiding

Hier komt **alleen** wat in het ontwerpgesprek besproken is.

```json
{
  "benodigdheden": ["Wisbordjes"],
  "verloop": [
    { "tijd": "0–5 min", "fase": "Lesdoel", "wat": "Wat er gebeurt." }
  ],
  "secties": [
    { "kop": "Aandachtspunten", "items": ["…"] },
    { "kop": "Na de les", "tekst": "…" }
  ]
}
```

`fase` mag weg als de les geen fases heeft. Met `"faseKop": "Onderdeel"` in `voorbereiding` krijgt die kolom een andere kop dan "Lesfase". Dan verdwijnt die kolom in de PDF. Hetzelfde geldt voor `tijd`.

## Scorebord (quizzen en spellen)

Voor een quiz, spel of wedstrijd zet je in `les.json` op het hoogste niveau:

```json
"scorebord": { "teams": 3 }
```

`teams` is een aantal (2 tot 8) of een lijst met standaardnamen, bijvoorbeeld `["Rood", "Blauw", "Geel"]`.

Wat je dan krijgt:

- **Een balk onderaan elk scherm** met de teams en hun punten. Het team met de meeste punten is groen gemarkeerd.
- **Punten geven:** tik op "Punten geven". In het paneel typ je de teamnamen (dat opent de eerste keer vanzelf), vink je aan welke teams het goed hadden, kies je 1 tot 4 punten en tik je op "Optellen". Er is ook "Laatste ongedaan maken", corrigeren met + en − per team, en "Alles op nul" (met een tweede tik ter bevestiging).
- **Bewaard in de browser:** de stand en de teamnamen blijven staan als je van scherm wisselt of de pagina herlaadt. Ze staan alleen op het apparaat waarmee je presenteert, niet op de site en niet in de pdf's.
- **Blok `eindstand`:** zet dit op een slotscherm voor een grote ranglijst met plaats, naam en punten (gelijke stand = gelijke plaats). In de pdf van de presentatie staat daar een lege plek met een korte tekst.

Het scorebord staat in `assets/score.js`.

## Thema en grapjes

- **`"thema": "pub"`** (op het hoogste niveau van `les.json`) geeft de les een kroeglook: houten planken, een krijtbord, bierviltjes als letters en een houten scorebalk. Zonder `thema` blijft de gewone groene stijl.
- **`"grap"`** bij een scherm zet een kort grapje op een briefje in de hoek, bijvoorbeeld `"grap": "Wie vals speelt, trakteert."`. Werkt ook zonder thema.

## Live: telefoons laten meedoen

Met `"live": true` op het hoogste niveau van `les.json` krijgt het bord een telefoon-icoon. Teams doen mee met hun eigen telefoon of tablet: ze scannen een QR-code, kiezen een teamnaam en beantwoorden de vragen die jij op het bord zet. Er is geen account of naam nodig.

**Hoe het werkt:** de pagina `doe.html` (voor de telefoons) en het bord praten via een kleine database bij Firebase (Realtime Database). Elke avond krijgt een eigen kamer met een willekeurige code van zes tekens onder `rooms/<CODE>`. De antwoorden bestaan alleen in die kamer en verdwijnen als je de kamer stopt ("Stop en wis kamer").

**Instellen (eenmalig):**
1. Maak een Firebase-project met een Realtime Database (locatie Europa, vergrendelde modus).
2. Zet de regels uit `firebase-regels.json` bij *Regels* en klik op *Publiceren*.
3. Zet het webadres van de database in `assets/live-config.js`.

**Gebruiken op het bord:**
- Tik op het telefoon-icoon en kies **Start telefoons**. De kamer onthoudt zichzelf als je de pagina herlaadt.
- De namen die teams kiezen komen automatisch in het scorebord (de eerste teams die aansluiten, zoveel als in `scorebord.teams`).

**Blokken:**

| type | velden | gebruik |
|---|---|---|
| `live-aansluiten` | – | Grote QR-code, de code en de teams die binnenkomen. Zet dit op het welkomstscherm. |
| `live` | `id`, `soort`, `vraag`, `opties`, `groepen` | Stuurt een vraag naar de telefoons en laat zien wie geantwoord heeft. |

Soorten vragen (`soort`):
- `tekst`: een vrij antwoord (maximaal 400 tekens).
- `keuze`: kiezen uit A, B, C…, met `opties` als lijst met teksten.
- `vinkjes`: meerdere dingen aanvinken, met `groepen`: `[{ "naam": "Citrus", "items": ["citroen", "limoen"] }, …]`.

`id` moet per vraag uniek zijn. Onder het blok staan **Toon antwoorden** en **Sluit de vraag** (na het sluiten kunnen de teams niets meer wijzigen).

**Let op:** de kamercode is de enige beveiliging. Gebruik live niet voor gevoelige gegevens. Voor lessen met leerlingen: laat ze geen namen of persoonlijke gegevens invullen en stem af met school wat daar mag.
