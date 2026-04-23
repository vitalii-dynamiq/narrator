import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { executeMemoryCommand, ensureMemoryRoot } from "@/lib/agents/memory-store";

const CLAUDE_ROOT = path.resolve(process.cwd(), "memories", "claude");
const TEST_PATH = "/memories/__test.md";
const TEST_DISK = path.join(CLAUDE_ROOT, "__test.md");

async function cleanup() {
  await fs.rm(TEST_DISK, { force: true });
  await fs.rm(path.join(CLAUDE_ROOT, "__renamed.md"), { force: true });
}

beforeEach(async () => {
  await ensureMemoryRoot();
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

describe("memory-store · path traversal hardening", () => {
  it("rejects ../ escape", async () => {
    const r = await executeMemoryCommand({ command: "view", path: "/memories/../../etc/passwd" });
    expect(r).toMatch(/traversal not allowed/i);
  });
  it("rejects URL-encoded traversal", async () => {
    const r = await executeMemoryCommand({
      command: "view",
      path: "/memories/%2e%2e/%2e%2e/etc/passwd",
    });
    expect(r).toMatch(/traversal not allowed/i);
  });
  it("rejects paths that don't start with /memories", async () => {
    const r = await executeMemoryCommand({ command: "view", path: "/etc/passwd" });
    expect(r).toMatch(/paths must start with \/memories/);
  });
  it("rejects empty path", async () => {
    const r = await executeMemoryCommand({ command: "view", path: "" });
    expect(r).toMatch(/does not exist/i);
  });
});

describe("memory-store · view", () => {
  it("lists the /memories directory", async () => {
    const r = await executeMemoryCommand({ command: "view", path: "/memories" });
    expect(r).toMatch(/files and directories up to 2 levels deep/);
    expect(r).toMatch(/fortuna\.md/);
  });
  it("returns numbered lines for a file", async () => {
    const r = await executeMemoryCommand({
      command: "view",
      path: "/memories/fortuna.md",
    });
    expect(r).toMatch(/Here's the content of \/memories\/fortuna\.md with line numbers/);
    expect(r).toMatch(/ {5}1\t/); // 6-char right-aligned line number + tab
  });
  it("errors for a missing file", async () => {
    const r = await executeMemoryCommand({
      command: "view",
      path: "/memories/__nope.md",
    });
    expect(r).toMatch(/does not exist/);
  });
});

describe("memory-store · create + str_replace + insert + delete + rename", () => {
  it("create rejects a path that already exists", async () => {
    await executeMemoryCommand({ command: "create", path: TEST_PATH, file_text: "hello\n" });
    const r = await executeMemoryCommand({
      command: "create",
      path: TEST_PATH,
      file_text: "hello\n",
    });
    expect(r).toMatch(/already exists/);
  });

  it("create → view round-trip", async () => {
    await executeMemoryCommand({
      command: "create",
      path: TEST_PATH,
      file_text: "hello\nworld\n",
    });
    const r = await executeMemoryCommand({ command: "view", path: TEST_PATH });
    expect(r).toMatch(/hello/);
    expect(r).toMatch(/world/);
  });

  it("str_replace swaps a unique substring", async () => {
    await executeMemoryCommand({
      command: "create",
      path: TEST_PATH,
      file_text: "Favourite colour: blue\n",
    });
    const r = await executeMemoryCommand({
      command: "str_replace",
      path: TEST_PATH,
      old_str: "blue",
      new_str: "green",
    });
    expect(r).toMatch(/memory file has been edited/);
    const content = await fs.readFile(TEST_DISK, "utf8");
    expect(content).toMatch(/green/);
    expect(content).not.toMatch(/blue/);
  });

  it("str_replace errors when the substring is absent", async () => {
    await executeMemoryCommand({
      command: "create",
      path: TEST_PATH,
      file_text: "something\n",
    });
    const r = await executeMemoryCommand({
      command: "str_replace",
      path: TEST_PATH,
      old_str: "nope",
      new_str: "x",
    });
    expect(r).toMatch(/did not appear verbatim/);
  });

  it("str_replace errors when the substring is ambiguous", async () => {
    await executeMemoryCommand({
      command: "create",
      path: TEST_PATH,
      file_text: "foo\nfoo\n",
    });
    const r = await executeMemoryCommand({
      command: "str_replace",
      path: TEST_PATH,
      old_str: "foo",
      new_str: "bar",
    });
    expect(r).toMatch(/Multiple occurrences/);
  });

  it("insert adds at a valid line number", async () => {
    await executeMemoryCommand({
      command: "create",
      path: TEST_PATH,
      file_text: "one\ntwo\nthree\n",
    });
    const r = await executeMemoryCommand({
      command: "insert",
      path: TEST_PATH,
      insert_line: 1,
      insert_text: "one-and-a-half",
    });
    expect(r).toMatch(/has been edited/);
    const content = await fs.readFile(TEST_DISK, "utf8");
    expect(content).toMatch(/one\none-and-a-half\ntwo/);
  });

  it("insert rejects an out-of-range line number", async () => {
    await executeMemoryCommand({
      command: "create",
      path: TEST_PATH,
      file_text: "one\n",
    });
    const r = await executeMemoryCommand({
      command: "insert",
      path: TEST_PATH,
      insert_line: 99,
      insert_text: "x",
    });
    expect(r).toMatch(/Invalid.*insert_line/);
  });

  it("rename moves a file", async () => {
    await executeMemoryCommand({ command: "create", path: TEST_PATH, file_text: "hi\n" });
    const r = await executeMemoryCommand({
      command: "rename",
      old_path: TEST_PATH,
      new_path: "/memories/__renamed.md",
    });
    expect(r).toMatch(/renamed/);
    const exists = await fs
      .stat(path.join(CLAUDE_ROOT, "__renamed.md"))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it("delete removes the file", async () => {
    await executeMemoryCommand({ command: "create", path: TEST_PATH, file_text: "hi\n" });
    const r = await executeMemoryCommand({ command: "delete", path: TEST_PATH });
    expect(r).toMatch(/Successfully deleted/);
    const exists = await fs
      .stat(TEST_DISK)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it("delete errors on missing path", async () => {
    const r = await executeMemoryCommand({
      command: "delete",
      path: "/memories/__nope.md",
    });
    expect(r).toMatch(/does not exist/);
  });

  it("rejects an unknown command", async () => {
    const r = await executeMemoryCommand({ command: "nuke", path: "/memories" });
    expect(r).toMatch(/Invalid command/);
  });
});
