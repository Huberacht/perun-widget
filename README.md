# Perun Widget

Embeddowalny widget dla portali newsowych (Bitcoin.pl itp.): AI dopasowuje do treści
artykułu najlepszy zakład z feedu [Peruna](https://github.com/przemek890/Perun) i renderuje
pływający widget w rogu strony (styl launchera Zureq): zwinięta pastylka → panel
z szansami (%), kursami i linkiem.

```
przeglądarka czytelnika                twój serwer (matcher)              Perun
┌─────────────────────┐   POST /api/match   ┌──────────────┐  snapshot  ┌──────┐
│ artykuł + widget.js ├────────────────────►│ cache/artykuł├───────────►│ feed │
│  (Shadow DOM card)  │◄────────────────────┤ Claude match │◄───────────┤ API  │
└─────────────────────┘   {match, %, kursy} └──────────────┘            └──────┘
```

Klucz profilu Peruna i klucz Anthropic **nigdy nie trafiają do przeglądarki** — widget
rozmawia tylko z matcherem. AI liczy się **raz na artykuł** (cache 24 h po URL-u),
procenty i kursy są za każdym razem brane ze świeżego snapshotu feedu (cache 30 s).

## Integracja na portalu — jeden tag

```html
<script async src="https://twoj-matcher.example.com/widget.js"></script>
```

Widget sam wyciąga tytuł (`og:title`), opis i treść `<article>`, pyta matcher
i pokazuje zwiniętą pastylkę w prawym dolnym rogu. Opcjonalne atrybuty:

| Atrybut | Działanie |
| --- | --- |
| `data-endpoint` | Adres matchera (domyślnie origin skryptu) |
| `data-position` | `right` (domyślnie) albo `left` |
| `data-accent` | Kolor akcentu (domyślnie `#e8b93e`) |
| `data-link-template` | Własny link CTA, np. `https://bukmacher.pl/bet/{market_id}` (domyślnie `provider_url` z feedu) |

Ręczne sterowanie (SPA, nietypowy layout):

```js
window.PerunWidget.render({ title: '...', text: '...' });
```

Brak sensownego dopasowania = widget się nie renderuje. Zero błędów na stronie.

## Uruchomienie matchera

```bash
npm install
PERUN_ACCESS_KEY=... node server.js     # produkcyjnie: prawdziwy feed Peruna
node server.js                          # bez klucza: fixtures + demo na :3947
```

| Zmienna | Domyślnie | Opis |
| --- | --- | --- |
| `PORT` | `3947` | Port HTTP |
| `PERUN_FEED_URL` | `https://feed.swiatowid.com` | Baza publicznego feedu |
| `PERUN_ACCESS_KEY` | — | Klucz profilu z panelu operatora (bez niego: fixtures) |
| `PERUN_MATCH_MODEL` | `claude-opus-4-8` | Model do dopasowań |
| `ANTHROPIC_API_KEY` | — | Klucz Anthropic (lub profil `ant auth login`); bez niego fallback leksykalny |

Demo: `http://localhost:3947/` — artykuł w stylu Bitcoin.pl z osadzonym widgetem.
Test: `npm test`.

## Zasady z feedu Peruna, których pilnuje matcher

- **Bramka zakładów**: proponowane są tylko rynki spełniające
  `is_active && !is_resolved && !block_bet && !data_not_fresh`; gdy dopasowany rynek
  zostanie zablokowany, widget znika i przy następnym wejściu dobierany jest nowy.
- **Kandydaci**: top 150 rynków po wolumenie ze snapshotu profilu.
- **Dopasowanie**: Claude dostaje tytuł + treść artykułu i kompaktową listę rynków;
  zwraca `market_id` albo `null` (structured output). Próg pewności 0.5 —
  „blisko tematu" to za mało, rynek ma dotyczyć tego samego zdarzenia.

## Czego tu (świadomie) nie ma

- rate limiting i klucze per-portal — dołóż przed publicznym wystawieniem endpointu,
- Redis dla cache dopasowań — Map w pamięci wystarcza na jedną instancję,
- WebSocket z feedu — snapshot co 30 s jest dość „na żywo" dla widgetu w artykule.
