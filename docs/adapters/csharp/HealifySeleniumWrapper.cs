// Adapter de referencia: Healify + Selenium (C# / .NET).
//
// *** SIN VERIFICAR EN NINGUNA SESIÓN — no hay SDK de .NET instalado en la máquina donde se
// escribió esto. A diferencia de los adapters de Python y Java (verificados de punta a punta
// contra Chrome real, o al menos contra el puente `healify heal` real donde el entorno lo
// permitió), este archivo se escribió por analogía con esos dos, siguiendo el mismo contrato
// documentado en docs/adapters/README.md, pero NUNCA se compiló ni se corrió. Si vas a
// usarlo, tratalo como un punto de partida a revisar, no como código probado. Lo primero que
// habría que hacer con un SDK de .NET disponible: `dotnet build` y correr el smoke más
// simple posible (un find_element roto contra un botón real) antes de confiar en esto. ***
//
// No es un paquete publicado (no está en NuGet) — es un archivo que copiás a tu proyecto y
// adaptás, mismo espíritu que healify.selenium.example.ts en la versión JS. Llama al motor
// real de Healify (reporter-core, el mismo que usan los cuatro adapters de JS) vía
// `npx @healify/cli heal`, así que necesitás Node instalado y @healify/cli accesible por
// npx — no hay heurística reimplementada acá, es un cliente delgado.
//
// Dependencia: Selenium.WebDriver (NuGet), 4.6+ (trae Selenium Manager). Se usa
// System.Text.Json (incluido en .NET desde 3.0/Core) para el parseo — a diferencia de los
// adapters de Python/Java, acá sí tiene sentido usar el parser JSON estándar del framework
// en vez de uno manual, porque ya viene con el SDK sin agregar nada.
//
// Uso mínimo:
//
//     var driver = new ChromeDriver();
//     var healify = new HealifySeleniumWrapper(driver, ".");
//     var el = healify.FindElement(By.CssSelector("#comprar-ahora-a1b2c3"));
//     el.Click();

using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using OpenQA.Selenium;

namespace Healify
{
    public class HealEvent
    {
        public string Type { get; set; } = "";
        public string OriginalSelector { get; set; } = "";
        public string? FixedSelector { get; set; }
        public double? Confidence { get; set; }
        public string? Explanation { get; set; }
        public bool Verified { get; set; }
        public bool FromRepertoire { get; set; }
    }

    internal class LocatorResolution
    {
        [JsonPropertyName("strategy")] public string Strategy { get; set; } = "unsupported";
        [JsonPropertyName("value")] public string? Value { get; set; }
    }

    internal class HealOutput
    {
        [JsonPropertyName("fixedSelector")] public string FixedSelector { get; set; } = "";
        [JsonPropertyName("confidence")] public double Confidence { get; set; }
        [JsonPropertyName("verified")] public bool Verified { get; set; }
        [JsonPropertyName("fromRepertoire")] public bool FromRepertoire { get; set; }
        [JsonPropertyName("needsReview")] public bool NeedsReview { get; set; }
        [JsonPropertyName("explanation")] public string Explanation { get; set; } = "";
        [JsonPropertyName("selectorType")] public string SelectorType { get; set; } = "";
        [JsonPropertyName("locator")] public LocatorResolution Locator { get; set; } = new();
        [JsonPropertyName("error")] public string? Error { get; set; }
    }

    public class HealifySeleniumWrapper
    {
        public const double DefaultConfidenceThreshold = 0.9;

        private readonly IWebDriver _driver;
        private readonly string _projectRoot;
        private readonly double _confidenceThreshold;
        private readonly bool _recordHistory;
        private string? _probeScript;

        public System.Collections.Generic.List<HealEvent> Events { get; } = new();

        // Opcional: seteá esto antes de cada test para que el repertorio pueda scopear por
        // archivo, igual que hacen Playwright/Cypress. Sin esto, el match es por selector solo.
        public string? CurrentTestFile { get; set; }

        public HealifySeleniumWrapper(IWebDriver driver, string projectRoot, double confidenceThreshold = DefaultConfidenceThreshold, bool recordHistory = true)
        {
            _driver = driver;
            _projectRoot = projectRoot;
            _confidenceThreshold = confidenceThreshold;
            _recordHistory = recordHistory;
        }

        public IWebElement FindElement(By locator)
        {
            try
            {
                return _driver.FindElement(locator);
            }
            catch (NoSuchElementException originalErr)
            {
                var selector = LocatorToSelector(locator);
                if (selector == null)
                {
                    Events.Add(new HealEvent { Type = "not-convertible", OriginalSelector = locator.ToString() ?? "" });
                    throw;
                }

                var pageElementsJson = Probe();
                var healed = Heal(selector, pageElementsJson);
                if (healed == null) throw;

                if (healed.Error != null)
                {
                    Events.Add(new HealEvent { Type = "error", OriginalSelector = selector, Explanation = healed.Error });
                    throw;
                }

                if (healed.Confidence < _confidenceThreshold)
                {
                    Events.Add(new HealEvent { Type = "no-suggestion", OriginalSelector = selector, Confidence = healed.Confidence });
                    throw;
                }

                if (healed.Locator.Strategy == "unsupported" || healed.Locator.Value == null)
                {
                    Events.Add(new HealEvent { Type = "no-suggestion", OriginalSelector = selector, FixedSelector = healed.FixedSelector });
                    throw;
                }

                var retryLocator = healed.Locator.Strategy == "xpath"
                    ? By.XPath(healed.Locator.Value)
                    : By.CssSelector(healed.Locator.Value);

                IWebElement healedEl;
                try
                {
                    healedEl = _driver.FindElement(retryLocator);
                }
                catch (NoSuchElementException)
                {
                    Events.Add(new HealEvent { Type = "failed", OriginalSelector = selector, FixedSelector = healed.FixedSelector });
                    throw originalErr;
                }

                Events.Add(new HealEvent
                {
                    Type = "healed",
                    OriginalSelector = selector,
                    FixedSelector = healed.FixedSelector,
                    Confidence = healed.Confidence,
                    Explanation = healed.Explanation,
                    Verified = healed.Verified,
                    FromRepertoire = healed.FromRepertoire,
                });

                if (_recordHistory) AppendHistory(selector, healed);
                return healedEl;
            }
        }

        // Mismo criterio que los adapters de Python/Java: By.Id/ClassName/Name se traducen a
        // CSS, CssSelector/XPath pasan directo. LinkText/TagName no tienen equivalente limpio.
        private static string? LocatorToSelector(By locator)
        {
            var s = locator.ToString() ?? "";
            var m = Regex.Match(s, @"^By\.(\w+): (.*)$");
            if (!m.Success) return null;
            var kind = m.Groups[1].Value;
            var value = m.Groups[2].Value;
            return kind switch
            {
                "CssSelector" => value,
                "XPath" => value,
                "Id" => "#" + value,
                "ClassName" => "." + value,
                "Name" => $"[name='{value}']",
                _ => null,
            };
        }

        private string? Probe()
        {
            if (_probeScript == null)
            {
                try { _probeScript = RunProcess("probe-script", null); }
                catch { _probeScript = ""; }
            }
            if (string.IsNullOrEmpty(_probeScript)) return null;

            try
            {
                var result = ((IJavaScriptExecutor)_driver).ExecuteScript(_probeScript);
                return JsonSerializer.Serialize(result);
            }
            catch
            {
                return null;
            }
        }

        private HealOutput? Heal(string selector, string? pageElementsJson)
        {
            var payload = new System.Collections.Generic.Dictionary<string, object?>
            {
                ["selector"] = selector,
            };
            if (CurrentTestFile != null) payload["testFile"] = CurrentTestFile;
            if (pageElementsJson != null) payload["pageElements"] = JsonDocument.Parse(pageElementsJson).RootElement;

            try
            {
                var output = RunProcess("heal", JsonSerializer.Serialize(payload));
                return JsonSerializer.Deserialize<HealOutput>(output);
            }
            catch (Exception ex)
            {
                Events.Add(new HealEvent { Type = "error", OriginalSelector = selector, Explanation = ex.Message });
                return null;
            }
        }

        private void AppendHistory(string selector, HealOutput healed)
        {
            // Mismo formato que HistoryEntry (reporter-core/src/repertoire.ts) — una curación
            // confirmada desde C# queda disponible para el repertorio de cualquier otro
            // lenguaje que corra contra el mismo repo.
            var entry = new
            {
                timestamp = DateTime.UtcNow.ToString("o"),
                testFile = CurrentTestFile,
                testName = CurrentTestFile ?? selector,
                selector,
                status = "healed",
                fixedSelector = healed.FixedSelector,
                selectorType = healed.SelectorType,
                confidence = healed.Confidence,
                verified = healed.Verified,
            };
            try
            {
                var dir = Path.Combine(_projectRoot, ".healify");
                Directory.CreateDirectory(dir);
                File.AppendAllText(Path.Combine(dir, "history.jsonl"), JsonSerializer.Serialize(entry) + "\n", Encoding.UTF8);
            }
            catch
            {
                // El historial es un complemento — nunca debe romper la corrida real.
            }
        }

        private string RunProcess(string command, string? stdin)
        {
            // En Windows "npx" es "npx.cmd" — con UseShellExecute=false, ProcessBuilder-style
            // no siempre lo resuelve sin la extensión (mismo problema visto en los adapters
            // de Python/Java). Se resuelve explícito acá también.
            var isWindows = Environment.OSVersion.Platform == PlatformID.Win32NT;
            var npx = isWindows ? "npx.cmd" : "npx";

            var psi = new ProcessStartInfo
            {
                FileName = npx,
                ArgumentList = { "@healify/cli", command },
                WorkingDirectory = _projectRoot,
                RedirectStandardInput = stdin != null,
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };

            using var process = Process.Start(psi) ?? throw new InvalidOperationException("No se pudo iniciar el proceso de healify.");
            if (stdin != null)
            {
                process.StandardInput.Write(stdin);
                process.StandardInput.Close();
            }
            var output = process.StandardOutput.ReadToEnd();
            process.WaitForExit();
            return output;
        }
    }
}
