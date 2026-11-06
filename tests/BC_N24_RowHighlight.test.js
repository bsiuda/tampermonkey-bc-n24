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
    this.style = { _cssText: "" };
    Object.defineProperty(this.style, "cssText", {
      get: () => this.style._cssText,
      set: value => {
        this.style.cssTextWriteCount += 1;
        this.style._cssText = value;
      }
    });
    this.style.cssTextWriteCount = 0;
    this.hrefWriteCount = 0;
    this.textContentWriteCount = 0;
    this.attributeWriteCount = 0;
    this.isConnected = true;
    this.disabled = false;
    this.checked = false;
    this.value = "";
    this.title = "";
    this.parentElement = null;
    this.buttons = [];
    this._href = "";
    Object.defineProperty(this, "href", {
      get: () => this._href,
      set: value => {
        this.hrefWriteCount += 1;
        this._href = String(value);
      }
    });
  }

  get textContent() {
    return this._textContent + this.children.map(child => child.textContent).join("");
  }

  set textContent(value) {
    this.textContentWriteCount += 1;
    this._textContent = value;
    this.children = [];
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributeWriteCount += 1;
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
    if (selector === "input, textarea") {
      return this.find(element => element.tagName === "INPUT" || element.tagName === "TEXTAREA");
    }
    return null;
  }

  querySelectorAll(selector) {
    if (selector === "button") {
      return [...this.buttons, ...this.children.filter(child => child.tagName === "BUTTON")];
    }
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
  pathname = "/",
  title = "",
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
    title,
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
  const openedUrls = [];
  let nextTimerId = 0;
  const context = {
    document,
    location: {
      hostname,
      host: hostname,
      origin: `https://${hostname}`,
      search,
      pathname,
      href: `https://${hostname}${pathname}${search}`
    },
    localStorage: {
      getItem: key => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, String(value))
    },
    sessionStorage: { getItem: () => null, setItem() {} },
    window: {
      innerHeight: 900,
      openedUrls,
      open(url) {
        openedUrls.push(url);
        return {};
      },
      addEventListener() {}
    },
    navigator: {
      clipboard: {
        write: async items => { context.clipboardItems = items; },
        writeText: async text => { context.clipboardText = text; }
      }
    },
    URL,
    Blob,
    ClipboardItem: class ClipboardItem {
      constructor(data) {
        this.data = data;
      }
    },
    NodeFilter: { SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 },
    MutationObserver: class {
      constructor(callback) {
        context.observerCallback = callback;
      }
      observe() {}
    },
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
    openedUrls,
    get clipboardItems() {
      return context.clipboardItems;
    },
    setClipboardWrite(callback) {
      context.navigator.clipboard.write = callback;
    },
    location: context.location,
    runObserver() {
      context.observerCallback();
    },
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

test("userscript matching is limited to the supported HTTPS hosts and Atlassian admin routes", () => {
  const matches = [...source.matchAll(/^\/\/ @match\s+(.+)$/gm)].map(match => match[1]);
  assert.deepEqual(matches, [
    "https://businesscentral.dynamics.com/*",
    "https://app.hrnest.io/*",
    "https://visualstudio.com/*",
    "https://*.visualstudio.com/*",
    "https://dev.azure.com/*",
    "https://nav24.atlassian.net/wiki/admin/guests",
    "https://admin.atlassian.com/o/093c4d98-9ef4-4ee0-a422-2f94a77b115f/users"
  ]);
  assert.doesNotMatch(source, /^\/\/ @match\s+\*:/m);

  const unsupported = makeHarness({ hostname: "evilbusinesscentral.dynamics.com" });
  assert.equal(unsupported.document.getElementById("n24-date-style"), null);
  assert.equal(unsupported.document.treeWalkerCount, 0);

  const hrnest = makeHarness({ hostname: "app.hrnest.io" });
  assert.equal(hrnest.document.treeWalkerCount, 1);
  assert.equal(hrnest.document.getElementById("n24-ado-quick-actions"), null);
});

test("Azure DevOps quick actions are limited to exact supported domains", () => {
  for (const [hostname, expected] of [
    ["visualstudio.com", true],
    ["org.visualstudio.com", true],
    ["dev.azure.com", true],
    ["evilvisualstudio.com", false],
    ["visualstudio.com.evil.test", false],
    ["sub.dev.azure.com", false],
    ["dev.azure.com.evil.test", false],
    ["nav24.atlassian.net", false]
  ]) {
    const harness = makeHarness({ hostname });
    assert.equal(
      Boolean(harness.document.getElementById("n24-ado-quick-actions")),
      expected,
      hostname
    );
  }
});

test("ADO actions generate the requested estimate, planning, and encoded Business Central links", async () => {
  const harness = makeHarness({
    hostname: "dev.azure.com",
    pathname: "/org/N24%20Cooperation/_workitems/edit/123",
    search: "?view=details",
    title: "123: N24 Meeting 123 Planning meeting - Azure DevOps"
  });
  const provider = new Element("div", JSON.stringify({
    data: {
      "ms.vss-work-web.work-item-data-provider": {
        "work-item-data": {
          fields: {
            "2713745": '<a href="https://nav24.atlassian.net/wiki/spaces/PRJ/pages/123">specification</a>'
          }
        }
      }
    }
  }));
  provider.id = "dataProviders";
  harness.document.body.appendChild(provider);

  const panel = harness.document.getElementById("n24-ado-quick-actions");
  assert.ok(panel);
  const [estimateButton, planningButton, businessCentralButton] = panel.querySelectorAll("button");
  assert.deepEqual(
    [estimateButton.textContent, planningButton.textContent, businessCentralButton.textContent],
    ["Wyślij wycenę", "Wyślij ankietę planowania", "Pokaż Project Task w BC"]
  );

  estimateButton.dispatch("click");
  await new Promise(resolve => setImmediate(resolve));
  const estimateUrl = new URL(harness.openedUrls[0]);
  assert.equal(estimateUrl.origin, "https://outlook.office.com");
  assert.equal(estimateUrl.pathname, "/mail/deeplink/compose");
  assert.doesNotMatch(estimateUrl.search, /\+/);
  assert.match(estimateUrl.search, /subject=Wycena%20do%20akceptacji/);
  assert.match(estimateUrl.search, /body=Dzie%C5%84%20dobry%2C%0A%0A/);
  assert.equal(estimateUrl.searchParams.get("subject"), "Wycena do akceptacji: N24 Meeting 123 Planning meeting - Azure DevOps #123");
  assert.match(estimateUrl.searchParams.get("body"), /Wykonanie niniejszej modyfikacji wyceniliśmy na kwotę XXX PLN/);
  assert.match(estimateUrl.searchParams.get("body"), /https:\/\/nav24\.atlassian\.net\/wiki\/spaces\/PRJ\/pages\/123/);
  assert.equal(harness.clipboardItems.length, 1);
  assert.equal(await harness.clipboardItems[0].data["text/plain"].text(), estimateUrl.searchParams.get("body"));
  assert.match(await harness.clipboardItems[0].data["text/html"].text(), /<a href="https:\/\/nav24\.atlassian\.net/);

  planningButton.dispatch("click");
  const planningUrl = new URL(harness.openedUrls[1]);
  assert.doesNotMatch(planningUrl.search, /\+/);
  assert.match(planningUrl.search, /subject=123%20N24%20%7C%20Planning%20meeting/);
  assert.match(planningUrl.search, /body=Dzie%C5%84%20dobry%2C%0A%0A/);
  assert.equal(planningUrl.searchParams.get("subject"), "123 N24 | Planning meeting");
  assert.equal(
    planningUrl.searchParams.get("body"),
    "Dzień dobry,\n\nchciałbym prosić o spotkanie dot. zagadnienia z tytułu maila. Uprzejmie proszę o wybór (zagłosowanie) pasujących Państwu terminów w ankiecie planowania poniżej."
  );

  businessCentralButton.dispatch("click");
  const businessCentralUrl = new URL(harness.openedUrls[2]);
  assert.equal(
    `${businessCentralUrl.origin}${businessCentralUrl.pathname}`,
    "https://businesscentral.dynamics.com/1dc3db50-611a-4d1f-a628-3302743e8941/NAV24_PL/"
  );
  assert.equal(businessCentralUrl.searchParams.get("company"), "NAV24 Sp. z o.o.");
  assert.equal(businessCentralUrl.searchParams.get("page"), "50100");
  assert.equal(
    businessCentralUrl.searchParams.get("filter"),
    "'Job Task'.'AzureDev.Bill.WorkItemID N24' IS '123'"
  );
  assert.match(businessCentralUrl.search, /filter=%27Job\+Task%27/);
});

test("ADO actions reject routes without a numeric work item ID", () => {
  for (const pathname of [
    "/org/project/_workitems/edit/not-a-number",
    "/org/project/_workitems/edit/123/extra"
  ]) {
    const harness = makeHarness({ hostname: "dev.azure.com", pathname });
    const panel = harness.document.getElementById("n24-ado-quick-actions");
    panel.querySelectorAll("button").forEach(button => button.dispatch("click"));
    assert.deepEqual(harness.openedUrls, []);
    assert.match(
      harness.document.getElementById("n24-ado-quick-actions-status").textContent,
      /Nie znaleziono ID zadania ADO/
    );
  }
});

test("estimate action reports denied clipboard access without losing the Outlook draft", async () => {
  const harness = makeHarness({
    hostname: "visualstudio.com",
    pathname: "/org/project/_workitems/edit/88",
    title: "88: Test"
  });
  const panel = harness.document.getElementById("n24-ado-quick-actions");
  harness.setClipboardWrite(async () => { throw new Error("Permission denied"); });
  const estimateButton = panel.querySelectorAll("button")[0];
  estimateButton.dispatch("click");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(harness.openedUrls.length, 1);
  assert.match(
    harness.document.getElementById("n24-ado-quick-actions-status").textContent,
    /Permission denied/
  );
});

test("Atlassian admin pages show one red navigation link to the corresponding page", () => {
  const guests = makeHarness({
    hostname: "nav24.atlassian.net",
    pathname: "/wiki/admin/guests"
  });
  let button = guests.document.getElementById("n24-atlassian-admin-navigation");
  assert.ok(button);
  assert.equal(button.tagName, "A");
  assert.equal(button.href, "https://admin.atlassian.com/o/093c4d98-9ef4-4ee0-a422-2f94a77b115f/users");
  assert.equal(button.textContent, "Przejdź do użytkowników");
  assert.match(button.style.cssText, /background:#d32f2f/);

  const writes = [
    button.hrefWriteCount,
    button.textContentWriteCount,
    button.attributeWriteCount,
    button.style.cssTextWriteCount
  ];
  guests.runObserver();
  guests.runObserver();
  assert.equal(guests.document.body.children.filter(child => child.id === "n24-atlassian-admin-navigation").length, 1);
  assert.deepEqual([
    button.hrefWriteCount,
    button.textContentWriteCount,
    button.attributeWriteCount,
    button.style.cssTextWriteCount
  ], writes, "unchanged rerenders must not mutate the button and retrigger the document observer");

  const users = makeHarness({
    hostname: "admin.atlassian.com",
    pathname: "/o/093c4d98-9ef4-4ee0-a422-2f94a77b115f/users"
  });
  button = users.document.getElementById("n24-atlassian-admin-navigation");
  assert.ok(button);
  assert.equal(button.href, "https://nav24.atlassian.net/wiki/admin/guests");
  assert.equal(button.textContent, "Przejdź do gości");
});

test("Atlassian navigation is removed on unrelated SPA routes and organizations", () => {
  const harness = makeHarness({
    hostname: "admin.atlassian.com",
    pathname: "/o/093c4d98-9ef4-4ee0-a422-2f94a77b115f/users"
  });
  harness.location.pathname = "/o/another-org/users";
  harness.runObserver();
  assert.equal(harness.document.getElementById("n24-atlassian-admin-navigation"), null);

  harness.location.hostname = "nav24.atlassian.net";
  harness.location.pathname = "/wiki/admin/guests/invited";
  harness.runObserver();
  assert.equal(harness.document.getElementById("n24-atlassian-admin-navigation"), null);
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
