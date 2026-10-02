// ==UserScript==
// @name         Power BI - odświeżanie wszystkich elementów
// @namespace    local.powerbi.refresh-queue
// @version      1.0.0
// @description  Uruchamia po kolei przyciski „Odśwież teraz” w odstępie jednej sekundy i oznacza przetworzone wiersze.
// @match        https://app.powerbi.com/groups/bbd5c61c-f85b-4fd4-80cc-89faade4223e/list*
// @downloadURL  https://raw.githubusercontent.com/bsiuda/tampermonkey-bc-n24/main/PowerBI_RefreshAll.user.js
// @updateURL    https://raw.githubusercontent.com/bsiuda/tampermonkey-bc-n24/main/PowerBI_RefreshAll.user.js
// @run-at       document-idle
// @grant        none
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    const CLICK_INTERVAL_MS = 1000;
    const START_DELAY_MS = 1500;
    const BUTTON_SELECTOR = [
        'button[data-testid="quick-action-button-Odśwież teraz"]',
        'button[aria-label="Odśwież teraz"]'
    ].join(',');

    const stateAttribute = 'data-tm-pbi-refresh-state';
    const queuedAttribute = 'data-tm-pbi-refresh-queued';
    const styleId = 'tm-pbi-refresh-styles';
    const panelId = 'tm-pbi-refresh-panel';

    const queuedButtons = new WeakSet();
    const processedButtons = new WeakSet();
    const processedKeys = new Set();
    const queue = [];

    let isRunning = true;
    let clickedCount = 0;
    let errorCount = 0;
    let tickTimer = null;
    let scanTimer = null;

    const styles = `
        [${stateAttribute}="running"] {
            --tm-pbi-state-bg: rgba(255, 244, 222, 0.96);
            --tm-pbi-state-accent: #e8871e;
            --tm-pbi-state-shadow: rgba(232, 135, 30, 0.24);
            animation: tm-pbi-refresh-pulse 1.1s ease-in-out infinite;
        }

        [${stateAttribute}="triggered"] {
            --tm-pbi-state-bg: rgba(232, 248, 239, 0.96);
            --tm-pbi-state-accent: #16875f;
            --tm-pbi-state-shadow: rgba(22, 135, 95, 0.18);
        }

        [${stateAttribute}="error"] {
            --tm-pbi-state-bg: rgba(255, 235, 238, 0.96);
            --tm-pbi-state-accent: #c4314b;
            --tm-pbi-state-shadow: rgba(196, 49, 75, 0.2);
        }

        [${stateAttribute}] {
            background-color: var(--tm-pbi-state-bg) !important;
            box-shadow:
                inset 4px 0 0 var(--tm-pbi-state-accent),
                0 4px 14px var(--tm-pbi-state-shadow) !important;
            transition: background-color 180ms ease, box-shadow 180ms ease;
        }

        tr[${stateAttribute}] > td,
        [role="row"][${stateAttribute}] > * {
            background-color: var(--tm-pbi-state-bg) !important;
            transition: background-color 180ms ease;
        }

        @keyframes tm-pbi-refresh-pulse {
            0%, 100% { filter: saturate(1); }
            50% { filter: saturate(1.35) brightness(1.015); }
        }

        #${panelId} {
            position: fixed;
            right: 22px;
            bottom: 22px;
            z-index: 2147483647;
            display: grid;
            grid-template-columns: auto minmax(170px, 1fr) auto;
            align-items: center;
            gap: 11px;
            min-width: 330px;
            padding: 12px 14px;
            box-sizing: border-box;
            border: 1px solid rgba(20, 28, 45, 0.12);
            border-radius: 15px;
            background: rgba(255, 255, 255, 0.94);
            color: #1f2937;
            box-shadow: 0 12px 36px rgba(15, 23, 42, 0.18);
            backdrop-filter: blur(12px);
            font: 600 12px/1.35 "Segoe UI", sans-serif;
        }

        #${panelId} .tm-pbi-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #16875f;
            box-shadow: 0 0 0 5px rgba(22, 135, 95, 0.12);
        }

        #${panelId}[data-paused="true"] .tm-pbi-dot {
            background: #e8871e;
            box-shadow: 0 0 0 5px rgba(232, 135, 30, 0.12);
        }

        #${panelId} .tm-pbi-title {
            display: block;
            font-size: 13px;
            color: #111827;
        }

        #${panelId} .tm-pbi-details {
            display: block;
            margin-top: 2px;
            color: #667085;
            font-weight: 500;
        }

        #${panelId} button {
            min-width: 78px;
            padding: 7px 11px;
            border: 1px solid rgba(20, 28, 45, 0.14);
            border-radius: 9px;
            background: #f8fafc;
            color: #27364b;
            cursor: pointer;
            font: 600 12px/1 "Segoe UI", sans-serif;
        }

        #${panelId} button:hover {
            background: #eef2f7;
        }

        @media (prefers-reduced-motion: reduce) {
            [${stateAttribute}] {
                animation: none !important;
                transition: none !important;
            }
        }
    `;

    function ensureInterface() {
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = styles;
            (document.head || document.documentElement).appendChild(style);
        }

        if (document.getElementById(panelId)) return;

        const panel = document.createElement('aside');
        panel.id = panelId;
        panel.setAttribute('aria-live', 'polite');
        panel.innerHTML = `
            <span class="tm-pbi-dot" aria-hidden="true"></span>
            <span>
                <strong class="tm-pbi-title">Kolejka odświeżania</strong>
                <span class="tm-pbi-details">Szukam przycisków…</span>
            </span>
            <button type="button">Zatrzymaj</button>
        `;

        panel.querySelector('button').addEventListener('click', () => {
            isRunning = !isRunning;
            updatePanel();
            if (isRunning) processNext();
        });

        document.body.appendChild(panel);
        updatePanel();
    }

    function normalizeText(value) {
        return String(value || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function isUsableButton(button) {
        if (!button.isConnected || button.disabled) return false;
        if (button.getAttribute('aria-disabled') === 'true') return false;

        const style = getComputedStyle(button);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }

    function findRow(button) {
        const semanticRow = button.closest([
            'tr',
            '[role="row"]',
            'mat-row',
            '.mat-row',
            '.mat-mdc-row',
            '[data-testid*="row"]',
            'li'
        ].join(','));

        if (semanticRow) return semanticRow;

        // Awaryjnie wybieramy najbliższego szerokiego rodzica zawierającego
        // dokładnie jeden przycisk odświeżania.
        let element = button.parentElement;
        let fallback = element;

        for (let depth = 0; element && depth < 8; depth += 1) {
            const refreshButtons = element.querySelectorAll(BUTTON_SELECTOR);
            const width = element.getBoundingClientRect().width;

            if (refreshButtons.length === 1 && width >= 320) {
                fallback = element;
                break;
            }
            element = element.parentElement;
        }

        return fallback || button;
    }

    function getRowKey(row, button) {
        const link = row.querySelector([
            'a[href*="/reports/"]',
            'a[href*="/datasets/"]',
            'a[href*="/semanticModels/"]',
            'a[href*="/dataflows/"]'
        ].join(','));

        if (link?.href) return `href:${link.href.split('?')[0]}`;

        const stableId = row.getAttribute('data-object-id') ||
            row.getAttribute('data-item-id') || row.id;
        if (stableId) return `id:${stableId}`;

        const title = row.querySelector('[data-testid*="name"], [title]')
            ?.getAttribute('title');
        if (title) return `title:${normalizeText(title)}`;

        // Ostatnia opcja działa, dopóki Power BI nie wymieni całego wiersza.
        if (!row.dataset.tmPbiLocalKey) {
            row.dataset.tmPbiLocalKey = crypto.randomUUID?.() ||
                `${Date.now()}-${Math.random()}`;
        }
        return `local:${row.dataset.tmPbiLocalKey}:${button.tabIndex}`;
    }

    function setRowState(row, state) {
        if (!row?.isConnected) return;
        row.setAttribute(stateAttribute, state);
    }

    function scanForButtons() {
        ensureInterface();

        for (const button of document.querySelectorAll(BUTTON_SELECTOR)) {
            if (processedButtons.has(button) || queuedButtons.has(button)) continue;

            const row = findRow(button);
            const key = getRowKey(row, button);

            if (processedKeys.has(key)) {
                processedButtons.add(button);
                setRowState(row, 'triggered');
                continue;
            }

            if (!isUsableButton(button)) continue;

            queuedButtons.add(button);
            button.setAttribute(queuedAttribute, 'true');
            queue.push({ button, row, key });
        }

        updatePanel();
    }

    function processNext() {
        if (!isRunning) return;

        scanForButtons();

        let item = queue.shift();
        while (item && (!isUsableButton(item.button) ||
            processedKeys.has(item.key))) {
            item = queue.shift();
        }

        if (!item) {
            updatePanel();
            return;
        }

        const { button, row, key } = item;
        processedButtons.add(button);
        processedKeys.add(key);
        button.removeAttribute(queuedAttribute);
        setRowState(row, 'running');

        try {
            button.click();
            clickedCount += 1;

            // Zielony oznacza, że kliknięcie zostało wysłane. Nie jest to
            // potwierdzenie zakończenia odświeżania po stronie usługi Power BI.
            setTimeout(() => setRowState(row, 'triggered'), 850);
        } catch (error) {
            errorCount += 1;
            setRowState(row, 'error');
            console.error('[Power BI Refresh Queue]', error);
        }

        updatePanel();
    }

    function updatePanel() {
        const panel = document.getElementById(panelId);
        if (!panel) return;

        panel.dataset.paused = String(!isRunning);
        const details = panel.querySelector('.tm-pbi-details');
        const button = panel.querySelector('button');

        const errorText = errorCount ? ` · błędy: ${errorCount}` : '';
        const detailsText = isRunning
            ? `Uruchomiono: ${clickedCount} · w kolejce: ${queue.length}${errorText}`
            : `Wstrzymano · uruchomiono: ${clickedCount}${errorText}`;
        const buttonText = isRunning ? 'Zatrzymaj' : 'Wznów';

        if (details.textContent !== detailsText) details.textContent = detailsText;
        if (button.textContent !== buttonText) button.textContent = buttonText;
    }

    function scheduleScan() {
        if (scanTimer !== null) return;
        scanTimer = setTimeout(() => {
            scanTimer = null;
            scanForButtons();
        }, 200);
    }

    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.documentElement, {
        subtree: true,
        childList: true
    });

    setTimeout(() => {
        ensureInterface();
        scanForButtons();
        processNext();
        tickTimer = setInterval(processNext, CLICK_INTERVAL_MS);
    }, START_DELAY_MS);

    window.addEventListener('pagehide', () => {
        observer.disconnect();
        clearInterval(tickTimer);
        clearTimeout(scanTimer);
    }, { once: true });
})();
