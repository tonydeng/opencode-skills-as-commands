import { readdir, readFile, access } from "node:fs/promises";
import type { Dirent } from "node:fs";

/**
 * Filesystem abstraction used by scanDir. Implementations include
 * {@link NodeFileSystem} for production and an in-memory variant for testing.
 */
export interface FileSystem {
  readdir(path: string): Promise<Dirent[]>;
  readFile(path: string, encoding: string): Promise<string>;
  access(path: string): Promise<void>;
}

/**
 * Production filesystem backed by `node:fs/promises`.
 */
export class NodeFileSystem implements FileSystem {
  async readdir(path: string): Promise<Dirent[]> {
    return readdir(path, { withFileTypes: true });
  }
  async readFile(path: string, encoding: string): Promise<string> {
    return readFile(path, encoding);
  }
  async access(path: string): Promise<void> {
    await access(path);
  }
}
