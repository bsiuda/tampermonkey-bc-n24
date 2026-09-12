// ==UserScript==
// @name         mBank - data końcowa do 13. dnia miesiąca
// @namespace    local.mbank.date-filter
// @version      1.3.2
// @description  Data do 13. dnia miesiąca, kolory i ikony kategorii transakcji.
// @homepageURL  https://chatgpt.com/share/6aa50138-faa8-83eb-8104-e1efb7d80301
// @match        https://online.mbank.pl/*
// @downloadURL  https://raw.githubusercontent.com/bsiuda/tampermonkey-bc-n24/main/mBank_RowHighlight.user.js
// @updateURL    https://raw.githubusercontent.com/bsiuda/tampermonkey-bc-n24/main/mBank_RowHighlight.user.js
// @run-at       document-idle
// @grant        none
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    // KOLORY WIERSZY — na każdej podstronie online.mbank.pl.
    const toneAttribute = 'data-tm-mbank-tone';
    const iconAttribute = 'data-tm-mbank-icon';
    const iconCellAttribute = 'data-tm-mbank-icon-cell';
    const styleId = 'tm-mbank-transaction-colors';

    // Ikony SVG są zapisane w skrypcie; nie wymagają pobierania plików.
    const icons = {
        green: {
            label: 'Inwestycje',
            paths: [
                'M4 4v16h16',
                'M7 14l4-4 4 2 5-7',
                'M15 5h5v5'
            ]
        },
        red: {
            label: 'Raty / kredyty / leasing',
            paths: [
                'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
                'M3 9h18',
                'M7 14h3m3 0h4'
            ]
        },
        orange: {
            label: 'Subskrypcje',
            paths: [
                'M17 3l4 4-4 4',
                'M3 11V9a2 2 0 0 1 2-2h16',
                'M7 21l-4-4 4-4',
                'M21 13v2a2 2 0 0 1-2 2H3'
            ]
        },
        blue: {
            label: 'Rachunki',
            paths: [
                'M6 3h12v18l-3-2-3 2-3-2-3 2V3Z',
                'M9 7h6M9 11h6M9 15h4'
            ]
        }
    };

    const styles = `
        tr[${toneAttribute}="green"] {
            --tm-mbank-bg: #edf8f1;
            --tm-mbank-hover: #def1e6;
            --tm-mbank-accent: #259765;
            --tm-mbank-line: #d4e9dc;
        }
        tr[${toneAttribute}="orange"] {
            --tm-mbank-bg: #fff3e7;
            --tm-mbank-hover: #ffe8d0;
            --tm-mbank-accent: #d9812c;
            --tm-mbank-line: #f0ddc7;
        }
        tr[${toneAttribute}="red"] {
            --tm-mbank-bg: #fff0f1;
            --tm-mbank-hover: #ffe1e4;
            --tm-mbank-accent: #d75767;
            --tm-mbank-line: #f0d7dc;
        }
        tr[${toneAttribute}="blue"] {
            --tm-mbank-bg: #eef5ff;
            --tm-mbank-hover: #dfebff;
            --tm-mbank-accent: #4b82d0;
            --tm-mbank-line: #d4e2f5;
        }
        tr[${toneAttribute}] > td {
            background: var(--tm-mbank-bg) !important;
            border-bottom-color: var(--tm-mbank-line) !important;
            transition: background-color 160ms ease !important;
        }
        tr[${toneAttribute}]:hover > td,
        tr[${toneAttribute}]:focus-within > td {
            background: var(--tm-mbank-hover) !important;
        }
        tr[${toneAttribute}] > td:first-child {
            box-shadow: inset 3px 0 0 var(--tm-mbank-accent) !important;
            border-top-left-radius: 8px;
            border-bottom-left-radius: 8px;
        }
        tr[${toneAttribute}] > td:last-child {
            border-top-right-radius: 8px;
            border-bottom-right-radius: 8px;
        }
        tr[${toneAttribute}] > td[${iconCellAttribute}] {
            position: relative;
            padding-inline-start: 56px !important;
        }
        tr[${toneAttribute}] > td > span[${iconAttribute}] {
            position: absolute;
            inset-inline-start: 12px;
            top: 50%;
            transform: translateY(-50%);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 30px;
            height: 30px;
            box-sizing: border-box;
            border: 1px solid var(--tm-mbank-line);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.8);
            color: var(--tm-mbank-accent) !important;
            box-shadow: 0 2px 5px rgba(20, 35, 55, 0.06);
            line-height: 0;
            user-select: none;
        }
        span[${iconAttribute}] > svg {
            display: block;
            width: 20px;
            height: 20px;
            fill: none !important;
            stroke: currentColor !important;
            pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
            tr[${toneAttribute}] > td { transition: none !important; }
        }
    `;

    function ensureStyles() {
        let style = document.getElementById(styleId);
        if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            (document.head || document.documentElement).appendChild(style);
        }
        if (style.textContent !== styles) style.textContent = styles;
    }

    function syncRowIcon(row, cell, tone) {
        const definition = icons[tone];
        const badges = Array.from(row.querySelectorAll(
            `:scope > td > span[${iconAttribute}]`
        ));
        let badge = badges.find(item => item.parentElement === cell);

        // Usuwamy duplikaty i ikony z poprzedniej kolumny lub kategorii.
        for (const item of badges) {
            if (!definition || item !== badge) item.remove();
        }
        for (const rowCell of row.cells) {
            if (!definition || rowCell !== cell) {
                rowCell.removeAttribute(iconCellAttribute);
            }
        }
        if (!definition || !cell) return;

        cell.setAttribute(iconCellAttribute, '');
        if (!badge) {
            badge = document.createElement('span');
            badge.setAttribute(iconAttribute, '');
            cell.prepend(badge);
        }
        if (badge.getAttribute(iconAttribute) === tone &&
            badge.firstElementChild) return;

        badge.setAttribute(iconAttribute, tone);
        badge.setAttribute('role', 'img');
        badge.setAttribute('aria-label', definition.label);
        badge.title = definition.label;

        const svgNamespace = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNamespace, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '1.8');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');

        for (const pathData of definition.paths) {
            const path = document.createElementNS(svgNamespace, 'path');
            path.setAttribute('d', pathData);
            svg.appendChild(path);
        }
        // Ikona nie dodaje tekstu do opisu używanego przez reguły.
        badge.replaceChildren(svg);
    }

    function normalizeText(text) {
        return String(text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/ł/g, 'l')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function chooseTone(description, transactionType) {
        const desc = normalizeText(description);
        const type = normalizeText(transactionType);

        // Priorytet: czerwony > niebieski > pomarańczowy > zielony.
        // Obsługujemy również literówki z opisu reguł.
        if (
            /splata pozycz(?:ki|yki)/.test(desc) ||
            desc.includes('santander leasing')
        ) {
            return 'red';
        }
        if (
            desc.includes('tauron') ||
            desc.includes('spolka wodociagowa')
        ) {
            return 'blue';
        }
        if (type.includes('subskrypcja') || type.includes('subskypcja')) {
            return 'orange';
        }
        if (
            desc.includes('kcz') ||
            desc.includes('ikze') ||
            desc.includes('darowizna') ||
            desc.includes('xtb')
        ) {
            return 'green';
        }
        return '';
    }

    function findColumns(table) {
        const headerRows = table.tHead
            ? Array.from(table.tHead.rows)
            : Array.from(table.rows).filter(row =>
                Array.from(row.cells).some(cell => cell.tagName === 'TH')
            );

        let best = { description: -1, type: -1, score: 0 };
        for (const row of headerRows) {
            let description = -1;
            let type = -1;
            let column = 0;
            for (const cell of row.cells) {
                const label = normalizeText(cell.textContent);
                if (/^opis(?:\s|:|$)/.test(label)) description = column;
                if (/^typ transakcji(?:\s|:|$)/.test(label)) type = column;
                column += cell.colSpan;
            }
            const score = Number(description >= 0) + Number(type >= 0);
            if (score > best.score) best = { description, type, score };
        }
        return best;
    }

    function highlightRows() {
        ensureStyles();
        const coloredRows = new Set();

        for (const table of document.querySelectorAll('table')) {
            const columns = findColumns(table);
            if (!columns.score) continue;

            for (const body of table.tBodies) {
                for (const row of body.rows) {
                    const cells = Array.from(row.cells);

                    // Pomijamy nagłówki i scalone wiersze rozwijanych szczegółów.
                    if (cells.some(cell => cell.tagName !== 'TD' ||
                        cell.colSpan !== 1 || cell.rowSpan !== 1)) continue;

                    const tone = chooseTone(
                        cells[columns.description]?.textContent,
                        cells[columns.type]?.textContent
                    );
                    if (!tone) continue;

                    coloredRows.add(row);
                    if (row.getAttribute(toneAttribute) !== tone) {
                        row.setAttribute(toneAttribute, tone);
                    }
                    syncRowIcon(
                        row,
                        cells[columns.description] || cells[columns.type],
                        tone
                    );
                }
            }
        }

        // Usuwamy stary kolor i ikonę, gdy bank podmieni treść wiersza.
        const decoratedRows = new Set(
            document.querySelectorAll(`tr[${toneAttribute}]`)
        );
        for (const cell of document.querySelectorAll(`td[${iconCellAttribute}]`)) {
            decoratedRows.add(cell.parentElement);
        }
        for (const row of decoratedRows) {
            if (!coloredRows.has(row)) {
                row.removeAttribute(toneAttribute);
                syncRowIcon(row, null, '');
            }
        }
    }

    let highlightTimer = null;
    function scheduleHighlight() {
        if (highlightTimer !== null) return;
        highlightTimer = setTimeout(() => {
            highlightTimer = null;
            highlightRows();
        }, 100);
    }

    // Reagujemy na doładowanie listy, filtrowanie i wymianę treści wierszy.
    const observer = new MutationObserver(scheduleHighlight);
    observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true
    });
    highlightRows();

    // DATA KOŃCOWA — tylko w widoku płatności przyszłych.
    const selector = 'input[data-test-id="dateFilter:customDateEnd"]';
    const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
    ).set;

    let previousPath = '';
    let applied = false;

    function updateDate() {
        const path = location.pathname.replace(/\/+$/, '');

        // Ponowne wejście do widoku pozwala ponownie ustawić datę.
        if (path !== previousPath) {
            previousPath = path;
            applied = false;
        }

        if (path !== '/futurepaymentsnew' || applied) return;

        const input = document.querySelector(selector);
        if (!input || input.disabled || input.readOnly) return;

        // Czytamy aktualną wartość pola w formacie DD.MM.RRRR.
        const match = input.value.trim().match(
            /^\d{2}\.(0[1-9]|1[0-2])\.(\d{4})$/
        );
        if (!match) return;

        const newDate = `13.${match[1]}.${match[2]}`;

        // Jedna automatyczna zmiana na wejście; później można edytować ręcznie.
        applied = true;
        if (input.value === newDate) return;

        input.focus({ preventScroll: true });
        setValue.call(input, newDate);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.blur();
    }

    // Czekamy na pole i wykrywamy nawigację bez przeładowania dokumentu.
    setInterval(updateDate, 500);
    updateDate();
})();
