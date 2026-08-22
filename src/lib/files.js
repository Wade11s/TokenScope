import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

export async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

export async function listFiles(root, predicate = () => true) {
  if (!(await exists(root))) return [];

  const found = [];
  const pending = [root];

  while (pending.length > 0) {
    const current = pending.pop();
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
      } else if (entry.isFile() && predicate(fullPath, entry.name)) {
        found.push(fullPath);
      }
    }
  }

  return found.sort();
}

export async function* readJsonLines(filePath, quickMatch) {
  const input = createReadStream(filePath, { encoding: "utf8" });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });

  for await (const line of lines) {
    if (!line || (quickMatch && !quickMatch(line))) continue;
    try {
      yield JSON.parse(line);
    } catch {
      // A partially written final JSONL line is normal for an active session.
    }
  }
}

export async function mapLimit(items, limit, task) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

export function homePath(homeDir, ...parts) {
  return path.join(homeDir, ...parts);
}

export function displayHomePath(filePath, homeDir) {
  if (filePath === homeDir) return "~";
  if (filePath.startsWith(`${homeDir}${path.sep}`)) {
    return `~${filePath.slice(homeDir.length)}`;
  }
  return filePath;
}
