import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

const requiredFiles = [
  "AGENTS.md",
  "docs/index.md",
  "docs/product-spec.md",
  "docs/architecture.md",
  "docs/acceptance.md",
  "docs/operations.md",
  "docs/tech-debt.md",
];

const docsIndexLinks = [
  "product-spec.md",
  "architecture.md",
  "acceptance.md",
  "operations.md",
  "tech-debt.md",
];

const agentsLinks = [
  "docs/index.md",
  "docs/product-spec.md",
  "docs/acceptance.md",
  "docs/architecture.md",
  "docs/operations.md",
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  assert(existsSync(absolutePath), `缺少文件：${relativePath}`);
  return readFileSync(absolutePath, "utf8");
}

for (const relativePath of requiredFiles) {
  const content = read(relativePath);
  assert(content.trim().length >= 80, `文档内容过短：${relativePath}`);
}

const docsIndex = read("docs/index.md");
for (const link of docsIndexLinks) {
  assert(docsIndex.includes(link), `docs/index.md 缺少导航链接：${link}`);
}

const agents = read("AGENTS.md");
for (const link of agentsLinks) {
  assert(agents.includes(link), `AGENTS.md 缺少入口引用：${link}`);
}

console.log("Documentation checks passed.");
