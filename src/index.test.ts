import { describe, it, expect } from "bun:test";
import type { Dirent } from "node:fs";
import { SkillsAsCommands, type PluginConfig } from "../src/index";
import type { FileSystem } from "../src/file-system";

class InMemoryFileSystem implements FileSystem {
  private files = new Map<string, string>();
  private dirEntries = new Map<string, string[]>();
  private knownDirs = new Set<string>();

  addFile(path: string, content: string): void {
    this.files.set(path, content);
    const parent = path.substring(0, path.lastIndexOf("/"));
    if (parent) {
      this.ensureParentDirs(path);
      this.knownDirs.add(parent);
      const basename = path.substring(parent.length + 1);
      const existing = this.dirEntries.get(parent) ?? [];
      if (!existing.includes(basename)) {
        this.dirEntries.set(parent, [...existing, basename]);
      }
    }
  }

  addDirectory(path: string, entries: string[]): void {
    this.dirEntries.set(path, entries);
    this.knownDirs.add(path);
  }

  async readdir(path: string): Promise<Dirent[]> {
    if (!this.knownDirs.has(path)) throw new Error(`ENOENT: ${path}`);
    const entries = this.dirEntries.get(path) ?? [];
    return entries.map((name) => this.toDirent(name, path));
  }

  async readFile(path: string, _encoding: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`ENOENT: ${path}`);
    return content;
  }

  async access(path: string): Promise<void> {
    if (this.files.has(path)) return;
    throw new Error(`ENOENT: ${path}`);
  }

  private ensureParentDirs(path: string): void {
    const segments = path.split("/");
    for (let i = 2; i < segments.length; i++) {
      const ancestor = segments.slice(0, i).join("/");
      if (!this.knownDirs.has(ancestor)) {
        this.knownDirs.add(ancestor);
        this.dirEntries.set(ancestor, []);
      }
    }
  }

  private toDirent(name: string, parent: string): Dirent {
    const childPath = `${parent}/${name}`;
    return {
      name,
      isDirectory: () => this.knownDirs.has(childPath),
      isFile: () => !this.knownDirs.has(childPath),
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isSymbolicLink: () => false,
      isFIFO: () => false,
      isSocket: () => false,
      parentPath: parent,
      path: childPath,
      [Symbol.toStringTag]: "Dirent",
    } as Dirent;
  }
}

function skillMd(opts: {
  name?: string;
  description?: string;
  body?: string;
}): string {
  const frontmatter: string[] = ["---"];
  if (opts.name !== undefined) frontmatter.push(`name: ${opts.name}`);
  if (opts.description !== undefined)
    frontmatter.push(`description: ${opts.description}`);
  frontmatter.push("---");
  frontmatter.push("");
  if (opts.body) frontmatter.push(opts.body);
  return frontmatter.join("\n");
}

describe("SkillsAsCommands", () => {
  function createPlugin(fs: InMemoryFileSystem) {
    return SkillsAsCommands({ worktree: "/fake", fs });
  }

  it("registers no commands when no skills exist", async () => {
    const fs = new InMemoryFileSystem();
    fs.addDirectory("/fake/.claude/skills", []);

    const plugin = await createPlugin(fs);
    const cfg: PluginConfig = {};
    await plugin.config(cfg);

    expect(cfg.command ?? {}).toEqual({});
  });

  it("registers a single skill as a command", async () => {
    const fs = new InMemoryFileSystem();
    fs.addDirectory("/fake/.claude/skills", ["code-review"]);
    fs.addDirectory("/fake/.claude/skills/code-review", []);
    fs.addFile(
      "/fake/.claude/skills/code-review/SKILL.md",
      skillMd({
        name: "code-review",
        description: "Review code changes",
        body: "## Instructions\n\nReview the diff.",
      }),
    );

    const plugin = await createPlugin(fs);
    const cfg: PluginConfig = {};
    await plugin.config(cfg);

    expect(cfg.command["code-review"]).toEqual({
      template: "## Instructions\n\nReview the diff.",
      description: "Review code changes",
    });
  });

  it("registers multiple skills", async () => {
    const fs = new InMemoryFileSystem();
    fs.addDirectory("/fake/.claude/skills", ["code-review", "tdd"]);
    fs.addDirectory("/fake/.claude/skills/code-review", []);
    fs.addFile(
      "/fake/.claude/skills/code-review/SKILL.md",
      skillMd({
        name: "code-review",
        description: "Review code changes",
        body: "Review the diff.",
      }),
    );
    fs.addDirectory("/fake/.claude/skills/tdd", []);
    fs.addFile(
      "/fake/.claude/skills/tdd/SKILL.md",
      skillMd({
        name: "tdd",
        description: "Test-driven development",
        body: "Write tests first.",
      }),
    );

    const plugin = await createPlugin(fs);
    const cfg: PluginConfig = {};
    await plugin.config(cfg);

    expect(Object.keys(cfg.command)).toHaveLength(2);
    expect(cfg.command["code-review"].description).toBe("Review code changes");
    expect(cfg.command.tdd.description).toBe("Test-driven development");
  });

  it("skips skills without name frontmatter", async () => {
    const fs = new InMemoryFileSystem();
    fs.addDirectory("/fake/.claude/skills", ["bad"]);
    fs.addDirectory("/fake/.claude/skills/bad", []);
    fs.addFile(
      "/fake/.claude/skills/bad/SKILL.md",
      "---\ndescription: No name field\n---\n\ncontent",
    );

    const plugin = await createPlugin(fs);
    const cfg: PluginConfig = {};
    await plugin.config(cfg);

    expect(cfg.command ?? {}).toEqual({});
  });

  it("skips skills with malformed YAML frontmatter", async () => {
    const fs = new InMemoryFileSystem();
    fs.addDirectory("/fake/.claude/skills", ["broken"]);
    fs.addDirectory("/fake/.claude/skills/broken", []);
    fs.addFile(
      "/fake/.claude/skills/broken/SKILL.md",
      "---\nname: broken\ndescription:\n  - unclosed\n\nbody",
    );

    const plugin = await createPlugin(fs);
    const cfg: PluginConfig = {};
    await plugin.config(cfg);

    expect(cfg.command ?? {}).toEqual({});
  });

  it("preserves existing commands in cfg", async () => {
    const fs = new InMemoryFileSystem();
    fs.addDirectory("/fake/.claude/skills", ["test"]);
    fs.addDirectory("/fake/.claude/skills/test", []);
    fs.addFile(
      "/fake/.claude/skills/test/SKILL.md",
      skillMd({
        name: "test",
        description: "Run tests",
        body: "Run the suite.",
      }),
    );

    const plugin = await createPlugin(fs);
    const cfg: PluginConfig = {
      command: { existing: { template: "do stuff", description: "Old" } },
    };
    await plugin.config(cfg);

    expect(cfg.command.existing).toEqual({
      template: "do stuff",
      description: "Old",
    });
    expect(cfg.command.test).toEqual({
      template: "Run the suite.",
      description: "Run tests",
    });
  });

  it("handles a missing skill directory gracefully", async () => {
    const fs = new InMemoryFileSystem();
    // No directories added — readdir will return empty, which throws ENOENT in InMemoryFileSystem
    // But readdir returns existing entries; if path doesn't exist, it should be empty
    // The real fs would throw ENOENT. Our InMemoryFileSystem returns [] for unknown dirs.
    // This test ensures scanDir handles empty directories gracefully.
    const plugin = await createPlugin(fs);
    const cfg: PluginConfig = {};
    await plugin.config(cfg);

    expect(cfg.command ?? {}).toEqual({});
  });
});
