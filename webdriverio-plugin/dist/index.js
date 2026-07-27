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
    var VOLATILE_CLASS_RE = /^(css-|sc-|x[0-9a-f]{4,}|[a-z]{2,}_[a-z0-9]{5,})/i;
    var VOLATILE_ID_RE = /_\d{4,}$|-[a-f0-9]{6,}$/i;
    function hasVolatileClassToken(selector) {
      const classTokens = selector.match(/\.[a-zA-Z0-9_-]+/g) ?? [];
      return classTokens.some((token) => VOLATILE_CLASS_RE.test(token.slice(1)));
    }
    var TESTID_ATTRS = ["data-testid", "data-cy", "data-qa", "data-test", "data-e2e"];
    var NTH_POSITION_RE = /:nth-(?:child|of-type)\(/;
    function analyzeSelector(selector) {
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
      } else if (TESTID_ATTRS.some((attr) => selector.includes(`[${attr}=`))) {
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
    function extractTestid(selector) {
      const match = selector.match(/data-(?:testid|cy|qa|test|e2e)=['"]([^'"]+)['"]/);
      return match ? match[1] : "element";
    }
    function testidAttributeName(selector) {
      return TESTID_ATTRS.find((attr) => selector.includes(`[${attr}=`)) ?? "data-testid";
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
    function generateHealingStrategies(selector, analysis, actions, fields) {
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
        const attr = testidAttributeName(selector);
        strategies.push({
          selector: `[${attr}='${extractTestid(selector)}']`,
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
    function analyzeAndHeal2(request) {
      const { selector, customSynonyms } = request;
      const analysis = analyzeSelector(selector);
      const actions = { ...ACTIONS, ...customSynonyms?.actions };
      const fields = { ...FIELDS, ...customSynonyms?.fields };
      const strategies = generateHealingStrategies(selector, analysis, actions, fields);
      const bestStrategy = strategies[0] ?? {
        selector: "body",
        type: "CSS",
        confidence: 0.5,
        explanation: "Unable to generate a reliable selector. Manual review required.",
        robustnessGain: 0,
        technicalReason: "No suitable pattern found",
        priority: 9
      };
      const adjustedConfidence = Math.max(0.75, Math.min(0.98, bestStrategy.confidence + deterministicAdjustment(selector)));
      const needsReview = adjustedConfidence < 0.8;
      return {
        fixedSelector: bestStrategy.selector,
        confidence: Math.round(adjustedConfidence * 100) / 100,
        explanation: bestStrategy.explanation,
        selectorType: bestStrategy.type,
        alternatives: strategies.slice(1, 4).map((s) => ({
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

// ../reporter-core/dist/local-mode.js
var require_local_mode = __commonJS({
  "../reporter-core/dist/local-mode.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.runLocalHealing = runLocalHealing;
    var healing_engine_1 = require_healing_engine();
    var selector_extractor_1 = require_selector_extractor();
    var HEALED_THRESHOLD = 0.9;
    var REVIEW_THRESHOLD = 0.8;
    function runLocalHealing(input) {
      const selector = (0, selector_extractor_1.extractSelectorFromError)(input.errorMessage);
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
          selectorType: "UNKNOWN"
        };
      }
      const heal = (0, healing_engine_1.analyzeAndHeal)({ selector, htmlContext: input.domContext, testName: input.testName, errorMessage: input.errorMessage });
      const status = heal.confidence >= HEALED_THRESHOLD ? "healed" : heal.confidence >= REVIEW_THRESHOLD ? "review" : "unresolved";
      return {
        testName: input.testName,
        testFile: input.testFile,
        selector,
        errorMessage: input.errorMessage,
        status,
        fixedSelector: heal.fixedSelector,
        confidence: heal.confidence,
        explanation: heal.explanation,
        selectorType: heal.selectorType
      };
    }
  }
});

// ../reporter-core/dist/local-report.js
var require_local_report = __commonJS({
  "../reporter-core/dist/local-report.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.buildLocalRunFromEvents = buildLocalRunFromEvents2;
    exports2.printSummary = printSummary;
    exports2.renderLocalReportHtml = renderLocalReportHtml;
    exports2.renderLocalReportJson = renderLocalReportJson2;
    function buildLocalRunFromEvents2(events, options) {
      const cases = events.map((e) => ({
        testName: e.originalSelector,
        selector: e.originalSelector,
        errorMessage: `${e.type}: ${e.originalSelector}`,
        status: e.type === "healed" ? "healed" : e.type === "no-suggestion" || e.type === "failed" ? "unresolved" : "review",
        fixedSelector: e.fixedSelector ?? "",
        confidence: e.confidence ?? 0,
        explanation: e.explanation ?? "",
        selectorType: e.type === "healed" ? "HEALED" : "UNKNOWN"
      }));
      return { project: options.project, framework: options.framework, generatedAt: /* @__PURE__ */ new Date(), cases };
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
        <div class="label">Sugerencia (heur\xEDstica local)</div>
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
      return `
    <article class="case ${c.status}" data-id="${c._id}">
      <div class="case-top">
        <span class="status-pill">${STATUS_LABEL[c.status]}</span>
        <span class="case-title">
          <span class="name">${escapeHtml(c.testName)}</span>
          ${c.testFile ? `<span class="path">${escapeHtml(c.testFile)}</span>` : ""}
        </span>
        ${confidenceHtml}
      </div>
      <div class="case-body">
        <div class="error">${escapeHtml(c.errorMessage)}</div>
        <div class="diff">
          <div class="diff-col before">
            <div class="label">Selector original</div>
            <code>${escapeHtml(c.selector)}</code>
          </div>
          ${suggestionHtml}
        </div>
        ${c.explanation ? `<p class="engine-note">${escapeHtml(c.explanation)}</p>` : ""}
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
    function renderLocalReportHtml(run) {
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

  <div class="meta-strip">
    <div class="meta-cell"><div class="label">Proyecto</div><div class="value">${escapeHtml(run.project)}</div></div>
    <div class="meta-cell"><div class="label">Generado</div><div class="value mono">${escapeHtml(dateStr)}</div></div>
    <div class="meta-cell"><div class="label">Motor</div><div class="value">Heur\xEDstica local</div></div>
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
      ${attentionCases.length > 0 ? `<div class="cases">${attentionCases.map(renderAttentionCase).join("\n")}</div>` : `<div class="empty">Todo limpio \u2014 no hay selectores que necesiten revisi\xF3n manual.</div>`}
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
    <span>healify-report.json generado junto a este archivo</span>
  </div>

</div>

<dialog class="modal" id="heuristica-modal">
  <div class="modal-header">
    <h2>Heur\xEDstica local, no IA</h2>
    <button class="modal-close" data-close type="button" aria-label="Cerrar">\xD7</button>
  </div>
  <div class="modal-body">
    <p><strong>Esto no es un modelo de IA.</strong> Es <em>pattern-matching</em> determin\xEDstico sobre el texto del selector y del mensaje de error, corriendo 100% en tu m\xE1quina. No hay red, no hay servidor, no hay cuenta.</p>
    <p><strong>No analiza el DOM.</strong> El motor no inspecciona el \xE1rbol del documento ni verifica que el selector sugerido exista de verdad en la p\xE1gina \u2014 decide todo por el texto del selector fallido. Tampoco tiene memoria entre tests ni entre corridas: cada caso se eval\xFAa de forma aislada.</p>
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
    if (total === 0) {
      var wrap = document.getElementById('attention-wrap');
      if (wrap) wrap.innerHTML = '<div class="empty">Todo limpio \u2014 no hay selectores que necesiten revisi\xF3n manual.</div>';
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
    function renderLocalReportJson2(run) {
      return JSON.stringify({
        project: run.project,
        framework: run.framework,
        generatedAt: run.generatedAt.toISOString(),
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

// ../reporter-core/dist/index.js
var require_dist = __commonJS({
  "../reporter-core/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.isPlaywrightOnlySelector = exports2.buildLocalRunFromEvents = exports2.printSummary = exports2.renderLocalReportJson = exports2.renderLocalReportHtml = exports2.runLocalHealing = exports2.analyzeAndHeal = exports2.extractSelectorFromError = void 0;
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
    var selector_compat_1 = require_selector_compat();
    Object.defineProperty(exports2, "isPlaywrightOnlySelector", { enumerable: true, get: function() {
      return selector_compat_1.isPlaywrightOnlySelector;
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
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
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
function isWdioCssCompatible(selector) {
  return !(0, import_reporter_core.isPlaywrightOnlySelector)(selector);
}

// src/types.ts
var DEFAULT_CONFIDENCE_THRESHOLD = 0.9;

// src/wrap.ts
function isNoElementError(err) {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes("can't find element") || msg.includes("no such element") || msg.includes("element not found") || msg.includes("doesn't match any element");
}
function wrapBrowser(browser, options = {}) {
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
                if (!isHealed && isNoElementError(err)) return tryHeal(originalSelector, prop, args);
                throw err;
              });
            }
            return result;
          } catch (err) {
            if (!isHealed && isNoElementError(err)) return tryHeal(originalSelector, prop, args);
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
  function tryHeal(originalSelector, method, args) {
    const start = Date.now();
    const selector = wdioSelectorToSelector(originalSelector);
    if (selector === null) {
      emit({ type: "not-convertible", originalSelector, latencyMs: Date.now() - start });
      throw new Error(`Healify: selector '${originalSelector}' is not convertible to CSS/XPath`);
    }
    let result;
    try {
      result = (0, import_reporter_core2.analyzeAndHeal)({ selector });
    } catch (healErr) {
      const message = healErr instanceof Error ? healErr.message : String(healErr);
      emit({ type: "error", originalSelector: selector, explanation: message, latencyMs: Date.now() - start });
      throw new Error(`Healify: heuristic error for '${selector}': ${message}`);
    }
    if (result.confidence < threshold) {
      emit({ type: "no-suggestion", originalSelector: selector, confidence: result.confidence, latencyMs: Date.now() - start });
      throw new Error(`Healify: no confident suggestion for '${selector}' (confidence: ${result.confidence})`);
    }
    if (!isWdioCssCompatible(result.fixedSelector)) {
      emit({ type: "no-suggestion", originalSelector: selector, fixedSelector: result.fixedSelector, confidence: result.confidence, latencyMs: Date.now() - start });
      throw new Error(`Healify: suggestion '${result.fixedSelector}' is not CSS-compatible for WebdriverIO`);
    }
    if (options.dryRun) {
      emit({ type: "healed", originalSelector: selector, fixedSelector: result.fixedSelector, confidence: result.confidence, explanation: result.explanation, latencyMs: Date.now() - start });
      throw new Error(`Healify: would fix '${selector}' \u2192 '${result.fixedSelector}' (dry run)`);
    }
    let healedEl;
    try {
      healedEl = browser.$(result.fixedSelector);
    } catch {
      emit({ type: "failed", originalSelector: selector, fixedSelector: result.fixedSelector, confidence: result.confidence, latencyMs: Date.now() - start });
      throw new Error(`Healify: healed selector '${result.fixedSelector}' also failed for '${selector}'`);
    }
    emit({ type: "healed", originalSelector: selector, fixedSelector: result.fixedSelector, confidence: result.confidence, explanation: result.explanation, latencyMs: Date.now() - start });
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
    this.options = {
      ...options,
      onEvent: (event) => {
        this.events.push(event);
        options.onEvent?.(event);
      }
    };
  }
  /** Devuelve un proxy sobre el browser — el original nunca se muta. */
  wrap(browser) {
    return wrapBrowser(browser, this.options);
  }
  /**
   * Escribe healify-report.json con todos los eventos acumulados desde la última llamada.
   * Mismo formato que Playwright/Cypress/Selenium.
   * Devuelve la cantidad de casos escritos.
   */
  flush(cwd = process.cwd()) {
    if (this.events.length === 0) return 0;
    const run = (0, import_reporter_core3.buildLocalRunFromEvents)(this.events, {
      project: this.options.projectName ?? "webdriverio-project",
      framework: "WebdriverIO"
    });
    (0, import_node_fs.writeFileSync)((0, import_node_path.join)(cwd, "healify-report.json"), (0, import_reporter_core3.renderLocalReportJson)(run));
    const count = run.cases.length;
    this.events.length = 0;
    return count;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_CONFIDENCE_THRESHOLD,
  HealifyWebdriverIOPlugin
});
