import { NodeFileSystem, type FileSystem } from "./file-system";
import { scanDir, SKILL_PATHS } from "./scanner";

export interface PluginConfig {
  command?: Record<string, { template: string; description: string }>;
}

/**
 * Scans all standard OpenCode skill directories and registers each valid
 * SKILL.md as a slash command via the config hook. Skills with valid
 * `name` and `description` frontmatter appear in `/` autocomplete in the TUI.
 *
 * @param worktree - The git worktree root path (project directory)
 * @param fs - Optional filesystem abstraction; defaults to real filesystem
 * @returns Plugin hooks object with a `config` hook that mutates the command registry
 */
export const SkillsAsCommands = async ({
  worktree,
  fs = new NodeFileSystem(),
}: {
  worktree: string;
  fs?: FileSystem;
}) => {
  const results = await Promise.all(
    SKILL_PATHS(worktree).map((base) => scanDir(base, fs)),
  );

  const all: Record<string, { template: string; description: string }> = {};
  for (const result of results) {
    Object.assign(all, result);
  }

  return {
    config: async (cfg: PluginConfig) => {
      cfg.command ??= {};
      Object.assign(cfg.command, all);
    },
  };
};
