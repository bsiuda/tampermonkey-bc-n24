const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const scriptPath = path.join(__dirname, "..", "BC_N24_RowHighlight.user.js");
const source = fs.readFileSync(scriptPath, "utf8");

class Element {
  constructor(tagName, textContent = "") {
    this.tagName = tagName.toUpperCase();
    this._textContent = textContent;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = { cssText: "" };
    this.isConnected = true;
    this.disabled = false;
    this.checked = false;
    this.parentElement = null;
    this.buttons = [];
  }

  get textContent() {
    return this._textContent + this.children.map(child => child.textContent).join("");
  }

  set textContent(value) {
    this._textContent = value;
    this.children = [];
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  addEventListener(name, callback) {
    const listeners = this.listeners.get(name) || [];
    listeners.push(callback);
    this.listeners.set(name, listeners);
  }

  dispatch(name) {
    for (const callback of this.listeners.get(name) || []) {
      callback({ preventDefault() {}, stopPropagation() {} });
    }
  }

  querySelector(selector) {
    if (selector === ".ms-nav-edit-control-caption") {
      return this.caption || null;
    }
    if (selector === `#${this.toggleId} input`) {
      return this.find(element => element.tagName === "INPUT");
    }
    if (selector.startsWith("#") && selector.endsWith(" input")) {
      const id = selector.slice(1, selector.length - " input".length);
      const label = this.find(element => element.id === id);
      return label?.find(element => element.tagName === "INPUT") || null;
    }
    return null;
  }

  querySelectorAll(selector) {
    if (selector === "button") return this.buttons;
    return [];
  }

  find(predicate) {
    for (const child of this.children) {
      if (predicate(child)) return child;
      const nested = child.find(predicate);
      if (nested) return nested;
    }
    return null;
  }

  remove() {
    this.isConnected = false;
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    }
  }
}

function makeDialog(text = "W dzienniku są zapisy dłuższe niż 8h") {
  const dialog = new Element("div", text);
  dialog.className = "message-dialog";
  const button = new Element("button", "Nie");
  button.clickCount = 0;
  button.click = () => { button.clickCount += 1; };
  dialog.buttons = [button];
  return { dialog, button };
}

function makeHarness({
  hostname = "businesscentral.dynamics.com",
  search = "?page=50100",
  dialogs = [],
  storage = new Map(),
  bodyText = "Dzienniki projektów",
  headers = [
    "Nr zadania projektu",
    "DevOps ID",
    "Zużycie budżetu",
    "Ilość"
  ],
  postingField = null
} = {}) {
  const body = new Element("body", bodyText);
  body.innerText = bodyText;
  const head = new Element("head");
  const documentElement = new Element("html");
  const headerElements = headers.map((text, index) => {
    const header = new Element("div", text);
    header.id = `column_header_${index}`;
    return header;
  });
  const allRoots = [body, head, ...dialogs.map(item => item.dialog), ...headerElements];
  if (postingField) allRoots.push(postingField);

  const document = {
    body,
    head,
    documentElement,
    createElement: tagName => new Element(tagName),
    createTreeWalker: () => {
      document.treeWalkerCount += 1;
      return { nextNode: () => null };
    },
    treeWalkerCount: 0,
    getElementById(id) {
      return allRoots.map(root => root.find(element => element.id === id)
        || (root.id === id ? root : null)).find(Boolean) || null;
    },
    querySelectorAll(selector) {
      if (selector === ".message-dialog") return dialogs.map(item => item.dialog);
      if (selector === '[id^="column_header_"]') return headerElements;
      if (selector === '[controlname="PostingDate"]' && postingField) return [postingField];
      return [];
    },
    querySelector() {
      return null;
    }
  };
  head.appendChild = Element.prototype.appendChild.bind(head);

  const timers = [];
  let nextTimerId = 0;
  const context = {
    document,
    location: { hostname, search, pathname: "/", href: `https://${hostname}/` },
    localStorage: {
      getItem: key => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, String(value))
    },
    sessionStorage: { getItem: () => null, setItem() {} },
    window: { innerHeight: 900, addEventListener() {} },
    NodeFilter: { SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 },
    MutationObserver: class { observe() {} },
    URLSearchParams,
    setTimeout(callback, delay) {
      const timer = { id: ++nextTimerId, callback, delay, cancelled: false };
      timers.push(timer);
      return timer.id;
    },
    clearTimeout(id) {
      const timer = timers.find(item => item.id === id);
      if (timer) timer.cancelled = true;
    },
    console
  };

  vm.runInNewContext(source, context, { filename: scriptPath });
  return {
    document,
    storage,
    timers,
    runNextTimer() {
      const timer = timers.find(item => !item.cancelled && !item.ran);
      if (!timer) return null;
      timer.ran = true;
      timer.callback();
      return timer;
    }
  };
}

function getAutoNoToggle(dialog) {
  return dialog.find(element => element.tagName === "INPUT") || null;
}

test("userscript matching is limited to the two supported HTTPS hosts", () => {
  const matches = [...source.matchAll(/^\/\/ @match\s+(.+)$/gm)].map(match => match[1]);
  assert.deepEqual(matches, [
    "https://businesscentral.dynamics.com/*",
    "https://app.hrnest.io/*"
  ]);
  assert.doesNotMatch(source, /^\/\/ @match\s+\*:/m);

  const unsupported = makeHarness({ hostname: "evilbusinesscentral.dynamics.com" });
  assert.equal(unsupported.document.getElementById("n24-date-style"), null);
  assert.equal(unsupported.document.treeWalkerCount, 0);

  const hrnest = makeHarness({ hostname: "app.hrnest.io" });
  assert.equal(hrnest.document.treeWalkerCount, 1);
});

test("matching project-journal warning adds an enabled toggle and clicks Nie after two seconds", () => {
  const warning = makeDialog();
  const harness = makeHarness({ dialogs: [warning] });
  const toggle = getAutoNoToggle(warning.dialog);

  assert.ok(toggle);
  assert.equal(toggle.checked, true);
  assert.equal(warning.button.clickCount, 0);
  assert.equal(harness.timers[0].delay, 2000);
  harness.runNextTimer();
  assert.equal(warning.button.clickCount, 1);
});

test("unrelated dialogs and non-journal pages do not schedule the automatic click", () => {
  const unrelated = makeDialog("Czy na pewno chcesz kontynuować?");
  const unrelatedHarness = makeHarness({ dialogs: [unrelated] });
  assert.equal(getAutoNoToggle(unrelated.dialog), null);
  assert.equal(unrelatedHarness.timers.length, 0);

  const warning = makeDialog();
  const otherPageHarness = makeHarness({
    dialogs: [warning],
    bodyText: "Inna strona"
  });
  assert.equal(getAutoNoToggle(warning.dialog).checked, true);
  assert.equal(otherPageHarness.timers.length, 0);
});

test("toggle preference persists and disabling cancels a pending click", () => {
  const storage = new Map();
  const firstWarning = makeDialog();
  const first = makeHarness({ dialogs: [firstWarning], storage });
  const firstToggle = getAutoNoToggle(firstWarning.dialog);
  firstToggle.checked = false;
  firstToggle.dispatch("change");

  assert.equal(storage.get("n24_auto_deny_long_journal_entries"), "false");
  assert.equal(first.runNextTimer(), null);
  assert.equal(firstWarning.button.clickCount, 0);

  const secondWarning = makeDialog();
  const second = makeHarness({ dialogs: [secondWarning], storage });
  const secondToggle = getAutoNoToggle(secondWarning.dialog);
  assert.equal(secondToggle.checked, false);
  assert.equal(second.timers.length, 0);

  secondToggle.checked = true;
  secondToggle.dispatch("change");
  assert.equal(storage.get("n24_auto_deny_long_journal_entries"), "true");
  assert.equal(second.timers[0].delay, 2000);
});

test("delayed callback rechecks dialog identity, text, and button availability", () => {
  const changedWarning = makeDialog();
  const changedHarness = makeHarness({ dialogs: [changedWarning] });
  changedWarning.dialog.textContent = "Inny komunikat";
  changedHarness.runNextTimer();
  assert.equal(changedWarning.button.clickCount, 0);

  const replacedWarning = makeDialog();
  const replacementHarness = makeHarness({ dialogs: [replacedWarning] });
  const replacement = makeDialog();
  replacedWarning.dialog.isConnected = false;
  replacementHarness.document.querySelectorAll = selector => (
    selector === ".message-dialog" ? [replacement.dialog] : []
  );
  replacementHarness.runNextTimer();
  assert.equal(replacedWarning.button.clickCount, 0);

  const disabledWarning = makeDialog();
  const disabledHarness = makeHarness({ dialogs: [disabledWarning] });
  disabledWarning.button.disabled = true;
  disabledHarness.runNextTimer();
  assert.equal(disabledWarning.button.clickCount, 0);

  const missingButtonWarning = makeDialog();
  const missingButtonHarness = makeHarness({ dialogs: [missingButtonWarning] });
  missingButtonWarning.dialog.buttons = [];
  missingButtonHarness.runNextTimer();
  assert.equal(missingButtonWarning.button.clickCount, 0);
});

test("system-wide posting date label remains active outside page-specific coloring", () => {
  const postingField = new Element("div");
  postingField.caption = new Element("span", "Posting Date");
  postingField.querySelector = selector => (
    selector === ".ms-nav-edit-control-caption" ? postingField.caption : null
  );
  const harness = makeHarness({
    search: "?page=42",
    bodyText: "Inna strona",
    headers: [],
    postingField
  });

  assert.equal(postingField.caption.textContent, "Data księgowania (ostatni dzień msc)");
  assert.ok(harness.document.getElementById("n24-date-style"));
  assert.equal(harness.document.getElementById("n24-style"), null);
});
