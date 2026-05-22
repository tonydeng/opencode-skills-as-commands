import { join } from "node:path";
import { homedir } from "node:os";
import matter from "gray-matter";
import type { FileSystem } from "./file-system";

const home = homedir();

export const SKILL_PATHS = (worktree: string) => [
  join(worktree, ".opencode/skills"),
  join(home, ".config/opencode/skills"),
  join(worktree, ".claude/skills"),
  join(home, ".claude/skills"),
  join(worktree, ".agents/skills"),
  join(home, ".agents/skills"),
];

export type CommandMap = Record<
  string,
  { template: string; description: string }
>;

/**
 * Reads a single skill directory and returns a command map for every valid
 * SKILL.md found. Skills missing `name` or `description` frontmatter are
 * silently skipped.
 *
 * @param base - Path to the skill directory (e.g. `.opencode/skills`)
 * @param fs   - Filesystem abstraction
 * @returns A map of skill name → command definition
 */
export async function scanDir(
  base: string,
  fs: FileSystem,
): Promise<CommandMap> {
  const commands: CommandMap = {};
  let dirs: Awaited<ReturnType<FileSystem["readdir"]>>;
  try {
    dirs = await fs.readdir(base);
  } catch {
    return commands;
  }
  for (const entry of dirs) {
    if (!entry.isDirectory()) continue;
    const mdPath = join(base, entry.name, "SKILL.md");
    try {
      await fs.access(mdPath);
      const raw = await fs.readFile(mdPath, "utf-8");
      const { data, content } = matter(raw);
      if (data.name && data.description) {
        commands[data.name] = {
          template: content.trim(),
          description: data.description,
        };
      }
    } catch {
      /* skip missing/invalid SKILL.md */
    }
  }
  return commands;
}
