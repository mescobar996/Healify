"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../reporter-core/dist/selector-extractor.js
var require_selector_extractor = __commonJS({
  "../reporter-core/dist/selector-extractor.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.extractSelectorFromError = extractSelectorFromError;
    var ANSI_RE = /\x1B\[[0-9;]*m/g;
    var stripAnsi = (s) => s.replace(ANSI_RE, "");
    var QUOTED_CONTENT = `(["'])((?:(?!\\1).)+)\\1`;
    var SELECTOR_PATTERNS = [
      { pattern: new RegExp(`Waiting for selector ${QUOTED_CONTENT}`), group: 2 },
      // (.+) en vez de (\S+): un selector descendiente real puede tener espacios (".card .title").
      { pattern: /Element not found: (.+)/ },
      { pattern: /Unable to locate element: (.+)/ },
      { pattern: new RegExp(`selector ${QUOTED_CONTENT} not found`), group: 2 },
      { pattern: new RegExp(` locator\\(${QUOTED_CONTENT}\\)`), group: 2 },
      // Locators modernos de Playwright (getByRole/getByText/getByLabel/getByPlaceholder/getByTestId).
      { pattern: /waiting for (getBy(?:Role|Text|Label|Placeholder|TestId)\([^\n]*\))/ },
      { pattern: /Expected to find element: `([^`]+)`/ },
      // Cypress .contains() falla con texto citado, no con un selector CSS — lo envolvemos como
      // selector de texto (`text=...`) para que analyzeSelector lo clasifique como TEXT sin cambios.
      { pattern: new RegExp(`Expected to find content: ${QUOTED_CONTENT}`), group: 2, transform: (raw) => `text=${raw}` }
    ];
    function extractSelectorFromError(errorMessage) {
      const clean = stripAnsi(errorMessage);
      for (const { pattern, transform, group } of SELECTOR_PATTERNS) {
        const match = clean.match(pattern);
        if (match) {
          const captured = match[group ?? 1];
          return transform ? transform(captured) : captured;
        }
      }
      return "Unknown selector";
    }
  }
});

// ../reporter-core/dist/page-snapshot.js
var require_page_snapshot = __commonJS({
  "../reporter-core/dist/page-snapshot.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.formatPageElements = formatPageElements;
    exports2.parsePageSnapshot = parsePageSnapshot;
    exports2.findMatches = findMatches;
    exports2.existsInPage = existsInPage;
    exports2.selectorTokens = selectorTokens;
    exports2.bestElementFor = bestElementFor;
    exports2.bestNameFor = bestNameFor;
    function formatPageElements(elements) {
      return elements.map((e) => {
        const base = e.name ? `- ${e.role} "${e.name.replace(/"/g, '\\"')}"` : `- ${e.role}`;
        return e.frame ? `${base} [frame=${e.frame}]` : base;
      }).join("\n");
    }
    var PROPERTY_LINE = /^\s*-\s*\//;
    var ELEMENT_LINE = /^\s*-\s+([a-zA-Z][\w-]*)\s*(?:"((?:[^"\\]|\\.)*)")?/;
    var TEXT_LINE = /^\s*-\s+text:\s*(.+?)\s*$/;
    var FRAME_ATTR = /\[frame=(.+)\]\s*$/;
    function parsePageSnapshot(markdown) {
      if (!markdown)
        return [];
      const elements = [];
      for (const line of markdown.split("\n")) {
        if (PROPERTY_LINE.test(line))
          continue;
        const textMatch = line.match(TEXT_LINE);
        if (textMatch) {
          elements.push({ role: "text", name: unescapeName(textMatch[1]) });
          continue;
        }
        const match = line.match(ELEMENT_LINE);
        if (!match)
          continue;
        const role = match[1];
        if (role === "yaml")
          continue;
        const element = { role, name: match[2] ? unescapeName(match[2]) : "" };
        const frameMatch = line.match(FRAME_ATTR);
        if (frameMatch)
          element.frame = frameMatch[1];
        elements.push(element);
      }
      return elements;
    }
    function unescapeName(raw) {
      return raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
    function findMatches(elements, role, name) {
      return elements.filter((e) => e.role === role && (name === void 0 || e.name === name));
    }
    function existsInPage(elements, role, name) {
      return findMatches(elements, role, name).length > 0;
    }
    function selectorTokens(selector) {
      return selector.toLowerCase().split(/[^a-z0-9áéíóúñ]+/i).filter((token) => token.length >= 3 && !/^\d+$/.test(token) && !/^[0-9a-f]{6,}$/.test(token));
    }
    var INTERACTIVE_ROLES = ["button", "link", "textbox", "checkbox", "radio", "combobox", "menuitem", "tab", "option", "searchbox", "switch"];
    function bestElementFor(elements, selector, preferredRole) {
      const topLevel = elements.filter((e) => !e.frame);
      const fromTop = bestElementIn(topLevel, selector, preferredRole);
      if (fromTop)
        return fromTop;
      if (topLevel.length === elements.length)
        return null;
      return bestElementIn(elements, selector, preferredRole);
    }
    function bestElementIn(elements, selector, preferredRole) {
      if (preferredRole) {
        const name = bestNameIn(elements, preferredRole, selector);
        if (name !== null)
          return findMatches(elements, preferredRole, name)[0] ?? { role: preferredRole, name };
      }
      const tokens = selectorTokens(selector);
      if (tokens.length === 0)
        return null;
      const scored = elements.filter((e) => INTERACTIVE_ROLES.includes(e.role) && e.name.length > 0).map((element) => {
        const nameTokens = selectorTokens(element.name);
        const score = nameTokens.filter((nameToken) => tokens.some((token) => token === nameToken || token.startsWith(nameToken) || nameToken.startsWith(token))).length;
        return { element, score };
      }).filter((s) => s.score > 0);
      if (scored.length === 0)
        return null;
      const best = scored.reduce((a, b) => b.score > a.score ? b : a);
      if (scored.filter((s) => s.score === best.score).length > 1)
        return null;
      return best.element;
    }
    function bestNameFor(elements, role, selector) {
      const topLevel = elements.filter((e) => !e.frame);
      const fromTop = bestNameIn(topLevel, role, selector);
      if (fromTop !== null)
        return fromTop;
      if (topLevel.length === elements.length)
        return null;
      return bestNameIn(elements, role, selector);
    }
    function bestNameIn(elements, role, selector) {
      const candidates = findMatches(elements, role).filter((e) => e.name.length > 0);
      if (candidates.length === 0)
        return null;
      if (candidates.length === 1)
        return candidates[0].name;
      const tokens = selectorTokens(selector);
      if (tokens.length === 0)
        return null;
      const scored = candidates.map((candidate) => {
        const nameTokens = selectorTokens(candidate.name);
        const score = nameTokens.filter((nameToken) => tokens.some((token) => token === nameToken || token.startsWith(nameToken) || nameToken.startsWith(token))).length;
        return { name: candidate.name, score };
      });
      const best = scored.reduce((a, b) => b.score > a.score ? b : a);
      if (best.score === 0)
        return null;
      if (scored.filter((s) => s.score === best.score).length > 1)
        return null;
      return best.name;
    }
  }
});

// ../reporter-core/dist/selector-compat.js
var require_selector_compat = __commonJS({
  "../reporter-core/dist/selector-compat.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.isPlaywrightOnlySelector = isPlaywrightOnlySelector2;
    function isPlaywrightOnlySelector2(selector) {
      return /^role\(/.test(selector) || selector.includes(":has-text(") || /^visible=/.test(selector) || /^getBy[A-Z]/.test(selector);
    }
  }
});

// ../reporter-core/dist/role-locator.js
var require_role_locator = __commonJS({
  "../reporter-core/dist/role-locator.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.parseRoleSuggestion = parseRoleSuggestion;
    exports2.roleSuggestionToXPath = roleSuggestionToXPath;
    exports2.resolveLocatorStrategy = resolveLocatorStrategy2;
    var selector_compat_1 = require_selector_compat();
    function parseRoleSuggestion(selector) {
      const withName = selector.match(/^role\('([^']+)',\s*\{\s*name:\s*'([^']*)'\s*\}\s*\)$/);
      if (withName)
        return { role: withName[1], name: withName[2] };
      const roleOnly = selector.match(/^role\('([^']+)'\)$/);
      return roleOnly ? { role: roleOnly[1] } : null;
    }
    function xpathLiteral(value) {
      if (!value.includes("'"))
        return `'${value}'`;
      if (!value.includes('"'))
        return `"${value}"`;
      const parts = value.split("'").map((part) => `'${part}'`);
      return `concat(${parts.join(`, "'", `)})`;
    }
    var ROLE_TO_XPATH = {
      button: (l) => `//button[normalize-space(.)=${l}] | //button[@aria-label=${l}] | //input[(@type='submit' or @type='button') and @value=${l}] | //*[@role='button'][normalize-space(.)=${l} or @aria-label=${l}]`,
      link: (l) => `//a[normalize-space(.)=${l}] | //a[@aria-label=${l}] | //*[@role='link'][normalize-space(.)=${l} or @aria-label=${l}]`,
      textbox: (l) => `//input[@aria-label=${l}] | //input[@placeholder=${l}] | //textarea[@aria-label=${l}] | //textarea[@placeholder=${l}]`,
      checkbox: (l) => `//input[@type='checkbox'][@aria-label=${l}] | //*[@role='checkbox'][@aria-label=${l}]`,
      radio: (l) => `//input[@type='radio'][@aria-label=${l}] | //*[@role='radio'][@aria-label=${l}]`,
      searchbox: (l) => `//input[@type='search'][@aria-label=${l} or @placeholder=${l}]`
    };
    function roleSuggestionToXPath(role, name) {
      if (!name)
        return null;
      const build = ROLE_TO_XPATH[role];
      return build ? build(xpathLiteral(name)) : null;
    }
    function resolveLocatorStrategy2(fixedSelector) {
      const roleSuggestion = parseRoleSuggestion(fixedSelector);
      if (roleSuggestion) {
        const xpath = roleSuggestion.name ? roleSuggestionToXPath(roleSuggestion.role, roleSuggestion.name) : null;
        return xpath ? { strategy: "xpath", value: xpath } : { strategy: "unsupported", value: null };
      }
      if ((0, selector_compat_1.isPlaywrightOnlySelector)(fixedSelector))
        return { strategy: "unsupported", value: null };
      return { strategy: "css", value: fixedSelector };
    }
  }
});

// ../reporter-core/dist/repertoire.js
var require_repertoire = __commonJS({
  "../reporter-core/dist/repertoire.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.parseHistoryLines = parseHistoryLines;
    exports2.readRepertoire = readRepertoire2;
    exports2.findRepertoireMatch = findRepertoireMatch;
    var node_fs_1 = require("node:fs");
    var node_path_1 = require("node:path");
    var HISTORY_RELATIVE_PATH = (0, node_path_1.join)(".healify", "history.jsonl");
    function parseHistoryLines(raw) {
      const entries = [];
      for (const line of raw.split("\n")) {
        if (!line.trim())
          continue;
        try {
          entries.push(JSON.parse(line));
        } catch {
        }
      }
      return entries;
    }
    function readRepertoire2(cwd = process.cwd()) {
      const fullPath = (0, node_path_1.join)(cwd, HISTORY_RELATIVE_PATH);
      if (!(0, node_fs_1.existsSync)(fullPath))
        return [];
      let raw;
      try {
        raw = (0, node_fs_1.readFileSync)(fullPath, "utf-8");
      } catch {
        return [];
      }
      return parseHistoryLines(raw);
    }
    function findRepertoireMatch(entries, selector, testFile) {
      const candidates = entries.filter((e) => e.verified === true && e.selector === selector && e.testFile === testFile);
      if (candidates.length === 0)
        return null;
      return candidates.reduce((latest, candidate) => candidate.timestamp > latest.timestamp ? candidate : latest);
    }
  }
});

// ../reporter-core/dist/dictionaries/en.json
var require_en = __commonJS({
  "../reporter-core/dist/dictionaries/en.json"(exports2, module2) {
    module2.exports = {
      ACTIONS: {
        login: "Login",
        signin: "Sign In",
        submit: "Submit",
        save: "Save",
        cancel: "Cancel",
        delete: "Delete",
        edit: "Edit",
        update: "Update",
        create: "Create",
        add: "Add",
        remove: "Remove",
        search: "Search",
        send: "Send",
        confirm: "Confirm",
        accept: "Accept",
        reject: "Reject",
        next: "Next",
        previous: "Previous",
        back: "Back",
        continue: "Continue",
        finish: "Finish",
        start: "Start",
        stop: "Stop",
        play: "Play",
        pause: "Pause"
      },
      FIELDS: {
        email: "Email",
        password: "Password",
        username: "Username",
        name: "Name",
        phone: "Phone",
        address: "Address",
        search: "Search",
        date: "Date",
        title: "Title",
        description: "Description"
      }
    };
  }
});

// ../reporter-core/dist/dictionaries/es.json
var require_es = __commonJS({
  "../reporter-core/dist/dictionaries/es.json"(exports2, module2) {
    module2.exports = {
      ACTIONS: {
        iniciar: "Iniciar Sesi\xF3n",
        ingresar: "Ingresar",
        guardar: "Guardar",
        cancelar: "Cancelar",
        eliminar: "Eliminar",
        borrar: "Eliminar",
        editar: "Editar",
        actualizar: "Actualizar",
        crear: "Crear",
        agregar: "Agregar",
        quitar: "Quitar",
        buscar: "Buscar",
        enviar: "Enviar",
        confirmar: "Confirmar",
        aceptar: "Aceptar",
        rechazar: "Rechazar",
        siguiente: "Siguiente",
        anterior: "Anterior",
        volver: "Volver",
        continuar: "Continuar",
        finalizar: "Finalizar",
        comenzar: "Comenzar",
        detener: "Detener",
        reproducir: "Reproducir",
        pausar: "Pausar"
      },
      FIELDS: {
        correo: "Correo",
        contrase\u00F1a: "Contrase\xF1a",
        clave: "Contrase\xF1a",
        usuario: "Usuario",
        nombre: "Nombre",
        telefono: "Tel\xE9fono",
        tel\u00E9fono: "Tel\xE9fono",
        direccion: "Direcci\xF3n",
        direcci\u00F3n: "Direcci\xF3n",
        fecha: "Fecha",
        titulo: "T\xEDtulo",
        t\u00EDtulo: "T\xEDtulo",
        descripcion: "Descripci\xF3n",
        descripci\u00F3n: "Descripci\xF3n"
      }
    };
  }
});

// ../reporter-core/dist/healing-engine.js
var require_healing_engine = __commonJS({
  "../reporter-core/dist/healing-engine.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.analyzeAndHeal = analyzeAndHeal2;
    var page_snapshot_1 = require_page_snapshot();
    var role_locator_1 = require_role_locator();
    var repertoire_1 = require_repertoire();
    var VOLATILE_CLASS_RE = /^(css-|sc-|x[0-9a-f]{4,}|[a-z]{2,}_[a-z0-9]{5,})/i;
    var VOLATILE_ID_RE = /_\d{4,}$|-[a-f0-9]{6,}$/i;
    function hasVolatileClassToken(selector) {
      const classTokens = selector.match(/\.[a-zA-Z0-9_-]+/g) ?? [];
      return classTokens.some((token) => VOLATILE_CLASS_RE.test(token.slice(1)));
    }
    var TESTID_ATTRS = ["data-testid", "data-cy", "data-qa", "data-test", "data-e2e"];
    var NTH_POSITION_RE = /:nth-(?:child|of-type)\(/;
    var TEXT_LIKE_SELECTOR_RE = /has-text\(|text=|getBy|^role\(/;
    function maskQuotedContent(selector) {
      return selector.replace(/'[^']*'|"[^"]*"/g, (match) => match[0] + "x".repeat(match.length - 2) + match[match.length - 1]);
    }
    var COMBINATOR_TOKEN_RE = /\s*[>+~]\s*|\s+/;
    function hasCompoundCombinator(selector) {
      if (selector.startsWith("//") || TEXT_LIKE_SELECTOR_RE.test(selector))
        return false;
      return COMBINATOR_TOKEN_RE.test(maskQuotedContent(selector));
    }
    function extractCombinatorTarget(selector) {
      const masked = maskQuotedContent(selector);
      const re = new RegExp(COMBINATOR_TOKEN_RE, "g");
      let lastEnd = 0;
      let match;
      while ((match = re.exec(masked)) !== null) {
        lastEnd = match.index + match[0].length;
      }
      return selector.slice(lastEnd).trim();
    }
    function analyzeSelector(selector, testIds = TESTID_ATTRS) {
      const analysis = {
        type: "CSS",
        issues: [],
        element: "element",
        action: "interact",
        isDynamic: false,
        isFragile: false
      };
      const modernLocatorMatch = selector.match(/^getBy(Role|Text|Label|Placeholder|TestId)\(/);
      if (modernLocatorMatch) {
        analysis.isAlreadyModernLocator = true;
        const kind = modernLocatorMatch[1];
        analysis.type = kind === "Role" ? "ROLE" : kind === "Text" ? "TEXT" : kind === "TestId" ? "TESTID" : "CSS";
        return analysis;
      }
      if (selector.startsWith("#")) {
        analysis.type = "ID";
        analysis.issues.push("ID selectors are brittle and can change");
        if (/\d+/.test(selector) || /-[a-f0-9]{6,}/i.test(selector) || VOLATILE_ID_RE.test(selector)) {
          analysis.isDynamic = true;
          analysis.issues.push("Dynamic ID detected - will break on next build");
        }
      } else if (selector.startsWith(".")) {
        analysis.type = "CLASS";
        analysis.issues.push("Class names can change during refactoring");
        if (/_[a-z]+_[a-z0-9]+/.test(selector) || /sc-[a-z]+/.test(selector) || hasVolatileClassToken(selector)) {
          analysis.isDynamic = true;
          analysis.issues.push("Generated CSS class detected - unstable");
        }
      } else if (testIds.some((attr) => selector.includes(`[${attr}=`))) {
        analysis.type = "TESTID";
      } else if (selector.startsWith("//")) {
        analysis.type = "XPATH";
        analysis.issues.push("XPath is fragile to DOM structure changes");
        analysis.isFragile = true;
      } else if (selector.includes("[role=")) {
        analysis.type = "ROLE";
      } else if (selector.includes("text=") || selector.includes("has-text")) {
        analysis.type = "TEXT";
        analysis.issues.push("Text content can change with copy updates");
      } else if (selector.includes("[aria-label=")) {
        analysis.type = "ATTRIBUTE";
        analysis.attributeKind = "aria-label";
      } else if (selector.includes("[name=")) {
        analysis.type = "ATTRIBUTE";
        analysis.attributeKind = "name";
        analysis.issues.push("The name attribute may not be unique");
      }
      if (NTH_POSITION_RE.test(selector)) {
        analysis.isFragile = true;
        analysis.issues.push("Position-based selector (nth-child/nth-of-type) depends on exact sibling order in the DOM");
      }
      if (hasCompoundCombinator(selector)) {
        analysis.isFragile = true;
        analysis.isCompoundCombinator = true;
        analysis.issues.push("Compound selector with a CSS combinator (descendant/child/sibling) depends on the ancestor/sibling structure in the DOM");
      }
      if (/button|btn/i.test(selector)) {
        analysis.element = "button";
        analysis.action = "click";
      } else if (/input|field/i.test(selector)) {
        analysis.element = "input";
        analysis.action = "type";
      } else if (/link|anchor|a\[|nav/i.test(selector)) {
        analysis.element = "link";
        analysis.action = "click";
      } else if (/submit|form/i.test(selector)) {
        analysis.element = "button";
        analysis.action = "submit";
      } else if (/login|signin/i.test(selector)) {
        analysis.element = "button";
        analysis.action = "login";
      }
      return analysis;
    }
    function deterministicAdjustment(selector) {
      let hash = 0;
      for (let i = 0; i < selector.length; i++) {
        hash = (hash << 5) - hash + selector.charCodeAt(i) | 0;
      }
      return Math.abs(hash) % 100 / 1e3 - 0.05;
    }
    var en_json_1 = __importDefault(require_en());
    var es_json_1 = __importDefault(require_es());
    var ACTIONS = { ...en_json_1.default.ACTIONS, ...es_json_1.default.ACTIONS };
    var FIELDS = { ...en_json_1.default.FIELDS, ...es_json_1.default.FIELDS };
    function extractActionFromSelector(selector, actions) {
      for (const [key, value] of Object.entries(actions)) {
        if (selector.toLowerCase().includes(key))
          return value;
      }
      return "Submit";
    }
    function extractFieldName(selector, fields) {
      for (const [key, value] of Object.entries(fields)) {
        if (selector.toLowerCase().includes(key))
          return value;
      }
      return "Field";
    }
    function extractTestid(selector, testIds = TESTID_ATTRS) {
      const suffixes = testIds.map((t) => t.replace("data-", ""));
      const match = selector.match(new RegExp(`data-(?:${suffixes.join("|")})=['"]([^'"]+)['"]`));
      return match ? match[1] : "element";
    }
    function testidAttributeName(selector, testIds = TESTID_ATTRS) {
      return testIds.find((attr) => selector.includes(`[${attr}=`)) ?? "data-testid";
    }
    function extractBaseClass(selector) {
      return selector.replace(/[#.]/, "").replace(/[-_]?\d+/g, "").replace(/[-_][a-f0-9]{6,}/gi, "").toLowerCase();
    }
    function isUnstableClassCandidate(selector, candidate) {
      if (VOLATILE_CLASS_RE.test(candidate))
        return true;
      const volatileFragments = selector.match(/[a-f0-9]{4,}|\d{2,}/gi) ?? [];
      return volatileFragments.length > 3;
    }
    function generateHealingStrategies(selector, analysis, actions, fields, testIds = TESTID_ATTRS) {
      if (analysis.isAlreadyModernLocator) {
        return [{
          selector,
          type: analysis.type,
          confidence: 0.8,
          explanation: "El selector ya usa un locator moderno de Playwright (getBy*), que es la pr\xE1ctica recomendada. No se propone downgrade \u2014 sin acceso al DOM real no se puede saber por qu\xE9 dej\xF3 de encontrar el elemento; puede ser un cambio genuino de la UI que amerita revisi\xF3n manual.",
          robustnessGain: 0,
          technicalReason: "Modern Playwright locators are already best practice; the failure likely reflects a real UI change, not a selector quality issue",
          priority: 4
        }];
      }
      const strategies = [];
      if (analysis.attributeKind === "aria-label") {
        strategies.push({
          selector,
          type: "ROLE",
          confidence: 0.93,
          explanation: `El selector ya usa aria-label, un atributo de accesibilidad estable. Se conserva tal cual.`,
          robustnessGain: 0,
          technicalReason: "aria-label is an accessibility attribute purpose-built for stable identification",
          priority: 4
        });
      }
      if (analysis.attributeKind === "name") {
        strategies.push({
          selector,
          type: "CSS",
          confidence: 0.85,
          explanation: `El selector ya usa el atributo name, razonablemente estable aunque puede no ser \xFAnico. Se conserva tal cual.`,
          robustnessGain: 0,
          technicalReason: "The name attribute is usually stable but may not be unique across the page",
          priority: 3
        });
      }
      if (analysis.element === "button") {
        const action = extractActionFromSelector(selector, actions);
        strategies.push({
          selector: `role('button', { name: '${action}' })`,
          type: "ROLE",
          confidence: 0.92,
          explanation: `Se detect\xF3 un ${analysis.type} inestable; se cambi\xF3 por un selector basado en accesibilidad (ARIA role) para mayor robustez.`,
          robustnessGain: 45,
          technicalReason: "ARIA roles are stable across refactors and DOM restructures",
          priority: 4
        });
        strategies.push({
          selector: `button:has-text('${action}')`,
          type: "TEXT",
          confidence: 0.85,
          explanation: `Selector basado en texto visible del bot\xF3n. Es menos estable que el rol pero m\xE1s intuitivo para debugging.`,
          robustnessGain: 30,
          technicalReason: "Text-based selectors work well for user-facing elements",
          priority: 5
        });
      }
      if (analysis.element === "input") {
        const fieldName = extractFieldName(selector, fields);
        strategies.push({
          selector: `input[placeholder*='${fieldName}']`,
          type: "CSS",
          confidence: 0.88,
          explanation: `Selector basado en el placeholder del campo. Los placeholders son m\xE1s estables que los IDs generados autom\xE1ticamente.`,
          robustnessGain: 35,
          technicalReason: "Placeholder attributes are typically stable and semantic",
          priority: 5
        });
        strategies.push({
          selector: `label:has-text('${fieldName}') + input`,
          type: "CSS",
          confidence: 0.9,
          explanation: `Selector basado en la relaci\xF3n sem\xE1ntica entre label e input. Altamente resiliente a cambios de estructura.`,
          robustnessGain: 40,
          technicalReason: "Label-input relationships are semantically meaningful",
          priority: 5
        });
      }
      if (analysis.element === "link") {
        strategies.push({
          selector: `role('link', { name: '${extractActionFromSelector(selector, actions)}' })`,
          type: "ROLE",
          confidence: 0.91,
          explanation: `Selector por rol de enlace con texto. Muy estable y accesible.`,
          robustnessGain: 42,
          technicalReason: "Link roles with names are the gold standard for navigation",
          priority: 4
        });
      }
      if (analysis.type === "TESTID") {
        const attr = testidAttributeName(selector, testIds);
        strategies.push({
          selector: `[${attr}='${extractTestid(selector, testIds)}']`,
          type: "TESTID",
          confidence: 0.95,
          explanation: `El testid se mantiene pero se normaliza la sintaxis. Los atributos ${attr} son la opci\xF3n m\xE1s estable cuando est\xE1n disponibles.`,
          robustnessGain: 50,
          technicalReason: `${attr} attributes are purpose-built for testing stability`,
          priority: 1
        });
      }
      if (analysis.type === "XPATH") {
        strategies.push({
          selector: `role('button')`,
          type: "ROLE",
          confidence: 0.82,
          explanation: `Se reemplaz\xF3 el XPath fr\xE1gil por un selector de rol. Los XPath dependen de la estructura exacta del DOM que cambia frecuentemente.`,
          robustnessGain: 55,
          technicalReason: "XPath is the most fragile selector type; ARIA roles are preferred",
          priority: 4
        });
      }
      if (NTH_POSITION_RE.test(selector) && analysis.element === "element") {
        strategies.push({
          selector: `role('button')`,
          type: "ROLE",
          confidence: 0.76,
          explanation: `Selector basado en posici\xF3n (nth-child/nth-of-type) \u2014 depende del orden exacto de hermanos en el DOM, se rompe con solo agregar/quitar un elemento vecino. Se propone un selector de rol como punto de partida; revisar manualmente para afinar el name.`,
          robustnessGain: 40,
          technicalReason: "Position-based selectors (nth-child/nth-of-type) break whenever sibling elements are added, removed, or reordered",
          priority: 6
        });
      }
      if (analysis.isDynamic && analysis.type === "CLASS") {
        const stableTokens = (selector.match(/\.[a-zA-Z0-9_-]+/g) ?? []).filter((token) => !VOLATILE_CLASS_RE.test(token.slice(1)));
        if (stableTokens.length > 0) {
          const candidate = stableTokens.join("");
          if (!isUnstableClassCandidate(selector, candidate.slice(1))) {
            strategies.push({
              selector: candidate,
              type: "CSS",
              confidence: 0.8,
              explanation: `Se detect\xF3 una clase generada (CSS-in-JS) pegada a una clase sem\xE1ntica estable. Se propone conservar solo la parte estable.`,
              robustnessGain: 35,
              technicalReason: "Generated CSS-in-JS classes change between builds; the semantic class alongside it is preferred",
              priority: 6
            });
          }
        }
      }
      if (analysis.isDynamic && analysis.type === "ID") {
        const baseClass = extractBaseClass(selector);
        if (!isUnstableClassCandidate(selector, baseClass)) {
          strategies.push({
            selector: `.${baseClass}`,
            type: "CSS",
            confidence: 0.78,
            explanation: `Se detect\xF3 un ID din\xE1mico con hash o n\xFAmero aleatorio. Se propuso una clase estable como alternativa.`,
            robustnessGain: 38,
            technicalReason: "Dynamic IDs change between builds; stable classes are preferred",
            priority: 6
          });
        }
      }
      if (analysis.isCompoundCombinator) {
        const target = extractCombinatorTarget(selector);
        const targetTestidAttr = testIds.find((attr) => target.includes(`[${attr}=`));
        if (targetTestidAttr) {
          strategies.push({
            selector: `[${targetTestidAttr}='${extractTestid(target, testIds)}']`,
            type: "TESTID",
            confidence: 0.96,
            explanation: `Selector compuesto con combinador CSS \u2014 depende de la ruta de ancestros, no solo del elemento buscado. Se conserva el testid del elemento objetivo (${target}), descartando la ruta.`,
            robustnessGain: 50,
            technicalReason: "Combinator-based selectors are brittle to markup restructuring; the target testid attribute is independent of ancestor structure",
            priority: 1
          });
        } else if (target.startsWith(".") && !hasVolatileClassToken(target)) {
          strategies.push({
            selector: target,
            type: "CSS",
            confidence: 0.8,
            explanation: `Selector compuesto con combinador CSS \u2014 depende de la relaci\xF3n exacta entre ancestro y elemento objetivo, se rompe si se agrega un wrapper o se reordena el markup. Se propone conservar solo el elemento objetivo (${target}), sin la ruta de ancestros.`,
            robustnessGain: 35,
            technicalReason: "Combinator-based selectors break when markup structure changes even if the target element itself is unchanged",
            priority: 6
          });
        } else if (target.startsWith("#") && !VOLATILE_ID_RE.test(target)) {
          strategies.push({
            selector: target,
            type: "CSS",
            confidence: 0.8,
            explanation: `Selector compuesto con combinador CSS \u2014 depende de la relaci\xF3n exacta entre ancestro y elemento objetivo. Se propone conservar solo el elemento objetivo (${target}), sin la ruta de ancestros.`,
            robustnessGain: 35,
            technicalReason: "Combinator-based selectors break when markup structure changes even if the target element itself is unchanged",
            priority: 6
          });
        } else if (target.startsWith("#") && VOLATILE_ID_RE.test(target)) {
          const baseClass = extractBaseClass(target);
          if (!isUnstableClassCandidate(target, baseClass)) {
            strategies.push({
              selector: `.${baseClass}`,
              type: "CSS",
              confidence: 0.75,
              explanation: `Selector compuesto con combinador CSS, y el elemento objetivo (${target}) tiene un ID din\xE1mico. Se propone una clase estable derivada, sin la ruta de ancestros.`,
              robustnessGain: 35,
              technicalReason: "Combinator-based selectors are brittle; the target ID is additionally dynamic, so a stable class is proposed instead",
              priority: 6
            });
          }
        }
        if (strategies.length === 0) {
          strategies.push({
            selector: `role('button')`,
            type: "ROLE",
            confidence: 0.74,
            explanation: `Selector compuesto con combinador CSS (\`${selector}\`) \u2014 depende de la ruta de ancestros/hermanos en el DOM, se rompe con cualquier cambio de markup aunque el elemento buscado no haya cambiado. El elemento objetivo (${target}) no tiene un atributo estable reconocible; se propone un selector de rol como punto de partida, revisar manualmente para afinar el name.`,
            robustnessGain: 30,
            technicalReason: "Combinator-based selectors depend on ancestor/sibling structure; no stable attribute was found on the target element",
            priority: 6
          });
        }
      }
      if (strategies.length === 0) {
        strategies.push({
          selector: `visible=${selector.replace(/[.#]/, "")}`,
          type: "CSS",
          confidence: 0.75,
          explanation: `Selector compuesto con filtro de visibilidad. Mayor robustez contra elementos ocultos.`,
          robustnessGain: 25,
          technicalReason: "Visibility filters prevent interaction with hidden elements",
          priority: 5
        });
      }
      return strategies.sort((a, b) => a.priority - b.priority || b.confidence - a.confidence);
    }
    var ELEMENT_TO_ARIA_ROLE = {
      button: "button",
      link: "link",
      input: "textbox"
    };
    function applyPageEvidence(strategies, pageElements, selector, analysis) {
      const expectedRole = ELEMENT_TO_ARIA_ROLE[analysis.element];
      const survivors = strategies.filter((strategy) => {
        const role = (0, role_locator_1.parseRoleSuggestion)(strategy.selector);
        if (!role)
          return true;
        return role.name === void 0 ? (0, page_snapshot_1.findMatches)(pageElements, role.role).length > 0 : (0, page_snapshot_1.existsInPage)(pageElements, role.role, role.name);
      });
      const real = (0, page_snapshot_1.bestElementFor)(pageElements, selector, expectedRole);
      if (real) {
        const inFrame = real.frame;
        survivors.unshift({
          selector: `role('${real.role}', { name: '${real.name}' })`,
          type: "ROLE",
          confidence: inFrame ? 0.88 : 0.97,
          explanation: inFrame ? `Verificado contra la p\xE1gina: hay un ${real.role} con el nombre accesible "${real.name}", pero est\xE1 DENTRO del iframe ${inFrame}. Un locator a nivel de p\xE1gina no lo encuentra: primero hay que entrar al frame (\`frameLocator('${inFrame}')\` en Playwright, \`switchTo().frame(...)\` en Selenium) y reci\xE9n ah\xED aplicar el selector.` : `Verificado contra la p\xE1gina: hay un ${real.role} con el nombre accesible "${real.name}". El nombre se ley\xF3 del \xE1rbol de accesibilidad capturado cuando el test fall\xF3, no se dedujo del texto del selector.`,
          robustnessGain: 50,
          technicalReason: inFrame ? `Confirmed against the accessibility tree captured at failure time, but inside iframe ${inFrame}: a frame switch is required before this locator resolves` : `Confirmed against the accessibility tree captured at failure time: role=${real.role}, name=${real.name}`,
          priority: 0
        });
        return { strategies: survivors, sawPage: true };
      }
      if (survivors.length === 0) {
        const roleNote = expectedRole ? ` No hay ning\xFAn ${expectedRole} en la p\xE1gina.` : "";
        return {
          strategies: [
            {
              selector,
              type: "CSS",
              confidence: 0.5,
              explanation: `Ninguna sugerencia sobrevivi\xF3 al contraste con la p\xE1gina real.${roleNote} Puede que el elemento ya no exista: revis\xE1 si la funcionalidad sigue estando, en vez de buscarle otro selector.`,
              robustnessGain: 0,
              technicalReason: "No candidate matched the accessibility tree captured at failure time",
              priority: 9
            }
          ],
          sawPage: true
        };
      }
      return { strategies: survivors, sawPage: true };
    }
    function analyzeAndHeal2(request) {
      const { selector, customSynonyms, customTestIds } = request;
      const allTestIds = customTestIds ? [...TESTID_ATTRS, ...customTestIds.filter((id) => id.startsWith("data-"))] : TESTID_ATTRS;
      const analysis = analyzeSelector(selector, allTestIds);
      const actions = { ...ACTIONS, ...customSynonyms?.actions };
      const fields = { ...FIELDS, ...customSynonyms?.fields };
      let strategies = generateHealingStrategies(selector, analysis, actions, fields, allTestIds);
      const pageElements = (0, page_snapshot_1.parsePageSnapshot)(request.htmlContext);
      let verified = false;
      if (pageElements.length > 0) {
        const evidence = applyPageEvidence(strategies, pageElements, selector, analysis);
        strategies = evidence.strategies;
        verified = evidence.sawPage && strategies[0]?.priority === 0;
      }
      let fromRepertoire = false;
      if (!verified && request.repertoire) {
        const match = (0, repertoire_1.findRepertoireMatch)(request.repertoire, selector, request.testFile);
        if (match) {
          strategies = [
            {
              selector: match.fixedSelector,
              type: match.selectorType,
              confidence: match.confidence,
              explanation: `Repertorio: esta misma correcci\xF3n ya se confirm\xF3 contra la p\xE1gina en una corrida anterior (${match.timestamp}), aunque esta corrida no pudo verificarlo por su cuenta.`,
              robustnessGain: 50,
              technicalReason: `Reused from a previously verified fix recorded in .healify/history.jsonl (${match.timestamp})`,
              priority: 0
            },
            ...strategies
          ];
          verified = true;
          fromRepertoire = true;
        }
      }
      const bestStrategy = strategies[0] ?? {
        selector: "body",
        type: "CSS",
        confidence: 0.5,
        explanation: "Unable to generate a reliable selector. Manual review required.",
        robustnessGain: 0,
        technicalReason: "No suitable pattern found",
        priority: 9
      };
      const adjustedConfidence = verified ? bestStrategy.confidence : Math.max(0.75, Math.min(0.98, bestStrategy.confidence + deterministicAdjustment(selector)));
      const needsReview = adjustedConfidence < 0.8;
      return {
        verified,
        fromRepertoire,
        fixedSelector: bestStrategy.selector,
        confidence: Math.round(adjustedConfidence * 100) / 100,
        explanation: bestStrategy.explanation,
        selectorType: bestStrategy.type,
        alternatives: strategies.slice(1, 1 + (request.maxAlternatives ?? 3)).map((s) => ({
          selector: s.selector,
          confidence: Math.round(s.confidence * 100) / 100
        })),
        needsReview,
        robustnessImprovement: bestStrategy.robustnessGain,
        technicalDetails: {
          detectedIssue: analysis.issues[0] ?? "Selector pattern analysis",
          proposedSolution: bestStrategy.technicalReason,
          accessibilityCompliant: bestStrategy.type === "ROLE" || bestStrategy.type === "TEXT",
          stableAgainstDOMChanges: bestStrategy.type !== "XPATH"
        }
      };
    }
  }
});

// ../reporter-core/dist/qa-report.js
var require_qa_report = __commonJS({
  "../reporter-core/dist/qa-report.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.SEVERITY_LABEL = void 0;
    exports2.baseEnvironment = baseEnvironment;
    exports2.statsFromCases = statsFromCases;
    exports2.normalizeRun = normalizeRun;
    exports2.buildDefectId = buildDefectId;
    exports2.severityFor = severityFor;
    exports2.formatDuration = formatDuration;
    exports2.environmentRows = environmentRows;
    exports2.renderLocalReportMarkdown = renderLocalReportMarkdown;
    var node_crypto_1 = require("node:crypto");
    var node_os_1 = require("node:os");
    function baseEnvironment(framework, extra = {}) {
      return {
        os: process.platform,
        osVersion: (0, node_os_1.release)(),
        node: process.version,
        framework,
        ...extra
      };
    }
    function statsFromCases(cases, suite) {
      const count = (status) => cases.filter((c) => c.status === status).length;
      return {
        total: suite?.total ?? cases.length,
        passed: suite?.passed ?? 0,
        failed: suite?.failed ?? cases.length,
        healed: count("healed"),
        review: count("review"),
        unresolved: count("unresolved"),
        durationMs: suite?.durationMs
      };
    }
    function normalizeRun(run) {
      return {
        ...run,
        verdict: run.verdict ?? (run.cases.some((c) => c.status !== "healed") ? "failed" : "passed"),
        stats: run.stats ?? statsFromCases(run.cases),
        environment: run.environment ?? baseEnvironment(run.framework)
      };
    }
    function buildDefectId(testFile, selector) {
      const key = `${testFile ?? ""}::${selector}`;
      return `HLF-${(0, node_crypto_1.createHash)("sha1").update(key).digest("hex").slice(0, 6).toUpperCase()}`;
    }
    function severityFor(status) {
      if (status === "unresolved")
        return "blocker";
      if (status === "review")
        return "major";
      return "minor";
    }
    exports2.SEVERITY_LABEL = {
      blocker: "Bloqueante",
      major: "Mayor",
      minor: "Menor"
    };
    function formatDuration(ms) {
      if (ms === void 0)
        return void 0;
      if (ms < 1e3)
        return `${ms} ms`;
      const seconds = ms / 1e3;
      if (seconds < 60)
        return `${seconds.toFixed(1)} s`;
      const minutes = Math.floor(seconds / 60);
      return `${minutes} min ${Math.round(seconds % 60)} s`;
    }
    function environmentRows(rawRun) {
      const run = normalizeRun(rawRun);
      const env = run.environment;
      const rows = [
        { label: "Framework", value: env.frameworkVersion ? `${env.framework} ${env.frameworkVersion}` : env.framework }
      ];
      if (env.browser)
        rows.push({ label: "Navegador", value: env.browser });
      if (env.baseURL)
        rows.push({ label: "URL base", value: env.baseURL });
      rows.push({ label: "Sistema", value: env.osVersion ? `${env.os} ${env.osVersion}` : env.os });
      rows.push({ label: "Node", value: env.node });
      const duration = formatDuration(run.stats.durationMs);
      if (duration)
        rows.push({ label: "Duraci\xF3n", value: duration });
      return rows;
    }
    function caseMarkdown(c) {
      const lines = [`### ${c.defectId} \u2014 ${c.testName}`, ""];
      const meta = [`**Severidad:** ${exports2.SEVERITY_LABEL[c.severity]}`];
      if (c.testFile)
        meta.push(`**Ubicaci\xF3n:** \`${c.testFile}${c.line ? `:${c.line}` : ""}\``);
      const duration = formatDuration(c.durationMs);
      if (duration)
        meta.push(`**Duraci\xF3n:** ${duration}`);
      lines.push(meta.join(" \xB7 "), "");
      if (c.expected)
        lines.push(`**Resultado esperado:** ${c.expected}`, "");
      if (c.actual)
        lines.push(`**Resultado obtenido:** ${c.actual}`, "");
      if (c.steps && c.steps.length > 0) {
        lines.push("**Pasos para reproducir:**", "");
        c.steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
        lines.push("");
      }
      lines.push("**Selector que fall\xF3:**", "", "```", c.selector, "```", "");
      if (c.status === "unresolved") {
        lines.push("**Sugerencia:** sin candidato confiable \u2014 requiere an\xE1lisis manual.", "");
      } else {
        const origen = c.verified ? "verificada contra la p\xE1gina real" : "heur\xEDstica sobre el texto del selector, sin comprobar contra la p\xE1gina";
        lines.push(`**Sugerencia (${origen}, ${Math.round(c.confidence * 100)}% de confianza):**`, "", "```", c.fixedSelector, "```", "");
        if (c.explanation)
          lines.push(`> ${c.explanation}`, "");
      }
      if (c.attachments && c.attachments.length > 0) {
        lines.push("**Evidencia:**", "");
        for (const a of c.attachments)
          lines.push(`- [${a.name}](${a.path})`);
        lines.push("");
      }
      return lines.join("\n");
    }
    function renderLocalReportMarkdown(rawRun) {
      const run = normalizeRun(rawRun);
      const { stats } = run;
      const verdictLabel = run.verdict === "passed" ? "PASS" : "FAIL";
      const lines = [
        `# Reporte de pruebas \u2014 ${run.project}`,
        "",
        `**Resultado: ${verdictLabel}**`,
        "",
        `Ejecutado el ${run.generatedAt.toLocaleString("es-AR")}`,
        "",
        "## Entorno",
        ""
      ];
      for (const row of environmentRows(run))
        lines.push(`- **${row.label}:** ${row.value}`);
      lines.push("", "## Resumen", "", "| M\xE9trica | Cantidad |", "|---|---|", `| Tests ejecutados | ${stats.total} |`, `| Tests exitosos | ${stats.passed} |`, `| Tests fallidos | ${stats.failed} |`, `| Defectos con arreglo sugerido | ${stats.healed} |`, `| Defectos que requieren revisi\xF3n | ${stats.review} |`, `| Defectos sin sugerencia | ${stats.unresolved} |`, "");
      if (run.cases.length === 0) {
        lines.push("## Defectos", "", "No se detectaron selectores rotos en esta corrida.", "");
      } else {
        lines.push("## Defectos", "");
        const order = ["blocker", "major", "minor"];
        const sorted = [...run.cases].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity) || a.confidence - b.confidence);
        for (const c of sorted)
          lines.push(caseMarkdown(c));
      }
      lines.push("---", "", "Generado por Healify \u2014 heur\xEDstica local, sin IA. Las sugerencias marcadas como", "verificadas se confrontaron contra el \xE1rbol de la p\xE1gina capturado al fallar el test; el", "resto sale de analizar el texto del selector y conviene revisarlo antes de aplicarlo.", "");
      return lines.join("\n");
    }
  }
});

// ../reporter-core/dist/config.js
var require_config = __commonJS({
  "../reporter-core/dist/config.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.DEFAULT_THRESHOLDS = void 0;
    exports2.loadConfig = loadConfig;
    exports2.resolveThresholds = resolveThresholds;
    var node_fs_1 = require("node:fs");
    var node_module_1 = require("node:module");
    var node_path_1 = require("node:path");
    exports2.DEFAULT_THRESHOLDS = {
      healEnabled: true,
      minConfidence: 0.9,
      reviewConfidence: 0.8,
      maxAlternatives: 3
    };
    function loadConfig(cwd = process.cwd()) {
      const fromJs = loadFromModule(cwd, "healify.config.js") ?? loadFromModule(cwd, "healify.config.cjs");
      if (fromJs)
        return withEnvOverrides(validateConfig(fromJs));
      const fromJson = loadFromHealifyConfigJson(cwd);
      if (fromJson)
        return withEnvOverrides(validateConfig(fromJson));
      const fromPkg = loadFromPackageJson(cwd);
      if (fromPkg)
        return withEnvOverrides(validateConfig(fromPkg));
      return withEnvOverrides({});
    }
    function loadFromModule(cwd, filename) {
      const path = (0, node_path_1.join)(cwd, filename);
      if (!(0, node_fs_1.existsSync)(path))
        return null;
      try {
        const require2 = (0, node_module_1.createRequire)((0, node_path_1.join)(cwd, "healify-config-loader.cjs"));
        delete require2.cache[require2.resolve(path)];
        const loaded = require2(path);
        const config = loaded?.default ?? loaded;
        return config && typeof config === "object" ? config : null;
      } catch {
        return null;
      }
    }
    function loadFromHealifyConfigJson(cwd) {
      const path = (0, node_path_1.join)(cwd, "healify.config.json");
      if (!(0, node_fs_1.existsSync)(path))
        return null;
      try {
        return JSON.parse((0, node_fs_1.readFileSync)(path, "utf-8"));
      } catch {
        return null;
      }
    }
    function loadFromPackageJson(cwd) {
      const path = (0, node_path_1.join)(cwd, "package.json");
      if (!(0, node_fs_1.existsSync)(path))
        return null;
      try {
        const pkg = JSON.parse((0, node_fs_1.readFileSync)(path, "utf-8"));
        return pkg.healify ?? null;
      } catch {
        return null;
      }
    }
    function validateConfig(raw) {
      const result = {};
      if (Array.isArray(raw.customTestIds)) {
        const valid = raw.customTestIds.filter((id) => typeof id === "string" && id.startsWith("data-"));
        if (valid.length > 0)
          result.customTestIds = valid;
      }
      if (raw.customSynonyms && typeof raw.customSynonyms === "object") {
        result.customSynonyms = raw.customSynonyms;
      }
      if (typeof raw.healEnabled === "boolean")
        result.healEnabled = raw.healEnabled;
      if (isProbability(raw.minConfidence))
        result.minConfidence = raw.minConfidence;
      if (isProbability(raw.reviewConfidence))
        result.reviewConfidence = raw.reviewConfidence;
      if (typeof raw.maxAlternatives === "number" && Number.isFinite(raw.maxAlternatives) && raw.maxAlternatives >= 0) {
        result.maxAlternatives = Math.min(Math.floor(raw.maxAlternatives), 10);
      }
      return result;
    }
    function isProbability(value) {
      return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
    }
    function withEnvOverrides(config, env = process.env) {
      const result = { ...config };
      const healEnabled = parseBooleanEnv(env.HEALIFY_HEAL_ENABLED);
      if (healEnabled !== void 0)
        result.healEnabled = healEnabled;
      const min = parseProbabilityEnv(env.HEALIFY_MIN_CONFIDENCE);
      if (min !== void 0)
        result.minConfidence = min;
      const review = parseProbabilityEnv(env.HEALIFY_REVIEW_CONFIDENCE);
      if (review !== void 0)
        result.reviewConfidence = review;
      const maxAlternatives = env.HEALIFY_MAX_ALTERNATIVES !== void 0 ? Number(env.HEALIFY_MAX_ALTERNATIVES) : NaN;
      if (Number.isFinite(maxAlternatives) && maxAlternatives >= 0) {
        result.maxAlternatives = Math.min(Math.floor(maxAlternatives), 10);
      }
      return result;
    }
    function parseBooleanEnv(value) {
      if (value === void 0)
        return void 0;
      const normalized = value.trim().toLowerCase();
      if (normalized === "false" || normalized === "0")
        return false;
      if (normalized === "true" || normalized === "1")
        return true;
      return void 0;
    }
    function parseProbabilityEnv(value) {
      if (value === void 0)
        return void 0;
      const parsed = Number(value);
      return isProbability(parsed) ? parsed : void 0;
    }
    function resolveThresholds(config = {}) {
      const minConfidence = config.minConfidence ?? exports2.DEFAULT_THRESHOLDS.minConfidence;
      const reviewConfidence = Math.min(config.reviewConfidence ?? exports2.DEFAULT_THRESHOLDS.reviewConfidence, minConfidence);
      return {
        healEnabled: config.healEnabled ?? exports2.DEFAULT_THRESHOLDS.healEnabled,
        minConfidence,
        reviewConfidence,
        maxAlternatives: config.maxAlternatives ?? exports2.DEFAULT_THRESHOLDS.maxAlternatives
      };
    }
  }
});

// ../reporter-core/dist/local-mode.js
var require_local_mode = __commonJS({
  "../reporter-core/dist/local-mode.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.runLocalHealing = runLocalHealing;
    var healing_engine_1 = require_healing_engine();
    var selector_extractor_1 = require_selector_extractor();
    var qa_report_1 = require_qa_report();
    var config_1 = require_config();
    function firstLine(errorMessage) {
      return errorMessage.split("\n")[0].trim();
    }
    function passthrough(input) {
      return {
        line: input.line,
        durationMs: input.durationMs,
        steps: input.steps,
        attachments: input.attachments
      };
    }
    function runLocalHealing(input, config = {}) {
      const selector = (0, selector_extractor_1.extractSelectorFromError)(input.errorMessage);
      const thresholds = (0, config_1.resolveThresholds)(config);
      if (!thresholds.healEnabled) {
        return {
          testName: input.testName,
          testFile: input.testFile,
          selector,
          errorMessage: input.errorMessage,
          status: "unresolved",
          fixedSelector: "",
          confidence: 0,
          explanation: "Sanado desactivado por configuraci\xF3n (healEnabled: false / HEALIFY_HEAL_ENABLED=false). El fallo se reporta igual, pero no se propone ninguna correcci\xF3n.",
          selectorType: "UNKNOWN",
          defectId: (0, qa_report_1.buildDefectId)(input.testFile, selector),
          severity: (0, qa_report_1.severityFor)("unresolved"),
          expected: `El test "${input.testName}" termina sin errores.`,
          actual: firstLine(input.errorMessage),
          ...passthrough(input)
        };
      }
      if (selector === "Unknown selector") {
        return {
          testName: input.testName,
          testFile: input.testFile,
          selector,
          errorMessage: input.errorMessage,
          status: "unresolved",
          fixedSelector: "",
          confidence: 0,
          explanation: "No se pudo extraer un selector del mensaje de error.",
          selectorType: "UNKNOWN",
          defectId: (0, qa_report_1.buildDefectId)(input.testFile, selector),
          severity: (0, qa_report_1.severityFor)("unresolved"),
          expected: `El test "${input.testName}" termina sin errores.`,
          actual: firstLine(input.errorMessage),
          ...passthrough(input)
        };
      }
      const heal = (0, healing_engine_1.analyzeAndHeal)({
        selector,
        htmlContext: input.domContext,
        testName: input.testName,
        errorMessage: input.errorMessage,
        testFile: input.testFile,
        repertoire: input.repertoire,
        customTestIds: config.customTestIds,
        customSynonyms: config.customSynonyms,
        maxAlternatives: thresholds.maxAlternatives
      });
      const status = heal.confidence >= thresholds.minConfidence ? "healed" : heal.confidence >= thresholds.reviewConfidence ? "review" : "unresolved";
      return {
        testName: input.testName,
        testFile: input.testFile,
        selector,
        errorMessage: input.errorMessage,
        status,
        fixedSelector: heal.fixedSelector,
        confidence: heal.confidence,
        explanation: heal.explanation,
        selectorType: heal.selectorType,
        verified: heal.verified,
        fromRepertoire: heal.fromRepertoire,
        defectId: (0, qa_report_1.buildDefectId)(input.testFile, selector),
        severity: (0, qa_report_1.severityFor)(status),
        expected: `El selector ${selector} encuentra un elemento en la p\xE1gina.`,
        actual: firstLine(input.errorMessage),
        ...passthrough(input),
        healResponse: heal
      };
    }
  }
});

// ../reporter-core/dist/local-report.js
var require_local_report = __commonJS({
  "../reporter-core/dist/local-report.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.statsFromCases = exports2.baseEnvironment = void 0;
    exports2.buildLocalRunFromEvents = buildLocalRunFromEvents;
    exports2.printSummary = printSummary;
    exports2.renderLocalReportHtml = renderLocalReportHtml;
    exports2.renderLocalReportJson = renderLocalReportJson;
    var qa_report_1 = require_qa_report();
    Object.defineProperty(exports2, "baseEnvironment", { enumerable: true, get: function() {
      return qa_report_1.baseEnvironment;
    } });
    Object.defineProperty(exports2, "statsFromCases", { enumerable: true, get: function() {
      return qa_report_1.statsFromCases;
    } });
    function buildLocalRunFromEvents(events, options) {
      const cases = events.map((e) => {
        const status = e.type === "healed" ? "healed" : e.type === "no-suggestion" || e.type === "failed" ? "unresolved" : "review";
        return {
          testName: e.originalSelector,
          selector: e.originalSelector,
          errorMessage: `${e.type}: ${e.originalSelector}`,
          status,
          fixedSelector: e.fixedSelector ?? "",
          confidence: e.confidence ?? 0,
          explanation: e.explanation ?? "",
          selectorType: e.type === "healed" ? "HEALED" : "UNKNOWN",
          verified: e.verified,
          defectId: (0, qa_report_1.buildDefectId)(void 0, e.originalSelector),
          severity: (0, qa_report_1.severityFor)(status),
          expected: `El selector ${e.originalSelector} encuentra un elemento en la p\xE1gina.`,
          actual: `${e.type}: ${e.originalSelector}`
        };
      });
      return {
        project: options.project,
        framework: options.framework,
        generatedAt: /* @__PURE__ */ new Date(),
        cases,
        verdict: cases.some((c) => c.status !== "healed") ? "failed" : "passed",
        stats: (0, qa_report_1.statsFromCases)(cases),
        environment: (0, qa_report_1.baseEnvironment)(options.framework)
      };
    }
    function printSummary(cases) {
      const count = (status) => cases.filter((c) => c.status === status).length;
      console.log(`Healed: ${count("healed")} | Review: ${count("review")} | Unresolved: ${count("unresolved")}`);
    }
    function escapeHtml(value) {
      return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    function escapeJs(value) {
      return JSON.stringify(value);
    }
    var STATUS_LABEL = {
      healed: "Sanado",
      review: "A revisar",
      unresolved: "Sin sugerencia"
    };
    function sortAttention(a, b) {
      if (a.status !== b.status)
        return a.status === "unresolved" ? -1 : 1;
      return a.confidence - b.confidence;
    }
    function renderAttentionCase(c) {
      const pct = Math.round(c.confidence * 100);
      const hasFixed = c.status === "review" && c.fixedSelector.length > 0;
      const suggestionHtml = hasFixed ? `<div class="diff-col after">
        <div class="label">Sugerencia ${c.verified ? '<span class="verified-tag">verificada en la p\xE1gina</span>' : "(heur\xEDstica local, sin comprobar)"}</div>
        <code class="copy-source">${escapeHtml(c.fixedSelector)}</code>
      </div>` : `<div class="diff-col after empty">
        <div class="label">Sugerencia</div>
        <code>\u2014 sin candidato confiable \u2014</code>
      </div>`;
      const confidenceHtml = c.confidence > 0 ? `<div class="confidence">
          <span class="pct">${pct}%</span>
          <span class="meter"><span style="width:${pct}%"></span></span>
        </div>` : "";
      const copyBtn = hasFixed ? `<button class="btn" data-action="copy" aria-label="Copiar sugerencia">Copiar sugerencia</button>` : "";
      const location = c.testFile ? `${c.testFile}${c.line ? `:${c.line}` : ""}` : "";
      const qaGridHtml = c.expected || c.actual ? `<div class="qa-grid">
          ${c.expected ? `<div class="qa-field"><div class="label">Resultado esperado</div><div class="value">${escapeHtml(c.expected)}</div></div>` : ""}
          ${c.actual ? `<div class="qa-field"><div class="label">Resultado obtenido</div><div class="value">${escapeHtml(c.actual)}</div></div>` : ""}
        </div>` : "";
      const stepsHtml = c.steps && c.steps.length > 0 ? `<div class="qa-field"><div class="label">Pasos para reproducir</div>
          <ol class="steps">${c.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol></div>` : "";
      const evidenceHtml = c.attachments && c.attachments.length > 0 ? `<div class="qa-field"><div class="label">Evidencia</div>
          <div class="evidence">${c.attachments.map((a) => a.contentType?.startsWith("image/") ? `<a href="${escapeHtml(a.path)}" target="_blank" rel="noopener" title="${escapeHtml(a.name)}"><img src="${escapeHtml(a.path)}" alt="${escapeHtml(a.name)}"></a>` : `<a href="${escapeHtml(a.path)}" target="_blank" rel="noopener">${escapeHtml(a.name)}</a>`).join("")}</div></div>` : "";
      return `
    <article class="case ${c.status}" data-id="${c._id}">
      <div class="case-top">
        <span class="sev ${c.severity}">${qa_report_1.SEVERITY_LABEL[c.severity]}</span>
        <span class="defect-id">${escapeHtml(c.defectId)}</span>
        <span class="status-pill">${STATUS_LABEL[c.status]}</span>
        <span class="case-title">
          <span class="name">${escapeHtml(c.testName)}</span>
          ${location ? `<span class="path">${escapeHtml(location)}</span>` : ""}
        </span>
        ${confidenceHtml}
      </div>
      <div class="case-body">
        ${qaGridHtml}
        <div class="error">${escapeHtml(c.errorMessage)}</div>
        <div class="diff">
          <div class="diff-col before">
            <div class="label">Selector original</div>
            <code>${escapeHtml(c.selector)}</code>
          </div>
          ${suggestionHtml}
        </div>
        ${// Con `unresolved` no se muestra la explicación del motor: describe la estrategia
      // que intentó, y al lado de "sin candidato confiable" se lee como si igual hubiera
      // propuesto algo. Mismo criterio que el Markdown.
      c.explanation && c.status !== "unresolved" ? `<p class="engine-note">${escapeHtml(c.explanation)}</p>` : ""}
        ${stepsHtml}
        ${evidenceHtml}
        <div class="case-actions">
          ${copyBtn}
          <button class="btn" data-action="fix">Marcar como arreglado</button>
        </div>
      </div>
    </article>`;
    }
    function renderHealedCase(c) {
      return `
    <div class="mini" data-id="${c._id}">
      <span class="mini-name" title="${escapeHtml(c.testName)}">${escapeHtml(c.testName)}</span>
      <code class="mini-selector before" title="${escapeHtml(c.selector)}">${escapeHtml(c.selector)}</code>
      <span class="mini-arrow">\u2192</span>
      <code class="mini-selector after" title="${escapeHtml(c.fixedSelector)}">${escapeHtml(c.fixedSelector)}</code>
      ${c.testFile ? `<span class="mini-file">${escapeHtml(c.testFile)}</span>` : ""}
    </div>`;
    }
    function renderLocalReportHtml(rawRun) {
      const run = (0, qa_report_1.normalizeRun)(rawRun);
      const indexed = run.cases.map((c, i) => ({ ...c, _id: i }));
      const total = indexed.length;
      const healedCases = indexed.filter((c) => c.status === "healed");
      const attentionCases = indexed.filter((c) => c.status !== "healed").sort(sortAttention);
      const reviewCount = attentionCases.filter((c) => c.status === "review").length;
      const unresolvedCount = attentionCases.filter((c) => c.status === "unresolved").length;
      const dateStr = run.generatedAt.toLocaleString("es-AR");
      const storageKey = `healify-fixed:${run.project}:${run.generatedAt.toISOString()}`;
      return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Healify \u2014 Informe local</title>
<style>
  :root {
    --background: #000000;
    --card: #0A0A0A;
    --card-elevated: #111111;
    --foreground: #EDEDED;
    --muted: #8A8A8A;
    --border: rgba(255,255,255,0.08);
    --border-strong: rgba(255,255,255,0.16);
    --ring: rgba(139,92,246,0.5);
    --ring-soft: rgba(139,92,246,0.12);
    --healed: #34D399;
    --healed-soft: rgba(52,211,153,0.12);
    --review: #E8B94D;
    --review-soft: rgba(232,185,77,0.12);
    --unresolved: #E85C4A;
    --unresolved-soft: rgba(232,92,74,0.12);
  }
  @media (prefers-color-scheme: light) {
    :root {
      --background: #FFFFFF;
      --card: #FAFAFA;
      --card-elevated: #FFFFFF;
      --foreground: #0A0A0A;
      --muted: #6B6B6B;
      --border: rgba(0,0,0,0.08);
      --border-strong: rgba(0,0,0,0.16);
      --healed: #047857;
      --healed-soft: rgba(5,150,105,0.09);
      --review: #B45309;
      --review-soft: rgba(180,83,9,0.09);
      --unresolved: #B91C1C;
      --unresolved-soft: rgba(185,28,28,0.08);
    }
  }
  :root[data-theme="dark"] {
    --background: #000000; --card: #0A0A0A; --card-elevated: #111111; --foreground: #EDEDED; --muted: #8A8A8A;
    --border: rgba(255,255,255,0.08); --border-strong: rgba(255,255,255,0.16);
    --healed: #34D399; --healed-soft: rgba(52,211,153,0.12);
    --review: #E8B94D; --review-soft: rgba(232,185,77,0.12);
    --unresolved: #E85C4A; --unresolved-soft: rgba(232,92,74,0.12);
  }
  :root[data-theme="light"] {
    --background: #FFFFFF; --card: #FAFAFA; --card-elevated: #FFFFFF; --foreground: #0A0A0A; --muted: #6B6B6B;
    --border: rgba(0,0,0,0.08); --border-strong: rgba(0,0,0,0.16);
    --healed: #047857; --healed-soft: rgba(5,150,105,0.09);
    --review: #B45309; --review-soft: rgba(180,83,9,0.09);
    --unresolved: #B91C1C; --unresolved-soft: rgba(185,28,28,0.08);
  }

  * { box-sizing: border-box; }
  @media (prefers-reduced-motion: reduce) { * { animation-duration: .001ms !important; transition-duration: .001ms !important; } }

  body {
    margin: 0;
    background: var(--background);
    color: var(--foreground);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 15px;
    line-height: 1.55;
    padding: clamp(20px, 4vw, 56px);
  }
  button { font: inherit; color: inherit; background: none; border: none; cursor: pointer; }
  a { color: var(--ring); }
  .mono { font-family: "JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
  .sheet { max-width: 900px; margin: 0 auto; }

  h1 { font-size: 24px; margin: 0; letter-spacing: -0.02em; font-weight: 600; }

  .masthead {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap;
    padding-bottom: 20px; border-bottom: 1px solid var(--border); margin-bottom: 20px;
  }
  .masthead .id { display: flex; align-items: center; gap: 12px; }
  .masthead .glyph {
    width: 34px; height: 34px; border-radius: 8px;
    background: linear-gradient(180deg,#fff 0%,#d7d7d7 100%);
    color: #0A0A0A; display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 15px; flex: none;
  }
  .masthead .sub { color: var(--muted); font-size: 13px; margin-top: 3px; }
  .masthead-right { display: flex; align-items: center; gap: 8px; }

  .local-badge, .heuristica-btn, .theme-btn {
    display: inline-flex; align-items: center; gap: 6px;
    border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap;
  }
  .local-badge { background: var(--ring-soft); color: #C4B5FD; border: 1px solid var(--ring); padding: 6px 12px; }
  .local-badge::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #A78BFA; }
  .heuristica-btn, .theme-btn {
    background: var(--card); border: 1px solid var(--border); color: var(--foreground); padding: 6px 12px;
    transition: border-color 150ms ease;
  }
  .heuristica-btn:hover, .theme-btn:hover { border-color: var(--border-strong); }

  .meta-strip {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    background: var(--card); border: 1px solid var(--border); border-radius: 10px;
    margin-bottom: 26px; overflow-x: auto;
  }
  .meta-cell { padding: 13px 16px; border-right: 1px solid var(--border); }
  .meta-cell:last-child { border-right: none; }
  .meta-cell .label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin-bottom: 4px; }
  .meta-cell .value { font-size: 13.5px; font-weight: 600; }

  .vitals { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 32px; }
  .vital {
    background: var(--card); border: 1px solid var(--border); border-radius: 10px;
    padding: 15px 16px; transition: border-color 150ms ease;
  }
  .vital:hover { border-color: var(--border-strong); }
  .vital .n { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
  .vital .l { margin-top: 6px; font-size: 12px; color: var(--muted); display: flex; align-items: center; gap: 6px; }
  .vital .dot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--muted); }
  .vital.healed .n { color: var(--healed); } .vital.healed .dot { background: var(--healed); }
  .vital.review .n { color: var(--review); } .vital.review .dot { background: var(--review); }
  .vital.unresolved .n { color: var(--unresolved); } .vital.unresolved .dot { background: var(--unresolved); }

  .verdict {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
    border: 1px solid var(--border); border-radius: 10px; padding: 16px 18px; margin-bottom: 18px;
  }
  .verdict .tag {
    font-size: 15px; font-weight: 700; letter-spacing: .08em; padding: 6px 14px; border-radius: 8px; flex: none;
  }
  .verdict.pass { background: var(--healed-soft); border-color: var(--healed); }
  .verdict.pass .tag { background: var(--healed); color: var(--background); }
  .verdict.fail { background: var(--unresolved-soft); border-color: var(--unresolved); }
  .verdict.fail .tag { background: var(--unresolved); color: #fff; }
  .verdict .detail { font-size: 13.5px; color: var(--foreground); }
  .verdict .detail .muted { color: var(--muted); }

  .sev {
    flex: none; font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 5px;
    text-transform: uppercase; letter-spacing: .04em;
  }
  .sev.blocker { background: var(--unresolved-soft); color: var(--unresolved); }
  .sev.major { background: var(--review-soft); color: var(--review); }
  .sev.minor { background: var(--healed-soft); color: var(--healed); }
  .defect-id {
    flex: none; font-family: "JetBrains Mono", monospace; font-size: 11px; color: var(--muted);
    border: 1px solid var(--border); border-radius: 5px; padding: 3px 7px;
  }
  .verified-tag {
    display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600;
    color: var(--healed); background: var(--healed-soft); border-radius: 5px; padding: 3px 8px;
    margin-left: 8px; vertical-align: middle;
  }
  .verified-tag::before { content: ""; width: 5px; height: 5px; border-radius: 50%; background: var(--healed); }

  .qa-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 14px 0; }
  .qa-field .label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 5px; }
  .qa-field .value { font-size: 12.5px; line-height: 1.5; }
  .steps { margin: 14px 0 0 0; padding-left: 20px; font-size: 12.5px; color: var(--foreground); }
  .steps li { margin-bottom: 3px; }
  .evidence { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
  .evidence a {
    display: inline-flex; align-items: center; gap: 6px; font-size: 12px; text-decoration: none;
    border: 1px solid var(--border); border-radius: 8px; padding: 6px 11px; color: var(--foreground);
  }
  .evidence a:hover { border-color: var(--border-strong); }
  .evidence img { max-width: 220px; border-radius: 6px; border: 1px solid var(--border); display: block; }

  .section-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
  .section-head h2 { font-size: 16px; margin: 0; font-weight: 600; }
  .section-head .count { font-size: 12.5px; color: var(--muted); }
  section.collapsed .cases-wrap { display: none; }
  .section-head { cursor: pointer; user-select: none; }
  .section-head .chev { color: var(--muted); font-size: 12px; transition: transform .15s ease; margin-left: 8px; }
  section.collapsed .chev { transform: rotate(-90deg); }

  .cases { display: flex; flex-direction: column; gap: 10px; margin-bottom: 30px; }
  .empty {
    padding: 28px 18px; text-align: center; color: var(--muted); font-size: 13px;
    background: var(--card); border: 1px dashed var(--border); border-radius: 10px; margin-bottom: 30px;
  }

  .case {
    background: var(--card); border: 1px solid var(--border); border-radius: 10px;
    overflow: hidden; transition: border-color 150ms ease, opacity 200ms ease;
  }
  .case:hover { border-color: var(--border-strong); }
  .case.review { border-left: 2px solid var(--review); }
  .case.unresolved { border-left: 2px solid var(--unresolved); }
  .case.just-fixed { opacity: 0; }

  .case-top { display: flex; align-items: center; gap: 14px; padding: 13px 16px; flex-wrap: wrap; }
  .status-pill { flex: none; font-size: 11px; font-weight: 600; padding: 4px 9px; border-radius: 999px; }
  .case.review .status-pill { background: var(--review-soft); color: var(--review); }
  .case.unresolved .status-pill { background: var(--unresolved-soft); color: var(--unresolved); }

  .case-title { flex: 1; min-width: 160px; display: flex; flex-direction: column; gap: 2px; }
  .case-title .name { font-weight: 500; font-size: 13.5px; }
  .case-title .path { font-family: "JetBrains Mono", monospace; font-size: 11.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .confidence { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; width: 100px; }
  .confidence .pct { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .case.review .confidence .pct { color: var(--review); }
  .case.unresolved .confidence .pct { color: var(--unresolved); }
  .meter { width: 100%; height: 3px; border-radius: 2px; background: rgba(128,128,128,.18); overflow: hidden; }
  .meter span { display: block; height: 100%; }
  .case.review .meter span { background: var(--review); }
  .case.unresolved .meter span { background: var(--unresolved); }

  .case-body { padding: 2px 16px 16px 16px; border-top: 1px solid var(--border); }
  .case-body .error {
    font-family: "JetBrains Mono", monospace; font-size: 12px; color: var(--muted);
    background: rgba(128,128,128,.06); border: 1px solid var(--border); border-radius: 8px;
    padding: 10px 12px; margin: 14px 0; white-space: pre-wrap; word-break: break-word;
  }
  .diff { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 14px 0; }
  .diff-col .label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 6px; }
  .diff-col code {
    display: block; font-family: "JetBrains Mono", monospace; font-size: 12.5px;
    padding: 10px 12px; border-radius: 8px; word-break: break-all; border: 1px solid var(--border);
  }
  .diff-col.before code { background: var(--unresolved-soft); color: #FCA5A5; }
  .diff-col.after code { background: var(--review-soft); color: #FCD34D; }
  .diff-col.after.empty code { background: rgba(128,128,128,.06); color: var(--muted); font-style: italic; }

  .engine-note { font-size: 12px; color: var(--muted); margin: 10px 0 0 0; }

  .case-actions { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
  .btn {
    padding: 6px 12px; background: var(--card-elevated); border: 1px solid var(--border); border-radius: 8px;
    font-size: 12px; color: var(--foreground); transition: border-color 150ms ease;
  }
  .btn:hover { border-color: var(--border-strong); }
  .btn.copied { color: var(--healed); border-color: var(--healed-soft); }

  .mini {
    display: flex; align-items: center; gap: 10px; padding: 8px 14px;
    background: var(--card); border: 1px solid var(--border); border-left: 2px solid var(--healed-soft);
    border-radius: 8px; transition: opacity 200ms ease;
  }
  .mini.just-fixed { opacity: 0; }
  .mini-selector {
    font-family: "JetBrains Mono", monospace; font-size: 11.5px; padding: 2px 7px; border-radius: 4px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px;
  }
  .mini-name { font-size: 12px; color: var(--foreground); flex: none; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mini-selector.before { color: var(--muted); text-decoration: line-through; }
  .mini-selector.after { color: var(--healed); background: var(--healed-soft); }
  .mini-arrow { color: var(--muted); flex: none; }
  .mini-file { margin-left: auto; font-family: "JetBrains Mono", monospace; font-size: 10.5px; color: var(--muted); flex: none; }

  .foot {
    display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
    padding-top: 18px; border-top: 1px solid var(--border); font-size: 12px; color: var(--muted);
  }
  .foot .privacy { display: flex; align-items: center; gap: 8px; }
  .foot .privacy .dot { width: 6px; height: 6px; border-radius: 50%; background: #A78BFA; }

  dialog.modal {
    border: none; padding: 0; background: var(--card); color: var(--foreground); border-radius: 12px;
    max-width: 600px; width: calc(100% - 32px); border: 1px solid var(--border-strong);
  }
  dialog.modal::backdrop { background: rgba(0,0,0,0.55); }
  .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 22px 14px; border-bottom: 1px solid var(--border); }
  .modal-header h2 { font-size: 15.5px; font-weight: 600; margin: 0; }
  .modal-close { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: var(--muted); border-radius: 6px; }
  .modal-close:hover { background: var(--card-elevated); color: var(--foreground); }
  .modal-body { padding: 18px 22px 22px; max-height: 68vh; overflow-y: auto; }
  .modal-body p { font-size: 13px; line-height: 1.6; color: var(--muted); margin: 0 0 14px; }
  .modal-body p strong { color: var(--foreground); }
  .modal-body h3 { font-size: 10.5px; text-transform: uppercase; letter-spacing: .07em; color: var(--muted); margin: 18px 0 8px; }
  .rules { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .rules li { padding: 10px 12px; background: var(--card-elevated); border: 1px solid var(--border); border-radius: 8px; font-size: 12.5px; color: var(--muted); line-height: 1.5; }
  .rules li strong { display: block; color: var(--foreground); font-size: 12.5px; margin-bottom: 3px; }
  .rules code, .modal-body code { font-family: "JetBrains Mono", monospace; font-size: 11.5px; padding: 1px 5px; background: rgba(128,128,128,.14); border-radius: 3px; color: var(--foreground); }
  .modal-footer { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 12px; }
  .modal-footer a { font-weight: 500; }

  @media (max-width: 600px) {
    .vitals { grid-template-columns: repeat(2, 1fr); }
    .diff { grid-template-columns: 1fr; }
    .masthead { flex-direction: column; }
  }
</style>
</head>
<body>
<div class="sheet">

  <div class="masthead">
    <div class="id">
      <div class="glyph">H</div>
      <div>
        <h1>Informe de sanado \u2014 local</h1>
        <div class="sub">${escapeHtml(run.framework)} \xB7 sin conexi\xF3n a la nube</div>
      </div>
    </div>
    <div class="masthead-right">
      <button class="heuristica-btn" id="heuristica-trigger" type="button">\xBFC\xF3mo funciona?</button>
      <button class="theme-btn" id="theme-toggle" type="button">Tema</button>
      <span class="local-badge">100% local</span>
    </div>
  </div>

  <div class="verdict ${run.verdict === "passed" ? "pass" : "fail"}">
    <span class="tag">${run.verdict === "passed" ? "PASS" : "FAIL"}</span>
    <span class="detail">
      ${run.stats.passed} de ${run.stats.total} test${run.stats.total === 1 ? "" : "s"} sin errores
      ${run.stats.failed > 0 ? `<span class="muted">\xB7 ${run.stats.failed} con fallos</span>` : ""}
    </span>
  </div>

  <div class="meta-strip">
    <div class="meta-cell"><div class="label">Proyecto</div><div class="value">${escapeHtml(run.project)}</div></div>
    <div class="meta-cell"><div class="label">Generado</div><div class="value mono">${escapeHtml(dateStr)}</div></div>
    ${(0, qa_report_1.environmentRows)(run).map((row) => `<div class="meta-cell"><div class="label">${escapeHtml(row.label)}</div><div class="value mono">${escapeHtml(row.value)}</div></div>`).join("")}
  </div>

  <div class="vitals">
    <div class="vital"><div class="n">${total}</div><div class="l"><span class="dot"></span>Tests con selector roto</div></div>
    <div class="vital healed"><div class="n" id="vital-healed-n">${healedCases.length}</div><div class="l"><span class="dot"></span>Sanados</div></div>
    <div class="vital review"><div class="n" id="vital-review-n">${reviewCount}</div><div class="l"><span class="dot"></span>A revisar</div></div>
    <div class="vital unresolved"><div class="n" id="vital-unresolved-n">${unresolvedCount}</div><div class="l"><span class="dot"></span>Sin sugerencia</div></div>
  </div>

  <section id="section-attention">
    <div class="section-head" data-toggle="attention">
      <h2>Necesita tu atenci\xF3n</h2>
      <span class="count"><span id="attention-count-n">${attentionCases.length} caso${attentionCases.length === 1 ? "" : "s"}</span><span class="chev">\u25BE</span></span>
    </div>
    <div class="cases-wrap" id="attention-wrap">
      ${attentionCases.length > 0 ? `<div class="cases">${attentionCases.map(renderAttentionCase).join("\n")}</div>` : `<div class="empty">${total === 0 ? "Ning\xFAn test fall\xF3 por un selector roto en esta corrida." : "Todo limpio \u2014 no hay selectores que necesiten revisi\xF3n manual."}</div>`}
    </div>
  </section>

  <section id="section-healed" class="collapsed">
    <div class="section-head" data-toggle="healed">
      <h2>Sanados autom\xE1ticamente</h2>
      <span class="count">${healedCases.length} caso${healedCases.length === 1 ? "" : "s"}<span class="chev">\u25BE</span></span>
    </div>
    <div class="cases-wrap">
      ${healedCases.length > 0 ? `<div class="cases">${healedCases.map(renderHealedCase).join("\n")}</div>` : `<div class="empty">A\xFAn no hay casos sanados en esta corrida.</div>`}
    </div>
  </section>

  <div class="foot">
    <span class="privacy"><span class="dot"></span>Ning\xFAn dato de este proyecto sali\xF3 de esta m\xE1quina</span>
    <span>healify-report.json y healify-report.md generados junto a este archivo</span>
  </div>

</div>

<dialog class="modal" id="heuristica-modal">
  <div class="modal-header">
    <h2>Heur\xEDstica local, no IA</h2>
    <button class="modal-close" data-close type="button" aria-label="Cerrar">\xD7</button>
  </div>
  <div class="modal-body">
    <p><strong>Esto no es un modelo de IA.</strong> Es <em>pattern-matching</em> determin\xEDstico sobre el texto del selector y del mensaje de error, corriendo 100% en tu m\xE1quina. No hay red, no hay servidor, no hay cuenta.</p>
    <p><strong>Dos modos, y la diferencia importa.</strong> Cuando el framework aporta el \xE1rbol de accesibilidad de la p\xE1gina (Playwright lo guarda solo al fallar un test), las sugerencias de rol se confrontan contra lo que hab\xEDa de verdad en pantalla: se descarta lo que no existe y los nombres se leen de la p\xE1gina. Esas llevan la marca <strong>verificada en la p\xE1gina</strong>. Cuando ese dato no est\xE1, el motor decide solo por el texto del selector fallido, sin forma de comprobar nada \u2014 y lo dice.</p>
    <p><strong>Sin memoria entre corridas.</strong> Cada caso se eval\xFAa aislado; el motor no aprende de lo que sugiri\xF3 antes.</p>
    <h3>Reglas que aplica</h3>
    <ul class="rules">
      <li><strong>IDs din\xE1micos</strong>Si el selector es un <code>#id</code> con d\xEDgitos o un sufijo hexadecimal (ej. <code>#user-a1b2c3</code>), se marca como inestable y se propone una clase derivada del mismo nombre, sin el sufijo din\xE1mico.</li>
      <li><strong>Clases generadas</strong>Patrones de CSS-modules (<code>_boton_x7f2</code>) o styled-components (<code>sc-a1b2c3</code>) se marcan como no confiables.</li>
      <li><strong><code>data-testid</code> / <code>data-cy</code></strong>Si ya existe, se conserva y normaliza \u2014 es el candidato de mayor confianza.</li>
      <li><strong>XPath</strong>Se reemplaza siempre por un selector de rol ARIA, por ser el tipo m\xE1s fr\xE1gil ante cambios de estructura.</li>
      <li><strong>Tipo de elemento por texto del selector</strong>Detecta patrones como <code>button</code>/<code>btn</code>, <code>input</code>/<code>field</code>, <code>link</code>/<code>nav</code> en el propio selector para sugerir un rol ARIA, texto visible, placeholder o la relaci\xF3n <code>label \u2192 input</code>.</li>
      <li><strong>Diccionarios de acciones y campos (ES/EN)</strong>Nombres como <code>login</code>, <code>guardar</code>, <code>email</code>, <code>contrase\xF1a</code> se traducen al texto visible esperado en la sugerencia.</li>
      <li><strong>Locators modernos de Playwright</strong>Si el selector ya usa <code>getByRole</code>/<code>getByText</code>/etc., no se toca \u2014 se marca para revisi\xF3n manual, porque sin acceso al DOM real no se puede saber por qu\xE9 dej\xF3 de matchear.</li>
      <li><strong>Confianza</strong>Puntaje base por estrategia + un ajuste determin\xEDstico (no aleatorio) derivado del hash del selector, acotado entre 75% y 98%. <strong>\u226590%</strong> se marca sanado autom\xE1tico, <strong>80\u201390%</strong> a revisar, <strong>&lt;80%</strong> sin sugerencia mostrada.</li>
    </ul>
    <h3>Cu\xE1ndo no hay sugerencia</h3>
    <p>Cuando no se pudo extraer ning\xFAn selector del mensaje de error, o cuando la confianza de la mejor estrategia queda por debajo del 80%. La heur\xEDstica prefiere no mostrar una sugerencia d\xE9bil a arriesgarse a romper otro test.</p>
    <div class="modal-footer">
      <span>Open source \xB7 auditable \xB7 0 telemetr\xEDa</span>
      <a href="https://github.com/mescobar996/Healify/blob/main/reporter-core/src/healing-engine.ts" target="_blank" rel="noopener">Ver el motor en GitHub \u2192</a>
    </div>
  </div>
</dialog>

<script>
(function () {
  'use strict';
  var STORAGE_THEME = 'healify-theme';
  var STORAGE_FIXED = ${escapeJs(storageKey)};

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_THEME, theme);
  }
  var savedTheme = localStorage.getItem(STORAGE_THEME);
  if (savedTheme) applyTheme(savedTheme);

  document.getElementById('theme-toggle').addEventListener('click', function () {
    var current = document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  document.getElementById('heuristica-trigger').addEventListener('click', function () {
    document.getElementById('heuristica-modal').showModal();
  });
  document.querySelectorAll('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () { document.getElementById('heuristica-modal').close(); });
  });
  document.getElementById('heuristica-modal').addEventListener('click', function (e) {
    if (e.target === e.currentTarget) e.currentTarget.close();
  });

  document.querySelectorAll('[data-toggle]').forEach(function (head) {
    head.addEventListener('click', function () {
      document.getElementById('section-' + head.dataset.toggle).classList.toggle('collapsed');
    });
  });

  function loadFixed() {
    try { return new Set(JSON.parse(localStorage.getItem(STORAGE_FIXED) || '[]')); }
    catch (e) { return new Set(); }
  }
  function saveFixed(set) {
    localStorage.setItem(STORAGE_FIXED, JSON.stringify(Array.from(set)));
  }

  function updateCounts() {
    var remaining = document.querySelectorAll('#section-attention .case');
    var review = 0, unresolved = 0;
    remaining.forEach(function (c) {
      if (c.classList.contains('review')) review++;
      else if (c.classList.contains('unresolved')) unresolved++;
    });
    var total = review + unresolved;
    var countEl = document.getElementById('attention-count-n');
    if (countEl) countEl.textContent = total + ' caso' + (total === 1 ? '' : 's');
    var reviewEl = document.getElementById('vital-review-n');
    if (reviewEl) reviewEl.textContent = String(review);
    var unresolvedEl = document.getElementById('vital-unresolved-n');
    if (unresolvedEl) unresolvedEl.textContent = String(unresolved);
    // Solo se reemplaza si de verdad hab\xEDa casos renderizados y el usuario los fue marcando.
    // Sin este chequeo pisaba el mensaje del estado inicial vac\xEDo ("ning\xFAn test fall\xF3 por un
    // selector roto"), que dice algo distinto y m\xE1s preciso.
    var wrap = document.getElementById('attention-wrap');
    if (total === 0 && wrap && wrap.querySelector('.cases')) {
      wrap.innerHTML = '<div class="empty">Todo limpio \u2014 no hay selectores que necesiten revisi\xF3n manual.</div>';
    }
  }

  var fixed = loadFixed();
  fixed.forEach(function (id) {
    var el = document.querySelector('.case[data-id="' + id + '"]');
    if (el) el.remove();
  });
  updateCounts();

  document.addEventListener('click', function (e) {
    var copyBtn = e.target.closest('[data-action="copy"]');
    if (copyBtn) {
      var code = copyBtn.closest('.case').querySelector('.copy-source');
      var text = code ? code.textContent : '';
      var done = function () {
        copyBtn.classList.add('copied');
        var original = copyBtn.textContent;
        copyBtn.textContent = 'Copiado';
        setTimeout(function () { copyBtn.classList.remove('copied'); copyBtn.textContent = original; }, 1400);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done).catch(function () {});
      } else {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (err) {}
        document.body.removeChild(ta);
      }
      return;
    }

    var fixBtn = e.target.closest('[data-action="fix"]');
    if (fixBtn) {
      var card = fixBtn.closest('.case');
      var id = card.dataset.id;
      fixed.add(id);
      saveFixed(fixed);
      card.classList.add('just-fixed');
      setTimeout(function () { card.remove(); updateCounts(); }, 220);
    }
  });
})();
</script>
</body>
</html>
`;
    }
    function renderLocalReportJson(rawRun) {
      const run = (0, qa_report_1.normalizeRun)(rawRun);
      return JSON.stringify({
        project: run.project,
        framework: run.framework,
        generatedAt: run.generatedAt.toISOString(),
        verdict: run.verdict,
        environment: run.environment,
        stats: run.stats,
        // `summary` se mantiene por compatibilidad con consumidores que ya lo leían (gh-action).
        // `stats` es el que tiene los totales de la suite entera, no solo de los casos rotos.
        summary: {
          total: run.cases.length,
          healed: run.cases.filter((c) => c.status === "healed").length,
          review: run.cases.filter((c) => c.status === "review").length,
          unresolved: run.cases.filter((c) => c.status === "unresolved").length
        },
        cases: run.cases
      }, null, 2);
    }
  }
});

// ../reporter-core/dist/browser-probe.js
var require_browser_probe = __commonJS({
  "../reporter-core/dist/browser-probe.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.BROWSER_PROBE_SCRIPT = void 0;
    exports2.domContextFromProbeResult = domContextFromProbeResult2;
    var page_snapshot_1 = require_page_snapshot();
    exports2.BROWSER_PROBE_SCRIPT = `
var MAX_DEPTH = 12;
var MAX_NODES = 3000;
var results = [];

function healifyRoleOf(el, tag) {
  var role = el.getAttribute('role');
  if (role) return role;
  if (tag === 'a') return el.hasAttribute('href') ? 'link' : null;
  if (tag === 'button') return 'button';
  if (tag === 'select') return 'combobox';
  if (tag === 'textarea') return 'textbox';
  if (tag === 'input') {
    var type = (el.getAttribute('type') || 'text').toLowerCase();
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    if (type === 'submit' || type === 'button') return 'button';
    if (type === 'search') return 'searchbox';
    if (type === 'hidden') return null;
    return 'textbox';
  }
  return null;
}

function healifyNameOf(el) {
  var ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();
  var text = (el.innerText || el.textContent || '').trim();
  if (text) return text.split('\\n')[0].trim();
  var placeholder = el.getAttribute('placeholder');
  if (placeholder) return placeholder.trim();
  if (typeof el.value === 'string' && el.value.trim()) return el.value.trim();
  return '';
}

/* Identificador del iframe, para que el usuario sepa a qu\xE9 contexto cambiar. Se elige la
   forma que adem\xE1s sea un selector CSS v\xE1lido, as\xED se puede pegar tal cual en
   frameLocator()/switchTo().frame(). Se sacan comillas y saltos de l\xEDnea, que s\xED romper\xEDan
   el formato "[frame=...]" del snapshot (los corchetes no: el parser ancla al final de l\xEDnea). */
function healifyFrameLabel(el, index) {
  var raw = el.getAttribute('id')
    ? 'iframe#' + el.getAttribute('id')
    : el.getAttribute('name')
      ? 'iframe[name=' + el.getAttribute('name') + ']'
      : el.getAttribute('src')
        ? 'iframe[src=' + el.getAttribute('src') + ']'
        : 'iframe:nth-of-type(' + (index + 1) + ')';
  return raw.replace(/[\\r\\n"]/g, '');
}

function healifyScan(root, framePath, depth) {
  if (depth > MAX_DEPTH || results.length >= MAX_NODES) return;

  var nodes = root.querySelectorAll('*');
  var frameIndex = 0;

  for (var i = 0; i < nodes.length; i++) {
    if (results.length >= MAX_NODES) return;
    var el = nodes[i];
    var tag = el.tagName ? el.tagName.toLowerCase() : '';

    var isCandidate = el.getAttribute('role') ||
      tag === 'button' || tag === 'a' || tag === 'input' || tag === 'textarea' || tag === 'select';
    if (isCandidate) {
      var role = healifyRoleOf(el, tag);
      if (role) {
        var entry = { role: role, name: healifyNameOf(el) };
        if (framePath) entry.frame = framePath;
        results.push(entry);
      }
    }

    /* Shadow DOM abierto: mismo contexto de locator que el documento que lo contiene
       (Playwright y los selectores CSS lo atraviesan solos), as\xED que NO lleva marca de frame. */
    if (el.shadowRoot) healifyScan(el.shadowRoot, framePath, depth + 1);

    if (tag === 'iframe' || tag === 'frame') {
      var label = healifyFrameLabel(el, frameIndex);
      frameIndex++;
      try {
        var doc = el.contentDocument;
        if (doc) healifyScan(doc, framePath ? framePath + ' > ' + label : label, depth + 1);
      } catch (e) {
        /* cross-origin: inaccesible por seguridad, se saltea sin romper el resto del scan */
      }
    }
  }
}

healifyScan(document, '', 0);
return results;
`.trim();
    function domContextFromProbeResult2(raw) {
      if (!Array.isArray(raw))
        return void 0;
      const elements = raw.filter((item) => {
        if (typeof item !== "object" || item === null)
          return false;
        const candidate = item;
        return typeof candidate.role === "string" && typeof candidate.name === "string";
      }).map((item) => typeof item.frame === "string" && item.frame ? item : { role: item.role, name: item.name });
      if (elements.length === 0)
        return void 0;
      return (0, page_snapshot_1.formatPageElements)(elements);
    }
  }
});

// ../reporter-core/dist/audit.js
var require_audit = __commonJS({
  "../reporter-core/dist/audit.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.buildAuditEntry = buildAuditEntry;
    exports2.writeAuditReport = writeAuditReport;
    exports2.appendAuditEntry = appendAuditEntry;
    var node_crypto_1 = require("node:crypto");
    var node_fs_1 = require("node:fs");
    var node_path_1 = require("node:path");
    function hashDom(domSnippet) {
      if (!domSnippet)
        return void 0;
      return (0, node_crypto_1.createHash)("sha256").update(domSnippet).digest("hex");
    }
    function buildAuditEntry(response, request, context) {
      return {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        testName: request.testName ?? "unknown",
        testFile: request.testFile,
        line: context.line,
        originalSelector: request.selector,
        fixedSelector: response.fixedSelector,
        selectorType: response.selectorType,
        confidence: response.confidence,
        verified: response.verified,
        fromRepertoire: response.fromRepertoire,
        errorMessage: context.errorMessage,
        domSnippet: context.domSnippet,
        domHash: hashDom(context.domSnippet),
        screenshotPath: context.screenshotPath,
        alternatives: response.alternatives ?? [],
        technicalDetails: response.technicalDetails
      };
    }
    function writeAuditReport(entries, outputDir, project, framework) {
      const report = {
        project,
        framework,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        totalCases: entries.length,
        entries
      };
      const fullPath = (0, node_path_1.join)(outputDir, "healify-audit.json");
      (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(fullPath), { recursive: true });
      (0, node_fs_1.writeFileSync)(fullPath, JSON.stringify(report, null, 2), "utf-8");
      return fullPath;
    }
    function appendAuditEntry(entry, outputDir) {
      const fullPath = (0, node_path_1.join)(outputDir, "healify-audit.jsonl");
      (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(fullPath), { recursive: true });
      (0, node_fs_1.appendFileSync)(fullPath, JSON.stringify(entry) + "\n", "utf-8");
    }
  }
});

// ../reporter-core/dist/plugin-helpers.js
var require_plugin_helpers = __commonJS({
  "../reporter-core/dist/plugin-helpers.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.buildAuditFromEvent = buildAuditFromEvent2;
    exports2.flushPlugin = flushPlugin2;
    var node_fs_1 = require("node:fs");
    var node_path_1 = require("node:path");
    var audit_1 = require_audit();
    var local_report_1 = require_local_report();
    var MAX_AUDIT_ENTRIES = 1e3;
    function buildAuditFromEvent2(event, existingEntries) {
      if (existingEntries.length >= MAX_AUDIT_ENTRIES)
        return;
      try {
        const selectorType = event.fixedSelector ? event.fixedSelector.startsWith("//") || event.fixedSelector.startsWith("(") ? "XPATH" : "CSS" : "CSS";
        const response = {
          fixedSelector: event.fixedSelector ?? event.originalSelector,
          confidence: event.confidence ?? 0,
          verified: event.verified ?? false,
          fromRepertoire: false,
          explanation: event.explanation ?? "",
          selectorType,
          needsReview: false,
          robustnessImprovement: 0,
          alternatives: [],
          technicalDetails: {
            detectedIssue: `${event.type}: ${event.originalSelector}`,
            proposedSolution: event.explanation ?? "",
            accessibilityCompliant: false,
            stableAgainstDOMChanges: false
          }
        };
        const entry = (0, audit_1.buildAuditEntry)(response, { selector: event.originalSelector }, { errorMessage: `${event.type}: ${event.originalSelector}` });
        existingEntries.push(entry);
      } catch {
      }
    }
    function flushPlugin2(events, auditEntries, cwd, projectName, framework) {
      if (events.length === 0)
        return 0;
      const run = (0, local_report_1.buildLocalRunFromEvents)(events, { project: projectName, framework });
      (0, node_fs_1.writeFileSync)((0, node_path_1.join)(cwd, "healify-report.json"), (0, local_report_1.renderLocalReportJson)(run));
      const count = run.cases.length;
      events.length = 0;
      if (auditEntries.length > 0) {
        (0, audit_1.writeAuditReport)([...auditEntries], cwd, projectName, framework);
        auditEntries.length = 0;
      }
      return count;
    }
  }
});

// ../reporter-core/dist/index.js
var require_dist = __commonJS({
  "../reporter-core/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.flushPlugin = exports2.buildAuditFromEvent = exports2.appendAuditEntry = exports2.writeAuditReport = exports2.buildAuditEntry = exports2.DEFAULT_THRESHOLDS = exports2.resolveThresholds = exports2.loadConfig = exports2.findRepertoireMatch = exports2.readRepertoire = exports2.parseHistoryLines = exports2.domContextFromProbeResult = exports2.BROWSER_PROBE_SCRIPT = exports2.resolveLocatorStrategy = exports2.roleSuggestionToXPath = exports2.parseRoleSuggestion = exports2.selectorTokens = exports2.bestNameFor = exports2.bestElementFor = exports2.findMatches = exports2.existsInPage = exports2.formatPageElements = exports2.parsePageSnapshot = exports2.isPlaywrightOnlySelector = exports2.SEVERITY_LABEL = exports2.environmentRows = exports2.formatDuration = exports2.severityFor = exports2.buildDefectId = exports2.renderLocalReportMarkdown = exports2.statsFromCases = exports2.baseEnvironment = exports2.buildLocalRunFromEvents = exports2.printSummary = exports2.renderLocalReportJson = exports2.renderLocalReportHtml = exports2.runLocalHealing = exports2.analyzeAndHeal = exports2.extractSelectorFromError = void 0;
    var selector_extractor_1 = require_selector_extractor();
    Object.defineProperty(exports2, "extractSelectorFromError", { enumerable: true, get: function() {
      return selector_extractor_1.extractSelectorFromError;
    } });
    var healing_engine_1 = require_healing_engine();
    Object.defineProperty(exports2, "analyzeAndHeal", { enumerable: true, get: function() {
      return healing_engine_1.analyzeAndHeal;
    } });
    var local_mode_1 = require_local_mode();
    Object.defineProperty(exports2, "runLocalHealing", { enumerable: true, get: function() {
      return local_mode_1.runLocalHealing;
    } });
    var local_report_1 = require_local_report();
    Object.defineProperty(exports2, "renderLocalReportHtml", { enumerable: true, get: function() {
      return local_report_1.renderLocalReportHtml;
    } });
    Object.defineProperty(exports2, "renderLocalReportJson", { enumerable: true, get: function() {
      return local_report_1.renderLocalReportJson;
    } });
    Object.defineProperty(exports2, "printSummary", { enumerable: true, get: function() {
      return local_report_1.printSummary;
    } });
    Object.defineProperty(exports2, "buildLocalRunFromEvents", { enumerable: true, get: function() {
      return local_report_1.buildLocalRunFromEvents;
    } });
    Object.defineProperty(exports2, "baseEnvironment", { enumerable: true, get: function() {
      return local_report_1.baseEnvironment;
    } });
    Object.defineProperty(exports2, "statsFromCases", { enumerable: true, get: function() {
      return local_report_1.statsFromCases;
    } });
    var qa_report_1 = require_qa_report();
    Object.defineProperty(exports2, "renderLocalReportMarkdown", { enumerable: true, get: function() {
      return qa_report_1.renderLocalReportMarkdown;
    } });
    Object.defineProperty(exports2, "buildDefectId", { enumerable: true, get: function() {
      return qa_report_1.buildDefectId;
    } });
    Object.defineProperty(exports2, "severityFor", { enumerable: true, get: function() {
      return qa_report_1.severityFor;
    } });
    Object.defineProperty(exports2, "formatDuration", { enumerable: true, get: function() {
      return qa_report_1.formatDuration;
    } });
    Object.defineProperty(exports2, "environmentRows", { enumerable: true, get: function() {
      return qa_report_1.environmentRows;
    } });
    Object.defineProperty(exports2, "SEVERITY_LABEL", { enumerable: true, get: function() {
      return qa_report_1.SEVERITY_LABEL;
    } });
    var selector_compat_1 = require_selector_compat();
    Object.defineProperty(exports2, "isPlaywrightOnlySelector", { enumerable: true, get: function() {
      return selector_compat_1.isPlaywrightOnlySelector;
    } });
    var page_snapshot_1 = require_page_snapshot();
    Object.defineProperty(exports2, "parsePageSnapshot", { enumerable: true, get: function() {
      return page_snapshot_1.parsePageSnapshot;
    } });
    Object.defineProperty(exports2, "formatPageElements", { enumerable: true, get: function() {
      return page_snapshot_1.formatPageElements;
    } });
    Object.defineProperty(exports2, "existsInPage", { enumerable: true, get: function() {
      return page_snapshot_1.existsInPage;
    } });
    Object.defineProperty(exports2, "findMatches", { enumerable: true, get: function() {
      return page_snapshot_1.findMatches;
    } });
    Object.defineProperty(exports2, "bestElementFor", { enumerable: true, get: function() {
      return page_snapshot_1.bestElementFor;
    } });
    Object.defineProperty(exports2, "bestNameFor", { enumerable: true, get: function() {
      return page_snapshot_1.bestNameFor;
    } });
    Object.defineProperty(exports2, "selectorTokens", { enumerable: true, get: function() {
      return page_snapshot_1.selectorTokens;
    } });
    var role_locator_1 = require_role_locator();
    Object.defineProperty(exports2, "parseRoleSuggestion", { enumerable: true, get: function() {
      return role_locator_1.parseRoleSuggestion;
    } });
    Object.defineProperty(exports2, "roleSuggestionToXPath", { enumerable: true, get: function() {
      return role_locator_1.roleSuggestionToXPath;
    } });
    Object.defineProperty(exports2, "resolveLocatorStrategy", { enumerable: true, get: function() {
      return role_locator_1.resolveLocatorStrategy;
    } });
    var browser_probe_1 = require_browser_probe();
    Object.defineProperty(exports2, "BROWSER_PROBE_SCRIPT", { enumerable: true, get: function() {
      return browser_probe_1.BROWSER_PROBE_SCRIPT;
    } });
    Object.defineProperty(exports2, "domContextFromProbeResult", { enumerable: true, get: function() {
      return browser_probe_1.domContextFromProbeResult;
    } });
    var repertoire_1 = require_repertoire();
    Object.defineProperty(exports2, "parseHistoryLines", { enumerable: true, get: function() {
      return repertoire_1.parseHistoryLines;
    } });
    Object.defineProperty(exports2, "readRepertoire", { enumerable: true, get: function() {
      return repertoire_1.readRepertoire;
    } });
    Object.defineProperty(exports2, "findRepertoireMatch", { enumerable: true, get: function() {
      return repertoire_1.findRepertoireMatch;
    } });
    var config_1 = require_config();
    Object.defineProperty(exports2, "loadConfig", { enumerable: true, get: function() {
      return config_1.loadConfig;
    } });
    Object.defineProperty(exports2, "resolveThresholds", { enumerable: true, get: function() {
      return config_1.resolveThresholds;
    } });
    Object.defineProperty(exports2, "DEFAULT_THRESHOLDS", { enumerable: true, get: function() {
      return config_1.DEFAULT_THRESHOLDS;
    } });
    var audit_1 = require_audit();
    Object.defineProperty(exports2, "buildAuditEntry", { enumerable: true, get: function() {
      return audit_1.buildAuditEntry;
    } });
    Object.defineProperty(exports2, "writeAuditReport", { enumerable: true, get: function() {
      return audit_1.writeAuditReport;
    } });
    Object.defineProperty(exports2, "appendAuditEntry", { enumerable: true, get: function() {
      return audit_1.appendAuditEntry;
    } });
    var plugin_helpers_1 = require_plugin_helpers();
    Object.defineProperty(exports2, "buildAuditFromEvent", { enumerable: true, get: function() {
      return plugin_helpers_1.buildAuditFromEvent;
    } });
    Object.defineProperty(exports2, "flushPlugin", { enumerable: true, get: function() {
      return plugin_helpers_1.flushPlugin;
    } });
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  DEFAULT_CONFIDENCE_THRESHOLD: () => DEFAULT_CONFIDENCE_THRESHOLD,
  HealifyWebdriverIOPlugin: () => HealifyWebdriverIOPlugin
});
module.exports = __toCommonJS(index_exports);

// src/plugin.ts
var import_reporter_core3 = __toESM(require_dist());

// src/wrap.ts
var import_reporter_core2 = __toESM(require_dist());

// src/locator.ts
var import_reporter_core = __toESM(require_dist());
function wdioSelectorToSelector(selector) {
  const trimmed = selector.trim();
  if (/^[a-zA-Z]+=/.test(trimmed)) return null;
  if (/^[.#\[]/.test(trimmed) || /^[a-z][a-z0-9]*/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//") || trimmed.startsWith("(//")) return trimmed;
  return null;
}

// src/types.ts
var DEFAULT_CONFIDENCE_THRESHOLD = 0.9;

// src/wrap.ts
function isNoElementError(err) {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes("can't find element") || msg.includes("no such element") || msg.includes("element not found") || msg.includes("doesn't match any element") || msg.includes("element") && (msg.includes("wasn't found") || msg.includes("was not found"));
}
function wrapBrowser(browser, options = {}, repertoire = []) {
  const threshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  const events = [];
  function emit(event) {
    events.push(event);
    options.onEvent?.(event);
  }
  function wrapElement(el, originalSelector, isHealed = false) {
    const interactionMethods = [
      "click",
      "setValue",
      "addValue",
      "getText",
      "getAttribute",
      "waitForExist",
      "waitForDisplayed",
      "waitForClickable",
      "isExisting",
      "isDisplayed",
      "getHTML",
      "getLocation",
      "getSize"
    ];
    const wrapped = {};
    for (const prop of interactionMethods) {
      if (typeof el[prop] === "function") {
        wrapped[prop] = function(...args) {
          try {
            const result = el[prop].apply(el, args);
            if (result && typeof result.then === "function") {
              return result.catch((err) => {
                if (!isHealed && isNoElementError(err)) return tryHeal(originalSelector);
                throw err;
              });
            }
            return result;
          } catch (err) {
            if (!isHealed && isNoElementError(err)) return tryHeal(originalSelector);
            throw err;
          }
        };
      } else {
        wrapped[prop] = el[prop];
      }
    }
    if (typeof el.then === "function") {
      wrapped.then = el.then;
    }
    return wrapped;
  }
  async function tryHeal(originalSelector) {
    const start = Date.now();
    const selector = wdioSelectorToSelector(originalSelector);
    if (selector === null) {
      emit({ type: "not-convertible", originalSelector, latencyMs: Date.now() - start });
      throw new Error(`Healify: selector '${originalSelector}' is not convertible to CSS/XPath`);
    }
    let domContext;
    try {
      domContext = (0, import_reporter_core2.domContextFromProbeResult)(await browser.execute(import_reporter_core2.BROWSER_PROBE_SCRIPT));
    } catch {
      domContext = void 0;
    }
    let result;
    try {
      result = (0, import_reporter_core2.analyzeAndHeal)({ selector, htmlContext: domContext, repertoire });
    } catch (healErr) {
      const message = healErr instanceof Error ? healErr.message : String(healErr);
      emit({ type: "error", originalSelector: selector, explanation: message, latencyMs: Date.now() - start });
      throw new Error(`Healify: heuristic error for '${selector}': ${message}`);
    }
    if (result.confidence < threshold) {
      emit({ type: "no-suggestion", originalSelector: selector, confidence: result.confidence, latencyMs: Date.now() - start });
      throw new Error(`Healify: no confident suggestion for '${selector}' (confidence: ${result.confidence})`);
    }
    const resolution = (0, import_reporter_core2.resolveLocatorStrategy)(result.fixedSelector);
    const retrySelector = resolution.strategy === "unsupported" ? null : resolution.value;
    if (!retrySelector) {
      emit({ type: "no-suggestion", originalSelector: selector, fixedSelector: result.fixedSelector, confidence: result.confidence, latencyMs: Date.now() - start });
      throw new Error(`Healify: suggestion '${result.fixedSelector}' is not locatable for WebdriverIO`);
    }
    if (options.dryRun) {
      emit({ type: "healed", originalSelector: selector, fixedSelector: result.fixedSelector, confidence: result.confidence, explanation: result.explanation, verified: result.verified, latencyMs: Date.now() - start });
      throw new Error(`Healify: would fix '${selector}' \u2192 '${result.fixedSelector}' (dry run)`);
    }
    let healedEl;
    try {
      healedEl = browser.$(retrySelector);
    } catch {
      emit({ type: "failed", originalSelector: selector, fixedSelector: result.fixedSelector, confidence: result.confidence, latencyMs: Date.now() - start });
      throw new Error(`Healify: healed selector '${result.fixedSelector}' also failed for '${selector}'`);
    }
    emit({ type: "healed", originalSelector: selector, fixedSelector: result.fixedSelector, confidence: result.confidence, explanation: result.explanation, verified: result.verified, latencyMs: Date.now() - start });
    return wrapElement(healedEl, result.fixedSelector, true);
  }
  return new Proxy(browser, {
    get(target, prop, receiver) {
      if (prop === "$") {
        return function(selector) {
          const el = target.$(selector);
          return wrapElement(el, selector);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

// src/plugin.ts
var HealifyWebdriverIOPlugin = class {
  constructor(options = {}) {
    this.events = [];
    this.auditEntries = [];
    this.options = {
      ...options,
      onEvent: (event) => {
        this.events.push(event);
        try {
          (0, import_reporter_core3.buildAuditFromEvent)(event, this.auditEntries);
        } catch {
        }
        options.onEvent?.(event);
      }
    };
    this.repertoire = (0, import_reporter_core3.readRepertoire)(process.cwd());
  }
  /**
   * Devuelve un proxy sobre el browser — el original nunca se muta.
   *
   * Genérico a propósito: `WebdriverIO.Browser` es una interfaz sin index signature, así que
   * no es asignable a `Record<string, unknown>` y tiparlo así rompía el uso real (ver
   * healify.wdio.example.ts). Con `<T extends object>` el usuario además conserva el tipado
   * y el autocompletado de su propio browser, que es lo que el proxy devuelve en runtime.
   */
  wrap(browser) {
    return wrapBrowser(browser, this.options, this.repertoire);
  }
  /**
   * Escribe healify-report.json con todos los eventos acumulados desde la última llamada
   * (o desde el inicio si nunca se llamó). Mismo formato que Playwright/Cypress/Selenium.
   * También escribe healify-audit.json si hay entradas de auditoría.
   * Devuelve la cantidad de casos escritos.
   */
  flush(cwd = process.cwd()) {
    return (0, import_reporter_core3.flushPlugin)(
      this.events,
      this.auditEntries,
      cwd,
      this.options.projectName ?? "webdriverio-project",
      "WebdriverIO"
    );
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_CONFIDENCE_THRESHOLD,
  HealifyWebdriverIOPlugin
});
