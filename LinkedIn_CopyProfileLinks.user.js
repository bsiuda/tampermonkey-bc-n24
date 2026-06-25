// ==UserScript==
// @name         LinkedIn – Kopiuj linki do profili
// @description  Dodaje przycisk kopiujący linki do profili z wyników wyszukiwania LinkedIn (People Search).
// @match        https://www.linkedin.com/search/results/people/*
// @run-at       document-idle
// @version      1.2.0
// @downloadURL  https://raw.githubusercontent.com/bsiuda/tampermonkey-bc-n24/main/LinkedIn_CopyProfileLinks.user.js
// @updateURL    https://raw.githubusercontent.com/bsiuda/tampermonkey-bc-n24/main/LinkedIn_CopyProfileLinks.user.js
// ==/UserScript==

(function () {
  'use strict';

  const BTN_ID = 'n24-li-copy-btn';

  function getProfileLinks() {
    const seen  = new Set();
    const links = [];

    document.querySelectorAll('a[href*="/in/"]').forEach(a => {
      try {
        const url = new URL(a.href, location.origin);
        // tylko czyste /in/<slug> — bez zagnieżdżonych ścieżek
        if (/^\/in\/[^/]+\/?$/.test(url.pathname)) {
          const clean = 'https://www.linkedin.com' + url.pathname.replace(/\/$/, '/');
          if (!seen.has(clean)) {
            seen.add(clean);
            links.push(clean);
          }
        }
      } catch (_) { /* ignoruj złe URL-e */ }
    });

    return links;
  }

  function addButton() {
    if (document.getElementById(BTN_ID)) return;

    const btn = document.createElement('button');
    btn.id   = BTN_ID;
    btn.textContent = '📋 Kopiuj linki';
    btn.title = 'Kopiuj linki do profili z tej strony wyników';
    btn.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'right:24px',
      'z-index:99999',
      'padding:10px 18px',
      'background:#0a66c2',
      'color:#fff',
      'border:none',
      'border-radius:24px',
      'font-size:14px',
      'font-weight:600',
      'cursor:pointer',
      'box-shadow:0 4px 14px rgba(0,0,0,.35)',
      'transition:background .2s',
    ].join(';');

    btn.addEventListener('mouseenter', () => { btn.style.background = '#004182'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#0a66c2'; });

    btn.addEventListener('click', () => {
      const links = getProfileLinks();

      if (links.length === 0) {
        flash(btn, '❌ Brak profili', '#c62828');
        return;
      }

      const text = links.join('\n') + '\n';

      const afterCopy = () => {
        flash(btn, `✅ Skopiowano ${links.length}`, '#2e7d32');
        clickNext();
      };

      navigator.clipboard.writeText(text).then(afterCopy).catch(() => {
        // fallback dla starszych przeglądarek
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity  = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        afterCopy();
      });
    });

    document.body.appendChild(btn);
  }

  function clickNext() {
    setTimeout(() => {
      const next = document.querySelector('[data-testid="pagination-controls-next-button-visible"]');
      if (!next || next.disabled) return;
      next.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }, 400);
  }

  function flash(btn, label, color) {
    const orig = btn.style.background;
    btn.textContent    = label;
    btn.style.background = color;
    setTimeout(() => {
      btn.textContent    = '📋 Kopiuj linki';
      btn.style.background = orig;
    }, 2500);
  }

  // Pierwsze uruchomienie
  addButton();

  // LinkedIn to SPA — obserwuj zmiany URL / DOM
  let lastHref = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      const old = document.getElementById(BTN_ID);
      if (old) old.remove();
    }
    addButton();
  });
  observer.observe(document.body, { childList: true, subtree: false });
})();
