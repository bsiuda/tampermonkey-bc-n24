// ==UserScript==
// @name         BC N24
// @description  Oznaczanie pol i kolorowanie wierszy w Business Central dla zespolu N24.
// @match        https://businesscentral.dynamics.com/*
// @match        https://app.hrnest.io/*
// @match        *://*/*
// @run-at       document-end
// @version      1.4.23
// @downloadURL  https://raw.githubusercontent.com/bsiuda/tampermonkey-bc-n24/main/BC_N24_RowHighlight.user.js
// @updateURL    https://raw.githubusercontent.com/bsiuda/tampermonkey-bc-n24/main/BC_N24_RowHighlight.user.js
// @chatgptURL   https://chatgpt.com/share/6aa50138-faa8-83eb-8104-e1efb7d80301
// ==/UserScript==

(function () {

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 1. PODŚWIETLENIE PÓL (nagłówek dokumentu)
  //    Grupy kolorystyczne dla pól sterowanych przez controlname.
  //    Aby dodać pole: wstaw wpis "controlname": "Etykieta PL"
  //    do wybranej grupy.
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const GROUPS = {
    red: {
      controls: {
        "Document Date":            'Data dokumentu ("D")',
        "ITIDeliveryDateInvPeriod": 'Data usługi ("D")',
        "ITI VAT Delivery Date":    'Data usługi ("D")',
        "PostingDate":              "Data księgowania (ostatni dzień msc)",
        "Posting Date":             "Data księgowania (ostatni dzień msc)"
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
    { key: "W_RODZAJ_DZIALANIA", aliases: ["W_RODZAJ DZIAŁANIA", "W_RODZAJ_DZIAŁANIA", "W_RODZAJ DZIALANIA", "W_RODZAJ DZIAŁANIA / PRODUKT"] },
    { key: "W_DZIAL", aliases: ["W_DZIAŁ", "W_DZIAL"] }
  ];

  const COLORING_PAGE_IDS = new Set(["88", "1001", "50100"]);
  const DIMENSION_INDICATOR_PAGE_IDS = new Set(["88", "1001"]);
  const QUANTITY_WARNING_THRESHOLD = 6;
  const ROW_INDICATOR_ATTRIBUTE = "data-n24-row-indicator";
  const LONG_JOURNAL_CONFIRMATION_TEXT = "W dzienniku są zapisy dłuższe niż 8h";
  const PROJECT_JOURNAL_HEADER_SIGNATURE = [
    "Nr zadania projektu",
    "DevOps ID",
    "Zużycie budżetu",
    "Ilość"
  ].map(normalizeText);
  const PROJECT_CARD_TITLE = normalizeText("Kartoteka projektu");
  const PROJECT_TASK_HEADER_SIGNATURE = normalizeText("Nr zadania projektu");
  const PROJECT_TASK_TYPE_HEADER_ALIASES = [
    "Typ zadania projektu",
    "Job Task Type"
  ].map(normalizeText);
  const PROJECT_TASK_COLORING_STATUSES = new Set([
    normalizeText("Posting"),
    normalizeText("Księgowalne")
  ]);
  const PROJECT_CARD_TOGGLE_SECTION_NAMES = [
    "Ogólne",
    "Wartość zakontraktowana",
    "Wymiary",
    "Księgowanie",
    "Faktura i wydanie",
    "Czas trwania",
    "RWT i uznanie",
    "Integracja z systemami zewnętrznymi",
    "Integracje z systemami zewnętrznymi"
  ].map(normalizeText);
  const PROJECT_CARD_SECTION_HIDDEN_CLASS = "n24-project-card-section--hidden";
  const PROJECT_CARD_SECTION_TOGGLE_ID = "n24-project-card-section-toggle";
  const PROJECT_TASK_MAXIMIZED_CLASS = "n24-project-task--maximized";
  const PROJECT_TASK_MAXIMIZE_BUTTON_ID = "n24-project-task-maximize";

  const MASK_SOURCE_TEXT = "BE778D2A";
  const MASK_TARGET_TEXT = "DEL_BSIUDA";

  const AUTO_APPROVE_DELAY_MS = 1200;
  const AUTO_APPROVE_CLICK_FLAG_PREFIX = "n24_autoapprove_clicked";
  const AUTO_APPROVE_ALLOWED_PATHS = [
    "/requests",
    "/approvals",
    "/wnioski"
  ];
  const JOURNAL_NO_CLICK_DELAY_MS = 2000;

  let autoApprovePendingClickTimer = null;
  let journalLongEntriesConfirmationTimer = null;
  let journalLongEntriesConfirmationPending = false;
  let projectCardSectionsHidden = false;
  let projectTaskMaximized = false;
  const projectTaskGridOriginalStyles = new Map();
  let projectTaskGridElement = null;
  let projectTaskGridContainerElement = null;
  let projectTaskMaximizeListenersAttached = false;

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
    tr.n24-row--quantity-warning td,
    tr.n24-row--quantity-warning td * {
      background-color: #c62828 !important;
      color: #fff !important;
      font-weight: 700 !important;
    }
    tr.n24-row--missing-dimensions-emphasis td,
    tr.n24-row--missing-dimensions-emphasis td * {
      background-color: #c62828 !important;
      color: #fff !important;
      font-weight: 700 !important;
    }
    [${ROW_INDICATOR_ATTRIBUTE}] {
      display: inline-block;
      margin-right: 6px;
      font-weight: 800;
      vertical-align: middle;
      white-space: nowrap;
    }
    .n24-row-indicator--dimensions {
      color: #b26a00 !important;
    }
    tr.n24-row--quantity-warning [${ROW_INDICATOR_ATTRIBUTE}].n24-row-indicator--quantity {
      color: #b71c1c !important;
      background-color: #fff !important;
      border-radius: 50%;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      font-size: 1em;
      font-weight: 900;
      height: 1.35em;
      line-height: 1.35em;
      min-width: 1.35em;
      text-align: center;
    }
    tr.n24-row--missing-dimensions-emphasis [${ROW_INDICATOR_ATTRIBUTE}].n24-row-indicator--dimensions {
      color: #b26a00 !important;
      background-color: #fff !important;
      border-radius: 50%;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      font-size: 1em;
      font-weight: 900;
      height: 1.35em;
      line-height: 1.35em;
      min-width: 1.35em;
      text-align: center;
    }
    .${PROJECT_CARD_SECTION_HIDDEN_CLASS} {
      display: none !important;
    }
    .${PROJECT_TASK_MAXIMIZED_CLASS} {
      position: fixed !important;
      inset: 40px 0 0 !important;
      z-index: 99999 !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      background: #fff !important;
    }
    #${PROJECT_CARD_SECTION_TOGGLE_ID},
    #${PROJECT_TASK_MAXIMIZE_BUTTON_ID} {
      position: fixed;
      top: 52px;
      z-index: 100000;
      padding: 7px 12px;
      border: 1px solid #0078d4;
      border-radius: 3px;
      background: #fff;
      color: #0078d4;
      font: 600 13px "Segoe UI", sans-serif;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    }
    #${PROJECT_CARD_SECTION_TOGGLE_ID} {
      right: 170px;
    }
    #${PROJECT_TASK_MAXIMIZE_BUTTON_ID} {
      right: 270px;
    }
    #${PROJECT_CARD_SECTION_TOGGLE_ID}:hover,
    #${PROJECT_TASK_MAXIMIZE_BUTTON_ID}:hover {
      background: #f3f9fd;
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

  function ensureStyles(enabled) {
    const existingStyle = document.getElementById("n24-style");
    if (!enabled) {
      existingStyle?.remove();
      document.querySelectorAll(`[${ROW_INDICATOR_ATTRIBUTE}]`).forEach(indicator => indicator.remove());
      return;
    }
    if (existingStyle) return;
    const style = document.createElement("style");
    style.id = "n24-style";
    style.textContent = buildFieldCSS() + ROW_RULES_CSS;
    document.head.appendChild(style);
  }

  function getBusinessCentralPageId() {
    const pageEntry = [...new URLSearchParams(location.search).entries()]
      .find(([key]) => key.toLowerCase() === "page");
    return pageEntry?.[1] || "";
  }

  function isProjectJournalPage() {
    const pageTitle = normalizeText(document.body?.innerText || "");
    if (!pageTitle.includes(normalizeText("Dzienniki projektów"))) return false;

    const headers = [...document.querySelectorAll('[id^="column_header_"]')]
      .map(header => normalizeText(header.textContent || ""));
    const hasJournalHeaders = PROJECT_JOURNAL_HEADER_SIGNATURE.every(signature => (
      headers.some(header => header.includes(signature))
    ));

    return hasJournalHeaders && Boolean(document.querySelector('[controlname="Quantity"]'));
  }

  function isProjectCardPage() {
    const pageText = normalizeText(document.body?.innerText || "");
    if (!pageText.includes(PROJECT_CARD_TITLE)) return false;

    return [...document.querySelectorAll('[id^="column_header_"]')]
      .some(header => normalizeText(header.textContent || "").includes(PROJECT_TASK_HEADER_SIGNATURE));
  }

  function isColoringPage(pageId, isProjectJournal, isProjectCard) {
    return COLORING_PAGE_IDS.has(pageId) || isProjectJournal || isProjectCard;
  }

  function findProjectJournalDialog() {
    const expectedText = normalizeText(LONG_JOURNAL_CONFIRMATION_TEXT);
    return [...document.querySelectorAll(".message-dialog")]
      .find(element => normalizeText(element.textContent).includes(expectedText));
  }

  function findJournalNoButton(dialog) {
    return [...dialog.querySelectorAll("button")].find(button => (
      normalizeText(button.textContent) === "nie"
      && !button.disabled
      && button.getAttribute("aria-disabled") !== "true"
    ));
  }

  function cancelJournalConfirmation() {
    if (journalLongEntriesConfirmationTimer !== null) {
      clearTimeout(journalLongEntriesConfirmationTimer);
      journalLongEntriesConfirmationTimer = null;
    }
    journalLongEntriesConfirmationPending = false;
  }

  function applyJournalLongEntriesConfirmation(isProjectJournal) {
    const dialog = findProjectJournalDialog();
    if (!dialog || !isProjectJournal) {
      cancelJournalConfirmation();
      return;
    }
    if (journalLongEntriesConfirmationPending || !findJournalNoButton(dialog)) return;

    journalLongEntriesConfirmationPending = true;
    journalLongEntriesConfirmationTimer = setTimeout(() => {
      journalLongEntriesConfirmationTimer = null;

      const currentDialog = findProjectJournalDialog();
      if (!dialog.isConnected || currentDialog !== dialog || !isProjectJournalPage()) {
        journalLongEntriesConfirmationPending = false;
        return;
      }

      const confirmButton = findJournalNoButton(currentDialog);
      if (!confirmButton) {
        journalLongEntriesConfirmationPending = false;
        return;
      }

      confirmButton.click();
    }, JOURNAL_NO_CLICK_DELAY_MS);
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

  function getMissingRequiredDimensions(row, headerIdByKey) {
    return REQUIRED_HEADERS.filter(required => {
      const headerId = headerIdByKey.get(required.key);
      if (!headerId) return false;

      const cell = row.querySelector(`[aria-labelledby~="${headerId}"]`)
        || row.querySelector(`[controlname="${required.key}"]`);
      if (!cell) return false;

      const valueText = (cell.textContent || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      const valueTitle = (cell.getAttribute("title") || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      const valueAria = (cell.getAttribute("aria-label") || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
      const valueControl = cell.matches?.("input, textarea, select, [role='combobox'], [role='textbox']")
        ? cell
        : cell.querySelector?.("input, textarea, select, [role='combobox'], [role='textbox']");
      const controlValue = String(
        valueControl?.value ?? valueControl?.getAttribute("value") ?? ""
      ).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      const ariaSaysEmpty = valueAria.includes("(puste)") || valueAria === "puste";

      return !controlValue && !valueText && !valueTitle
        && (ariaSaysEmpty || !valueAria);
    }).map(required => required.key);
  }

  function isProjectTaskTypeEligible(row, taskTypeHeader) {
    if (!taskTypeHeader) return false;

    const cell = row.querySelector(`[aria-labelledby~="${taskTypeHeader.id}"]`)
      || row.querySelector('[controlname="Job Task Type"]');
    if (!cell) return false;

    const valueControl = cell.matches?.("input, textarea, select, [role='combobox'], [role='textbox']")
      ? cell
      : cell.querySelector?.("input, textarea, select, [role='combobox'], [role='textbox']");
    const taskType = normalizeText(
      valueControl?.value
      || valueControl?.getAttribute("value")
      || cell.getAttribute("title")
      || cell.getAttribute("aria-label")
      || cell.textContent
      || ""
    );
    return PROJECT_TASK_COLORING_STATUSES.has(taskType);
  }

  function getProjectCardSections() {
    const sections = new Set();
    document.querySelectorAll(".caption-text").forEach(caption => {
      if (!PROJECT_CARD_TOGGLE_SECTION_NAMES.includes(normalizeText(caption.textContent || ""))) {
        return;
      }

      const section = caption.closest(".ms-nav-band")
        || caption.closest(".formhost-control.ms-nav-collapsible-part");
      if (section) sections.add(section);
    });
    return [...sections];
  }

  function applyProjectCardSectionVisibility(isProjectCard) {
    const button = document.getElementById(PROJECT_CARD_SECTION_TOGGLE_ID);
    if (!isProjectCard) {
      getProjectCardSections().forEach(section => {
        section.classList.remove(PROJECT_CARD_SECTION_HIDDEN_CLASS);
      });
      button?.remove();
      projectCardSectionsHidden = false;
      return;
    }

    let toggle = button;
    if (!toggle && document.body) {
      toggle = document.createElement("button");
      toggle.id = PROJECT_CARD_SECTION_TOGGLE_ID;
      toggle.type = "button";
      toggle.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        projectCardSectionsHidden = !projectCardSectionsHidden;
        applyProjectCardSectionVisibility(true);
      });
      document.body.appendChild(toggle);
    }
    if (!toggle) return;

    const toggleLabel = projectCardSectionsHidden ? "Pokaż sekcje" : "Ukryj sekcje";
    if (toggle.textContent !== toggleLabel) {
      toggle.textContent = toggleLabel;
    }
    const pressed = String(projectCardSectionsHidden);
    if (toggle.getAttribute("aria-pressed") !== pressed) {
      toggle.setAttribute("aria-pressed", pressed);
    }
    const title = projectCardSectionsHidden
      ? "Pokaż ukryte sekcje Kartoteki projektu"
      : "Ukryj sekcje Kartoteki projektu";
    if (toggle.title !== title) toggle.title = title;
    getProjectCardSections().forEach(section => {
      section.classList.toggle(
        PROJECT_CARD_SECTION_HIDDEN_CLASS,
        projectCardSectionsHidden
      );
    });
  }

  function getProjectTaskSectionRoot() {
    const subform = document.querySelector('[controlname="Job Task Lines Subform"]');
    return subform?.closest(".formhost-control.ms-nav-collapsible-part")
      || subform?.closest(".formhost-control")
      || subform;
  }

  function rememberProjectTaskGridStyles(element) {
    if (projectTaskGridOriginalStyles.has(element)) return;

    const properties = ["height", "min-height", "max-height"];
    projectTaskGridOriginalStyles.set(element, new Map(properties.map(property => [
      property,
      {
        value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property)
      }
    ])));
  }

  function restoreProjectTaskGridStyles() {
    projectTaskGridOriginalStyles.forEach((properties, element) => {
      properties.forEach(({ value, priority }, property) => {
        if (value) {
          element.style.setProperty(property, value, priority);
        } else {
          element.style.removeProperty(property);
        }
      });
    });
    projectTaskGridOriginalStyles.clear();
    projectTaskGridElement = null;
    projectTaskGridContainerElement = null;
  }

  function resizeProjectTaskGrid() {
    if (!projectTaskMaximized) return;

    const grid = document.querySelector(
      '[controlname="Job Task Lines Subform"] .ms-nav-grid-vertical-container'
    );
    if (!grid) return;

    const gridContainer = grid.closest(".ms-nav-grid-horizontal-container") || grid;
    projectTaskGridElement = grid;
    projectTaskGridContainerElement = gridContainer;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    [gridContainer, grid].forEach(element => {
      rememberProjectTaskGridStyles(element);
      const availableHeight = Math.max(
        180,
        viewportHeight - element.getBoundingClientRect().top - 12
      );
      const targetHeight = `${availableHeight}px`;
      ["height", "max-height"].forEach(property => {
        if (element.style.getPropertyValue(property) !== targetHeight
          || element.style.getPropertyPriority(property) !== "important") {
          element.style.setProperty(property, targetHeight, "important");
        }
      });
      if (element.style.getPropertyValue("min-height") !== "0px"
        || element.style.getPropertyPriority("min-height") !== "important") {
        element.style.setProperty("min-height", "0px", "important");
      }
    });
  }

  function setProjectTaskMaximized(maximized) {
    const stateChanged = projectTaskMaximized !== maximized;
    projectTaskMaximized = maximized;
    const root = getProjectTaskSectionRoot();
    const classChanged = root
      && root.classList.contains(PROJECT_TASK_MAXIMIZED_CLASS) !== maximized;
    if (root) {
      if (classChanged) {
        root.classList.toggle(PROJECT_TASK_MAXIMIZED_CLASS, maximized);
      }
    }

    if (maximized) {
      const currentGrid = document.querySelector(
        '[controlname="Job Task Lines Subform"] .ms-nav-grid-vertical-container'
      );
      const currentContainer = currentGrid?.closest(".ms-nav-grid-horizontal-container")
        || currentGrid;
      if (
        stateChanged
        || classChanged
        || currentGrid !== projectTaskGridElement
        || currentContainer !== projectTaskGridContainerElement
      ) {
        resizeProjectTaskGrid();
      }
    } else if (stateChanged || classChanged || projectTaskGridOriginalStyles.size) {
      restoreProjectTaskGridStyles();
    }

    const button = document.getElementById(PROJECT_TASK_MAXIMIZE_BUTTON_ID);
    if (button) {
      const label = maximized ? "Przywróć zadania" : "Maksymalizuj zadania";
      if (button.textContent !== label) button.textContent = label;
      const pressed = String(maximized);
      if (button.getAttribute("aria-pressed") !== pressed) {
        button.setAttribute("aria-pressed", pressed);
      }
      const title = maximized
        ? "Przywróć zwykły widok Kartoteki projektu"
        : "Rozciągnij listę zadań na obszar roboczy";
      if (button.title !== title) button.title = title;
    }
  }

  function applyProjectTaskMaximizeButton(isProjectCard) {
    let button = document.getElementById(PROJECT_TASK_MAXIMIZE_BUTTON_ID);
    if (!isProjectCard) {
      setProjectTaskMaximized(false);
      button?.remove();
      return;
    }

    if (!button && document.body) {
      button = document.createElement("button");
      button.id = PROJECT_TASK_MAXIMIZE_BUTTON_ID;
      button.type = "button";
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        setProjectTaskMaximized(!projectTaskMaximized);
      });
      document.body.appendChild(button);
    }

    if (!projectTaskMaximizeListenersAttached) {
      window.addEventListener("resize", resizeProjectTaskGrid);
      window.addEventListener("keydown", event => {
        if (event.key === "Escape" && projectTaskMaximized) {
          setProjectTaskMaximized(false);
        }
      });
      projectTaskMaximizeListenersAttached = true;
    }

    setProjectTaskMaximized(projectTaskMaximized);
  }

  function parseQuantity(value) {
    let normalized = (value || "").replace(/\u00a0/g, " ").replace(/\s/g, "");
    if (!normalized) return null;

    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    if (lastComma !== -1 && lastDot !== -1) {
      normalized = lastComma > lastDot
        ? normalized.replace(/\./g, "").replace(",", ".")
        : normalized.replace(/,/g, "");
    } else if (lastComma !== -1) {
      normalized = normalized.replace(",", ".");
    }

    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
    const quantity = Number(normalized);
    return Number.isFinite(quantity) ? quantity : null;
  }

  function getRowQuantity(row) {
    const cell = row.querySelector('[controlname="Quantity"]');
    if (!cell) return null;

    const input = cell.querySelector("input");
    const value = input?.value
      || cell.getAttribute("title")
      || cell.textContent
      || "";
    return parseQuantity(value);
  }

  function updateRowIndicator(row, firstCell, indicator) {
    const existingIndicators = [...row.querySelectorAll(`[${ROW_INDICATOR_ATTRIBUTE}]`)];
    if (!indicator || !firstCell) {
      existingIndicators.forEach(existing => existing.remove());
      return;
    }

    const [existing] = existingIndicators;
    if (
      existingIndicators.length === 1
      && existing.parentElement === firstCell
      && existing.textContent === indicator.text
      && existing.title === indicator.title
      && existing.className === indicator.className
    ) {
      return;
    }

    existingIndicators.forEach(existingIndicator => existingIndicator.remove());
    const element = document.createElement("span");
    element.setAttribute(ROW_INDICATOR_ATTRIBUTE, "1");
    element.className = indicator.className;
    element.textContent = indicator.text;
    element.title = indicator.title;
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", indicator.title);
    firstCell.prepend(element);
  }

  function applyRowHighlights(pageId, isProjectJournal, isProjectCard) {
    const allClasses = ROW_RULES.map(r => r.className);
    allClasses.push(
      "n24-row--missing-required",
      "n24-row--missing-dimensions-emphasis",
      "n24-row--quantity-warning"
    );
    const requiredHeaderNorms = REQUIRED_HEADERS.map(h => ({
      key: h.key,
      aliases: h.aliases.map(normalizeText)
    }));

    const dimensionScope = isProjectCard
      ? document.querySelector('[controlname="Job Task Lines Subform"]')
      : document;
    const headers = [...(dimensionScope?.querySelectorAll('[id^="column_header_"]') || [])];
    const projectTaskTypeHeader = isProjectCard
      ? headers.find(header => PROJECT_TASK_TYPE_HEADER_ALIASES.includes(
        normalizeText(header.textContent || "")
      ))
      : null;
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

    document.querySelectorAll('tr[role="row"][rowkey]').forEach(row => {
      const rawValues =
        [...row.querySelectorAll('[role="textbox"], [role="button"], [role="gridcell"] span')]
          .flatMap(el => [el.getAttribute("title"), el.textContent.trim()])
          .filter(Boolean);

      const normalizedValues = rawValues
        .map(v => v.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      const normalizedValuesLower = normalizedValues.map(v => v.toLowerCase());

      row.classList.remove(...allClasses);
      if (isProjectCard && !isProjectTaskTypeEligible(row, projectTaskTypeHeader)) {
        const firstCell = row.querySelector('[role="rowheader"]')
          || row.querySelector('[role="gridcell"]');
        updateRowIndicator(row, firstCell, null);
        return;
      }

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
      const isInDimensionScope = !isProjectCard || dimensionScope?.contains(row);
      const missingDimensions = isInDimensionScope && !isSummaryRow && headerIdByKey.size > 0
        ? getMissingRequiredDimensions(row, headerIdByKey)
        : [];
      if (missingDimensions.length) {
        row.classList.add("n24-row--missing-required");
        if (isProjectCard) {
          row.classList.add("n24-row--missing-dimensions-emphasis");
        }
      }

      const firstCell = row.querySelector('[role="rowheader"]')
        || row.querySelector('[role="gridcell"]');
      const quantity = isProjectJournal ? getRowQuantity(row) : null;
      const hasQuantityWarning = quantity !== null && quantity > QUANTITY_WARNING_THRESHOLD;
      if (hasQuantityWarning) {
        row.classList.add("n24-row--quantity-warning");
      }

      let indicator = null;
      if ((DIMENSION_INDICATOR_PAGE_IDS.has(pageId) || isProjectCard) && missingDimensions.length) {
        const title = `Brak wymiarów: ${missingDimensions.join(", ")}`;
        indicator = {
          className: "n24-row-indicator--dimensions",
          text: "⚠",
          title
        };
      } else if (hasQuantityWarning) {
        indicator = {
          className: "n24-row-indicator--quantity",
          text: "!",
          title: `Quantity > ${QUANTITY_WARNING_THRESHOLD}`
        };
      }
      updateRowIndicator(row, firstCell, indicator);
    });
  }

  function isHrnestAutoApprovePathAllowed() {
    if (location.hostname !== "app.hrnest.io") return false;
    const path = (location.pathname || "").toLowerCase();
    return AUTO_APPROVE_ALLOWED_PATHS.some(prefix => path.startsWith(prefix));
  }

  function isHrnestErrorScreenVisible() {
    const pageText = normalizeText(document.body?.innerText || "");
    if (!pageText) return false;
    return pageText.includes("przepraszamyoperacjaniemozebycwykonana")
      || pageText.includes("zabierzmnienadashboard");
  }

  function findHrnestMatchingRequestRow() {
    const rows = document.querySelectorAll(".form__row.form__row--lg");

    for (const row of rows) {
      const labelEl = row.querySelector(".form-detail__label");
      const valueEl = row.querySelector(".form-detail__content .form-detail__text");

      const label = normalizeText(labelEl?.textContent);
      const value = normalizeText(valueEl?.textContent);

      if (label === "rodzajwniosku" && value === "pracazdomu") {
        return row;
      }
    }

    return null;
  }

  function findHrnestApproveButton() {
    const buttons = document.querySelectorAll('button[type="submit"][value="approve"], button[value="approve"]');

    for (const btn of buttons) {
      const text = normalizeText(btn.textContent);
      const ariaDisabled = btn.getAttribute("aria-disabled");
      const isDisabled = btn.disabled || ariaDisabled === "true";

      if (text === "zatwierdz" && !isDisabled) {
        return btn;
      }
    }

    return null;
  }

  function getHrnestAutoApproveClickFlagKey() {
    return `${AUTO_APPROVE_CLICK_FLAG_PREFIX}:${location.pathname}${location.search}`;
  }

  function applyHrnestAutoApprovePracaZDomu() {
    if (!isHrnestAutoApprovePathAllowed()) return;
    if (autoApprovePendingClickTimer) return;
    if (isHrnestErrorScreenVisible()) return;

    const clickFlagKey = getHrnestAutoApproveClickFlagKey();
    if (sessionStorage.getItem(clickFlagKey) === "1") return;
    if (!findHrnestMatchingRequestRow()) return;

    const approveButton = findHrnestApproveButton();
    if (!approveButton) return;

    autoApprovePendingClickTimer = setTimeout(() => {
      autoApprovePendingClickTimer = null;

      if (!isHrnestAutoApprovePathAllowed()) return;
      if (isHrnestErrorScreenVisible()) return;
      if (sessionStorage.getItem(clickFlagKey) === "1") return;
      if (!findHrnestMatchingRequestRow()) return;

      const freshButton = findHrnestApproveButton();
      if (!freshButton || !freshButton.isConnected) return;

      sessionStorage.setItem(clickFlagKey, "1");
      freshButton.click();

      const ts = new Date().toISOString();
      console.log(`[N24 AutoApprove][${ts}] Kliknieto 'Zatwierdz' po opoznieniu ${AUTO_APPROVE_DELAY_MS}ms dla rodzaju wniosku: Praca z domu`);
    }, AUTO_APPROVE_DELAY_MS);
  }

  function applyHrnestAutoLogin() {
    const btn = document.querySelector('button[type="submit"][name="btn"][value="confirm"]');
    if (!btn || btn.dataset.n24Clicked) return;
    btn.dataset.n24Clicked = "1";
    setTimeout(() => {
      const freshBtn = document.querySelector('button[type="submit"][name="btn"][value="confirm"]');
      if (freshBtn && freshBtn.isConnected) {
        freshBtn.click();
        console.log("[N24 AutoLogin] Kliknieto 'Zaloguj sie' na HRnest.");
      }
    }, 2000);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. LINKIFIKACJA VULCAN
  // ─────────────────────────────────────────────────────────────────────────

  const VULCAN_URL = "https://wiadomosci.eduvulcan.pl/gminawilkowice/App/odebrane";
  const VULCAN_MARKER = "data-n24-vulcan";

  function linkifyVulcanText() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          // Skip already-processed parents and script/style nodes
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (tag === "SCRIPT" || tag === "STYLE" || tag === "A") return NodeFilter.FILTER_REJECT;
          if (parent.closest(`[${VULCAN_MARKER}]`)) return NodeFilter.FILTER_REJECT;
          return node.nodeValue && node.nodeValue.includes("VULCAN") && node.nodeValue.includes("dziennika elektronicznego")
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);

    nodes.forEach(textNode => {
      const text = textNode.nodeValue;
      const idx = text.indexOf("VULCAN");
      if (idx === -1) return;

      const before = text.slice(0, idx);
      const after  = text.slice(idx + 6);

      const link = document.createElement("a");
      link.href = VULCAN_URL;
      link.textContent = "VULCAN";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute(VULCAN_MARKER, "1");
      link.style.cssText = "color:#1565c0;text-decoration:underline;font-weight:bold;";

      const fragment = document.createDocumentFragment();
      if (before) fragment.appendChild(document.createTextNode(before));
      fragment.appendChild(link);
      if (after)  fragment.appendChild(document.createTextNode(after));

      textNode.parentNode.replaceChild(fragment, textNode);
    });
  }

  function run() {
    const host = location.hostname || "";
    const isBC     = host.includes("businesscentral.dynamics.com");
    const isHRnest = host === "app.hrnest.io";

    if (isBC) {
      const pageId = getBusinessCentralPageId();
      const isProjectJournal = isProjectJournalPage();
      const isProjectCard = isProjectCardPage();
      const coloringEnabled = isColoringPage(pageId, isProjectJournal, isProjectCard);
      ensureStyles(coloringEnabled);
      applySensitiveTextMask();
      applyJournalLongEntriesConfirmation(isProjectJournal);
      applyProjectCardSectionVisibility(isProjectCard);
      applyProjectTaskMaximizeButton(isProjectCard);
      if (coloringEnabled) {
        applyFieldLabels();
        applyRowHighlights(pageId, isProjectJournal, isProjectCard);
      }
    }

    if (isHRnest) {
      applyHrnestAutoLogin();
      applyHrnestAutoApprovePracaZDomu();
    }

    linkifyVulcanText();
  }

  run();

  const observer = new MutationObserver(run);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
