// ==UserScript==
// @name         Power BI - odświeżanie wszystkich elementów
// @namespace    local.powerbi.refresh-queue
// @version      1.1.0
// @description  Uruchamia po kolei przyciski „Odśwież teraz” w odstępie jednej sekundy i oznacza przetworzone wiersze.
// @match        https://app.powerbi.com/groups/bbd5c61c-f85b-4fd4-80cc-89faade4223e/list*
// @match        https://app.powerbi.com/groups/a8266aa2-bc91-4443-b49c-663a5fef8c62/list*
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
    const SPINNER_SELECTOR = [
        'spinner[title="Trwa odświeżanie..."]',
        '.dataflow-refresh-icons spinner',
        '.dataflow-refresh-icons [data-testid="spinner"]'
    ].join(',');

    const stateAttribute = 'data-tm-pbi-refresh-state';
    const queuedAttribute = 'data-tm-pbi-refresh-queued';
    const styleId = 'tm-pbi-refresh-styles';
    const panelId = 'tm-pbi-refresh-panel';
    const confirmationId = 'tm-pbi-refresh-confirmation';

    const queuedButtons = new WeakSet();
    const processedButtons = new WeakSet();
    const processedKeys = new Set();
    const queuedKeys = new Set();
    const observedSpinnerKeys = new Set();
    const queue = [];

    let isRunning = false;
    let clickedCount = 0;
    let errorCount = 0;
    let tickTimer = null;
    let scanTimer = null;
    let startTimer = null;
    let observer = null;

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

        #${confirmationId} {
            position: fixed;
            inset: 0;
            z-index: 2147483647;
            display: grid;
            place-items: center;
            padding: 24px;
            box-sizing: border-box;
            background: rgba(15, 23, 42, 0.42);
            backdrop-filter: blur(5px);
            font-family: "Segoe UI", sans-serif;
        }

        #${confirmationId} .tm-pbi-confirmation-card {
            width: min(440px, 100%);
            padding: 26px;
            box-sizing: border-box;
            border: 1px solid rgba(255, 255, 255, 0.56);
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.97);
            color: #172033;
            box-shadow: 0 24px 70px rgba(15, 23, 42, 0.28);
            text-align: center;
        }

        #${confirmationId} .tm-pbi-confirmation-icon {
            display: grid;
            place-items: center;
            width: 48px;
            height: 48px;
            margin: 0 auto 16px;
            border-radius: 15px;
            background: #eef5ff;
            color: #2563a7;
            font-size: 25px;
            line-height: 1;
        }

        #${confirmationId} .tm-pbi-confirmation-title {
            margin: 0;
            font-size: 20px;
            line-height: 1.35;
            font-weight: 700;
        }

        #${confirmationId} .tm-pbi-confirmation-text {
            margin: 9px 0 21px;
            color: #667085;
            font-size: 13px;
            line-height: 1.5;
        }

        #${confirmationId} .tm-pbi-confirmation-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }

        #${confirmationId} button {
            padding: 11px 18px;
            border: 1px solid #d7dde7;
            border-radius: 11px;
            background: #f8fafc;
            color: #344054;
            cursor: pointer;
            font: 700 14px/1 "Segoe UI", sans-serif;
        }

        #${confirmationId} button[data-answer="yes"] {
            border-color: #2563a7;
            background: #2563a7;
            color: #fff;
        }

        #${confirmationId} button:hover {
            filter: brightness(0.97);
        }

        #${confirmationId} button:focus-visible {
            outline: 3px solid rgba(37, 99, 167, 0.28);
            outline-offset: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
            [${stateAttribute}] {
                animation: none !important;
                transition: none !important;
            }
        }
    `;

    function ensureStyles() {
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = styles;
            (document.head || document.documentElement).appendChild(style);
        }
    }

    function ensureInterface() {
        ensureStyles();

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

    function showConfirmation() {
        ensureStyles();

        return new Promise(resolve => {
            const previous = document.getElementById(confirmationId);
            if (previous) previous.remove();

            const overlay = document.createElement('div');
            overlay.id = confirmationId;
            overlay.innerHTML = `
                <section
                    class="tm-pbi-confirmation-card"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="tm-pbi-confirmation-title"
                >
                    <div class="tm-pbi-confirmation-icon" aria-hidden="true">↻</div>
                    <h2
                        id="tm-pbi-confirmation-title"
                        class="tm-pbi-confirmation-title"
                    >Czy chcesz odświeżyć wszystkie dane?</h2>
                    <p class="tm-pbi-confirmation-text">
                        Elementy zostaną uruchomione po kolei, w odstępie jednej sekundy.
                    </p>
                    <div class="tm-pbi-confirmation-actions">
                        <button type="button" data-answer="no">Nie</button>
                        <button type="button" data-answer="yes">Tak</button>
                    </div>
                </section>
            `;

            let settled = false;
            const decide = answer => {
                if (settled) return;
                settled = true;
                document.removeEventListener('keydown', handleKeydown);
                overlay.remove();
                resolve(answer);
            };
            const handleKeydown = event => {
                if (event.key === 'Escape') decide(false);
            };

            overlay.querySelector('[data-answer="yes"]')
                .addEventListener('click', () => decide(true));
            overlay.querySelector('[data-answer="no"]')
                .addEventListener('click', () => decide(false));
            document.addEventListener('keydown', handleKeydown);
            document.body.appendChild(overlay);
            overlay.querySelector('[data-answer="yes"]').focus();
        });
    }

    function startQueue() {
        isRunning = true;
        ensureInterface();

        observer = new MutationObserver(scheduleScan);
        observer.observe(document.documentElement, {
            subtree: true,
            childList: true
        });

        startTimer = setTimeout(() => {
            startTimer = null;
            scanForButtons();
            processNext();
            tickTimer = setInterval(processNext, CLICK_INTERVAL_MS);
        }, START_DELAY_MS);
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

    function findRow(element) {
        const semanticRow = element.closest([
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
        // dokładnie jeden przycisk odświeżania albo spinner danego elementu.
        let parent = element.parentElement;
        let fallback = parent;

        for (let depth = 0; parent && depth < 8; depth += 1) {
            const refreshButtons = parent.querySelectorAll(BUTTON_SELECTOR);
            const hasSpinner = parent.querySelector(SPINNER_SELECTOR);
            const width = parent.getBoundingClientRect().width;

            if ((refreshButtons.length === 1 || hasSpinner) && width >= 320) {
                fallback = parent;
                break;
            }
            parent = parent.parentElement;
        }

        return fallback || element;
    }

    function getRowKey(row) {
        const link = row.querySelector('a[href]');

        if (link?.href) {
            return `href:${link.href.split('?')[0].split('#')[0]}`;
        }

        const idCarrier = row.matches('[data-object-id], [data-item-id]')
            ? row
            : row.querySelector('[data-object-id], [data-item-id]');
        const stableId = idCarrier?.getAttribute('data-object-id') ||
            idCarrier?.getAttribute('data-item-id');
        if (stableId) return `id:${stableId}`;

        const nameElement = row.querySelector('[data-testid*="name" i]');
        const name = normalizeText(nameElement?.textContent);
        if (name) return `name:${name}`;

        // Usuwamy wspólne kontrolki i spinner, aby kluczem była treść
        // konkretnego elementu, a nie powtarzający się napis z przycisku.
        const clone = row.cloneNode(true);
        for (const removable of clone.querySelectorAll([
            'button',
            'mat-icon',
            'spinner',
            '.dataflow-refresh-icons',
            '[data-testid="spinner"]'
        ].join(','))) {
            removable.remove();
        }
        const rowText = normalizeText(clone.textContent);
        if (rowText) return `text:${rowText}`;

        // Ostatnia opcja działa, dopóki Power BI nie wymieni całego wiersza.
        if (!row.dataset.tmPbiLocalKey) {
            row.dataset.tmPbiLocalKey = crypto.randomUUID?.() ||
                `${Date.now()}-${Math.random()}`;
        }
        return `local:${row.dataset.tmPbiLocalKey}`;
    }

    function setRowState(row, state) {
        if (!row?.isConnected) return;
        row.setAttribute(stateAttribute, state);
    }

    function syncRefreshIndicators() {
        for (const spinner of document.querySelectorAll(SPINNER_SELECTOR)) {
            const row = findRow(spinner);
            const key = getRowKey(row);

            observedSpinnerKeys.add(key);
            processedKeys.add(key);
            setRowState(row, 'running');
        }

        for (const row of document.querySelectorAll(
            `[${stateAttribute}="running"]`
        )) {
            if (row.querySelector(SPINNER_SELECTOR)) continue;

            const key = getRowKey(row);
            if (observedSpinnerKeys.has(key)) {
                setRowState(row, 'triggered');
            }
        }
    }

    function pruneQueue() {
        for (let index = queue.length - 1; index >= 0; index -= 1) {
            const item = queue[index];
            if (isUsableButton(item.button) &&
                !processedKeys.has(item.key)) continue;

            queue.splice(index, 1);
            queuedKeys.delete(item.key);
            queuedButtons.delete(item.button);
            item.button.removeAttribute?.(queuedAttribute);
        }
    }

    function scanForButtons() {
        ensureInterface();
        syncRefreshIndicators();

        for (const button of document.querySelectorAll(BUTTON_SELECTOR)) {
            if (processedButtons.has(button) || queuedButtons.has(button)) continue;

            const row = findRow(button);
            const key = getRowKey(row);

            if (processedKeys.has(key)) {
                processedButtons.add(button);
                const isRefreshing = row.querySelector(SPINNER_SELECTOR);
                const state = isRefreshing || !observedSpinnerKeys.has(key)
                    ? 'running'
                    : 'triggered';
                setRowState(row, state);
                continue;
            }

            if (!isUsableButton(button) || queuedKeys.has(key)) continue;

            queuedButtons.add(button);
            queuedKeys.add(key);
            button.setAttribute(queuedAttribute, 'true');
            queue.push({ button, row, key });
        }

        updatePanel();
    }

    function processNext() {
        if (!isRunning) return;

        // Power BI potrafi wymienić wszystkie elementy DOM po pierwszym
        // kliknięciu. Najpierw usuwamy więc nieaktualne referencje.
        pruneQueue();
        scanForButtons();

        let item = queue.shift();
        while (item && (!isUsableButton(item.button) ||
            processedKeys.has(item.key))) {
            queuedKeys.delete(item.key);
            queuedButtons.delete(item.button);
            item = queue.shift();
        }

        if (!item) {
            updatePanel();
            return;
        }

        const { button, row, key } = item;
        queuedKeys.delete(key);
        queuedButtons.delete(button);
        processedButtons.add(button);
        processedKeys.add(key);
        button.removeAttribute(queuedAttribute);
        setRowState(row, 'running');

        try {
            button.click();
            clickedCount += 1;
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

    async function initialize() {
        if (!document.body) {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve, {
                    once: true
                });
            });
        }

        const confirmed = await showConfirmation();
        if (confirmed) startQueue();
    }

    initialize();

    window.addEventListener('pagehide', () => {
        observer?.disconnect();
        clearInterval(tickTimer);
        clearTimeout(scanTimer);
        clearTimeout(startTimer);
    }, { once: true });
})();
