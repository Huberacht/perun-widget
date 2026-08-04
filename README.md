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
| `data-mode` | `float` (domyślnie) — launcher w rogu; `banner` — baner in-content |
| `data-position` | `right` (domyślnie) albo `left` — tylko dla `float` |
| `data-after-paragraph` | Po którym akapicie wstawić baner (domyślnie `2`) — tylko dla `banner` |
| `data-container` | Selektor CSS na kontener banera (zamiast liczenia akapitów) |
| `data-theme` | `dark`/`light` — wymusza wariant; domyślnie z tła strony |
| `data-accent` | Kolor akcentu (domyślnie `#e8b93e`) |
| `data-link-template` | Własny link CTA, np. `https://bukmacher.pl/bet/{market_id}` (domyślnie `provider_url` z feedu) |

Dwa tryby prezentacji:

- **`float`** — pływający launcher w rogu (styl czatowego widgetu): zwinięta pastylka
  z pytaniem rynku i „Dowiedz się więcej", po kliknięciu panel z kursami.
- **`banner`** — poziomy baner wstawiany między akapity artykułu, w miejscu,
  w którym portale trzymają display-ady:

```html
<script async src="https://twoj-matcher.example.com/widget.js"
        data-mode="banner" data-after-paragraph="2"></script>
```

Motyw (jasny/ciemny) widget bierze z faktycznego tła strony, a nie z samego
`prefers-color-scheme` — dzięki temu pasuje też do portali, które trzymają jeden
motyw niezależnie od ustawień systemu.

Czytelnik może zamknąć widget krzyżykiem (nie wraca do końca sesji przeglądarki)
i oddać głos 👍/👎 na zdarzenie — jeden głos na rynek, pamiętany w `localStorage`.

## Wykres z Peruna

Wykres kursów generuje sam Perun. Przy dopasowaniu matcher woła
`GET /public/v1/widgets/market-chart?market_id=...` (z kluczem `PERUN_ACCESS_KEY`,
cache 1 h) i przekazuje widgetowi zwrócony `widget_url` jako `chart_url` — keyless
adres renderu (`/widgets/market-chart/render`), który Perun celowo wystawia jako
osadzalny iframe (klucz feedu nigdy nie trafia do przeglądarki). Widget podmienia
w URL-u parametr `theme`, żeby wykres pasował do motywu strony. Bez klucza
(fixtures) albo gdy generator zawiedzie, `chart_url` jest `null` i widget
pokazuje własne paski prawdopodobieństwa.

## Zliczanie głosów

`POST /api/vote` z `{ market_id, vote: "up" | "down" }` podbija licznik; aktualne
liczby wracają razem z dopasowaniem w `/api/match`. Przyjmowane są tylko rynki,
które widget faktycznie serwuje (ta sama bramka co przy dopasowaniu).

Bez konfiguracji liczniki żyją w pamięci procesu — wystarczy do dema, ale na
serverless znikają między wywołaniami. Trwałe zliczanie włącza samo ustawienie
zmiennych Redis REST (Vercel KV albo Upstash), kod się nie zmienia:

```bash
vercel env add KV_REST_API_URL
vercel env add KV_REST_API_TOKEN
```

Obsługiwane są też nazwy `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.
Klucze mają postać `perun:votes:<market_id>:up|down`.

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
