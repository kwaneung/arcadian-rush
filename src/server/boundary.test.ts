import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

describe("client boundary", () => {
  it("does not import src/server from the client graph", () => {
    const seen = new Set<string>();
    const pending = [
      path.join(root, "src/app/page.tsx"),
      path.join(root, "src/app/layout.tsx"),
      ...listFiles(path.join(root, "src/client")),
    ];
    const offenders: string[] = [];

    while (pending.length > 0) {
      const file = pending.pop();
      if (!file || seen.has(file)) continue;
      seen.add(file);
      if (file.includes(`${path.sep}src${path.sep}server${path.sep}`)) {
        offenders.push(file);
        continue;
      }
      const resolved = withExtension(file);
      if (!resolved) continue;
      for (const specifier of specifiers(readFileSync(resolved, "utf8"))) {
        const next = resolveImport(resolved, specifier);
        if (next) pending.push(next);
      }
    }

    expect(offenders).toEqual([]);
  });
});

function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

function specifiers(source: string): string[] {
  return [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1] ?? "");
}

function resolveImport(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) return path.join(root, "src", specifier.slice(2));
  if (specifier.startsWith(".")) return path.resolve(path.dirname(fromFile), specifier);
  return null;
}

function withExtension(file: string): string | null {
  const candidates = [
    file,
    `${file}.ts`,
    `${file}.tsx`,
    path.join(file, "index.ts"),
    path.join(file, "index.tsx"),
  ];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      continue;
    }
  }
  return null;
}
