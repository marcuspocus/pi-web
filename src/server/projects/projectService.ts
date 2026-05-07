import { realpath, stat } from "node:fs/promises";
import type { ProjectStore } from "../storage/projectStore.js";
import type { Project } from "../types.js";

export class ProjectService {
  constructor(private readonly store: ProjectStore) {}

  list(): Promise<Project[]> {
    return this.store.list();
  }

  async add(input: { name?: string; path: string }): Promise<Project> {
    const resolved = await realpath(input.path);
    const s = await stat(resolved);
    if (!s.isDirectory()) throw new Error("Project path must be a directory");
    return this.store.add({ name: input.name, path: resolved });
  }

  async requireProject(id: string): Promise<Project> {
    const project = await this.store.get(id);
    if (!project) throw new Error("Project not found");
    return project;
  }
}
