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

`fase` mag weg als de les geen fases heeft. Dan verdwijnt die kolom in de PDF.
