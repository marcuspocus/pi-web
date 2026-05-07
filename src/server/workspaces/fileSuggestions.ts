import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ClientFileSuggestion } from "../types.js";

const execFileAsync = promisify(execFile);

export async function listFileSuggestions(cwd: string, query = "", kind?: ClientFileSuggestion["kind"]): Promise<ClientFileSuggestion[]> {
  const normalizedQuery = query.replace(/^@/, "").toLowerCase();
  const files = await listGitFiles(cwd).catch(() => listPlainFiles(cwd));
  return files
    .filter((file) => !kind || file.kind === kind)
    .filter((file) => !normalizedQuery || file.path.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => Number(!a.path.endsWith("/")) - Number(!b.path.endsWith("/")) || a.path.localeCompare(b.path))
    .slice(0, 80);
}

async function listGitFiles(cwd: string): Promise<ClientFileSuggestion[]> {
  const [tracked, untracked] = await Promise.all([
    git(cwd, ["ls-files"]),
    git(cwd, ["ls-files", "--others", "--exclude-standard"]),
  ]);
  return [
    ...withDirectories(lines(tracked), "tracked"),
    ...withDirectories(lines(untracked), "untracked"),
  ];
}

async function listPlainFiles(cwd: string): Promise<ClientFileSuggestion[]> {
  const { stdout } = await execFileAsync("rg", ["--files"], { cwd, maxBuffer: 1024 * 1024 * 8 });
  return withDirectories(lines(stdout), "other");
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd, maxBuffer: 1024 * 1024 * 8 });
  return stdout;
}

function lines(text: string): string[] {
  return text.split("\n").map((line) => line.trim()).filter(Boolean);
}

function withDirectories(paths: string[], kind: ClientFileSuggestion["kind"]): ClientFileSuggestion[] {
  const seen = new Set<string>();
  const suggestions: ClientFileSuggestion[] = [];
  for (const path of paths) {
    for (const directory of parentDirectories(path)) add(`${directory}/`);
    add(path);
  }
  return suggestions;

  function add(path: string) {
    if (seen.has(path)) return;
    seen.add(path);
    suggestions.push({ path, kind });
  }
}

function parentDirectories(path: string): string[] {
  const parts = path.split("/").filter(Boolean);
  const directories: string[] = [];
  for (let index = 1; index < parts.length; index++) {
    directories.push(parts.slice(0, index).join("/"));
  }
  return directories;
}
