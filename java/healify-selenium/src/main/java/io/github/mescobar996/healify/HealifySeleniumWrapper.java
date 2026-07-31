package io.github.mescobar996.healify;

/**
 * Adapter de Healify + Selenium (Java), publicado en Maven Central como
 * io.github.mescobar996:healify-selenium. Llama al motor real de Healify (reporter-core, el
 * mismo que usan los cuatro adapters de JS) vía `npx @healify/cli heal`, así que necesitás
 * Node instalado y @healify/cli accesible por npx — no hay heurística reimplementada acá, es
 * un cliente delgado.
 *
 * Dependencia: org.seleniumhq.selenium:selenium-java (4.6+, trae Selenium Manager — resuelve
 * el driver solo). Sin dependencias de JSON: el parseo es manual y deliberadamente mínimo
 * (ver parseJsonField), suficiente para el shape fijo que devuelve `healify heal` — no hace
 * falta traer Jackson/Gson solo para esto.
 *
 * Uso mínimo:
 *
 *     WebDriver driver = new ChromeDriver();
 *     HealifySeleniumWrapper healify = new HealifySeleniumWrapper(driver, "." );
 *     WebElement el = healify.findElement(By.cssSelector("#comprar-ahora-a1b2c3"));
 *     el.click();
 *
 * Qué SÍ hace: envuelve findElement (no cada método de interacción — mismo alcance acotado
 * que selenium-plugin en JS). Qué NO hace: generar healify-report.html/json/md.
 *
 * Estado de verificación (honesto, no inflado): compilado real contra selenium-java 4.27.0
 * (resuelto con Maven, sin errores). El puente a `healify heal` — subproceso vía
 * ProcessBuilder, formato de payload, parseo del JSON real que devuelve el comando — se
 * probó de punta a punta con el CLI real. El formato de `By.toString()` que usa
 * locatorToSelector() también se confirmó contra la clase By real de esta versión. Lo único
 * que NO se pudo correr en esta sesión es un ChromeDriver en vivo: el JDK 17 de esta máquina
 * tiene un problema de red (`Unable to establish loopback connection`, un bug conocido del
 * NIO Selector de Java en Windows) que bloquea `java.net.http.HttpClient` para CUALQUIER uso
 * — no algo específico de Selenium ni de este adapter (reproducido con 4 líneas de código,
 * sin Selenium de por medio). Si tenés un JDK sin ese problema, esto debería andar tal cual;
 * si te encontrás el mismo error, probá con otra versión de JDK (11 o 21) antes de sospechar
 * de este código.
 */

import org.openqa.selenium.By;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.JavascriptExecutor;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class HealifySeleniumWrapper {

    public static final double DEFAULT_CONFIDENCE_THRESHOLD = 0.9;

    private final WebDriver driver;
    private final Path projectRoot;
    private final double confidenceThreshold;
    private final boolean recordHistory;
    private String probeScript;
    private final List<String> events = new ArrayList<>();
    /** Opcional: seteá esto antes de cada test para que el repertorio pueda scopear por
     * archivo, igual que hacen Playwright/Cypress. Sin esto, el match es por selector solo. */
    public String currentTestFile;

    public HealifySeleniumWrapper(WebDriver driver, String projectRoot) {
        this(driver, projectRoot, DEFAULT_CONFIDENCE_THRESHOLD, true);
    }

    public HealifySeleniumWrapper(WebDriver driver, String projectRoot, double confidenceThreshold, boolean recordHistory) {
        this.driver = driver;
        this.projectRoot = Paths.get(projectRoot);
        this.confidenceThreshold = confidenceThreshold;
        this.recordHistory = recordHistory;
    }

    public List<String> getEvents() {
        return events;
    }

    public WebElement findElement(By locator) {
        try {
            return driver.findElement(locator);
        } catch (NoSuchElementException originalErr) {
            String selector = locatorToSelector(locator);
            if (selector == null) {
                events.add("not-convertible: " + locator);
                throw originalErr;
            }

            String pageElementsJson = probe();
            String healOutput = heal(selector, pageElementsJson);
            if (healOutput == null) {
                throw originalErr;
            }
            if (healOutput.contains("\"error\"")) {
                events.add("error: " + healOutput);
                throw originalErr;
            }

            double confidence = parseJsonNumber(healOutput, "confidence");
            String fixedSelector = parseJsonField(healOutput, "fixedSelector");
            boolean verified = parseJsonBoolean(healOutput, "verified");
            boolean fromRepertoire = parseJsonBoolean(healOutput, "fromRepertoire");

            if (confidence < confidenceThreshold) {
                events.add("no-suggestion: " + selector + " (confidence=" + confidence + ")");
                throw originalErr;
            }

            String locatorStrategy = parseJsonField(extractObject(healOutput, "locator"), "strategy");
            String locatorValue = parseJsonField(extractObject(healOutput, "locator"), "value");

            if (locatorStrategy == null || "unsupported".equals(locatorStrategy)) {
                events.add("no-suggestion (unsupported locator): " + fixedSelector);
                throw originalErr;
            }

            By retryLocator = "xpath".equals(locatorStrategy) ? By.xpath(locatorValue) : By.cssSelector(locatorValue);

            WebElement healedEl;
            try {
                healedEl = driver.findElement(retryLocator);
            } catch (NoSuchElementException retryErr) {
                events.add("failed: " + selector + " -> " + fixedSelector);
                throw originalErr;
            }

            events.add("healed: " + selector + " -> " + fixedSelector + " (verified=" + verified + ", fromRepertoire=" + fromRepertoire + ")");
            if (recordHistory) {
                appendHistory(selector, fixedSelector, confidence, verified);
            }
            return healedEl;
        }
    }

    /** Mismos cuatro casos que locator.ts en selenium-plugin (JS): By.id/className/name se
     * traducen a CSS, By.cssSelector/xpath pasan directo. linkText/tagName no tienen
     * equivalente limpio y se dejan sin convertir (Selenium no expone el valor crudo de un
     * By de forma pública y estable, así que ahí directamente no se intenta curar). */
    private String locatorToSelector(By locator) {
        String s = locator.toString();
        if (s.startsWith("By.cssSelector: ")) return s.substring("By.cssSelector: ".length());
        if (s.startsWith("By.xpath: ")) return s.substring("By.xpath: ".length());
        if (s.startsWith("By.id: ")) return "#" + s.substring("By.id: ".length());
        if (s.startsWith("By.className: ")) return "." + s.substring("By.className: ".length());
        if (s.startsWith("By.name: ")) return "[name='" + s.substring("By.name: ".length()) + "']";
        return null;
    }

    private String probe() {
        if (probeScript == null) {
            try {
                probeScript = runProcess(new String[]{npx(), "@healify/cli", "probe-script"}, null);
            } catch (Exception e) {
                probeScript = "";
            }
        }
        if (probeScript.isEmpty()) return null;
        try {
            Object result = ((JavascriptExecutor) driver).executeScript(probeScript);
            return toJsonArray(result);
        } catch (Exception e) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private String toJsonArray(Object raw) {
        if (!(raw instanceof List)) return null;
        StringBuilder sb = new StringBuilder("[");
        List<Object> list = (List<Object>) raw;
        for (int i = 0; i < list.size(); i++) {
            if (!(list.get(i) instanceof Map)) continue;
            Map<String, Object> item = (Map<String, Object>) list.get(i);
            if (i > 0) sb.append(",");
            sb.append("{\"role\":").append(jsonString(String.valueOf(item.get("role"))))
              .append(",\"name\":").append(jsonString(String.valueOf(item.getOrDefault("name", "")))).append("}");
        }
        sb.append("]");
        return sb.toString();
    }

    private String heal(String selector, String pageElementsJson) {
        StringBuilder payload = new StringBuilder("{\"selector\":").append(jsonString(selector));
        if (currentTestFile != null) payload.append(",\"testFile\":").append(jsonString(currentTestFile));
        if (pageElementsJson != null) payload.append(",\"pageElements\":").append(pageElementsJson);
        payload.append("}");

        try {
            return runProcess(new String[]{npx(), "@healify/cli", "heal"}, payload.toString());
        } catch (Exception e) {
            events.add("error: " + e.getMessage());
            return null;
        }
    }

    private void appendHistory(String selector, String fixedSelector, double confidence, boolean verified) {
        // Mismo formato que HistoryEntry (reporter-core/src/repertoire.ts) — así una curación
        // confirmada desde Java queda disponible para el repertorio de cualquier otro
        // lenguaje que corra contra el mismo repo.
        String entry = "{\"timestamp\":" + jsonString(Instant.now().toString())
            + ",\"testFile\":" + (currentTestFile != null ? jsonString(currentTestFile) : "null")
            + ",\"testName\":" + jsonString(currentTestFile != null ? currentTestFile : selector)
            + ",\"selector\":" + jsonString(selector)
            + ",\"status\":\"healed\""
            + ",\"fixedSelector\":" + jsonString(fixedSelector)
            + ",\"selectorType\":\"ROLE\""
            + ",\"confidence\":" + confidence
            + ",\"verified\":" + verified
            + "}\n";
        try {
            Path dir = projectRoot.resolve(".healify");
            Files.createDirectories(dir);
            Files.write(dir.resolve("history.jsonl"), entry.getBytes(StandardCharsets.UTF_8),
                StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException ignored) {
            // El historial es un complemento — nunca debe romper la corrida real.
        }
    }

    private String npx() {
        // En Windows, "npx" es en realidad "npx.cmd" — ProcessBuilder sin una shell de por
        // medio no lo resuelve solo (mismo problema que con Python/subprocess, encontrado
        // corriendo esto de verdad, no en teoría). "npx.cmd" a secas si funciona porque
        // ProcessBuilder SÍ busca en PATH probando las extensiones de PATHEXT en Windows.
        String os = System.getProperty("os.name", "").toLowerCase();
        return os.contains("win") ? "npx.cmd" : "npx";
    }

    private String runProcess(String[] command, String stdin) throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(projectRoot.toFile());
        pb.redirectErrorStream(false);
        Process process = pb.start();

        if (stdin != null) {
            try (OutputStream os = process.getOutputStream()) {
                os.write(stdin.getBytes(StandardCharsets.UTF_8));
            }
        } else {
            process.getOutputStream().close();
        }

        String output = readAll(process.getInputStream());
        process.waitFor();
        return output;
    }

    private static String readAll(InputStream in) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] data = new byte[4096];
        int read;
        while ((read = in.read(data, 0, data.length)) != -1) {
            buffer.write(data, 0, read);
        }
        return buffer.toString(StandardCharsets.UTF_8);
    }

    // --- Parseo JSON manual y mínimo: alcanza para el shape fijo de HealCommandOutput. ---

    private static String jsonString(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    private static String parseJsonField(String json, String field) {
        if (json == null) return null;
        Matcher m = Pattern.compile("\"" + Pattern.quote(field) + "\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"").matcher(json);
        if (!m.find()) return null;
        return m.group(1).replace("\\\"", "\"").replace("\\\\", "\\");
    }

    private static double parseJsonNumber(String json, String field) {
        Matcher m = Pattern.compile("\"" + Pattern.quote(field) + "\"\\s*:\\s*([0-9.]+)").matcher(json);
        return m.find() ? Double.parseDouble(m.group(1)) : 0.0;
    }

    private static boolean parseJsonBoolean(String json, String field) {
        Matcher m = Pattern.compile("\"" + Pattern.quote(field) + "\"\\s*:\\s*(true|false)").matcher(json);
        return m.find() && Boolean.parseBoolean(m.group(1));
    }

    private static String extractObject(String json, String field) {
        Matcher m = Pattern.compile("\"" + Pattern.quote(field) + "\"\\s*:\\s*(\\{[^}]*\\})").matcher(json);
        return m.find() ? m.group(1) : null;
    }
}
