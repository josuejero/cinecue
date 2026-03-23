import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const INCLUDED_PATHS = ["src", "tests", "docs", "public", "README.md", ".env.example", "package.json"];
const legacyLabel = "phase";
const digitRange = "[1-6]";
const DISALLOWED_PATTERN = new RegExp(
  [
    String.raw`\b${legacyLabel}${digitRange}\b`,
    String.raw`\b${legacyLabel}\s+${digitRange}\b`,
    String.raw`\b${legacyLabel.toUpperCase()}${digitRange}\b`,
    String.raw`/api/ops/${legacyLabel}${digitRange}\b`,
    String.raw`cinecue-${legacyLabel}${digitRange}-v\d+`,
  ].join("|"),
  "gi",
);

function collectFiles(targetPath: string) {
  const absolutePath = path.resolve(process.cwd(), targetPath);
  const stat = fs.statSync(absolutePath);

  if (stat.isFile()) {
    return [targetPath];
  }

  const files: string[] = [];
  for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
    const relativePath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(relativePath));
      continue;
    }

    files.push(relativePath);
  }

  return files;
}

describe("repo legacy-id regression", () => {
  it("keeps runtime source, scripts, tests, docs, and public assets free of legacy ids", () => {
    const failures: string[] = [];

    for (const targetPath of INCLUDED_PATHS) {
      for (const relativePath of collectFiles(targetPath)) {
        const pathMatches = relativePath.match(DISALLOWED_PATTERN);
        if (pathMatches) {
          failures.push(`${relativePath} [path] -> ${pathMatches.join(", ")}`);
        }

        const contents = fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
        const contentMatches = contents.match(DISALLOWED_PATTERN);
        if (contentMatches) {
          failures.push(`${relativePath} [content] -> ${Array.from(new Set(contentMatches)).join(", ")}`);
        }
      }
    }

    expect(failures).toEqual([]);
  });
});
