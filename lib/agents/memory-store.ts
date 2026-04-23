// Filesystem-backed implementation of the Anthropic memory tool
// (`memory_20250818`). Implements the six tool commands — view, create,
// str_replace, insert, delete, rename — with the exact return strings and
// error messages Anthropic expects. All operations are sandboxed to
// `memories/claude/` under the repo root; any path that tries to escape that
// directory is rejected with a clean error.
//
// Ref: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool

import { promises as fs } from "node:fs";
import path from "node:path";

// The repository-root `/memories/claude/` directory is mounted into the tool's
// virtual `/memories` namespace. Claude always sees paths that start with
// `/memories`; our store translates to real disk paths under CLAUDE_ROOT.
const CLAUDE_ROOT = path.resolve(process.cwd(), "memories", "claude");
// The virtual prefix Claude writes in every tool call.
const VIRTUAL_PREFIX = "/memories";

const MAX_FILE_LINES = 999_999;

// -------------------------- Public command types --------------------------

export type MemoryCommand =
  | { command: "view"; path: string; view_range?: [number, number] }
  | { command: "create"; path: string; file_text: string }
  | { command: "str_replace"; path: string; old_str: string; new_str: string }
  | { command: "insert"; path: string; insert_line: number; insert_text: string }
  | { command: "delete"; path: string }
  | { command: "rename"; old_path: string; new_path: string };

// -------------------------- Path validation ------------------------------

class PathError extends Error {}

/**
 * Resolve a virtual `/memories/...` path to a real disk path inside
 * CLAUDE_ROOT. Any attempt to escape the sandbox throws PathError.
 */
function resolveVirtual(p: string): string {
  if (typeof p !== "string" || p.length === 0) {
    throw new PathError(`The path ${p} does not exist. Please provide a valid path.`);
  }
  // Normalise: reject traversal syntax up front (belt and braces; resolve()
  // would catch it, but explicit rejection is clearer in errors).
  if (/\.\.[\/\\]|%2e%2e/i.test(p)) {
    throw new PathError(`Invalid path ${p}: traversal not allowed.`);
  }
  if (!p.startsWith(VIRTUAL_PREFIX)) {
    throw new PathError(
      `Invalid path ${p}: paths must start with ${VIRTUAL_PREFIX}.`
    );
  }
  const relative = p.slice(VIRTUAL_PREFIX.length).replace(/^\/+/, "");
  const abs = path.resolve(CLAUDE_ROOT, relative);
  if (abs !== CLAUDE_ROOT && !abs.startsWith(CLAUDE_ROOT + path.sep)) {
    throw new PathError(`Invalid path ${p}: escapes memory sandbox.`);
  }
  return abs;
}

function virtualOf(abs: string): string {
  if (abs === CLAUDE_ROOT) return VIRTUAL_PREFIX;
  const rel = path.relative(CLAUDE_ROOT, abs).split(path.sep).join("/");
  return `${VIRTUAL_PREFIX}/${rel}`;
}

async function pathExists(abs: string): Promise<boolean> {
  try {
    await fs.stat(abs);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(abs: string): Promise<boolean> {
  try {
    return (await fs.stat(abs)).isDirectory();
  } catch {
    return false;
  }
}

function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${bytes}B`;
}

// -------------------------- Command handlers ------------------------------

async function handleView(p: string, range?: [number, number]): Promise<string> {
  const abs = resolveVirtual(p);
  if (!(await pathExists(abs))) {
    return `The path ${p} does not exist. Please provide a valid path.`;
  }
  if (await isDirectory(abs)) {
    return renderDirectoryListing(abs);
  }
  const content = await fs.readFile(abs, "utf8");
  const lines = content.split(/\r?\n/);
  // Anthropic's contract says files > 999k lines should error.
  if (lines.length > MAX_FILE_LINES) {
    return `File ${p} exceeds maximum line limit of ${MAX_FILE_LINES} lines.`;
  }
  const [start, end] = range ?? [1, lines.length];
  const safeStart = Math.max(1, start);
  const safeEnd = Math.min(lines.length, end);
  const body = lines
    .slice(safeStart - 1, safeEnd)
    .map((ln, i) => `${String(safeStart + i).padStart(6, " ")}\t${ln}`)
    .join("\n");
  return `Here's the content of ${p} with line numbers:\n${body}`;
}

async function renderDirectoryListing(abs: string): Promise<string> {
  const depth = 2;
  const rows: string[] = [];
  async function walk(dir: string, currentDepth: number) {
    const size = await dirSize(dir);
    rows.push(`${humanSize(size)}\t${virtualOf(dir)}`);
    if (currentDepth >= depth) return;
    const entries = (await fs.readdir(dir, { withFileTypes: true }))
      .filter(
        (e) =>
          !e.name.startsWith(".") && e.name !== "node_modules"
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const child = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(child, currentDepth + 1);
      } else {
        const s = await fs.stat(child);
        rows.push(`${humanSize(s.size)}\t${virtualOf(child)}`);
      }
    }
  }
  await walk(abs, 0);
  return `Here're the files and directories up to 2 levels deep in ${virtualOf(
    abs
  )}, excluding hidden items and node_modules:\n${rows.join("\n")}`;
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const c = path.join(dir, e.name);
    if (e.isDirectory()) total += await dirSize(c);
    else {
      const s = await fs.stat(c);
      total += s.size;
    }
  }
  return total;
}

async function handleCreate(p: string, fileText: string): Promise<string> {
  const abs = resolveVirtual(p);
  if (await pathExists(abs)) {
    return `Error: File ${p} already exists`;
  }
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, fileText, "utf8");
  return `File created successfully at: ${p}`;
}

async function handleStrReplace(
  p: string,
  oldStr: string,
  newStr: string
): Promise<string> {
  const abs = resolveVirtual(p);
  if (!(await pathExists(abs))) {
    return `Error: The path ${p} does not exist. Please provide a valid path.`;
  }
  if (await isDirectory(abs)) {
    return `Error: The path ${p} does not exist. Please provide a valid path.`;
  }
  const content = await fs.readFile(abs, "utf8");
  const lines = content.split(/\r?\n/);
  const occurrences: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (content.indexOf(oldStr) === -1) break;
    if (lines[i].includes(oldStr)) occurrences.push(i + 1);
  }
  const count = countOccurrences(content, oldStr);
  if (count === 0) {
    return `No replacement was performed, old_str \`${oldStr}\` did not appear verbatim in ${p}.`;
  }
  if (count > 1) {
    return `No replacement was performed. Multiple occurrences of old_str \`${oldStr}\` in lines: ${occurrences.join(
      ", "
    )}. Please ensure it is unique`;
  }
  const replaced = content.replace(oldStr, newStr);
  await fs.writeFile(abs, replaced, "utf8");
  // Return a small snippet with line numbers for context.
  const editStart = replaced.split(/\r?\n/).findIndex((l) => l.includes(newStr.split(/\r?\n/)[0] ?? ""));
  const newLines = replaced.split(/\r?\n/);
  const snippetStart = Math.max(0, editStart - 2);
  const snippetEnd = Math.min(newLines.length, editStart + 3);
  const snippet = newLines
    .slice(snippetStart, snippetEnd)
    .map((ln, i) => `${String(snippetStart + 1 + i).padStart(6, " ")}\t${ln}`)
    .join("\n");
  return `The memory file has been edited.\n${snippet}`;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

async function handleInsert(
  p: string,
  insertLine: number,
  insertText: string
): Promise<string> {
  const abs = resolveVirtual(p);
  if (!(await pathExists(abs))) return `Error: The path ${p} does not exist`;
  if (await isDirectory(abs)) return `Error: The path ${p} does not exist`;
  const content = await fs.readFile(abs, "utf8");
  const lines = content.split(/\r?\n/);
  if (insertLine < 0 || insertLine > lines.length) {
    return `Error: Invalid \`insert_line\` parameter: ${insertLine}. It should be within the range of lines of the file: [0, ${lines.length}]`;
  }
  const insertLines = insertText.split(/\r?\n/);
  const next = [...lines.slice(0, insertLine), ...insertLines, ...lines.slice(insertLine)];
  await fs.writeFile(abs, next.join("\n"), "utf8");
  return `The file ${p} has been edited.`;
}

async function handleDelete(p: string): Promise<string> {
  const abs = resolveVirtual(p);
  if (!(await pathExists(abs))) return `Error: The path ${p} does not exist`;
  await fs.rm(abs, { recursive: true, force: true });
  return `Successfully deleted ${p}`;
}

async function handleRename(oldPath: string, newPath: string): Promise<string> {
  const absOld = resolveVirtual(oldPath);
  const absNew = resolveVirtual(newPath);
  if (!(await pathExists(absOld))) return `Error: The path ${oldPath} does not exist`;
  if (await pathExists(absNew)) return `Error: The destination ${newPath} already exists`;
  await fs.mkdir(path.dirname(absNew), { recursive: true });
  await fs.rename(absOld, absNew);
  return `Successfully renamed ${oldPath} to ${newPath}`;
}

// -------------------------- Public dispatch ------------------------------

export async function executeMemoryCommand(input: unknown): Promise<string> {
  if (!input || typeof input !== "object") {
    return `Invalid input: expected an object with a 'command' field.`;
  }
  const cmd = (input as { command?: string }).command;
  try {
    switch (cmd) {
      case "view": {
        const { path: p, view_range } = input as { path: string; view_range?: [number, number] };
        return await handleView(p, view_range);
      }
      case "create": {
        const { path: p, file_text } = input as { path: string; file_text: string };
        return await handleCreate(p, file_text);
      }
      case "str_replace": {
        const { path: p, old_str, new_str } = input as {
          path: string;
          old_str: string;
          new_str: string;
        };
        return await handleStrReplace(p, old_str, new_str);
      }
      case "insert": {
        const { path: p, insert_line, insert_text } = input as {
          path: string;
          insert_line: number;
          insert_text: string;
        };
        return await handleInsert(p, insert_line, insert_text);
      }
      case "delete": {
        const { path: p } = input as { path: string };
        return await handleDelete(p);
      }
      case "rename": {
        const { old_path, new_path } = input as { old_path: string; new_path: string };
        return await handleRename(old_path, new_path);
      }
      default:
        return `Invalid command "${cmd}". Supported: view, create, str_replace, insert, delete, rename.`;
    }
  } catch (err) {
    if (err instanceof PathError) return err.message;
    const msg = err instanceof Error ? err.message : String(err);
    return `Error executing ${cmd}: ${msg}`;
  }
}

// Ensures the root directory exists. Called once per orchestrator run.
export async function ensureMemoryRoot(): Promise<void> {
  await fs.mkdir(CLAUDE_ROOT, { recursive: true });
}

export { CLAUDE_ROOT };
