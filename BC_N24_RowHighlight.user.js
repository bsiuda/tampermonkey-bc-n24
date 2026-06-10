// ==UserScript==
// @name         BC N24
// @description  Oznaczanie pol i kolorowanie wierszy w Business Central dla zespolu N24.
// @match        https://businesscentral.dynamics.com/*
// @run-at       document-end
// @version      1.1.3
// @downloadURL  https://raw.githubusercontent.com/bsiuda/tampermonkey-bc-n24/main/BC_N24_RowHighlight.user.js
// @updateURL    https://raw.githubusercontent.com/bsiuda/tampermonkey-bc-n24/main/BC_N24_RowHighlight.user.js
// ==/UserScript==

(function () {

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 1. PODĹšWIETLENIE PĂ“L (nagĹ‚Ăłwek dokumentu)
  //    Grupy kolorystyczne dla pĂłl sterowanych przez controlname.
  //    Aby dodaÄ‡ pole: wstaw wpis "controlname": "Etykieta PL"
  //    do wybranej grupy.
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const GROUPS = {
    red: {
      controls: {
        "Document Date":            'Data dokumentu ("D")',
        "ITIDeliveryDateInvPeriod": 'Data usĹ‚ugi ("D")',
        "ITI VAT Delivery Date":    'Data usĹ‚ugi ("D")',
        "PostingDate":              "Data ksiÄ™gowania (ostatni dzieĹ„ msc)",
        "Posting Date":             "Data ksiÄ™gowania (ostatni dzieĹ„ msc)"
      },
      style: {
        background:      "#ffcdd2",
        border:          "1px solid #ef9a9a",
        inputBackground: "#ef9a9a",
        textColor:       "#111111"
      }
    },
    green: {
      controls: {
        // "SomeField": "Etykieta PL"
      },
      style: {
        background:      "#c8e6c9",
        border:          "1px solid #81c784",
        inputBackground: "#a5d6a7",
        textColor:       "#111111"
      }
    },
    yellow: {
      controls: {
        // "AnotherField": "Etykieta PL"
      },
      style: {
        background:      "#fff9c4",
        border:          "1px solid #f9a825",
        inputBackground: "#fff176",
        textColor:       "#111111"
      }
    }
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 2. KOLOROWANIE WIERSZY SIATKI
  //    match     â€” string lub tablica stringĂłw (title= lub textContent)
  //    className â€” klasa CSS dodawana do <tr>
  //    matchMode â€” "equals" (domyĹ›lnie) albo "contains"
  //    CSS klas definiuj w ROW_RULES_CSS poniĹĽej.
  //    Aby dodaÄ‡ reguĹ‚Ä™: dodaj obiekt i odpowiadajÄ…cy wpis w CSS.
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const ROW_RULES = [
    { match: "Fixed Price",          className: "n24-row--fixed-price" },
    { match: "Time & Material",      className: "n24-row--tnm"         },
    { match: ["Suma", "Total"],      className: "n24-row--summary", matchMode: "contains" },
  ];

  const REQUIRED_HEADERS = [
    { key: "W_KLIENT", aliases: ["W_KLIENT", "W_KLIENTA"] },
    { key: "W_LINIA_PRODUKTOWA", aliases: ["W_LINIA PRODUKTOWA", "W_LINIA_PRODUKTOWA"] },
    { key: "W_PROJEKT_TYP", aliases: ["W_PROJEKT TYP", "W_PROJEKT_TYP"] },
    { key: "W_RODZAJ_DZIALANIA", aliases: ["W_RODZAJ DZIAĹANIA", "W_RODZAJ_DZIAĹANIA", "W_RODZAJ DZIALANIA"] },
    { key: "W_DZIAL", aliases: ["W_DZIAĹ", "W_DZIAL"] }
  ];

  const MASK_SOURCE_TEXT = "BE778D2A";
  const MASK_TARGET_TEXT = "DEL_BSIUDA";

  function normalizeText(value) {
    return (value || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .trim();
  }

  const ROW_RULES_CSS = `
    /* Fixed Price â€” bardzo jasny zielony */
    tr.n24-row--fixed-price td {
      background-color: #e8f5e9 !important;
    }
    /* Time & Material â€” bardzo jasny ĹĽĂłĹ‚ty */
    tr.n24-row--tnm td {
      background-color: #fffde7 !important;
    }
    /* Suma / Total â€” pogrubiony tekst */
    tr.n24-row--summary td {
      font-weight: 700 !important;
    }
    tr.n24-row--summary .stringcontrol-read,
    tr.n24-row--summary a {
      font-weight: 700 !important;
    }

    /* Brak wymaganych pĂłl W_* â€” czerwony caĹ‚y wiersz (priorytet) */
    tr.n24-row--missing-required td {
      background-color: #ffcdd2 !important;
    }
  `;

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Implementacja â€” nie trzeba tu nic zmieniaÄ‡
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function buildFieldCSS() {
    return Object.entries(GROUPS).map(([, group]) => {
      const { controls, style } = group;
      const keys = Object.keys(controls);
      if (!keys.length) return "";

      const sel        = keys.map(k => `[controlname="${k}"]`).join(", ");
      const selEdit    = keys.map(k => `[controlname="${k}"] .edit-container`).join(", ");
      const selInput   = keys.flatMap(k => [
        `[controlname="${k}"] input`,
        `[controlname="${k}"] [role="combobox"]`
      ]).join(", ");
      const selPicker  = keys.map(k => `[controlname="${k}"] .ms-nav-valuepickerbutton-embedded`).join(", ");
      const selCaption = keys.flatMap(k =>
        ["", ":link", ":visited", ":hover", ":focus"].map(
          pseudo => `[controlname="${k}"] .ms-nav-edit-control-caption${pseudo}`
        )
      ).join(", ");

      return `
        ${sel} {
          background: ${style.background} !important;
          border: ${style.border} !important;
          border-radius: 6px !important;
          padding: 4px !important;
        }
        ${selEdit} { background: ${style.background} !important; }
        ${selInput} {
          background: ${style.inputBackground} !important;
          color: ${style.textColor} !important;
          border-color: ${style.textColor} !important;
        }
        ${selPicker} { color: ${style.textColor} !important; }
        ${selCaption} {
          background: transparent !important;
          color: ${style.textColor} !important;
          font-weight: 700 !important;
          text-decoration: none !important;
          white-space: normal !important;
          overflow: visible !important;
          text-overflow: clip !important;
          line-height: 1.2 !important;
        }
      `;
    }).join("\n");
  }

  function ensureStyles() {
    if (document.getElementById("n24-style")) return;
    const style = document.createElement("style");
    style.id = "n24-style";
    style.textContent = buildFieldCSS() + ROW_RULES_CSS;
    document.head.appendChild(style);
  }

  function applyFieldLabels() {
    Object.values(GROUPS).forEach(({ controls }) => {
      Object.entries(controls).forEach(([target, newText]) => {
        document.querySelectorAll(`[controlname="${target}"]`).forEach((container) => {
          const label = container.querySelector(".ms-nav-edit-control-caption");
          if (label && label.textContent !== newText) label.textContent = newText;

          const input = container.querySelector('input, [role="combobox"]');
          if (input) input.setAttribute("aria-label", newText);

          const pickerBtn = container.querySelector(".ms-nav-valuepickerbutton-embedded");
          if (pickerBtn) {
            pickerBtn.setAttribute("title", `OtwĂłrz selektor daty dla ${newText}`);
            pickerBtn.setAttribute("aria-label", `OtwĂłrz selektor daty dla ${newText}`);
          }
        });
      });
    });
  }

  function applySensitiveTextMask() {
    const source = MASK_SOURCE_TEXT.toUpperCase();

    document.querySelectorAll('[role="textbox"], a[role="button"], .stringcontrol-read.value').forEach((el) => {
      const text = (el.textContent || "").trim();
      const title = el.getAttribute("title") || "";
      const aria = el.getAttribute("aria-label") || "";

      if (text && text.toUpperCase().includes(source) && text !== MASK_TARGET_TEXT) {
        el.textContent = MASK_TARGET_TEXT;
      }

      if (title && title.toUpperCase().includes(source) && title !== MASK_TARGET_TEXT) {
        el.setAttribute("title", MASK_TARGET_TEXT);
      }

      if (aria && aria.toUpperCase().includes(source) && aria !== MASK_TARGET_TEXT) {
        el.setAttribute("aria-label", MASK_TARGET_TEXT);
      }
    });
  }

  function applyRowHighlights() {
    const allClasses = ROW_RULES.map(r => r.className);
    allClasses.push("n24-row--missing-required");
    const requiredHeaderNorms = REQUIRED_HEADERS.map(h => ({
      key: h.key,
      aliases: h.aliases.map(normalizeText)
    }));

    const headers = [...document.querySelectorAll('[id^="column_header_"]')];
    const headerIdByKey = new Map();
    headers.forEach(h => {
      const headerNorm = normalizeText(h.textContent || "");
      requiredHeaderNorms.forEach(req => {
        const matched = req.aliases.some(alias => headerNorm === alias);
        if (matched) {
          headerIdByKey.set(req.key, h.id);
        }
      });
    });

    // Jesli zadna kolumna W_* nie jest widoczna na tej stronie, pomijamy walidacje
    const pageHasRequiredColumns = headerIdByKey.size > 0;

    document.querySelectorAll('tr[role="row"][rowkey]').forEach(row => {
      const rawValues =
        [...row.querySelectorAll('[role="textbox"], [role="button"], [role="gridcell"] span')]
          .flatMap(el => [el.getAttribute("title"), el.textContent.trim()])
          .filter(Boolean);

      const normalizedValues = rawValues
        .map(v => v.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      const normalizedValuesLower = normalizedValues.map(v => v.toLowerCase());

      // WyczyĹ›Ä‡ poprzednie klasy n24, dodaj pasujÄ…ce
      row.classList.remove(...allClasses);

      ROW_RULES.forEach(rule => {
        const values = Array.isArray(rule.match) ? rule.match : [rule.match];
        const mode = rule.matchMode || "equals";
        const matched = values.some(v => {
          const needle = String(v).toLowerCase();
          if (mode === "contains") {
            return normalizedValuesLower.some(cell => cell.includes(needle));
          }
          return normalizedValuesLower.some(cell => cell === needle);
        });

        if (matched) {
          row.classList.add(rule.className);
        }
      });

      const isSummaryRow = row.classList.contains("n24-row--summary");

      const hasMissingRequired = !isSummaryRow && pageHasRequiredColumns && REQUIRED_HEADERS.some(required => {
        const headerId = headerIdByKey.get(required.key);
        if (!headerId) return false;

        // Czytamy komĂłrkÄ™ po tokenie aria-labelledby=column_header_xxx
        const cell = row.querySelector(`[aria-labelledby~="${headerId}"]`);
        if (!cell) return true;

        const valueText = (cell.textContent || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
        const valueTitle = (cell.getAttribute("title") || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
        const valueAria = (cell.getAttribute("aria-label") || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

        const ariaSaysEmpty = valueAria.includes("(puste)") || valueAria === "puste";

        return ariaSaysEmpty || (!valueText && !valueTitle);
      });

      if (hasMissingRequired) {
        row.classList.add("n24-row--missing-required");
      }
    });
  }

  function run() {
    ensureStyles();
    applySensitiveTextMask();
    applyFieldLabels();
    applyRowHighlights();
  }

  run();

  const observer = new MutationObserver(run);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();

