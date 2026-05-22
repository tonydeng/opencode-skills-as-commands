import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { join } from "node:path";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { NodeFileSystem } from "../src/file-system";

let tmpDir: string;
const fs = new NodeFileSystem();

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "oc-fs-test-"));
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

async function createFile(
  relativePath: string,
  content: string,
): Promise<string> {
  const fullPath = join(tmpDir, relativePath);
  await mkdir(join(tmpDir, relativePath, ".."), { recursive: true });
  await writeFile(fullPath, content, "utf-8");
  return fullPath;
}

describe("NodeFileSystem", () => {
  it("readdir returns entries with directory flag", async () => {
    await createFile(
      "skills/foo/SKILL.md",
      "---\nname: foo\ndescription: bar\n---\n\nbody",
    );

    const dirs = await fs.readdir(join(tmpDir, "skills"));
    const names = dirs.map((d) => d.name).sort();
    expect(names).toEqual(["foo"]);
    expect(dirs[0].isDirectory()).toBe(true);
    expect(dirs[0].isFile()).toBe(false);
  });

  it("readdir returns empty array for empty directory", async () => {
    await mkdir(join(tmpDir, "empty"), { recursive: true });
    const dirs = await fs.readdir(join(tmpDir, "empty"));
    expect(dirs).toEqual([]);
  });

  it("readdir throws for non-existent path", async () => {
    await expect(fs.readdir(join(tmpDir, "does-not-exist"))).rejects.toThrow();
  });

  it("readFile returns file contents", async () => {
    const path = await createFile("data.txt", "hello world");
    const content = await fs.readFile(path, "utf-8");
    expect(content).toBe("hello world");
  });

  it("readFile throws for non-existent file", async () => {
    await expect(
      fs.readFile(join(tmpDir, "nope.txt"), "utf-8"),
    ).rejects.toThrow();
  });

  it("access resolves for existing file", async () => {
    const path = await createFile("exists.md", "content");
    await expect(fs.access(path)).resolves.toBeUndefined();
  });

  it("access throws for non-existent file", async () => {
    await expect(fs.access(join(tmpDir, "gone.md"))).rejects.toThrow();
  });
});
