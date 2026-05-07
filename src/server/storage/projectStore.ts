import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import type { Project } from "../types.js";

interface ProjectFile {
  projects: Project[];
}

export class ProjectStore {
  constructor(private readonly filePath = join(homedir(), ".pi-web", "projects.json")) {}

  async list(): Promise<Project[]> {
    return (await this.read()).projects;
  }

  async add(input: { name?: string; path: string }): Promise<Project> {
    const data = await this.read();
    const path = input.path;
    const existing = data.projects.find((p) => p.path === path);
    if (existing) return existing;

    const project: Project = {
      id: randomUUID(),
      name: input.name?.trim() || path.split("/").filter(Boolean).at(-1) || path,
      path,
      createdAt: new Date().toISOString(),
    };
    data.projects.push(project);
    await this.write(data);
    return project;
  }

  async get(id: string): Promise<Project | undefined> {
    return (await this.list()).find((p) => p.id === id);
  }

  private async read(): Promise<ProjectFile> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as ProjectFile;
    } catch (error: any) {
      if (error?.code === "ENOENT") return { projects: [] };
      throw error;
    }
  }

  private async write(data: ProjectFile): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }
}
