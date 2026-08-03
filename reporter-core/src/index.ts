export { extractSelectorFromError } from './selector-extractor'
export { analyzeAndHeal, type HealRequest, type HealResponse, type SelectorType } from './healing-engine'
export { runLocalHealing, type LocalCaseInput, type LocalCaseResult, type LocalCaseStatus, type CaseAttachment } from './local-mode'
export { renderLocalReportHtml, renderLocalReportJson, printSummary, buildLocalRunFromEvents, baseEnvironment, statsFromCases, type LocalRun, type HealingEventLike, type RunEnvironment, type RunStats } from './local-report'
export { renderLocalReportMarkdown, buildDefectId, severityFor, formatDuration, environmentRows, SEVERITY_LABEL, type Severity } from './qa-report'
export { isPlaywrightOnlySelector } from './selector-compat'
export { parsePageSnapshot, formatPageElements, existsInPage, findMatches, bestElementFor, bestNameFor, selectorTokens, type PageElement } from './page-snapshot'
export { parseRoleSuggestion, roleSuggestionToXPath, resolveLocatorStrategy, type LocatorResolution } from './role-locator'
export { BROWSER_PROBE_SCRIPT, domContextFromProbeResult } from './browser-probe'
export { parseHistoryLines, readRepertoire, findRepertoireMatch, type HistoryEntry } from './repertoire'
export {
  loadConfig,
  resolveThresholds,
  DEFAULT_THRESHOLDS,
  resolveAgile,
  defaultAgile,
  DEFAULT_AGILE_PRIORITIES,
  type HealifyConfig,
  type HealifyThresholds,
  type HealifyAgileConfig,
  type ResolvedAgileConfig,
  type AgileProvider,
} from './config'
export {
  buildAgileDefects,
  reportDefects,
  type AgileDefect,
  type AgileDefectSuggestion,
  type AgileOutcome,
  type AgileReportResult,
} from './agile'
export { createJiraClient } from './jira'
export { postJson } from './webhook'
export { buildAuditEntry, writeAuditReport, appendAuditEntry } from './audit'
export type { AuditEntry, AuditReport, FailureContext } from './audit'
export { buildAuditFromEvent, flushPlugin, type PluginHealingEvent } from './plugin-helpers'
