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

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .root {
      position: fixed; bottom: 20px; ${POSITION}: 20px; z-index: 2147483000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #f4f2ec;
      animation: perun-in .28s cubic-bezier(.2,.8,.3,1);
    }
    @keyframes perun-in { from { opacity: 0; transform: translateY(10px); } }
    .panel, .pill {
      background: #090a0a; border: 1px solid rgba(255,255,255,.08);
      box-shadow: 0 24px 64px rgba(0,0,0,.34);
    }
    .avatar {
      display: flex; align-items: center; justify-content: center; flex: none;
      width: 34px; height: 34px; border-radius: 12px;
      background: ${ACCENT}; color: #090a0a; font-size: 17px;
    }
    button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }

    /* --- zwinięty: pastylka --- */
    .pill {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px; border-radius: 26px; cursor: pointer;
      max-width: min(340px, calc(100vw - 40px));
    }
    .pill-t { min-width: 0; }
    .pill-t b { display: block; font-size: 14px; font-weight: 600; }
    .pill-t span {
      display: block; font-size: 12px; color: rgba(244,242,236,.55); margin-top: 1px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .expand {
      flex: none; display: flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; border-radius: 15px;
      border: 1px solid rgba(255,255,255,.16); color: rgba(244,242,236,.8);
      transition: border-color .15s, background .15s;
    }
    .pill:hover .expand { border-color: rgba(255,255,255,.3); background: rgba(255,255,255,.06); }

    /* --- rozwinięty: panel --- */
    .panel {
      width: min(380px, calc(100vw - 40px));
      border-radius: 28px; overflow: hidden; padding: 16px;
    }
    .head { display: flex; align-items: center; gap: 11px; }
    .head .who { min-width: 0; }
    .head .who b { display: block; font-size: 13px; font-weight: 500; color: rgba(244,242,236,.55); }
    .head .who i {
      display: inline-flex; align-items: center; gap: 6px;
      font-style: normal; font-size: 12px; color: rgba(244,242,236,.8); margin-top: 2px;
    }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: ${ACCENT}; }
    .min {
      margin-left: auto; flex: none; width: 36px; height: 36px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      color: rgba(244,242,236,.7); transition: background .15s;
    }
    .min:hover { background: rgba(255,255,255,.07); }
    .q {
      font-size: 19px; font-weight: 500; line-height: 1.42; letter-spacing: -.02em;
      margin: 18px 2px 16px;
    }
    .row {
      display: grid; grid-template-columns: minmax(44px, auto) 1fr 46px 58px;
      align-items: center; gap: 10px; margin: 9px 2px;
    }
    .lbl { font-size: 12.5px; font-weight: 600; }
    .track { height: 8px; border-radius: 4px; background: rgba(255,255,255,.09); overflow: hidden; }
    .fill { display: block; height: 100%; border-radius: 4px; }
    .yes .fill { background: #3fa372; }
    .no .fill { background: #d05a56; }
    .p { font-size: 14px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
    .odds { font-size: 11.5px; text-align: right; color: rgba(244,242,236,.45); font-variant-numeric: tabular-nums; }
    .cta {
      display: block; text-align: center; margin: 16px 0 10px; padding: 12px 14px;
      border-radius: 15px; background: ${ACCENT}; color: #090a0a; text-decoration: none;
      font-size: 13.5px; font-weight: 600; transition: opacity .15s;
    }
    .cta:hover { opacity: .88; }
    .foot {
      display: flex; justify-content: space-between; gap: 10px;
      font-size: 10.5px; color: rgba(244,242,236,.35); padding: 0 2px;
    }
    .live { display: inline-flex; align-items: center; gap: 5px; }
  `;

  const CHEVRON_UP = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`;
  const MINIMIZE = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>`;
  const BOLT = '⚡';

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
        <span class="avatar">${BOLT}</span>
        <span class="pill-t">
          <b>Zakład do tego artykułu</b>
          <span>${esc(match.event_name)}</span>
        </span>
        <span class="expand">${CHEVRON_UP}</span>
      </div>`;

    const panel = `
      <div class="panel">
        <div class="head">
          <span class="avatar">${BOLT}</span>
          <span class="who">
            <b>Perun · rynki predykcyjne</b>
            <i><span class="dot"></span>kursy na żywo</i>
          </span>
          <button class="min" aria-label="Zwiń widget">${MINIMIZE}</button>
        </div>
        <div class="q">${esc(match.event_name)}</div>
        ${row('yes', match.outcome_1_label, match.probability_1, match.rate_1)}
        ${row('no', match.outcome_2_label, match.probability_2, match.rate_2)}
        ${link ? `<a class="cta" href="${esc(link)}" target="_blank" rel="noopener noreferrer nofollow sponsored">Postaw na to zdarzenie →</a>` : ''}
        <div class="foot">
          <span>${esc([match.category, match.subcategory].filter(Boolean).join(' / '))}</span>
          <span>18+ · kursy informacyjne · dane: Perun</span>
        </div>
      </div>`;

    shadow.innerHTML = `<style>${CSS}</style><div class="root">${expanded ? panel : pill}</div>`;

    const toggle = (open) => { expanded = open; render(lastMatch); };
    shadow.querySelector('.pill')?.addEventListener('click', () => toggle(true));
    shadow.querySelector('.pill')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(true); }
    });
    shadow.querySelector('.min')?.addEventListener('click', () => toggle(false));

    document.body.appendChild(host);
    return host;
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

  // start + odświeżanie kursów co 60 s ("kursy na żywo" ma być prawdą)
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
