import { readFileSync } from "node:fs";

function assertIncludes(source, snippet, label) {
  if (!source.includes(snippet)) {
    throw new Error(`缺少 ${label}: ${snippet}`);
  }
}

const indexHtml = readFileSync("index.html", "utf8");
const appJs = readFileSync("app.js", "utf8");
const configJs = readFileSync("config.js", "utf8");
const sql = readFileSync("supabase-setup.sql", "utf8");

const requiredIds = [
  "healthForm",
  "goalsForm",
  "recordDate",
  "dailyProgressBar",
  "reviewRecordedDays",
  "trendChart",
  "recordsBody",
  "storageModeLabel",
  "authStatusLabel",
  "syncStatusLabel",
];

for (const id of requiredIds) {
  assertIncludes(indexHtml, `id="${id}"`, `DOM 节点 ${id}`);
}

const requiredScripts = [
  './config.js',
  "@supabase/supabase-js@2",
  "./app.js",
];

for (const scriptRef of requiredScripts) {
  assertIncludes(indexHtml, scriptRef, `脚本引用 ${scriptRef}`);
}

const requiredAppSymbols = [
  "const defaultGoals",
  "const chartMetrics",
  "const periodConfigs",
  "function renderSummary()",
  "function renderReview()",
  "function renderTrendChart()",
  "function restoreCloudSession()",
  "function maybeAutoSyncRecord(record)",
  "function renderAll()",
];

for (const symbol of requiredAppSymbols) {
  assertIncludes(appJs, symbol, `app.js 结构 ${symbol}`);
}

const requiredConfigKeys = ["supabaseUrl", "supabaseAnonKey", "supabaseAuthEmail"];
for (const key of requiredConfigKeys) {
  assertIncludes(configJs, key, `config.js 字段 ${key}`);
}

assertIncludes(sql, "health_records", "Supabase records 表");
assertIncludes(sql, "health_goals", "Supabase goals 表");

if (configJs.includes("service_role")) {
  throw new Error("config.js 不应包含 service_role key");
}

console.log("Static site smoke checks passed.");
