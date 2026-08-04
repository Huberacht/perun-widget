// Perun Widget — jeden tag <script> na portalu.
// Sam wyciąga treść artykułu z DOM, pyta matcher i renderuje pływający
// widget w rogu strony (styl launchera Zureq) w Shadow DOM.
(() => {
  'use strict';

  const script = document.currentScript;
  if (!script || window.__perunWidgetLoaded) return;
  window.__perunWidgetLoaded = true;

  const ENDPOINT = script.dataset.endpoint || (script.src ? new URL(script.src).origin : '');
  if (!ENDPOINT) return; // inline embed bez data-endpoint — nie ma do czego strzelać
  const LINK_TEMPLATE = script.dataset.linkTemplate || ''; // np. https://bukmacher.pl/bet/{market_id}
  const POSITION = script.dataset.position === 'left' ? 'left' : 'right';
  const ACCENT = script.dataset.accent || '#e8b93e';
  // 'float' — pływający launcher w rogu; 'banner' — baner in-content między akapitami
  const BANNER = script.dataset.mode === 'banner';
  const AFTER_PARAGRAPH = Number(script.dataset.afterParagraph) || 2;
  const CONTAINER = script.dataset.container || '';

  const meta = (name) =>
    document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.content || '';

  const findArticle = () =>
    document.querySelector('article') ||
    document.querySelector('[itemprop="articleBody"]') ||
    document.querySelector('.post-content, .entry-content, .article-content') ||
    document.querySelector('main');

  function extract() {
    const root = findArticle() || document.body;
    const paragraphs = [...root.querySelectorAll('p')]
      .map((p) => p.textContent.trim())
      .filter(Boolean)
      .join('\n');
    return {
      url: location.href,
      title: meta('og:title') || document.title,
      text: (meta('og:description') + '\n' + paragraphs).slice(0, 4000),
    };
  }

  const pct = (p) => `${Math.round(p * 100)}%`;
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  // Sygnet Światowida jako maska CSS — jeden asset, kolor sterowany motywem.
  const GLYPH = 'data:image/png;base64,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';

  // Widget dopasowuje się do jasnego/ciemnego motywu strony (patrz pageIsDark).
  const THEME = {
    dark: {
      bg: '#090a0a', fg: '#f4f2ec', muted: 'rgba(244,242,236,.5)',
      border: 'rgba(255,255,255,.08)', line: 'rgba(255,255,255,.16)',
      track: 'rgba(255,255,255,.09)', hover: 'rgba(255,255,255,.06)',
      shadow: '0 24px 64px rgba(0,0,0,.44)',
    },
    light: {
      bg: '#ffffff', fg: '#16171a', muted: 'rgba(22,23,26,.52)',
      border: 'rgba(0,0,0,.10)', line: 'rgba(0,0,0,.13)',
      track: 'rgba(0,0,0,.08)', hover: 'rgba(0,0,0,.04)',
      shadow: '0 18px 48px rgba(0,0,0,.14)',
    },
  };

  const css = (t) => `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .root {
      position: fixed; bottom: 20px; ${POSITION}: 20px; z-index: 2147483000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: ${t.fg};
      animation: perun-in .28s cubic-bezier(.2,.8,.3,1);
    }
    @keyframes perun-in { from { opacity: 0; transform: translateY(10px); } }
    .panel, .pill {
      background: ${t.bg}; border: 1px solid ${t.border}; box-shadow: ${t.shadow};
    }
    button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }

    /* sygnet Światowida — maska, więc kolor idzie za motywem */
    .mark {
      flex: none; display: flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; border-radius: 11px; background: ${ACCENT};
    }
    .mark i {
      display: block; width: 23px; height: 23px; background: #090a0a;
      -webkit-mask: url(${GLYPH}) center / contain no-repeat;
      mask: url(${GLYPH}) center / contain no-repeat;
    }

    /* --- zwinięty: pastylka --- */
    .pill {
      display: flex; align-items: center; gap: 12px;
      padding: 11px 13px; border-radius: 20px; cursor: pointer;
      width: min(360px, calc(100vw - 40px)); text-align: left;
    }
    .pill-t { min-width: 0; flex: 1; }
    .pill-t b {
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden; font-size: 13.5px; font-weight: 600; line-height: 1.35; color: ${t.fg};
    }
    .pill-t span { display: block; font-size: 12px; color: ${t.muted}; margin-top: 3px; }
    .expand {
      flex: none; display: flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; border-radius: 13px;
      border: 1px solid ${t.line}; color: ${t.muted};
      transition: border-color .15s, background .15s;
    }
    .pill:hover .expand { background: ${t.hover}; }

    /* --- rozwinięty: panel --- */
    .panel {
      width: min(380px, calc(100vw - 40px));
      border-radius: 24px; overflow: hidden; padding: 16px;
    }
    .head { display: flex; align-items: flex-start; gap: 12px; }
    .q {
      flex: 1; min-width: 0; font-size: 15.5px; font-weight: 600;
      line-height: 1.4; letter-spacing: -.01em; padding-top: 2px;
    }
    .min {
      flex: none; width: 32px; height: 32px; border-radius: 11px;
      display: flex; align-items: center; justify-content: center;
      color: ${t.muted}; transition: background .15s;
    }
    .min:hover { background: ${t.hover}; }
    .rows { margin-top: 16px; }
    .row {
      display: grid; grid-template-columns: minmax(44px, auto) 1fr 46px 58px;
      align-items: center; gap: 10px; margin: 9px 2px;
    }
    .lbl { font-size: 12.5px; font-weight: 600; }
    .track { height: 8px; border-radius: 4px; background: ${t.track}; overflow: hidden; }
    .fill { display: block; height: 100%; border-radius: 4px; }
    .yes .fill { background: #3fa372; }
    .no .fill { background: #d05a56; }
    .p { font-size: 14px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
    .odds { font-size: 11.5px; text-align: right; color: ${t.muted}; font-variant-numeric: tabular-nums; }
    .cta {
      display: block; text-align: center; margin: 16px 0 10px; padding: 12px 14px;
      border-radius: 15px; background: ${ACCENT}; color: #090a0a; text-decoration: none;
      font-size: 13.5px; font-weight: 600; transition: opacity .15s;
    }
    .cta:hover { opacity: .88; }
    .foot {
      display: flex; justify-content: space-between; gap: 10px;
      font-size: 10.5px; color: ${t.muted}; padding: 0 2px;
    }
    .src { color: inherit; text-decoration: none; }
    .src:hover { text-decoration: underline; }

    /* --- tryb banner: blok in-content, w miejscu display-ada --- */
    .root.inline { position: static; width: 100%; margin: 28px 0; }
    .banner {
      background: ${t.bg}; border: 1px solid ${t.border}; border-radius: 16px;
      padding: 13px 16px 15px;
    }
    .b-top {
      display: flex; justify-content: space-between; align-items: baseline; gap: 10px;
      font-size: 9.5px; letter-spacing: .09em; text-transform: uppercase;
      color: ${t.muted}; margin-bottom: 12px;
    }
    .b-body { display: grid; grid-template-columns: 1fr minmax(0, 236px); gap: 18px; align-items: center; }
    .b-head { display: flex; align-items: flex-start; gap: 12px; }
    .b-q { font-size: 15px; font-weight: 600; line-height: 1.38; letter-spacing: -.01em; padding-top: 3px; }
    .banner .row { grid-template-columns: minmax(38px, auto) 1fr 44px 56px; margin: 7px 0; }
    .banner .cta { margin: 0; }
    @media (max-width: 620px) {
      .b-body { grid-template-columns: 1fr; gap: 12px; }
    }
  `;

  const CHEVRON_UP = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`;
  const MINIMIZE = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>`;
  const MARK = `<span class="mark"><i></i></span>`;

  // Motyw bierzemy z faktycznego tła strony (a nie z samego prefers-color-scheme),
  // żeby widget pasował też do stron trzymających jeden motyw niezależnie od systemu.
  const DARK_OVERRIDE = script.dataset.theme; // 'dark' | 'light' — wymusza wariant
  function pageIsDark() {
    if (DARK_OVERRIDE === 'dark' || DARK_OVERRIDE === 'light') return DARK_OVERRIDE === 'dark';
    for (let el = document.body; el; el = el.parentElement) {
      const [r, g, b, a] = (getComputedStyle(el).backgroundColor.match(/[\d.]+/g) || []).map(Number);
      if (Number.isFinite(r) && (a === undefined || a > 0.2)) {
        return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
      }
    }
    return matchMedia('(prefers-color-scheme: dark)').matches;
  }

  let expanded = false; // stan przeżywa 60-sekundowe odświeżenia kursów
  let lastMatch = null;

  function render(match) {
    lastMatch = match;
    document.querySelectorAll('[data-perun-widget-root]').forEach((el) => el.remove());
    const host = document.createElement('div');
    host.setAttribute('data-perun-widget-root', '');
    const shadow = host.attachShadow({ mode: 'open' });

    const rawLink = LINK_TEMPLATE
      ? LINK_TEMPLATE.replace('{market_id}', encodeURIComponent(match.market_id))
      : match.provider_url;
    const link = rawLink && /^https?:\/\//i.test(rawLink) ? rawLink : ''; // tylko http(s)

    const row = (cls, label, p, rate) => `
      <div class="row ${cls}">
        <span class="lbl">${esc(label)}</span>
        <span class="track"><span class="fill" style="width:${Math.round(p * 100)}%"></span></span>
        <span class="p">${pct(p)}</span>
        <span class="odds">kurs ${rate?.toFixed ? rate.toFixed(2) : esc(rate)}</span>
      </div>`;

    const pill = `
      <div class="pill" role="button" tabindex="0" aria-label="Pokaż zakład do tego artykułu">
        ${MARK}
        <span class="pill-t">
          <b>${esc(match.event_name)}</b>
          <span>Dowiedz się więcej</span>
        </span>
        <span class="expand">${CHEVRON_UP}</span>
      </div>`;

    const panel = `
      <div class="panel">
        <div class="head">
          ${MARK}
          <span class="q">${esc(match.event_name)}</span>
          <button class="min" aria-label="Zwiń widget">${MINIMIZE}</button>
        </div>
        <div class="rows">
          ${row('yes', match.outcome_1_label, match.probability_1, match.rate_1)}
          ${row('no', match.outcome_2_label, match.probability_2, match.rate_2)}
        </div>
        ${link ? `<a class="cta" href="${esc(link)}" target="_blank" rel="noopener noreferrer nofollow sponsored">Postaw na to zdarzenie →</a>` : ''}
        <div class="foot">
          <span>${esc([match.category, match.subcategory].filter(Boolean).join(' / '))}</span>
          <a class="src" href="https://swiatowid.com" target="_blank" rel="noopener noreferrer">Źródło: Światowid.com</a>
        </div>
      </div>`;

    const cta = link
      ? `<a class="cta" href="${esc(link)}" target="_blank" rel="noopener noreferrer nofollow sponsored">Postaw na to zdarzenie →</a>`
      : '';

    const banner = `
      <div class="banner">
        <div class="b-top">
          <span>Sponsorowane · rynki predykcyjne</span>
          <a class="src" href="https://swiatowid.com" target="_blank" rel="noopener noreferrer">Źródło: Światowid.com</a>
        </div>
        <div class="b-body">
          <div>
            <div class="b-head">${MARK}<span class="b-q">${esc(match.event_name)}</span></div>
            <div class="rows">
              ${row('yes', match.outcome_1_label, match.probability_1, match.rate_1)}
              ${row('no', match.outcome_2_label, match.probability_2, match.rate_2)}
            </div>
          </div>
          <div>${cta}</div>
        </div>
      </div>`;

    const body = BANNER ? banner : expanded ? panel : pill;
    shadow.innerHTML =
      `<style>${css(pageIsDark() ? THEME.dark : THEME.light)}</style>` +
      `<div class="root ${BANNER ? 'inline' : 'float'}">${body}</div>`;

    const toggle = (open) => { expanded = open; render(lastMatch); };
    shadow.querySelector('.pill')?.addEventListener('click', () => toggle(true));
    shadow.querySelector('.pill')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(true); }
    });
    shadow.querySelector('.min')?.addEventListener('click', () => toggle(false));

    mount(host);
    return host;
  }

  // baner ląduje w treści (po N-tym akapicie, jak in-content ad), launcher — na body
  function mount(host) {
    if (!BANNER) return document.body.appendChild(host);
    const slot = CONTAINER && document.querySelector(CONTAINER);
    if (slot) return slot.appendChild(host);
    const paragraphs = [...(findArticle() || document.body).querySelectorAll('p')];
    const after = paragraphs[Math.min(AFTER_PARAGRAPH, paragraphs.length) - 1];
    return after
      ? after.insertAdjacentElement('afterend', host)
      : (findArticle() || document.body).appendChild(host);
  }

  async function run(article) {
    try {
      const res = await fetch(`${ENDPOINT}/api/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(article),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return;
      const { match } = await res.json();
      if (match) render(match);
    } catch {
      /* brak dopasowania lub błąd sieci — widget po prostu się nie pokazuje */
    }
  }

  window.PerunWidget = {
    render: (article) => run({ url: location.href, ...article }),
  };

  // strona przełącza motyw (albo system) — przemaluj to, co już wisi
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (lastMatch) render(lastMatch);
  });

  // start + odświeżanie kursów co 60 s (kursy mają być świeże)
  const start = () => {
    const article = extract();
    run(article);
    setInterval(() => run(article), 60_000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
